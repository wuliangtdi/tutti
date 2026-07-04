package agentruntime

import (
	"context"
	"strings"
	"testing"
	"time"

	activityshared "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity/events"
)

func newClaudeSDKLifecycleTestSession(t *testing.T, adapter *ClaudeCodeSDKAdapter, conn ProcessConnection) (Session, *claudeSDKAdapterSession) {
	t.Helper()
	session := standardTestSession(ProviderClaudeCode)
	adapterSession := &claudeSDKAdapterSession{
		conn:            conn,
		reader:          &claudeSDKLineReader{conn: conn},
		session:         session,
		pendingRequests: make(map[string]*pendingACPRequest),
		liveState:       newClaudeSDKLiveState(),
	}
	adapter.storeSession(session.AgentSessionID, adapterSession)
	return session, adapterSession
}

func claudeSDKSnapshotForEvent(t *testing.T, events []activityshared.Event, eventType activityshared.EventType) activityshared.TurnLifecycleSnapshot {
	t.Helper()
	for _, event := range events {
		if event.Type != eventType {
			continue
		}
		snapshot, ok := activityshared.TurnLifecycleSnapshotFromEvent(event)
		if !ok {
			t.Fatalf("event %s carries no lifecycle snapshot: %#v", eventType, event.Payload.Metadata)
		}
		return snapshot
	}
	t.Fatalf("no %s event in %#v", eventType, events)
	return activityshared.TurnLifecycleSnapshot{}
}

// The adapter must publish adapter-origin lifecycle snapshots at every turn
// transition it emits, with a per-session monotonic seq, so the session flips
// to snapshot-authority mode and never recomputes lifecycle from discrete
// events (ADR 0008 Phase B).
func TestClaudeSDKAdapterStampsLifecycleSnapshots(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := &recordingClaudeSDKConnection{}
	session, adapterSession := newClaudeSDKLifecycleTestSession(t, adapter, conn)

	var emitted []activityshared.Event
	waiter := adapter.registerClaudeSDKTurn(adapterSession, "turn-1", func(events []activityshared.Event) {
		emitted = append(emitted, events...)
	})

	adapter.dispatchClaudeSDKEvent(session.AgentSessionID, adapterSession, claudeSDKSidecarEvent{
		Type: "approval_requested",
		Payload: map[string]any{
			"turnId":    "turn-1",
			"requestId": "approval-1",
			"toolName":  "Bash",
			"options": []any{
				map[string]any{"kind": "allow_once", "name": "Allow", "optionId": "allow"},
			},
		},
	})
	waiting := claudeSDKSnapshotForEvent(t, emitted, activityshared.EventTurnUpdated)
	if waiting.Origin != activityshared.TurnLifecycleOriginAdapter ||
		waiting.Phase != string(activityshared.TurnPhaseWaitingApproval) ||
		waiting.ActiveTurnID != "turn-1" || waiting.Seq == 0 {
		t.Fatalf("waiting snapshot = %#v", waiting)
	}

	emitted = nil
	adapter.dispatchClaudeSDKEvent(session.AgentSessionID, adapterSession, claudeSDKSidecarEvent{
		Type: "approval_resolved",
		Payload: map[string]any{
			"turnId":    "turn-1",
			"requestId": "approval-1",
			"optionId":  "allow",
		},
	})
	running := claudeSDKSnapshotForEvent(t, emitted, activityshared.EventTurnUpdated)
	if running.Phase != string(activityshared.TurnPhaseRunning) || running.Seq <= waiting.Seq {
		t.Fatalf("resolved snapshot = %#v, want running with seq > %d", running, waiting.Seq)
	}

	emitted = nil
	adapter.dispatchClaudeSDKEvent(session.AgentSessionID, adapterSession, claudeSDKSidecarEvent{
		Type:    "turn_completed",
		Payload: map[string]any{"turnId": "turn-1", "stopReason": "end_turn"},
	})
	settled := claudeSDKSnapshotForEvent(t, emitted, activityshared.EventTurnCompleted)
	if settled.Phase != string(activityshared.TurnPhaseSettled) ||
		settled.Outcome != string(activityshared.TurnOutcomeCompleted) ||
		settled.ActiveTurnID != "" || settled.Seq <= running.Seq {
		t.Fatalf("settled snapshot = %#v", settled)
	}
	select {
	case result := <-waiter.done:
		if result.err != nil {
			t.Fatalf("waiter err = %v", result.err)
		}
	default:
		t.Fatal("terminal event did not settle the waiter")
	}
}

// Cancel on a live turn synthesizes a stamped terminal transition and
// forwards the cancel to the sidecar.
func TestClaudeSDKCancelLiveTurnEmitsStampedTerminal(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := &recordingClaudeSDKConnection{}
	session, _ := newClaudeSDKLifecycleTestSession(t, adapter, conn)

	events, err := adapter.Cancel(context.Background(), session, "turn-live")
	if err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	// turn.canceled folds into turn.completed with an interrupted outcome at
	// event construction.
	snapshot := claudeSDKSnapshotForEvent(t, events, activityshared.EventTurnCompleted)
	if snapshot.Phase != string(activityshared.TurnPhaseSettled) ||
		snapshot.Outcome != string(activityshared.TurnOutcomeInterrupted) {
		t.Fatalf("cancel snapshot = %#v", snapshot)
	}
	sent := conn.sentRequests()
	if len(sent) != 1 || sent[0].Type != "cancel" {
		t.Fatalf("sent requests = %#v, want one cancel", sent)
	}
}

// A cancel racing the turn's own settle must not fabricate a second,
// contradicting terminal event (the stuck-view class ADR 0008 removes).
func TestClaudeSDKCancelAfterSettleIsIdempotent(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := &recordingClaudeSDKConnection{}
	session, adapterSession := newClaudeSDKLifecycleTestSession(t, adapter, conn)

	adapter.registerClaudeSDKTurn(adapterSession, "turn-1", nil)
	adapter.dispatchClaudeSDKEvent(session.AgentSessionID, adapterSession, claudeSDKSidecarEvent{
		Type:    "turn_completed",
		Payload: map[string]any{"turnId": "turn-1"},
	})

	events, err := adapter.Cancel(context.Background(), session, "turn-1")
	if err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("cancel re-terminated a settled turn: %#v", events)
	}
}

// Goal set/clear keep the CLI in sync through its native /goal command and
// mirror the state locally for the GUI banner.
func TestClaudeSDKGoalControlSetAndClear(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := newBlockingClaudeSDKConnection()
	defer conn.Close()
	session, adapterSession := newClaudeSDKLifecycleTestSession(t, adapter, conn)

	type controlResult struct {
		events []activityshared.Event
		goal   map[string]any
		err    error
	}
	results := make(chan controlResult, 1)
	go func() {
		events, goal, err := adapter.GoalControl(context.Background(), session, GoalControlSet, "ship it")
		results <- controlResult{events, goal, err}
	}()
	request := waitForClaudeSDKSentRequest(t, conn, "exec")
	if prompt := payloadString(request.Payload, "prompt"); prompt != "/goal ship it" {
		t.Fatalf("goal set prompt = %q", prompt)
	}
	conn.pushEvent(claudeSDKSidecarEvent{ID: request.ID, Type: "ok"})
	result := <-results
	if result.err != nil {
		t.Fatalf("GoalControl set: %v", result.err)
	}
	if result.goal["objective"] != "ship it" || result.goal["status"] != "active" {
		t.Fatalf("goal after set = %#v", result.goal)
	}
	assertClaudeSDKGoalUpdateEvent(t, result.events, "thread_goal_update")

	go func() {
		events, goal, err := adapter.GoalControl(context.Background(), session, GoalControlClear, "")
		results <- controlResult{events, goal, err}
	}()
	clearRequest := waitForClaudeSDKSentRequestMatching(t, conn, "exec", "/goal clear")
	conn.pushEvent(claudeSDKSidecarEvent{ID: clearRequest.ID, Type: "ok"})
	result = <-results
	if result.err != nil {
		t.Fatalf("GoalControl clear: %v", result.err)
	}
	if len(result.goal) != 0 {
		t.Fatalf("goal after clear = %#v", result.goal)
	}
	assertClaudeSDKGoalUpdateEvent(t, result.events, "thread_goal_cleared")
	if goal := adapter.localGoal(adapterSession); len(goal) != 0 {
		t.Fatalf("local goal not cleared: %#v", goal)
	}
}

// Claude Code has no paused goal state; the adapter must reject pause and
// resume instead of emulating semantics the CLI cannot honor. The GUI hides
// these controls via the missing CapabilityGoalPause.
func TestClaudeSDKGoalControlPauseAndResumeUnsupported(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := &recordingClaudeSDKConnection{}
	session, adapterSession := newClaudeSDKLifecycleTestSession(t, adapter, conn)
	adapter.applyLocalGoal(adapterSession, map[string]any{"objective": "ship it", "status": "active"})

	for _, action := range []GoalControlAction{GoalControlPause, GoalControlResume} {
		if _, _, err := adapter.GoalControl(context.Background(), session, action, ""); err == nil {
			t.Fatalf("GoalControl %s must be unsupported for claude", action)
		}
	}
	if sent := conn.sentRequests(); len(sent) != 0 {
		t.Fatalf("unsupported goal actions must not reach the sidecar: %#v", sent)
	}
	if goal := adapter.localGoal(adapterSession); goal["status"] != "active" {
		t.Fatalf("goal mirror mutated by rejected action: %#v", goal)
	}
}

// ExecGoalControl ignores non-goal prompts and forwards /goal through the
// sidecar's native prompt queue while another turn holds the turn slot.
func TestClaudeSDKExecGoalControl(t *testing.T) {
	t.Parallel()

	adapter := NewClaudeCodeSDKAdapter(nil)
	conn := newBlockingClaudeSDKConnection()
	defer conn.Close()
	session, adapterSession := newClaudeSDKLifecycleTestSession(t, adapter, conn)
	adapter.applyLocalGoal(adapterSession, map[string]any{"objective": "ship it", "status": "active"})
	adapter.registerClaudeSDKTurn(adapterSession, "turn-live", nil)

	if _, handled, err := adapter.ExecGoalControl(context.Background(), session, textPrompt("plain steer"), "", "turn-steer"); handled || err != nil {
		t.Fatalf("non-goal prompt handled=%v err=%v", handled, err)
	}

	type goalExecResult struct {
		events  []activityshared.Event
		handled bool
		err     error
	}
	results := make(chan goalExecResult, 1)
	go func() {
		events, handled, err := adapter.ExecGoalControl(context.Background(), session, textPrompt("/goal clear"), "", "turn-goal")
		results <- goalExecResult{events, handled, err}
	}()
	clearRequest := waitForClaudeSDKSentRequestMatching(t, conn, "exec", "/goal clear")
	conn.pushEvent(claudeSDKSidecarEvent{ID: clearRequest.ID, Type: "ok"})
	result := <-results
	events, handled, err := result.events, result.handled, result.err
	if err != nil || !handled {
		t.Fatalf("ExecGoalControl handled=%v err=%v", handled, err)
	}
	var sawSteeredMessage bool
	for _, event := range events {
		if event.Payload.Role == activityshared.MessageRoleUser && event.Payload.Metadata["goalControl"] == true {
			sawSteeredMessage = true
		}
	}
	if !sawSteeredMessage {
		t.Fatalf("no goal-control user message in %#v", events)
	}
	assertClaudeSDKGoalUpdateEvent(t, events, "thread_goal_cleared")
	if goal := adapter.localGoal(adapterSession); len(goal) != 0 {
		t.Fatalf("goal after ExecGoalControl clear = %#v", goal)
	}
	// The running turn must survive: the goal command runs as its own queued
	// turn, it does not touch the live waiter.
	if adapter.claudeSDKTurnWaiter(adapterSession, "turn-live") == nil {
		t.Fatal("live turn waiter removed by goal control")
	}
}

func assertClaudeSDKGoalUpdateEvent(t *testing.T, events []activityshared.Event, updateType string) {
	t.Helper()
	for _, event := range events {
		if event.Payload.Metadata == nil {
			continue
		}
		if event.Payload.Metadata["acpSessionUpdate"] == updateType {
			return
		}
	}
	t.Fatalf("no %s event in %#v", updateType, events)
}

func waitForClaudeSDKSentRequestMatching(t *testing.T, conn *blockingClaudeSDKConnection, requestType string, prompt string) claudeSDKSidecarRequest {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		for _, request := range conn.sentRequests() {
			if request.Type == requestType && strings.TrimSpace(payloadString(request.Payload, "prompt")) == prompt {
				return request
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s %q; sent=%#v", requestType, prompt, conn.sentRequests())
	return claudeSDKSidecarRequest{}
}
