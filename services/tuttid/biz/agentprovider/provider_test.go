package agentprovider

import "testing"

func TestAllReturnsUniqueProviders(t *testing.T) {
	seen := make(map[string]struct{})
	for _, provider := range All() {
		if _, ok := seen[provider]; ok {
			t.Fatalf("All() contains duplicate provider %q", provider)
		}
		seen[provider] = struct{}{}
	}
	if _, ok := seen[Codex]; !ok {
		t.Fatalf("All() does not contain migrated provider %q", Codex)
	}
}

func TestNormalizeUsesMigratedProviderIdentity(t *testing.T) {
	if got := Normalize(" CODEX "); got != Codex {
		t.Fatalf("Normalize(CODEX) = %q, want %q", got, Codex)
	}
}
