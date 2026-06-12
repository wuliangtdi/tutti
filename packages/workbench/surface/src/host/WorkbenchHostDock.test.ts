import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve("src/host/WorkbenchHostDock.tsx"), "utf8");

test("dock hover panels survive pointer travel from slot to panel", () => {
  assert.match(source, /const DOCK_MAGNIFIED_TOOLTIP_SIDE_OFFSET = 40;/);
  assert.equal(
    source.match(/sideOffset=\{DOCK_MAGNIFIED_TOOLTIP_SIDE_OFFSET\}/g)?.length,
    3
  );
  assert.doesNotMatch(source, /sideOffset=\{26\}/);
  assert.match(source, /const dockHoverPanelOpenDelayMs = 450;/);
  assert.match(source, /const dockHoverPanelPointerRestTolerancePx = 4;/);
  assert.match(source, /const hoverPanelCloseTimerRef = useRef/);
  assert.match(source, /const hoverPanelScheduledPointRef = useRef/);
  assert.match(source, /const closeHoverPanelImmediate = useCallback/);
  assert.match(source, /data-dock-hover-panel-open/);
  assert.match(source, /function dockEntryHasHoverPanel/);
  assert.match(
    source,
    /Boolean\(entry\.state\?\.reason\?\.trim\(\)\)[\s\S]*?\(entry\.hoverActions\?\.length \?\? 0\) > 0/
  );
  assert.match(source, /resetMagnification: resetDockMagnification/);
  assert.match(source, /pauseMagnification: pauseDockMagnification/);
  assert.match(source, /pauseDockMagnification\(\);/);
  assert.match(
    source,
    /onPointerEnter=\{\(\) => \{[\s\S]*?if \(hasHoverPanel\) \{[\s\S]*?scheduleHoverPanelAfterRest\(entry\.id, anchorKey\);/
  );
  assert.match(source, /onPointerMoveCapture=/);
  assert.match(
    source,
    /handleDockPointerTravel\(event\.clientX, event\.clientY\)/
  );
  assert.match(source, /data-dock-hover-panel-entry-id=/);
  assert.match(source, /const resolveHoverPanelTargetAtPoint = useCallback/);
  assert.match(source, /slotElement\.dataset\.dockHoverPanelEntryId/);
  assert.match(
    source,
    /const scheduleHoverPanelAtPointAfterRest = useCallback/
  );
  assert.match(
    source,
    /hoverPanelOpenTimerRef\.current !== null[\s\S]*?dockHoverPanelPointerRestTolerancePx[\s\S]*?return;/
  );
  assert.match(
    source,
    /handleDockPointerMove\(clientX, clientY\);\s*scheduleHoverPanelAtPointAfterRest\(clientX, clientY\);/
  );
  assert.match(
    source,
    /dockMeasureRef\.current\?\.contains\(relatedTarget\)[\s\S]*?scheduleHoverPanelAtPointAfterRest\(\s*event\.clientX,\s*event\.clientY\s*\);[\s\S]*?return;/
  );
  assert.match(source, /beginDockIconInteraction\(anchorKey\)/);
  assert.match(source, /const beginDockMinimizedInteraction = useCallback/);
  assert.match(source, /beginDockMinimizedInteraction\(\);/);
  assert.match(source, /beginDockMinimizedInteraction\(slot\.anchorKey\);/);
  assert.match(source, /--desktop-dock-collapse-inline-size/);
  assert.match(source, /--desktop-dock-collapse-block-size/);
  assert.match(source, /slotElement\.dataset\.collapsing = "true";/);
  assert.match(
    source,
    /const runDockMinimizedLaunchAfterCollapse = useCallback/
  );
  assert.match(source, /const dockMinimizedSlotCollapseLaunchDelayMs = 260;/);
  assert.match(
    source,
    /runDockMinimizedLaunchAfterCollapse\([\s\S]*?slot\.anchorKey[\s\S]*?context\.genie\.launchNodeFromAnchor/
  );
  assert.doesNotMatch(
    source,
    /desktop-dock__minimized-btn[\s\S]{0,260}?beginDockIconInteraction/
  );
  assert.doesNotMatch(source, /resumeMagnificationAfterIconClick/);
  assert.doesNotMatch(source, /magnifySuspendedRef/);
  assert.doesNotMatch(source, /dockClickMagnifyResumeDelayMs/);
  assert.doesNotMatch(
    source,
    /const beginDockIconInteraction = useCallback\([\s\S]*?handleDockPointerLeave\(\);[\s\S]*?\n {2}\);\n\n {2}const handleDockPointerTravel/
  );
  assert.match(
    source,
    /if \(activeHoverPanelRef\.current !== null\) \{[\s\S]*?closeHoverPanelImmediate\(\);[\s\S]*?handleDockPointerLeave\(\);/
  );
  assert.match(source, /setAttribute\("data-bouncing", "true"\)/);
  assert.doesNotMatch(source, /bouncingAnchorKeys/);
  assert.match(source, /onPointerEnter=\{clearHoverPanelCloseTimer\}/);
  assert.match(source, /hoverPanelRef\.current\?\.contains\(relatedTarget\)/);
  assert.match(
    source,
    /onPointerLeave=\{\(event\) => \{[\s\S]*?closeHoverPanelImmediate\(activeHoverPanel\.entryId\);/
  );
  assert.doesNotMatch(source, /\[dock-hover\]/);
  assert.doesNotMatch(
    source,
    /addEventListener\("pointermove", handleWindowPointerMove/
  );
});
