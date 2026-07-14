import type { AgentActivitySession } from "@tutti-os/agent-activity-core";
import { isWorkspaceAgentUntitledTask } from "./workspaceAgentLatestActivitySummary";
import { workspaceAgentProviderLabel } from "./workspaceAgentProviderLabel";
import { isWorkspaceAgentSyntheticControlMessage } from "./workspaceAgentSyntheticMessages";

export function resolveDisplayableWorkspaceAgentSessionTitle(
  session: Pick<AgentActivitySession, "title" | "provider">
): string {
  const title = session.title.trim();
  if (
    !title ||
    isWorkspaceAgentUntitledTask(title) ||
    isWorkspaceAgentSyntheticControlMessage(title)
  ) {
    return "";
  }
  const provider = session.provider?.trim();
  if (
    provider &&
    workspaceAgentProviderLabel(provider).toLowerCase() === title.toLowerCase()
  ) {
    return "";
  }
  return title;
}
