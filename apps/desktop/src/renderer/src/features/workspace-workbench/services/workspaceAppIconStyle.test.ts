import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultWorkspaceAppIconResolver } from "./workspaceAppIconStyle.ts";

test("default workspace app icon resolver includes built-in agent launcher apps", () => {
  const resolveIconUrl = createDefaultWorkspaceAppIconResolver();

  assert.match(resolveIconUrl("agent-codex") ?? "", /\/codex\.png$/u);
  assert.match(
    resolveIconUrl("agent-claude-code") ?? "",
    /\/claudecode\.png$/u
  );
  assert.match(resolveIconUrl("automation") ?? "", /\/automation\.png$/u);
  assert.equal(resolveIconUrl("missing-app"), null);
});
