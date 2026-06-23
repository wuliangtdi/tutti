package agentsidecar

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestWorkspaceAppSkillUsesPreparedCLICommandForAgentLaunchers(t *testing.T) {
	skill := workspaceAppSkill(PrepareInput{CLICommand: "tutti-dev"})

	for _, want := range []string{
		"tutti-dev codex start --prompt <task> --show --json",
		"tutti-dev claude start --prompt <task> --show --json",
		"Do not ask for a missing model",
		"If `appId` is `issue-manager`, read and follow the injected `issue-manager` skill",
		"`tutti-dev <scope> <command>`",
	} {
		if !strings.Contains(skill, want) {
			t.Fatalf("workspace app skill missing %q: %q", want, skill)
		}
	}
	if strings.Contains(skill, "{{CLI_COMMAND}}") || strings.Contains(skill, "tutti codex start") {
		t.Fatalf("workspace app skill used unresolved or production CLI command: %q", skill)
	}
	if strings.Contains(skill, "ask for missing `model`") ||
		strings.Contains(skill, "codex start --model <model>") ||
		strings.Contains(skill, "claude start --model <model>") {
		t.Fatalf("workspace app skill still requires model: %q", skill)
	}
}

func TestTuttiCLIPolicyUsesPreparedCLICommandForAgentLauncherFallback(t *testing.T) {
	policy := tuttiCLIPolicy(PrepareInput{
		AgentSessionID: "session-1",
		CLICommand:     "tutti-dev",
		Provider:       "codex",
	})

	for _, want := range []string{
		"tutti-dev codex start --prompt <task> --show --json",
		"tutti-dev claude start --prompt <task> --show --json",
		"do not ask for a missing model",
		"if it is `issue-manager`, use the `issue-manager` workflow",
	} {
		if !strings.Contains(policy, want) {
			t.Fatalf("tutti CLI policy missing %q: %q", want, policy)
		}
	}
	if strings.Contains(policy, "{{CLI_COMMAND}}") || strings.Contains(policy, "tutti codex start") {
		t.Fatalf("tutti CLI policy used unresolved or production CLI command: %q", policy)
	}
	if strings.Contains(policy, "Ask for missing `model`") ||
		strings.Contains(policy, "codex start --model <model>") ||
		strings.Contains(policy, "claude start --model <model>") {
		t.Fatalf("tutti CLI policy still requires model: %q", policy)
	}
}

func TestProviderSkillRootDoesNotExposeClaudeCodeProjectSkills(t *testing.T) {
	cwd := filepath.Join("workspace", "repo")

	if root := providerSkillRoot(cwd, "claude-code"); root != "" {
		t.Fatalf("providerSkillRoot() for claude-code = %q, want empty", root)
	}
	if root := providerSkillRoot(cwd, "gemini"); root != filepath.Join(cwd, ".gemini", "skills") {
		t.Fatalf("providerSkillRoot() for gemini = %q, want project skill root", root)
	}
}
