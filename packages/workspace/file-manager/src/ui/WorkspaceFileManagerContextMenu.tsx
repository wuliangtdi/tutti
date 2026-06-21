import {
  ArrowRightIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  FileLinedIcon,
  ImportLinedIcon as ImportIcon,
  LaunchIcon,
  LocateFolderIcon,
  MenuSurface,
  NewWorkspaceLinedIcon,
  ViewportMenuSurface,
  WebIcon,
  cn
} from "@tutti-os/ui-system";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from "react";
import {
  CONTEXT_MENU_SUBMENU_GAP_PX,
  clampContextMenuPosition,
  estimateOpenWithSubmenuHeight
} from "./contextMenuPlacement.ts";
import type { WorkspaceFileManagerI18nRuntime } from "../i18n/workspaceFileManagerI18n.ts";
import type {
  WorkspaceFileEntry,
  WorkspaceFileOpenWithApplication
} from "../services/workspaceFileManagerTypes.ts";

export function WorkspaceFileManagerContextMenu({
  busy,
  copy,
  contextMenu,
  contextMenuRef,
  openInAppBrowserIcon,
  showCopyAction,
  showImportAction,
  showExportAction,
  showOpenInAppBrowserAction,
  showOpenInDefaultBrowserAction,
  showOpenInFileViewerAction,
  showOpenWithAction,
  showOpenWithOtherAction,
  showRevealInFolderAction,
  showRenameAction,
  revealInFolderLabel,
  openWithApplications,
  openWithLoading,
  resolveOpenWithApplicationIcon,
  onClose,
  onCreateDirectory,
  onCreateFile,
  onCopy,
  onCopyPath,
  onDelete,
  onExport,
  onOpen,
  onOpenInAppBrowser,
  onOpenInDefaultBrowser,
  onOpenInFileViewer,
  onOpenWithApplication,
  onOpenWithOtherApplication,
  onImport,
  onRevealInFolder,
  onRename
}: {
  busy: boolean;
  copy: WorkspaceFileManagerI18nRuntime;
  contextMenu: {
    entry: WorkspaceFileEntry | null;
    x: number;
    y: number;
  } | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  openInAppBrowserIcon?: ReactElement;
  resolveOpenWithApplicationIcon?: (
    application: WorkspaceFileOpenWithApplication
  ) => ReactElement | null;
  showCopyAction: boolean;
  showImportAction: boolean;
  showExportAction: boolean;
  showOpenInAppBrowserAction: boolean;
  showOpenInDefaultBrowserAction: boolean;
  showOpenInFileViewerAction: boolean;
  showOpenWithAction: boolean;
  showOpenWithOtherAction: boolean;
  showRevealInFolderAction: boolean;
  showRenameAction: boolean;
  revealInFolderLabel: string;
  openWithApplications: readonly WorkspaceFileOpenWithApplication[];
  openWithLoading: boolean;
  onClose: () => void;
  onCreateDirectory: () => void;
  onCreateFile: () => void;
  onCopy: () => Promise<void>;
  onCopyPath: () => Promise<void>;
  onDelete: () => void;
  onExport: () => Promise<void>;
  onOpen: () => Promise<void>;
  onOpenInAppBrowser: () => Promise<void>;
  onOpenInDefaultBrowser: () => Promise<void>;
  onOpenInFileViewer: () => Promise<void>;
  onOpenWithApplication: (applicationPath: string) => Promise<void>;
  onOpenWithOtherApplication: () => Promise<void>;
  onImport: () => Promise<void>;
  onRevealInFolder: () => Promise<void>;
  onRename: () => void;
}): ReactElement | null {
  const [position, setPosition] = useState({
    x: contextMenu?.x ?? 0,
    y: contextMenu?.y ?? 0
  });

  useLayoutEffect(() => {
    if (!contextMenu) {
      return;
    }

    setPosition({ x: contextMenu.x, y: contextMenu.y });
  }, [contextMenu?.x, contextMenu?.y]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      return;
    }

    const menu = contextMenuRef.current;
    const boundary = menu?.closest("[data-workspace-file-manager]");
    if (!menu || !boundary) {
      return;
    }

    const boundaryRect = boundary.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    setPosition(
      clampContextMenuPosition({
        boundaryHeight: boundaryRect.height,
        boundaryWidth: boundaryRect.width,
        menuHeight: menuRect.height,
        menuWidth: menuRect.width,
        x: contextMenu.x,
        y: contextMenu.y
      })
    );
  }, [
    contextMenu,
    contextMenuRef,
    openWithApplications.length,
    openWithLoading,
    showCopyAction,
    showExportAction,
    showImportAction,
    showOpenInAppBrowserAction,
    showOpenInDefaultBrowserAction,
    showOpenInFileViewerAction,
    showOpenWithAction,
    showOpenWithOtherAction,
    showRevealInFolderAction,
    showRenameAction
  ]);

  if (!contextMenu) {
    return null;
  }

  const entry = contextMenu.entry;
  const isDirectory = entry?.kind === "directory";
  const editItems: ContextMenuActionItem[] = [];
  const transferItems: ContextMenuActionItem[] = [];
  const dangerItems: ContextMenuActionItem[] = [];
  const createItems: ContextMenuActionItem[] = [];

  if (entry) {
    if (showRenameAction) {
      editItems.push({
        action: onRename,
        disabled: busy,
        icon: <EditIcon className="size-4" />,
        key: "rename",
        label: copy.t("renameLabel")
      });
    }
    if (showCopyAction) {
      editItems.push({
        action: onCopy,
        disabled: busy,
        icon: <CopyIcon className="size-4" />,
        key: "copy",
        label: copy.t("copyLabel")
      });
    }
    editItems.push({
      action: onCopyPath,
      disabled: busy,
      icon: <CopyIcon className="size-4" />,
      key: "copy-path",
      label: copy.t("copyPathLabel")
    });
    if (showRevealInFolderAction) {
      editItems.push({
        action: onRevealInFolder,
        disabled: busy,
        icon: <LocateFolderIcon className="size-4" />,
        key: "reveal-in-folder",
        label: revealInFolderLabel
      });
    }
    if (isDirectory && showImportAction) {
      transferItems.push({
        action: onImport,
        disabled: busy,
        icon: <ImportIcon className="size-4" />,
        key: "import",
        label: copy.t("importLabel")
      });
    }
    if (showExportAction) {
      transferItems.push({
        action: onExport,
        disabled: busy,
        icon: <DownloadIcon className="size-4" />,
        key: "export",
        label: copy.t("downloadLabel")
      });
    }
    dangerItems.push({
      action: onDelete,
      disabled: busy,
      danger: true,
      icon: <DeleteIcon className="size-4" />,
      key: "delete",
      label: copy.t("deleteLabel")
    });
  } else {
    createItems.push({
      action: onCreateFile,
      disabled: busy,
      icon: <NewWorkspaceLinedIcon className="size-4" />,
      key: "create-file",
      label: copy.t("createFileLabel")
    });
    createItems.push({
      action: onCreateDirectory,
      disabled: busy,
      icon: <FileLinedIcon className="size-4" />,
      key: "create-directory",
      label: copy.t("createDirectoryLabel")
    });
    if (showImportAction) {
      transferItems.push({
        action: onImport,
        disabled: busy,
        icon: <ImportIcon className="size-4" />,
        key: "import",
        label: copy.t("importLabel")
      });
    }
  }
  const menuGroups: Array<{
    items: readonly ContextMenuActionItem[];
    key: string;
  }> = entry
    ? [
        { items: editItems, key: "edit" },
        { items: transferItems, key: "transfer" },
        { items: dangerItems, key: "danger" }
      ]
    : [
        { items: createItems, key: "create" },
        { items: transferItems, key: "transfer" }
      ];
  const visibleMenuGroups = menuGroups.filter(
    (group) => group.items.length > 0
  );

  return (
    <MenuSurface
      ref={contextMenuRef}
      className="absolute w-[220px] overflow-visible p-1"
      role="menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: "calc(var(--workspace-file-manager-dialog-overlay-z-index) - 1)"
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {entry ? (
        <ContextMenuActionButton
          disabled={busy}
          icon={<EyeIcon className="size-4" />}
          label={copy.t("openLabel")}
          onClick={() => {
            onClose();
            void onOpen();
          }}
        />
      ) : null}
      {entry && showOpenWithAction ? (
        <OpenWithMenuItem
          applications={openWithApplications}
          busy={busy}
          copy={copy}
          isLoading={openWithLoading}
          openInAppBrowserIcon={openInAppBrowserIcon}
          resolveOpenWithApplicationIcon={resolveOpenWithApplicationIcon}
          showOpenInAppBrowser={showOpenInAppBrowserAction}
          showOpenInDefaultBrowser={showOpenInDefaultBrowserAction}
          showOpenInFileViewer={showOpenInFileViewerAction}
          showOpenWithOther={showOpenWithOtherAction}
          onClose={onClose}
          onOpenInAppBrowser={onOpenInAppBrowser}
          onOpenInDefaultBrowser={onOpenInDefaultBrowser}
          onOpenInFileViewer={onOpenInFileViewer}
          onOpenWithApplication={onOpenWithApplication}
          onOpenWithOtherApplication={onOpenWithOtherApplication}
        />
      ) : null}
      {visibleMenuGroups.map((group, groupIndex) => (
        <ContextMenuActionGroup
          key={group.key}
          items={group.items}
          showDivider={entry !== null || groupIndex > 0}
          onClose={onClose}
        />
      ))}
    </MenuSurface>
  );
}
interface ContextMenuActionItem {
  action: () => Promise<void> | void;
  disabled?: boolean;
  danger?: boolean;
  icon: ReactElement;
  key: string;
  label: string;
}

function ContextMenuActionGroup({
  items,
  onClose,
  showDivider
}: {
  items: readonly ContextMenuActionItem[];
  onClose: () => void;
  showDivider: boolean;
}): ReactElement {
  return (
    <>
      {showDivider ? <ContextMenuDivider /> : null}
      {items.map((item) => (
        <ContextMenuActionButton
          key={item.key}
          danger={item.danger}
          disabled={item.disabled}
          icon={item.icon}
          label={item.label}
          onClick={() => {
            onClose();
            void item.action();
          }}
        />
      ))}
    </>
  );
}

function ContextMenuActionButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactElement;
  label: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-[13px] transition-colors disabled:cursor-default disabled:opacity-50",
        danger
          ? "text-[var(--state-danger)] hover:bg-[var(--on-danger)]"
          : "text-[var(--text-primary)] hover:bg-transparency-block"
      )}
      disabled={disabled}
      role="menuitem"
      type="button"
      onClick={onClick}
    >
      <span
        className={cn(
          "grid size-4 flex-none place-items-center",
          danger ? "text-[var(--state-danger)]" : "text-[var(--text-secondary)]"
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function ContextMenuDivider(): ReactElement {
  return (
    <div className="mx-2 my-0.5 h-px bg-[var(--border-1)]" role="separator" />
  );
}

function OpenWithMenuItem({
  applications,
  busy,
  copy,
  isLoading,
  openInAppBrowserIcon,
  resolveOpenWithApplicationIcon,
  showOpenInAppBrowser,
  showOpenInDefaultBrowser,
  showOpenInFileViewer,
  showOpenWithOther,
  onClose,
  onOpenInAppBrowser,
  onOpenInDefaultBrowser,
  onOpenInFileViewer,
  onOpenWithApplication,
  onOpenWithOtherApplication
}: {
  applications: readonly WorkspaceFileOpenWithApplication[];
  busy: boolean;
  copy: WorkspaceFileManagerI18nRuntime;
  isLoading: boolean;
  openInAppBrowserIcon?: ReactElement;
  resolveOpenWithApplicationIcon?: (
    application: WorkspaceFileOpenWithApplication
  ) => ReactElement | null;
  showOpenInAppBrowser: boolean;
  showOpenInDefaultBrowser: boolean;
  showOpenInFileViewer: boolean;
  showOpenWithOther: boolean;
  onClose: () => void;
  onOpenInAppBrowser: () => Promise<void>;
  onOpenInDefaultBrowser: () => Promise<void>;
  onOpenInFileViewer: () => Promise<void>;
  onOpenWithApplication: (applicationPath: string) => Promise<void>;
  onOpenWithOtherApplication: () => Promise<void>;
}): ReactElement {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placementPoint, setPlacementPoint] = useState({ x: 0, y: 0 });
  const closeTimerRef = useRef<number | null>(null);
  const showExternalSection =
    showOpenInDefaultBrowser ||
    showOpenWithOther ||
    isLoading ||
    applications.length > 0;
  const estimatedSubmenuHeight = estimateOpenWithSubmenuHeight({
    applicationCount: applications.length,
    isLoading,
    showExternalSection,
    showOpenInAppBrowser,
    showOpenInDefaultBrowser,
    showOpenInFileViewer,
    showOpenWithOther
  });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 120);
  }, [cancelClose]);

  const openSubmenu = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => {
    return () => {
      cancelClose();
    };
  }, [cancelClose]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setPlacementPoint({
      x: rect.right + CONTEXT_MENU_SUBMENU_GAP_PX,
      y: rect.top
    });
  }, [open, estimatedSubmenuHeight]);

  return (
    <div
      ref={triggerRef}
      className="relative"
      onPointerEnter={openSubmenu}
      onPointerLeave={scheduleClose}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-[13px] text-[var(--text-primary)] transition-colors hover:bg-transparency-block disabled:cursor-default disabled:opacity-50",
          open && "bg-transparency-block"
        )}
        disabled={busy}
        role="menuitem"
        type="button"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              cancelClose();
            }
            return next;
          });
        }}
      >
        <span className="grid size-4 flex-none place-items-center text-[var(--text-secondary)]">
          <LaunchIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {copy.t("openWithLabel")}
        </span>
        <span
          aria-hidden="true"
          className="grid size-4 flex-none place-items-center text-[var(--text-tertiary)]"
        >
          <ArrowRightIcon className="size-4" />
        </span>
      </button>
      <ViewportMenuSurface
        data-workspace-file-manager-submenu=""
        open={open}
        className="w-[220px] max-h-[min(480px,calc(100vh-24px))] overflow-y-auto p-1"
        dismissOnEscape={false}
        dismissOnPointerDownOutside={false}
        dismissOnScroll={false}
        placement={{
          type: "point",
          point: placementPoint,
          alignX: "start",
          alignY: "auto",
          estimatedSize: {
            width: 220,
            height: estimatedSubmenuHeight
          }
        }}
        role="menu"
        onPointerEnter={openSubmenu}
        onPointerLeave={scheduleClose}
      >
        {showOpenInFileViewer ? (
          <ContextMenuActionButton
            disabled={busy}
            icon={<EyeIcon className="size-4" />}
            label={copy.t("openInFileViewerLabel")}
            onClick={() => {
              onClose();
              void onOpenInFileViewer();
            }}
          />
        ) : null}
        {showOpenInAppBrowser ? (
          <ContextMenuActionButton
            disabled={busy}
            icon={openInAppBrowserIcon ?? <WebIcon className="size-4" />}
            label={copy.t("openInAppBrowserLabel")}
            onClick={() => {
              onClose();
              void onOpenInAppBrowser();
            }}
          />
        ) : null}
        {showExternalSection ? <ContextMenuDivider /> : null}
        {isLoading ? (
          <div className="px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
            {copy.t("openWithLoadingLabel")}
          </div>
        ) : null}
        {applications.map((application) => {
          const resolvedIcon = resolveOpenWithApplicationIcon?.(application);

          return (
            <ContextMenuActionButton
              key={application.applicationPath}
              disabled={busy}
              icon={
                resolvedIcon ??
                (application.iconDataUrl ? (
                  <img
                    alt=""
                    className="size-4 rounded-[4px] object-contain"
                    src={application.iconDataUrl}
                  />
                ) : (
                  <EyeIcon className="size-4" />
                ))
              }
              label={application.name}
              onClick={() => {
                onClose();
                void onOpenWithApplication(application.applicationPath);
              }}
            />
          );
        })}
        {showOpenInDefaultBrowser ? (
          <ContextMenuActionButton
            disabled={busy}
            icon={<WebIcon className="size-4" />}
            label={copy.t("openInDefaultBrowserLabel")}
            onClick={() => {
              onClose();
              void onOpenInDefaultBrowser();
            }}
          />
        ) : null}
        {showOpenWithOther ? (
          <ContextMenuActionButton
            disabled={busy}
            icon={<LaunchIcon className="size-4" />}
            label={copy.t("openWithOtherLabel")}
            onClick={() => {
              onClose();
              void onOpenWithOtherApplication();
            }}
          />
        ) : null}
      </ViewportMenuSurface>
    </div>
  );
}
