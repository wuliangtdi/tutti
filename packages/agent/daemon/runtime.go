package agentdaemon

import (
	"errors"
	"strings"

	agentruntime "github.com/tutti-os/tutti/packages/agentactivity/daemon/runtime"
)

var ErrHostMetadataRequired = errors.New("agent daemon host metadata is required")
var ErrProcessTransportRequired = errors.New("agent daemon process transport is required")

type ActivityReporter = agentruntime.ActivityReporter
type Adapter = agentruntime.Adapter
type ClientInfo = agentruntime.ClientInfo
type Controller = agentruntime.Controller
type HostMetadata = agentruntime.HostMetadata
type ProcessTransport = agentruntime.ProcessTransport
type ProviderCommand = agentruntime.ProviderCommand
type ProviderCommandResolver = agentruntime.ProviderCommandResolver

type Config struct {
	Reporter                ActivityReporter
	ProcessTransport        ProcessTransport
	HostMetadata            HostMetadata
	ProviderCommandResolver ProviderCommandResolver
	Adapters                []Adapter
}

type Runtime struct {
	controller *Controller
}

func NewRuntime(config Config) (*Runtime, error) {
	var controller *Controller
	if len(config.Adapters) > 0 {
		controller = agentruntime.NewController(config.Adapters, config.Reporter)
	} else {
		if !hasCompleteHostMetadata(config.HostMetadata) {
			return nil, ErrHostMetadataRequired
		}
		if config.ProcessTransport == nil {
			return nil, ErrProcessTransportRequired
		}
		controller = agentruntime.NewDefaultControllerWithOptions(
			config.Reporter,
			config.ProcessTransport,
			agentruntime.ControllerOptions{
				HostMetadata:            config.HostMetadata,
				ProviderCommandResolver: config.ProviderCommandResolver,
			},
		)
	}
	return &Runtime{controller: controller}, nil
}

func NewLocalProcessTransport() ProcessTransport {
	return agentruntime.NewLocalProcessTransport()
}

func MustRuntime(config Config) *Runtime {
	runtime, err := NewRuntime(config)
	if err != nil {
		panic(err)
	}
	return runtime
}

func (r *Runtime) Controller() *Controller {
	if r == nil {
		return nil
	}
	return r.controller
}

func hasCompleteHostMetadata(host HostMetadata) bool {
	return strings.TrimSpace(host.ClientInfo.Name) != "" &&
		strings.TrimSpace(host.ClientInfo.Title) != "" &&
		strings.TrimSpace(host.ClientInfo.Version) != "" &&
		strings.TrimSpace(host.WorkspaceEnvName) != "" &&
		strings.TrimSpace(host.OpenClawSessionKeyPrefix) != ""
}
