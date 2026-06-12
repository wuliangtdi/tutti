import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  advanceDockMagnificationSpring,
  DOCK_ICON_BASE_SIZE,
  DOCK_ICON_PEAK_SIZE,
  DOCK_MAGNIFICATION_HALF_RANGE,
  isDockMagnificationSpringSettled,
  mapDistanceToTargetSize
} from "./dockMagnification.ts";

const source = readFileSync(resolve("src/host/dockMagnification.ts"), "utf8");

test("mapDistanceToTargetSize peaks at center and falls off linearly", () => {
  const centerSize = mapDistanceToTargetSize(0);
  const edgeSize = mapDistanceToTargetSize(DOCK_MAGNIFICATION_HALF_RANGE);
  const beyondSize = mapDistanceToTargetSize(
    DOCK_MAGNIFICATION_HALF_RANGE + 12
  );

  assert.equal(centerSize, DOCK_ICON_PEAK_SIZE);
  assert.equal(edgeSize, DOCK_ICON_BASE_SIZE);
  assert.equal(beyondSize, DOCK_ICON_BASE_SIZE);
});

test("mapDistanceToTargetSize is symmetric around the icon center", () => {
  assert.equal(mapDistanceToTargetSize(-24), mapDistanceToTargetSize(24));
});

test("dock magnification spring settles on the target size", () => {
  let spring = { value: DOCK_ICON_BASE_SIZE, velocity: 0 };
  const target = mapDistanceToTargetSize(0);

  for (let index = 0; index < 240; index += 1) {
    spring = advanceDockMagnificationSpring(spring, target, 1 / 60);
  }

  assert.ok(isDockMagnificationSpringSettled(spring, target));
  assert.ok(Math.abs(spring.value - target) < 0.5);
});

test("dock magnification keeps active styles until leave animation settles", () => {
  const handlePointerLeaveSource =
    source.match(
      /const handlePointerLeave = useCallback\([\s\S]*?\n {2}\}, \[scheduleAnimation\]\);/
    )?.[0] ?? "";

  assert.notEqual(handlePointerLeaveSource, "");
  assert.match(
    source,
    /if \(pointerAxis === null && allSettled\) \{[\s\S]*?setMagnifyActive\(false\);/
  );
  assert.doesNotMatch(handlePointerLeaveSource, /setMagnifyActive\(false\);/);
});

test("dock magnification caches slot shell lookups during animation", () => {
  assert.match(source, /const dockMagnificationShellBySlot = new WeakMap/);
  assert.match(source, /dockMagnificationShellBySlot\.get\(slotElement\)/);
  assert.match(source, /slotElement\.contains\(cachedShell\)/);
  assert.match(
    source,
    /dockMagnificationShellBySlot\.set\(slotElement, shell\)/
  );
});

test("dock magnification pins layout before reading live slot centers", () => {
  assert.match(source, /pinMagnificationLayout/);
  assert.match(source, /beginMagnificationSession/);
  assert.match(
    source,
    /pinMagnificationLayout\(\);\s*setMagnifyActive\(true\);\s*captureRestCenters\(\);/
  );
  assert.match(
    source,
    /if \(pointerAxis !== null\) \{[\s\S]*?captureRestCenters\(\);/
  );
});
