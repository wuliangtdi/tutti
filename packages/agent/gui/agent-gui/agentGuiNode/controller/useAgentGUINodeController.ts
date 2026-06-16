import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@tutti-os/ui-system";
import { translate } from "../../../i18n/index";
import {
  useAgentActivityRuntime,
  useAgentActivitySnapshot
} from "../../../agentActivityRuntime";
import { useAgentHostApi } from "../../../agentActivityHost";
import {
  resolveAgentActivityCapability,
  resolveAgentActivityUsage
} from "@tutti-os/agent-activity-core";
import type { AgentActivitySnapshot } from "@tutti-os/agent-activity-core";
import type { AgentPromptContentBlock } from "../../../shared/contracts/dto";
import type {
  AgentActivityStreamEvent,
  AgentSessionComposerSettings,
  AgentSessionReasoningEffort,
  AgentSessionState
} from "../../../shared/agentSessionTypes";
import { AGENT_PROVIDER_LABEL } from "../../../contexts/settings/domain/agentSettings";
import {
  AGENT_GUI_RUNTIME_SESSION_ORIGIN,
  buildAgentGUIConversationSummaries,
  buildAgentGUIConversationDetail,
  buildAgentGUIConversationVM,
  conversationSummaryFromAgentSession,
  applyAgentGUIConversationProjects,
  mergeAgentGUITimelineItems,
  resolveAgentGUIConversationProject,
  resolveAgentGUIConversationTitleFromTimelineItems,
  selectAgentGUIConversationId,
  type AgentGUIConversationProjectionSource,
  type AgentGUIInteractivePrompt,
  type AgentGUIConversationSummary
} from "../model/agentGuiConversationModel";
import type { AgentHostUserProject } from "../../../host/agentHostApi";
import type {
  AgentGUIComposerSettingsVM,
  AgentGUIProjectConversationDeleteTarget,
  AgentGUIQueuedPromptVM,
  AgentGUISessionChrome,
  OpenclawGatewayViewState
} from "../model/agentGuiNodeTypes";
import { projectCoreSessionStatus } from "../../../shared/agentActivitySnapshotProjection";
import { isWorkspaceAgentUntitledTask } from "../../../shared/workspaceAgentLatestActivitySummary";
import { mergeWorkspaceAgentMessages } from "../../../host/workspaceAgentSessionMessages";
import {
  mergeWorkspaceAgentActivityDurableAndOverlayMessages,
  selectWorkspaceAgentActivityOverlayMessages,
  type WorkspaceAgentActivityMessage,
  type WorkspaceAgentActivityStatePatch,
  type WorkspaceAgentActivitySyncState,
  type WorkspaceAgentActivityTimelineItem
} from "../../../shared/workspaceAgentActivityTypes";
import { useAccountStore } from "../../../host/agentHostAccountStore";
import { subscribeCoalesced } from "../../../host/agentHostEventBus";
import {
  deleteAgentSessionView,
  getAgentSessionView,
  setAgentSessionViewError,
  setAgentSessionViewControlState,
  setAgentSessionViewControlStateLoading,
  setAgentSessionViewOverlayMessages,
  setAgentSessionViewMessagesLoading,
  updateAgentSessionViewControlState
} from "../../../contexts/workspace/presentation/renderer/agentSessions/agentSessionViewStore";
import {
  useAgentSessionDurableRefresh,
  useAgentSessionView,
  useWatchAgentSession,
  useWatchAgentSessions
} from "../../../contexts/workspace/presentation/renderer/agentSessions/useAgentSessionView";
import {
  clearAgentGUIConversationCreatePending,
  clearAgentGUIConversationSubmitPending,
  createAgentGUIConversationListQueryKey,
  ensureAgentGUIConversationListQuery,
  getAgentGUIConversationCreatePending,
  getAgentGUIConversationSubmitPending,
  markAgentGUIConversationCreatePending,
  markAgentGUIConversationSubmitPending,
  markLocalDeletedAgentGUIConversation,
  scheduleAgentGUIConversationListProjection,
  subscribeAgentGUIConversationListStore,
  upsertLocalCreatedAgentGUIConversation,
  updateAgentGUIConversationListConversations,
  type AgentGUIConversationListQuery
} from "../../../contexts/workspace/presentation/renderer/agentGuiConversationList/agentGuiConversationListStore";
import { useAgentGuiConversationList } from "../../../contexts/workspace/presentation/renderer/agentGuiConversationList/useAgentGuiConversationList";
import { useAgentGUIActivation } from "./useAgentGUIActivation";
import { buildAgentComposerSettingsVM } from "./buildAgentComposerSettingsVM";
import { useAgentConversationSelectionState } from "./useAgentConversationSelectionState";
import { useAgentPromptSubmissionState } from "./useAgentPromptSubmissionState";
import { composerSettingsSupportFromOptions } from "../model/composerSettingsSupport";
import {
  PLAN_IMPLEMENTATION_ACTION_FEEDBACK,
  PLAN_IMPLEMENTATION_ACTION_IMPLEMENT,
  PLAN_IMPLEMENTATION_ACTION_SKIP,
  latestPlanTurnId,
  planDecisionOps,
  planImplementationPromptFromPlanTurn
} from "../../../shared/agentConversation/planImplementation";
import {
  INITIAL_USAGE_ALERT_STATE,
  nextUsageAlert,
  type UsageAlertState,
  type UsageAlertTier
} from "../model/agentUsageAlerts";

// Pure helpers live in sibling `agentGuiController.*.ts` files (mechanical split; logic unchanged):
// - constants / types / errors
// - conversationHelpers (list, sync, status)
// - composerHelpers / promptHelpers / planModeHelpers
// - interactiveHelpers / sessionHelpers / reactHelpers / miscHelpers
import {
  ACTIVITY_STREAM_STATE_RELOAD_DEBOUNCE_MS,
  AGENT_RESUME_SESSION_NOT_LOCAL_ERROR,
  EMPTY_AGENT_GUI_AVAILABLE_COMMANDS,
  EMPTY_AGENT_GUI_MESSAGES,
  mergeAgentModelCatalogInvalidationEvents
} from "./agentGuiController.constants";
import type {
  QueuedComposerSettingsUpdate,
  QueuedPromptRetryBlock,
  UseAgentGUINodeControllerInput
} from "./agentGuiController.types";
import {
  agentSessionStatusBusy,
  canSettleBusyConversationFromSessionState,
  conversationBusyStatus,
  conversationHasActiveWork,
  conversationStatusFromSessionState,
  conversationStatusFromStatusValue,
  conversationStatusFromStatePatch,
  conversationStatusFromTimelineItems,
  hasPromptConversationTitle,
  hasSessionControlStatePatch,
  mergeConversationSummaryWithRuntimeSession,
  mergeConversationTitleUpdateFields,
  mergeSessionControlStatePatch,
  mergeVisibleConversations,
  normalizeProjectConversationPath,
  omitConversationLocalState,
  resolveConversationStatusFromTimelineEvidence,
  resolveConversationSummaryById,
  resolveConversationUpdatedAtUnixMsFromSessionState,
  resolveConversationStatusAfterTimelineUpdate,
  runtimeSessionSyncState,
  shouldApplySyncState,
  stableConversationSummaryList,
  syncStateRenderFieldsEqual
} from "./agentGuiController.conversationHelpers";
import {
  cloneComposerSettings,
  composerSupportForProvider,
  mergeRuntimeContextComposerSettings,
  modelSelectionFromComposerOptions,
  nodeDataFromComposerSettings,
  nodeDefaultDraftKey,
  nodeDefaultDraftPromptKey,
  normalizeConfigOptionValue,
  normalizeProjectDraftPath,
  normalizePermissionModeId,
  permissionConfigFromComposerOptions,
  permissionModeOptions,
  providerSkillsFromComposerOptions,
  readNodeDefaultDraftPrompt,
  readNodeDefaultDraftSettings,
  reasoningSelectionFromComposerOptions,
  removeQueuedPromptById,
  resolveEffectiveComposerSettings
} from "./agentGuiController.composerHelpers";
import {
  buildProviderSessionNotFoundActivationError,
  buildResumeSessionNotLocalActivationError,
  buildContinueInNewConversationPrompt,
  cancelBusySource,
  getAgentGUIErrorCode,
  getAgentGUIErrorMessage,
  isAgentSessionActiveTurnConflictError,
  isNonRetryableResumeErrorCode,
  isResumeSessionNotLocalErrorCode,
  isSessionNotFoundErrorCode,
  isSettingsRequireNewSessionErrorCode,
  reportAgentGUICancelDiagnostic,
  reportAgentGUIRuntimeError
} from "./agentGuiController.errors";
import { areAgentGUIUserProjectsEqual } from "./agentGuiController.miscHelpers";
import {
  approvalRequestFromConversation,
  interactiveApprovalFromSessionState,
  interactivePromptFromConversation,
  interactivePromptFromSessionState,
  pendingApprovalFromState,
  pendingInteractiveFromState,
  promptRequestId
} from "./agentGuiController.interactiveHelpers";
import {
  createAgentGUIConversationId,
  createOptimisticPromptMessage,
  normalizeOptionalPrompt,
  normalizeOptionalText,
  normalizePromptContentBlocks,
  projectAgentGUIMessagesToTimelineItems,
  promptContentDisplayText,
  promptContentHasImage,
  recordValue,
  textPromptContent
} from "./agentGuiController.promptHelpers";
import {
  latestPlanModeStateFromTimelineItems,
  planModeStateFromSessionState,
  resolveEffectivePlanModeFromStates
} from "./agentGuiController.planModeHelpers";
import { usePlanModeState } from "./agentGuiController.usePlanModeState";
import {
  useStableComposerSettings,
  useStableControllerEventCallback,
  useStableProviderSkillOptions
} from "./agentGuiController.reactHelpers";
import {
  messageFromMessageUpdate,
  timelineItemTime
} from "./agentGuiController.sessionHelpers";

export {
  resolveConversationStatusAfterTimelineUpdate,
  resolveConversationUpdatedAtUnixMsFromSessionState,
  syncStateRenderFieldsEqual
} from "./agentGuiController.conversationHelpers";
export type { UseAgentGUINodeControllerInput } from "./agentGuiController.types";

export function useAgentGUINodeController({
  nodeId,
  workspaceId,
  currentUserId,
  workspacePath,
  avoidGroupingEdits,
  data,
  previewMode = false,
  onDataChange,
  onShowMessage
}: UseAgentGUINodeControllerInput) {
  const agentActivityRuntime = useAgentActivityRuntime();
  const agentHostApi = useAgentHostApi();
  const agentActivitySnapshot = useAgentActivitySnapshot(workspaceId);
  const conversationListQuery =
    useMemo<AgentGUIConversationListQuery | null>(() => {
      const userId = currentUserId?.trim() ?? "";
      const provider = data.provider?.trim() ?? "";
      if (!workspaceId.trim() || !userId || !provider) {
        return null;
      }
      return {
        workspaceId,
        userId,
        provider: data.provider,
        sessionOrigin: AGENT_GUI_RUNTIME_SESSION_ORIGIN
      };
    }, [currentUserId, data.provider, workspaceId]);
  const conversationListState = useAgentGuiConversationList(
    conversationListQuery
  );
  const conversationSelection = useAgentConversationSelectionState({
    conversationListQuery,
    nodeId,
    initialActiveConversationId: data.lastActiveAgentSessionId,
    initialComposerHome: data.lastActiveAgentSessionId === null
  });
  const {
    activeConversationId,
    setActiveConversationId,
    selectedProjectPath,
    setSelectedProjectPath,
    isComposerHome,
    setIsComposerHome,
    pendingCreateConversationId,
    setPendingCreateConversationId,
    pendingCreateOwnerKey,
    resolvePendingCreateConversationId,
    localIsCreatingConversation,
    setLocalIsCreatingConversation,
    isCreatingConversation
  } = conversationSelection;
  const conversations = conversationListState?.conversations ?? [];
  const [userProjects, setUserProjects] = useState<AgentHostUserProject[]>([]);
  const isNoProjectPath = agentHostApi.userProjects?.isNoProjectPath;
  const [draftBySessionId, setDraftBySessionId] = useState<
    Record<string, string>
  >({});
  const [draftSettingsBySessionId, setDraftSettingsBySessionId] = useState<
    Record<string, AgentSessionComposerSettings>
  >({});
  const promptSubmission = useAgentPromptSubmissionState({
    conversationListQuery,
    activeConversationId
  });
  const {
    activePendingPromptRef,
    drainingQueuedPromptSessionId,
    setDrainingQueuedPromptSessionId,
    failedQueuedPromptIdBySessionId,
    setFailedQueuedPromptIdBySessionId,
    isPendingSubmit,
    setIsPendingSubmit,
    isSubmitting,
    localIsSubmitting,
    setLocalIsSubmitting,
    queuedPromptRetryBlockBySessionId,
    setQueuedPromptRetryBlockBySessionId,
    queuedPromptsBySessionId,
    setQueuedPromptsBySessionId,
    resolvePendingSubmit,
    sendNextQueuedPromptIdBySessionId,
    setSendNextQueuedPromptIdBySessionId
  } = promptSubmission;
  const hasLoadedConversations = conversationListState?.initialized ?? false;
  const isLoadingConversations = conversationListState?.isLoading ?? false;
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isCreatingConversationRef = useRef(isCreatingConversation);
  const [interruptingSessionIds, setInterruptingSessionIds] = useState<
    Record<string, boolean>
  >({});
  const [
    suppressedPromptRequestIdsBySessionId,
    setSuppressedPromptRequestIdsBySessionId
  ] = useState<Record<string, string>>({});
  // Bridges submitInteractivePrompt (defined earlier) to
  // updateComposerSettings (defined later); assigned right after the
  // callback's definition.
  const updateComposerSettingsRef = useRef<
    (nextSettings: Partial<AgentSessionComposerSettings>) => void
  >(() => {});
  // Bridges submitInteractivePrompt (defined earlier) to the client-side plan
  // decision handlers (defined later); assigned after those callbacks.
  const planActionsRef = useRef<{
    implement: () => void;
    feedback: (text: string) => void;
    skip: () => void;
  }>({ implement: () => {}, feedback: () => {}, skip: () => {} });
  const [isRespondingApproval, setIsRespondingApproval] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isDeletingProjectConversations, setIsDeletingProjectConversations] =
    useState(false);
  const updatingSessionSettingsIdsRef = useRef<Record<string, boolean>>({});
  const queuedComposerSettingsUpdatesRef = useRef<
    Record<string, QueuedComposerSettingsUpdate>
  >({});
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<AgentGUIConversationSummary | null>(null);
  const [
    pendingDeleteProjectConversations,
    setPendingDeleteProjectConversations
  ] = useState<AgentGUIProjectConversationDeleteTarget | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statePatchErrorBySessionId, setStatePatchErrorBySessionId] = useState<
    Record<string, string>
  >({});
  const [openclawGateway, setOpenclawGateway] =
    useState<OpenclawGatewayViewState | null>(() =>
      data.provider === "openclaw" ? { status: "starting", error: null } : null
    );
  const sessionViewRef = useCallback(
    (agentSessionId: string | null | undefined) => ({
      workspaceId,
      agentSessionId
    }),
    [workspaceId]
  );
  const activeSessionView = useAgentSessionView(
    sessionViewRef(activeConversationId)
  );
  const activeSessionState = activeSessionView?.controlState ?? null;
  const providerComposerOptions =
    agentActivitySnapshot.composerOptionsByProvider?.[data.provider] ?? null;
  const resolvedPromptImagesSupported = resolveAgentActivityCapability(
    "imageInput",
    {
      composerOptions: providerComposerOptions,
      sessionRuntimeContext: activeSessionState?.runtimeContext
    }
  );
  const promptImagesSupported = resolvedPromptImagesSupported ?? true;
  const compactSupported = resolveAgentActivityCapability("compact", {
    composerOptions: providerComposerOptions,
    sessionRuntimeContext: activeSessionState?.runtimeContext
  });
  const activeSessionRuntimeContext = activeSessionState?.runtimeContext;
  const composerSupport = useMemo(
    () =>
      composerSettingsSupportFromOptions(
        providerComposerOptions,
        activeSessionRuntimeContext ?? null
      ),
    [providerComposerOptions, activeSessionRuntimeContext]
  );
  // Provider-static capability flags used to gate composer-options effects
  // (the options-derived `composerSupport` above can be empty before options
  // load). Kept from the upstream refactor that those effects depend on.
  const supports = composerSupportForProvider(data.provider);
  const usage = useMemo(
    () =>
      resolveAgentActivityUsage({
        sessionRuntimeContext: activeSessionRuntimeContext
      }),
    [activeSessionRuntimeContext]
  );
  const usageAlertStateBySessionIdRef = useRef<Record<string, UsageAlertState>>(
    {}
  );
  const [usageAlertBySessionId, setUsageAlertBySessionId] = useState<
    Record<string, UsageAlertTier>
  >({});
  // Maps a session to the plan turn id whose implement-plan offer was
  // dismissed, so a given plan is offered once while a fresh plan turn
  // (different turn id) re-arms the offer.
  const [dismissedPlanTurnIdBySessionId, setDismissedPlanTurnIdBySessionId] =
    useState<Record<string, string>>({});
  const planImplementationTurnIdRef = useRef<string | null>(null);
  const usagePercentUsed = usage?.percentUsed ?? null;
  useEffect(() => {
    const agentSessionId = activeConversationId;
    if (!agentSessionId) {
      return;
    }
    const previousState =
      usageAlertStateBySessionIdRef.current[agentSessionId] ??
      INITIAL_USAGE_ALERT_STATE;
    const { fire, state } = nextUsageAlert(usagePercentUsed, previousState);
    usageAlertStateBySessionIdRef.current[agentSessionId] = state;
    if (fire) {
      setUsageAlertBySessionId((current) =>
        current[agentSessionId] === fire
          ? current
          : { ...current, [agentSessionId]: fire }
      );
      return;
    }
    if (!state.warned && !state.criticaled) {
      setUsageAlertBySessionId((current) => {
        if (!(agentSessionId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[agentSessionId];
        return next;
      });
    }
  }, [activeConversationId, usagePercentUsed]);
  const usageAlert = activeConversationId
    ? (usageAlertBySessionId[activeConversationId] ?? null)
    : null;
  const dismissUsageAlert = useCallback(() => {
    const agentSessionId = activeConversationId;
    if (!agentSessionId) {
      return;
    }
    setUsageAlertBySessionId((current) => {
      if (!(agentSessionId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[agentSessionId];
      return next;
    });
  }, [activeConversationId]);
  const dismissPlanImplementation = useCallback(() => {
    const agentSessionId = activeConversationIdRef.current;
    const planTurnId = planImplementationTurnIdRef.current;
    if (!agentSessionId || !planTurnId) {
      return;
    }
    setDismissedPlanTurnIdBySessionId((current) =>
      current[agentSessionId] === planTurnId
        ? current
        : { ...current, [agentSessionId]: planTurnId }
    );
  }, []);
  const stableRuntimeSyncStateBySessionIdRef = useRef<
    Record<string, WorkspaceAgentActivitySyncState | undefined>
  >({});
  const latestRuntimeSyncStateBySessionIdRef = useRef<
    Record<string, WorkspaceAgentActivitySyncState | undefined>
  >({});
  const resolveSessionMessages = useCallback(
    (agentSessionId: string | null | undefined) => {
      const normalizedAgentSessionId = agentSessionId?.trim() ?? "";
      if (!normalizedAgentSessionId) {
        return EMPTY_AGENT_GUI_MESSAGES;
      }
      return mergeWorkspaceAgentActivityDurableAndOverlayMessages({
        durableMessages:
          agentActivitySnapshot.sessionMessagesById[normalizedAgentSessionId],
        localMessages:
          getAgentSessionView(sessionViewRef(normalizedAgentSessionId))
            ?.overlayMessages ?? EMPTY_AGENT_GUI_MESSAGES
      });
    },
    [agentActivitySnapshot.sessionMessagesById, sessionViewRef]
  );
  const activeMessages = useMemo(() => {
    return activeConversationId
      ? resolveSessionMessages(activeConversationId)
      : (activeSessionView?.overlayMessages ?? EMPTY_AGENT_GUI_MESSAGES);
  }, [
    activeConversationId,
    activeSessionView?.overlayMessages,
    resolveSessionMessages
  ]);
  const activeTimelineItems = useMemo(
    () => projectAgentGUIMessagesToTimelineItems(activeMessages),
    [activeMessages]
  );
  const runtimeSessionsBySessionId = useMemo(
    () =>
      new Map(
        agentActivitySnapshot.sessions.map((session) => [
          session.agentSessionId.trim(),
          session
        ])
      ),
    [agentActivitySnapshot.sessions]
  );
  const stableRuntimeSyncStateBySessionId = useMemo(() => {
    const next = { ...stableRuntimeSyncStateBySessionIdRef.current };
    const activeSessionIds = new Set<string>();
    for (const session of agentActivitySnapshot.sessions) {
      const agentSessionId = session.agentSessionId.trim();
      if (!agentSessionId) {
        continue;
      }
      activeSessionIds.add(agentSessionId);
      const nextSyncState = runtimeSessionSyncState(session);
      if (!nextSyncState) {
        delete next[agentSessionId];
        delete latestRuntimeSyncStateBySessionIdRef.current[agentSessionId];
        continue;
      }
      const latestSyncState =
        latestRuntimeSyncStateBySessionIdRef.current[agentSessionId];
      if (
        latestSyncState &&
        !shouldApplySyncState(latestSyncState, nextSyncState)
      ) {
        continue;
      }
      latestRuntimeSyncStateBySessionIdRef.current = {
        ...latestRuntimeSyncStateBySessionIdRef.current,
        [agentSessionId]: nextSyncState
      };
      const currentSyncState = next[agentSessionId];
      if (
        !currentSyncState ||
        !syncStateRenderFieldsEqual(currentSyncState, nextSyncState)
      ) {
        next[agentSessionId] = nextSyncState;
      }
    }
    for (const agentSessionId of Object.keys(next)) {
      if (!activeSessionIds.has(agentSessionId)) {
        delete next[agentSessionId];
        delete latestRuntimeSyncStateBySessionIdRef.current[agentSessionId];
      }
    }
    stableRuntimeSyncStateBySessionIdRef.current = next;
    return next;
  }, [agentActivitySnapshot.sessions]);
  const markSessionSettingsRequestState = useCallback(
    (agentSessionId: string, isUpdating: boolean) => {
      if (isUpdating) {
        updatingSessionSettingsIdsRef.current = {
          ...updatingSessionSettingsIdsRef.current,
          [agentSessionId]: true
        };
        return;
      }
      if (!updatingSessionSettingsIdsRef.current[agentSessionId]) {
        return;
      }
      const nextRef = { ...updatingSessionSettingsIdsRef.current };
      delete nextRef[agentSessionId];
      updatingSessionSettingsIdsRef.current = nextRef;
    },
    []
  );
  const backgroundBusyConversationIds = useMemo(
    () =>
      conversations
        .filter(
          (conversation) =>
            conversation.id !== activeConversationId &&
            conversationBusyStatus(conversation.status)
        )
        .map((conversation) => conversation.id),
    [activeConversationId, conversations]
  );
  const [
    retainedBackgroundConversationIds,
    setRetainedBackgroundConversationIds
  ] = useState<string[]>([]);
  useEffect(() => {
    if (previewMode) {
      return;
    }
    setRetainedBackgroundConversationIds((current) => {
      const next = new Set(current);
      for (const conversationId of backgroundBusyConversationIds) {
        next.add(conversationId);
      }
      for (const conversation of conversations) {
        if (
          conversation.id === activeConversationId ||
          conversation.status === "completed" ||
          conversation.status === "failed" ||
          conversation.status === "canceled"
        ) {
          next.delete(conversation.id);
        }
      }
      const nextIds = [...next].sort();
      return nextIds.length === current.length &&
        nextIds.every(
          (conversationId, index) => conversationId === current[index]
        )
        ? current
        : nextIds;
    });
  }, [
    activeConversationId,
    backgroundBusyConversationIds,
    conversations,
    previewMode
  ]);
  const backgroundWatchedConversationIds = useMemo(
    () =>
      previewMode
        ? []
        : [
            ...new Set([
              ...backgroundBusyConversationIds,
              ...retainedBackgroundConversationIds
            ])
          ].sort(),
    [
      backgroundBusyConversationIds,
      previewMode,
      retainedBackgroundConversationIds
    ]
  );
  const accountProfilesByUserId = useAccountStore(
    (state) => state.profilesByUserId
  );
  const ensureAccountProfiles = useAccountStore(
    (state) => state.ensureProfiles
  );
  const activeConversationIdRef = useRef(activeConversationId);
  const selectedProjectPathRef = useRef(selectedProjectPath);
  const userProjectsRef = useRef(userProjects);
  const isNoProjectPathRef = useRef(isNoProjectPath);
  const userProjectsLoadSeqRef = useRef(0);
  const composerOptionsProjectKeyRef = useRef<string | null>(null);
  const conversationsRef = useRef(conversations);
  const isMountedRef = useRef(true);
  const agentActivitySnapshotRef = useRef<AgentActivitySnapshot>(
    agentActivitySnapshot
  );
  const dataRef = useRef(data);
  const draftSettingsBySessionIdRef = useRef(draftSettingsBySessionId);
  const onDataChangeRef = useRef(onDataChange);
  const onShowMessageRef = useRef(onShowMessage);
  const persistedActiveConversationIdRef = useRef(
    data.lastActiveAgentSessionId
  );
  const pendingLocalActiveConversationIdRef = useRef<string | null>(null);
  const externalConversationReloadAttemptRef = useRef<string | null>(null);
  const suppressedHomeConversationIdRef = useRef<string | null>(null);
  const [transientConversation, setTransientConversationState] =
    useState<AgentGUIConversationSummary | null>(null);
  const transientConversationRef = useRef<AgentGUIConversationSummary | null>(
    transientConversation
  );
  const startingConversationIdRef = useRef<string | null>(null);
  const activatedConversationIdsRef = useRef(new Set<string>());
  const failedNewConversationIdsRef = useRef(new Set<string>());
  const pendingTurnIdBySessionIdRef = useRef<Record<string, string>>({});
  const conversationIdsRef = useRef(
    new Set(conversations.map((conversation) => conversation.id))
  );
  const previousConversationListSnapshotRef = useRef<{
    query: AgentGUIConversationListQuery | null;
    conversations: AgentGUIConversationSummary[];
  }>({
    query: null,
    conversations: []
  });
  const activityStreamStateReloadSeqRef = useRef(0);
  const stateReloadTimerRef = useRef<number | null>(null);
  const stateReloadInFlightRef = useRef(false);
  const stateReloadQueuedRef = useRef(false);
  const stateReloadTargetSessionIdRef = useRef<string | null>(null);
  const stateReloadCauseRef = useRef<{
    source: "activity-stream";
    eventType?: string;
    requestId?: number;
  } | null>(null);
  const sessionStateSnapshotCauseBySessionIdRef = useRef<
    Record<
      string,
      | {
          source:
            | "conversation-selected"
            | "activity-stream"
            | "settings-update";
        }
      | undefined
    >
  >({});
  const blockedActivityStreamStateReloadSessionIdsRef = useRef(
    new Set<string>()
  );
  const blockedAutomaticSessionStateLoadSessionIdsRef = useRef(
    new Set<string>()
  );
  const openclawGatewayRequestIdRef = useRef(0);
  const executePromptRef = useRef<
    (
      agentSessionId: string,
      content: AgentPromptContentBlock[],
      queuedPromptId?: string | null
    ) => void
  >(() => {});
  const reloadSelectedConversationRef = useRef<
    (
      agentSessionId: string,
      options: { reloadConversations: boolean; reloadDetail: boolean }
    ) => void
  >(() => {});
  const isComposerHomeRef = useRef(isComposerHome);
  const activation = useAgentGUIActivation({
    workspaceId,
    getErrorMessage: getAgentGUIErrorMessage,
    getErrorCode: getAgentGUIErrorCode
  });
  const activeConversationLiveState = activation.stateFor(activeConversationId);
  const unactivateRef = useRef(activation.unactivate);
  // Daemon clamps reasoning for providers without settings support, so the
  // draft default no longer needs a provider gate here.
  const defaultReasoningEffort: AgentSessionReasoningEffort | null = "high";
  const markFailedLiveState = activation.markFailed;
  const clearFailedLiveState = activation.clearFailure;

  const updateConversationList = useCallback(
    (
      updater: (
        current: AgentGUIConversationSummary[]
      ) => AgentGUIConversationSummary[]
    ) => {
      if (!conversationListQuery) {
        return;
      }
      updateAgentGUIConversationListConversations(
        conversationListQuery,
        updater
      );
    },
    [conversationListQuery]
  );

  const setUserProjectsSnapshot = useCallback(
    (projects: readonly AgentHostUserProject[]) => {
      setUserProjects((current) =>
        areAgentGUIUserProjectsEqual(current, projects)
          ? current
          : [...projects]
      );
    },
    []
  );

  useEffect(() => {
    if (previewMode) {
      return undefined;
    }
    const api = agentHostApi.userProjects;
    let disposed = false;
    const loadUserProjects = async () => {
      const requestSeq = ++userProjectsLoadSeqRef.current;
      if (!api) {
        if (!disposed && requestSeq === userProjectsLoadSeqRef.current) {
          setUserProjectsSnapshot([]);
        }
        return;
      }
      try {
        const result = await api.list();
        if (!disposed && requestSeq === userProjectsLoadSeqRef.current) {
          setUserProjectsSnapshot(result.projects);
        }
      } catch {
        if (!disposed && requestSeq === userProjectsLoadSeqRef.current) {
          setUserProjectsSnapshot([]);
        }
      }
    };
    void loadUserProjects();
    const unsubscribe = api?.subscribe?.(() => {
      void loadUserProjects();
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [agentHostApi.userProjects, previewMode, setUserProjectsSnapshot]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!conversationListQuery || agentActivitySnapshot.sessions.length === 0) {
      return;
    }
    const snapshotConversations = buildAgentGUIConversationSummaries({
      isNoProjectPath,
      snapshot: agentActivitySnapshot,
      provider: data.provider,
      sessionMessagesById: agentActivitySnapshot.sessionMessagesById,
      userProjects
    });
    if (snapshotConversations.length === 0) {
      return;
    }
    updateConversationList((current) => {
      const currentById = new Map(
        current.map((conversation) => [conversation.id, conversation])
      );
      const snapshotIds = new Set(
        snapshotConversations.map((conversation) => conversation.id)
      );
      const merged: AgentGUIConversationSummary[] = snapshotConversations.map(
        (conversation) => {
          const existing = currentById.get(conversation.id);
          if (!existing) {
            return {
              ...conversation,
              hasUnreadCompletion:
                conversation.hasUnreadCompletion ??
                (conversation.status === "completed" &&
                  activeConversationIdRef.current !== conversation.id)
            };
          }
          const titleFields =
            hasPromptConversationTitle(existing) &&
            isWorkspaceAgentUntitledTask(conversation.title)
              ? {
                  title: existing.title,
                  titleFallback: existing.titleFallback
                }
              : mergeConversationTitleUpdateFields(
                  existing,
                  conversation.title
                );
          const incomingWouldSettleBusyStatus =
            conversationBusyStatus(existing.status) &&
            !conversationBusyStatus(conversation.status);
          const shouldKeepExistingStatus =
            existing.updatedAtUnixMs > conversation.updatedAtUnixMs &&
            incomingWouldSettleBusyStatus;
          const status = shouldKeepExistingStatus
            ? existing.status
            : conversation.status;
          const syncState =
            conversation.syncState &&
            shouldApplySyncState(existing.syncState, conversation.syncState) &&
            !syncStateRenderFieldsEqual(
              existing.syncState,
              conversation.syncState
            )
              ? conversation.syncState
              : existing.syncState;
          const hasUnreadCompletion =
            conversation.status === "completed"
              ? activeConversationIdRef.current !== conversation.id
              : (existing.hasUnreadCompletion ?? false);
          return {
            ...existing,
            ...conversation,
            ...titleFields,
            status,
            syncState,
            updatedAtUnixMs: shouldKeepExistingStatus
              ? existing.updatedAtUnixMs
              : titleFields.title === existing.title &&
                  titleFields.titleFallback === existing.titleFallback &&
                  status === existing.status &&
                  syncState === existing.syncState
                ? existing.updatedAtUnixMs
                : conversation.updatedAtUnixMs,
            hasUnreadCompletion
          };
        }
      );
      for (const conversation of current) {
        if (!snapshotIds.has(conversation.id)) {
          merged.push(conversation);
        }
      }
      return applyAgentGUIConversationProjects(merged, userProjects, {
        isNoProjectPath
      });
    });
  }, [
    agentActivitySnapshot,
    conversationListQuery,
    data.provider,
    isNoProjectPath,
    previewMode,
    updateConversationList,
    userProjects
  ]);

  const setTransientConversation = useCallback(
    (
      value:
        | AgentGUIConversationSummary
        | null
        | ((
            current: AgentGUIConversationSummary | null
          ) => AgentGUIConversationSummary | null)
    ): void => {
      const next =
        typeof value === "function"
          ? (
              value as (
                current: AgentGUIConversationSummary | null
              ) => AgentGUIConversationSummary | null
            )(transientConversationRef.current)
          : value;
      if (next === transientConversationRef.current) {
        return;
      }
      transientConversationRef.current = next;
      setTransientConversationState(next);
    },
    []
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }
    updateConversationList((current) =>
      applyAgentGUIConversationProjects(current, userProjects, {
        isNoProjectPath
      })
    );
    setTransientConversation((current) =>
      current
        ? (applyAgentGUIConversationProjects([current], userProjects, {
            isNoProjectPath
          })[0] ?? current)
        : current
    );
  }, [
    conversations,
    isNoProjectPath,
    previewMode,
    setTransientConversation,
    updateConversationList,
    userProjects
  ]);

  const ensureOpenclawGateway = useCallback(() => {
    if (dataRef.current.provider !== "openclaw") {
      setOpenclawGateway(null);
      return;
    }
    const requestId = ++openclawGatewayRequestIdRef.current;
    const warmup = agentActivityRuntime.warmupOpenclawGateway;
    setOpenclawGateway({ status: "starting", error: null });
    if (typeof warmup !== "function") {
      setOpenclawGateway({
        status: "failed",
        error: null
      });
      return;
    }
    void warmup()
      .then(() => {
        if (
          !isMountedRef.current ||
          requestId !== openclawGatewayRequestIdRef.current
        ) {
          return;
        }
        setOpenclawGateway({ status: "ready", error: null });
      })
      .catch((error: unknown) => {
        if (
          !isMountedRef.current ||
          requestId !== openclawGatewayRequestIdRef.current
        ) {
          return;
        }
        setOpenclawGateway({
          status: "failed",
          error: getAgentGUIErrorMessage(error)
        });
        reportAgentGUIRuntimeError({
          error,
          phase: "warmup_openclaw_gateway",
          provider: dataRef.current.provider,
          runtime: agentActivityRuntime,
          workspaceId
        });
      });
  }, [agentActivityRuntime, workspaceId]);

  useEffect(() => {
    agentActivitySnapshotRef.current = agentActivitySnapshot;
  }, [agentActivitySnapshot]);

  useEffect(() => {
    dataRef.current = data;
    persistedActiveConversationIdRef.current = data.lastActiveAgentSessionId;
    if (
      pendingLocalActiveConversationIdRef.current ===
      data.lastActiveAgentSessionId
    ) {
      pendingLocalActiveConversationIdRef.current = null;
    }
  }, [data]);

  useEffect(() => {
    isComposerHomeRef.current = isComposerHome;
  }, [isComposerHome]);

  useEffect(() => {
    isCreatingConversationRef.current = isCreatingConversation;
  }, [isCreatingConversation]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    setPendingCreateConversationId(resolvePendingCreateConversationId());
    if (!conversationListQuery || !pendingCreateOwnerKey) {
      return;
    }
    return subscribeAgentGUIConversationListStore(() => {
      setPendingCreateConversationId(resolvePendingCreateConversationId());
    });
  }, [
    conversationListQuery,
    pendingCreateOwnerKey,
    previewMode,
    resolvePendingCreateConversationId
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    setIsPendingSubmit(resolvePendingSubmit());
    if (!conversationListQuery || activeConversationId === null) {
      return;
    }
    return subscribeAgentGUIConversationListStore(() => {
      setIsPendingSubmit(resolvePendingSubmit());
    });
  }, [
    activeConversationId,
    conversationListQuery,
    previewMode,
    resolvePendingSubmit
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    ensureOpenclawGateway();
  }, [data.provider, ensureOpenclawGateway, previewMode]);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    onShowMessageRef.current = onShowMessage;
  }, [onShowMessage]);

  useEffect(() => {
    draftSettingsBySessionIdRef.current = draftSettingsBySessionId;
  }, [draftSettingsBySessionId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    selectedProjectPathRef.current = selectedProjectPath;
  }, [selectedProjectPath]);

  useEffect(() => {
    userProjectsRef.current = userProjects;
  }, [userProjects]);

  useEffect(() => {
    isNoProjectPathRef.current = isNoProjectPath;
  }, [isNoProjectPath]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    unactivateRef.current = activation.unactivate;
  }, [activation.unactivate]);

  useEffect(() => {
    conversationIdsRef.current = new Set(
      conversations.map((conversation) => conversation.id)
    );
  }, [conversations]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    const previousSnapshot = previousConversationListSnapshotRef.current;
    const previousQuery = previousSnapshot.query;
    const previousQueryKey = previousQuery
      ? createAgentGUIConversationListQueryKey(previousQuery)
      : null;
    const nextQueryKey = conversationListQuery
      ? createAgentGUIConversationListQueryKey(conversationListQuery)
      : null;
    if (
      previousQuery &&
      conversationListQuery &&
      previousQueryKey !== nextQueryKey &&
      previousQuery.workspaceId === conversationListQuery.workspaceId &&
      previousQuery.provider === conversationListQuery.provider &&
      previousQuery.sessionOrigin === conversationListQuery.sessionOrigin &&
      previousSnapshot.conversations.length > 0
    ) {
      ensureAgentGUIConversationListQuery(conversationListQuery);
      updateAgentGUIConversationListConversations(
        conversationListQuery,
        (current) =>
          current.length === 0 ? previousSnapshot.conversations : current
      );
    }
    previousConversationListSnapshotRef.current = {
      query: conversationListQuery,
      conversations
    };
  }, [conversationListQuery, conversations, previewMode]);
  const persistActiveConversation = useCallback(
    (agentSessionId: string | null) => {
      if (persistedActiveConversationIdRef.current === agentSessionId) {
        return;
      }
      pendingLocalActiveConversationIdRef.current = agentSessionId;
      persistedActiveConversationIdRef.current = agentSessionId;
      onDataChangeRef.current((current) =>
        current.lastActiveAgentSessionId === agentSessionId
          ? current
          : { ...current, lastActiveAgentSessionId: agentSessionId }
      );
    },
    []
  );
  const updateSelectedProjectPath = useCallback(
    (
      path: string | null,
      metadata?: { action: "clear" | "create_new" | "select_existing" }
    ) => {
      const normalizedPath = normalizeProjectDraftPath(path);
      selectedProjectPathRef.current = normalizedPath;
      setSelectedProjectPath(normalizedPath);
      const agentSessionId = activeConversationIdRef.current;
      if (!agentSessionId || !metadata) {
        return;
      }
      const tracking = agentActivityRuntime.trackSettingsProjectChange?.({
        action: metadata.action,
        agentSessionId,
        provider: dataRef.current.provider,
        workspaceId
      });
      void tracking?.catch(() => {});
    },
    [agentActivityRuntime, workspaceId]
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!hasLoadedConversations) {
      return;
    }
    const nextConversationCount = mergeVisibleConversations(
      conversations,
      transientConversationRef.current
    ).length;
    onDataChangeRef.current((current) =>
      current.conversationCount === nextConversationCount
        ? current
        : { ...current, conversationCount: nextConversationCount }
    );
  }, [
    conversations.length,
    hasLoadedConversations,
    previewMode,
    transientConversation
  ]);

  const isCurrentConversation = useCallback((agentSessionId: string) => {
    return (
      isMountedRef.current &&
      activeConversationIdRef.current === agentSessionId.trim()
    );
  }, []);

  const unactivateIfStale = useCallback(
    (agentSessionId: string) => {
      const normalized = agentSessionId.trim();
      if (!normalized || isCurrentConversation(normalized)) {
        return false;
      }
      void activation.unactivate(normalized);
      return true;
    },
    [activation, isCurrentConversation]
  );

  const selectConversation = useCallback(
    (agentSessionId: string, options?: { reloadConversations?: boolean }) => {
      const normalized = agentSessionId.trim();
      if (!normalized) {
        return;
      }
      const previous = activeConversationIdRef.current;
      isComposerHomeRef.current = false;
      setIsComposerHome(false);
      const pendingNewConversationId = startingConversationIdRef.current;
      if (previous && previous !== normalized) {
        activatedConversationIdsRef.current.delete(previous);
        void activation.unactivate(previous);
      }
      if (pendingNewConversationId && pendingNewConversationId !== normalized) {
        activatedConversationIdsRef.current.delete(pendingNewConversationId);
        void activation.unactivate(pendingNewConversationId);
      }
      if (suppressedHomeConversationIdRef.current === normalized) {
        suppressedHomeConversationIdRef.current = null;
      }
      const shouldReloadConversations =
        options?.reloadConversations !== false &&
        conversationIdsRef.current.has(normalized);
      activeConversationIdRef.current = normalized;
      setActiveConversationId(normalized);
      setDetailError(null);
      if (previous !== normalized && shouldReloadConversations) {
        reloadSelectedConversationRef.current(normalized, {
          reloadConversations: true,
          reloadDetail: false
        });
      } else if (previous === normalized) {
        reloadSelectedConversationRef.current(normalized, {
          reloadConversations: shouldReloadConversations,
          reloadDetail: true
        });
      }
      updateConversationList((current) =>
        current.map((conversation) =>
          conversation.id === normalized
            ? { ...conversation, hasUnreadCompletion: false }
            : conversation
        )
      );
      if (transientConversationRef.current?.id === normalized) {
        setTransientConversation((current) =>
          current?.id === normalized
            ? { ...current, hasUnreadCompletion: false }
            : current
        );
      }
      persistActiveConversation(normalized);
    },
    [activation, persistActiveConversation]
  );

  const syncConversationListProjection = useCallback(
    async (_preferredSessionId?: string | null) => {
      if (!conversationListQuery) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        persistActiveConversation(null);
        return;
      }
      ensureAgentGUIConversationListQuery(conversationListQuery);
      scheduleAgentGUIConversationListProjection(
        conversationListQuery,
        "projection-sync"
      );
    },
    [conversationListQuery, persistActiveConversation]
  );

  useEffect(() => {
    const requestedConversationId = data.lastActiveAgentSessionId?.trim() ?? "";
    const requestedConversationExists =
      requestedConversationId !== ""
        ? resolveConversationSummaryById(
            conversations,
            requestedConversationId,
            transientConversationRef.current
          ) !== null
        : false;
    if (!requestedConversationId) {
      externalConversationReloadAttemptRef.current = null;
      suppressedHomeConversationIdRef.current = null;
      return;
    }
    if (
      requestedConversationId === activeConversationIdRef.current &&
      (!hasLoadedConversations || requestedConversationExists)
    ) {
      externalConversationReloadAttemptRef.current = null;
      return;
    }
    if (suppressedHomeConversationIdRef.current === requestedConversationId) {
      return;
    }
    if (
      pendingLocalActiveConversationIdRef.current !== null &&
      requestedConversationId !== pendingLocalActiveConversationIdRef.current &&
      externalConversationReloadAttemptRef.current !== requestedConversationId
    ) {
      return;
    }

    if (!requestedConversationExists) {
      if (
        requestedConversationId === activeConversationIdRef.current &&
        hasLoadedConversations &&
        conversations.length > 0
      ) {
        externalConversationReloadAttemptRef.current = null;
        const fallbackConversationId = selectAgentGUIConversationId(
          conversations,
          activeConversationIdRef.current
        );
        if (fallbackConversationId) {
          selectConversation(fallbackConversationId, {
            reloadConversations: false
          });
        }
        return;
      }
      if (
        hasLoadedConversations &&
        externalConversationReloadAttemptRef.current !== requestedConversationId
      ) {
        externalConversationReloadAttemptRef.current = requestedConversationId;
        void syncConversationListProjection(requestedConversationId);
        return;
      }
      if (
        hasLoadedConversations &&
        !isLoadingConversations &&
        externalConversationReloadAttemptRef.current === requestedConversationId
      ) {
        externalConversationReloadAttemptRef.current = null;
        const fallbackConversationId =
          isComposerHomeRef.current && !requestedConversationId
            ? null
            : selectAgentGUIConversationId(
                conversations,
                activeConversationIdRef.current
              );
        if (fallbackConversationId) {
          selectConversation(fallbackConversationId, {
            reloadConversations: false
          });
        }
      }
      return;
    }

    externalConversationReloadAttemptRef.current = null;
    selectConversation(requestedConversationId, { reloadConversations: false });
  }, [
    conversations,
    data.lastActiveAgentSessionId,
    hasLoadedConversations,
    isLoadingConversations,
    syncConversationListProjection,
    selectConversation,
    transientConversation
  ]);

  const refreshMessagesFromSnapshot = useCallback(
    (agentSessionId: string) => {
      const normalizedAgentSessionId = agentSessionId.trim();
      if (!normalizedAgentSessionId) {
        return;
      }
      setDetailError(null);
      setAgentSessionViewError(sessionViewRef(normalizedAgentSessionId), null);
      const durableMessages = mergeWorkspaceAgentMessages(
        [],
        agentActivitySnapshotRef.current.sessionMessagesById[
          normalizedAgentSessionId
        ] ?? []
      );
      const durableItems =
        projectAgentGUIMessagesToTimelineItems(durableMessages);
      const pendingTurnId =
        pendingTurnIdBySessionIdRef.current[normalizedAgentSessionId];
      if (
        pendingTurnId &&
        durableItems.some(
          (item) =>
            item.role === "user" && item.turnId?.trim() === pendingTurnId
        )
      ) {
        const nextPending = { ...pendingTurnIdBySessionIdRef.current };
        delete nextPending[normalizedAgentSessionId];
        pendingTurnIdBySessionIdRef.current = nextPending;
      }
      const localMessages =
        getAgentSessionView(sessionViewRef(normalizedAgentSessionId))
          ?.overlayMessages ?? [];
      const overlayMessages = selectWorkspaceAgentActivityOverlayMessages({
        durableMessages,
        localMessages
      });
      const mergedMessages = mergeWorkspaceAgentMessages(
        durableMessages,
        overlayMessages
      );
      const mergedItems =
        projectAgentGUIMessagesToTimelineItems(mergedMessages);
      setAgentSessionViewOverlayMessages(
        sessionViewRef(normalizedAgentSessionId),
        overlayMessages
      );
      const sessionState =
        getAgentSessionView(sessionViewRef(normalizedAgentSessionId))
          ?.controlState ?? null;
      const incomingTimelineStatus =
        conversationStatusFromTimelineItems(durableItems);
      const mergedTimelineStatus = incomingTimelineStatus
        ? conversationStatusFromTimelineItems([...mergedItems])
        : null;
      updateConversationList((current) => {
        const previous =
          current.find(
            (conversation) => conversation.id === normalizedAgentSessionId
          ) ?? null;
        if (!previous) {
          return current;
        }
        const title = resolveAgentGUIConversationTitleFromTimelineItems({
          timelineItems: mergedItems,
          conversation: previous
        });
        const settledStatus = resolveConversationStatusAfterTimelineUpdate({
          currentStatus: previous.status,
          incomingTimelineStatus: mergedTimelineStatus,
          sessionState,
          timelineItems: mergedItems
        });
        if (
          (!title || title.title === previous.title) &&
          settledStatus === previous.status
        ) {
          return current;
        }
        return current.map((conversation) =>
          conversation.id === normalizedAgentSessionId
            ? {
                ...conversation,
                ...(title
                  ? {
                      title: title.title,
                      titleFallback: title.titleFallback
                    }
                  : {}),
                status: settledStatus
              }
            : conversation
        );
      });
      if (activeConversationIdRef.current === normalizedAgentSessionId) {
        setIsLoadingMessages(false);
      }
      setAgentSessionViewMessagesLoading(
        sessionViewRef(normalizedAgentSessionId),
        false
      );
    },
    [agentActivityRuntime, sessionViewRef, updateConversationList, workspaceId]
  );

  const applySessionStateSnapshot = useCallback(
    (
      snapshot: AgentSessionState,
      cause?: {
        source: "conversation-selected" | "activity-stream" | "settings-update";
      }
    ) => {
      const agentSessionId = snapshot.agentSessionId.trim();
      if (!agentSessionId) {
        return;
      }
      const nextStatus = conversationStatusFromSessionState(snapshot);
      const runtimeTitle =
        snapshot.runtimeContext &&
        typeof snapshot.runtimeContext === "object" &&
        "title" in snapshot.runtimeContext
          ? (snapshot.runtimeContext as { title?: unknown }).title
          : undefined;
      const title = typeof runtimeTitle === "string" ? runtimeTitle.trim() : "";
      const updatedAtUnixMs = snapshot.updatedAtUnixMs ?? Date.now();
      const shouldAdvanceConversationUpdatedAt =
        cause?.source !== "conversation-selected";
      if (!nextStatus && !title) {
        return;
      }
      updateConversationList((current) =>
        current.map((conversation) => {
          if (conversation.id !== agentSessionId) {
            return conversation;
          }
          const timelineItems = projectAgentGUIMessagesToTimelineItems(
            resolveSessionMessages(agentSessionId)
          );
          const canSettleBusyStatus = canSettleBusyConversationFromSessionState(
            {
              timelineItems,
              syncState: conversation.syncState
            }
          );
          const incomingWouldSettleBusyStatus =
            nextStatus !== null &&
            conversationBusyStatus(conversation.status) &&
            !conversationBusyStatus(nextStatus);
          const shouldKeepCurrentStatus =
            nextStatus !== null &&
            conversation.updatedAtUnixMs > updatedAtUnixMs &&
            (!incomingWouldSettleBusyStatus || !canSettleBusyStatus);
          const candidateStatus = shouldKeepCurrentStatus
            ? conversation.status
            : (nextStatus ?? conversation.status);
          const status = resolveConversationStatusFromTimelineEvidence({
            status: candidateStatus,
            timelineItems
          });
          const titleFields = mergeConversationTitleUpdateFields(
            conversation,
            title
          );
          const nextConversation = {
            ...conversation,
            ...titleFields,
            status,
            updatedAtUnixMs: resolveConversationUpdatedAtUnixMsFromSessionState(
              {
                currentUpdatedAtUnixMs: conversation.updatedAtUnixMs,
                snapshotUpdatedAtUnixMs: shouldAdvanceConversationUpdatedAt
                  ? snapshot.updatedAtUnixMs
                  : undefined,
                source: cause?.source
              }
            ),
            hasUnreadCompletion:
              status === "completed" &&
              activeConversationIdRef.current !== agentSessionId
          };
          return nextConversation;
        })
      );
      const transient = transientConversationRef.current;
      if (transient?.id === agentSessionId) {
        const timelineItems = projectAgentGUIMessagesToTimelineItems(
          resolveSessionMessages(agentSessionId)
        );
        const canSettleBusyStatus = canSettleBusyConversationFromSessionState({
          timelineItems,
          syncState: transient.syncState
        });
        const incomingWouldSettleBusyStatus =
          nextStatus !== null &&
          conversationBusyStatus(transient.status) &&
          !conversationBusyStatus(nextStatus);
        const candidateTransientStatus =
          nextStatus !== null &&
          transient.updatedAtUnixMs > updatedAtUnixMs &&
          (!incomingWouldSettleBusyStatus || !canSettleBusyStatus)
            ? transient.status
            : (nextStatus ?? transient.status);
        const transientStatus = resolveConversationStatusFromTimelineEvidence({
          status: candidateTransientStatus,
          timelineItems
        });
        const transientTitleFields = mergeConversationTitleUpdateFields(
          transient,
          title
        );
        setTransientConversation({
          ...transient,
          ...transientTitleFields,
          status: transientStatus,
          updatedAtUnixMs: resolveConversationUpdatedAtUnixMsFromSessionState({
            currentUpdatedAtUnixMs: transient.updatedAtUnixMs,
            snapshotUpdatedAtUnixMs: shouldAdvanceConversationUpdatedAt
              ? snapshot.updatedAtUnixMs
              : undefined,
            source: cause?.source
          }),
          hasUnreadCompletion:
            transientStatus === "completed" &&
            activeConversationIdRef.current !== agentSessionId
        });
      }
    },
    [sessionViewRef, setTransientConversation]
  );

  useEffect(() => {
    const snapshot = activeSessionView?.controlState ?? null;
    const agentSessionId = activeConversationId?.trim();
    if (
      !snapshot ||
      !agentSessionId ||
      snapshot.agentSessionId.trim() !== agentSessionId
    ) {
      return;
    }
    const cause =
      sessionStateSnapshotCauseBySessionIdRef.current[agentSessionId];
    if (cause) {
      const next = { ...sessionStateSnapshotCauseBySessionIdRef.current };
      delete next[agentSessionId];
      sessionStateSnapshotCauseBySessionIdRef.current = next;
      applySessionStateSnapshot(snapshot, cause);
      return;
    }
    applySessionStateSnapshot(snapshot);
  }, [
    activeConversationId,
    activeSessionView?.controlState,
    applySessionStateSnapshot
  ]);

  const loadSessionState = useCallback(
    async (
      agentSessionId: string,
      cause?: {
        source: "conversation-selected" | "activity-stream" | "settings-update";
        eventType?: string;
        requestId?: number;
        force?: boolean;
        allowInactive?: boolean;
      }
    ) => {
      if (
        blockedAutomaticSessionStateLoadSessionIdsRef.current.has(
          agentSessionId
        ) &&
        cause?.force !== true
      ) {
        return;
      }
      if (
        getAgentSessionView(sessionViewRef(agentSessionId))
          ?.isLoadingControlState &&
        cause?.force !== true
      ) {
        return;
      }
      try {
        setAgentSessionViewControlStateLoading(
          sessionViewRef(agentSessionId),
          true
        );
        setAgentSessionViewError(sessionViewRef(agentSessionId), null);
        const snapshot = await agentActivityRuntime.getSessionControlState({
          workspaceId,
          agentSessionId
        });
        if (
          !isMountedRef.current ||
          (cause?.allowInactive !== true &&
            activeConversationIdRef.current !== agentSessionId)
        ) {
          return;
        }
        clearFailedLiveState(agentSessionId);
        blockedActivityStreamStateReloadSessionIdsRef.current.delete(
          agentSessionId
        );
        blockedAutomaticSessionStateLoadSessionIdsRef.current.delete(
          agentSessionId
        );
        sessionStateSnapshotCauseBySessionIdRef.current = {
          ...sessionStateSnapshotCauseBySessionIdRef.current,
          [agentSessionId]: cause ? { source: cause.source } : undefined
        };
        setAgentSessionViewControlState(
          sessionViewRef(agentSessionId),
          snapshot
        );
      } catch (error) {
        if (
          !isMountedRef.current ||
          (cause?.allowInactive !== true &&
            activeConversationIdRef.current !== agentSessionId)
        ) {
          return;
        }
        const errorCode = getAgentGUIErrorCode(error);
        reportAgentGUIRuntimeError({
          agentSessionId,
          context: {
            cause: cause?.source ?? null,
            eventType: cause?.eventType ?? null,
            force: cause?.force === true
          },
          error,
          phase: "load_session_state",
          provider: dataRef.current.provider,
          requestId: cause?.requestId ?? null,
          runtime: agentActivityRuntime,
          workspaceId
        });
        setAgentSessionViewError(
          sessionViewRef(agentSessionId),
          getAgentGUIErrorMessage(error)
        );
        if (isNonRetryableResumeErrorCode(errorCode)) {
          markFailedLiveState(agentSessionId, error);
          blockedActivityStreamStateReloadSessionIdsRef.current.add(
            agentSessionId
          );
        }
        if (isResumeSessionNotLocalErrorCode(errorCode)) {
          blockedAutomaticSessionStateLoadSessionIdsRef.current.add(
            agentSessionId
          );
        }
        if (isSessionNotFoundErrorCode(errorCode)) {
          blockedActivityStreamStateReloadSessionIdsRef.current.add(
            agentSessionId
          );
          blockedAutomaticSessionStateLoadSessionIdsRef.current.add(
            agentSessionId
          );
          if (conversationListQuery) {
            markLocalDeletedAgentGUIConversation({
              query: conversationListQuery,
              agentSessionId
            });
            scheduleAgentGUIConversationListProjection(
              conversationListQuery,
              "local-delete"
            );
          }
          deleteAgentSessionView(sessionViewRef(agentSessionId));
          suppressedHomeConversationIdRef.current = agentSessionId;
          isComposerHomeRef.current = true;
          setIsComposerHome(true);
          activeConversationIdRef.current = null;
          setActiveConversationId(null);
          setIsLoadingMessages(false);
          setDetailError(null);
          persistActiveConversation(null);
          updateConversationList((current) =>
            current.filter((conversation) => conversation.id !== agentSessionId)
          );
        }
        if (isSessionNotFoundErrorCode(errorCode)) {
          setAgentSessionViewControlState(sessionViewRef(agentSessionId), null);
        }
      } finally {
        setAgentSessionViewControlStateLoading(
          sessionViewRef(agentSessionId),
          false
        );
      }
    },
    [
      applySessionStateSnapshot,
      clearFailedLiveState,
      markFailedLiveState,
      persistActiveConversation,
      workspaceId,
      sessionViewRef
    ]
  );

  const reloadSelectedConversation = useCallback(
    (
      agentSessionId: string,
      options: { reloadConversations: boolean; reloadDetail: boolean }
    ) => {
      if (!agentSessionId) {
        return;
      }
      if (failedNewConversationIdsRef.current.has(agentSessionId)) {
        return;
      }
      if (startingConversationIdRef.current === agentSessionId) {
        return;
      }
      if (options.reloadConversations) {
        void syncConversationListProjection(agentSessionId);
      }
      if (options.reloadDetail) {
        void refreshMessagesFromSnapshot(agentSessionId);
        void loadSessionState(agentSessionId, {
          source: "conversation-selected"
        });
      }
    },
    [
      syncConversationListProjection,
      refreshMessagesFromSnapshot,
      loadSessionState
    ]
  );

  useEffect(() => {
    reloadSelectedConversationRef.current = reloadSelectedConversation;
  }, [reloadSelectedConversation]);

  const loadDraftComposerOptions = useCallback(
    (options?: { force?: boolean }): void => {
      // Composer options are loaded for every provider: besides settings they
      // carry the capabilities fallback and the skills list.
      const provider = dataRef.current.provider;
      if (isCreatingConversationRef.current) {
        return;
      }
      const settings = readNodeDefaultDraftSettings({
        data: dataRef.current,
        defaultReasoningEffort,
        drafts: draftSettingsBySessionIdRef.current
      });
      void Promise.resolve(
        agentActivityRuntime.getComposerOptions({
          workspaceId,
          cwd: selectedProjectPathRef.current ?? "",
          force: options?.force,
          provider,
          settings
        })
      ).catch(() => undefined);
    },
    [agentActivityRuntime, defaultReasoningEffort, workspaceId]
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!supports.model && !supports.reasoning && !supports.permission) {
      return;
    }
    const projectKey = `${data.provider}\0${selectedProjectPath ?? ""}`;
    const previousProjectKey = composerOptionsProjectKeyRef.current;
    composerOptionsProjectKeyRef.current = projectKey;
    if (previousProjectKey === null || previousProjectKey === projectKey) {
      return;
    }
    loadDraftComposerOptions({ force: true });
  }, [
    data.provider,
    loadDraftComposerOptions,
    previewMode,
    selectedProjectPath,
    supports.model,
    supports.permission,
    supports.reasoning
  ]);

  useEffect(() => {
    if (previewMode) {
      return undefined;
    }
    if (!supports.model && !supports.reasoning && !supports.permission) {
      return undefined;
    }
    return subscribeCoalesced(
      "agent-model-catalog-invalidated",
      {
        delayMs: 150,
        key: () => "agent-model-catalog-invalidated",
        merge: mergeAgentModelCatalogInvalidationEvents
      },
      (event) => {
        const provider = dataRef.current.provider;
        const currentActiveConversationId = activeConversationIdRef.current;
        if (!event.providers.includes(provider)) {
          return;
        }
        loadDraftComposerOptions({ force: true });
        if (currentActiveConversationId === null && isComposerHomeRef.current) {
          return;
        }
        if (!currentActiveConversationId) {
          return;
        }
        void loadSessionState(currentActiveConversationId, {
          source: "settings-update",
          force: true
        });
      }
    );
  }, [
    loadDraftComposerOptions,
    loadSessionState,
    previewMode,
    workspaceId,
    supports.model,
    supports.permission,
    supports.reasoning
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    loadDraftComposerOptions();
  }, [
    activeConversationId,
    data.provider,
    isComposerHome,
    loadDraftComposerOptions,
    previewMode
  ]);

  const clearPendingSessionStateReload = useCallback(() => {
    if (stateReloadTimerRef.current !== null) {
      window.clearTimeout(stateReloadTimerRef.current);
      stateReloadTimerRef.current = null;
    }
    stateReloadQueuedRef.current = false;
    stateReloadTargetSessionIdRef.current = null;
    stateReloadCauseRef.current = null;
  }, []);

  const scheduleActivityStreamStateReload = useCallback(
    (
      agentSessionId: string,
      cause: {
        source: "activity-stream";
        eventType?: string;
        requestId?: number;
      }
    ) => {
      if (
        blockedActivityStreamStateReloadSessionIdsRef.current.has(
          agentSessionId
        )
      ) {
        return;
      }
      stateReloadTargetSessionIdRef.current = agentSessionId;
      stateReloadCauseRef.current = cause;
      if (stateReloadInFlightRef.current) {
        stateReloadQueuedRef.current = true;
        return;
      }
      if (stateReloadTimerRef.current !== null) {
        return;
      }
      stateReloadTimerRef.current = window.setTimeout(() => {
        stateReloadTimerRef.current = null;
        const targetSessionId = stateReloadTargetSessionIdRef.current;
        const pendingCause = stateReloadCauseRef.current;
        stateReloadTargetSessionIdRef.current = null;
        stateReloadCauseRef.current = null;
        if (
          !targetSessionId ||
          !pendingCause ||
          blockedActivityStreamStateReloadSessionIdsRef.current.has(
            targetSessionId
          ) ||
          activeConversationIdRef.current !== targetSessionId ||
          !isMountedRef.current
        ) {
          stateReloadQueuedRef.current = false;
          return;
        }
        stateReloadInFlightRef.current = true;
        void loadSessionState(targetSessionId, {
          ...pendingCause
        }).finally(() => {
          stateReloadInFlightRef.current = false;
          if (
            stateReloadQueuedRef.current &&
            activeConversationIdRef.current === targetSessionId &&
            isMountedRef.current
          ) {
            stateReloadQueuedRef.current = false;
            scheduleActivityStreamStateReload(targetSessionId, {
              source: "activity-stream",
              eventType: pendingCause.eventType,
              requestId: pendingCause.requestId
            });
            return;
          }
          stateReloadQueuedRef.current = false;
        });
      }, ACTIVITY_STREAM_STATE_RELOAD_DEBOUNCE_MS);
    },
    [loadSessionState]
  );

  const applyTimelineProjectionUpdate = useCallback(
    (
      agentSessionId: string,
      nextItems: readonly WorkspaceAgentActivityTimelineItem[],
      mergedItems?: readonly WorkspaceAgentActivityTimelineItem[]
    ) => {
      if (nextItems.length === 0) {
        return;
      }
      const merged =
        mergedItems ??
        projectAgentGUIMessagesToTimelineItems(
          resolveSessionMessages(agentSessionId)
        ) ??
        mergeAgentGUITimelineItems([], nextItems);
      const sessionState =
        getAgentSessionView(sessionViewRef(agentSessionId))?.controlState ??
        null;
      const incomingStatus = conversationStatusFromTimelineItems(nextItems);
      const nextStatus = incomingStatus
        ? conversationStatusFromTimelineItems([...merged])
        : null;
      if (nextStatus || sessionState) {
        const updatedAtUnixMs = Math.max(...nextItems.map(timelineItemTime));
        updateConversationList((current) =>
          current.map((conversation) =>
            conversation.id === agentSessionId
              ? (() => {
                  const status = resolveConversationStatusAfterTimelineUpdate({
                    currentStatus: conversation.status,
                    incomingTimelineStatus: nextStatus,
                    sessionState,
                    timelineItems: merged
                  });
                  return {
                    ...conversation,
                    status,
                    updatedAtUnixMs: Math.max(
                      conversation.updatedAtUnixMs,
                      updatedAtUnixMs
                    ),
                    hasUnreadCompletion: false
                  };
                })()
              : conversation
          )
        );
        const transient = transientConversationRef.current;
        if (transient?.id === agentSessionId) {
          const status = resolveConversationStatusAfterTimelineUpdate({
            currentStatus: transient.status,
            incomingTimelineStatus: nextStatus,
            sessionState,
            timelineItems: merged
          });
          setTransientConversation({
            ...transient,
            status,
            updatedAtUnixMs: Math.max(
              transient.updatedAtUnixMs,
              updatedAtUnixMs
            ),
            hasUnreadCompletion: false
          });
        }
      }
    },
    [resolveSessionMessages, sessionViewRef, setTransientConversation]
  );

  const applyBackgroundTimelineStatusUpdate = useCallback(
    (
      agentSessionId: string,
      nextItems: readonly WorkspaceAgentActivityTimelineItem[]
    ) => {
      if (nextItems.length === 0) {
        return;
      }
      const incomingStatus = conversationStatusFromTimelineItems(nextItems);
      if (!incomingStatus) {
        return;
      }
      const updatedAtUnixMs = Math.max(...nextItems.map(timelineItemTime));
      updateConversationList((current) => {
        let changed = false;
        const next = current.map((conversation) => {
          if (conversation.id !== agentSessionId) {
            return conversation;
          }
          const status = incomingStatus;
          const nextUpdatedAtUnixMs = Math.max(
            conversation.updatedAtUnixMs,
            updatedAtUnixMs
          );
          if (
            status === conversation.status &&
            nextUpdatedAtUnixMs === conversation.updatedAtUnixMs &&
            conversation.hasUnreadCompletion !== true
          ) {
            return conversation;
          }
          changed = true;
          return {
            ...conversation,
            status,
            updatedAtUnixMs: nextUpdatedAtUnixMs,
            hasUnreadCompletion: false
          };
        });
        return changed ? next : current;
      });
      const transient = transientConversationRef.current;
      if (transient?.id === agentSessionId) {
        setTransientConversation({
          ...transient,
          status: incomingStatus,
          updatedAtUnixMs: Math.max(transient.updatedAtUnixMs, updatedAtUnixMs),
          hasUnreadCompletion: false
        });
      }
    },
    [setTransientConversation]
  );

  const recordLocalMessages = useCallback(
    (
      agentSessionId: string,
      nextMessages: readonly WorkspaceAgentActivityMessage[]
    ) => {
      if (nextMessages.length === 0) {
        return;
      }
      const currentMessages =
        getAgentSessionView(sessionViewRef(agentSessionId))?.overlayMessages ??
        [];
      const overlayMessages = selectWorkspaceAgentActivityOverlayMessages({
        durableMessages:
          agentActivitySnapshot.sessionMessagesById[agentSessionId],
        localMessages: mergeWorkspaceAgentMessages(
          currentMessages,
          nextMessages
        )
      });
      const mergedMessages = mergeWorkspaceAgentMessages(
        agentActivitySnapshot.sessionMessagesById[agentSessionId] ?? [],
        overlayMessages
      );
      const nextItems = projectAgentGUIMessagesToTimelineItems(nextMessages);
      const mergedItems =
        projectAgentGUIMessagesToTimelineItems(mergedMessages);
      setAgentSessionViewOverlayMessages(
        sessionViewRef(agentSessionId),
        overlayMessages
      );
      applyTimelineProjectionUpdate(agentSessionId, nextItems, mergedItems);
    },
    [
      agentActivitySnapshot.sessionMessagesById,
      applyTimelineProjectionUpdate,
      sessionViewRef
    ]
  );

  const applyStatePatch = useCallback(
    (patch: WorkspaceAgentActivityStatePatch) => {
      const agentSessionId = patch.agentSessionId.trim();
      if (!agentSessionId) {
        return;
      }
      const normalizedLastError = patch.lastError?.trim() ?? "";
      const nextStatus = conversationStatusFromStatePatch(patch);
      const hasControlStatePatch = hasSessionControlStatePatch(patch);
      const pendingTurnId =
        pendingTurnIdBySessionIdRef.current[agentSessionId]?.trim() ?? "";
      const patchTurnId = patch.turn?.turnId?.trim() ?? "";
      const clearedPendingSubmittedTurn = Boolean(
        pendingTurnId &&
        ((patchTurnId && patchTurnId === pendingTurnId) ||
          (nextStatus !== null && !conversationBusyStatus(nextStatus)))
      );
      if (clearedPendingSubmittedTurn) {
        const nextPending = { ...pendingTurnIdBySessionIdRef.current };
        delete nextPending[agentSessionId];
        pendingTurnIdBySessionIdRef.current = nextPending;
      }
      if (
        !nextStatus &&
        !patch.title?.trim() &&
        normalizedLastError === "" &&
        !hasControlStatePatch &&
        !clearedPendingSubmittedTurn
      ) {
        return;
      }
      if (hasControlStatePatch) {
        updateAgentSessionViewControlState(
          sessionViewRef(agentSessionId),
          (current) => mergeSessionControlStatePatch(current, patch)
        );
      }
      const patchTitle = patch.title?.trim() ?? "";
      const previousStatePatchError =
        statePatchErrorBySessionId[agentSessionId] ?? null;
      if (normalizedLastError !== "") {
        const nextErrors = {
          ...statePatchErrorBySessionId,
          [agentSessionId]: normalizedLastError
        };
        setStatePatchErrorBySessionId(nextErrors);
      } else if (
        nextStatus &&
        nextStatus !== "failed" &&
        previousStatePatchError !== null
      ) {
        const nextErrors = { ...statePatchErrorBySessionId };
        delete nextErrors[agentSessionId];
        setStatePatchErrorBySessionId(nextErrors);
      }
      if (activeConversationIdRef.current === agentSessionId) {
        if (normalizedLastError !== "") {
          setDetailError(normalizedLastError);
        } else if (
          nextStatus &&
          nextStatus !== "failed" &&
          previousStatePatchError !== null
        ) {
          setDetailError((current) =>
            current === previousStatePatchError ? null : current
          );
        }
      }
      updateConversationList((current) => {
        let changed = false;
        const next = current.map((conversation) => {
          if (conversation.id !== agentSessionId) {
            return conversation;
          }
          const titleFields = mergeConversationTitleUpdateFields(
            conversation,
            patchTitle
          );
          const timelineItems = projectAgentGUIMessagesToTimelineItems(
            resolveSessionMessages(agentSessionId)
          );
          const status = resolveConversationStatusFromTimelineEvidence({
            status: nextStatus ?? conversation.status,
            timelineItems
          });
          const hasUnreadCompletion =
            status === "completed" &&
            activeConversationIdRef.current !== agentSessionId;
          if (
            titleFields.title === conversation.title &&
            titleFields.titleFallback === conversation.titleFallback &&
            status === conversation.status &&
            hasUnreadCompletion === conversation.hasUnreadCompletion &&
            !clearedPendingSubmittedTurn
          ) {
            return conversation;
          }
          changed = true;
          return {
            ...conversation,
            ...titleFields,
            status,
            hasUnreadCompletion
          };
        });
        return changed ? next : current;
      });
      const transient = transientConversationRef.current;
      if (transient?.id === agentSessionId) {
        const transientTitleFields = mergeConversationTitleUpdateFields(
          transient,
          patchTitle
        );
        const timelineItems = projectAgentGUIMessagesToTimelineItems(
          resolveSessionMessages(agentSessionId)
        );
        const transientStatus = resolveConversationStatusFromTimelineEvidence({
          status: nextStatus ?? transient.status,
          timelineItems
        });
        setTransientConversation({
          ...transient,
          ...transientTitleFields,
          status: transientStatus,
          hasUnreadCompletion:
            transientStatus === "completed" &&
            activeConversationIdRef.current !== agentSessionId
        });
      }
    },
    [
      resolveSessionMessages,
      sessionViewRef,
      setTransientConversation,
      statePatchErrorBySessionId,
      agentActivityRuntime,
      workspaceId
    ]
  );
  const handleActivityStreamEvent = useCallback(
    (event: AgentActivityStreamEvent) => {
      if (event.eventType === "available_commands_update") {
        return;
      }
      if (event.eventType === "message_update") {
        const message = messageFromMessageUpdate(event.data);
        const agentSessionId = message.agentSessionId.trim();
        if (agentSessionId) {
          applyBackgroundTimelineStatusUpdate(
            agentSessionId,
            projectAgentGUIMessagesToTimelineItems([message])
          );
        }
        return;
      }
      if (event.eventType === "state_patch") {
        applyStatePatch(event.data);
      }
    },
    [applyStatePatch, applyBackgroundTimelineStatusUpdate]
  );

  const handleBackgroundActivityStreamEvent = useCallback(
    (event: AgentActivityStreamEvent) => {
      if (event.eventType === "message_update") {
        handleActivityStreamEvent(event);
        return;
      }
      if (event.eventType === "state_patch") {
        applyStatePatch(event.data);
      }
    },
    [applyStatePatch, handleActivityStreamEvent]
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }
    void syncConversationListProjection(
      dataRef.current.lastActiveAgentSessionId
    );
  }, [
    currentUserId,
    data.provider,
    previewMode,
    syncConversationListProjection
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!activeConversationId) {
      setDetailError(null);
      return;
    }
    if (failedNewConversationIdsRef.current.has(activeConversationId)) {
      return;
    }
    if (startingConversationIdRef.current === activeConversationId) {
      return;
    }
    reloadSelectedConversation(activeConversationId, {
      reloadConversations: false,
      reloadDetail: true
    });
  }, [activeConversationId, previewMode, reloadSelectedConversation]);

  useAgentSessionDurableRefresh({
    agentSessionId: activeConversationId,
    sessionView: activeSessionView,
    blockControlStateRefresh:
      previewMode ||
      activeConversationId === null ||
      blockedActivityStreamStateReloadSessionIdsRef.current.has(
        activeConversationId
      ),
    onControlStateRefresh: () => {
      if (!activeConversationId) {
        return;
      }
      const requestId = ++activityStreamStateReloadSeqRef.current;
      void loadSessionState(activeConversationId, {
        source: "activity-stream",
        eventType: "state_patch",
        requestId
      });
    }
  });

  useWatchAgentSession({
    workspaceId,
    agentSessionId: activeConversationId,
    enabled: !previewMode && activeConversationId !== null,
    onSubscribe: () => {
      if (!activeConversationId) {
        return;
      }
    },
    onEvent: (event) => {
      if (!activeConversationId) {
        return;
      }
      handleActivityStreamEvent(event);
      const eventSessionId =
        event.data.agentSessionId?.trim() || activeConversationId;
      if (
        activeConversationIdRef.current !== activeConversationId ||
        activeConversationIdRef.current !== eventSessionId
      ) {
        return;
      }
      if (event.eventType === "config_options_update") {
        const requestId = ++activityStreamStateReloadSeqRef.current;
        scheduleActivityStreamStateReload(activeConversationId, {
          source: "activity-stream",
          eventType: event.eventType,
          requestId
        });
      }
    },
    onCleanup: () => {
      if (!activeConversationId) {
        return;
      }
    }
  });

  useWatchAgentSessions({
    workspaceId,
    agentSessionIds: backgroundWatchedConversationIds,
    enabled: backgroundWatchedConversationIds.length > 0,
    onEvent: (event) => {
      handleBackgroundActivityStreamEvent(event);
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      clearPendingSessionStateReload();
      const current = activeConversationIdRef.current;
      const pendingNewConversationId = startingConversationIdRef.current;
      isMountedRef.current = false;
      activeConversationIdRef.current = null;
      if (current) {
        activatedConversationIdsRef.current.delete(current);
        void unactivateRef.current(current);
      }
      if (pendingNewConversationId && pendingNewConversationId !== current) {
        activatedConversationIdsRef.current.delete(pendingNewConversationId);
        void unactivateRef.current(pendingNewConversationId);
      }
    };
  }, [clearPendingSessionStateReload]);

  const startConversation = useCallback(
    (initialContentInput?: unknown) => {
      if (
        isCreatingConversation ||
        (data.provider === "openclaw" && openclawGateway?.status !== "ready")
      ) {
        return;
      }
      const normalizedInitialContent = Array.isArray(initialContentInput)
        ? normalizePromptContentBlocks(
            initialContentInput as AgentPromptContentBlock[]
          )
        : textPromptContent(normalizeOptionalPrompt(initialContentInput));
      const normalizedInitialPrompt = promptContentDisplayText(
        normalizedInitialContent
      );
      const initialConversationTitle =
        normalizedInitialPrompt || AGENT_PROVIDER_LABEL[data.provider];
      isCreatingConversationRef.current = true;
      setLocalIsCreatingConversation(true);
      setDetailError(null);
      let pendingCreateAgentSessionId: string | null = null;
      void (async () => {
        const provider = data.provider;
        const currentData =
          dataRef.current.provider === provider ? dataRef.current : data;
        const selectedProjectPath = selectedProjectPathRef.current;
        const initialNodeSettings = readNodeDefaultDraftSettings({
          data: currentData,
          defaultReasoningEffort,
          drafts: draftSettingsBySessionIdRef.current
        });
        const initialSettings = resolveEffectiveComposerSettings({
          settings: initialNodeSettings
        });
        const agentSessionId = createAgentGUIConversationId();
        pendingCreateAgentSessionId = agentSessionId;
        const createdAtUnixMs = Date.now();
        const optimisticConversation: AgentGUIConversationSummary = {
          id: agentSessionId,
          userId: currentUserId?.trim() ?? "",
          provider,
          title: initialConversationTitle,
          titleFallback: null,
          status: "working",
          cwd: selectedProjectPath ?? "",
          project: resolveAgentGUIConversationProject(
            selectedProjectPath,
            userProjectsRef.current,
            { isNoProjectPath: isNoProjectPathRef.current }
          ),
          sortTimeUnixMs: createdAtUnixMs,
          updatedAtUnixMs: createdAtUnixMs
        };
        setTransientConversation(optimisticConversation);
        setAgentSessionViewMessagesLoading(
          sessionViewRef(agentSessionId),
          true
        );
        if (conversationListQuery) {
          markAgentGUIConversationCreatePending({
            query: conversationListQuery,
            ownerKey: pendingCreateOwnerKey,
            conversationId: agentSessionId
          });
        }
        startingConversationIdRef.current = agentSessionId;
        draftSettingsBySessionIdRef.current = {
          ...draftSettingsBySessionIdRef.current,
          [agentSessionId]: initialSettings
        };
        setDraftSettingsBySessionId((current) => ({
          ...current,
          [agentSessionId]: initialSettings
        }));
        setIsLoadingMessages(true);
        return activation.activate({
          mode: "new",
          agentSessionId,
          provider,
          cwd: selectedProjectPath ?? "",
          initialContent: normalizedInitialContent,
          title: initialConversationTitle,
          settings: initialSettings,
          openclawGatewayReady:
            provider === "openclaw"
              ? openclawGateway?.status === "ready"
              : undefined
        });
      })()
        .then((result) => {
          const agentSessionId = result.session.agentSessionId;
          if (conversationListQuery) {
            clearAgentGUIConversationCreatePending({
              query: conversationListQuery,
              ownerKey: pendingCreateOwnerKey,
              conversationId: agentSessionId
            });
          }
          const projectedConversation = conversationSummaryFromAgentSession(
            result.session,
            {
              isNoProjectPath: isNoProjectPathRef.current,
              userProjects: userProjectsRef.current
            }
          );
          const optimisticSortTimeUnixMs =
            transientConversationRef.current?.id === agentSessionId
              ? transientConversationRef.current.sortTimeUnixMs
              : undefined;
          const conversation: AgentGUIConversationSummary = {
            ...projectedConversation,
            sortTimeUnixMs: Math.max(
              projectedConversation.sortTimeUnixMs ?? 0,
              optimisticSortTimeUnixMs ?? 0
            )
          };
          failedNewConversationIdsRef.current.delete(conversation.id);
          if (startingConversationIdRef.current === agentSessionId) {
            startingConversationIdRef.current = null;
          }
          if (!isMountedRef.current) {
            void activation.unactivate(conversation.id);
            if (transientConversationRef.current?.id === agentSessionId) {
              setTransientConversation(null);
            }
            return;
          }
          const shouldAttachCreatedConversation =
            activeConversationIdRef.current === null &&
            isComposerHomeRef.current;
          if (
            !shouldAttachCreatedConversation &&
            unactivateIfStale(conversation.id)
          ) {
            if (transientConversationRef.current?.id === agentSessionId) {
              setTransientConversation(null);
            }
            return;
          }
          const activationFailed =
            result.activation.status === "failed" ||
            result.session.status === "failed";
          if (!activationFailed) {
            activatedConversationIdsRef.current.add(conversation.id);
          }
          setTransientConversation(conversation);
          if (conversationListQuery) {
            if (hasLoadedConversations) {
              upsertLocalCreatedAgentGUIConversation({
                query: conversationListQuery,
                conversation
              });
            }
            scheduleAgentGUIConversationListProjection(
              conversationListQuery,
              "local-create"
            );
          }
          isComposerHomeRef.current = false;
          setIsComposerHome(false);
          activeConversationIdRef.current = conversation.id;
          setActiveConversationId(conversation.id);
          setDraftBySessionId((current) => ({
            ...current,
            [nodeDefaultDraftPromptKey(dataRef.current.provider)]: "",
            [conversation.id]: ""
          }));
          persistActiveConversation(conversation.id);
          if (activationFailed) {
            failedNewConversationIdsRef.current.add(conversation.id);
            setIsLoadingMessages(false);
            void refreshMessagesFromSnapshot(conversation.id);
            void syncConversationListProjection(conversation.id);
            return;
          }
          void refreshMessagesFromSnapshot(conversation.id);
          void loadSessionState(conversation.id);
          void syncConversationListProjection(conversation.id);
        })
        .catch((error) => {
          const agentSessionId =
            startingConversationIdRef.current ?? createAgentGUIConversationId();
          if (conversationListQuery) {
            clearAgentGUIConversationCreatePending({
              query: conversationListQuery,
              ownerKey: pendingCreateOwnerKey,
              conversationId: pendingCreateAgentSessionId ?? agentSessionId
            });
          }
          const shouldShowFailedConversation =
            startingConversationIdRef.current === agentSessionId ||
            (activeConversationIdRef.current === null &&
              isComposerHomeRef.current);
          if (
            !shouldShowFailedConversation &&
            !isCurrentConversation(agentSessionId)
          ) {
            if (startingConversationIdRef.current === agentSessionId) {
              startingConversationIdRef.current = null;
            }
            if (transientConversationRef.current?.id === agentSessionId) {
              setTransientConversation(null);
            }
            return;
          }
          const message = getAgentGUIErrorMessage(error);
          reportAgentGUIRuntimeError({
            agentSessionId,
            error,
            phase: "create_conversation",
            provider: dataRef.current.provider,
            runtime: agentActivityRuntime,
            workspaceId
          });
          const failedAtUnixMs = Date.now();
          const failedConversation: AgentGUIConversationSummary = {
            id: agentSessionId,
            provider: dataRef.current.provider,
            title: initialConversationTitle,
            titleFallback: null,
            cwd: selectedProjectPathRef.current ?? "",
            project: resolveAgentGUIConversationProject(
              selectedProjectPathRef.current,
              userProjectsRef.current,
              { isNoProjectPath: isNoProjectPathRef.current }
            ),
            status: "failed",
            sortTimeUnixMs: failedAtUnixMs,
            updatedAtUnixMs: failedAtUnixMs
          };
          failedNewConversationIdsRef.current.add(agentSessionId);
          setTransientConversation(failedConversation);
          if (startingConversationIdRef.current === agentSessionId) {
            startingConversationIdRef.current = null;
          }
          isComposerHomeRef.current = false;
          setIsComposerHome(false);
          activeConversationIdRef.current = agentSessionId;
          setActiveConversationId(agentSessionId);
          setDraftBySessionId((current) => ({
            ...current,
            [nodeDefaultDraftPromptKey(dataRef.current.provider)]: "",
            [agentSessionId]: ""
          }));
          setIsLoadingMessages(false);
          setDetailError(message);
        })
        .finally(() => {
          isCreatingConversationRef.current = false;
          setLocalIsCreatingConversation(false);
        });
    },
    [
      currentUserId,
      data,
      defaultReasoningEffort,
      isCreatingConversation,
      openclawGateway?.status,
      syncConversationListProjection,
      loadSessionState,
      refreshMessagesFromSnapshot,
      persistActiveConversation,
      activation,
      conversationListQuery,
      isCurrentConversation,
      agentActivityRuntime,
      pendingCreateOwnerKey,
      unactivateIfStale,
      workspaceId
    ]
  );

  const createConversation = useCallback(
    (options?: { projectPath?: string | null }) => {
      if (options && "projectPath" in options) {
        const projectPath = normalizeProjectDraftPath(options.projectPath);
        selectedProjectPathRef.current = projectPath;
        setSelectedProjectPath(projectPath);
      }
      const previous = activeConversationIdRef.current;
      if (previous) {
        void activation.unactivate(previous);
      }
      suppressedHomeConversationIdRef.current =
        previous ?? dataRef.current.lastActiveAgentSessionId;
      isComposerHomeRef.current = true;
      setIsComposerHome(true);
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setIsLoadingMessages(false);
      setDetailError(null);
      persistActiveConversation(null);
      loadDraftComposerOptions();
    },
    [activation, loadDraftComposerOptions, persistActiveConversation]
  );

  const continueInNewConversation = useCallback(() => {
    const currentConversationId = activeConversationIdRef.current;
    if (!currentConversationId) {
      return;
    }
    const activeConversation = resolveConversationSummaryById(
      conversations,
      currentConversationId,
      transientConversationRef.current
    );
    if (!activeConversation) {
      createConversation();
      return;
    }
    const nextDraftPrompt = buildContinueInNewConversationPrompt({
      workspaceId,
      agentSessionId: activeConversation.id,
      conversationUserId: activeConversation.userId,
      currentUserId,
      userProfilesByUserId: accountProfilesByUserId,
      provider: activeConversation.provider,
      conversationTitle: activeConversation.title,
      existingDraftPrompt: draftBySessionId[currentConversationId] ?? ""
    });
    const previous = activeConversationIdRef.current;
    if (previous) {
      void activation.unactivate(previous);
    }
    suppressedHomeConversationIdRef.current =
      previous ?? dataRef.current.lastActiveAgentSessionId;
    isComposerHomeRef.current = true;
    setIsComposerHome(true);
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    setIsLoadingMessages(false);
    setDetailError(null);
    setDraftBySessionId((current) => ({
      ...current,
      [nodeDefaultDraftPromptKey(dataRef.current.provider)]: nextDraftPrompt
    }));
    persistActiveConversation(null);
    loadDraftComposerOptions();
  }, [
    accountProfilesByUserId,
    activation,
    conversations,
    createConversation,
    currentUserId,
    draftBySessionId,
    loadDraftComposerOptions,
    persistActiveConversation,
    workspaceId
  ]);

  const isSessionMarkedNonResumable = useCallback(
    (agentSessionId: string): boolean => {
      if (runtimeSessionsBySessionId.get(agentSessionId)?.resumable === false) {
        return true;
      }
      const conversation = resolveConversationSummaryById(
        conversationsRef.current,
        agentSessionId,
        transientConversationRef.current
      );
      return conversation?.resumable === false;
    },
    [runtimeSessionsBySessionId]
  );

  const retryActivation = useCallback(() => {
    const agentSessionId = activeConversationIdRef.current;
    if (!agentSessionId) {
      return;
    }
    if (isSessionMarkedNonResumable(agentSessionId)) {
      return;
    }
    if (isNonRetryableResumeErrorCode(activation.codeFor(agentSessionId))) {
      return;
    }
    failedNewConversationIdsRef.current.delete(agentSessionId);
    setDetailError(null);
    const existingMessages = resolveSessionMessages(agentSessionId);
    if (existingMessages.length === 0) {
      applyStatePatch({
        agentSessionId,
        currentPhase: "working",
        occurredAtUnixMs: Date.now()
      });
    }
    void activation
      .activate({ mode: "existing", agentSessionId })
      .then(() => {
        if (!isCurrentConversation(agentSessionId)) {
          return;
        }
        activatedConversationIdsRef.current.add(agentSessionId);
      })
      .catch((error) => {
        if (!isCurrentConversation(agentSessionId)) {
          return;
        }
        reportAgentGUIRuntimeError({
          agentSessionId,
          error,
          phase: "retry_activation",
          provider: dataRef.current.provider,
          runtime: agentActivityRuntime,
          workspaceId
        });
      });
  }, [
    agentActivityRuntime,
    activation,
    applyStatePatch,
    isCurrentConversation,
    isSessionMarkedNonResumable,
    resolveSessionMessages,
    workspaceId
  ]);

  const executePrompt = useCallback(
    (
      agentSessionId: string,
      content: AgentPromptContentBlock[],
      queuedPromptId?: string | null
    ) => {
      const normalizedContent = normalizePromptContentBlocks(content);
      if (!agentSessionId || normalizedContent.length === 0) {
        return;
      }
      const submittedPromptText = promptContentDisplayText(normalizedContent);
      const submittedAtUnixMs = Date.now();
      const previousConversationStatus =
        resolveConversationSummaryById(
          conversationsRef.current,
          agentSessionId,
          transientConversationRef.current
        )?.status ?? null;
      if (conversationListQuery) {
        markAgentGUIConversationSubmitPending({
          query: conversationListQuery,
          conversationId: agentSessionId
        });
      }
      setLocalIsSubmitting(true);
      setDetailError(null);
      updateConversationList((current) =>
        current.map((conversation) =>
          conversation.id === agentSessionId
            ? {
                ...conversation,
                status: "working",
                sortTimeUnixMs: Math.max(
                  conversation.sortTimeUnixMs ?? 0,
                  submittedAtUnixMs
                ),
                updatedAtUnixMs: Math.max(
                  conversation.updatedAtUnixMs,
                  submittedAtUnixMs
                )
              }
            : conversation
        )
      );
      setTransientConversation((current) =>
        current?.id === agentSessionId
          ? {
              ...current,
              status: "working",
              sortTimeUnixMs: Math.max(
                current.sortTimeUnixMs ?? 0,
                submittedAtUnixMs
              ),
              updatedAtUnixMs: Math.max(
                current.updatedAtUnixMs,
                submittedAtUnixMs
              )
            }
          : current
      );
      applyStatePatch({
        agentSessionId,
        currentPhase: "working",
        occurredAtUnixMs: submittedAtUnixMs
      });
      void Promise.resolve()
        .then(() => {
          if (!isCurrentConversation(agentSessionId)) {
            return null;
          }
          return agentActivityRuntime.sendInput({
            workspaceId,
            agentSessionId,
            content: normalizedContent
          });
        })
        .then((result) => {
          if (!result || !isCurrentConversation(agentSessionId)) {
            return;
          }
          const submittedStatus = conversationStatusFromStatusValue(
            projectCoreSessionStatus(result.status)
          );
          if (submittedStatus && submittedStatus !== "ready") {
            updateConversationList((current) =>
              current.map((conversation) =>
                conversation.id === agentSessionId
                  ? {
                      ...conversation,
                      status: submittedStatus,
                      updatedAtUnixMs: Date.now()
                    }
                  : conversation
              )
            );
          }
          if (!queuedPromptId) {
            setDraftBySessionId((current) => {
              if (
                (current[agentSessionId] ?? "").trim() !== submittedPromptText
              ) {
                return current;
              }
              return {
                ...current,
                [agentSessionId]: ""
              };
            });
          }
          if (queuedPromptId) {
            setQueuedPromptsBySessionId((current) => {
              const queue = current[agentSessionId] ?? [];
              if (
                queue.length === 0 ||
                !queue.some((item) => item.id === queuedPromptId)
              ) {
                return current;
              }
              return {
                ...current,
                [agentSessionId]: removeQueuedPromptById(queue, queuedPromptId)
              };
            });
            setSendNextQueuedPromptIdBySessionId((current) => {
              if (current[agentSessionId] !== queuedPromptId) {
                return current;
              }
              return { ...current, [agentSessionId]: null };
            });
            setFailedQueuedPromptIdBySessionId((current) => {
              if (current[agentSessionId] !== queuedPromptId) {
                return current;
              }
              return { ...current, [agentSessionId]: null };
            });
            setQueuedPromptRetryBlockBySessionId((current) => {
              if (current[agentSessionId]?.queuedPromptId !== queuedPromptId) {
                return current;
              }
              return { ...current, [agentSessionId]: null };
            });
          }
          const submittedTurnId =
            normalizeConfigOptionValue(recordValue(result)?.turnId) ?? "";
          if (submittedTurnId) {
            pendingTurnIdBySessionIdRef.current = {
              ...pendingTurnIdBySessionIdRef.current,
              [agentSessionId]: submittedTurnId
            };
            recordLocalMessages(agentSessionId, [
              createOptimisticPromptMessage({
                workspaceId,
                agentSessionId,
                turnId: submittedTurnId,
                userId: currentUserId?.trim() || "user",
                prompt: submittedPromptText,
                content: normalizedContent,
                occurredAtUnixMs: Date.now()
              })
            ]);
          }
          void refreshMessagesFromSnapshot(agentSessionId);
          if (
            !getAgentSessionView(sessionViewRef(agentSessionId))?.controlState
          ) {
            void loadSessionState(agentSessionId);
          }
          if (submittedStatus !== "working") {
            void syncConversationListProjection(agentSessionId);
          }
        })
        .catch((error) => {
          const currentSessionState =
            getAgentSessionView(sessionViewRef(agentSessionId))?.controlState ??
            null;
          const currentConversationSummary = resolveConversationSummaryById(
            conversations,
            agentSessionId,
            transientConversationRef.current
          );
          const shouldRetryQueuedPromptOnNextActivity =
            queuedPromptId !== undefined &&
            isAgentSessionActiveTurnConflictError(error);
          if (
            !shouldRetryQueuedPromptOnNextActivity &&
            previousConversationStatus &&
            previousConversationStatus !== "working"
          ) {
            updateConversationList((current) =>
              current.map((conversation) =>
                conversation.id === agentSessionId &&
                conversation.status === "working"
                  ? {
                      ...conversation,
                      status: previousConversationStatus,
                      updatedAtUnixMs: Date.now()
                    }
                  : conversation
              )
            );
            const transient = transientConversationRef.current;
            if (
              transient?.id === agentSessionId &&
              transient.status === "working"
            ) {
              setTransientConversation({
                ...transient,
                status: previousConversationStatus,
                updatedAtUnixMs: Date.now()
              });
            }
          }
          if (
            isCurrentConversation(agentSessionId) &&
            !shouldRetryQueuedPromptOnNextActivity
          ) {
            reportAgentGUIRuntimeError({
              agentSessionId,
              context: {
                queuedPrompt: queuedPromptId !== undefined,
                retryQueuedPromptOnNextActivity:
                  shouldRetryQueuedPromptOnNextActivity
              },
              error,
              phase: "send_prompt",
              provider: dataRef.current.provider,
              runtime: agentActivityRuntime,
              workspaceId
            });
            setDetailError(getAgentGUIErrorMessage(error));
          }
          if (queuedPromptId) {
            if (shouldRetryQueuedPromptOnNextActivity) {
              setQueuedPromptRetryBlockBySessionId((current) => ({
                ...current,
                [agentSessionId]: {
                  queuedPromptId,
                  sessionStateUpdatedAtUnixMs:
                    currentSessionState?.updatedAtUnixMs ?? null,
                  conversationUpdatedAtUnixMs:
                    currentConversationSummary?.updatedAtUnixMs ?? null
                }
              }));
            } else {
              setFailedQueuedPromptIdBySessionId((current) => ({
                ...current,
                [agentSessionId]: queuedPromptId
              }));
            }
          }
        })
        .finally(() => {
          if (conversationListQuery) {
            clearAgentGUIConversationSubmitPending({
              query: conversationListQuery,
              conversationId: agentSessionId
            });
          }
          setLocalIsSubmitting(false);
          setDrainingQueuedPromptSessionId((current) =>
            current === agentSessionId ? null : current
          );
        });
    },
    [
      currentUserId,
      isCurrentConversation,
      applyStatePatch,
      conversations,
      conversationListQuery,
      syncConversationListProjection,
      loadSessionState,
      refreshMessagesFromSnapshot,
      recordLocalMessages,
      sessionViewRef,
      setTransientConversation,
      updateConversationList,
      workspaceId,
      agentActivityRuntime
    ]
  );

  useEffect(() => {
    executePromptRef.current = executePrompt;
  }, [executePrompt]);

  const queuePromptLocally = useCallback(
    (agentSessionId: string, prompt: string) => {
      const trimmed = prompt.trim();
      if (!agentSessionId || !trimmed) {
        return;
      }
      const queuedPrompt: AgentGUIQueuedPromptVM = {
        id: `local-${createAgentGUIConversationId()}`,
        prompt: trimmed,
        createdAtUnixMs: Date.now()
      };
      setQueuedPromptsBySessionId((current) => ({
        ...current,
        [agentSessionId]: [...(current[agentSessionId] ?? []), queuedPrompt]
      }));
      setDraftBySessionId((current) => ({
        ...current,
        [agentSessionId]: ""
      }));
      setDetailError(null);
    },
    []
  );

  const shouldQueuePromptLocally = useCallback(
    (agentSessionId: string): boolean => {
      if (isSubmitting || isRespondingApproval) {
        return true;
      }
      const sessionView = getAgentSessionView(sessionViewRef(agentSessionId));
      const sessionState = sessionView?.controlState ?? null;
      if (
        agentSessionStatusBusy({
          status: sessionState?.status
        }) ||
        pendingApprovalFromState(sessionState) !== null ||
        pendingInteractiveFromState(sessionState) !== null
      ) {
        return true;
      }
      const summary = resolveConversationSummaryById(
        conversationsRef.current,
        agentSessionId,
        transientConversationRef.current
      );
      if (conversationBusyStatus(summary?.status ?? null)) {
        return true;
      }
      if (!summary) {
        return false;
      }
      const timelineItems = projectAgentGUIMessagesToTimelineItems(
        resolveSessionMessages(agentSessionId)
      );
      const conversationVM = buildAgentGUIConversationVM({
        timelineItems,
        conversation: summary,
        workspaceRoot: workspacePath,
        avoidGroupingEdits
      });
      return conversationHasActiveWork(conversationVM);
    },
    [
      avoidGroupingEdits,
      isRespondingApproval,
      isSubmitting,
      resolveSessionMessages,
      sessionViewRef,
      workspacePath
    ]
  );

  const submitPrompt = useCallback(
    (content: AgentPromptContentBlock[]) => {
      const agentSessionId = activeConversationIdRef.current;
      const normalizedContent = normalizePromptContentBlocks(content);
      const textPrompt = promptContentDisplayText(normalizedContent);
      if (normalizedContent.length === 0) {
        return;
      }
      if (
        resolvedPromptImagesSupported === false &&
        promptContentHasImage(normalizedContent)
      ) {
        setDetailError(translate("agentHost.agentGui.promptImagesUnsupported"));
        return;
      }
      if (!agentSessionId) {
        startConversation(normalizedContent);
        return;
      }
      if (isSessionMarkedNonResumable(agentSessionId)) {
        setDetailError(
          getAgentGUIErrorMessage(buildResumeSessionNotLocalActivationError())
        );
        return;
      }
      if (isNonRetryableResumeErrorCode(activation.codeFor(agentSessionId))) {
        setDetailError(
          getAgentGUIErrorMessage(
            activation.codeFor(agentSessionId) ===
              AGENT_RESUME_SESSION_NOT_LOCAL_ERROR
              ? buildResumeSessionNotLocalActivationError(
                  activation.errorFor(agentSessionId)
                )
              : buildProviderSessionNotFoundActivationError(
                  activation.errorFor(agentSessionId)
                )
          )
        );
        return;
      }
      if (shouldQueuePromptLocally(agentSessionId)) {
        if (promptContentHasImage(normalizedContent)) {
          setDetailError(
            translate("agentHost.agentGui.promptImagesCannotQueue")
          );
          return;
        }
        queuePromptLocally(agentSessionId, textPrompt);
        return;
      }
      executePrompt(agentSessionId, normalizedContent);
    },
    [
      activation,
      executePrompt,
      isSessionMarkedNonResumable,
      resolvedPromptImagesSupported,
      queuePromptLocally,
      shouldQueuePromptLocally,
      startConversation
    ]
  );

  const submitCompact = useCallback(() => {
    submitPrompt(textPromptContent("/compact"));
  }, [submitPrompt]);

  const showPromptImagesUnsupported = useCallback(() => {
    setDetailError(translate("agentHost.agentGui.promptImagesUnsupported"));
  }, []);

  const submitInteractivePrompt = useCallback(
    (input: {
      requestId: string;
      action?: string;
      optionId?: string;
      payload?: Record<string, unknown>;
    }) => {
      // Codex plan-implementation actions are client-orchestrated (no server
      // submitInteractive); route them to the plan decision handlers.
      if (input.action === PLAN_IMPLEMENTATION_ACTION_IMPLEMENT) {
        planActionsRef.current.implement();
        return;
      }
      if (input.action === PLAN_IMPLEMENTATION_ACTION_FEEDBACK) {
        planActionsRef.current.feedback(
          typeof input.payload?.text === "string" ? input.payload.text : ""
        );
        return;
      }
      if (input.action === PLAN_IMPLEMENTATION_ACTION_SKIP) {
        planActionsRef.current.skip();
        return;
      }
      const agentSessionId = activeConversationIdRef.current;
      const normalizedRequestId = input.requestId.trim();
      const normalizedOptionId = input.optionId?.trim() ?? "";
      if (!agentSessionId || !normalizedRequestId || isRespondingApproval) {
        return;
      }
      setIsRespondingApproval(true);
      setDetailError(null);
      const submittedPrompt = activePendingPromptRef.current;
      void Promise.resolve()
        .then(() => {
          if (!isCurrentConversation(agentSessionId)) {
            return null;
          }
          return agentActivityRuntime.submitInteractive({
            workspaceId,
            agentSessionId,
            requestId: normalizedRequestId,
            ...(input.action?.trim() ? { action: input.action.trim() } : {}),
            ...(normalizedOptionId ? { optionId: normalizedOptionId } : {}),
            ...(input.payload ? { payload: input.payload } : {})
          });
        })
        .then((result) => {
          if (!result || !isCurrentConversation(agentSessionId)) {
            return;
          }
          if (
            submittedPrompt?.requestId === normalizedRequestId &&
            submittedPrompt.kind === "exit-plan" &&
            input.action === "allow"
          ) {
            // Plan approved: leave plan mode so the next turn executes
            // instead of replanning. The approved option is the permission
            // mode the provider switches to, so mirror it in the dropdown.
            updateComposerSettingsRef.current({
              planMode: false,
              ...(normalizedOptionId
                ? { permissionModeId: normalizedOptionId }
                : {})
            });
          }
          void refreshMessagesFromSnapshot(agentSessionId);
          void loadSessionState(agentSessionId);
          void syncConversationListProjection(agentSessionId);
        })
        .catch((error) => {
          if (isCurrentConversation(agentSessionId)) {
            reportAgentGUIRuntimeError({
              agentSessionId,
              error,
              phase: "submit_interactive",
              provider: dataRef.current.provider,
              requestId: normalizedRequestId,
              runtime: agentActivityRuntime,
              workspaceId
            });
            setDetailError(getAgentGUIErrorMessage(error));
          }
        })
        .finally(() => {
          setIsRespondingApproval(false);
        });
    },
    [
      isCurrentConversation,
      isRespondingApproval,
      syncConversationListProjection,
      loadSessionState,
      refreshMessagesFromSnapshot,
      workspaceId,
      agentActivityRuntime
    ]
  );

  const submitApprovalOption = useCallback(
    (requestId: string, optionId: string) => {
      void submitInteractivePrompt({ requestId, optionId });
    },
    [submitInteractivePrompt]
  );

  const interruptCurrentTurn = useCallback(
    (noRunningResponseMessage: string) => {
      const agentSessionId = activeConversationIdRef.current;
      if (!agentSessionId || interruptingSessionIds[agentSessionId]) {
        return;
      }
      void noRunningResponseMessage;
      const activePendingPrompt = activePendingPromptRef.current;
      if (activePendingPrompt?.sessionId === agentSessionId) {
        setSuppressedPromptRequestIdsBySessionId((current) => ({
          ...current,
          [agentSessionId]: activePendingPrompt.requestId
        }));
      }
      setInterruptingSessionIds((current) => ({
        ...current,
        [agentSessionId]: true
      }));
      setDetailError(null);
      void Promise.resolve()
        .then(() => {
          if (!isCurrentConversation(agentSessionId)) {
            return null;
          }
          return agentActivityRuntime.cancelSession({
            workspaceId,
            agentSessionId
          });
        })
        .then((result) => {
          if (!result || !isCurrentConversation(agentSessionId)) {
            return;
          }
          const conversationStatus =
            resolveConversationSummaryById(
              conversations,
              agentSessionId,
              transientConversationRef.current
            )?.status ?? null;
          const runtimeSessionStatus =
            runtimeSessionsBySessionId.get(agentSessionId)?.status ?? null;
          reportAgentGUICancelDiagnostic({
            agentSessionId,
            busySource: cancelBusySource({
              conversationStatus,
              hasActivePrompt:
                activePendingPrompt?.sessionId === agentSessionId,
              runtimeSessionStatus,
              sessionStateStatus: activeSessionState?.status ?? null
            }),
            currentSessionStatus:
              activeSessionState?.status ?? runtimeSessionStatus,
            phase: "interrupt_current_turn",
            provider: dataRef.current.provider,
            result,
            runtime: agentActivityRuntime,
            workspaceId
          });
          void refreshMessagesFromSnapshot(agentSessionId);
          void loadSessionState(agentSessionId);
          void syncConversationListProjection(agentSessionId);
        })
        .catch((error) => {
          if (isCurrentConversation(agentSessionId)) {
            reportAgentGUIRuntimeError({
              agentSessionId,
              error,
              phase: "interrupt_current_turn",
              provider: dataRef.current.provider,
              runtime: agentActivityRuntime,
              workspaceId
            });
            setSuppressedPromptRequestIdsBySessionId((current) => {
              if (current[agentSessionId] !== activePendingPrompt?.requestId) {
                return current;
              }
              const next = { ...current };
              delete next[agentSessionId];
              return next;
            });
            setDetailError(getAgentGUIErrorMessage(error));
          }
        })
        .finally(() => {
          setInterruptingSessionIds((current) => {
            if (!current[agentSessionId]) {
              return current;
            }
            const next = { ...current };
            delete next[agentSessionId];
            return next;
          });
        });
    },
    [
      interruptingSessionIds,
      isCurrentConversation,
      syncConversationListProjection,
      loadSessionState,
      refreshMessagesFromSnapshot,
      conversations,
      runtimeSessionsBySessionId,
      activeSessionState,
      workspaceId,
      agentActivityRuntime
    ]
  );

  const updateDraftPrompt = useCallback((draftPrompt: string) => {
    const agentSessionId = activeConversationIdRef.current;
    const draftKey =
      agentSessionId ?? nodeDefaultDraftPromptKey(dataRef.current.provider);
    setDraftBySessionId((current) => ({ ...current, [draftKey]: draftPrompt }));
  }, []);

  const flushQueuedComposerSettingsUpdate = useCallback(
    (
      input: QueuedComposerSettingsUpdate & {
        agentSessionId: string;
      }
    ) => {
      const { agentSessionId, nextNodeDefaults, sessionSettingsPatch } = input;
      const persistNodeDefaults = () => {
        const defaultDraftKey = nodeDefaultDraftKey(dataRef.current.provider);
        setDraftSettingsBySessionId((current) => ({
          ...current,
          [defaultDraftKey]: nextNodeDefaults
        }));
        onDataChangeRef.current((current) =>
          nodeDataFromComposerSettings(current, nextNodeDefaults)
        );
      };
      void agentActivityRuntime
        .updateSessionSettings({
          workspaceId,
          agentSessionId,
          settings: sessionSettingsPatch
        })
        .then((result) => {
          const queuedUpdate =
            queuedComposerSettingsUpdatesRef.current[agentSessionId] ?? null;
          const optimisticSettings = queuedUpdate?.sessionSettingsPatch ?? null;
          const nextAppliedSettings = optimisticSettings
            ? {
                ...result.settings,
                ...optimisticSettings
              }
            : result.settings;
          updateAgentSessionViewControlState(
            sessionViewRef(agentSessionId),
            (existing) =>
              existing
                ? {
                    ...existing,
                    permissionModeId:
                      nextAppliedSettings.permissionModeId ?? undefined,
                    runtimeContext: mergeRuntimeContextComposerSettings(
                      dataRef.current.provider,
                      existing.runtimeContext,
                      nextAppliedSettings
                    ),
                    settings: {
                      ...(existing.settings ?? {}),
                      ...nextAppliedSettings
                    }
                  }
                : existing
          );
          if (queuedUpdate === null) {
            persistNodeDefaults();
            if (
              sessionSettingsPatch.model !== undefined &&
              dataRef.current.provider === "claude-code"
            ) {
              void loadSessionState(agentSessionId, {
                source: "settings-update",
                force: true
              });
            }
          }
        })
        .catch((error) => {
          delete queuedComposerSettingsUpdatesRef.current[agentSessionId];
          void loadSessionState(agentSessionId, {
            source: "settings-update",
            force: true
          });
          const message = getAgentGUIErrorMessage(error);
          if (
            isSettingsRequireNewSessionErrorCode(getAgentGUIErrorCode(error))
          ) {
            onShowMessageRef.current?.(message, "warning");
          }
          if (isCurrentConversation(agentSessionId)) {
            reportAgentGUIRuntimeError({
              agentSessionId,
              error,
              phase: "update_session_settings",
              provider: dataRef.current.provider,
              runtime: agentActivityRuntime,
              workspaceId
            });
            setDetailError(message);
          }
        })
        .finally(() => {
          const queuedUpdate =
            queuedComposerSettingsUpdatesRef.current[agentSessionId] ?? null;
          if (queuedUpdate !== null) {
            delete queuedComposerSettingsUpdatesRef.current[agentSessionId];
            flushQueuedComposerSettingsUpdate({
              agentSessionId,
              sessionSettingsPatch: queuedUpdate.sessionSettingsPatch,
              nextNodeDefaults: queuedUpdate.nextNodeDefaults
            });
            return;
          }
          markSessionSettingsRequestState(agentSessionId, false);
        });
    },
    [
      agentActivityRuntime,
      isCurrentConversation,
      loadSessionState,
      markSessionSettingsRequestState,
      workspaceId,
      sessionViewRef
    ]
  );

  const updateComposerSettings = useCallback(
    (nextSettings: Partial<AgentSessionComposerSettings>) => {
      // Values pass through unclamped: the toggle visibility is capability
      // gated and the daemon clamps persisted settings per provider.
      const supportedNextSettings: Partial<AgentSessionComposerSettings> = {
        ...nextSettings
      };
      const agentSessionId = activeConversationIdRef.current;
      if (!agentSessionId) {
        const defaultDraftKey = nodeDefaultDraftKey(dataRef.current.provider);
        const storedDefaults = readNodeDefaultDraftSettings({
          data: dataRef.current,
          defaultReasoningEffort,
          drafts: draftSettingsBySessionIdRef.current
        });
        const previousSettings = resolveEffectiveComposerSettings({
          settings: storedDefaults
        });
        const merged = {
          ...previousSettings,
          ...supportedNextSettings,
          planMode: supportedNextSettings.planMode ?? previousSettings.planMode,
          browserUse:
            supportedNextSettings.browserUse ?? previousSettings.browserUse
        };
        draftSettingsBySessionIdRef.current = {
          ...draftSettingsBySessionIdRef.current,
          [defaultDraftKey]: merged
        };
        setDraftSettingsBySessionId((current) => ({
          ...current,
          [defaultDraftKey]: merged
        }));
        onDataChangeRef.current((current) =>
          nodeDataFromComposerSettings(current, merged)
        );
        void agentActivityRuntime.trackDraftComposerSettingsChange?.({
          workspaceId,
          provider: dataRef.current.provider,
          previousSettings,
          nextSettings: merged
        });
        loadDraftComposerOptions();
        return;
      }
      const activeSessionState =
        getAgentSessionView(sessionViewRef(agentSessionId))?.controlState ??
        null;
      const sessionSettings = cloneComposerSettings(
        activeSessionState?.settings ?? null
      );
      const currentDefaults = readNodeDefaultDraftSettings({
        data: dataRef.current,
        defaultReasoningEffort,
        drafts: draftSettingsBySessionIdRef.current
      });
      const baseDefaultsFromSession: AgentSessionComposerSettings = {
        ...currentDefaults,
        model: sessionSettings?.model ?? currentDefaults.model,
        reasoningEffort:
          sessionSettings?.reasoningEffort ?? currentDefaults.reasoningEffort,
        planMode: sessionSettings?.planMode ?? currentDefaults.planMode,
        browserUse: sessionSettings?.browserUse ?? currentDefaults.browserUse,
        permissionModeId:
          sessionSettings?.permissionModeId ?? currentDefaults.permissionModeId
      };
      const nextNodeDefaults: AgentSessionComposerSettings = {
        ...baseDefaultsFromSession,
        model:
          supportedNextSettings.model !== undefined
            ? supportedNextSettings.model
            : baseDefaultsFromSession.model,
        reasoningEffort:
          supportedNextSettings.reasoningEffort !== undefined
            ? supportedNextSettings.reasoningEffort
            : baseDefaultsFromSession.reasoningEffort,
        planMode:
          supportedNextSettings.planMode ?? baseDefaultsFromSession.planMode,
        browserUse:
          supportedNextSettings.browserUse ??
          baseDefaultsFromSession.browserUse,
        permissionModeId:
          supportedNextSettings.permissionModeId !== undefined
            ? supportedNextSettings.permissionModeId
            : baseDefaultsFromSession.permissionModeId
      };
      const persistNodeDefaults = () => {
        const defaultDraftKey = nodeDefaultDraftKey(dataRef.current.provider);
        setDraftSettingsBySessionId((current) => ({
          ...current,
          [defaultDraftKey]: nextNodeDefaults
        }));
        onDataChangeRef.current((current) =>
          nodeDataFromComposerSettings(current, nextNodeDefaults)
        );
      };
      const nextPermission = normalizeOptionalText(
        nextSettings.permissionModeId ??
          sessionSettings?.permissionModeId ??
          currentDefaults.permissionModeId
      );
      const currentPermission = normalizeOptionalText(
        sessionSettings?.permissionModeId
      );
      const nextModel =
        supportedNextSettings.model !== undefined
          ? normalizeOptionalText(supportedNextSettings.model)
          : undefined;
      const currentModel = normalizeOptionalText(sessionSettings?.model);
      const nextReasoningEffort =
        supportedNextSettings.reasoningEffort !== undefined
          ? (supportedNextSettings.reasoningEffort ?? null)
          : undefined;
      const currentReasoningEffort = sessionSettings?.reasoningEffort ?? null;
      const nextPlanMode = supportedNextSettings.planMode;
      const currentPlanMode = resolveEffectivePlanModeFromStates({
        sessionPlanModeState: planModeStateFromSessionState(activeSessionState),
        timelinePlanModeState:
          latestPlanModeStateFromTimelineItems(activeTimelineItems),
        fallbackPlanMode: sessionSettings?.planMode ?? false
      });
      const nextBrowserUse = supportedNextSettings.browserUse;
      // Browser use defaults on, so an unset stored value reads as true.
      const currentBrowserUse = sessionSettings?.browserUse ?? true;
      const sessionSettingsPatch: AgentSessionComposerSettings = {};

      if (nextModel !== undefined && nextModel !== currentModel) {
        sessionSettingsPatch.model = nextModel;
      }
      if (
        nextReasoningEffort !== undefined &&
        nextReasoningEffort !== currentReasoningEffort
      ) {
        sessionSettingsPatch.reasoningEffort = nextReasoningEffort;
      }
      if (nextPlanMode !== undefined && nextPlanMode !== currentPlanMode) {
        sessionSettingsPatch.planMode = nextPlanMode;
      }
      if (
        nextBrowserUse !== undefined &&
        nextBrowserUse !== currentBrowserUse
      ) {
        sessionSettingsPatch.browserUse = nextBrowserUse;
      }
      if (
        nextPermission &&
        nextPermission !== currentPermission &&
        activeSessionState !== null
      ) {
        sessionSettingsPatch.permissionModeId =
          normalizePermissionModeId(nextPermission);
      }
      if (
        Object.keys(sessionSettingsPatch).length > 0 &&
        activeSessionState !== null
      ) {
        persistNodeDefaults();
        updateAgentSessionViewControlState(
          sessionViewRef(agentSessionId),
          (existing) =>
            existing
              ? {
                  ...existing,
                  permissionModeId:
                    sessionSettingsPatch.permissionModeId ??
                    existing.permissionModeId,
                  runtimeContext: mergeRuntimeContextComposerSettings(
                    dataRef.current.provider,
                    existing.runtimeContext,
                    sessionSettingsPatch
                  ),
                  settings: {
                    ...(existing.settings ?? {}),
                    ...sessionSettingsPatch
                  }
                }
              : existing
        );
        if (updatingSessionSettingsIdsRef.current[agentSessionId]) {
          const queuedUpdate =
            queuedComposerSettingsUpdatesRef.current[agentSessionId];
          queuedComposerSettingsUpdatesRef.current[agentSessionId] = {
            sessionSettingsPatch: {
              ...(queuedUpdate?.sessionSettingsPatch ?? {}),
              ...sessionSettingsPatch
            },
            nextNodeDefaults
          };
        } else {
          markSessionSettingsRequestState(agentSessionId, true);
          flushQueuedComposerSettingsUpdate({
            agentSessionId,
            sessionSettingsPatch,
            nextNodeDefaults
          });
        }
        return;
      }
      persistNodeDefaults();
    },
    [
      defaultReasoningEffort,
      activeTimelineItems,
      flushQueuedComposerSettingsUpdate,
      loadDraftComposerOptions,
      markSessionSettingsRequestState,
      workspaceId,
      sessionViewRef
    ]
  );
  updateComposerSettingsRef.current = updateComposerSettings;

  const implementPlan = useCallback(() => {
    const agentSessionId = activeConversationIdRef.current;
    if (!agentSessionId) {
      return;
    }
    // The implement sequence (turn plan mode off on the daemon, then submit
    // the literal coding message) is defined once in planDecisionOps; here we
    // execute those ops with the controller's runtime primitives and layer on
    // the node-local UI effects (dismiss the plan card + mirror plan mode in
    // the composer) that the shared op list intentionally omits.
    const ops = planDecisionOps({
      promptKind: "plan-implementation",
      action: PLAN_IMPLEMENTATION_ACTION_IMPLEMENT,
      requestId: agentSessionId
    });
    // Sequential for-await (mirrors the desktop service's op executor): the
    // daemon planMode:false must settle before the literal prompt is submitted.
    void (async () => {
      try {
        for (const op of ops) {
          if (!isCurrentConversation(agentSessionId)) {
            return;
          }
          if (op.type === "updateSettings") {
            await agentActivityRuntime.updateSessionSettings({
              workspaceId,
              agentSessionId,
              settings: op.settings
            });
            if (!isCurrentConversation(agentSessionId)) {
              return;
            }
            dismissPlanImplementation();
            updateComposerSettingsRef.current({ planMode: false });
          } else if (op.type === "sendInput") {
            submitPrompt(textPromptContent(op.text));
          }
        }
      } catch (error) {
        if (!isCurrentConversation(agentSessionId)) {
          return;
        }
        reportAgentGUIRuntimeError({
          agentSessionId,
          error,
          phase: "update_session_settings",
          provider: dataRef.current.provider,
          runtime: agentActivityRuntime,
          workspaceId
        });
        setDetailError(getAgentGUIErrorMessage(error));
      }
    })();
  }, [
    agentActivityRuntime,
    dismissPlanImplementation,
    isCurrentConversation,
    submitPrompt,
    workspaceId
  ]);

  const submitPlanFeedback = useCallback(
    (feedback: string) => {
      dismissPlanImplementation();
      const trimmed = feedback.trim();
      if (!trimmed) {
        return;
      }
      // Feedback keeps plan mode on so the agent refines the plan rather than
      // implementing it (mirrors the codex TUI's "tell it how to adjust").
      submitPrompt(textPromptContent(trimmed));
    },
    [dismissPlanImplementation, submitPrompt]
  );
  planActionsRef.current = {
    implement: implementPlan,
    feedback: submitPlanFeedback,
    skip: dismissPlanImplementation
  };

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!activeConversationId) {
      return;
    }
    const queuedPrompt =
      (queuedPromptsBySessionId[activeConversationId] ?? [])[0] ?? null;
    const failedQueuedPromptId =
      failedQueuedPromptIdBySessionId[activeConversationId] ?? null;
    const queuedPromptRetryBlock =
      queuedPromptRetryBlockBySessionId[activeConversationId] ?? null;
    const activeSessionState =
      getAgentSessionView(sessionViewRef(activeConversationId))?.controlState ??
      null;
    const activeConversationSummary = resolveConversationSummaryById(
      conversations,
      activeConversationId,
      transientConversationRef.current
    );
    const blockedByStaleActiveTurnConflict =
      queuedPrompt !== null &&
      queuedPromptRetryBlock?.queuedPromptId === queuedPrompt.id &&
      queuedPromptRetryBlock.sessionStateUpdatedAtUnixMs ===
        (activeSessionState?.updatedAtUnixMs ?? null) &&
      queuedPromptRetryBlock.conversationUpdatedAtUnixMs ===
        (activeConversationSummary?.updatedAtUnixMs ?? null);
    const canDrainQueuedPrompt =
      queuedPrompt !== null &&
      queuedPrompt.id !== failedQueuedPromptId &&
      !blockedByStaleActiveTurnConflict &&
      drainingQueuedPromptSessionId === null &&
      !isSubmitting &&
      !isRespondingApproval &&
      pendingApprovalFromState(activeSessionState) === null &&
      pendingInteractiveFromState(activeSessionState) === null &&
      !conversationBusyStatus(activeConversationSummary?.status ?? null);
    if (!canDrainQueuedPrompt) {
      return;
    }
    setDrainingQueuedPromptSessionId(activeConversationId);
    executePrompt(
      activeConversationId,
      textPromptContent(queuedPrompt.prompt),
      queuedPrompt.id
    );
  }, [
    activeConversationId,
    conversations,
    drainingQueuedPromptSessionId,
    executePrompt,
    isRespondingApproval,
    isSubmitting,
    failedQueuedPromptIdBySessionId,
    previewMode,
    queuedPromptRetryBlockBySessionId,
    queuedPromptsBySessionId
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (!activeConversationId) {
      return;
    }
    const sendNextQueuedPromptId =
      sendNextQueuedPromptIdBySessionId[activeConversationId] ?? null;
    const queuedPrompts = queuedPromptsBySessionId[activeConversationId] ?? [];
    if (
      !sendNextQueuedPromptId ||
      queuedPrompts[0]?.id !== sendNextQueuedPromptId
    ) {
      return;
    }
    const activeSessionState =
      getAgentSessionView(sessionViewRef(activeConversationId))?.controlState ??
      null;
    if (
      pendingApprovalFromState(activeSessionState) !== null ||
      pendingInteractiveFromState(activeSessionState) !== null
    ) {
      return;
    }
    const activeConversationSummary = resolveConversationSummaryById(
      conversations,
      activeConversationId,
      transientConversationRef.current
    );
    const shouldInterrupt =
      drainingQueuedPromptSessionId === null &&
      !isSubmitting &&
      conversationBusyStatus(activeConversationSummary?.status ?? null);
    if (!shouldInterrupt || interruptingSessionIds[activeConversationId]) {
      return;
    }

    setInterruptingSessionIds((current) => ({
      ...current,
      [activeConversationId]: true
    }));
    setDetailError(null);
    void Promise.resolve()
      .then(() => {
        if (!isCurrentConversation(activeConversationId)) {
          return null;
        }
        return agentActivityRuntime.cancelSession({
          workspaceId,
          agentSessionId: activeConversationId
        });
      })
      .then((result) => {
        if (!result || !isCurrentConversation(activeConversationId)) {
          return;
        }
        reportAgentGUICancelDiagnostic({
          agentSessionId: activeConversationId,
          busySource: cancelBusySource({
            conversationStatus: activeConversationSummary?.status ?? null,
            hasActivePrompt: false,
            runtimeSessionStatus:
              runtimeSessionsBySessionId.get(activeConversationId)?.status ??
              null,
            sessionStateStatus: activeSessionState?.status ?? null
          }),
          currentSessionStatus: activeSessionState?.status ?? null,
          phase: "drain_queued_prompt_interrupt",
          provider: dataRef.current.provider,
          result,
          runtime: agentActivityRuntime,
          workspaceId
        });
        void refreshMessagesFromSnapshot(activeConversationId);
        void loadSessionState(activeConversationId);
        void syncConversationListProjection(activeConversationId);
      })
      .catch((error) => {
        if (isCurrentConversation(activeConversationId)) {
          reportAgentGUIRuntimeError({
            agentSessionId: activeConversationId,
            error,
            phase: "drain_queued_prompt_interrupt",
            provider: dataRef.current.provider,
            runtime: agentActivityRuntime,
            workspaceId
          });
          setDetailError(getAgentGUIErrorMessage(error));
        }
      })
      .finally(() => {
        setInterruptingSessionIds((current) => {
          if (!current[activeConversationId]) {
            return current;
          }
          const next = { ...current };
          delete next[activeConversationId];
          return next;
        });
      });
  }, [
    activeConversationId,
    conversations,
    drainingQueuedPromptSessionId,
    interruptingSessionIds,
    isCurrentConversation,
    isSubmitting,
    syncConversationListProjection,
    loadSessionState,
    refreshMessagesFromSnapshot,
    previewMode,
    queuedPromptsBySessionId,
    runtimeSessionsBySessionId,
    workspaceId,
    sessionViewRef,
    sendNextQueuedPromptIdBySessionId,
    agentActivityRuntime
  ]);

  const requestDeleteConversation = useCallback(
    (agentSessionId: string) => {
      const normalized = agentSessionId.trim();
      if (!normalized || isDeletingConversation) {
        return;
      }
      const conversation = conversations.find(
        (candidate) => candidate.id === normalized
      );
      if (!conversation) {
        return;
      }
      setPendingDeleteConversation(conversation);
      setDetailError(null);
    },
    [conversations, isDeletingConversation]
  );

  const cancelDeleteConversation = useCallback(() => {
    if (isDeletingConversation) {
      return;
    }
    setPendingDeleteConversation(null);
  }, [isDeletingConversation]);

  const removeQueuedPrompt = useCallback((queuedPromptId: string) => {
    const agentSessionId = activeConversationIdRef.current;
    const normalizedQueuedPromptId = queuedPromptId.trim();
    if (!agentSessionId || !normalizedQueuedPromptId) {
      return;
    }
    setQueuedPromptsBySessionId((current) => {
      const queue = current[agentSessionId] ?? [];
      const queuedPrompt =
        queue.find((item) => item.id === normalizedQueuedPromptId) ?? null;
      if (!queuedPrompt) {
        return current;
      }
      return {
        ...current,
        [agentSessionId]: removeQueuedPromptById(
          queue,
          normalizedQueuedPromptId
        )
      };
    });
    setSendNextQueuedPromptIdBySessionId((current) => {
      if (current[agentSessionId] !== normalizedQueuedPromptId) {
        return current;
      }
      return { ...current, [agentSessionId]: null };
    });
    setFailedQueuedPromptIdBySessionId((current) => {
      if (current[agentSessionId] !== normalizedQueuedPromptId) {
        return current;
      }
      return { ...current, [agentSessionId]: null };
    });
    setQueuedPromptRetryBlockBySessionId((current) => {
      if (
        current[agentSessionId]?.queuedPromptId !== normalizedQueuedPromptId
      ) {
        return current;
      }
      return { ...current, [agentSessionId]: null };
    });
  }, []);

  const editQueuedPrompt = useCallback(
    (queuedPromptId: string) => {
      const agentSessionId = activeConversationIdRef.current;
      const normalizedQueuedPromptId = queuedPromptId.trim();
      if (!agentSessionId || !normalizedQueuedPromptId) {
        return;
      }
      const queue = queuedPromptsBySessionId[agentSessionId] ?? [];
      const queuedPrompt =
        queue.find((item) => item.id === normalizedQueuedPromptId) ?? null;
      if (!queuedPrompt) {
        return;
      }
      setQueuedPromptsBySessionId((current) => ({
        ...current,
        [agentSessionId]: removeQueuedPromptById(
          current[agentSessionId] ?? [],
          normalizedQueuedPromptId
        )
      }));
      setDraftBySessionId((current) => ({
        ...current,
        [agentSessionId]: queuedPrompt.prompt
      }));
      setSendNextQueuedPromptIdBySessionId((current) => {
        if (current[agentSessionId] !== normalizedQueuedPromptId) {
          return current;
        }
        return { ...current, [agentSessionId]: null };
      });
      setFailedQueuedPromptIdBySessionId((current) => {
        if (current[agentSessionId] !== normalizedQueuedPromptId) {
          return current;
        }
        return { ...current, [agentSessionId]: null };
      });
      setQueuedPromptRetryBlockBySessionId((current) => {
        if (
          current[agentSessionId]?.queuedPromptId !== normalizedQueuedPromptId
        ) {
          return current;
        }
        return { ...current, [agentSessionId]: null };
      });
    },
    [queuedPromptsBySessionId]
  );

  const sendQueuedPromptNext = useCallback(
    (queuedPromptId: string) => {
      const agentSessionId = activeConversationIdRef.current;
      const normalizedQueuedPromptId = queuedPromptId.trim();
      if (!agentSessionId || !normalizedQueuedPromptId) {
        return;
      }
      const queue = [...(queuedPromptsBySessionId[agentSessionId] ?? [])];
      const queueIndex = queue.findIndex(
        (item) => item.id === normalizedQueuedPromptId
      );
      if (queueIndex < 0) {
        return;
      }
      if (queueIndex > 0) {
        const [selected] = queue.splice(queueIndex, 1);
        queue.unshift(selected!);
      }
      setQueuedPromptsBySessionId((current) => ({
        ...current,
        [agentSessionId]: queue
      }));
      setSendNextQueuedPromptIdBySessionId((current) => ({
        ...current,
        [agentSessionId]: normalizedQueuedPromptId
      }));
      setFailedQueuedPromptIdBySessionId((current) => {
        if (current[agentSessionId] !== normalizedQueuedPromptId) {
          return current;
        }
        return { ...current, [agentSessionId]: null };
      });
      setQueuedPromptRetryBlockBySessionId((current) => {
        if (
          current[agentSessionId]?.queuedPromptId !== normalizedQueuedPromptId
        ) {
          return current;
        }
        return { ...current, [agentSessionId]: null };
      });
    },
    [queuedPromptsBySessionId]
  );

  const removeProject = useCallback(
    (path: string) => {
      const normalizedPath = path.trim();
      const remove = agentHostApi.userProjects?.remove;
      if (!normalizedPath || !remove) {
        return;
      }
      const previousProjects = userProjectsRef.current;
      setListError(null);
      setUserProjectsSnapshot(
        previousProjects.filter((project) => project.path !== normalizedPath)
      );
      const handleRemoveError = (error: unknown) => {
        const message = getAgentGUIErrorMessage(error);
        setUserProjectsSnapshot(previousProjects);
        setListError(message);
        toast.error(message);
      };
      try {
        void Promise.resolve(remove({ path: normalizedPath })).catch(
          handleRemoveError
        );
      } catch (error) {
        handleRemoveError(error);
      }
    },
    [agentHostApi.userProjects, setUserProjectsSnapshot]
  );

  const requestDeleteProjectConversations = useCallback(
    (path: string) => {
      const normalizedPath = normalizeProjectConversationPath(path);
      if (!normalizedPath || isDeletingProjectConversations) {
        return;
      }
      const targetConversations = conversationsRef.current.filter(
        (conversation) =>
          normalizeProjectConversationPath(conversation.project?.path) ===
          normalizedPath
      );
      if (targetConversations.length === 0) {
        return;
      }
      const project = userProjectsRef.current.find(
        (candidate) =>
          normalizeProjectConversationPath(candidate.path) === normalizedPath
      );
      setPendingDeleteProjectConversations({
        conversationCount: targetConversations.length,
        label:
          project?.label?.trim() ||
          targetConversations[0]?.project?.label ||
          path,
        path: normalizedPath
      });
      setDetailError(null);
      setListError(null);
    },
    [isDeletingProjectConversations]
  );

  const cancelDeleteProjectConversations = useCallback(() => {
    if (isDeletingProjectConversations) {
      return;
    }
    setPendingDeleteProjectConversations(null);
  }, [isDeletingProjectConversations]);

  const confirmDeleteConversation = useCallback(() => {
    const target = pendingDeleteConversation;
    if (!target || isDeletingConversation) {
      return;
    }
    setIsDeletingConversation(true);
    setDetailError(null);
    void activation
      .unactivate(target.id)
      .then(() =>
        agentActivityRuntime.deleteSession({
          workspaceId,
          agentSessionId: target.id
        })
      )
      .then(() => {
        activatedConversationIdsRef.current.delete(target.id);
        if (conversationListQuery) {
          markLocalDeletedAgentGUIConversation({
            query: conversationListQuery,
            agentSessionId: target.id
          });
          scheduleAgentGUIConversationListProjection(
            conversationListQuery,
            "local-delete"
          );
        }
        setTransientConversation((current) =>
          current?.id === target.id ? null : current
        );
        setDraftBySessionId((current) => {
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        setQueuedPromptsBySessionId((current) => {
          if (!current[target.id]) {
            return current;
          }
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        setSendNextQueuedPromptIdBySessionId((current) => {
          if (!(target.id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        setFailedQueuedPromptIdBySessionId((current) => {
          if (!(target.id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        setQueuedPromptRetryBlockBySessionId((current) => {
          if (!(target.id in current)) {
            return current;
          }
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        deleteAgentSessionView(sessionViewRef(target.id));
        updateConversationList((current) => {
          const targetIndex = current.findIndex(
            (conversation) => conversation.id === target.id
          );
          const next = current.filter(
            (conversation) => conversation.id !== target.id
          );
          if (activeConversationIdRef.current === target.id) {
            const nextActive =
              next[Math.max(0, targetIndex)]?.id ??
              next[Math.max(0, targetIndex - 1)]?.id ??
              null;
            activeConversationIdRef.current = nextActive;
            setActiveConversationId(nextActive);
            persistActiveConversation(nextActive);
          }
          return next;
        });
        setPendingDeleteConversation(null);
      })
      .catch((error) => {
        const message = getAgentGUIErrorMessage(error);
        reportAgentGUIRuntimeError({
          agentSessionId: target.id,
          error,
          phase: "delete_conversation",
          provider: target.provider,
          runtime: agentActivityRuntime,
          workspaceId
        });
        toast.error(message);
        setDetailError(message);
      })
      .finally(() => {
        setIsDeletingConversation(false);
      });
  }, [
    activation,
    isDeletingConversation,
    pendingDeleteConversation,
    persistActiveConversation,
    workspaceId,
    sessionViewRef,
    agentActivityRuntime
  ]);

  const confirmDeleteProjectConversations = useCallback(
    (path?: string) => {
      const normalizedPath = normalizeProjectConversationPath(path);
      const target =
        normalizedPath !== ""
          ? {
              conversationCount: conversationsRef.current.filter(
                (conversation) =>
                  normalizeProjectConversationPath(
                    conversation.project?.path
                  ) === normalizedPath
              ).length,
              label:
                userProjectsRef.current.find(
                  (project) =>
                    normalizeProjectConversationPath(project.path) ===
                    normalizedPath
                )?.label ??
                path ??
                normalizedPath,
              path: normalizedPath
            }
          : pendingDeleteProjectConversations;
      if (!target || isDeletingProjectConversations) {
        return;
      }
      const targetConversations = conversationsRef.current.filter(
        (conversation) =>
          normalizeProjectConversationPath(conversation.project?.path) ===
          target.path
      );
      if (targetConversations.length === 0) {
        setPendingDeleteProjectConversations(null);
        return;
      }
      const targetIds = new Set(
        targetConversations.map((conversation) => conversation.id)
      );
      setIsDeletingProjectConversations(true);
      setDetailError(null);
      setListError(null);
      void Promise.all(
        targetConversations.map(async (conversation) => {
          await activation.unactivate(conversation.id);
          await agentActivityRuntime.deleteSession({
            workspaceId,
            agentSessionId: conversation.id
          });
        })
      )
        .then(() => {
          for (const id of targetIds) {
            activatedConversationIdsRef.current.delete(id);
            deleteAgentSessionView(sessionViewRef(id));
          }
          if (conversationListQuery) {
            for (const id of targetIds) {
              markLocalDeletedAgentGUIConversation({
                query: conversationListQuery,
                agentSessionId: id
              });
            }
            scheduleAgentGUIConversationListProjection(
              conversationListQuery,
              "local-delete"
            );
          }
          setTransientConversation((current) =>
            current && targetIds.has(current.id) ? null : current
          );
          setDraftBySessionId((current) =>
            omitConversationLocalState(current, targetIds)
          );
          setQueuedPromptsBySessionId((current) =>
            omitConversationLocalState(current, targetIds)
          );
          setSendNextQueuedPromptIdBySessionId((current) =>
            omitConversationLocalState(current, targetIds)
          );
          setFailedQueuedPromptIdBySessionId((current) =>
            omitConversationLocalState(current, targetIds)
          );
          setQueuedPromptRetryBlockBySessionId((current) =>
            omitConversationLocalState(current, targetIds)
          );
          updateConversationList((current) => {
            const next = current.filter(
              (conversation) => !targetIds.has(conversation.id)
            );
            const currentActiveId = activeConversationIdRef.current;
            if (currentActiveId && targetIds.has(currentActiveId)) {
              const nextActive = next[0]?.id ?? null;
              activeConversationIdRef.current = nextActive;
              setActiveConversationId(nextActive);
              persistActiveConversation(nextActive);
            }
            return next;
          });
          setPendingDeleteProjectConversations(null);
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
              projectPath: target.path,
              conversationCount: targetConversations.length
            }
          });
          setListError(message);
          toast.error(message);
          setDetailError(message);
        })
        .finally(() => {
          setIsDeletingProjectConversations(false);
        });
    },
    [
      activation,
      agentActivityRuntime,
      conversationListQuery,
      isDeletingProjectConversations,
      pendingDeleteProjectConversations,
      persistActiveConversation,
      sessionViewRef,
      setTransientConversation,
      updateConversationList,
      workspaceId
    ]
  );

  const toggleConversationPinned = useCallback(
    (agentSessionId: string, pinned: boolean) => {
      const normalizedAgentSessionId = agentSessionId.trim();
      if (!normalizedAgentSessionId) {
        return;
      }
      setDetailError(null);
      const previousConversations = conversationsRef.current;
      const optimisticPinnedAtUnixMs = pinned ? Date.now() : null;
      updateConversationList((current) =>
        current.map((conversation) =>
          conversation.id === normalizedAgentSessionId
            ? { ...conversation, pinnedAtUnixMs: optimisticPinnedAtUnixMs }
            : conversation
        )
      );
      setTransientConversation((current) =>
        current?.id === normalizedAgentSessionId
          ? { ...current, pinnedAtUnixMs: optimisticPinnedAtUnixMs }
          : current
      );
      void agentActivityRuntime
        .setSessionPinned({
          workspaceId,
          agentSessionId: normalizedAgentSessionId,
          pinned
        })
        .then((session) => {
          const pinnedAtUnixMs = session.pinnedAtUnixMs ?? null;
          updateConversationList((current) =>
            current.map((conversation) =>
              conversation.id === normalizedAgentSessionId
                ? { ...conversation, pinnedAtUnixMs }
                : conversation
            )
          );
          setTransientConversation((current) =>
            current?.id === normalizedAgentSessionId
              ? { ...current, pinnedAtUnixMs }
              : current
          );
        })
        .catch((error) => {
          const message = getAgentGUIErrorMessage(error);
          reportAgentGUIRuntimeError({
            agentSessionId: normalizedAgentSessionId,
            context: { pinned },
            error,
            phase: "toggle_conversation_pinned",
            provider: dataRef.current.provider,
            runtime: agentActivityRuntime,
            workspaceId
          });
          toast.error(message);
          setDetailError(message);
          updateConversationList(() => previousConversations);
          setTransientConversation((current) => {
            const previous = previousConversations.find(
              (conversation) => conversation.id === normalizedAgentSessionId
            );
            return current?.id === normalizedAgentSessionId && previous
              ? previous
              : current;
          });
        });
    },
    [agentActivityRuntime, updateConversationList, workspaceId]
  );

  const activeConversation = useMemo(() => {
    const resolved = resolveConversationSummaryById(
      conversations,
      activeConversationId,
      transientConversationRef.current
    );
    if (resolved) {
      const pendingTurnId = pendingTurnIdBySessionIdRef.current[resolved.id];
      const nextConversation =
        resolved.status === "ready" && pendingTurnId
          ? { ...resolved, status: "working" as const }
          : resolved;
      return mergeConversationSummaryWithRuntimeSession({
        conversation: nextConversation,
        runtimeSyncState: stableRuntimeSyncStateBySessionId[resolved.id]
      });
    }
    if (!activeConversationId) {
      return resolved;
    }
    const providerLabel =
      AGENT_PROVIDER_LABEL[data.provider] ?? data.provider ?? "Agent";
    const fallbackStatus =
      isSubmitting ||
      isCreatingConversation ||
      Object.prototype.hasOwnProperty.call(
        draftBySessionId,
        activeConversationId
      )
        ? ("working" as const)
        : ("ready" as const);
    const fallbackUpdatedAtUnixMs = Date.now();
    return {
      id: activeConversationId,
      userId: currentUserId?.trim() || undefined,
      provider: data.provider,
      title: providerLabel,
      titleFallback: null,
      status: fallbackStatus,
      cwd: workspacePath,
      project: resolveAgentGUIConversationProject(workspacePath, userProjects, {
        isNoProjectPath
      }),
      sortTimeUnixMs: fallbackUpdatedAtUnixMs,
      updatedAtUnixMs: fallbackUpdatedAtUnixMs,
      syncState: undefined
    };
  }, [
    activeConversationId,
    conversations,
    currentUserId,
    data.provider,
    draftBySessionId,
    isCreatingConversation,
    isSubmitting,
    isNoProjectPath,
    stableRuntimeSyncStateBySessionId,
    transientConversation,
    userProjects,
    workspacePath
  ]);
  const visibleConversationsRef = useRef<AgentGUIConversationSummary[] | null>(
    null
  );
  const visibleConversations = useMemo(() => {
    const source = isLoadingConversations
      ? mergeVisibleConversations(
          conversations,
          transientConversationRef.current
        )
      : conversations;
    const next = source.map((conversation) =>
      mergeConversationSummaryWithRuntimeSession({
        conversation,
        runtimeSyncState: stableRuntimeSyncStateBySessionId[conversation.id]
      })
    );
    const stableNext = stableConversationSummaryList(
      visibleConversationsRef.current,
      next
    );
    visibleConversationsRef.current = stableNext;
    return stableNext;
  }, [
    conversations,
    isLoadingConversations,
    stableRuntimeSyncStateBySessionId,
    transientConversation
  ]);
  const conversationUserIds = useMemo(
    () =>
      [
        ...new Set(
          conversations
            .map((conversation) => conversation.userId?.trim() ?? "")
            .filter(Boolean)
        )
      ].sort(),
    [conversations]
  );

  useEffect(() => {
    if (conversationUserIds.length === 0) {
      return;
    }
    ensureAccountProfiles({ userIds: conversationUserIds }).catch(
      () => undefined
    );
  }, [conversationUserIds, ensureAccountProfiles]);
  const projectionConversationRef =
    useRef<AgentGUIConversationProjectionSource | null>(null);
  const projectionConversation =
    useMemo<AgentGUIConversationProjectionSource | null>(() => {
      if (!activeConversation) {
        projectionConversationRef.current = null;
        return null;
      }
      const previous = projectionConversationRef.current;
      if (
        previous &&
        previous.id === activeConversation.id &&
        previous.userId === activeConversation.userId &&
        previous.provider === activeConversation.provider &&
        previous.title === activeConversation.title &&
        previous.titleFallback === activeConversation.titleFallback &&
        previous.status === activeConversation.status &&
        previous.cwd === activeConversation.cwd &&
        previous.project === activeConversation.project
      ) {
        return previous;
      }
      const next = activeConversation
        ? {
            id: activeConversation.id,
            userId: activeConversation.userId,
            provider: activeConversation.provider,
            title: activeConversation.title,
            titleFallback: activeConversation.titleFallback,
            status: activeConversation.status,
            cwd: activeConversation.cwd,
            project: activeConversation.project,
            updatedAtUnixMs: activeConversation.updatedAtUnixMs,
            syncState: activeConversation.syncState
          }
        : null;
      projectionConversationRef.current = next;
      return next;
    }, [
      // Keep projection stable for summary-only sync/updatedAt patches; the timeline itself drives
      // detail freshness, and rebuilding the projection here was the hot idle path in long sessions.
      activeConversation?.cwd,
      activeConversation?.id,
      activeConversation?.provider,
      activeConversation?.project,
      activeConversation?.status,
      activeConversation?.title,
      activeConversation?.titleFallback,
      activeConversation?.userId
    ]);
  const draftPrompt = activeConversationId
    ? (draftBySessionId[activeConversationId] ?? "")
    : readNodeDefaultDraftPrompt({
        data,
        drafts: draftBySessionId
      });
  const availableCommands =
    activeSessionView?.controlCommands ?? EMPTY_AGENT_GUI_AVAILABLE_COMMANDS;
  const availableSkills = useStableProviderSkillOptions(
    useMemo(
      () => providerSkillsFromComposerOptions(providerComposerOptions),
      [providerComposerOptions]
    )
  );
  const conversationDetail = useMemo(
    () =>
      projectionConversation
        ? buildAgentGUIConversationDetail({
            timelineItems: activeTimelineItems,
            conversation: projectionConversation,
            workspaceRoot: workspacePath
          })
        : null,
    [activeTimelineItems, projectionConversation, workspacePath]
  );
  const conversation = useMemo(
    () =>
      projectionConversation
        ? buildAgentGUIConversationVM({
            timelineItems: activeTimelineItems,
            conversation: projectionConversation,
            workspaceRoot: workspacePath,
            avoidGroupingEdits
          })
        : null,
    [
      activeTimelineItems,
      avoidGroupingEdits,
      projectionConversation,
      workspacePath
    ]
  );
  const activeLiveState = activeConversationLiveState;
  const activationError = activation.errorFor(activeConversationId);
  const activationErrorCode = activation.codeFor(activeConversationId);
  const hasProviderSessionNotFoundError =
    isNonRetryableResumeErrorCode(activationErrorCode);
  const activeStatePatchError =
    activeConversationId !== null
      ? (statePatchErrorBySessionId[activeConversationId] ?? null)
      : null;

  useEffect(() => {
    if (
      activeConversationId !== null &&
      activeConversation?.status === "failed" &&
      activeStatePatchError &&
      detailError === null
    ) {
      setDetailError(activeStatePatchError);
    }
  }, [
    activeConversation?.status,
    activeConversationId,
    activeStatePatchError,
    detailError
  ]);

  const rawPendingApproval = useMemo(
    () =>
      interactiveApprovalFromSessionState(activeSessionState) ??
      approvalRequestFromConversation(conversation),
    [activeSessionState, conversation]
  );
  const rawPendingInteractivePrompt = useMemo<AgentGUIInteractivePrompt | null>(
    () =>
      interactivePromptFromSessionState(activeSessionState) ??
      interactivePromptFromConversation(conversation),
    [activeSessionState, conversation]
  );
  const activeRawPromptRequestId =
    promptRequestId(rawPendingInteractivePrompt) ??
    promptRequestId(rawPendingApproval);
  const suppressedPromptRequestId =
    activeConversationId !== null
      ? (suppressedPromptRequestIdsBySessionId[activeConversationId] ?? null)
      : null;
  const isActivePromptSuppressed =
    activeRawPromptRequestId !== null &&
    activeRawPromptRequestId === suppressedPromptRequestId;

  useEffect(() => {
    activePendingPromptRef.current =
      activeConversationId !== null && activeRawPromptRequestId !== null
        ? {
            sessionId: activeConversationId,
            requestId: activeRawPromptRequestId,
            kind: rawPendingInteractivePrompt?.kind ?? null
          }
        : null;
  }, [
    activeConversationId,
    activeRawPromptRequestId,
    rawPendingInteractivePrompt
  ]);

  useEffect(() => {
    if (activeConversationId === null || suppressedPromptRequestId === null) {
      return;
    }
    if (activeRawPromptRequestId === suppressedPromptRequestId) {
      return;
    }
    setSuppressedPromptRequestIdsBySessionId((current) => {
      if (current[activeConversationId] !== suppressedPromptRequestId) {
        return current;
      }
      const next = { ...current };
      delete next[activeConversationId];
      return next;
    });
  }, [
    activeConversationId,
    activeRawPromptRequestId,
    suppressedPromptRequestId
  ]);

  const pendingApproval =
    hasProviderSessionNotFoundError || isActivePromptSuppressed
      ? null
      : rawPendingApproval;
  const serverInteractivePrompt =
    hasProviderSessionNotFoundError || isActivePromptSuppressed
      ? null
      : rawPendingInteractivePrompt;
  const isInterrupting =
    activeConversationId !== null &&
    Boolean(interruptingSessionIds[activeConversationId]);
  const queuedPrompts = useMemo(
    () =>
      activeConversationId !== null
        ? (queuedPromptsBySessionId[activeConversationId] ?? [])
        : [],
    [activeConversationId, queuedPromptsBySessionId]
  );
  const drainingQueuedPromptId =
    drainingQueuedPromptSessionId === activeConversationId
      ? (queuedPrompts[0]?.id ?? null)
      : null;
  const sessionSettings = useStableComposerSettings(
    cloneComposerSettings(activeSessionState?.settings ?? null)
  );
  const storedNodeDefaultSettings = useStableComposerSettings(
    readNodeDefaultDraftSettings({
      data,
      defaultReasoningEffort,
      drafts: draftSettingsBySessionId
    })
  );
  const homeComposerSettings = useStableComposerSettings(
    resolveEffectiveComposerSettings({
      settings: storedNodeDefaultSettings
    })
  );
  const activeConversationDraftSettings = activeConversationId
    ? (draftSettingsBySessionId[activeConversationId] ?? null)
    : null;
  const defaultConversationDraftSettings = useStableComposerSettings({
    ...(activeConversationDraftSettings ?? homeComposerSettings),
    permissionModeId:
      normalizePermissionModeId(activeSessionState?.permissionModeId) ??
      normalizePermissionModeId(
        (activeConversationDraftSettings ?? homeComposerSettings)
          .permissionModeId
      )
  });
  const draftSettings = activeConversationId
    ? (sessionSettings ?? defaultConversationDraftSettings)
    : homeComposerSettings;
  const draftModel = normalizeOptionalText(draftSettings.model);
  const draftReasoningEffort = normalizeOptionalText(
    draftSettings.reasoningEffort
  ) as AgentSessionReasoningEffort | null;
  // The offer is derived from the same timeline data that renders the plan
  // card (the latest turn produced a plan item), gated on codex + plan mode
  // and a settled (non-working) conversation. No status-edge/runtimeContext
  // race; keyed by plan turn id so dismiss suppresses only that plan.
  const planImplementationTurnId =
    activeConversationId !== null &&
    dataRef.current.provider === "codex" &&
    composerSupport.plan &&
    Boolean(draftSettings.planMode) &&
    activeConversation?.status !== "working"
      ? latestPlanTurnId(activeTimelineItems)
      : null;
  planImplementationTurnIdRef.current = planImplementationTurnId;
  // Fold the codex plan decision into the unified interactive-prompt machinery
  // (server exit-plan wins if both somehow apply). Suppressed once skipped for
  // that plan turn; a fresh plan turn re-arms it.
  const planImplementationPromptVM =
    planImplementationTurnId !== null &&
    activeConversationId !== null &&
    dismissedPlanTurnIdBySessionId[activeConversationId] !==
      planImplementationTurnId
      ? planImplementationPromptFromPlanTurn(
          planImplementationTurnId,
          activeConversation?.title ?? ""
        )
      : null;
  const pendingInteractivePrompt =
    serverInteractivePrompt ?? planImplementationPromptVM;
  const activeRuntimeSession =
    runtimeSessionsBySessionId.get(activeConversationId ?? "") ?? null;
  const activeConversationBusy =
    conversationBusyStatus(activeConversation?.status ?? null) ||
    agentSessionStatusBusy({
      status: activeRuntimeSession?.status ?? activeSessionState?.status
    }) ||
    conversationHasActiveWork(conversation) ||
    pendingApproval !== null;
  const activeSessionResumable =
    activeRuntimeSession?.resumable ??
    activeConversation?.resumable ??
    activeSessionState?.resumable;
  const normalizedActiveConversationId = activeConversationId ?? "";
  const activeConversationActivationState = activeConversationId
    ? activation.stateFor(activeConversationId)
    : null;
  const activeConversationRequiresResume =
    normalizedActiveConversationId !== "" &&
    !activatedConversationIdsRef.current.has(normalizedActiveConversationId) &&
    activeConversationActivationState !== "active";
  const activeConversationResumeUnavailable =
    activeConversationRequiresResume && activeSessionResumable === false;
  const hasSentUserMessage = activeTimelineItems.some(
    (item) => item.role === "user"
  );
  const sessionChrome = useMemo<AgentGUISessionChrome>(() => {
    const normalizedError = activationError?.trim() ?? "";
    const authState = activeSessionState?.authState?.trim() ?? "";
    const runtimeContext = activeSessionState?.runtimeContext ?? null;
    const authMessageFromRuntime =
      typeof runtimeContext?.authMessage === "string" &&
      runtimeContext.authMessage.trim()
        ? runtimeContext.authMessage.trim()
        : null;
    const isAuthError =
      !hasProviderSessionNotFoundError &&
      (authState !== "" ||
        (normalizedError !== "" &&
          /auth|sign in|log in|login|unauthorized|authenticated/i.test(
            normalizedError
          )));
    const recoveryMessage =
      normalizedError ||
      (activeConversationResumeUnavailable
        ? translate("messages.agentResumeSessionNotLocal")
        : "");
    const recoveryIsNonRetryable =
      isNonRetryableResumeErrorCode(activationErrorCode) ||
      activeConversationResumeUnavailable;
    return {
      auth: hasProviderSessionNotFoundError
        ? null
        : authState !== ""
          ? { message: authMessageFromRuntime ?? authState }
          : isAuthError
            ? { message: normalizedError }
            : null,
      approval: pendingApproval,
      recovery:
        activeLiveState === "activating"
          ? {
              kind: "activating",
              // i18n-check-ignore: Legacy recovery fallback copy; localized presentation should move to view labels.
              message: "Reconnecting to the live agent session…"
            }
          : !isAuthError && recoveryMessage
            ? {
                kind: "failed",
                message: recoveryMessage,
                canRetry: !recoveryIsNonRetryable,
                ...(isResumeSessionNotLocalErrorCode(activationErrorCode) ||
                activeConversationResumeUnavailable
                  ? { followupAction: "continue-in-new-conversation" as const }
                  : {})
              }
            : null,
      rawState: activeSessionState
    };
  }, [
    activationError,
    activationErrorCode,
    activeLiveState,
    activeConversationResumeUnavailable,
    activeSessionState,
    hasProviderSessionNotFoundError,
    pendingApproval
  ]);
  const canSubmit =
    activeLiveState !== "activating" &&
    activeLiveState !== "failed" &&
    !activeConversationResumeUnavailable &&
    (data.provider !== "openclaw" || openclawGateway?.status === "ready") &&
    pendingApproval === null &&
    pendingInteractivePrompt === null &&
    sessionChrome.auth === null &&
    !isCreatingConversation &&
    !isSubmitting &&
    !isInterrupting;
  const canQueueWhileBusy =
    Boolean(activeConversationId) &&
    (activeConversationBusy ||
      isSubmitting ||
      pendingInteractivePrompt !== null);
  const activeSessionReasoningSelection = useMemo(
    () =>
      reasoningSelectionFromComposerOptions(
        providerComposerOptions,
        draftReasoningEffort
      ),
    [draftReasoningEffort, providerComposerOptions]
  );
  const activeSessionModelSelection = useMemo(
    () =>
      modelSelectionFromComposerOptions(providerComposerOptions, draftModel),
    [draftModel, providerComposerOptions]
  );
  const { effectivePlanMode, timelinePlanModeState } = usePlanModeState({
    activeTimelineItems,
    activeSessionState,
    draftPlanMode: draftSettings.planMode
  });
  const composerSettings = useMemo<AgentGUIComposerSettingsVM>(
    () =>
      buildAgentComposerSettingsVM({
        data,
        activeConversationId,
        activeConversationCwd: activeConversation?.cwd,
        selectedProjectPath,
        sessionSettings,
        draftSettings,
        draftModel,
        draftReasoningEffort,
        effectivePlanMode,
        composerSupport,
        providerComposerOptions,
        activeSessionModelSelection,
        activeSessionReasoningSelection
      }),
    [
      activeConversationId,
      activeConversation?.cwd,
      activeSessionModelSelection,
      activeSessionReasoningSelection,
      draftSettings.permissionModeId,
      draftSettings.planMode,
      effectivePlanMode,
      providerComposerOptions,
      sessionSettings,
      selectedProjectPath,
      composerSupport,
      draftModel,
      draftReasoningEffort,
      data
    ]
  );

  const stableCreateConversation =
    useStableControllerEventCallback(createConversation);
  const stableSelectConversation =
    useStableControllerEventCallback(selectConversation);
  const stableSubmitPrompt = useStableControllerEventCallback(submitPrompt);
  const stableShowPromptImagesUnsupported = useStableControllerEventCallback(
    showPromptImagesUnsupported
  );
  const stableSubmitApprovalOption =
    useStableControllerEventCallback(submitApprovalOption);
  const stableSubmitInteractivePrompt = useStableControllerEventCallback(
    submitInteractivePrompt
  );
  const stableInterruptCurrentTurn =
    useStableControllerEventCallback(interruptCurrentTurn);
  const stableUpdateDraftPrompt =
    useStableControllerEventCallback(updateDraftPrompt);
  const stableUpdateSelectedProjectPath = useStableControllerEventCallback(
    updateSelectedProjectPath
  );
  const stableUpdateComposerSettings = useStableControllerEventCallback(
    updateComposerSettings
  );
  const stableSendQueuedPromptNext =
    useStableControllerEventCallback(sendQueuedPromptNext);
  const stableRemoveQueuedPrompt =
    useStableControllerEventCallback(removeQueuedPrompt);
  const stableEditQueuedPrompt =
    useStableControllerEventCallback(editQueuedPrompt);
  const stableRemoveProject = useStableControllerEventCallback(removeProject);
  const stableRequestDeleteProjectConversations =
    useStableControllerEventCallback(requestDeleteProjectConversations);
  const stableCancelDeleteProjectConversations =
    useStableControllerEventCallback(cancelDeleteProjectConversations);
  const stableConfirmDeleteProjectConversations =
    useStableControllerEventCallback(confirmDeleteProjectConversations);
  const stableToggleConversationPinned = useStableControllerEventCallback(
    toggleConversationPinned
  );
  const stableRequestDeleteConversation = useStableControllerEventCallback(
    requestDeleteConversation
  );
  const stableRetryActivation =
    useStableControllerEventCallback(retryActivation);
  const stableContinueInNewConversation = useStableControllerEventCallback(
    continueInNewConversation
  );
  const stableCancelDeleteConversation = useStableControllerEventCallback(
    cancelDeleteConversation
  );
  const stableConfirmDeleteConversation = useStableControllerEventCallback(
    confirmDeleteConversation
  );
  const stableRetryOpenclawGateway = useStableControllerEventCallback(
    ensureOpenclawGateway
  );
  const stableSubmitCompact = useStableControllerEventCallback(submitCompact);
  const stableDismissUsageAlert =
    useStableControllerEventCallback(dismissUsageAlert);
  const controllerActions = useMemo(
    () => ({
      createConversation: stableCreateConversation,
      selectConversation: stableSelectConversation,
      submitPrompt: stableSubmitPrompt,
      submitCompact: stableSubmitCompact,
      dismissUsageAlert: stableDismissUsageAlert,
      showPromptImagesUnsupported: stableShowPromptImagesUnsupported,
      submitApprovalOption: stableSubmitApprovalOption,
      submitInteractivePrompt: stableSubmitInteractivePrompt,
      interruptCurrentTurn: stableInterruptCurrentTurn,
      updateDraftPrompt: stableUpdateDraftPrompt,
      updateSelectedProjectPath: stableUpdateSelectedProjectPath,
      updateComposerSettings: stableUpdateComposerSettings,
      sendQueuedPromptNext: stableSendQueuedPromptNext,
      removeQueuedPrompt: stableRemoveQueuedPrompt,
      editQueuedPrompt: stableEditQueuedPrompt,
      removeProject: stableRemoveProject,
      requestDeleteProjectConversations:
        stableRequestDeleteProjectConversations,
      cancelDeleteProjectConversations: stableCancelDeleteProjectConversations,
      confirmDeleteProjectConversations:
        stableConfirmDeleteProjectConversations,
      toggleConversationPinned: stableToggleConversationPinned,
      requestDeleteConversation: stableRequestDeleteConversation,
      retryActivation: stableRetryActivation,
      continueInNewConversation: stableContinueInNewConversation,
      cancelDeleteConversation: stableCancelDeleteConversation,
      confirmDeleteConversation: stableConfirmDeleteConversation,
      retryOpenclawGateway: stableRetryOpenclawGateway
    }),
    [
      stableCancelDeleteConversation,
      stableCancelDeleteProjectConversations,
      stableConfirmDeleteConversation,
      stableConfirmDeleteProjectConversations,
      stableContinueInNewConversation,
      stableCreateConversation,
      stableDismissUsageAlert,
      stableEditQueuedPrompt,
      stableInterruptCurrentTurn,
      stableRemoveProject,
      stableRemoveQueuedPrompt,
      stableRequestDeleteConversation,
      stableRequestDeleteProjectConversations,
      stableRetryActivation,
      stableRetryOpenclawGateway,
      stableSelectConversation,
      stableSendQueuedPromptNext,
      stableShowPromptImagesUnsupported,
      stableSubmitApprovalOption,
      stableSubmitCompact,
      stableSubmitInteractivePrompt,
      stableSubmitPrompt,
      stableToggleConversationPinned,
      stableUpdateComposerSettings,
      stableUpdateDraftPrompt,
      stableUpdateSelectedProjectPath
    ]
  );

  return useMemo(
    () => ({
      viewModel: {
        workspaceId,
        workspacePath,
        currentUserId,
        data,
        conversations: visibleConversations,
        userProjects,
        activeConversation,
        activeConversationId,
        availableCommands,
        availableSkills,
        draftPrompt,
        isLoadingConversations,
        isLoadingMessages,
        isCreatingConversation,
        isSubmitting,
        isInterrupting,
        isRespondingApproval,
        promptImagesSupported,
        compactSupported,
        usage,
        usageAlert,
        listError,
        isDeletingConversation,
        isDeletingProjectConversations,
        pendingDeleteConversation,
        pendingDeleteProjectConversations,
        pendingApproval,
        pendingInteractivePrompt,
        activeLiveState,
        activationError,
        openclawGateway,
        canSubmit,
        composerSettings,
        queuedPrompts,
        drainingQueuedPromptId,
        canQueueWhileBusy,
        hasSentUserMessage,
        avoidGroupingEdits,
        conversation,
        conversationDetail,
        sessionChrome,
        inlineNotice: detailError
          ? {
              id: `agent-gui-detail-error:${activeConversationId ?? "current"}`,
              message: detailError,
              tone: "error" as const,
              autoDismissMs: null
            }
          : null,
        detailError
      },
      actions: controllerActions
    }),
    [
      activeConversation,
      activeConversationId,
      activeLiveState,
      activationError,
      avoidGroupingEdits,
      availableCommands,
      availableSkills,
      canSubmit,
      canQueueWhileBusy,
      composerSettings,
      conversation,
      conversationDetail,
      controllerActions,
      data,
      detailError,
      draftPrompt,
      isCreatingConversation,
      openclawGateway,
      promptImagesSupported,
      compactSupported,
      usage,
      usageAlert,
      dismissUsageAlert,
      isInterrupting,
      isLoadingConversations,
      isLoadingMessages,
      isRespondingApproval,
      listError,
      isDeletingConversation,
      isDeletingProjectConversations,
      isSubmitting,
      hasSentUserMessage,
      pendingDeleteConversation,
      pendingDeleteProjectConversations,
      pendingApproval,
      pendingInteractivePrompt,
      queuedPrompts,
      drainingQueuedPromptId,
      currentUserId,
      workspaceId,
      workspacePath,
      sessionChrome,
      userProjects,
      visibleConversations
    ]
  );
}
