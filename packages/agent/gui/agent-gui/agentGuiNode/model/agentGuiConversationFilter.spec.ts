import { describe, expect, it } from "vitest";
import type { WorkspaceAgentActivitySession } from "../../../shared/workspaceAgentActivityTypes.ts";
import type { AgentGUIConversationSummary } from "./agentGuiConversationModel.ts";
import {
  createAgentGUIConversationFilterState,
  filterAgentGUIConversationSummaries,
  filterWorkspaceAgentActivitySessionsForConversations
} from "./agentGuiConversationFilter.ts";

describe("agentGuiConversationFilter", () => {
  it("includes Codex and Claude Code historical sessions for the all filter", () => {
    expect(
      filterWorkspaceAgentActivitySessionsForConversations(
        [
          session("codex-1", "codex"),
          session("claude-1", "claude-code"),
          session("gemini-1", "gemini")
        ],
        { kind: "all" }
      ).map((item) => item.agentSessionId)
    ).toEqual(["codex-1", "claude-1"]);
  });

  it("filters summaries by the selected provider only", () => {
    expect(
      filterAgentGUIConversationSummaries(
        [
          conversation("codex-1", "codex"),
          conversation("claude-1", "claude-code"),
          conversation("unknown-1", "unknown")
        ],
        { kind: "provider", provider: "claude-code" }
      ).map((item) => item.id)
    ).toEqual(["claude-1"]);
  });

  it("can preserve unknown-provider historical summaries for compatibility", () => {
    expect(
      filterAgentGUIConversationSummaries(
        [
          conversation("codex-1", "codex"),
          conversation("claude-1", "claude-code"),
          conversation("unknown-1", "unknown")
        ],
        { kind: "provider", provider: "codex" },
        { includeUnknownProvider: true }
      ).map((item) => item.id)
    ).toEqual(["codex-1", "unknown-1"]);
  });

  it("keeps the filter model independent from composer state", () => {
    const composerState = Object.freeze({
      defaultProviderTargetId: "local:codex",
      selectedProviderTarget: "local:codex"
    });

    const filterState = createAgentGUIConversationFilterState({
      kind: "provider",
      provider: "claude-code"
    });

    expect(filterState).toEqual({
      filter: {
        kind: "provider",
        provider: "claude-code"
      }
    });
    expect(filterState).not.toHaveProperty("defaultProviderTargetId");
    expect(filterState).not.toHaveProperty("selectedProviderTarget");
    expect(composerState).toEqual({
      defaultProviderTargetId: "local:codex",
      selectedProviderTarget: "local:codex"
    });
  });
});

function session(
  agentSessionId: string,
  provider: WorkspaceAgentActivitySession["provider"]
): WorkspaceAgentActivitySession {
  return {
    agentSessionId,
    cwd: "/repo",
    provider,
    status: "completed",
    title: agentSessionId,
    updatedAtUnixMs: 1,
    workspaceId: "workspace-1"
  };
}

function conversation(
  id: string,
  provider: AgentGUIConversationSummary["provider"]
): AgentGUIConversationSummary {
  return {
    id,
    cwd: "/repo",
    provider,
    status: "completed",
    title: id,
    updatedAtUnixMs: 1
  };
}
