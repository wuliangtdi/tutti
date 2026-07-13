import { useMemo, type ReactNode } from "react";
import type {
  WorkbenchContribution,
  WorkbenchHostNodeBodyContext,
  WorkbenchHostNodeData,
  WorkbenchNode
} from "@tutti-os/workbench-surface";
import { ArrowLeftIcon, Button } from "@tutti-os/ui-system";
import {
  useWorkspaceAppCenterService,
  workspaceAppCenterNodeID
} from "@renderer/features/workspace-app-center";
import { createStandaloneAgentDirectToolHost } from "./standaloneAgentToolWorkbench.ts";

export function StandaloneAgentAppCenterToolPanel({
  active,
  backLabel,
  contributions,
  unavailableLabel,
  workspaceId
}: {
  active: boolean;
  backLabel: string;
  contributions: readonly WorkbenchContribution[] | undefined;
  unavailableLabel: string;
  workspaceId: string;
}): ReactNode {
  const { service, state } = useWorkspaceAppCenterService();
  const resolved = resolveStandaloneAgentAppCenterContribution(contributions);
  const directHost = useMemo(createStandaloneAgentDirectToolHost, []);
  const viewState =
    state.viewStateByWorkspaceId[workspaceId] ??
    service.getViewState(workspaceId);
  const openAppId = viewState.openAppId?.trim() ?? "";

  if (!resolved) {
    return (
      <div
        className="flex h-full min-h-0 items-center justify-center text-sm text-[var(--text-secondary)]"
        role="status"
      >
        {unavailableLabel}
      </div>
    );
  }

  const node: WorkbenchNode<WorkbenchHostNodeData> = {
    data: {
      dockEntryId: workspaceAppCenterNodeID,
      instanceId: workspaceAppCenterNodeID,
      instanceKey: workspaceAppCenterNodeID,
      typeId: workspaceAppCenterNodeID
    },
    displayMode: "fullscreen",
    frame: resolved.definition.frame,
    id: workspaceAppCenterNodeID,
    isMinimized: !active,
    kind: "window",
    restoreFrame: null,
    title: resolved.definition.title
  };
  const lookup = {
    instanceId: workspaceAppCenterNodeID,
    instanceKey: workspaceAppCenterNodeID,
    nodeId: workspaceAppCenterNodeID,
    typeId: workspaceAppCenterNodeID,
    workspaceId
  };
  const context: WorkbenchHostNodeBodyContext = {
    activation: null,
    displayMode: node.displayMode,
    externalNodeState:
      resolved.contribution.externalStateSource?.getNodeState(lookup) ?? null,
    externalWorkspaceState:
      resolved.contribution.externalStateSource?.getWorkspaceState({
        workspaceId
      }) ?? null,
    focus: () => undefined,
    host: directHost.host,
    instanceId: workspaceAppCenterNodeID,
    instanceKey: workspaceAppCenterNodeID,
    isFocused: active,
    node,
    setNodeRuntimeState: () => undefined,
    setSnapshotNodeState: () => undefined
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-standalone-agent-app-center-surface="true"
    >
      {openAppId ? (
        <div className="flex h-9 shrink-0 items-center border-b border-[var(--border-1)] px-2">
          <Button
            className="gap-1 px-2"
            data-standalone-agent-app-center-back="true"
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => {
              service.setViewState({
                state: { openAppId: null },
                workspaceId
              });
            }}
          >
            <ArrowLeftIcon aria-hidden size={16} />
            {backLabel}
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {resolved.definition.renderBody(context)}
      </div>
    </div>
  );
}

function resolveStandaloneAgentAppCenterContribution(
  contributions: readonly WorkbenchContribution[] | undefined
) {
  const contribution = contributions?.find(
    (candidate) => candidate.id === workspaceAppCenterNodeID
  );
  const definition = contribution?.nodes?.find(
    (candidate) => candidate.typeId === workspaceAppCenterNodeID
  );
  return contribution && definition ? { contribution, definition } : null;
}
