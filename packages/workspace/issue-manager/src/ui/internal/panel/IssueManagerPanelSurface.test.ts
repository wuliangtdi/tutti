import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSurfaceSource = readFileSync(
  new URL("./IssueManagerPanelSurface.tsx", import.meta.url),
  "utf8"
);

test("task center loading skeletons use transparency block surfaces", () => {
  assert.match(panelSurfaceSource, /bg-\[var\(--transparency-block\)\]/);
  assert.doesNotMatch(panelSurfaceSource, /bg-muted/);
});

test("task center loading skeletons use compact uniform bones", () => {
  assert.match(panelSurfaceSource, /h-4 rounded-\[4px\]/);
  assert.doesNotMatch(panelSurfaceSource, /rounded-full/);
  assert.doesNotMatch(panelSurfaceSource, /rounded-\[(?:24|28)px\]/);
  assert.doesNotMatch(panelSurfaceSource, /h-(?:3\.5|6|10|12)\b/);
});
