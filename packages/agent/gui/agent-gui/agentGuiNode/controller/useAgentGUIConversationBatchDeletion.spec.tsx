import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentSessionEngine } from "@tutti-os/agent-activity-core";
import type { AgentActivityRuntime } from "../../../agentActivityRuntime";
import { useAgentGUIConversationBatchDeletion } from "./useAgentGUIConversationBatchDeletion";

function createInput(agentActivityRuntime: AgentActivityRuntime) {
  return {
    activeConversationIdRef: { current: null },
    agentActivityRuntime,
    agentHostApi: { toast: { error: vi.fn() } } as never,
    conversationsRef: {
      current: [
        {
          cwd: "/workspace",
          id: "loaded-session",
          provider: "codex" as const,
          sortTimeUnixMs: 1,
          status: "completed" as const,
          title: "Loaded",
          titleFallback: null,
          updatedAtUnixMs: 1,
          userId: "user-1"
        }
      ]
    },
    dataRef: { current: { provider: "codex" } } as never,
    deleteAgentSessionView: vi.fn(),
    isDeletingProjectConversations: false,
    markSelectedConversationDetailPending: vi.fn(() => null),
    persistActiveConversation: vi.fn(),
    removeConversations: vi.fn(),
    sessionEngine: { dispatch: vi.fn() } as unknown as AgentSessionEngine,
    sessionViewRef: (agentSessionId: string | null | undefined) => ({
      agentSessionId,
      origin: "local",
      workspaceId: "workspace-1"
    }),
    setActiveConversationId: vi.fn(),
    setAgentSessionViewMessagesLoading: vi.fn(),
    setDetailError: vi.fn(),
    setDraftByScopeKey: vi.fn(),
    setIntent: vi.fn(),
    setIsDeletingProjectConversations: vi.fn(),
    setIsLoadingMessages: vi.fn(),
    setListError: vi.fn(),
    submittedDraftSnapshotsRef: { current: {} },
    workspaceId: "workspace-1"
  };
}

describe("useAgentGUIConversationBatchDeletion", () => {
  it("requests one unpinned candidate snapshot and sends one exact batch delete", async () => {
    const listSessionSectionDeletionCandidates = vi.fn(async () => ({
      excludePinned: true,
      sectionKey: "conversations",
      sessionIds: ["loaded-session", "unloaded-session"],
      workspaceId: "workspace-1"
    }));
    const deleteSessionsBatch = vi.fn(async () => ({
      removedMessages: 1,
      removedSessionIds: ["loaded-session", "unloaded-session"],
      removedSessions: 2
    }));
    const deleteSession = vi.fn();
    const runtime = {
      deleteSession,
      deleteSessionsBatch,
      listSessionSectionDeletionCandidates
    } as unknown as AgentActivityRuntime;
    const input = createInput(runtime);
    const { result } = renderHook(() =>
      useAgentGUIConversationBatchDeletion(input)
    );

    let sessionIds: string[] = [];
    await act(async () => {
      sessionIds = await result.current.confirmDeleteProjectConversations(
        "conversations",
        "codex-target"
      );
    });
    expect(listSessionSectionDeletionCandidates).toHaveBeenCalledTimes(1);
    expect(listSessionSectionDeletionCandidates).toHaveBeenCalledWith({
      agentTargetId: "codex-target",
      excludePinned: true,
      sectionKey: "conversations",
      workspaceId: "workspace-1"
    });

    act(() => result.current.confirmDeleteConversations(sessionIds));
    await waitFor(() => expect(deleteSessionsBatch).toHaveBeenCalledTimes(1));
    expect(deleteSessionsBatch).toHaveBeenCalledWith({
      sessionIds: ["loaded-session", "unloaded-session"],
      workspaceId: "workspace-1"
    });
    expect(deleteSession).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(input.removeConversations).toHaveBeenCalledWith([
        "loaded-session",
        "unloaded-session"
      ])
    );
  });

  it("refreshes activity and does not delete when the candidate snapshot is empty", async () => {
    const load = vi.fn(async () => ({
      presences: [],
      sessionMessagesById: {},
      sessions: [],
      workspaceId: "workspace-1"
    }));
    const runtime = {
      deleteSessionsBatch: vi.fn(),
      listSessionSectionDeletionCandidates: vi.fn(async () => ({
        excludePinned: true,
        sectionKey: "conversations",
        sessionIds: [],
        workspaceId: "workspace-1"
      })),
      load
    } as unknown as AgentActivityRuntime;
    const { result } = renderHook(() =>
      useAgentGUIConversationBatchDeletion(createInput(runtime))
    );

    let sessionIds: string[] = [];
    await act(async () => {
      sessionIds =
        await result.current.confirmDeleteProjectConversations("conversations");
    });

    expect(sessionIds).toEqual([]);
    await waitFor(() => expect(load).toHaveBeenCalledWith("workspace-1"));
    expect(runtime.deleteSessionsBatch).not.toHaveBeenCalled();
  });
});
