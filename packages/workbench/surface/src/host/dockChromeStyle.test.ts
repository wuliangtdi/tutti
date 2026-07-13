import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const styles = readFileSync(resolve("src/styles/workbench.css"), "utf8");

test("left dock centers its icon column without an indicator gutter", () => {
  assert.doesNotMatch(styles, /--desktop-dock-left-indicator-gutter/u);
  assert.match(
    styles,
    /\.desktop-dock\[data-dock-placement="left"\] \.desktop-dock__items \{[\s\S]*?align-items: center;[\s\S]*?padding: var\(--desktop-dock-left-items-padding-block\) 0;/u
  );
  assert.match(
    styles,
    /\.desktop-dock\[data-dock-placement="left"\] \.desktop-dock__slot \{[\s\S]*?justify-content: center;/u
  );
  assert.match(
    styles,
    /\.desktop-dock\[data-dock-placement="left"\] \.desktop-dock__scroll-button \{[\s\S]*?left: 50%;/u
  );
});

test("left dock does not render slot pseudo-element state indicators", () => {
  assert.match(
    styles,
    /\.desktop-dock\[data-dock-placement="left"\] \.desktop-dock__slot::before \{\s*content: none !important;\s*display: none !important;\s*\}/u
  );
});
