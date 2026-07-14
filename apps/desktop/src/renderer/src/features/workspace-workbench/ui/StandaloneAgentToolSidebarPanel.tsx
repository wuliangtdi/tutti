import { lazy, Suspense, type ReactNode } from "react";
import type { I18nRuntime } from "@tutti-os/ui-i18n-runtime";
import type {
  WorkbenchContribution,
  WorkbenchHostHandle
} from "@tutti-os/workbench-surface";
import type { WorkspaceAgentActivityService } from "@renderer/features/workspace-agent";
import type { WorkspaceFileActivationTarget } from "@tutti-os/workspace-file-manager/services";
import type { DesktopBrowserApi } from "@preload/types";
import type { useTranslation } from "@renderer/i18n";
import type { StandaloneAgentIssueManagerOpenRequest } from "../services/standaloneAgentIssueManagerLaunch.ts";
import type { StandaloneAgentToolTab } from "./standaloneAgentToolSidebarModel.ts";
import { isStandaloneAgentFilePreviewTab } from "./standaloneAgentToolSidebarModel.ts";
import { StandaloneAgentBrowserToolPanel } from "./StandaloneAgentBrowserToolPanel.tsx";
import { StandaloneAgentToolLoadingState } from "./StandaloneAgentToolLoadingState.tsx";

const LazyWorkspaceFileManagerPane = lazy(() =>
  import("@renderer/features/workspace-file-manager/ui/WorkspaceFileManagerPane.tsx").then(
    ({ WorkspaceFileManagerPane }) => ({
      default: WorkspaceFileManagerPane
    })
  )
);
const LazyStandaloneAgentAppCenterToolPanel = lazy(() =>
  import("./StandaloneAgentAppCenterToolPanel.tsx").then(
    ({ StandaloneAgentAppCenterToolPanel }) => ({
      default: StandaloneAgentAppCenterToolPanel
    })
  )
);
const LazyStandaloneAgentMessageCenterToolPanel = lazy(() =>
  import("./StandaloneAgentMessageCenterToolPanel.tsx").then(
    ({ StandaloneAgentMessageCenterToolPanel }) => ({
      default: StandaloneAgentMessageCenterToolPanel
    })
  )
);
const LazyStandaloneAgentIssueManagerToolPanel = lazy(() =>
  import("./StandaloneAgentIssueManagerToolPanel.tsx").then(
    ({ StandaloneAgentIssueManagerToolPanel }) => ({
      default: StandaloneAgentIssueManagerToolPanel
    })
  )
);
const LazyStandaloneAgentTerminalPanel = lazy(() =>
  import("./StandaloneAgentTerminalPanel.tsx").then(
    ({ StandaloneAgentTerminalPanel }) => ({
      default: StandaloneAgentTerminalPanel
    })
  )
);
const LazyStandaloneAgentFilePreviewPanel = lazy(() =>
  import("./StandaloneAgentFilePreviewPanel.tsx").then(
    ({ StandaloneAgentFilePreviewPanel }) => ({
      default: StandaloneAgentFilePreviewPanel
    })
  )
);

export interface StandaloneAgentFileOpenRequest {
  path: string;
  requestID: string;
  target?: WorkspaceFileActivationTarget;
}

export function StandaloneAgentToolSidebarPanel({
  active,
  appI18n,
  activityService,
  browserApi,
  contributions,
  fileOpenRequest,
  instanceId,
  issueManagerOpenRequest,
  i18n,
  locale,
  messageCenterOpen,
  onCloseMessageCenter,
  onOpenMessageCenterChat,
  tab,
  setToolHost,
  workspaceId
}: {
  active: boolean;
  appI18n: I18nRuntime<string>;
  activityService: WorkspaceAgentActivityService;
  browserApi?: DesktopBrowserApi;
  contributions: readonly WorkbenchContribution[] | undefined;
  fileOpenRequest: StandaloneAgentFileOpenRequest | null;
  instanceId: string;
  issueManagerOpenRequest: StandaloneAgentIssueManagerOpenRequest | null;
  i18n: I18nRuntime<string>;
  locale: ReturnType<typeof useTranslation>["locale"];
  messageCenterOpen: boolean;
  onCloseMessageCenter: () => void;
  onOpenMessageCenterChat: (input: {
    agentSessionId: string;
    provider: string;
  }) => void;
  tab: StandaloneAgentToolTab;
  setToolHost: (instanceId: string, host: WorkbenchHostHandle | null) => void;
  workspaceId: string;
}): ReactNode {
  if (isStandaloneAgentFilePreviewTab(tab)) {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyStandaloneAgentFilePreviewPanel
          active={active}
          contributions={contributions}
          instanceId={instanceId}
          setToolHost={setToolHost}
          target={tab.filePreview}
          unavailableLabel={i18n.t(
            "workspace.agentGui.toolSidebar.unavailable",
            { tool: tab.filePreview.name }
          )}
          workspaceId={workspaceId}
        />
      </Suspense>
    );
  }

  const panel = tab.panel;
  if (panel === "files") {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyWorkspaceFileManagerPane
          className="h-full"
          revealIntent={fileOpenRequest}
          showPreviewPanel={false}
          workspaceID={workspaceId}
        />
      </Suspense>
    );
  }
  if (panel === "apps") {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyStandaloneAgentAppCenterToolPanel
          active={active}
          backLabel={i18n.t("workspace.appCenter.backToApps")}
          contributions={contributions}
          unavailableLabel={i18n.t(
            "workspace.agentGui.toolSidebar.unavailable",
            { tool: i18n.t("workspace.agentGui.toolSidebar.apps") }
          )}
          workspaceId={workspaceId}
        />
      </Suspense>
    );
  }
  if (panel === "tasks") {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyStandaloneAgentIssueManagerToolPanel
          active={active}
          activation={issueManagerOpenRequest?.activation ?? null}
          contributions={contributions}
          unavailableLabel={i18n.t(
            "workspace.agentGui.toolSidebar.unavailable",
            { tool: i18n.t("workspace.agentGui.toolSidebar.tasks") }
          )}
          workspaceId={workspaceId}
        />
      </Suspense>
    );
  }
  if (panel === "messages") {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyStandaloneAgentMessageCenterToolPanel
          activityService={activityService}
          i18n={i18n}
          locale={locale}
          open={messageCenterOpen}
          workspaceId={workspaceId}
          onClose={onCloseMessageCenter}
          onOpenChat={onOpenMessageCenterChat}
        />
      </Suspense>
    );
  }
  if (panel === "browser") {
    return browserApi ? (
      <StandaloneAgentBrowserToolPanel
        appI18n={appI18n}
        browserApi={browserApi}
        hidden={!active}
        loadingLabel={i18n.t("common.loading")}
      />
    ) : null;
  }
  if (panel === "terminal") {
    return (
      <Suspense
        fallback={
          <StandaloneAgentToolLoadingState label={i18n.t("common.loading")} />
        }
      >
        <LazyStandaloneAgentTerminalPanel
          contributions={contributions}
          instanceId={instanceId}
          loadingLabel={i18n.t("common.loading")}
          open={active}
          setToolHost={setToolHost}
          unavailableLabel={i18n.t(
            "workspace.agentGui.toolSidebar.unavailable"
          )}
        />
      </Suspense>
    );
  }
  return null;
}
