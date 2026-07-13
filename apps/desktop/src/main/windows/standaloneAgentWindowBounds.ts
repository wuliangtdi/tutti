export interface StandaloneAgentWindowContentBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface StandaloneAgentWindowWorkArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function shouldAnimateStandaloneAgentWindowResize(
  _platform: NodeJS.Platform
): boolean {
  return false;
}

export function resolveStandaloneAgentWindowContentWidth(input: {
  currentBounds: StandaloneAgentWindowContentBounds;
  requestedWidth: number;
  workArea: StandaloneAgentWindowWorkArea;
}): StandaloneAgentWindowContentBounds {
  const requestedWidth = Number.isFinite(input.requestedWidth)
    ? Math.round(input.requestedWidth)
    : input.currentBounds.width;
  const width = Math.min(
    Math.max(1, requestedWidth),
    Math.max(1, Math.round(input.workArea.width))
  );
  const minimumX = input.workArea.x;
  const maximumX = input.workArea.x + input.workArea.width - width;

  return {
    height: input.currentBounds.height,
    width,
    x: Math.max(minimumX, Math.min(input.currentBounds.x, maximumX)),
    y: input.currentBounds.y
  };
}
