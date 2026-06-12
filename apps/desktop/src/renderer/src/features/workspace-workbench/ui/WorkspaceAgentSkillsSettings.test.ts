import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "WorkspaceAgentSkillsSettings.tsx"
  ),
  "utf8"
);

const panelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "WorkspaceSettingsPanel.tsx"
  ),
  "utf8"
);

test("workspace settings panel wires the agent skills section", () => {
  assert.match(panelSource, /WorkspaceAgentSkillsSettings/);
  assert.match(panelSource, /id: "agent" as const/);
  assert.match(panelSource, /workspace\.settings\.nav\.agent/);
  assert.match(
    panelSource,
    /settingsState\.activeSection === "agent" \? \(\s*<WorkspaceAgentSkillsSettings workspaceId=\{workspace\.id\}/
  );
});

test("agent skills settings loads codex and claude-code through the activity service", () => {
  assert.match(source, /\["codex", "claude-code"\] as const/);
  assert.match(source, /useService\(IWorkspaceAgentActivityService\)/);
  assert.match(source, /getComposerOptions\(\{ provider, workspaceId \}\)/);
});

test("agent skills settings keeps per-provider error and empty states", () => {
  assert.match(source, /\{ status: "error" \}/);
  assert.match(source, /workspace\.settings\.agent\.skills\.loadFailed/);
  assert.match(source, /workspace\.settings\.agent\.skills\.empty/);
  assert.match(source, /workspace\.settings\.agent\.skills\.projectScopeNote/);
});

test("agent skills settings renders read-only rows with source badges", () => {
  assert.match(source, /resolveWorkspaceAgentGuiLabel\(provider\)/);
  assert.match(source, /\{skill\.trigger\}/);
  assert.match(source, /\{skill\.name\}/);
  assert.match(source, /skill\.description \?\? ""/);
  assert.match(source, /workspace\.settings\.agent\.skills\.sourceLabel/);
  assert.match(source, /skill\.pluginName/);
  assert.doesNotMatch(source, /<Button|<button|onClick/);
});
