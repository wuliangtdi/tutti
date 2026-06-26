export interface WorkspaceFilesLaunchRequest {
  homeDirectory?: string | null;
  mode?: WorkspaceFilesLaunchMode;
  path: string;
  source?: "agent_command" | "issue_manager";
  workspaceId: string;
}

export type WorkspaceFilesLaunchMode = "reveal" | "open-directory";

export const workspaceFilesLaunchTypeId = "workspace-files";

export type WorkspaceFilesLaunchHandler = (
  request: WorkspaceFilesLaunchRequest
) => Promise<boolean> | boolean;

const launchHandlersByWorkspaceId = new Map<
  string,
  WorkspaceFilesLaunchHandler
>();

export function registerWorkspaceFilesLaunchHandler(
  workspaceId: string,
  handler: WorkspaceFilesLaunchHandler
): () => void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return noop;
  }

  launchHandlersByWorkspaceId.set(normalizedWorkspaceId, handler);
  return () => {
    if (launchHandlersByWorkspaceId.get(normalizedWorkspaceId) === handler) {
      launchHandlersByWorkspaceId.delete(normalizedWorkspaceId);
    }
  };
}

export async function requestWorkspaceFilesLaunch(
  request: WorkspaceFilesLaunchRequest
): Promise<boolean> {
  const normalizedWorkspaceId = request.workspaceId.trim();
  const normalizedPath = normalizeWorkspaceFilesLaunchPath(request.path);
  if (!normalizedWorkspaceId || !normalizedPath) {
    return false;
  }

  const handler = launchHandlersByWorkspaceId.get(normalizedWorkspaceId);
  if (!handler) {
    return false;
  }

  return handler({
    ...(request.mode ? { mode: request.mode } : {}),
    path: normalizedPath,
    ...(request.source ? { source: request.source } : {}),
    workspaceId: normalizedWorkspaceId
  });
}

function normalizeWorkspaceFilesLaunchPath(path: string): string | null {
  const trimmed = path.trim();
  if (isUncLocalPath(trimmed)) {
    return null;
  }
  const normalized = normalizeLocalPath(trimmed);
  if (
    !normalized ||
    isUrlLikeLocalPath(normalized) ||
    isStructuredPayloadPath(normalized) ||
    isUnsupportedSpecialPath(normalized)
  ) {
    return null;
  }
  return normalized;
}

function isUrlLikeLocalPath(path: string): boolean {
  if (path.startsWith("#")) {
    return true;
  }
  if (isWindowsAbsolutePath(path)) {
    return false;
  }
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(path);
}

function isStructuredPayloadPath(path: string): boolean {
  if (!path.startsWith("{") && !path.startsWith("[")) {
    return false;
  }
  try {
    JSON.parse(path);
    return true;
  } catch {
    return false;
  }
}

function isUnsupportedSpecialPath(path: string): boolean {
  const comparisonPath = cleanLocalPathForComparison(path);
  return comparisonPath === "/dev/null" || hasWindowsNulSegment(comparisonPath);
}

function isUncLocalPath(path: string): boolean {
  return /^(?:\\\\|\/\/)[^/\\]+[/\\][^/\\]+/.test(path);
}

function isWindowsAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:\//.test(path);
}

function normalizeLocalPath(path: string): string {
  return path.trim().replaceAll("\\", "/").replace(/\/+$/, "");
}

function cleanLocalPathForComparison(path: string): string {
  const normalized = path.replace(/\/+/g, "/");
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return normalized.startsWith("/") ? `/${parts.join("/")}` : parts.join("/");
}

function hasWindowsNulSegment(path: string): boolean {
  return path.split("/").some((segment) => {
    const normalized = segment.trim().replace(/[. ]+$/g, "");
    const deviceName = normalized.split(".", 1)[0]?.toUpperCase();
    return deviceName === "NUL";
  });
}

function noop(): void {}
