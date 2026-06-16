import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("./WorkspaceFileEntryIcon.tsx", import.meta.url),
  "utf8"
);
const panelsSource = readFileSync(
  new URL("./WorkspaceFileManagerPanels.tsx", import.meta.url),
  "utf8"
);
const iconGridSource = readFileSync(
  new URL("./WorkspaceFileManagerIconGrid.tsx", import.meta.url),
  "utf8"
);

test("workspace file entry icons do not render with shadows", () => {
  assert.doesNotMatch(source, /shadow(?:-|\\\[)/);
});

test("workspace folder fallback icon uses the folder asset", () => {
  assert.match(source, /workspace-folder-fallback\.png/);
  assert.doesNotMatch(source, /FolderFilledIcon/);
  assert.match(panelsSource, /WorkspaceFolderFallbackIcon/);
  assert.doesNotMatch(panelsSource, /FolderFilledIcon/);
});

test("workspace image fallback icon uses the image generation asset", () => {
  assert.match(source, /workspace-image-fallback\.png/);
  assert.doesNotMatch(source, /ImageFileIcon/);
  assert.match(panelsSource, /WorkspaceImageFallbackIcon/);
  assert.doesNotMatch(panelsSource, /ImageFileIcon/);
});

test("workspace archive fallback icon uses the archive asset", () => {
  assert.match(source, /workspace-archive-fallback\.png/);
  assert.match(source, /WorkspaceArchiveFallbackIcon/);
  assert.match(source, /shouldUseWorkspaceFileArchiveIcon/);
});

test("workspace vector fallback icons stay smaller than image thumbnails", () => {
  assert.match(source, /function vectorFallbackIconClassName/);
  assert.match(source, /size-\[84px\].*size-\[64px\]/s);
});

test("workspace icon grid rename input uses four pixel corners", () => {
  assert.match(iconGridSource, /aria-label=\{copy\.t\("renameLabel"\)\}/);
  assert.match(iconGridSource, /rounded-\[4px\]/);
  assert.doesNotMatch(
    iconGridSource,
    /w-full min-w-0 rounded-md border border-transparent bg-\[var\(--transparency-block\)\]/
  );
});

test("workspace icon grid entering-directory spinner stays smaller than tile icons", () => {
  assert.match(source, /loadingIconClassName\?: string/);
  assert.match(source, /loadingIconClassName \?\? iconClassName/);
  assert.match(iconGridSource, /loadingIconClassName="size-7"/);
});
