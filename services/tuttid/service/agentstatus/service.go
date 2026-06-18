package agentstatus

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	externalagentregistry "github.com/tutti-os/tutti/services/tuttid/service/externalagentregistry"
	managedruntime "github.com/tutti-os/tutti/services/tuttid/service/managedruntime"
)

type AvailabilityStatus string

const (
	AvailabilityReady        AvailabilityStatus = "ready"
	AvailabilityNotInstalled AvailabilityStatus = "not_installed"
	AvailabilityAuthRequired AvailabilityStatus = "auth_required"
	AvailabilityUnsupported  AvailabilityStatus = "unsupported"
	AvailabilityUnknown      AvailabilityStatus = "unknown"
)

type AuthStatus string

const (
	AuthAuthenticated AuthStatus = "authenticated"
	AuthRequired      AuthStatus = "required"
	AuthUnknown       AuthStatus = "unknown"
)

type ActionKind string

const (
	ActionKindDaemonAction    ActionKind = "daemon_action"
	ActionKindTerminalCommand ActionKind = "terminal_command"
	ActionKindRefresh         ActionKind = "refresh"
)

type ActionID string

const (
	ActionInstall ActionID = "install"
	ActionLogin   ActionID = "login"
	ActionRefresh ActionID = "refresh"
)

type ProbeStatus string

const (
	ProbeReady   ProbeStatus = "ready"
	ProbeFailed  ProbeStatus = "failed"
	ProbeSkipped ProbeStatus = "skipped"
)

type RunActionStatus string

const (
	RunActionCompleted RunActionStatus = "completed"
	RunActionFailed    RunActionStatus = "failed"
)

type ListInput struct {
	Providers []string
}

type ProbeInput struct {
	Provider string
}

type RunActionInput struct {
	Provider string
	ActionID ActionID
}

type Snapshot struct {
	CapturedAt time.Time
	Providers  []ProviderStatus
}

type ProbeResult struct {
	Provider   string
	Status     ProbeStatus
	CheckedAt  time.Time
	ReasonCode string
	Message    string
	BinaryPath string
	Command    []string
}

type RunActionResult struct {
	Provider    string
	ActionID    ActionID
	Status      RunActionStatus
	CompletedAt time.Time
	ReasonCode  string
	Message     string
	Command     string
	ExitCode    *int
	Stdout      string
	Stderr      string
	Probe       *ProbeResult
}

type ProviderStatus struct {
	Provider     string
	Availability Availability
	CLI          CLIStatus
	Adapter      AdapterStatus
	Auth         AuthInfo
	Actions      []Action
}

type Availability struct {
	Status     AvailabilityStatus
	ReasonCode string
	CheckedAt  *time.Time
}

type CLIStatus struct {
	Installed  bool
	BinaryPath string
	Version    string
}

type AdapterStatus struct {
	Installed  bool
	BinaryPath string
	Command    []string
}

type AuthInfo struct {
	Status       AuthStatus
	AccountLabel string
}

type Action struct {
	ID      ActionID
	Kind    ActionKind
	Command *TerminalCommand
}

type TerminalCommand struct {
	Input string
	CWD   string
}

type InstallCommandInput struct {
	Command string
	CWD     string
	Env     []string
}

type InstallCommandResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

type Service struct {
	Environ                     func() []string
	FileExists                  func(string) bool
	HomeDir                     func() (string, error)
	HTTPClient                  *http.Client
	LookPath                    func(string) (string, error)
	InstallCommand              func(context.Context, InstallCommandInput) (InstallCommandResult, error)
	InstallTimeout              time.Duration
	RunAuthStatusCommand        func(context.Context, ProviderSpec, string) (AuthInfo, bool)
	AuthStatusCommandRetryDelay time.Duration
	IsExecutableFile            func(string) bool
	Now                         func() time.Time
	ProbeReadyAfter             time.Duration
	ProbeTimeout                time.Duration
	Registry                    Registry
	ExternalAgentRegistry       externalagentregistry.Store
	ManagedRuntime              managedruntime.Resolver
}

const authStatusCommandTimeout = 3 * time.Second
const authStatusCommandAttempts = 2
const defaultAuthStatusCommandRetryDelay = 150 * time.Millisecond
const defaultInstallTimeout = 5 * time.Minute
const defaultProbeReadyAfter = 600 * time.Millisecond
const defaultProbeTimeout = 3 * time.Second
const defaultProbeWaitDelay = 500 * time.Millisecond

func (s Service) List(ctx context.Context, input ListInput) (Snapshot, error) {
	now := s.now()
	specs, err := s.selectProviderSpecs(ctx, input.Providers, false)
	if err != nil {
		return Snapshot{}, err
	}

	statuses := make([]ProviderStatus, 0, len(specs))
	for _, spec := range specs {
		statuses = append(statuses, s.statusForSpec(ctx, spec, now))
	}

	return Snapshot{
		CapturedAt: now,
		Providers:  statuses,
	}, nil
}

func (s Service) Probe(ctx context.Context, input ProbeInput) (ProbeResult, error) {
	now := s.now()
	specs, err := s.selectProviderSpecs(ctx, []string{input.Provider}, true)
	if err != nil {
		return ProbeResult{}, err
	}
	spec := specs[0]
	if result, ok := unsupportedProviderProbeResult(spec, now); ok {
		return result, nil
	}
	runtimeResolution := s.resolveProviderRuntime(ctx, spec)
	status := s.statusForSpec(ctx, spec, now)
	result := ProbeResult{
		Provider:   spec.Provider,
		CheckedAt:  now,
		BinaryPath: status.Adapter.BinaryPath,
		Command:    cloneStrings(spec.AdapterCommand),
	}
	if !status.CLI.Installed {
		result.Status = ProbeFailed
		result.ReasonCode = "cli_not_found"
		result.Message = "CLI binary not found"
		return result, nil
	}
	if !status.Adapter.Installed {
		result.Status = ProbeFailed
		result.ReasonCode = firstNonBlank(status.Availability.ReasonCode, "acp_adapter_not_found")
		result.Message = agentProviderProbeAdapterUnavailableMessage(result.ReasonCode)
		return result, nil
	}

	command := cloneStrings(spec.AdapterCommand)
	if len(command) == 0 {
		command = cloneStrings(spec.BinaryNames)
	}
	if len(command) == 0 || strings.TrimSpace(command[0]) == "" {
		result.Status = ProbeSkipped
		result.ReasonCode = "probe_command_unavailable"
		result.Message = "Provider probe command is unavailable"
		return result, nil
	}

	env := s.commandResolver().Env(spec.AdapterEnv)
	command[0] = s.commandResolver().Resolve(command[0], env)
	result.Command = cloneStrings(command)
	if strings.TrimSpace(runtimeResolution.AdapterPath) != "" {
		result.BinaryPath = runtimeResolution.AdapterPath
	} else {
		result.BinaryPath = command[0]
	}
	return s.probeCommand(ctx, result, command, env), nil
}

func (s Service) RunAction(ctx context.Context, input RunActionInput) (RunActionResult, error) {
	now := s.now()
	specs, err := s.selectProviderSpecs(ctx, []string{input.Provider}, false)
	if err != nil {
		return RunActionResult{}, err
	}
	spec := specs[0]
	result := RunActionResult{
		Provider:    spec.Provider,
		ActionID:    input.ActionID,
		CompletedAt: now,
	}

	switch input.ActionID {
	case ActionInstall:
		return s.runInstallAction(ctx, spec, result)
	default:
		return RunActionResult{}, ErrInvalidAction
	}
}

func (s Service) runInstallAction(ctx context.Context, spec ProviderSpec, result RunActionResult) (RunActionResult, error) {
	if result, ok := unsupportedProviderRunActionResult(spec, result); ok {
		return result, nil
	}
	runtimeResolution := s.resolveProviderRuntime(ctx, spec)
	summary, updatedRuntime, err := s.installMissingProviderRuntime(baseContext(ctx), spec, runtimeResolution)
	result.Command = strings.Join(summary.Commands, " && ")
	result.Stdout = trimActionOutput(strings.Join(summary.Stdout, "\n"))
	result.Stderr = trimActionOutput(strings.Join(summary.Stderr, "\n"))
	result.ExitCode = summary.ExitCode
	if err != nil {
		result.Status = RunActionFailed
		if errors.Is(err, context.DeadlineExceeded) {
			result.ReasonCode = "install_timed_out"
			result.Message = "Install command timed out after " + s.installTimeout().String()
			return result, nil
		}
		if errors.Is(err, context.Canceled) {
			result.ReasonCode = "install_canceled"
			result.Message = err.Error()
			return result, nil
		}
		result.ReasonCode = "install_start_failed"
		result.Message = err.Error()
		return result, nil
	}
	if len(summary.Commands) == 0 {
		probe, err := s.Probe(ctx, ProbeInput{Provider: spec.Provider})
		if err != nil {
			return RunActionResult{}, err
		}
		result.Probe = &probe
		if probe.Status == ProbeFailed {
			result.Status = RunActionFailed
			result.ReasonCode = "post_install_probe_failed"
			result.Message = firstNonBlank(probe.Message, probe.ReasonCode, "Agent provider runtime probe failed")
			return result, nil
		}
		result.Status = RunActionCompleted
		return result, nil
	}
	if summary.ExitCode != nil && *summary.ExitCode != 0 {
		result.Status = RunActionFailed
		result.ReasonCode = "install_command_failed"
		result.Message = firstNonBlank(result.Stderr, result.Stdout, "Install command failed")
		return result, nil
	}

	probe, err := s.Probe(ctx, ProbeInput{Provider: spec.Provider})
	if err != nil {
		return RunActionResult{}, err
	}
	result.Probe = &probe
	if probe.Status == ProbeFailed {
		result.Status = RunActionFailed
		result.ReasonCode = "post_install_probe_failed"
		result.Message = firstNonBlank(probe.Message, probe.ReasonCode, "Agent provider runtime probe failed")
		return result, nil
	}
	if strings.TrimSpace(updatedRuntime.AdapterPath) != "" {
		result.Probe.BinaryPath = updatedRuntime.AdapterPath
	}
	result.Status = RunActionCompleted
	return result, nil
}

func (s Service) statusForSpec(ctx context.Context, spec ProviderSpec, now time.Time) ProviderStatus {
	if status, ok := unsupportedProviderStatus(spec, now); ok {
		return status
	}
	runtimeResolution := s.resolveProviderRuntime(ctx, spec)
	installed := strings.TrimSpace(runtimeResolution.CLIPath) != ""
	adapterInstalled := strings.TrimSpace(runtimeResolution.AdapterPath) != ""
	adapterReady := adapterInstalled && adapterPackageRequirementSatisfied(spec.AdapterPackage, runtimeResolution.AdapterVersion)
	auth := s.resolveAuth(ctx, spec, installed, runtimeResolution.CLIPath)
	availability := Availability{
		CheckedAt: &now,
		Status:    AvailabilityReady,
	}
	actions := []Action{}

	if !installed {
		availability.Status = AvailabilityNotInstalled
		availability.ReasonCode = "cli_not_found"
		actions = append(actions, daemonAction(ActionInstall))
	} else if !adapterInstalled {
		availability.Status = AvailabilityNotInstalled
		availability.ReasonCode = firstNonBlank(runtimeResolution.ReasonCode, spec.AdapterUnavailableReasonCode, "acp_adapter_not_found")
		actions = append(actions, daemonAction(ActionInstall))
	} else if !adapterReady {
		availability.Status = AvailabilityNotInstalled
		availability.ReasonCode = "acp_adapter_version_mismatch"
		actions = append(actions, daemonAction(ActionInstall))
	} else {
		actions = append(actions, terminalAction(ActionLogin, loginCommandForRuntime(spec, runtimeResolution)))
		switch auth.Status {
		case AuthRequired:
			availability.Status = AvailabilityAuthRequired
			availability.ReasonCode = "auth_required"
			actions = append(actions, Action{ID: ActionRefresh, Kind: ActionKindRefresh})
		case AuthUnknown:
			availability.Status = AvailabilityAuthRequired
			availability.ReasonCode = "auth_unknown"
			actions = append(actions, Action{ID: ActionRefresh, Kind: ActionKindRefresh})
		}
	}

	return ProviderStatus{
		Provider:     spec.Provider,
		Availability: availability,
		CLI: CLIStatus{
			Installed:  installed,
			BinaryPath: runtimeResolution.CLIPath,
		},
		Adapter: AdapterStatus{
			Installed:  adapterReady,
			BinaryPath: runtimeResolution.AdapterPath,
			Command:    cloneStrings(runtimeResolution.AdapterCommand),
		},
		Auth:    auth,
		Actions: actions,
	}
}

func agentProviderProbeAdapterUnavailableMessage(reasonCode string) string {
	switch strings.TrimSpace(reasonCode) {
	case "acp_adapter_version_mismatch":
		return "ACP adapter version does not match the required package version"
	case ReasonExternalAgentRegistryUnavailable:
		return "ACP external agent registry is unavailable"
	case ReasonManagedRuntimeUnavailable:
		return "Managed Node runtime is unavailable"
	default:
		return "ACP adapter not found"
	}
}
