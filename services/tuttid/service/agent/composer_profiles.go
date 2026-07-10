package agent

import (
	"strings"

	"github.com/tutti-os/tutti/packages/agent/daemon/providerregistry"
	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
)

// composerProfile declares, per provider, which composer dimensions the
// backend supports and their defaults. It is the single source the composer
// option helpers derive from — adding a provider means adding one entry here
// instead of extending half a dozen switch statements.
//
// The zero value is the safe default: no configurable settings, no
// capabilities, no permission modes. A provider absent from
// composerProfiles behaves like an unknown provider.
type composerProfile struct {
	// ModelSelection: the composer exposes a model selector and persists
	// model overrides for this provider. Without it, stale persisted model
	// values are cleared before they reach the runtime.
	ModelSelection bool
	// LiveModelDiscovery: model options come from the model config option a
	// live agent session advertises over ACP; GetComposerOptions merges them
	// into the composer (reusing a running session's list when one exists).
	LiveModelDiscovery bool
	// LiveModelProbeSession: with no running session to reuse, model
	// discovery may spawn a short-lived hidden provider session. Opt-in
	// because the probe is a real session (Claude Code only today).
	LiveModelProbeSession bool
	// UsesModelCatalog: model options come from the daemon-side
	// AgentModelCatalog (CLI/schema-backed lists).
	UsesModelCatalog bool
	// ModelCatalog identifies the descriptor-backed catalog implementation.
	ModelCatalog string
	// ReasoningEffort: the composer exposes a reasoning-effort selector.
	ReasoningEffort bool
	// DefaultReasoningEffort seeds the selector when nothing is persisted.
	DefaultReasoningEffort string
	// ReasoningEffortValues is the closed, ordered value list exposed by the
	// composer for migrated providers.
	ReasoningEffortValues []string
	// Speed: the provider exposes the orthogonal speed tier (standard/fast).
	Speed bool
	// Capabilities is the conservative static capability list used to render
	// the composer before a session exists. Once a session is live the
	// adapter-reported runtimeContext.capabilities takes precedence. Keys
	// mirror packages/agent/daemon/runtime/capabilities.go.
	Capabilities []string
	// PermissionConfigurable: the permission-mode selector is interactive.
	PermissionConfigurable bool
	// DefaultPermissionModeID seeds the permission selector; it must be one
	// of PermissionModes (or empty when the provider has none).
	DefaultPermissionModeID string
	// PermissionModes lists the provider's permission modes in display order.
	PermissionModes []PermissionModeOption
	// Config option ids are provider protocol vocabulary supplied by the
	// descriptor instead of inferred from provider identity.
	ModelConfigOptionID      string
	ReasoningConfigOptionID  string
	SpeedConfigOptionID      string
	PermissionConfigOptionID string
	// SkillKind selects the provider-local discovery implementation while
	// SkillInvocation controls how discovered skills are invoked in the GUI.
	SkillKind       string
	SkillInvocation string
}

var composerFullCapabilities = []string{
	"imageInput", "skills", "compact", "tokenUsage", "rateLimits", "planMode", "interrupt",
}

func defaultComposerProfiles() map[string]composerProfile {
	profiles := map[string]composerProfile{
		agentprovider.ClaudeCode: {
			ModelSelection:          true,
			LiveModelDiscovery:      true,
			LiveModelProbeSession:   true,
			ReasoningEffort:         true,
			DefaultReasoningEffort:  "high",
			Speed:                   true,
			Capabilities:            composerFullCapabilities,
			PermissionConfigurable:  true,
			DefaultPermissionModeID: "default",
			PermissionModes: []PermissionModeOption{
				{ID: "default", Semantic: PermissionModeSemanticAskBeforeWrite},
				{ID: "acceptEdits", Semantic: PermissionModeSemanticAcceptEdits},
				{ID: "dontAsk", Semantic: PermissionModeSemanticLockedDown},
				{ID: "bypassPermissions", Semantic: PermissionModeSemanticFullAccess},
			},
		},
		agentprovider.TuttiAgent: {
			ModelSelection:         true,
			UsesModelCatalog:       true,
			ReasoningEffort:        true,
			DefaultReasoningEffort: "high",
			Speed:                  true,
			// Tutti Agent is a Codex CLI fork and supports the same conservative
			// pre-session capability set.
			Capabilities:            composerFullCapabilities,
			PermissionConfigurable:  true,
			DefaultPermissionModeID: "auto",
			PermissionModes: []PermissionModeOption{
				{ID: "read-only", Semantic: PermissionModeSemanticAskBeforeWrite},
				{ID: "auto", Semantic: PermissionModeSemanticAuto},
				{ID: "full-access", Semantic: PermissionModeSemanticFullAccess},
			},
		},
		agentprovider.Cursor: {
			// Cursor advertises a live `model` config option over ACP
			// (session/new configOptions, parameterized ids); the runtime adapter
			// surfaces those options and applies changes via
			// session/set_config_option, so no static catalog is used. The
			// `agent models` CLI list uses a different (flat) id namespace that
			// ACP rejects — never feed it into the composer. No probe session:
			// the model list is reused from running Cursor conversations only.
			ModelSelection:         true,
			LiveModelDiscovery:     true,
			Capabilities:           []string{"imageInput", "interrupt", "planMode"},
			PermissionConfigurable: true,
			// Approval tiers matching the Codex/Claude Code experience instead of
			// Cursor's raw agent/plan/ask execution modes: read-only maps to
			// Cursor's plan mode, agent (default) prompts per risky action, and
			// full-access spawns with `--force`. See the runtime adapter
			// (acp_provider_cursor.go) for the live-probed flag behavior.
			DefaultPermissionModeID: "agent",
			PermissionModes: []PermissionModeOption{
				{ID: "read-only", Semantic: PermissionModeSemanticAskBeforeWrite},
				{ID: "agent", Semantic: PermissionModeSemanticAuto},
				{ID: "full-access", Semantic: PermissionModeSemanticFullAccess},
			},
		},
		agentprovider.Hermes: {
			Capabilities:            []string{"interrupt"},
			DefaultPermissionModeID: "yolo",
			PermissionModes: []PermissionModeOption{
				{ID: "yolo", Semantic: PermissionModeSemanticUnconfigurable},
			},
		},
		agentprovider.Nexight: {
			Capabilities:            []string{"interrupt"},
			PermissionConfigurable:  true,
			DefaultPermissionModeID: "auto",
			PermissionModes: []PermissionModeOption{
				{ID: "read-only", Semantic: PermissionModeSemanticAskBeforeWrite},
				{ID: "auto", Semantic: PermissionModeSemanticAuto},
				{ID: "full-access", Semantic: PermissionModeSemanticFullAccess},
			},
		},
		agentprovider.OpenClaw: {
			Capabilities: []string{"interrupt"},
		},
		agentprovider.OpenCode: {
			ModelSelection:         true,
			UsesModelCatalog:       true,
			ReasoningEffort:        true,
			DefaultReasoningEffort: "high",
			Capabilities:           []string{"imageInput", "planMode", "interrupt"},
		},
	}
	for _, descriptor := range providerregistry.Migrated() {
		profiles[descriptor.Identity.ID] = composerProfileFromDescriptor(descriptor.ComposerProfile)
	}
	return profiles
}

var composerProfiles = defaultComposerProfiles()

func composerProfileFromDescriptor(descriptor providerregistry.ComposerProfileDescriptor) composerProfile {
	permissionModes := make([]PermissionModeOption, 0, len(descriptor.PermissionModes))
	for _, mode := range descriptor.PermissionModes {
		permissionModes = append(permissionModes, PermissionModeOption{
			ID:       strings.TrimSpace(mode.ID),
			Semantic: PermissionModeSemantic(strings.TrimSpace(mode.Semantic)),
		})
	}
	return composerProfile{
		ModelSelection:           descriptor.ModelSelection,
		UsesModelCatalog:         strings.TrimSpace(descriptor.ModelCatalog) != "",
		ModelCatalog:             strings.TrimSpace(descriptor.ModelCatalog),
		ReasoningEffort:          descriptor.ReasoningEffort,
		ReasoningEffortValues:    append([]string(nil), descriptor.ReasoningEffortValues...),
		DefaultReasoningEffort:   strings.TrimSpace(descriptor.DefaultReasoningEffort),
		Speed:                    descriptor.Speed,
		Capabilities:             append([]string(nil), descriptor.Capabilities...),
		PermissionConfigurable:   descriptor.PermissionConfigurable,
		DefaultPermissionModeID:  strings.TrimSpace(descriptor.DefaultPermissionModeID),
		PermissionModes:          permissionModes,
		ModelConfigOptionID:      strings.TrimSpace(descriptor.ConfigOptionIDs.Model),
		ReasoningConfigOptionID:  strings.TrimSpace(descriptor.ConfigOptionIDs.Reasoning),
		SpeedConfigOptionID:      strings.TrimSpace(descriptor.ConfigOptionIDs.Speed),
		PermissionConfigOptionID: strings.TrimSpace(descriptor.ConfigOptionIDs.Permission),
		SkillKind:                strings.TrimSpace(descriptor.Skills.Kind),
		SkillInvocation:          strings.TrimSpace(descriptor.Skills.Invocation),
	}
}

// composerProfileFor resolves the provider's composer profile. Unknown
// providers get the zero profile (nothing configurable, no capabilities).
func composerProfileFor(provider string) composerProfile {
	profile, ok := composerProfiles[agentprovider.Normalize(provider)]
	if !ok {
		return composerProfile{}
	}
	return profile
}

// composerProfileKnown reports whether the provider has a composer profile;
// unknown providers render no capability list at all (nil, not empty).
func composerProfileKnown(provider string) bool {
	_, ok := composerProfiles[agentprovider.Normalize(provider)]
	return ok
}
