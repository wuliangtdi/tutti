import type { AgentGUIProvider } from "./types.ts";
import { migratedAgentGUIProviderIdentityCatalog } from "./providerIdentityCatalog.ts";
import { createProviderIconUrlMap } from "./providerIconAssets.ts";

/** Explicit fallback until these providers migrate into providerregistry. */
const legacyDockProviderIconKeys = {
  "claude-code": "claude-code",
  cursor: "cursor",
  hermes: "hermes",
  nexight: "tutti",
  openclaw: "openclaw",
  opencode: "opencode",
  "tutti-agent": "tutti"
} as const satisfies Partial<Record<AgentGUIProvider, string>>;

export const agentGuiDockIconUrls = createDockIconUrls();

export const agentGuiDockIconUrl = agentGuiDockIconUrls.codex;

function createDockIconUrls(): Record<AgentGUIProvider, string> {
  return createProviderIconUrlMap(
    "dock",
    legacyDockProviderIconKeys,
    migratedAgentGUIProviderIdentityCatalog
  ) as Record<AgentGUIProvider, string>;
}
