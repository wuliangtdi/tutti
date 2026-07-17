import type { AgentGUIAgentTarget } from "../../../types";

export interface HandoffTargetOwnershipLabels {
  self: string;
  shared: string;
}

/**
 * Directory entries with owner presentation belong to another user's shared
 * runtime. Entries without owner presentation are local to the current user.
 */
export function resolveHandoffTargetOwnershipLabel(
  target: Pick<AgentGUIAgentTarget, "badge" | "ownerLabel">,
  labels: HandoffTargetOwnershipLabels
): string {
  const ownerLabel = target.ownerLabel?.trim() ?? "";
  const isShared = ownerLabel.length > 0 || target.badge != null;
  if (!isShared) {
    return labels.self;
  }
  return ownerLabel ? `${ownerLabel} · ${labels.shared}` : labels.shared;
}
