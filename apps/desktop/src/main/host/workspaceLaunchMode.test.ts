import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkspaceLaunchWindowKind } from "./workspaceLaunchMode.ts";

test("desktop startup creates an Agent window by default", () => {
  assert.equal(resolveWorkspaceLaunchWindowKind({}), "agent");
});

test("desktop startup creates the OS workspace only after an explicit override", () => {
  assert.equal(
    resolveWorkspaceLaunchWindowKind({
      "workspace.standaloneAgentMode": false
    }),
    "workspace"
  );
});
