import { useEffect, useRef, type ReactNode } from "react";
import {
  type BrowserNodeFeature,
  type BrowserNodeNavigationPolicy
} from "@tutti-os/browser-node";
import { BrowserNode } from "@tutti-os/browser-node/react";
import type { I18nRuntime } from "@tutti-os/ui-i18n-runtime";
import { Spinner } from "@tutti-os/ui-system";
import { useSnapshot } from "valtio";
import type {
  WorkspaceAppCenterApp,
  WorkspaceAppCenterViewState
} from "@tutti-os/workspace-app-center";
import { resolveWorkspaceAppStatusPresentation } from "@tutti-os/workspace-app-center/core";
import { createAppCenterI18nRuntime } from "@tutti-os/workspace-app-center/i18n";
import type { WorkbenchHostNodeBodyContext } from "@tutti-os/workbench-surface";
import { WorkspaceAppCenterPane } from "../../ui/WorkspaceAppCenterPane.tsx";
import type { IWorkspaceAppCenterService } from "../workspaceAppCenterService.interface";
import { findWorkspaceApp } from "./workspaceAppCenterLaunchRequest.ts";
import {
  shouldPreserveWorkspaceAppWebviewDuringHandoff,
  shouldRenderWorkspaceAppBrowserNode,
  shouldSyncWorkspaceAppWebviewDefaultUrl
} from "./workspaceAppCenterWebviewHandoff.ts";

export const workspaceAppBrowserPartitionPrefix = "persist:tutti-app:";

export function WorkspaceAppCenterInlineAppBody({
  appCenterService,
  browserFeature,
  context,
  fallbackLabel,
  i18n,
  workspaceId
}: {
  appCenterService: IWorkspaceAppCenterService;
  browserFeature: BrowserNodeFeature;
  context: WorkbenchHostNodeBodyContext<
    WorkspaceAppCenterViewState | null,
    unknown
  >;
  fallbackLabel: string;
  i18n: I18nRuntime<string>;
  workspaceId: string;
}): ReactNode {
  const state = useSnapshot(appCenterService.store);
  const viewState =
    state.viewStateByWorkspaceId[workspaceId] ??
    appCenterService.getViewState(workspaceId, context.externalNodeState);
  const appId = viewState.openAppId?.trim() ?? "";

  if (!appId) {
    return (
      <WorkspaceAppCenterPane
        restoredViewState={context.externalNodeState}
        workspaceId={workspaceId}
      />
    );
  }

  const app = findWorkspaceApp(appCenterService, appId);
  return (
    <WorkspaceAppCenterInlineBrowser
      key={appId}
      app={app}
      appCenterCopy={createAppCenterI18nRuntime(i18n)}
      appId={appId}
      browserFeature={browserFeature}
      fallbackLabel={fallbackLabel}
      hidden={context.node.isMinimized}
      navigationPolicy={resolveWorkspaceAppNavigationPolicy(app)}
      nodeId={context.node.id}
      onFocusRequest={context.isFocused ? undefined : () => context.focus()}
      sessionPartition={workspaceAppBrowserSessionPartition({
        appId,
        workspaceId
      })}
    />
  );
}

function WorkspaceAppCenterInlineBrowser({
  app,
  appCenterCopy,
  appId,
  browserFeature,
  fallbackLabel,
  hidden,
  navigationPolicy,
  nodeId,
  onFocusRequest,
  sessionPartition
}: {
  app: WorkspaceAppCenterApp | null;
  appCenterCopy: ReturnType<typeof createAppCenterI18nRuntime>;
  appId: string;
  browserFeature: BrowserNodeFeature;
  fallbackLabel: string;
  hidden: boolean;
  navigationPolicy: BrowserNodeNavigationPolicy | null;
  nodeId: string;
  onFocusRequest?: () => void;
  sessionPartition: string;
}): ReactNode {
  const recentHandoffAppIdRef = useRef<string | null>(null);
  const defaultUrl = app?.launchUrl ?? "about:blank";
  const handoffOptions = {
    hadRecentHandoff: recentHandoffAppIdRef.current === appId
  };
  const hasDirectHandoffState =
    shouldPreserveWorkspaceAppWebviewDuringHandoff(app);
  const preserveWebviewDuringHandoff =
    shouldPreserveWorkspaceAppWebviewDuringHandoff(app, handoffOptions);
  const syncDefaultUrl = shouldSyncWorkspaceAppWebviewDefaultUrl(
    app,
    handoffOptions
  );
  const shouldRenderBrowserNode = shouldRenderWorkspaceAppBrowserNode(
    app,
    defaultUrl,
    handoffOptions
  );

  useEffect(() => {
    if (hasDirectHandoffState) {
      recentHandoffAppIdRef.current = appId;
      return;
    }
    if (app?.runtimeStatus === "running" && app.installProgress == null) {
      recentHandoffAppIdRef.current = null;
      return;
    }
    if (app?.runtimeStatus === "idle" || app?.runtimeStatus === "failed") {
      recentHandoffAppIdRef.current = null;
      return;
    }
    if (!app || recentHandoffAppIdRef.current !== appId) {
      recentHandoffAppIdRef.current = null;
    }
  }, [app, appId, hasDirectHandoffState]);

  if (!shouldRenderBrowserNode) {
    return (
      <WorkspaceAppCenterInlineLoadingState
        app={app}
        copy={appCenterCopy}
        fallbackLabel={fallbackLabel}
      />
    );
  }
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--background-panel)]">
      <BrowserNode
        defaultUrl={defaultUrl}
        feature={browserFeature}
        hidden={hidden}
        navigationPolicy={navigationPolicy}
        nodeId={nodeId}
        onFocusRequest={onFocusRequest}
        sessionPartition={sessionPartition}
        showHeader={false}
        syncDefaultUrl={syncDefaultUrl}
      />
      {preserveWebviewDuringHandoff ? (
        <div className="pointer-events-auto absolute inset-0 z-20">
          <WorkspaceAppCenterInlineLoadingState
            app={app}
            copy={appCenterCopy}
            fallbackLabel={fallbackLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceAppCenterInlineLoadingState({
  app,
  copy,
  fallbackLabel
}: {
  app: WorkspaceAppCenterApp | null;
  copy: ReturnType<typeof createAppCenterI18nRuntime>;
  fallbackLabel: string;
}): ReactNode {
  const isFailed = app?.runtimeStatus === "failed";
  const failedStatusLabel = app
    ? copy.t(resolveWorkspaceAppStatusPresentation(app.runtimeStatus).labelKey)
    : fallbackLabel;
  const statusLabel = isFailed ? failedStatusLabel : fallbackLabel;

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--background-panel)] p-6 text-[var(--text-primary)]">
      <div
        aria-live="polite"
        className="flex min-w-0 items-center gap-2 bg-transparent p-0 text-[13px] leading-5 text-[var(--text-secondary)]"
        role="status"
      >
        {!isFailed ? (
          <Spinner className="text-[var(--text-secondary)]" />
        ) : null}
        <span className="min-w-0 truncate">{statusLabel}</span>
      </div>
    </div>
  );
}

function resolveWorkspaceAppNavigationPolicy(
  app: WorkspaceAppCenterApp | null
): BrowserNodeNavigationPolicy | null {
  const originUrl = app?.launchUrl?.trim() ?? "";
  return originUrl && originUrl !== "about:blank"
    ? { mode: "same-origin", originUrl }
    : null;
}

function workspaceAppBrowserSessionPartition(input: {
  appId: string;
  workspaceId: string;
}): string {
  return `${workspaceAppBrowserPartitionPrefix}${encodeURIComponent(
    input.workspaceId
  )}:${encodeURIComponent(input.appId)}`;
}
