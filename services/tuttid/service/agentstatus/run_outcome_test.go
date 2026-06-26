package agentstatus

import (
	"context"
	"testing"

	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
)

func TestRunOutcomeStoreIsProviderScoped(t *testing.T) {
	store := NewRunOutcomeStore()
	store.RecordAuthFailure(agentprovider.ClaudeCode)
	if !store.AuthInvalidated(agentprovider.ClaudeCode) {
		t.Fatal("claude-code should be invalidated")
	}
	if store.AuthInvalidated(agentprovider.Codex) {
		t.Fatal("codex must not be affected by a claude-code failure")
	}
	store.RecordSuccess(agentprovider.ClaudeCode)
	if store.AuthInvalidated(agentprovider.ClaudeCode) {
		t.Fatal("a success should clear the invalidation")
	}
}

func TestRunOutcomeStoreNilSafe(t *testing.T) {
	var store *RunOutcomeStore
	store.RecordAuthFailure(agentprovider.Codex) // must not panic
	if store.AuthInvalidated(agentprovider.Codex) {
		t.Fatal("nil store reports nothing invalidated")
	}
}

func TestResolveAuthOverriddenByRuntimeAuthFailure(t *testing.T) {
	store := NewRunOutcomeStore()
	svc := Service{
		RunOutcomes: store,
		HomeDir:     func() (string, error) { return t.TempDir(), nil },
	}
	// No marker paths / command → baseline is unknown.
	spec := ProviderSpec{Provider: agentprovider.ClaudeCode}

	if got := svc.resolveAuth(context.Background(), spec, true, ""); got.Status != AuthUnknown {
		t.Fatalf("baseline auth = %q, want unknown", got.Status)
	}

	store.RecordAuthFailure(agentprovider.ClaudeCode)
	if got := svc.resolveAuth(context.Background(), spec, true, ""); got.Status != AuthRequired {
		t.Fatalf("after runtime auth failure = %q, want required (override)", got.Status)
	}

	store.ClearAuthInvalidated(agentprovider.ClaudeCode)
	if got := svc.resolveAuth(context.Background(), spec, true, ""); got.Status != AuthUnknown {
		t.Fatalf("after re-auth clear = %q, want unknown", got.Status)
	}
}

func TestResolveAuthOverrideAppliesToCodexToo(t *testing.T) {
	store := NewRunOutcomeStore()
	store.RecordAuthFailure(agentprovider.Codex)
	svc := Service{
		RunOutcomes: store,
		HomeDir:     func() (string, error) { return t.TempDir(), nil },
	}
	spec := ProviderSpec{Provider: agentprovider.Codex}
	if got := svc.resolveAuth(context.Background(), spec, true, ""); got.Status != AuthRequired {
		t.Fatalf("codex auth after failure = %q, want required", got.Status)
	}
}
