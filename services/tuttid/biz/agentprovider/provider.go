package agentprovider

import (
	"strings"

	"github.com/tutti-os/tutti/packages/agent/daemon/providerregistry"
)

const (
	ClaudeCode = "claude-code"
	Codex      = providerregistry.CodexProviderID
	Cursor     = "cursor"
	Hermes     = "hermes"
	Nexight    = "nexight"
	OpenClaw   = "openclaw"
	OpenCode   = "opencode"
	TuttiAgent = "tutti-agent"
)

func All() []string {
	providers := []string{ClaudeCode}
	for _, descriptor := range providerregistry.Migrated() {
		providers = append(providers, descriptor.Identity.ID)
	}
	return append(providers, TuttiAgent, Cursor, Nexight, Hermes, OpenClaw, OpenCode)
}

func Normalize(provider string) string {
	if descriptor, ok := providerregistry.Find(provider); ok {
		return descriptor.Identity.ID
	}
	switch strings.TrimSpace(strings.ToLower(provider)) {
	case "claude", ClaudeCode:
		return ClaudeCode
	case TuttiAgent:
		return TuttiAgent
	case "cursor-agent", "cursor-cli", Cursor:
		return Cursor
	case "hermes-agent", Hermes:
		return Hermes
	case "tutti", Nexight:
		return Nexight
	case "open-claw", OpenClaw:
		return OpenClaw
	case "open-code", "opencode-ai", OpenCode:
		return OpenCode
	default:
		return ""
	}
}

func IsSupported(provider string) bool {
	return Normalize(provider) != ""
}
