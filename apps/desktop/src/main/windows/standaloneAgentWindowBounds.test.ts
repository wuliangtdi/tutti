import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveStandaloneAgentWindowContentWidth,
  shouldAnimateStandaloneAgentWindowResize
} from "./standaloneAgentWindowBounds.ts";

test("standalone agent window avoids native resize animation on every platform", () => {
  assert.equal(shouldAnimateStandaloneAgentWindowResize("darwin"), false);
  assert.equal(shouldAnimateStandaloneAgentWindowResize("win32"), false);
  assert.equal(shouldAnimateStandaloneAgentWindowResize("linux"), false);
});

test("standalone agent window grows to the right when the display has room", () => {
  assert.deepEqual(
    resolveStandaloneAgentWindowContentWidth({
      currentBounds: { height: 830, width: 1000, x: 100, y: 80 },
      requestedWidth: 1480,
      workArea: { height: 1000, width: 1920, x: 0, y: 24 }
    }),
    { height: 830, width: 1480, x: 100, y: 80 }
  );
});

test("standalone agent window shifts left only when right-side room runs out", () => {
  assert.deepEqual(
    resolveStandaloneAgentWindowContentWidth({
      currentBounds: { height: 830, width: 1000, x: 700, y: 80 },
      requestedWidth: 1480,
      workArea: { height: 1000, width: 1920, x: 0, y: 24 }
    }),
    { height: 830, width: 1480, x: 440, y: 80 }
  );
});

test("standalone agent window width stays inside the active display", () => {
  assert.deepEqual(
    resolveStandaloneAgentWindowContentWidth({
      currentBounds: { height: 760, width: 900, x: 1530, y: 30 },
      requestedWidth: 2200,
      workArea: { height: 1080, width: 1600, x: 1440, y: 0 }
    }),
    { height: 760, width: 1600, x: 1440, y: 30 }
  );
});
