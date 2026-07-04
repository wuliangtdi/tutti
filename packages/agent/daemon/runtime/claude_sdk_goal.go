package agentruntime

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	activityshared "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity/events"
)

// Claude Code's goal machinery lives inside the CLI: /goal arms a
// session-level condition whose evaluator drives autonomous new turns until
// it is met, surfacing goal_status attachments — but none of it is reachable
// through the SDK as an API (no goal RPC, no paused state; an interrupted
// goal stays active and resumes continuation after the next user message).
// Goal control is therefore emulated at the adapter: the local goal mirror
// (what the GUI banner renders) updates immediately, and the CLI is kept in
// sync through its own /goal command forwarded as a sidecar exec — queued
// behind the running turn when one is live. Pause = interrupt + CLI-side
// /goal clear with the objective retained in the mirror; resume re-arms
// /goal from the mirror.

// GoalControl performs a direct goal action (GUI banner buttons) without
// claiming the session's turn slot.
func (a *ClaudeCodeSDKAdapter) GoalControl(
	ctx context.Context,
	session Session,
	action GoalControlAction,
	objective string,
) ([]activityshared.Event, map[string]any, error) {
	adapterSession := a.getSession(session.AgentSessionID)
	if adapterSession == nil {
		return nil, nil, ErrSessionDisconnected
	}
	session.ProviderSessionID = adapterSession.providerSessionID
	slog.Info("agent session claude sdk goal control",
		"event", "agent_session.claude_sdk.goal.control",
		"agent_session_id", session.AgentSessionID,
		"action", string(action),
	)

	var events []activityshared.Event
	switch action {
	case GoalControlSet:
		objective = strings.TrimSpace(objective)
		if objective == "" {
			return nil, nil, fmt.Errorf("goal objective is required")
		}
		a.applyLocalGoal(adapterSession, map[string]any{"objective": objective, "status": "active"})
		if err := a.sendGoalCommandExec(ctx, session, adapterSession, appServerSlashGoal+" "+objective); err != nil {
			return nil, nil, err
		}
		events = a.goalMirrorEvents(session, "thread_goal_update")
	case GoalControlClear:
		a.applyLocalGoal(adapterSession, nil)
		if err := a.sendGoalCommandExec(ctx, session, adapterSession, appServerSlashGoal+" clear"); err != nil {
			return nil, nil, err
		}
		events = a.goalMirrorEvents(session, "thread_goal_cleared")
	case GoalControlPause:
		goal := a.localGoal(adapterSession)
		if len(goal) == 0 {
			return nil, nil, fmt.Errorf("session has no goal to pause")
		}
		goal["status"] = "paused"
		a.applyLocalGoal(adapterSession, goal)
		events = a.goalMirrorEvents(session, "thread_goal_update")
		if a.hasLiveTurns(adapterSession) {
			// Stop the work in flight; the sidecar settles the turn as
			// canceled through the normal event path.
			cancelEvents, err := a.Cancel(ctx, session, "")
			if err != nil {
				return nil, nil, err
			}
			events = append(events, cancelEvents...)
		}
		// An interrupt alone does not pause: Claude Code keeps an
		// interrupted goal active and its evaluator resumes autonomous
		// continuation after the next user message. Clear the CLI-side goal
		// so paused sticks; the objective survives in the local mirror
		// (applyGoalUpdated drops the clear's echo while paused).
		if err := a.sendGoalCommandExec(ctx, session, adapterSession, appServerSlashGoal+" clear"); err != nil {
			return nil, nil, err
		}
	case GoalControlResume:
		goal := a.localGoal(adapterSession)
		if len(goal) == 0 {
			return nil, nil, fmt.Errorf("session has no goal to resume")
		}
		objective := strings.TrimSpace(asStringRaw(goal["objective"]))
		if objective == "" {
			return nil, nil, fmt.Errorf("session goal has no objective to resume")
		}
		goal["status"] = "active"
		a.applyLocalGoal(adapterSession, goal)
		events = a.goalMirrorEvents(session, "thread_goal_update")
		// Pause cleared the CLI-side goal, so resume must re-arm /goal
		// regardless of turn state (a live turn just queues it). Iterations,
		// timer, and token baseline reset — inherent to re-setting a goal.
		if err := a.sendGoalCommandExec(ctx, session, adapterSession, appServerSlashGoal+" "+objective); err != nil {
			return nil, nil, err
		}
	default:
		return nil, nil, fmt.Errorf("unsupported goal control action %q", action)
	}
	return events, a.localGoal(adapterSession), nil
}

// ExecGoalControl handles a typed "/goal …" prompt while another turn holds
// the session's turn slot, so the command acts immediately instead of being
// rejected by the single-turn gate. handled is false when the prompt is not a
// /goal command.
func (a *ClaudeCodeSDKAdapter) ExecGoalControl(
	ctx context.Context,
	session Session,
	content []PromptContentBlock,
	displayPrompt string,
	turnID string,
) ([]activityshared.Event, bool, error) {
	explicitDisplayPrompt, visibleText := explicitAndVisiblePromptText(content, displayPrompt)
	command, args := splitSlashCommand(visibleText)
	if command != appServerSlashGoal {
		return nil, false, nil
	}
	adapterSession := a.getSession(session.AgentSessionID)
	if adapterSession == nil {
		return nil, true, ErrSessionDisconnected
	}
	action, objective := goalControlActionFromSlashArgs(args)
	// The submission is recorded like a steered message so the controller
	// closes this Exec's turn record while the running turn keeps owning the
	// session lifecycle.
	events := []activityshared.Event{
		newTurnActivityEvent(session, EventMessage, turnID, "", RoleUser, visibleText, userPromptActivityPayload(content, explicitDisplayPrompt, userPromptActivityPayloadExtraFromExecMetadata(ctx, map[string]any{
			"adapter":     claudeSDKSidecarAdapterName,
			"steered":     true,
			"goalControl": true,
		}))),
	}
	if action == "" {
		// Bare "/goal" is a status query; re-state the current mirror.
		events = append(events, a.goalMirrorEvents(session, "thread_goal_update")...)
		return events, true, nil
	}
	controlEvents, _, err := a.GoalControl(ctx, session, action, objective)
	if err != nil {
		return events, true, err
	}
	return append(events, controlEvents...), true, nil
}

// execGoalControlTurn runs a pause/resume /goal prompt as an immediately
// settling turn: the control acts locally (plus an interrupt or continuation
// exec where needed) and never reaches the CLI as prompt text.
func (a *ClaudeCodeSDKAdapter) execGoalControlTurn(
	ctx context.Context,
	session Session,
	adapterSession *claudeSDKAdapterSession,
	content []PromptContentBlock,
	explicitDisplayPrompt string,
	visibleText string,
	turnID string,
	emit EventSink,
) ([]activityshared.Event, error) {
	_, args := splitSlashCommand(visibleText)
	action, objective := goalControlActionFromSlashArgs(args)
	events := []activityshared.Event{
		newTurnActivityEvent(session, EventMessage, turnID, "", RoleUser, visibleText, userPromptActivityPayload(content, explicitDisplayPrompt, userPromptActivityPayloadExtraFromExecMetadata(ctx, map[string]any{
			"adapter":     claudeSDKSidecarAdapterName,
			"goalControl": true,
		}))),
		newTurnActivityEvent(session, EventTurnStarted, turnID, SessionStatusWorking, "", "", map[string]any{
			"adapter": claudeSDKSidecarAdapterName,
		}),
	}
	controlEvents, _, err := a.GoalControl(ctx, session, action, objective)
	if err != nil {
		events = append(events, newTurnActivityEvent(session, EventTurnFailed, turnID, SessionStatusFailed, "", "", map[string]any{
			"error": err.Error(),
		}))
		events = a.stampTurnLifecycleSnapshots(adapterSession, events)
		if emit != nil {
			emit(events)
		}
		return events, nil
	}
	events = append(events, controlEvents...)
	events = append(events, newTurnActivityEvent(session, EventTurnCompleted, turnID, SessionStatusReady, "", "", map[string]any{
		"adapter": claudeSDKSidecarAdapterName,
	}))
	events = a.stampTurnLifecycleSnapshots(adapterSession, events)
	if emit != nil {
		emit(events)
	}
	return events, nil
}

// goalControlActionFromSlashArgs maps /goal arguments onto a control action.
func goalControlActionFromSlashArgs(args string) (GoalControlAction, string) {
	trimmed := strings.TrimSpace(args)
	switch strings.ToLower(trimmed) {
	case "":
		return "", ""
	case "clear", "reset":
		return GoalControlClear, ""
	case "pause", "paused":
		return GoalControlPause, ""
	case "resume", "active", "continue":
		return GoalControlResume, ""
	default:
		return GoalControlSet, trimmed
	}
}

// sendGoalCommandExec forwards a /goal command to the sidecar as its own
// exec. The sidecar queues it behind a live turn; its turn events come back
// without a waiter and flow through the session event sink with stamped
// lifecycle snapshots, so the session never strands mid-turn.
func (a *ClaudeCodeSDKAdapter) sendGoalCommandExec(
	ctx context.Context,
	session Session,
	adapterSession *claudeSDKAdapterSession,
	command string,
) error {
	if err := a.startClaudeSDKReader(session.AgentSessionID, adapterSession); err != nil {
		return err
	}
	return a.roundTripClaudeSDK(ctx, session.AgentSessionID, adapterSession, claudeSDKSidecarRequest{
		ID:   newID(),
		Type: "exec",
		Payload: map[string]any{
			"agentSessionId": session.AgentSessionID,
			"turnId":         newID(),
			"prompt":         command,
			"content":        promptContentForClaudeSDK(nil, command),
		},
	})
}

// localGoal returns a copy of the adapter-local goal mirror.
func (a *ClaudeCodeSDKAdapter) localGoal(adapterSession *claudeSDKAdapterSession) map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()
	return clonePayload(adapterSession.liveState.goal)
}

func (a *ClaudeCodeSDKAdapter) applyLocalGoal(adapterSession *claudeSDKAdapterSession, goal map[string]any) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(goal) == 0 {
		adapterSession.liveState.goal = nil
		return
	}
	adapterSession.liveState.goal = clonePayload(goal)
}

func (a *ClaudeCodeSDKAdapter) goalMirrorEvents(session Session, updateType string) []activityshared.Event {
	if event, ok := acpGoalUpdatedEvent(session, updateType); ok {
		return []activityshared.Event{event}
	}
	return nil
}

func (a *ClaudeCodeSDKAdapter) hasLiveTurns(adapterSession *claudeSDKAdapterSession) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(adapterSession.turns) > 0
}
