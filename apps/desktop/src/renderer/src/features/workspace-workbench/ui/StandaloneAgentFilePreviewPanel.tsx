import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceFileActivationTarget } from "@tutti-os/workspace-file-manager/services";
import type {
  WorkbenchContribution,
  WorkbenchHostHandle,
  WorkbenchHostNodeBodyContext,
  WorkbenchHostNodeData,
  WorkbenchHostNodeDefinition,
  WorkbenchNode
} from "@tutti-os/workbench-surface";
import {
  resolveWorkspaceFilePreviewNodeTypeID,
  workspaceFilePreviewActivationType
} from "../services/workspaceFilePreviewLaunch.ts";
import { requestWorkspaceFilePreviewSave } from "../services/workspaceFilePreviewSaveRequests.ts";
import { createStandaloneAgentDirectToolHost } from "./standaloneAgentToolWorkbench.ts";

export function StandaloneAgentFilePreviewPanel({
  active,
  contributions,
  instanceId,
  setToolHost,
  target,
  unavailableLabel,
  workspaceId
}: {
  active: boolean;
  contributions: readonly WorkbenchContribution[] | undefined;
  instanceId: string;
  setToolHost: (instanceId: string, host: WorkbenchHostHandle | null) => void;
  target: WorkspaceFileActivationTarget;
  unavailableLabel: string;
  workspaceId: string;
}): ReactNode {
  const resolved = useMemo(
    () => resolveStandaloneAgentFilePreviewContribution(contributions, target),
    [contributions, target]
  );
  const directHost = useMemo(createStandaloneAgentDirectToolHost, []);
  const [runtimeNodeState, setRuntimeNodeState] = useState<unknown>();
  const [snapshotNodeState, setSnapshotNodeState] = useState<unknown>();
  const nodeId = `workspace-file-preview:standalone-agent-tool:${instanceId}`;
  const typeId = resolveWorkspaceFilePreviewNodeTypeID(target.fileKind);

  useEffect(() => {
    setToolHost(instanceId, directHost.host);
    return () => setToolHost(instanceId, null);
  }, [directHost, instanceId, setToolHost]);

  useEffect(() => {
    directHost.setNode(
      resolved
        ? {
            instanceId,
            nodeId,
            title: target.name,
            typeId
          }
        : null
    );
    return () => directHost.setNode(null);
  }, [directHost, instanceId, nodeId, resolved, target.name, typeId]);

  useEffect(() => {
    if (!active || target.fileKind !== "text") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        requestWorkspaceFilePreviewSave(nodeId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, nodeId, target.fileKind]);

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

  const activation = {
    payload: target,
    sequence: 1,
    type: workspaceFilePreviewActivationType
  };
  const node: WorkbenchNode<WorkbenchHostNodeData> = {
    data: {
      activation,
      instanceId,
      instanceKey: instanceId,
      runtimeNodeState,
      snapshotNodeState,
      typeId
    },
    displayMode: "fullscreen",
    frame: resolved.frame,
    id: nodeId,
    isMinimized: !active,
    kind: "window",
    restoreFrame: null,
    title: target.name
  };
  const context: WorkbenchHostNodeBodyContext = {
    activation,
    displayMode: node.displayMode,
    externalNodeState: null,
    externalWorkspaceState: { workspaceId },
    focus: () => directHost.host.focusNode(nodeId),
    host: directHost.host,
    instanceId,
    instanceKey: instanceId,
    isFocused: active,
    node,
    setNodeRuntimeState: setRuntimeNodeState,
    setSnapshotNodeState
  };

  return (
    <div
      className="h-full min-h-0 overflow-hidden bg-[var(--background-session-sidepanel)]"
      data-standalone-agent-file-preview-surface="true"
    >
      {resolved.renderBody(context)}
    </div>
  );
}

export function resolveStandaloneAgentFilePreviewContribution(
  contributions: readonly WorkbenchContribution[] | undefined,
  target: WorkspaceFileActivationTarget
): WorkbenchHostNodeDefinition | null {
  const typeId = resolveWorkspaceFilePreviewNodeTypeID(target.fileKind);
  return (
    contributions
      ?.find((candidate) => candidate.id === "workspace-file-preview")
      ?.nodes?.find((candidate) => candidate.typeId === typeId) ?? null
  );
}
