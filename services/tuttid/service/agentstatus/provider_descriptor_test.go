package agentstatus

import (
	"reflect"
	"testing"

	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
)

func TestCodexStatusSpecComesFromProviderDescriptor(t *testing.T) {
	specs, err := DefaultRegistry().Select([]string{agentprovider.Codex})
	if err != nil {
		t.Fatalf("Select(codex) error = %v", err)
	}
	if len(specs) != 1 {
		t.Fatalf("len(specs) = %d", len(specs))
	}
	spec := specs[0]
	if !reflect.DeepEqual(spec.AdapterCommand, []string{"codex", "app-server"}) {
		t.Fatalf("AdapterCommand = %#v", spec.AdapterCommand)
	}
	if !reflect.DeepEqual(spec.AuthStatusCommand, []string{"login", "-c", `service_tier="fast"`, "status"}) {
		t.Fatalf("AuthStatusCommand = %#v", spec.AuthStatusCommand)
	}
	if spec.Install.Kind != InstallerKindCodexCLILatest || spec.Install.CodexCLI == nil {
		t.Fatalf("Install = %#v", spec.Install)
	}
}
