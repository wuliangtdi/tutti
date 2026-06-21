import {
  buildWorkspaceFileBreadcrumbs,
  normalizeWorkspaceFilePath,
  resolveWorkspaceFileActivationTarget
} from "../workspaceFileManagerModel.ts";
import type { WorkspaceFileManagerI18nRuntime } from "../../i18n/workspaceFileManagerI18n.ts";
import type {
  WorkspaceFileEntry,
  WorkspaceFileManagerState
} from "../workspaceFileManagerTypes.ts";
import { findWorkspaceFileEntry } from "./model/entryLookup.ts";

export interface WorkspaceFileManagerRootViewState {
  canImportFromDrop: boolean;
  currentDirectoryPath: string;
  isBusy: boolean;
}

export interface WorkspaceFileManagerToolbarViewState {
  breadcrumbs: Array<{ label: string; path: string }>;
  canGoBack: boolean;
  canGoForward: boolean;
  currentDirectoryPath: string;
  isBusy: boolean;
  isLoading: boolean;
  isMutating: boolean;
  isImporting: boolean;
  showImportAction: boolean;
}

export interface WorkspaceFileManagerPanelsViewState {
  canMove: boolean;
  contextMenuEntryPath: string | null;
  entries: readonly WorkspaceFileEntry[];
  error: string | null;
  inlineRenameEntryPath: string | null;
  inlineRenameValidation: WorkspaceFileManagerState["inlineRenameValidation"];
  isLoading: boolean;
  isRenaming: boolean;
  pendingDirectoryPath: string | null;
  previewState: WorkspaceFileManagerState["previewState"];
  selectedEntry: WorkspaceFileEntry | null;
  selectedPath: string | null;
  showDropOverlay: boolean;
}

export interface WorkspaceFileManagerDialogsViewState {
  createDialog: WorkspaceFileManagerState["createDialog"];
  deleteDialogEntry: WorkspaceFileEntry | null;
  isBusy: boolean;
  isDeleting: boolean;
  isImporting: boolean;
  isRenaming: boolean;
  isViewing: boolean;
  unsupportedDialog: {
    actions?: WorkspaceFileManagerState["unsupportedDialog"] extends infer T
      ? T extends { actions?: infer A }
        ? A
        : never
      : never;
    entry?: WorkspaceFileEntry;
    kind: "import" | "view";
    message?: string | null;
    title?: string | null;
  } | null;
  importConflictDialog: WorkspaceFileManagerState["importConflictDialog"];
}

export interface WorkspaceFileManagerContextMenuViewState {
  contextMenu: {
    entry: WorkspaceFileEntry | null;
    x: number;
    y: number;
  } | null;
  currentDirectoryPath: string;
  isBusy: boolean;
  isLoading: boolean;
  isMutating: boolean;
  showCopyAction: boolean;
  showExportAction: boolean;
  showImportAction: boolean;
  showMoveAction: boolean;
  showOpenInAppBrowserAction: boolean;
  showOpenInDefaultBrowserAction: boolean;
  showOpenInFileViewerAction: boolean;
  showOpenWithAction: boolean;
  showOpenWithOtherAction: boolean;
  showRevealInFolderAction: boolean;
  showRenameAction: boolean;
}

export function resolveWorkspaceFileManagerRootViewState(input: {
  state: WorkspaceFileManagerState;
}): WorkspaceFileManagerRootViewState {
  const { state } = input;
  return {
    canImportFromDrop: state.capabilities.canImportFromDrop,
    currentDirectoryPath: state.currentDirectoryPath,
    isBusy: state.busyAction !== null
  };
}

export function resolveWorkspaceFileManagerToolbarViewState(input: {
  copy: WorkspaceFileManagerI18nRuntime;
  state: WorkspaceFileManagerState;
}): WorkspaceFileManagerToolbarViewState {
  const { copy, state } = input;
  const currentDirectoryPath = normalizeWorkspaceFilePath(
    state.currentDirectoryPath,
    state.root
  );
  return {
    breadcrumbs: buildWorkspaceFileBreadcrumbs(
      currentDirectoryPath,
      copy.t("breadcrumbRootLabel"),
      state.root
    ),
    canGoBack:
      currentDirectoryPath !== normalizeWorkspaceFilePath(state.root) &&
      state.navigationBackStack.length > 0,
    canGoForward: state.navigationForwardStack.length > 0,
    currentDirectoryPath,
    isBusy: state.busyAction !== null,
    isLoading: state.isLoading,
    isMutating: state.isMutating,
    isImporting: state.busyAction === "import",
    showImportAction: state.capabilities.canImportFromPicker
  };
}

export function resolveWorkspaceFileManagerPanelsViewState(input: {
  state: WorkspaceFileManagerState;
}): WorkspaceFileManagerPanelsViewState {
  const { state } = input;
  return {
    canMove: state.capabilities.canMove,
    contextMenuEntryPath: state.contextMenuEntryPath,
    entries: state.entries,
    error: state.error,
    inlineRenameEntryPath: state.inlineRenameEntryPath,
    inlineRenameValidation: state.inlineRenameValidation,
    isLoading: state.isLoading,
    isRenaming: state.busyAction === "rename",
    pendingDirectoryPath: state.pendingDirectoryPath,
    previewState: state.previewState,
    selectedEntry: findSelectedEntry(state),
    selectedPath: state.selectedPath,
    showDropOverlay:
      state.capabilities.canImportFromDrop &&
      state.dragDepth > 0 &&
      state.busyAction === null
  };
}

export function resolveWorkspaceFileManagerDialogsViewState(input: {
  state: WorkspaceFileManagerState;
}): WorkspaceFileManagerDialogsViewState {
  const { state } = input;
  const unsupportedDialogEntry = state.unsupportedDialog?.entryPath
    ? findEntry(state, state.unsupportedDialog.entryPath)
    : null;

  return {
    createDialog: state.createDialog,
    deleteDialogEntry: state.deleteDialog
      ? findEntry(state, state.deleteDialog.entryPath)
      : null,
    isBusy: state.busyAction !== null,
    isDeleting: state.busyAction === "delete",
    isImporting: state.busyAction === "import",
    isRenaming: state.busyAction === "rename",
    isViewing: state.busyAction === "view",
    unsupportedDialog: state.unsupportedDialog
      ? {
          actions: state.unsupportedDialog.actions,
          entry: unsupportedDialogEntry ?? undefined,
          kind: state.unsupportedDialog.kind,
          message: state.unsupportedDialog.message,
          title: state.unsupportedDialog.title
        }
      : null,
    importConflictDialog: state.importConflictDialog
  };
}

export function resolveWorkspaceFileManagerContextMenuViewState(input: {
  state: WorkspaceFileManagerState;
}): WorkspaceFileManagerContextMenuViewState {
  const { state } = input;
  const contextMenuEntry = state.contextMenu?.entryPath
    ? findEntry(state, state.contextMenu.entryPath)
    : null;
  const isContextMenuFile = contextMenuEntry?.kind === "file";

  return {
    contextMenu: state.contextMenu
      ? {
          entry: contextMenuEntry,
          x: state.contextMenu.x,
          y: state.contextMenu.y
        }
      : null,
    currentDirectoryPath: state.currentDirectoryPath,
    isBusy: state.busyAction !== null,
    isLoading: state.isLoading,
    isMutating: state.isMutating,
    showCopyAction: state.capabilities.canCopy,
    showExportAction: state.capabilities.canExport,
    showImportAction: state.capabilities.canImportFromPicker,
    showMoveAction: state.capabilities.canMove,
    showOpenInAppBrowserAction: state.capabilities.canOpenInAppBrowser,
    showOpenInDefaultBrowserAction: state.capabilities.canOpenInDefaultBrowser,
    showOpenInFileViewerAction:
      contextMenuEntry !== null &&
      isContextMenuFile &&
      resolveWorkspaceFileActivationTarget(contextMenuEntry) !== null,
    showOpenWithAction: state.capabilities.canOpenWith && isContextMenuFile,
    showOpenWithOtherAction:
      state.capabilities.canPickOtherOpenWithApplication && isContextMenuFile,
    showRevealInFolderAction: state.capabilities.canRevealInFolder,
    showRenameAction: state.capabilities.canRename
  };
}

function findSelectedEntry(
  state: WorkspaceFileManagerState
): WorkspaceFileEntry | null {
  return findWorkspaceFileEntry(state, state.selectedPath);
}

function findEntry(
  state: WorkspaceFileManagerState,
  entryPath: string
): WorkspaceFileEntry | null {
  return findWorkspaceFileEntry(state, entryPath);
}
