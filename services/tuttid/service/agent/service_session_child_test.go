package agent

import (
	"testing"

	agentactivitybiz "github.com/tutti-os/tutti/services/tuttid/biz/agentactivity"
)

func TestPersistedChildSessionCannotResumeIndependently(t *testing.T) {
	t.Parallel()
	runtime := &fakeRuntime{}
	child := PersistedSession{
		Kind:     agentactivitybiz.SessionKindChild,
		Provider: "codex",
	}
	if persistedSessionCanResume(runtime, child) {
		t.Fatal("child session resumable = true, want root runtime routing only")
	}
	root := PersistedSession{
		Kind:     agentactivitybiz.SessionKindRoot,
		Provider: "codex",
	}
	if !persistedSessionCanResume(runtime, root) {
		t.Fatal("root session resumable = false, want provider resume capability")
	}
}
