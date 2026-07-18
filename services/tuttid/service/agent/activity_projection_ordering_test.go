package agent

import (
	"context"
	"fmt"
	"testing"

	agentsessionstore "github.com/tutti-os/tutti/packages/agent/daemon/activity"
	agentactivitybiz "github.com/tutti-os/tutti/services/tuttid/biz/agentactivity"
	workspacebiz "github.com/tutti-os/tutti/services/tuttid/biz/workspace"
)

func TestActivityProjectionReportPersistsMessagesBeforeSettledState(t *testing.T) {
	ctx := context.Background()
	store := openAgentServiceSQLiteStore(t)
	if err := store.Create(ctx, workspacebiz.Summary{ID: "ws-ordering", Name: "Ordering"}); err != nil {
		t.Fatalf("Create workspace error = %v", err)
	}
	projection := NewActivityProjection(store)
	activeTurnID := "turn-1"
	if err := projection.Report(ctx, agentsessionstore.ReportActivityInput{
		WorkspaceID: "ws-ordering",
		Source: agentsessionstore.EventSource{
			AgentID: "session-1", Provider: "codex",
			SessionOrigin: agentsessionstore.WorkspaceAgentSessionOriginRuntime,
		},
		StatePatches: []agentsessionstore.WorkspaceAgentStatePatch{{
			AgentSessionID: "session-1", Kind: agentactivitybiz.SessionKindRoot,
			Provider: "codex", LifecycleStatus: "active", CurrentPhase: "working", OccurredAtUnixMS: 1,
			Turn: &agentsessionstore.WorkspaceAgentTurnPatch{
				TurnID: "turn-1", Origin: agentactivitybiz.TurnOriginUserPrompt,
				ActiveTurnID: &activeTurnID, Phase: agentactivitybiz.TurnPhaseRunning,
			},
		}},
	}); err != nil {
		t.Fatalf("seed running report error = %v", err)
	}

	if err := projection.Report(ctx, agentsessionstore.ReportActivityInput{
		WorkspaceID: "ws-ordering",
		Source: agentsessionstore.EventSource{
			AgentID: "session-1", Provider: "codex",
			SessionOrigin: agentsessionstore.WorkspaceAgentSessionOriginRuntime,
		},
		SessionAudits: []agentsessionstore.WorkspaceAgentSessionAuditUpdate{{
			AuditID: "audit-1", Role: "user", Content: "audit", OccurredAtUnixMS: 2,
		}},
		MessageUpdates: []agentsessionstore.WorkspaceAgentMessageUpdate{
			{AgentSessionID: "session-1", TurnID: "turn-1", MessageID: "assistant-first", Role: "assistant", Kind: "text", Status: "completed", Payload: map[string]any{"text": "first"}, OccurredAtUnixMS: 3},
			{AgentSessionID: "session-1", TurnID: "turn-1", MessageID: "assistant-final", Role: "assistant", Kind: "text", Status: "completed", Payload: map[string]any{"text": "final"}, OccurredAtUnixMS: 4},
		},
		StatePatches: []agentsessionstore.WorkspaceAgentStatePatch{{
			AgentSessionID: "session-1", Kind: agentactivitybiz.SessionKindRoot,
			Provider: "codex", LifecycleStatus: "ready", CurrentPhase: "idle", OccurredAtUnixMS: 5,
			Turn: &agentsessionstore.WorkspaceAgentTurnPatch{
				TurnID: "turn-1", Phase: agentactivitybiz.TurnPhaseSettled,
				Outcome: agentactivitybiz.TurnOutcomeCompleted, CompletedAtUnixMS: 5,
			},
		}},
	}); err != nil {
		t.Fatalf("settled report error = %v", err)
	}

	turn, found, err := store.GetTurn(ctx, "ws-ordering", "session-1", "turn-1")
	if err != nil || !found || turn.Phase != agentactivitybiz.TurnPhaseSettled {
		t.Fatalf("settled turn = %#v found=%v error=%v", turn, found, err)
	}
	if turn.FinalAssistantMessageID != "assistant-final" {
		t.Fatalf("final assistant anchor = %q, want assistant-final", turn.FinalAssistantMessageID)
	}
	page, found, err := store.ListSessionMessages(ctx, agentactivitybiz.ListSessionMessagesInput{
		WorkspaceID: "ws-ordering", AgentSessionID: "session-1", Limit: 10,
	})
	if err != nil || !found || len(page.Messages) != 3 {
		t.Fatalf("persisted messages = %#v found=%v error=%v", page.Messages, found, err)
	}
}

func TestActivityProjectionReportCreatesProviderInitiatedTurnBeforeMessages(t *testing.T) {
	for _, includeAudit := range []bool{false, true} {
		t.Run(fmt.Sprintf("audit=%v", includeAudit), func(t *testing.T) {
			ctx := context.Background()
			store := openAgentServiceSQLiteStore(t)
			workspaceID := fmt.Sprintf("ws-provider-%v", includeAudit)
			if err := store.Create(ctx, workspacebiz.Summary{ID: workspaceID, Name: "Provider initiated"}); err != nil {
				t.Fatalf("Create workspace error = %v", err)
			}
			projection := NewActivityProjection(store)
			activeTurnID := "turn-provider"
			report := agentsessionstore.ReportActivityInput{
				WorkspaceID: workspaceID,
				Source: agentsessionstore.EventSource{
					AgentID: "session-provider", Provider: "codex",
					SessionOrigin: agentsessionstore.WorkspaceAgentSessionOriginRuntime,
				},
				MessageUpdates: []agentsessionstore.WorkspaceAgentMessageUpdate{{
					AgentSessionID: "session-provider", TurnID: "turn-provider",
					MessageID: "toolcall:call-1", Role: "assistant", Kind: "tool_call", Status: "running",
					Payload: map[string]any{"callId": "call-1", "toolName": "shell"}, OccurredAtUnixMS: 2,
				}},
				StatePatches: []agentsessionstore.WorkspaceAgentStatePatch{{
					AgentSessionID: "session-provider", Kind: agentactivitybiz.SessionKindRoot,
					Provider: "codex", LifecycleStatus: "active", CurrentPhase: "waiting_approval", OccurredAtUnixMS: 1,
					Turn: &agentsessionstore.WorkspaceAgentTurnPatch{
						TurnID: "turn-provider", Origin: agentactivitybiz.TurnOriginProviderInitiated,
						ActiveTurnID: &activeTurnID, Phase: agentactivitybiz.TurnPhaseWaiting,
					},
					InteractionTransition: &agentsessionstore.WorkspaceAgentInteractionTransition{
						RequestID: "request-1", TurnID: "turn-provider", Kind: agentactivitybiz.InteractionKindApproval,
						Status: agentactivitybiz.InteractionStatusPending, ToolName: "shell",
						Input: map[string]any{"command": "git status"},
					},
				}},
			}
			if includeAudit {
				report.SessionAudits = []agentsessionstore.WorkspaceAgentSessionAuditUpdate{{
					AuditID: "audit-1", Role: "user", Content: "audit", OccurredAtUnixMS: 3,
				}}
			}
			if err := projection.Report(ctx, report); err != nil {
				t.Fatalf("provider-initiated report error = %v", err)
			}

			turn, found, err := store.GetTurn(ctx, workspaceID, "session-provider", "turn-provider")
			if err != nil || !found || turn.Origin != agentactivitybiz.TurnOriginProviderInitiated || turn.Phase != agentactivitybiz.TurnPhaseWaiting {
				t.Fatalf("provider turn = %#v found=%v error=%v", turn, found, err)
			}
			interactions, err := store.ListSessionInteractions(ctx, agentactivitybiz.ListSessionInteractionsInput{
				WorkspaceID: workspaceID, AgentSessionID: "session-provider",
			})
			if err != nil || len(interactions) != 1 || interactions[0].Status != agentactivitybiz.InteractionStatusPending {
				t.Fatalf("interactions = %#v error=%v", interactions, err)
			}
			page, found, err := store.ListSessionMessages(ctx, agentactivitybiz.ListSessionMessagesInput{
				WorkspaceID: workspaceID, AgentSessionID: "session-provider", Limit: 10,
			})
			wantMessages := 1
			if includeAudit {
				wantMessages = 2
			}
			if err != nil || !found || len(page.Messages) != wantMessages {
				t.Fatalf("messages = %#v found=%v error=%v, want %d", page.Messages, found, err, wantMessages)
			}
		})
	}
}
