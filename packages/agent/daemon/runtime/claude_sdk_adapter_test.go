package agentruntime

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	agentsessionstore "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity"
	activityshared "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity/events"
)

func TestDefaultControllerUsesClaudeSDKAdapterWhenRuntimeFlagSet(t *testing.T) {
	t.Setenv(claudeCodeRuntimeEnv, claudeCodeRuntimeSDK)

	controller := NewDefaultControllerWithProcessTransport(nil, nil)
	if _, ok := controller.adapters[ProviderClaudeCode].(*ClaudeCodeSDKAdapter); !ok {
		t.Fatalf("claude-code adapter = %T, want *ClaudeCodeSDKAdapter", controller.adapters[ProviderClaudeCode])
	}
}

func TestClaudeCodeSDKAdapterExecWithSidecarTestDriver(t *testing.T) {
	t.Setenv(claudeSDKSidecarTestDriverEnv, "1")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	adapter := NewClaudeCodeSDKAdapter(NewLocalProcessTransport())
	session := standardTestSession(ProviderClaudeCode)
	session.CWD = t.TempDir()

	startEvents, err := adapter.Start(ctx, session)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if len(startEvents) != 1 || startEvents[0].Type != activityshared.EventSessionStarted {
		t.Fatalf("Start() events = %#v, want session.started", startEvents)
	}
	if strings.HasPrefix(startEvents[0].ProviderSessionID, "claude-sdk-") {
		t.Fatalf("ProviderSessionID = %q, want Claude SDK-compatible UUID", startEvents[0].ProviderSessionID)
	}
	if !hasClaudeSDKModelConfigOptions(startEvents[0].Payload.Metadata) {
		t.Fatalf("Start() metadata = %#v, want SDK model config options", startEvents[0].Payload.Metadata)
	}
	session.ProviderSessionID = startEvents[0].ProviderSessionID
	defer func() {
		_ = adapter.Close(context.Background(), session)
	}()

	var streamed []activityshared.Event
	events, err := adapter.Exec(
		ctx,
		session,
		[]PromptContentBlock{{Type: "text", Text: "say hello"}},
		"say hello",
		"turn-sdk-1",
		func(next []activityshared.Event) { streamed = append(streamed, next...) },
		nil,
	)
	if err != nil {
		t.Fatalf("Exec() error = %v", err)
	}
	if len(events) == 0 {
		t.Fatal("Exec() events empty")
	}
	if len(streamed) == 0 {
		t.Fatal("streamed events empty")
	}

	var sawUser bool
	var assistantText string
	var completed bool
	for _, event := range events {
		if event.Type == activityshared.EventMessageAppended &&
			event.Payload.Role == activityshared.MessageRoleUser &&
			event.Payload.Content == "say hello" {
			sawUser = true
		}
		if event.Type == activityshared.EventMessageAppended &&
			event.Payload.Role == activityshared.MessageRoleAssistant {
			assistantText = event.Payload.Content
		}
		if event.Type == activityshared.EventTurnCompleted &&
			event.Payload.TurnOutcome == string(activityshared.TurnOutcomeCompleted) {
			completed = true
		}
	}
	if !sawUser {
		t.Fatalf("events missing user prompt: %#v", events)
	}
	if !strings.Contains(assistantText, "Echo: say hello") {
		t.Fatalf("assistant text = %q, want echo", assistantText)
	}
	if !completed {
		t.Fatalf("events missing completed turn: %#v", events)
	}
}

func TestClaudeCodeSDKAdapterCanResumeRequiresProviderSessionID(t *testing.T) {
	adapter := NewClaudeCodeSDKAdapter(nil)
	session := standardTestSession(ProviderClaudeCode)
	session.ProviderSessionID = ""
	if adapter.CanResume(session) {
		t.Fatal("CanResume without provider session id = true, want false")
	}
	session.ProviderSessionID = "claude-session-1"
	if !adapter.CanResume(session) {
		t.Fatal("CanResume with provider session id = false, want true")
	}
}

func TestClaudeCodeSDKAdapterResumeClassifiesMissingProviderSession(t *testing.T) {
	session := standardTestSession(ProviderClaudeCode)
	session.ProviderSessionID = "00000000-0000-4000-8000-000000000000"
	err := classifyClaudeSDKResumeError(session, errors.New("Claude Code returned an error result: No conversation found with session ID: 00000000-0000-4000-8000-000000000000"))
	if AppErrorCode(err) != AppErrorProviderSessionNotFound {
		t.Fatalf("app error code = %q, want %q", AppErrorCode(err), AppErrorProviderSessionNotFound)
	}
}

func TestClaudeCodeSDKAdapterControllerPublishesUIActivityWithSidecarTestDriver(t *testing.T) {
	t.Setenv(claudeSDKSidecarTestDriverEnv, "1")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reporter := &recordingReporter{}
	controller := NewController([]Adapter{NewClaudeCodeSDKAdapter(NewLocalProcessTransport())}, reporter)
	started, err := controller.Start(ctx, StartInput{
		RoomID:   "room-1",
		Provider: ProviderClaudeCode,
		CWD:      t.TempDir(),
		Title:    "Claude Code",
	})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	state, err := controller.State(started.Session.RoomID, started.Session.AgentSessionID)
	if err != nil {
		t.Fatalf("State: %v", err)
	}
	if !hasClaudeSDKModelConfigOptions(state.RuntimeContext) {
		t.Fatalf("State runtimeContext = %#v, want SDK model config options", state.RuntimeContext)
	}
	defer func() {
		_, _ = controller.Close(context.Background(), CloseInput{
			RoomID:         started.Session.RoomID,
			AgentSessionID: started.Session.AgentSessionID,
		})
	}()

	events, unsubscribe, ok := controller.Subscribe(started.Session.RoomID, started.Session.AgentSessionID)
	if !ok {
		t.Fatal("Subscribe returned ok=false")
	}
	defer unsubscribe()

	execResult, err := controller.Exec(ctx, ExecInput{
		RoomID:         started.Session.RoomID,
		AgentSessionID: started.Session.AgentSessionID,
		Content:        textPrompt("say hello"),
		DisplayPrompt:  "say hello",
	})
	if err != nil {
		t.Fatalf("Exec: %v", err)
	}
	if !execResult.Accepted || execResult.TurnID == "" {
		t.Fatalf("Exec result = %#v, want accepted result with turn id", execResult)
	}

	var sawUserStream bool
	var sawAssistantStream bool
	deadline := time.After(3 * time.Second)
	for !sawUserStream || !sawAssistantStream {
		select {
		case event := <-events:
			update, ok := event.Data.(agentsessionstore.WorkspaceAgentMessageUpdate)
			if !ok || event.EventType != StreamEventMessageUpdate {
				continue
			}
			if update.Role == "user" && update.Payload["text"] == "say hello" {
				sawUserStream = true
			}
			if update.Role == "assistant" && strings.Contains(asString(update.Payload["content"]), "Echo: say hello") {
				sawAssistantStream = true
			}
		case <-deadline:
			t.Fatalf("stream user=%v assistant=%v, want both", sawUserStream, sawAssistantStream)
		}
	}

	waitForSessionStatus(t, controller, started.Session.RoomID, started.Session.AgentSessionID, SessionStatusReady)
	waitForCondition(t, func() bool {
		reports := reportInputs(reporter.snapshot())
		return hasTimelineItemInReports(reports, "message.user", "completed", "say hello") &&
			hasTimelineItemInReports(reports, "message.assistant", "completed", "") &&
			hasTurnCompletionPatchInReports(reports, execResult.TurnID)
	})
}

func hasTimelineItemInReports(reports []agentsessionstore.ReportActivityInput, itemType string, status string, text string) bool {
	for _, report := range reports {
		if hasTimelineItem(report, itemType, status, text) {
			return true
		}
	}
	return false
}

func hasClaudeSDKModelConfigOptions(runtimeContext map[string]any) bool {
	options, ok := runtimeContext["configOptions"].([]map[string]any)
	if !ok {
		return false
	}
	for _, option := range options {
		if option["id"] != "model" {
			continue
		}
		models, ok := option["options"].([]map[string]string)
		if !ok {
			return false
		}
		var sawDefault bool
		var sawHaiku bool
		for _, model := range models {
			if model["value"] == "default" {
				sawDefault = true
			}
			if model["value"] == "haiku" {
				sawHaiku = true
			}
		}
		return sawDefault && sawHaiku
	}
	return false
}
