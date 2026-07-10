package providerregistry

import "testing"

func TestMigratedCodexDescriptorIsComplete(t *testing.T) {
	if err := ValidateMigrated(); err != nil {
		t.Fatalf("ValidateMigrated() error = %v", err)
	}
	descriptor, ok := Find(" CODEX ")
	if !ok {
		t.Fatal("Find(codex) ok = false")
	}
	if err := Validate(descriptor); err != nil {
		t.Fatalf("Validate(codex) error = %v", err)
	}
	if descriptor.Runtime.Kind != RuntimeKindCodexAppServer {
		t.Fatalf("Runtime.Kind = %q", descriptor.Runtime.Kind)
	}
	if descriptor.Target.ID != CodexTargetID {
		t.Fatalf("Target.ID = %q", descriptor.Target.ID)
	}
	if descriptor.ComposerProfile.ConfigOptionIDs.Reasoning != "reasoning_effort" {
		t.Fatalf("Reasoning config option = %q", descriptor.ComposerProfile.ConfigOptionIDs.Reasoning)
	}
	if descriptor.ComposerProfile.ConfigOptionIDs.Speed != "service_tier" {
		t.Fatalf("Speed config option = %q", descriptor.ComposerProfile.ConfigOptionIDs.Speed)
	}
}

func TestMigratedReturnsClones(t *testing.T) {
	first := Migrated()
	first[0].Runtime.Command[0] = "mutated"
	first[0].ComposerProfile.Capabilities[0] = "mutated"

	second := Migrated()
	if second[0].Runtime.Command[0] != "codex" {
		t.Fatalf("Runtime.Command leaked mutation: %#v", second[0].Runtime.Command)
	}
	if second[0].ComposerProfile.Capabilities[0] != "imageInput" {
		t.Fatalf("Capabilities leaked mutation: %#v", second[0].ComposerProfile.Capabilities)
	}
}
