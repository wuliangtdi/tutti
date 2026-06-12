import { useCallback, useEffect, useRef, type RefObject } from "react";

export const DOCK_ICON_BASE_SIZE = 43.2;
export const DOCK_ICON_PEAK_SIZE = DOCK_ICON_BASE_SIZE * 1.7;
export const DOCK_MAGNIFICATION_HALF_RANGE = DOCK_ICON_BASE_SIZE * 2.4;

const DOCK_MAGNIFICATION_SPRING_MASS = 0.1;
const DOCK_MAGNIFICATION_SPRING_STIFFNESS = 200;
const DOCK_MAGNIFICATION_SPRING_DAMPING = 14;
const MAGNIFICATION_SETTLE_EPSILON = 0.2;
const MAGNIFICATION_SIZE_EPSILON = 0.2;
const MAX_MAGNIFICATION_STEP_SECONDS = 1 / 30;
const MAGNIFICATION_INFLUENCE_PADDING = 8;

interface DockMagnificationSpring {
  value: number;
  velocity: number;
}

interface DockMagnificationAppliedStyle {
  size: number;
}

const dockMagnificationShellBySlot = new WeakMap<
  HTMLElement,
  HTMLElement | null
>();

export function mapDistanceToTargetSize(
  distance: number,
  baseSize = DOCK_ICON_BASE_SIZE,
  peakSize = DOCK_ICON_PEAK_SIZE,
  halfRange = DOCK_MAGNIFICATION_HALF_RANGE
): number {
  const absoluteDistance = Math.abs(distance);
  if (absoluteDistance >= halfRange) {
    return baseSize;
  }

  const influence = 1 - absoluteDistance / halfRange;
  return baseSize + (peakSize - baseSize) * influence;
}

const DOCK_MAGNIFICATION_SPRING_SUBSTEPS = 8;

export function advanceDockMagnificationSpring(
  current: DockMagnificationSpring,
  target: number,
  deltaSeconds: number
): DockMagnificationSpring {
  const subDeltaSeconds = deltaSeconds / DOCK_MAGNIFICATION_SPRING_SUBSTEPS;
  let { value, velocity } = current;

  for (let step = 0; step < DOCK_MAGNIFICATION_SPRING_SUBSTEPS; step += 1) {
    const force =
      -DOCK_MAGNIFICATION_SPRING_STIFFNESS * (value - target) -
      DOCK_MAGNIFICATION_SPRING_DAMPING * velocity;
    const acceleration = force / DOCK_MAGNIFICATION_SPRING_MASS;
    velocity += acceleration * subDeltaSeconds;
    value += velocity * subDeltaSeconds;
  }

  return { value, velocity };
}

export function isDockMagnificationSpringSettled(
  spring: DockMagnificationSpring,
  target: number
): boolean {
  return (
    Math.abs(spring.value - target) <= MAGNIFICATION_SETTLE_EPSILON &&
    Math.abs(spring.velocity) <= MAGNIFICATION_SETTLE_EPSILON
  );
}

function roundDockMagnificationSize(size: number): number {
  return Math.round(size * 10) / 10;
}

function hasAppliedSizeChanged(
  previous: DockMagnificationAppliedStyle | undefined,
  next: DockMagnificationAppliedStyle
): boolean {
  if (!previous) {
    return true;
  }

  return Math.abs(previous.size - next.size) > MAGNIFICATION_SIZE_EPSILON;
}

function resolveDockMagnificationShell(
  slotElement: HTMLElement
): HTMLElement | null {
  const cachedShell = dockMagnificationShellBySlot.get(slotElement);
  if (
    cachedShell !== undefined &&
    (cachedShell === null || slotElement.contains(cachedShell))
  ) {
    return cachedShell;
  }

  const shell =
    slotElement.querySelector<HTMLElement>("[data-desktop-dock-icon-shell]") ??
    slotElement.querySelector<HTMLElement>(
      ".desktop-dock__minimized-preview"
    ) ??
    slotElement.querySelector<HTMLElement>(
      ".desktop-dock__minimized-stack-icon"
    );
  dockMagnificationShellBySlot.set(slotElement, shell);
  return shell;
}

function applyDockSlotMagnification(
  slotElement: HTMLElement,
  size: number,
  baseSize: number,
  appliedStylesRef: Map<string, DockMagnificationAppliedStyle>
): void {
  const anchorKey = slotElement.dataset.desktopDockAnchorKey;
  if (!anchorKey) {
    return;
  }

  const shell = resolveDockMagnificationShell(slotElement);
  if (!shell) {
    return;
  }

  const nextStyle = {
    size: roundDockMagnificationSize(size)
  };

  if (!hasAppliedSizeChanged(appliedStylesRef.get(anchorKey), nextStyle)) {
    return;
  }

  appliedStylesRef.set(anchorKey, nextStyle);

  if (Math.abs(nextStyle.size - baseSize) <= MAGNIFICATION_SIZE_EPSILON) {
    slotElement.style.removeProperty("width");
    slotElement.style.removeProperty("height");
    shell.style.removeProperty("transform");
    return;
  }

  const scale = nextStyle.size / baseSize;
  slotElement.style.width = `${nextStyle.size}px`;
  slotElement.style.height = `${nextStyle.size}px`;
  shell.style.transform = `scale(${scale})`;
}

function clearDockSlotMagnification(
  slotElement: HTMLElement,
  appliedStylesRef: Map<string, DockMagnificationAppliedStyle>
): void {
  const anchorKey = slotElement.dataset.desktopDockAnchorKey;
  if (anchorKey) {
    appliedStylesRef.delete(anchorKey);
  }
  slotElement.style.removeProperty("width");
  slotElement.style.removeProperty("height");
  const shell = resolveDockMagnificationShell(slotElement);
  shell?.style.removeProperty("transform");
}

function clearMagnificationLayoutPin(
  dockRoot: HTMLElement | null | undefined
): void {
  const itemsElement = dockRoot?.querySelector<HTMLElement>(
    ".desktop-dock__items"
  );
  itemsElement?.style.removeProperty("--desktop-dock-magnify-start-padding");
}

export function useDockMagnification({
  dockPlacement,
  dockRootRef,
  slotRefs
}: {
  dockPlacement: "bottom" | "left";
  dockRootRef: RefObject<HTMLElement | null>;
  slotRefs: RefObject<Map<string, HTMLElement>>;
}) {
  const pointerAxisRef = useRef<number | null>(null);
  const pendingPointerAxisRef = useRef<number | null>(null);
  const springsRef = useRef(new Map<string, DockMagnificationSpring>());
  const appliedStylesRef = useRef(
    new Map<string, DockMagnificationAppliedStyle>()
  );
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const restCentersRef = useRef<Map<string, number> | null>(null);
  const slotOrderRef = useRef<string[]>([]);
  const magnifyActiveRef = useRef(false);

  const setMagnifyActive = useCallback(
    (active: boolean) => {
      if (magnifyActiveRef.current === active) {
        return;
      }
      magnifyActiveRef.current = active;
      if (active) {
        dockRootRef.current?.setAttribute("data-dock-pointer-active", "true");
      } else {
        dockRootRef.current?.removeAttribute("data-dock-pointer-active");
        clearMagnificationLayoutPin(dockRootRef.current);
      }
    },
    [dockRootRef]
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastFrameTimeRef.current = null;
  }, []);

  const captureRestCenters = useCallback(() => {
    const slots = slotRefs.current;
    const centers = new Map<string, number>();
    const order: string[] = [];
    for (const [anchorKey, slotElement] of slots) {
      order.push(anchorKey);
      const rect = slotElement.getBoundingClientRect();
      const center =
        dockPlacement === "left"
          ? rect.top + rect.height / 2
          : rect.left + rect.width / 2;
      centers.set(anchorKey, center);
    }
    slotOrderRef.current = order;
    restCentersRef.current = centers;
  }, [dockPlacement, slotRefs]);

  const pinMagnificationLayout = useCallback(() => {
    const dockRoot = dockRootRef.current;
    const itemsElement = dockRoot?.querySelector<HTMLElement>(
      ".desktop-dock__items"
    );
    if (
      !dockRoot ||
      !itemsElement ||
      dockRoot.hasAttribute("data-scroll-overflow")
    ) {
      return;
    }

    const isVertical = dockPlacement === "left";
    const firstChild = itemsElement.firstElementChild;
    if (!(firstChild instanceof HTMLElement)) {
      return;
    }

    const containerRect = itemsElement.getBoundingClientRect();
    const firstRect = firstChild.getBoundingClientRect();
    const anchorOffset = isVertical
      ? firstRect.top - containerRect.top + itemsElement.scrollTop
      : firstRect.left - containerRect.left + itemsElement.scrollLeft;

    itemsElement.style.setProperty(
      "--desktop-dock-magnify-start-padding",
      `${Math.max(0, anchorOffset)}px`
    );
  }, [dockPlacement, dockRootRef]);

  const beginMagnificationSession = useCallback(() => {
    pinMagnificationLayout();
    setMagnifyActive(true);
    captureRestCenters();
  }, [captureRestCenters, pinMagnificationLayout, setMagnifyActive]);

  const runAnimationFrame = useCallback(
    (frameTime: number) => {
      if (pendingPointerAxisRef.current !== null) {
        pointerAxisRef.current = pendingPointerAxisRef.current;
      }

      const pointerAxis = pointerAxisRef.current;
      if (pointerAxis !== null) {
        captureRestCenters();
      }
      const slots = slotRefs.current;
      const order = slotOrderRef.current;
      const previousFrameTime = lastFrameTimeRef.current;
      lastFrameTimeRef.current = frameTime;
      const deltaSeconds =
        previousFrameTime === null
          ? 1 / 60
          : Math.min(
              (frameTime - previousFrameTime) / 1000,
              MAX_MAGNIFICATION_STEP_SECONDS
            );

      let shouldContinue = false;
      let allSettled = true;
      const influenceRadius =
        DOCK_MAGNIFICATION_HALF_RANGE + MAGNIFICATION_INFLUENCE_PADDING;

      for (let index = 0; index < order.length; index += 1) {
        const anchorKey = order[index];
        if (!anchorKey) {
          continue;
        }

        const center = restCentersRef.current?.get(anchorKey);
        if (center === undefined) {
          continue;
        }

        const distance =
          pointerAxis === null
            ? DOCK_MAGNIFICATION_HALF_RANGE
            : pointerAxis - center;
        const absoluteDistance = Math.abs(distance);
        const inRange = absoluteDistance < influenceRadius;
        const targetSize = inRange
          ? mapDistanceToTargetSize(distance)
          : DOCK_ICON_BASE_SIZE;

        const currentSpring = springsRef.current.get(anchorKey) ?? {
          value: DOCK_ICON_BASE_SIZE,
          velocity: 0
        };
        const nextSpring =
          inRange ||
          !isDockMagnificationSpringSettled(currentSpring, DOCK_ICON_BASE_SIZE)
            ? advanceDockMagnificationSpring(
                currentSpring,
                targetSize,
                deltaSeconds
              )
            : currentSpring;

        if (
          !inRange &&
          isDockMagnificationSpringSettled(nextSpring, DOCK_ICON_BASE_SIZE)
        ) {
          springsRef.current.delete(anchorKey);
          const slotElement = slots.get(anchorKey);
          if (slotElement) {
            clearDockSlotMagnification(slotElement, appliedStylesRef.current);
          }
          continue;
        }

        springsRef.current.set(anchorKey, nextSpring);

        const settled = isDockMagnificationSpringSettled(
          nextSpring,
          targetSize
        );
        if (!settled) {
          shouldContinue = true;
        }
        if (
          !isDockMagnificationSpringSettled(nextSpring, DOCK_ICON_BASE_SIZE)
        ) {
          allSettled = false;
        }

        const slotElement = slots.get(anchorKey);
        if (!slotElement) {
          continue;
        }

        if (
          pointerAxis === null &&
          isDockMagnificationSpringSettled(nextSpring, DOCK_ICON_BASE_SIZE)
        ) {
          springsRef.current.delete(anchorKey);
          clearDockSlotMagnification(slotElement, appliedStylesRef.current);
          continue;
        }

        applyDockSlotMagnification(
          slotElement,
          nextSpring.value,
          DOCK_ICON_BASE_SIZE,
          appliedStylesRef.current
        );
      }

      if (pointerAxis !== null) {
        shouldContinue = true;
      } else if (!allSettled) {
        shouldContinue = true;
      }

      if (pointerAxis === null && allSettled) {
        restCentersRef.current = null;
        slotOrderRef.current = [];
        setMagnifyActive(false);
      }

      if (shouldContinue) {
        animationFrameRef.current = requestAnimationFrame(runAnimationFrame);
        return;
      }

      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    },
    [captureRestCenters, setMagnifyActive, slotRefs]
  );

  const scheduleAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }
    animationFrameRef.current = requestAnimationFrame(runAnimationFrame);
  }, [runAnimationFrame]);

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      pendingPointerAxisRef.current =
        dockPlacement === "left" ? clientY : clientX;
      if (restCentersRef.current === null) {
        beginMagnificationSession();
      }
      scheduleAnimation();
    },
    [beginMagnificationSession, dockPlacement, scheduleAnimation]
  );

  const handlePointerLeave = useCallback(() => {
    pendingPointerAxisRef.current = null;
    pointerAxisRef.current = null;
    scheduleAnimation();
  }, [scheduleAnimation]);

  const clearSlotMagnification = useCallback(
    (anchorKey: string) => {
      springsRef.current.delete(anchorKey);
      restCentersRef.current?.delete(anchorKey);
      appliedStylesRef.current.delete(anchorKey);
      slotOrderRef.current = slotOrderRef.current.filter(
        (key) => key !== anchorKey
      );
      const slotElement = slotRefs.current.get(anchorKey);
      if (slotElement) {
        clearDockSlotMagnification(slotElement, appliedStylesRef.current);
      }
    },
    [slotRefs]
  );

  const pauseMagnification = useCallback(() => {
    stopAnimation();
    pendingPointerAxisRef.current = null;
    pointerAxisRef.current = null;
    lastFrameTimeRef.current = null;
  }, [stopAnimation]);

  const resetMagnification = useCallback(() => {
    stopAnimation();
    for (const slotElement of slotRefs.current.values()) {
      clearDockSlotMagnification(slotElement, appliedStylesRef.current);
    }
    springsRef.current.clear();
    appliedStylesRef.current.clear();
    restCentersRef.current = null;
    slotOrderRef.current = [];
    pointerAxisRef.current = null;
    pendingPointerAxisRef.current = null;
    clearMagnificationLayoutPin(dockRootRef.current);
    setMagnifyActive(false);
  }, [dockRootRef, setMagnifyActive, slotRefs, stopAnimation]);

  useEffect(
    () => () => {
      resetMagnification();
    },
    [resetMagnification]
  );

  return {
    clearSlotMagnification,
    handlePointerLeave,
    handlePointerMove,
    pauseMagnification,
    resetMagnification
  };
}
