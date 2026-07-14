import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react";
import type { AgentSessionEngine } from "@tutti-os/agent-activity-core";
import type { AgentActivityRuntime } from "../../../agentActivityRuntime";
import type { useAgentHostApi } from "../../../agentActivityHost";
import type { AgentSessionViewRef } from "../../../contexts/workspace/presentation/renderer/agentSessions/useAgentSessionTransport";
import type { AgentGUINodeData } from "../../../types";
import type { AgentGUIConversationSummary } from "../model/agentGuiConversationModel";
import type {
  AgentComposerDraft,
  SubmittedDraftSnapshot
} from "../model/agentGuiNodeTypes";
import { resolveAgentComposerDraftScopeKey } from "../model/agentComposerDraftScope";
import { deleteSubmittedDraftSnapshotsForScopes } from "./agentGuiController.draftMessageHelpers";
import { getAgentGUIErrorMessage } from "./agentGuiController.errors";
import { omitConversationLocalState } from "./agentGuiController.interactiveHelpers";
import {
  reportAgentGUIRuntimeError,
  showAgentGUIControllerErrorToast
} from "./agentGuiController.reporting";
import { type ConversationIntent } from "./useAgentConversationSelection";

export interface UseAgentGUIConversationBatchDeletionInput {
  isDeletingProjectConversations: boolean;
  conversationsRef: RefObject<AgentGUIConversationSummary[]>;
  setDetailError: Dispatch<SetStateAction<string | null>>;
  setListError: Dispatch<SetStateAction<string | null>>;
  deleteAgentSessionView: (ref: AgentSessionViewRef) => void;
  sessionViewRef: (agentSessionId: string | null | undefined) => {
    workspaceId: string;
    agentSessionId: string | null | undefined;
    origin: string;
  };
  setDraftByScopeKey: Dispatch<
    SetStateAction<Record<string, AgentComposerDraft>>
  >;
  submittedDraftSnapshotsRef: RefObject<Record<string, SubmittedDraftSnapshot>>;
  sessionEngine: AgentSessionEngine;
  activeConversationIdRef: RefObject<string | null>;
  markSelectedConversationDetailPending: (
    agentSessionId: string
  ) => string | null;
  setIntent: Dispatch<SetStateAction<ConversationIntent>>;
  setIsLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setActiveConversationId: Dispatch<SetStateAction<string | null>>;
  persistActiveConversation: (agentSessionId: string | null) => void;
  removeConversations: (conversationIds: readonly string[]) => void;
  workspaceId: string;
  setIsDeletingProjectConversations: Dispatch<SetStateAction<boolean>>;
  setAgentSessionViewMessagesLoading: (
    ref: AgentSessionViewRef,
    value: boolean
  ) => void;
  agentActivityRuntime: AgentActivityRuntime;
  dataRef: RefObject<AgentGUINodeData>;
  agentHostApi: ReturnType<typeof useAgentHostApi>;
}

export function useAgentGUIConversationBatchDeletion(
  input: UseAgentGUIConversationBatchDeletionInput
) {
  const {
    isDeletingProjectConversations,
    conversationsRef,
    setDetailError,
    setListError,
    deleteAgentSessionView,
    sessionViewRef,
    setDraftByScopeKey,
    submittedDraftSnapshotsRef,
    sessionEngine,
    activeConversationIdRef,
    markSelectedConversationDetailPending,
    setIntent,
    setIsLoadingMessages,
    setActiveConversationId,
    persistActiveConversation,
    removeConversations,
    workspaceId,
    setIsDeletingProjectConversations,
    setAgentSessionViewMessagesLoading,
    agentActivityRuntime,
    dataRef,
    agentHostApi
  } = input;

  const finalizeConversationBatchDeletion = useCallback(
    (targetIds: Set<string>) => {
      for (const id of targetIds) {
        deleteAgentSessionView(sessionViewRef(id));
      }
      const deletedScopeKeys = new Set(
        [...targetIds].map((agentSessionId) =>
          resolveAgentComposerDraftScopeKey({ agentSessionId })
        )
      );
      setDraftByScopeKey((current) =>
        omitConversationLocalState(current, deletedScopeKeys)
      );
      deleteSubmittedDraftSnapshotsForScopes({
        snapshots: submittedDraftSnapshotsRef.current,
        scopeKeys: deletedScopeKeys,
        targetAgentSessionIds: targetIds
      });
      for (const id of targetIds) {
        sessionEngine.dispatch({
          agentSessionId: id,
          type: "queue/sessionCleaned"
        });
      }
      const nextConversations = conversationsRef.current.filter(
        (conversation) => !targetIds.has(conversation.id)
      );
      const currentActiveId = activeConversationIdRef.current;
      if (currentActiveId && targetIds.has(currentActiveId)) {
        const nextActive = nextConversations[0]?.id ?? null;
        if (nextActive) {
          markSelectedConversationDetailPending(nextActive);
          setIntent({ tag: "active", id: nextActive });
        } else {
          setIsLoadingMessages(false);
          setIntent({ tag: "home" });
        }
        activeConversationIdRef.current = nextActive;
        setActiveConversationId(nextActive);
        persistActiveConversation(nextActive);
      }
      removeConversations([...targetIds]);
    },
    [
      markSelectedConversationDetailPending,
      persistActiveConversation,
      sessionEngine,
      sessionViewRef,
      removeConversations
    ]
  );

  const confirmDeleteProjectConversations = useCallback(
    async (
      sectionKey?: string,
      agentTargetId?: string | null
    ): Promise<string[]> => {
      const normalizedSectionKey = sectionKey?.trim() ?? "";
      const listDeletionCandidates =
        agentActivityRuntime.listSessionSectionDeletionCandidates;
      if (
        !normalizedSectionKey ||
        isDeletingProjectConversations ||
        !listDeletionCandidates
      ) {
        return [];
      }
      setDetailError(null);
      setListError(null);
      try {
        const candidates = await listDeletionCandidates({
          agentTargetId: agentTargetId?.trim() || undefined,
          excludePinned: true,
          sectionKey: normalizedSectionKey,
          workspaceId
        });
        const sessionIds = candidates.sessionIds
          .map((id) => id.trim())
          .filter(Boolean);
        if (sessionIds.length === 0) {
          void agentActivityRuntime.load(workspaceId).catch(() => undefined);
        }
        return [...new Set(sessionIds)];
      } catch (error) {
        const message = getAgentGUIErrorMessage(error);
        reportAgentGUIRuntimeError({
          error,
          phase: "delete_conversation",
          provider: dataRef.current.provider,
          runtime: agentActivityRuntime,
          workspaceId,
          context: { sectionKey: normalizedSectionKey }
        });
        setListError(message);
        showAgentGUIControllerErrorToast(agentHostApi.toast, message);
        return [];
      }
    },
    [
      agentActivityRuntime,
      isDeletingProjectConversations,
      agentHostApi.toast,
      workspaceId
    ]
  );

  const confirmDeleteConversations = useCallback(
    (agentSessionIds: string[]) => {
      if (isDeletingProjectConversations) {
        return;
      }
      const targetIds = new Set(
        agentSessionIds.map((id) => id.trim()).filter((id) => id !== "")
      );
      const deleteSessionsBatch = agentActivityRuntime.deleteSessionsBatch;
      if (targetIds.size === 0 || !deleteSessionsBatch) {
        return;
      }
      setIsDeletingProjectConversations(true);
      setDetailError(null);
      setListError(null);
      const activeDeletedConversationId = activeConversationIdRef.current;
      if (
        activeDeletedConversationId &&
        targetIds.has(activeDeletedConversationId)
      ) {
        setIsLoadingMessages(true);
        setAgentSessionViewMessagesLoading(
          sessionViewRef(activeDeletedConversationId),
          true
        );
      }
      void deleteSessionsBatch({
        sessionIds: [...targetIds],
        workspaceId
      })
        .then((result) => {
          finalizeConversationBatchDeletion(
            new Set([...targetIds, ...result.removedSessionIds])
          );
        })
        .catch((error) => {
          const message = getAgentGUIErrorMessage(error);
          reportAgentGUIRuntimeError({
            error,
            phase: "delete_conversation",
            provider: dataRef.current.provider,
            runtime: agentActivityRuntime,
            workspaceId,
            context: {
              conversationCount: targetIds.size
            }
          });
          setListError(message);
          showAgentGUIControllerErrorToast(agentHostApi.toast, message);
          if (
            activeDeletedConversationId &&
            activeConversationIdRef.current === activeDeletedConversationId
          ) {
            setIsLoadingMessages(false);
            setAgentSessionViewMessagesLoading(
              sessionViewRef(activeDeletedConversationId),
              false
            );
          }
        })
        .finally(() => {
          setIsDeletingProjectConversations(false);
        });
    },
    [
      agentActivityRuntime,
      finalizeConversationBatchDeletion,
      isDeletingProjectConversations,
      sessionViewRef,
      agentHostApi.toast,
      workspaceId
    ]
  );

  return {
    confirmDeleteProjectConversations,
    confirmDeleteConversations
  };
}
