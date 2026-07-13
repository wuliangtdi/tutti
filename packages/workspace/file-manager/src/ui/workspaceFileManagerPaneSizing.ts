export const workspaceFileManagerSidebarDefaultWidth = 460;
export const workspaceFileManagerSidebarMinWidth = 180;
export const workspaceFileManagerContentMinWidth = 580;
export const workspaceFileManagerPaneResizeStep = 24;
export const workspaceFileManagerPreviewDefaultWidth = 348;
export const workspaceFileManagerSidebarWidthStorageKey =
  "tutti.workspace-file-manager.sidebar-width";
export const workspaceFileManagerPreviewWidthStorageKey =
  "tutti.workspace-file-manager.preview-width";

export function readWorkspaceFileManagerSidebarWidth(): number {
  return readWorkspaceFileManagerPaneWidth(
    workspaceFileManagerSidebarWidthStorageKey,
    workspaceFileManagerSidebarDefaultWidth
  );
}

export function writeWorkspaceFileManagerSidebarWidth(width: number): void {
  writeWorkspaceFileManagerPaneWidth(
    workspaceFileManagerSidebarWidthStorageKey,
    width
  );
}

export function readWorkspaceFileManagerPreviewWidth(): number {
  return readWorkspaceFileManagerPaneWidth(
    workspaceFileManagerPreviewWidthStorageKey,
    workspaceFileManagerPreviewDefaultWidth
  );
}

export function writeWorkspaceFileManagerPreviewWidth(width: number): void {
  writeWorkspaceFileManagerPaneWidth(
    workspaceFileManagerPreviewWidthStorageKey,
    width
  );
}

export function clampWorkspaceFileManagerSidebarWidth(input: {
  containerWidth: number;
  width: number;
}): number {
  const containerWidth = Number.isFinite(input.containerWidth)
    ? input.containerWidth
    : workspaceFileManagerSidebarMinWidth + workspaceFileManagerContentMinWidth;
  const maxWidth = Math.max(
    workspaceFileManagerSidebarMinWidth,
    containerWidth - workspaceFileManagerContentMinWidth
  );
  const width = Number.isFinite(input.width)
    ? input.width
    : workspaceFileManagerSidebarDefaultWidth;

  return Math.round(
    Math.min(maxWidth, Math.max(workspaceFileManagerSidebarMinWidth, width))
  );
}

export function resolveWorkspaceFileManagerSidebarMaxWidth(
  containerWidth: number
): number {
  const resolvedContainerWidth = Number.isFinite(containerWidth)
    ? containerWidth
    : workspaceFileManagerSidebarMinWidth + workspaceFileManagerContentMinWidth;
  return Math.round(
    Math.max(
      workspaceFileManagerSidebarMinWidth,
      resolvedContainerWidth - workspaceFileManagerContentMinWidth
    )
  );
}

function readWorkspaceFileManagerPaneWidth(
  storageKey: string,
  defaultWidth: number
): number {
  if (typeof window === "undefined") {
    return defaultWidth;
  }

  const storedWidth = Number(window.localStorage.getItem(storageKey));
  return Number.isFinite(storedWidth) && storedWidth > 0
    ? storedWidth
    : defaultWidth;
}

function writeWorkspaceFileManagerPaneWidth(
  storageKey: string,
  width: number
): void {
  if (typeof window === "undefined" || !Number.isFinite(width) || width <= 0) {
    return;
  }

  window.localStorage.setItem(storageKey, String(width));
}
