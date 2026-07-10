package providerregistry

// RuntimeKind identifies the adapter family used to execute a provider. The
// runtime package maps each kind to an adapter constructor; provider identity
// must not be used as the constructor switch.
type RuntimeKind string

const (
	RuntimeKindCodexAppServer RuntimeKind = "codex_app_server"
)

// InstallerKind is a transport-neutral installer identifier. tuttid converts
// it to the concrete installer service contract at its composition boundary.
type InstallerKind string

const (
	InstallerKindCodexCLILatest InstallerKind = "codex_cli_latest"
)

type StatusKind string

const (
	StatusKindCodexCLI StatusKind = "codex_cli"
)

type IdentityDescriptor struct {
	ID          string
	DisplayName string
	IconKey     string
	LocaleKey   string
	Aliases     []string
}

type RuntimeDescriptor struct {
	Kind    RuntimeKind
	Command []string
}

type InstallerDescriptor struct {
	Kind           InstallerKind
	DisplayCommand string
}

type StatusDescriptor struct {
	Kind                StatusKind
	BinaryNames         []string
	AdapterBinaryNames  []string
	AuthStatusCommand   []string
	AuthMarkerPaths     []string
	APIEndpoints        []string
	CustomConfigEnvVars []string
	CredentialEnvVars   []string
	NPMRegistryPackage  string
	Install             InstallerDescriptor
	LoginArgs           []string
}

type PermissionModeDescriptor struct {
	ID       string
	Semantic string
}

type ComposerConfigOptionIDs struct {
	Model      string
	Reasoning  string
	Speed      string
	Permission string
}

type SkillDescriptor struct {
	Kind       string
	Invocation string
}

type ComposerProfileDescriptor struct {
	ModelSelection          bool
	ModelCatalog            string
	ReasoningEffort         bool
	ReasoningEffortValues   []string
	DefaultReasoningEffort  string
	Speed                   bool
	Capabilities            []string
	PermissionConfigurable  bool
	DefaultPermissionModeID string
	PermissionModes         []PermissionModeDescriptor
	ConfigOptionIDs         ComposerConfigOptionIDs
	Skills                  SkillDescriptor
}

type TargetDescriptor struct {
	ID            string
	LaunchRefType string
	Enabled       bool
	SortOrder     int
}

type EventsDescriptor struct {
	Enabled bool
	Aliases []string
}

// ProviderDescriptor is the single registration contract for a migrated
// provider. Each layer consumes its own section and must not re-declare the
// provider-specific values locally.
type ProviderDescriptor struct {
	Identity        IdentityDescriptor
	Runtime         RuntimeDescriptor
	Status          StatusDescriptor
	ComposerProfile ComposerProfileDescriptor
	Target          TargetDescriptor
	Events          EventsDescriptor
}
