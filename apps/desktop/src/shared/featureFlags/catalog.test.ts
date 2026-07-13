import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFeatureEnabled,
  labFeatureDefinitions,
  LAB_ENABLED_FLAG,
  resolveDesktopWorkspaceUiMode,
  withDesktopWorkspaceUiMode,
  WORKSPACE_STANDALONE_AGENT_MODE_FLAG
} from "./catalog.ts";

test("isFeatureEnabled falls back to catalog default when key absent", () => {
  assert.equal(isFeatureEnabled({}, LAB_ENABLED_FLAG), false);
  assert.equal(
    isFeatureEnabled({ [LAB_ENABLED_FLAG]: true }, LAB_ENABLED_FLAG),
    true
  );
});

test("isFeatureEnabled returns false for unknown keys", () => {
  assert.equal(isFeatureEnabled({ "unknown.x": true }, "unknown.x"), true); // present wins
  assert.equal(isFeatureEnabled({}, "unknown.x"), false); // absent + no catalog default
});

test("labFeatureDefinitions excludes the master switch", () => {
  assert.ok(labFeatureDefinitions().every((d) => d.group === "lab"));
});

test("workspace UI mode defaults to Agent and preserves an explicit OS override", () => {
  const osFlags = withDesktopWorkspaceUiMode(
    { [LAB_ENABLED_FLAG]: true },
    "os"
  );
  const agentFlags = withDesktopWorkspaceUiMode(osFlags, "agent");

  assert.equal(resolveDesktopWorkspaceUiMode({}), "agent");
  assert.equal(resolveDesktopWorkspaceUiMode(osFlags), "os");
  assert.equal(osFlags[WORKSPACE_STANDALONE_AGENT_MODE_FLAG], false);
  assert.deepEqual(agentFlags, { [LAB_ENABLED_FLAG]: true });
});
