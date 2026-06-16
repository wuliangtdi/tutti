package agentstatus

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/tutti-os/tutti/packages/agentactivity/daemon/runtimecmd"
	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
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
	registry := s.registry()
	specs, err := registry.Select(input.Providers)
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
	specs, err := s.registry().Select([]string{input.Provider})
	if err != nil {
		return ProbeResult{}, err
	}
	spec := specs[0]
	if result, ok := unsupportedProviderProbeResult(spec, now); ok {
		return result, nil
	}
	runtimeResolution := s.resolveProviderRuntime(spec)
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
		result.ReasonCode = "acp_adapter_not_found"
		result.Message = "ACP adapter not found"
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

	env := s.commandResolver().Env(nil)
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
	specs, err := s.registry().Select([]string{input.Provider})
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
	runtimeResolution := s.resolveProviderRuntime(spec)
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
	runtimeResolution := s.resolveProviderRuntime(spec)
	installed := strings.TrimSpace(runtimeResolution.CLIPath) != ""
	adapterInstalled := strings.TrimSpace(runtimeResolution.AdapterPath) != ""
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
		availability.ReasonCode = "acp_adapter_not_found"
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
			Installed:  adapterInstalled,
			BinaryPath: runtimeResolution.AdapterPath,
			Command:    cloneStrings(spec.AdapterCommand),
		},
		Auth:    auth,
		Actions: actions,
	}
}

func (s Service) probeCommand(ctx context.Context, result ProbeResult, command []string, env []string) ProbeResult {
	if ctx == nil {
		ctx = context.Background()
	}
	timeout := s.ProbeTimeout
	if timeout <= 0 {
		timeout = defaultProbeTimeout
	}
	readyAfter := s.ProbeReadyAfter
	if readyAfter <= 0 {
		readyAfter = defaultProbeReadyAfter
	}
	probeCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd := exec.CommandContext(probeCtx, command[0], command[1:]...)
	cmd.Env = env
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.WaitDelay = defaultProbeWaitDelay
	if err := cmd.Start(); err != nil {
		result.Status = ProbeFailed
		result.ReasonCode = "probe_start_failed"
		result.Message = err.Error()
		return result
	}

	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()

	select {
	case err := <-waitCh:
		return finishProbeWaitResult(result, err, stdout.String(), stderr.String())
	case <-time.After(readyAfter):
		select {
		case err := <-waitCh:
			return finishProbeWaitResult(result, err, stdout.String(), stderr.String())
		default:
		}
		cancel()
		<-waitCh
		result.Status = ProbeReady
		return result
	case <-probeCtx.Done():
		<-waitCh
		if errors.Is(ctx.Err(), context.Canceled) {
			result.Status = ProbeFailed
			result.ReasonCode = "probe_canceled"
			result.Message = ctx.Err().Error()
			return result
		}
		result.Status = ProbeFailed
		result.ReasonCode = "probe_timed_out"
		result.Message = probeCtx.Err().Error()
		return result
	}
}

func finishProbeWaitResult(result ProbeResult, err error, stdout string, stderr string) ProbeResult {
	if err != nil {
		result.Status = ProbeFailed
		result.ReasonCode = "probe_exited"
		result.Message = firstNonBlank(trimProbeOutput(stderr), trimProbeOutput(stdout), err.Error())
		return result
	}
	result.Status = ProbeReady
	return result
}

func (s Service) installCommand(ctx context.Context, input InstallCommandInput) (InstallCommandResult, error) {
	if s.InstallCommand != nil {
		return s.InstallCommand(ctx, input)
	}
	return runDefaultInstallCommand(ctx, input)
}

func (s Service) installTimeout() time.Duration {
	if s.InstallTimeout > 0 {
		return s.InstallTimeout
	}
	return defaultInstallTimeout
}

func runDefaultInstallCommand(ctx context.Context, input InstallCommandInput) (InstallCommandResult, error) {
	ctx = baseContext(ctx)
	command := strings.TrimSpace(input.Command)
	if command == "" {
		return InstallCommandResult{ExitCode: 1}, errors.New("installer command is empty")
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, resolveInstallerShell(), "/C", command)
	} else {
		cmd = exec.CommandContext(ctx, resolveInstallerShell(), "-lc", command)
	}
	cmd.Dir = strings.TrimSpace(input.CWD)
	cmd.Env = input.Env
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	result := InstallCommandResult{
		ExitCode: 0,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
	}
	if err == nil {
		return result, nil
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		result.ExitCode = exitErr.ExitCode()
		return result, nil
	}
	result.ExitCode = 1
	return result, err
}

func baseContext(ctx context.Context) context.Context {
	if ctx != nil {
		return ctx
	}
	return context.Background()
}

func resolveInstallerShell() string {
	if runtime.GOOS == "windows" {
		if shell := strings.TrimSpace(os.Getenv("ComSpec")); shell != "" {
			return shell
		}
		return "cmd.exe"
	}
	if shell := strings.TrimSpace(os.Getenv("SHELL")); shell != "" {
		return shell
	}
	return "/bin/zsh"
}

func (s Service) resolveAuth(ctx context.Context, spec ProviderSpec, installed bool, binaryPath string) AuthInfo {
	if !installed {
		return AuthInfo{Status: AuthUnknown}
	}
	if len(spec.AuthStatusCommand) > 0 && strings.TrimSpace(binaryPath) != "" {
		if auth, ok := s.resolveAuthFromCommand(ctx, spec, binaryPath); ok {
			return auth
		}
		return AuthInfo{Status: AuthUnknown}
	}
	if len(spec.AuthMarkerPaths) == 0 {
		return AuthInfo{Status: AuthUnknown}
	}

	home, err := s.homeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return AuthInfo{Status: AuthUnknown}
	}

	for _, marker := range spec.AuthMarkerPaths {
		path := expandHomePath(marker, home)
		if s.fileExists(path) {
			return AuthInfo{Status: AuthAuthenticated}
		}
	}
	return AuthInfo{Status: AuthRequired}
}

func (s Service) resolveAuthFromCommand(ctx context.Context, spec ProviderSpec, binaryPath string) (AuthInfo, bool) {
	if ctx == nil {
		ctx = context.Background()
	}
	for attempt := 0; attempt < authStatusCommandAttempts; attempt++ {
		if auth, ok := s.runAuthStatusCommand(ctx, spec, binaryPath); ok {
			return auth, true
		}
		if attempt+1 < authStatusCommandAttempts && !sleepContext(ctx, s.authStatusCommandRetryDelay()) {
			return AuthInfo{}, false
		}
	}
	return AuthInfo{}, false
}

func (s Service) runAuthStatusCommand(ctx context.Context, spec ProviderSpec, binaryPath string) (AuthInfo, bool) {
	if s.RunAuthStatusCommand != nil {
		return s.RunAuthStatusCommand(ctx, spec, binaryPath)
	}
	return runAuthStatusCommand(ctx, spec, binaryPath)
}

func (s Service) authStatusCommandRetryDelay() time.Duration {
	if s.AuthStatusCommandRetryDelay > 0 {
		return s.AuthStatusCommandRetryDelay
	}
	return defaultAuthStatusCommandRetryDelay
}

func runAuthStatusCommand(ctx context.Context, spec ProviderSpec, binaryPath string) (AuthInfo, bool) {
	commandCtx, cancel := context.WithTimeout(ctx, authStatusCommandTimeout)
	defer cancel()
	command := exec.CommandContext(commandCtx, binaryPath, spec.AuthStatusCommand...)
	output, err := command.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			output = append(output, exitErr.Stderr...)
		} else {
			return AuthInfo{}, false
		}
	}
	return parseAuthStatusCommandOutput(spec.Provider, output)
}

func sleepContext(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func parseAuthStatusCommandOutput(provider string, output []byte) (AuthInfo, bool) {
	switch agentprovider.Normalize(provider) {
	case agentprovider.ClaudeCode:
		return parseClaudeAuthStatusOutput(output)
	default:
		return AuthInfo{}, false
	}
}

func parseClaudeAuthStatusOutput(output []byte) (AuthInfo, bool) {
	output = bytes.TrimSpace(output)
	if len(output) == 0 {
		return AuthInfo{}, false
	}
	var payload struct {
		AccountLabel string `json:"accountLabel"`
		AuthMethod   string `json:"authMethod"`
		Email        string `json:"email"`
		LoggedIn     *bool  `json:"loggedIn"`
	}
	if err := json.Unmarshal(output, &payload); err == nil && payload.LoggedIn != nil {
		if *payload.LoggedIn {
			return AuthInfo{
				AccountLabel: firstNonBlank(payload.AccountLabel, payload.Email, payload.AuthMethod),
				Status:       AuthAuthenticated,
			}, true
		}
		return AuthInfo{Status: AuthRequired}, true
	}
	normalized := strings.ToLower(string(output))
	if strings.Contains(normalized, `"loggedin":false`) ||
		strings.Contains(normalized, "not logged in") ||
		strings.Contains(normalized, "logged out") {
		return AuthInfo{Status: AuthRequired}, true
	}
	if strings.Contains(normalized, `"loggedin":true`) ||
		strings.Contains(normalized, "logged in") {
		return AuthInfo{Status: AuthAuthenticated}, true
	}
	return AuthInfo{}, false
}

func daemonAction(id ActionID) Action {
	return Action{ID: id, Kind: ActionKindDaemonAction}
}

func terminalAction(id ActionID, command string) Action {
	command = strings.TrimSpace(command)
	if command == "" {
		return Action{ID: id, Kind: ActionKindRefresh}
	}
	return Action{
		ID:   id,
		Kind: ActionKindTerminalCommand,
		Command: &TerminalCommand{
			Input: commandWithNewline(command),
		},
	}
}

func commandWithNewline(command string) string {
	command = strings.TrimRight(command, "\r\n")
	if command == "" {
		return ""
	}
	return command + "\n"
}

func trimProbeOutput(value string) string {
	trimmed := strings.TrimSpace(value)
	return trimmed[:min(len(trimmed), 1000)]
}

func trimActionOutput(value string) string {
	trimmed := strings.TrimSpace(value)
	return trimmed[:min(len(trimmed), 4000)]
}

func intPointer(value int) *int {
	return &value
}

func (s Service) fileExists(path string) bool {
	if s.FileExists != nil {
		return s.FileExists(path)
	}
	stat, err := os.Stat(path)
	return err == nil && !stat.IsDir()
}

func (s Service) homeDir() (string, error) {
	if s.HomeDir != nil {
		return s.HomeDir()
	}
	return os.UserHomeDir()
}

func (s Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

func (s Service) commandResolver() runtimecmd.Resolver {
	return runtimecmd.Resolver{
		Environ:          s.Environ,
		HomeDir:          s.HomeDir,
		IsExecutableFile: s.IsExecutableFile,
		LookPath:         s.LookPath,
	}
}

func (s Service) registry() Registry {
	if len(s.Registry.Specs) > 0 {
		return s.Registry
	}
	return DefaultRegistry()
}

func expandHomePath(path string, home string) string {
	path = strings.TrimSpace(path)
	if path == "~" {
		return home
	}
	if strings.HasPrefix(path, "~/") {
		return filepath.Join(home, strings.TrimPrefix(path, "~/"))
	}
	return path
}

var ErrInvalidProvider = errors.New("invalid agent provider")
var ErrInvalidAction = errors.New("invalid agent provider action")

func cloneStrings(input []string) []string {
	if len(input) == 0 {
		return []string{}
	}
	result := make([]string, len(input))
	copy(result, input)
	return result
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func loginCommandForRuntime(spec ProviderSpec, runtime providerRuntimeResolution) string {
	if len(spec.LoginArgs) == 0 {
		return ""
	}
	command := firstNonBlank(runtime.CLIPath, firstNonBlank(spec.BinaryNames...))
	if strings.TrimSpace(command) == "" {
		return ""
	}
	parts := append([]string{command}, spec.LoginArgs...)
	return joinShellCommand(parts)
}
