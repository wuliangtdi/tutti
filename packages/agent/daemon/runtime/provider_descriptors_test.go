package agentruntime

import (
	"testing"

	"github.com/tutti-os/tutti/packages/agent/daemon/providerregistry"
)

func TestMigratedCodexDescriptorBuildsDefaultAdapter(t *testing.T) {
	descriptor, ok := providerregistry.Find(ProviderCodex)
	if !ok {
		t.Fatal("codex descriptor missing")
	}
	adapter := newAdapterFromProviderDescriptor(
		descriptor,
		newScriptedAppServerTransport(),
		LegacyHostMetadata(),
		nil,
	)
	if adapter == nil {
		t.Fatal("adapter = nil")
	}
	if adapter.Provider() != ProviderCodex {
		t.Fatalf("adapter.Provider() = %q", adapter.Provider())
	}
}

func TestMigratedCodexDescriptorOwnsPermissionModes(t *testing.T) {
	if got := defaultPermissionModeIDForProvider(ProviderCodex); got != "auto" {
		t.Fatalf("default permission mode = %q", got)
	}
	for _, mode := range []string{"read-only", "auto", "full-access"} {
		if !permissionModeIDAllowedForProvider(ProviderCodex, mode) {
			t.Fatalf("permission mode %q rejected", mode)
		}
	}
	if permissionModeIDAllowedForProvider(ProviderCodex, "default") {
		t.Fatal("permission mode default accepted")
	}
}
