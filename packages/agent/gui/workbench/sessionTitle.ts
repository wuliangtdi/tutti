import type {
  AgentActivityMessage,
  AgentActivitySession
} from "@tutti-os/agent-activity-core";
import {
  firstAgentGUIUserMessageTitle,
  normalizeAgentGUIProviderIdentity,
  resolveAgentGUIExplicitConversationTitle,
  type AgentGUIResolvedProvider
} from "../shared/agentConversationTitleProjection.ts";
import type { AgentGuiWorkbenchProvider } from "./types.ts";

export interface ResolveAgentGuiWorkbenchSessionTitleInput {
  agentSessionId?: string | null;
  fallbackTitle?: string | null;
  provider: AgentGuiWorkbenchProvider | string;
  messages?: readonly AgentActivityMessage[];
  session?: AgentActivitySession | null;
}

export interface AgentGuiWorkbenchSessionTitleResult {
  agentSessionId: string | null;
  source: "snapshot" | "fallback" | "none";
  title: string | null;
}

export function resolveAgentGuiWorkbenchSessionTitle({
  agentSessionId,
  fallbackTitle,
  provider,
  messages = [],
  session = null
}: ResolveAgentGuiWorkbenchSessionTitleInput): AgentGuiWorkbenchSessionTitleResult {
  const normalizedAgentSessionId = agentSessionId?.trim() ?? "";
  if (!normalizedAgentSessionId) {
    return { agentSessionId: null, source: "none", title: null };
  }

  const normalizedProvider = normalizeAgentGUIProviderIdentity(
    session?.provider ?? provider
  );
  const snapshotTitle = resolveDisplayableSnapshotSessionTitle({
    messages,
    provider: normalizedProvider,
    sessionTitle: session?.title ?? ""
  });
  if (snapshotTitle) {
    return {
      agentSessionId: normalizedAgentSessionId,
      source: "snapshot",
      title: snapshotTitle
    };
  }

  if (session || messages.length > 0) {
    return {
      agentSessionId: normalizedAgentSessionId,
      source: "none",
      title: null
    };
  }

  const fallbackDisplayTitle = stripTitle(fallbackTitle);
  return fallbackDisplayTitle
    ? {
        agentSessionId: normalizedAgentSessionId,
        source: "fallback",
        title: fallbackDisplayTitle
      }
    : {
        agentSessionId: normalizedAgentSessionId,
        source: "none",
        title: null
      };
}

function resolveDisplayableSnapshotSessionTitle(input: {
  messages: readonly AgentActivityMessage[];
  provider: AgentGUIResolvedProvider;
  sessionTitle: string;
}): string {
  const explicitSessionTitle = explicitConversationTitle({
    provider: input.provider,
    title: input.sessionTitle
  });
  if (explicitSessionTitle) {
    return explicitSessionTitle;
  }
  return explicitConversationTitle({
    provider: input.provider,
    title: firstAgentGUIUserMessageTitle(input.messages)
  });
}

function explicitConversationTitle(input: {
  provider: AgentGUIResolvedProvider;
  title: string | null | undefined;
}): string {
  return (
    resolveAgentGUIExplicitConversationTitle({
      provider: input.provider,
      title: stripTitle(input.title),
      titleFallback: null
    }) ?? ""
  );
}

function stripTitle(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
