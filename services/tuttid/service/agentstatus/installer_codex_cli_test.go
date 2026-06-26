package agentstatus

import "testing"

func TestDisplayNPMRegistryStripsCredentials(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		// Plain registries (and the test override) pass through unchanged.
		"https://registry.npmjs.org":    "https://registry.npmjs.org",
		"https://registry.example.test": "https://registry.example.test",
		"registry.example.test":         "registry.example.test",
		// Embedded credentials are stripped before status/log exposure.
		"https://user:token@registry.foo/path": "https://registry.foo/path",
		"https://token@registry.foo":           "https://registry.foo",
	}
	for in, want := range cases {
		if got := displayNPMRegistry(in); got != want {
			t.Errorf("displayNPMRegistry(%q) = %q, want %q", in, got, want)
		}
	}
}
