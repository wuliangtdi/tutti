import assert from "node:assert/strict";
import test from "node:test";
import {
  workspaceFileManagerIconGridFrameClassName,
  workspaceFileManagerIconGridIconClassName,
  workspaceFileManagerIconGridLayout
} from "./workspaceFileManagerIconGridLayout.ts";

test("icon grid layout targets roughly 80% of macOS finder icon size", () => {
  assert.equal(workspaceFileManagerIconGridLayout.iconSizePx, 52);
  assert.equal(workspaceFileManagerIconGridIconClassName(), "size-[52px]");
  assert.equal(workspaceFileManagerIconGridFrameClassName(), "size-[60px]");
});
