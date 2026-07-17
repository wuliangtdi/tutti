// Package conformance provides lifecycle scenarios shared by the legacy
// tuttid Service, the Agent Host implementation, and downstream host adapters.
package conformance

import (
	"context"
	"fmt"

	agenthost "github.com/tutti-os/tutti/packages/agent/host"
	"github.com/tutti-os/tutti/packages/agent/store-sqlite/canonical"
)

type SessionSeed struct {
	WorkspaceID             string
	AgentSessionID          string
	Provider                string
	ProviderSessionID       string
	Cwd                     string
	Title                   string
	ActiveTurnID            string
	InitialTitleEstablished bool
	Live                    bool
}

type TurnSeed struct {
	TurnID  string
	Phase   string
	Outcome string
}

type InteractionSeed struct {
	RequestID string
	TurnID    string
	Kind      string
	Status    string
}

type Fixture struct {
	Session     *SessionSeed
	Turn        *TurnSeed
	Interaction *InteractionSeed
}

type SessionObservation struct {
	SessionID         string
	ProviderSessionID string
	Title             string
	ActiveTurnID      string
	Resumable         bool
}

type SendObservation struct {
	Session SessionObservation
	TurnID  string
}

type CancelObservation struct {
	Session  SessionObservation
	TurnID   string
	Canceled bool
	Reason   string
}

type OperationObservation struct {
	OperationID string
	Status      string
	Result      string
}

type Metrics struct {
	StartCalls               int
	ResumeCalls              int
	ExecCalls                int
	CancelCalls              int
	InteractiveCalls         int
	UpdateSettingsCalls      int
	LastCancelTargets        []agenthost.RuntimeCancelTarget
	LastInteractiveTurnID    string
	LastInteractiveRequestID string
	LastInitialTitle         string
}

// Driver adapts one host implementation to the shared lifecycle scenarios.
// Reset is test-only canonical/runtime seeding; command methods mirror the
// provider-neutral Host application surface rather than any transport API.
type Driver interface {
	Reset(context.Context, Fixture) error
	Create(context.Context, string, agenthost.CreateSessionInput) (SessionObservation, string, error)
	EnsureSession(context.Context, agenthost.SessionRef) (SessionObservation, error)
	SendInput(context.Context, agenthost.SessionRef, agenthost.SendInput) (SendObservation, error)
	CancelTurn(context.Context, agenthost.CancelTurnInput) (CancelObservation, error)
	SubmitInteractive(context.Context, agenthost.SessionRef, string, agenthost.SubmitInteractiveInput) (SessionObservation, error)
	SubmitPlanDecision(context.Context, agenthost.SessionRef, string, string, agenthost.SubmitPlanDecisionInput) (OperationObservation, error)
	UpdateTitle(context.Context, agenthost.UpdateTitleInput) (SessionObservation, error)
	Metrics() Metrics
}

type Scenario struct {
	Name string
	run  func(context.Context, Driver) error
}

func Scenarios() []Scenario {
	return []Scenario{
		{Name: "create empty session", run: runCreateEmptySession},
		{Name: "create with initial content", run: runCreateWithInitialContent},
		{Name: "resume persisted session", run: runResumePersistedSession},
		{Name: "send input", run: runSendInput},
		{Name: "duplicate client submit id", run: runDuplicateClientSubmitID},
		{Name: "exact turn cancel", run: runExactTurnCancel},
		{Name: "interactive response", run: runInteractiveResponse},
		{Name: "plan decision", run: runPlanDecision},
		{Name: "initial title cas", run: runInitialTitleCAS},
	}
}

func Run(ctx context.Context, driver Driver, scenario Scenario) error {
	if driver == nil {
		return fmt.Errorf("agent host conformance driver is required")
	}
	if scenario.run == nil {
		return fmt.Errorf("agent host conformance scenario %q has no runner", scenario.Name)
	}
	return scenario.run(ctx, driver)
}

func runCreateEmptySession(ctx context.Context, driver Driver) error {
	if err := driver.Reset(ctx, Fixture{}); err != nil {
		return err
	}
	session, turnID, err := driver.Create(ctx, "workspace-1", agenthost.CreateSessionInput{
		AgentSessionID: "session-empty", AgentTargetID: "target-1", Provider: "codex",
	})
	if err != nil {
		return fmt.Errorf("create empty session: %w", err)
	}
	if session.SessionID != "session-empty" || turnID != "" {
		return fmt.Errorf("create empty session = %#v turn %q", session, turnID)
	}
	metrics := driver.Metrics()
	if metrics.StartCalls != 1 || metrics.ExecCalls != 0 {
		return fmt.Errorf("create empty calls start=%d exec=%d", metrics.StartCalls, metrics.ExecCalls)
	}
	return nil
}

func runCreateWithInitialContent(ctx context.Context, driver Driver) error {
	if err := driver.Reset(ctx, Fixture{}); err != nil {
		return err
	}
	session, turnID, err := driver.Create(ctx, "workspace-1", agenthost.CreateSessionInput{
		AgentSessionID: "session-initial", AgentTargetID: "target-1", Provider: "codex",
		InitialContent: []agenthost.PromptContentBlock{{Type: "text", Text: "build the feature"}},
		Metadata:       map[string]any{"clientSubmitId": "create-submit-1"},
	})
	if err != nil {
		return fmt.Errorf("create with initial content: %w", err)
	}
	if session.SessionID != "session-initial" || turnID == "" {
		return fmt.Errorf("create with initial content = %#v turn %q", session, turnID)
	}
	metrics := driver.Metrics()
	if metrics.StartCalls != 1 || metrics.ExecCalls != 1 {
		return fmt.Errorf("create with initial content calls start=%d exec=%d", metrics.StartCalls, metrics.ExecCalls)
	}
	return nil
}

func runResumePersistedSession(ctx context.Context, driver Driver) error {
	fixture := Fixture{Session: &SessionSeed{
		WorkspaceID: "workspace-1", AgentSessionID: "session-resume", Provider: "codex",
		ProviderSessionID: "provider-session-1", Cwd: "/workspace", Title: "Persisted", InitialTitleEstablished: true,
	}}
	if err := driver.Reset(ctx, fixture); err != nil {
		return err
	}
	session, err := driver.EnsureSession(ctx, agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-resume"})
	if err != nil {
		return fmt.Errorf("resume persisted session: %w", err)
	}
	if session.SessionID != "session-resume" || session.ProviderSessionID != "provider-session-1" || !session.Resumable {
		return fmt.Errorf("resumed session = %#v", session)
	}
	if metrics := driver.Metrics(); metrics.ResumeCalls != 1 || metrics.StartCalls != 0 {
		return fmt.Errorf("resume calls resume=%d start=%d", metrics.ResumeCalls, metrics.StartCalls)
	}
	return nil
}

func runSendInput(ctx context.Context, driver Driver) error {
	if err := driver.Reset(ctx, liveSessionFixture("session-send", "")); err != nil {
		return err
	}
	result, err := driver.SendInput(ctx, agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-send"}, agenthost.SendInput{
		Content: []agenthost.PromptContentBlock{{Type: "text", Text: "continue"}},
	})
	if err != nil {
		return fmt.Errorf("send input: %w", err)
	}
	if result.Session.SessionID != "session-send" || result.TurnID == "" {
		return fmt.Errorf("send input result = %#v", result)
	}
	if metrics := driver.Metrics(); metrics.ExecCalls != 1 {
		return fmt.Errorf("send input exec calls=%d", metrics.ExecCalls)
	}
	return nil
}

func runDuplicateClientSubmitID(ctx context.Context, driver Driver) error {
	if err := driver.Reset(ctx, liveSessionFixture("session-duplicate", "")); err != nil {
		return err
	}
	ref := agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-duplicate"}
	input := agenthost.SendInput{
		Content:  []agenthost.PromptContentBlock{{Type: "text", Text: "only once"}},
		Metadata: map[string]any{"clientSubmitId": "submit-duplicate-1"},
	}
	first, err := driver.SendInput(ctx, ref, input)
	if err != nil {
		return fmt.Errorf("first idempotent send: %w", err)
	}
	duplicate, err := driver.SendInput(ctx, ref, input)
	if err != nil {
		return fmt.Errorf("duplicate idempotent send: %w", err)
	}
	if first.TurnID == "" || duplicate.TurnID != first.TurnID {
		return fmt.Errorf("duplicate turns first=%q duplicate=%q", first.TurnID, duplicate.TurnID)
	}
	if metrics := driver.Metrics(); metrics.ExecCalls != 1 {
		return fmt.Errorf("duplicate submit exec calls=%d", metrics.ExecCalls)
	}
	return nil
}

func runExactTurnCancel(ctx context.Context, driver Driver) error {
	fixture := liveSessionFixture("session-cancel", "turn-cancel")
	fixture.Turn = &TurnSeed{TurnID: "turn-cancel", Phase: canonical.TurnPhaseRunning}
	if err := driver.Reset(ctx, fixture); err != nil {
		return err
	}
	result, err := driver.CancelTurn(ctx, agenthost.CancelTurnInput{
		WorkspaceID: "workspace-1", AgentSessionID: "session-cancel", TurnID: "turn-cancel", Reason: "user_requested",
	})
	if err != nil {
		return fmt.Errorf("exact turn cancel: %w", err)
	}
	metrics := driver.Metrics()
	if !result.Canceled || result.TurnID != "turn-cancel" || metrics.CancelCalls != 1 || len(metrics.LastCancelTargets) != 1 ||
		metrics.LastCancelTargets[0].AgentSessionID != "session-cancel" || metrics.LastCancelTargets[0].TurnID != "turn-cancel" {
		return fmt.Errorf("cancel result=%#v metrics=%#v", result, metrics)
	}
	return nil
}

func runInteractiveResponse(ctx context.Context, driver Driver) error {
	fixture := liveSessionFixture("session-interactive", "turn-interactive")
	fixture.Turn = &TurnSeed{TurnID: "turn-interactive", Phase: canonical.TurnPhaseWaiting}
	fixture.Interaction = &InteractionSeed{
		RequestID: "request-1", TurnID: "turn-interactive", Kind: canonical.InteractionKindApproval, Status: canonical.InteractionStatusPending,
	}
	if err := driver.Reset(ctx, fixture); err != nil {
		return err
	}
	optionID := "approve"
	if _, err := driver.SubmitInteractive(ctx,
		agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-interactive"},
		"request-1", agenthost.SubmitInteractiveInput{TurnID: "turn-interactive", OptionID: &optionID},
	); err != nil {
		return fmt.Errorf("submit interactive: %w", err)
	}
	metrics := driver.Metrics()
	if metrics.InteractiveCalls != 1 || metrics.LastInteractiveTurnID != "turn-interactive" || metrics.LastInteractiveRequestID != "request-1" {
		return fmt.Errorf("interactive metrics=%#v", metrics)
	}
	return nil
}

func runPlanDecision(ctx context.Context, driver Driver) error {
	fixture := liveSessionFixture("session-plan", "plan-turn")
	fixture.Turn = &TurnSeed{TurnID: "plan-turn", Phase: canonical.TurnPhaseWaiting}
	fixture.Interaction = &InteractionSeed{
		RequestID: "plan-turn", TurnID: "plan-turn", Kind: canonical.InteractionKindPlan, Status: canonical.InteractionStatusPending,
	}
	if err := driver.Reset(ctx, fixture); err != nil {
		return err
	}
	operation, err := driver.SubmitPlanDecision(ctx,
		agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-plan"},
		"plan-turn", "plan-turn", agenthost.SubmitPlanDecisionInput{
			PromptKind: "plan-implementation", Action: "implement", IdempotencyKey: "decision-1",
		},
	)
	if err != nil {
		return fmt.Errorf("submit plan decision: %w", err)
	}
	metrics := driver.Metrics()
	if operation.OperationID == "" || metrics.UpdateSettingsCalls != 1 || metrics.ExecCalls != 1 {
		return fmt.Errorf("plan operation=%#v metrics=%#v", operation, metrics)
	}
	return nil
}

func runInitialTitleCAS(ctx context.Context, driver Driver) error {
	if err := driver.Reset(ctx, Fixture{}); err != nil {
		return err
	}
	session, _, err := driver.Create(ctx, "workspace-1", agenthost.CreateSessionInput{
		AgentSessionID: "session-title", AgentTargetID: "target-1", Provider: "codex",
		InitialContent: []agenthost.PromptContentBlock{{Type: "text", Text: "Derived title"}},
	})
	if err != nil {
		return fmt.Errorf("create title session: %w", err)
	}
	if session.Title != "Derived title" {
		return fmt.Errorf("derived title=%q", session.Title)
	}
	session, err = driver.UpdateTitle(ctx, agenthost.UpdateTitleInput{
		WorkspaceID: "workspace-1", AgentSessionID: "session-title", Title: "Explicit title",
	})
	if err != nil {
		return fmt.Errorf("update explicit title: %w", err)
	}
	if session.Title != "Explicit title" {
		return fmt.Errorf("updated title=%q", session.Title)
	}
	result, err := driver.SendInput(ctx,
		agenthost.SessionRef{WorkspaceID: "workspace-1", AgentSessionID: "session-title"},
		agenthost.SendInput{Content: []agenthost.PromptContentBlock{{Type: "text", Text: "Must not replace title"}}},
	)
	if err != nil {
		return fmt.Errorf("send after explicit title: %w", err)
	}
	if result.Session.Title != "Explicit title" || driver.Metrics().LastInitialTitle != "" {
		return fmt.Errorf("title CAS result=%#v metrics=%#v", result, driver.Metrics())
	}
	return nil
}

func liveSessionFixture(sessionID, activeTurnID string) Fixture {
	return Fixture{Session: &SessionSeed{
		WorkspaceID: "workspace-1", AgentSessionID: sessionID, Provider: "codex",
		ProviderSessionID: "provider-" + sessionID, Cwd: "/workspace", Title: "Session title",
		ActiveTurnID: activeTurnID, InitialTitleEstablished: true, Live: true,
	}}
}
