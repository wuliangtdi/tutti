package agenttarget

import (
	"testing"

	"github.com/tutti-os/tutti/packages/agent/daemon/providerregistry"
)

func TestDefaultSystemTargetsUseMigratedCodexDescriptor(t *testing.T) {
	targets := DefaultSystemTargets(123)
	if len(targets) == 0 {
		t.Fatal("DefaultSystemTargets() returned no targets")
	}
	descriptor, ok := providerregistry.Find(providerregistry.CodexProviderID)
	if !ok {
		t.Fatal("codex descriptor missing")
	}
	target := targets[0]
	if target.ID != descriptor.Target.ID || target.Provider != descriptor.Identity.ID {
		t.Fatalf("target identity = %#v", target)
	}
	if target.Name != descriptor.Identity.DisplayName || target.IconKey != descriptor.Identity.IconKey {
		t.Fatalf("target presentation = %#v", target)
	}
	if target.SortOrder != descriptor.Target.SortOrder || target.CreatedAtUnixMS != 123 {
		t.Fatalf("target ordering/timestamp = %#v", target)
	}
}
