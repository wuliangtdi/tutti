import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("terminal header status tag renders without badge background", () => {
  const css = readFileSync(resolve("src/styles/terminal.css"), "utf8");

  assert.match(
    css,
    /\.workspace-terminal__status-tag\s*\{[^}]*padding-inline:\s*0;[^}]*background:\s*transparent;/s
  );
});

test("terminal header status dot uses ui-system semantic status colors", () => {
  const css = readFileSync(resolve("src/styles/terminal.css"), "utf8");
  const source = readFileSync(resolve("src/react/TerminalNode.tsx"), "utf8");

  assert.match(
    source,
    /import \{ Badge, StatusDot \} from "@tutti-os\/ui-system";/
  );
  assert.match(source, /tone=\{resolveTerminalStatusTone\(status\)\}/);
  assert.doesNotMatch(css, /workspace-terminal__status-tag[\s\S]*status-dot/);
  assert.doesNotMatch(css, /--workspace-terminal-status/);
  assert.doesNotMatch(css, /--status-running/);
  assert.doesNotMatch(css, /--state-warning/);
  assert.doesNotMatch(css, /--state-success/);
  assert.doesNotMatch(css, /--state-danger/);
});
