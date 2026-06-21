import { proxy } from "valtio";
import {
  workspaceFileManagerPersistedStateSchemaVersion,
  workspaceFileManagerLogicalRoot,
  type WorkspaceFileManagerCapabilities,
  type WorkspaceFileManagerPersistedState,
  type WorkspaceFileManagerState
} from "../workspaceFileManagerTypes.ts";
import { normalizeWorkspaceFilePath } from "../workspaceFileManagerModel.ts";

export function createWorkspaceFileManagerStore(input: {
  capabilities: WorkspaceFileManagerCapabilities;
  initialDirectoryPath?: string;
  persistedState?: WorkspaceFileManagerPersistedState | null;
  workspaceID: string;
}): WorkspaceFileManagerState {
  const persistedState = normalizeWorkspaceFileManagerPersistedState(
    input.persistedState
  );
  const initialDirectoryPath = normalizeWorkspaceFilePath(
    input.initialDirectoryPath
  );
  return proxy<WorkspaceFileManagerState>({
    busyAction: null,
    capabilities: input.capabilities,
    contextMenu: null,
    contextMenuEntryPath: null,
    createDialog: null,
    currentDirectoryPath:
      persistedState?.currentDirectoryPath ??
      initialDirectoryPath ??
      workspaceFileManagerLogicalRoot,
    deleteDialog: null,
    directoryExpansionByPath: {},
    inlineRenameEntryPath: null,
    inlineRenameValidation: null,
    dragDepth: 0,
    entries: [],
    error: null,
    expandedDirectoryPaths: {},
    isLoading: false,
    isMutating: false,
    isSearching: false,
    navigationBackStack: persistedState?.navigationBackStack ?? [],
    navigationForwardStack: persistedState?.navigationForwardStack ?? [],
    pendingDirectoryPath: null,
    previewState: { status: "empty" },
    root: workspaceFileManagerLogicalRoot,
    searchEntries: [],
    searchError: null,
    searchQuery: "",
    selectedPath: null,
    unsupportedDialog: null,
    importConflictDialog: null,
    workspaceID: input.workspaceID
  });
}

export function getWorkspaceFileManagerPersistedState(
  state: WorkspaceFileManagerState
): WorkspaceFileManagerPersistedState {
  return {
    currentDirectoryPath: normalizeWorkspaceFilePath(
      state.currentDirectoryPath,
      state.root
    ),
    navigationBackStack: normalizePersistedStack(
      state.navigationBackStack,
      state.root
    ),
    navigationForwardStack: normalizePersistedStack(
      state.navigationForwardStack,
      state.root
    ),
    schemaVersion: workspaceFileManagerPersistedStateSchemaVersion
  };
}

export function normalizeWorkspaceFileManagerPersistedState(
  value: WorkspaceFileManagerPersistedState | null | undefined
): WorkspaceFileManagerPersistedState | null {
  if (
    !isPersistedStateRecord(value) ||
    value.schemaVersion !== workspaceFileManagerPersistedStateSchemaVersion ||
    typeof value.currentDirectoryPath !== "string" ||
    !isStringArray(value.navigationBackStack) ||
    !isStringArray(value.navigationForwardStack)
  ) {
    return null;
  }

  return {
    currentDirectoryPath: normalizeWorkspaceFilePath(
      value.currentDirectoryPath
    ),
    navigationBackStack: normalizePersistedStack(value.navigationBackStack),
    navigationForwardStack: normalizePersistedStack(
      value.navigationForwardStack
    ),
    schemaVersion: workspaceFileManagerPersistedStateSchemaVersion
  };
}

function isPersistedStateRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function normalizePersistedStack(
  values: readonly string[] | undefined,
  root?: string | null
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) =>
      typeof value === "string" ? normalizeWorkspaceFilePath(value, root) : null
    )
    .filter((value): value is string => value !== null);
}
