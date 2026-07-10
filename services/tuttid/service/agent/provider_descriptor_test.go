package agent

import (
	"reflect"
	"testing"

	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
)

func TestCodexComposerProfileComesFromProviderDescriptor(t *testing.T) {
	profile := composerProfileFor(agentprovider.Codex)
	if !profile.ModelSelection || !profile.UsesModelCatalog || profile.ModelCatalog != "codex-cli" {
		t.Fatalf("model profile = %#v", profile)
	}
	if !reflect.DeepEqual(profile.ReasoningEffortValues, []string{"low", "medium", "high", "xhigh"}) {
		t.Fatalf("reasoning values = %#v", profile.ReasoningEffortValues)
	}
	if reasoningConfigOptionID(agentprovider.Codex) != "reasoning_effort" {
		t.Fatalf("reasoning config option = %q", reasoningConfigOptionID(agentprovider.Codex))
	}
	if speedConfigOptionID(agentprovider.Codex) != "service_tier" {
		t.Fatalf("speed config option = %q", speedConfigOptionID(agentprovider.Codex))
	}
	if profile.SkillKind != "codex" || profile.SkillInvocation != "promptItem" {
		t.Fatalf("skill profile = %#v", profile)
	}
}

func TestCodexModelCatalogSpecComesFromProviderDescriptor(t *testing.T) {
	spec, ok := agentModelCatalogSpecs[agentprovider.Codex]
	if !ok {
		t.Fatal("codex model catalog spec missing")
	}
	if spec.source != "codex-cli" {
		t.Fatalf("source = %q", spec.source)
	}
	if spec.lister == nil || spec.configuredDefaultModel == nil {
		t.Fatalf("catalog spec incomplete: %#v", spec)
	}
}
