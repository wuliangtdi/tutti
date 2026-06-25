import type { WorkbenchHostHandle } from "@tutti-os/workbench-surface";
import {
  openAgentEnvPanel,
  type AgentEnvPanelFocus
} from "@tutti-os/agent-gui/agent-env";
import type { AgentProviderStatusService } from "@renderer/features/workspace-agent";
import { workspaceAgentGuiProviderFromIdentifier } from "./workspaceWorkbenchComposition.ts";

export interface WorkspaceAgentProviderDockActionInput {
  actionId: string;
  agentProviderStatusService: Pick<AgentProviderStatusService, "runAction">;
  entryId: string;
  host: WorkbenchHostHandle;
  workspaceId: string;
}

// Remediation actions funnel into the setup wizard (which auto-starts the
// focused stage); only the lightweight re-detect keeps running in place.
const DOCK_ACTION_FOCUS: Record<string, AgentEnvPanelFocus> = {
  install: "install",
  login: "auth"
};

export async function runWorkspaceAgentProviderDockAction(
  input: WorkspaceAgentProviderDockActionInput
): Promise<void> {
  const provider = workspaceAgentGuiProviderFromIdentifier(input.entryId);
  if (!provider) {
    return;
  }
  const focus = DOCK_ACTION_FOCUS[input.actionId];
  if (focus) {
    openAgentEnvPanel({ provider, focus });
    return;
  }
  await input.agentProviderStatusService.runAction(provider, input.actionId, {
    workbenchHost: input.host,
    workspaceId: input.workspaceId
  });
}
