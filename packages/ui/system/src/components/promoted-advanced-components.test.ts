import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function readComponentSource(fileName: string) {
  const relativePath =
    fileName === "index.ts"
      ? fileName
      : `./${fileName.replace(/\.tsx$/, "")}/${fileName}`;

  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function readMetadataIds() {
  const metadataPath = new URL("../metadata/components.json", import.meta.url);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
    components: Array<{ id: string }>;
  };

  return new Set(metadata.components.map((component) => component.id));
}

test("promoted advanced primitives export from the shared component barrel", () => {
  const indexSource = readComponentSource("index.ts");

  for (const exportLine of [
    'export * from "./underline-tabs";',
    'export * from "./date-picker";',
    'export * from "./status-dot";',
    'export * from "./viewport-menu-surface";'
  ]) {
    assert.match(
      indexSource,
      new RegExp(exportLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  }
});

test("promoted advanced primitives register stable ui-system metadata ids", () => {
  const metadataIds = readMetadataIds();

  for (const id of [
    "underline-tabs",
    "date-picker",
    "status-dot",
    "viewport-menu-surface"
  ]) {
    assert.equal(metadataIds.has(id), true, `missing metadata id ${id}`);
  }
});

test("promoted advanced primitive sources preserve their core interaction contracts", () => {
  const underlineTabsSource = readComponentSource("underline-tabs.tsx");
  assert.match(underlineTabsSource, /role="tablist"/);
  assert.match(underlineTabsSource, /ResizeObserver/);
  assert.match(underlineTabsSource, /h-\[33px\]/);
  assert.match(underlineTabsSource, /border-\[var\(--border-1\)\]/);
  assert.match(underlineTabsSource, /--tutti-purple/);
  assert.doesNotMatch(underlineTabsSource, /--accent/);
  assert.match(underlineTabsSource, /gap-\[14px\]/);
  assert.match(underlineTabsSource, /text-\[13px\]/);
  assert.match(underlineTabsSource, /text-\[13px\] font-medium/);
  assert.match(underlineTabsSource, /text-\[11px\] font-medium/);
  assert.doesNotMatch(underlineTabsSource, /font-semibold/);
  assert.match(underlineTabsSource, /duration-\[220ms\]/);
  assert.match(underlineTabsSource, /duration-\[160ms\]/);
  assert.match(underlineTabsSource, /data-visible=/);
  assert.match(underlineTabsSource, /mask-image:linear-gradient/);

  const datePickerSource = readComponentSource("date-picker.tsx");
  assert.match(datePickerSource, /createPortal/);
  assert.match(datePickerSource, /role="grid"/);

  const statusDotSource = readComponentSource("status-dot.tsx");
  assert.match(statusDotSource, /data-tone=/);
  assert.match(statusDotSource, /data-size=/);
  assert.match(statusDotSource, /bg-\[var\(--status-running\)\]/);
  assert.match(statusDotSource, /bg-\[var\(--state-warning\)\]/);
  assert.match(statusDotSource, /bg-\[var\(--state-danger\)\]/);
  assert.match(statusDotSource, /bg-\[var\(--state-success\)\]/);
  assert.doesNotMatch(statusDotSource, /bg-blue-/);
  assert.doesNotMatch(statusDotSource, /bg-amber-/);
  assert.doesNotMatch(statusDotSource, /bg-destructive/);
  assert.doesNotMatch(statusDotSource, /bg-emerald-500/);

  const viewportMenuSurfaceSource = readComponentSource(
    "viewport-menu-surface.tsx"
  );
  assert.match(viewportMenuSurfaceSource, /createPortal/);
  assert.match(viewportMenuSurfaceSource, /ResizeObserver/);
  assert.match(viewportMenuSurfaceSource, /MenuSurface/);
  assert.match(
    viewportMenuSurfaceSource,
    /\[data-slot="viewport-menu-boundary"\]/
  );
  assert.match(viewportMenuSurfaceSource, /portalTarget/);
});
