package providerregistry

const (
	CodexProviderID = "codex"
	CodexTargetID   = "local:codex"
)

func codexDescriptor() ProviderDescriptor {
	return ProviderDescriptor{
		Identity: IdentityDescriptor{
			ID:          CodexProviderID,
			DisplayName: "Codex",
			IconKey:     "codex",
			LocaleKey:   "codex",
		},
		Runtime: RuntimeDescriptor{
			Kind:    RuntimeKindCodexAppServer,
			Command: []string{"codex", "app-server"},
		},
		Status: StatusDescriptor{
			Kind:              StatusKindCodexCLI,
			BinaryNames:       []string{"codex"},
			AuthStatusCommand: []string{"login", "-c", `service_tier="fast"`, "status"},
			AuthMarkerPaths:   []string{"~/.codex/auth.json"},
			APIEndpoints: []string{
				"https://chatgpt.com/backend-api/codex",
				"https://api.openai.com/v1",
			},
			CustomConfigEnvVars: []string{
				"OPENAI_API_KEY",
				"OPENAI_BASE_URL",
				"OPENAI_API_BASE_URL",
				"OPENAI_API_BASE",
			},
			CredentialEnvVars:  []string{"OPENAI_API_KEY"},
			NPMRegistryPackage: "@openai/codex",
			Install: InstallerDescriptor{
				Kind:           InstallerKindCodexCLILatest,
				DisplayCommand: "npm install -g @openai/codex --include=optional",
			},
			LoginArgs: []string{"login", "-c", `service_tier="fast"`},
		},
		ComposerProfile: ComposerProfileDescriptor{
			ModelSelection:         true,
			ModelCatalog:           "codex-cli",
			ReasoningEffort:        true,
			ReasoningEffortValues:  []string{"low", "medium", "high", "xhigh"},
			DefaultReasoningEffort: "high",
			Speed:                  true,
			Capabilities: []string{
				"imageInput",
				"skills",
				"compact",
				"tokenUsage",
				"rateLimits",
				"planMode",
				"interrupt",
			},
			PermissionConfigurable:  true,
			DefaultPermissionModeID: "auto",
			PermissionModes: []PermissionModeDescriptor{
				{ID: "read-only", Semantic: "ask-before-write"},
				{ID: "auto", Semantic: "auto"},
				{ID: "full-access", Semantic: "full-access"},
			},
			ConfigOptionIDs: ComposerConfigOptionIDs{
				Model:      "model",
				Reasoning:  "reasoning_effort",
				Speed:      "service_tier",
				Permission: "mode",
			},
			Skills: SkillDescriptor{
				Kind:       "codex",
				Invocation: "promptItem",
			},
		},
		Target: TargetDescriptor{
			ID:            CodexTargetID,
			LaunchRefType: "local_cli",
			Enabled:       true,
			SortOrder:     10,
		},
		Events: EventsDescriptor{Enabled: true},
	}
}
