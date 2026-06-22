import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(
    "src/renderer/src/features/workspace-workbench/ui/WorkspaceWorkbench.tsx"
  ),
  "utf8"
);

test("WorkspaceWorkbench does not render a global agent install pending overlay", () => {
  assert.doesNotMatch(source, /WorkspaceAgentConnectingCard/);
  assert.doesNotMatch(
    source,
    /pendingActions\.find\(\s*\(action\) => action\.actionId === "install"/s
  );
});

test("WorkspaceWorkbench forwards open-directory mode to workspace files", () => {
  assert.match(
    source,
    /payload:\s*\{\s*\.\.\.\(request\.mode \? \{ mode: request\.mode \} : \{\}\),\s*path: request\.path\s*\}/s
  );
});
