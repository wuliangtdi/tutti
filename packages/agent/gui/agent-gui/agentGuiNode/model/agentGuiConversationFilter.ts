import type { AgentGUIProvider } from "../../../types.ts";
import { normalizeAgentGUIProviderIdentity } from "../../../shared/agentConversationTitleProjection.ts";
import type { WorkspaceAgentActivitySession } from "../../../shared/workspaceAgentActivityTypes.ts";
import type { AgentGUIConversationSummary } from "./agentGuiConversationModel.ts";

export type AgentGUIConversationFilterProvider = Extract<
  AgentGUIProvider,
  "codex" | "claude-code"
>;

export const agentGUIConversationFilterDefaultProviders = [
  "codex",
  "claude-code"
] as const satisfies readonly AgentGUIConversationFilterProvider[];

export type AgentGUIConversationFilter =
  | {
      kind: "all";
    }
  | {
      kind: "provider";
      provider: AgentGUIConversationFilterProvider;
    };

export interface AgentGUIConversationFilterState {
  filter: AgentGUIConversationFilter;
}

export function createAgentGUIConversationFilterState(
  filter: AgentGUIConversationFilter = { kind: "all" }
): AgentGUIConversationFilterState {
  return {
    filter: normalizeAgentGUIConversationFilter(filter)
  };
}

export function normalizeAgentGUIConversationFilter(
  filter: AgentGUIConversationFilter | null | undefined
): AgentGUIConversationFilter {
  if (filter?.kind === "provider") {
    const provider = normalizeAgentGUIProviderIdentity(filter.provider);
    return !isAgentGUIConversationFilterProvider(provider)
      ? { kind: "all" }
      : { kind: "provider", provider };
  }
  return { kind: "all" };
}

export function filterAgentGUIConversationSummaries(
  conversations: readonly AgentGUIConversationSummary[],
  filter: AgentGUIConversationFilter,
  options: {
    allProviders?: readonly AgentGUIConversationFilterProvider[];
  } = {}
): AgentGUIConversationSummary[] {
  const normalizedFilter = normalizeAgentGUIConversationFilter(filter);
  const allProviderSet = createProviderSet(
    options.allProviders ?? agentGUIConversationFilterDefaultProviders
  );
  return conversations.filter((conversation) =>
    matchesAgentGUIConversationFilterProvider(
      conversation.provider,
      normalizedFilter,
      allProviderSet
    )
  );
}

export function filterWorkspaceAgentActivitySessionsForConversations(
  sessions: readonly WorkspaceAgentActivitySession[],
  filter: AgentGUIConversationFilter,
  options: {
    allProviders?: readonly AgentGUIConversationFilterProvider[];
  } = {}
): WorkspaceAgentActivitySession[] {
  const normalizedFilter = normalizeAgentGUIConversationFilter(filter);
  const allProviderSet = createProviderSet(
    options.allProviders ?? agentGUIConversationFilterDefaultProviders
  );
  return sessions.filter((session) =>
    matchesAgentGUIConversationFilterProvider(
      session.provider,
      normalizedFilter,
      allProviderSet
    )
  );
}

function matchesAgentGUIConversationFilterProvider(
  provider: string | null | undefined,
  filter: AgentGUIConversationFilter,
  allProviderSet: ReadonlySet<AgentGUIConversationFilterProvider>
): boolean {
  const normalizedProvider = normalizeAgentGUIProviderIdentity(provider);
  if (!isAgentGUIConversationFilterProvider(normalizedProvider)) {
    return false;
  }
  return filter.kind === "all"
    ? allProviderSet.has(normalizedProvider)
    : normalizedProvider === filter.provider;
}

function createProviderSet(
  providers: readonly AgentGUIConversationFilterProvider[]
): ReadonlySet<AgentGUIConversationFilterProvider> {
  return new Set(providers);
}

function isAgentGUIConversationFilterProvider(
  provider: string
): provider is AgentGUIConversationFilterProvider {
  return provider === "codex" || provider === "claude-code";
}
