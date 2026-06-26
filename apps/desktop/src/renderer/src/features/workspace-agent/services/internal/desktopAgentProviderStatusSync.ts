import { normalizeTuttidError } from "@tutti-os/client-tuttid-ts";

const providerStatusRefreshReasons = new Set([
  "acp_adapter_not_found",
  "acp_adapter_launch_failed",
  "acp_adapter_version_mismatch",
  "agent_provider_unavailable",
  "auth_required",
  "auth_unknown",
  "cli_not_found"
]);

export function shouldRefreshProviderStatusAfterSessionError(
  error: unknown
): boolean {
  const normalized = normalizeTuttidError(error);
  if (!normalized || normalized.code !== "workspace_operation_failed") {
    return false;
  }
  const reason = normalized.reason?.trim() ?? "";
  return providerStatusRefreshReasons.has(reason);
}
