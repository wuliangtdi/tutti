import { useEffect, useState, type JSX, type ReactNode } from "react";
import { Button, FileCreateIcon, cn } from "@tutti-os/ui-system";
import type {
  IssueManagerIssueSummary,
  IssueManagerTaskSummary
} from "../../../contracts/index.ts";
import { IssueManagerIssuePane } from "./IssueManagerPanels.tsx";
import { IssueManagerBottomBar } from "./IssueManagerBottomBar.tsx";
import { IssueManagerFloatingNotice } from "./IssueManagerFloatingNotice.tsx";
import { IssueManagerSidebar } from "./IssueManagerSidebar.tsx";
import { IssueManagerTaskComposerPane } from "./IssueManagerTaskComposerPane.tsx";
import { IssueManagerTaskDrawer } from "./IssueManagerTaskDrawer.tsx";
import type { IssueManagerController } from "../../react/index.ts";
import { useIssueManagerShellView } from "./useIssueManagerShellView.ts";
import type { IssueManagerLatestRunStatusRenderer } from "../../latestRunStatusRenderer.ts";

export { shouldAutoCollapseIssueManagerSidebar } from "./useIssueManagerShellView.ts";

const issueManagerTaskDrawerExitDurationMs = 180;

export interface IssueManagerShellProps {
  controller: IssueManagerController;
  emptyIllustration?: ReactNode;
  onCloseTaskDrawer: () => void;
  onDismissIssueCreate: () => void;
  renderLatestRunStatus?: IssueManagerLatestRunStatusRenderer;
  selectedIssue: IssueManagerIssueSummary | null;
  selectedTask: IssueManagerTaskSummary | null;
}

export function IssueManagerShell({
  controller,
  emptyIllustration,
  onCloseTaskDrawer,
  onDismissIssueCreate,
  renderLatestRunStatus,
  selectedIssue,
  selectedTask
}: IssueManagerShellProps): JSX.Element {
  const shellView = useIssueManagerShellView({
    controller,
    selectedIssue,
    selectedTask
  });
  const [renderedTaskDrawerTask, setRenderedTaskDrawerTask] =
    useState<IssueManagerTaskSummary | null>(selectedTask);
  const [isTaskDrawerClosing, setIsTaskDrawerClosing] = useState(false);

  useEffect(() => {
    if (shellView.content.isTaskDrawerOpen) {
      setRenderedTaskDrawerTask(selectedTask);
      setIsTaskDrawerClosing(false);
      return undefined;
    }

    if (!renderedTaskDrawerTask) {
      return undefined;
    }

    setIsTaskDrawerClosing(true);
    const timeout = window.setTimeout(() => {
      setRenderedTaskDrawerTask(null);
      setIsTaskDrawerClosing(false);
    }, issueManagerTaskDrawerExitDurationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    renderedTaskDrawerTask,
    selectedTask,
    shellView.content.isTaskDrawerOpen
  ]);
  const taskDrawerTask = shellView.content.isTaskDrawerOpen
    ? selectedTask
    : renderedTaskDrawerTask;

  return (
    <div
      className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-transparent transition-[grid-template-columns] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
      data-issue-manager-sidebar-auto-collapsed={
        shellView.sidebar.isAutoCollapsed ? "true" : undefined
      }
      data-issue-manager-sidebar-collapsed={
        shellView.sidebar.isCollapsed ? "true" : undefined
      }
      ref={shellView.layoutRef}
      style={shellView.layoutStyle}
    >
      {shellView.floatingNotice ? (
        <IssueManagerFloatingNotice notice={shellView.floatingNotice} />
      ) : null}

      <IssueManagerSidebar
        controller={controller}
        isCollapsed={shellView.sidebar.isCollapsed}
        isNarrowLayout={shellView.isNarrowLayout}
        showStandaloneState={shellView.sidebar.showStandaloneState}
        sidebarViewState={shellView.sidebar.viewState}
        statusCounts={shellView.sidebar.statusCounts}
      />

      {shellView.sidebar.isAutoCollapsed ? null : (
        <div
          aria-label={controller.copy.t("labels.resizeIssueList")}
          aria-orientation="vertical"
          aria-valuemax={shellView.resizeHandle.ariaValueMax}
          aria-valuemin={shellView.resizeHandle.ariaValueMin}
          aria-valuenow={shellView.resizeHandle.ariaValueNow}
          className={cn(
            "group absolute top-0 bottom-0 left-[calc(var(--issue-manager-sidebar-width)-6px)] z-20 w-3 cursor-col-resize touch-none opacity-100 transition-[left,opacity] duration-[180ms,120ms] ease-[cubic-bezier(0.4,0,0.2,1),ease] motion-reduce:transition-none",
            shellView.sidebar.isCollapsed &&
              "pointer-events-none left-[-6px] opacity-0"
          )}
          role="separator"
          tabIndex={0}
          onKeyDown={shellView.resizeHandle.onKeyDown}
          onPointerCancel={shellView.resizeHandle.onPointerCancel}
          onPointerDown={shellView.resizeHandle.onPointerDown}
          onPointerMove={shellView.resizeHandle.onPointerMove}
          onPointerUp={shellView.resizeHandle.onPointerUp}
        >
          <span className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-[background-color,width] duration-150 group-hover:w-0.5 group-hover:bg-[color-mix(in_srgb,var(--border-focus)_40%,transparent)] group-focus-visible:w-0.5 group-focus-visible:bg-[color-mix(in_srgb,var(--border-focus)_40%,transparent)]" />
        </div>
      )}

      <div className="relative h-full min-h-0 overflow-hidden bg-transparent @container/issue-manager-content">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            {shellView.content.isIssueEditing ? (
              <IssueManagerIssuePane
                controller={controller}
                renderLatestRunStatus={renderLatestRunStatus}
                selectedIssue={selectedIssue}
                onDismissCreate={onDismissIssueCreate}
              />
            ) : shellView.content.isTaskCreating ? (
              <IssueManagerTaskComposerPane
                controller={controller}
                selectedIssue={selectedIssue}
                onCancel={() => controller.setTaskEditorMode("read")}
              />
            ) : selectedIssue ? (
              <IssueManagerIssuePane
                controller={controller}
                renderLatestRunStatus={renderLatestRunStatus}
                selectedIssue={selectedIssue}
                onDismissCreate={onDismissIssueCreate}
              />
            ) : (
              <IssueManagerShellEmptyState
                controller={controller}
                emptyIllustration={emptyIllustration}
              />
            )}
          </div>

          <IssueManagerBottomBar
            controller={controller}
            isNarrowLayout={shellView.isNarrowLayout}
            selectedIssue={selectedIssue}
            visible={shellView.content.showBottomBar}
          />
        </div>

        {taskDrawerTask ? (
          <IssueManagerTaskDrawer
            controller={controller}
            isClosing={isTaskDrawerClosing}
            renderLatestRunStatus={renderLatestRunStatus}
            selectedIssue={selectedIssue}
            selectedTask={taskDrawerTask}
            onClose={onCloseTaskDrawer}
          />
        ) : null}
      </div>
    </div>
  );
}

function IssueManagerShellEmptyState({
  controller,
  emptyIllustration
}: {
  controller: IssueManagerController;
  emptyIllustration?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-10 py-10">
      <div className="grid max-w-[420px] justify-items-center gap-2 text-center">
        {emptyIllustration ? (
          <div className="mb-4">{emptyIllustration}</div>
        ) : null}
        <h2 className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">
          {controller.copy.t("messages.noIssues")}
        </h2>
        <p className="max-w-[420px] text-[13px] leading-5 text-[var(--text-secondary)]">
          {controller.copy.t("emptyState")}
        </p>
        <Button
          className="mt-2 gap-2"
          type="button"
          onClick={() => controller.setIssueEditorMode("create")}
        >
          <FileCreateIcon size={16} />
          {controller.copy.t("actions.createIssue")}
        </Button>
      </div>
    </div>
  );
}
