package agent

import (
	"testing"

	"github.com/tutti-os/tutti/packages/agent/daemon/providerregistry"
	agenttargetbiz "github.com/tutti-os/tutti/services/tuttid/biz/agenttarget"
)

func TestExternalImportAgentTargetIDUsesMigratedProviderDescriptor(t *testing.T) {
	descriptor, ok := providerregistry.Find(providerregistry.CodexProviderID)
	if !ok {
		t.Fatal("codex descriptor missing")
	}
	input := " CODEX "
	if got := externalImportAgentTargetID(input); got != descriptor.Target.ID {
		t.Fatalf("externalImportAgentTargetID(%q) = %q, want %q", input, got, descriptor.Target.ID)
	}
	if got := externalImportAgentTargetID("claude-code"); got != agenttargetbiz.IDLocalClaudeCode {
		t.Fatalf("externalImportAgentTargetID(claude-code) = %q, want %q", got, agenttargetbiz.IDLocalClaudeCode)
	}
}
