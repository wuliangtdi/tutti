import type { WorkspaceFileEntry } from "../services/workspaceFileManagerTypes.ts";
import { resolveWorkspaceFileVisualKind } from "../services/workspaceFileManagerModel.ts";

export function shouldResolveWorkspaceFileEntryIcon(
  entry: WorkspaceFileEntry
): boolean {
  if (isWorkspaceApplicationBundle(entry)) {
    return true;
  }
  return (
    entry.kind === "file" && resolveWorkspaceFileVisualKind(entry) === "image"
  );
}

export function isWorkspaceApplicationBundle(
  entry: Pick<WorkspaceFileEntry, "name">
): boolean {
  return entry.name.trim().toLowerCase().endsWith(".app");
}

export function resolveWorkspaceFileEntryIconCacheKey(
  entry: WorkspaceFileEntry
): string {
  return `${entry.path}:${entry.mtimeMs ?? 0}`;
}
