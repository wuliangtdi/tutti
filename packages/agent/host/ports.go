package agenthost

import (
	"context"
	"time"

	agentactivity "github.com/tutti-os/tutti/packages/agent/daemon/activity"
	storesqlite "github.com/tutti-os/tutti/packages/agent/store-sqlite"
)

type CanonicalSessionStore interface {
	GetSession(context.Context, string, string) (storesqlite.Session, bool, error)
	InitializeRuntimeSession(context.Context, ProviderRuntimeSession) (storesqlite.Session, error)
	UpdateSessionTitle(context.Context, string, string, string) (storesqlite.Session, bool, error)
}

type CanonicalTurnStore interface {
	GetTurn(context.Context, string, string, string) (storesqlite.Turn, bool, error)
	FindTurnByClientSubmitID(context.Context, string, string, string) (string, bool, error)
}

type CanonicalSubmitClaimStore interface {
	PrepareSubmitClaim(context.Context, storesqlite.SubmitClaimPrepare) (storesqlite.SubmitClaim, bool, error)
	AcceptSubmitClaim(context.Context, string, string, string, string, int64) (storesqlite.SubmitClaim, bool, error)
	DeleteSubmitClaim(context.Context, string, string, string) (bool, error)
}

// CanonicalStore composes only the lifecycle facets required by the first Host
// extraction slices. Operation and goal facets remain separate until their
// coordinators move in later slices.
type CanonicalStore interface {
	CanonicalSessionStore
	CanonicalTurnStore
	CanonicalSubmitClaimStore
}

// RuntimeController is the provider-neutral live-runtime surface needed by
// create, resume, send, exact cancel, interactive, plan, title, and visibility
// workflows. Process transport and provider implementations stay behind it.
type RuntimeController interface {
	Start(context.Context, RuntimeStartInput) (ProviderRuntimeSession, error)
	Resume(context.Context, RuntimeResumeInput) (ProviderRuntimeSession, error)
	Session(workspaceID string, agentSessionID string) (ProviderRuntimeSession, bool)
	CanResume(RuntimeResumeInput) bool
	Exec(context.Context, RuntimeExecInput) (RuntimeExecResult, error)
	ValidatePromptContent(context.Context, RuntimeExecInput) error
	Cancel(context.Context, RuntimeCancelInput) (RuntimeCancelResult, error)
	SubmitInteractive(context.Context, RuntimeSubmitInteractiveInput) (RuntimeSubmitInteractiveResult, error)
	UpdateSettings(context.Context, RuntimeUpdateSettingsInput) error
	SetTitle(context.Context, RuntimeSetTitleInput) (ProviderRuntimeSession, error)
	SetVisible(context.Context, RuntimeSetVisibleInput) (ProviderRuntimeSession, error)
	Close(context.Context, RuntimeCloseInput) error
}

type RuntimePreparationInput struct {
	WorkspaceID            string
	AgentSessionID         string
	AgentTargetID          string
	Provider               string
	Cwd                    string
	Title                  string
	PermissionModeID       string
	PlanMode               bool
	BrowserUse             bool
	ComputerUse            bool
	ProviderTargetRef      map[string]any
	Model                  string
	ReasoningEffort        string
	ConversationDetailMode string
	Metadata               map[string]any
}

type PreparedRuntime struct {
	Cwd string
	Env []string
}

type RuntimeCleanupInput struct {
	WorkspaceID    string
	AgentSessionID string
	Provider       string
}

type RuntimePreparationPort interface {
	Prepare(context.Context, RuntimePreparationInput) (PreparedRuntime, error)
	Cleanup(context.Context, RuntimeCleanupInput) error
}

type AttachmentMaterializer interface {
	PersistRequestContent(workspaceID string, agentSessionID string, content []PromptContentBlock) ([]PromptContentBlock, error)
	HydrateRuntimeContent(workspaceID string, agentSessionID string, content []PromptContentBlock) ([]PromptContentBlock, error)
}

type Clock interface {
	Now() time.Time
}

type Scheduler interface {
	Sleep(context.Context, time.Duration) error
}

// CommitObserver is a post-commit wake surface. Implementations must not treat
// it as a durable fact carrier; reliable work is read back from canonical
// storage after the wake.
type CommitObserver interface {
	ObserveAgentSessionState(context.Context, agentactivity.ReportSessionStateInput, agentactivity.ReportSessionStateReply)
	ObserveAgentSessionMessages(context.Context, agentactivity.ReportSessionMessagesInput, agentactivity.ReportSessionMessagesReply)
	ObserveRootTurnSettled(context.Context, string, string, storesqlite.Turn)
}
