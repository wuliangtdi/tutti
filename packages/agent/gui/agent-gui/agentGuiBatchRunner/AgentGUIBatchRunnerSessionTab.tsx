import React from "react";
import { AlertCircle, ArrowLeft, Bot, RefreshCw } from "lucide-react";
import { WorkspaceAgentSessionDetail } from "../../shared/WorkspaceAgentSessionDetail";
import { buildWorkspaceAgentSessionDetailViewModel } from "../../shared/workspaceAgentSessionDetailViewModel";
import type {
  WorkspaceAgentActivityCard,
  WorkspaceAgentActivityStatus
} from "../../shared/workspaceAgentActivityListViewModel";
import { Button } from "../../app/renderer/components/ui/button";
import { useTranslation } from "../../i18n/index";
import type { AgentGuiBatchRunCaseResult } from "../../shared/contracts/dto";
import type { AgentGuiBatchSessionTimelineState } from "./useAgentGuiBatchRunner";
import type {
  WorkspaceAgentActivitySession,
  WorkspaceAgentActivityTimelineItem
} from "../../shared/workspaceAgentActivityTypes";

interface AgentGUIBatchRunnerSessionTabProps {
  result: AgentGuiBatchRunCaseResult | null;
  timelineState: AgentGuiBatchSessionTimelineState | null | undefined;
  workspacePath: string | null | undefined;
  providerLabel: string;
  onBackToResults: () => void;
  onRefresh: () => void;
}

export interface AgentGuiBatchSessionDiagnostics {
  errorCount: number;
  failedToolCount: number;
  issueCount: number;
}

const issueStatuses = new Set<AgentGuiBatchRunCaseResult["status"]>([
  "blocked",
  "canceled",
  "error",
  "failed"
]);

const activityStatusByBatchStatus: Record<
  AgentGuiBatchRunCaseResult["status"],
  WorkspaceAgentActivityStatus
> = {
  blocked: "waiting",
  canceled: "canceled",
  completed: "completed",
  error: "failed",
  failed: "failed",
  pending: "idle",
  running: "working"
};

const batchRunnerStatusKeyByStatus: Record<
  AgentGuiBatchRunCaseResult["status"],
  string
> = {
  blocked: "agentHost.agentGui.batchRunnerStatus_blocked",
  canceled: "agentHost.agentGui.batchRunnerStatus_canceled",
  completed: "agentHost.agentGui.batchRunnerStatus_completed",
  error: "agentHost.agentGui.batchRunnerStatus_error",
  failed: "agentHost.agentGui.batchRunnerStatus_failed",
  pending: "agentHost.agentGui.batchRunnerStatus_pending",
  running: "agentHost.agentGui.batchRunnerStatus_running"
};

export function AgentGUIBatchRunnerSessionTab({
  result,
  timelineState,
  workspacePath,
  providerLabel,
  onBackToResults,
  onRefresh
}: AgentGUIBatchRunnerSessionTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const timelineItems = timelineState?.timelineItems;
  const detail = React.useMemo(
    () =>
      result
        ? buildAgentGuiBatchSessionDetail({
            result,
            timelineItems: timelineItems ?? [],
            workspacePath,
            providerLabel
          })
        : null,
    [providerLabel, result, timelineItems, workspacePath]
  );
  const diagnostics = React.useMemo(
    () =>
      detail && result
        ? getAgentGuiBatchSessionDiagnostics(detail, result)
        : null,
    [detail, result]
  );

  if (!result || !detail) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-500"
        data-testid="agent-gui-batch-session-empty"
      >
        {t("agentHost.agentGui.batchRunnerSessionEmpty")}
      </div>
    );
  }

  const sessionId = result.agentSessionId ?? result.providerSessionId ?? "";
  const hasIssue =
    issueStatuses.has(result.status) || (diagnostics?.issueCount ?? 0) > 0;
  const headerTone =
    result.status === "blocked"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : hasIssue
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-neutral-200 bg-white text-neutral-700";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div
        className={`flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 ${headerTone}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-700">
            <Bot size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <strong className="truncate text-[13px] font-semibold text-neutral-950">
                {providerLabel}
              </strong>
              <span className="truncate text-[13px] font-medium text-neutral-700">
                {result.title ?? result.id}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-3 text-[11px] text-neutral-500">
              <span>{t(batchRunnerStatusKeyByStatus[result.status])}</span>
              <span className="font-mono">{sessionId || "-"}</span>
              <span>
                {t("agentHost.agentGui.batchRunnerSessionErrorCount", {
                  count: diagnostics?.errorCount ?? 0
                })}
              </span>
              <span>
                {t("agentHost.agentGui.batchRunnerSessionToolFailureCount", {
                  count: diagnostics?.failedToolCount ?? 0
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-2 px-3 text-[11px]"
            data-testid="agent-gui-batch-session-back"
            onClick={onBackToResults}
          >
            <ArrowLeft size={14} aria-hidden />
            {t("agentHost.agentGui.batchRunnerSessionBackToResults")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-2 px-3 text-[11px]"
            disabled={timelineState?.loading === true || !sessionId}
            data-testid="agent-gui-batch-session-refresh"
            onClick={onRefresh}
          >
            <RefreshCw
              size={14}
              className={
                timelineState?.loading === true ? "animate-spin" : undefined
              }
              aria-hidden
            />
            {timelineState?.loading === true
              ? t("agentHost.agentGui.batchRunnerSessionLoading")
              : t("agentHost.agentGui.batchRunnerSessionRefresh")}
          </Button>
        </div>
      </div>

      {timelineState?.error ? (
        <div className="mx-4 mt-3 flex shrink-0 gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0 whitespace-pre-wrap break-words">
            {timelineState.error}
          </span>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-auto px-4 py-3"
        data-testid="agent-gui-batch-session-detail"
      >
        <WorkspaceAgentSessionDetail
          detail={detail}
          isLoading={timelineState?.loading === true}
          timelineItemCount={timelineItems?.length ?? 0}
          toolCallsLabel={(count) =>
            t("agentHost.workspaceAgentSessionDetailToolCalls", {
              count
            })
          }
          rawTimelineJsonLabel={t(
            "agentHost.agentGui.batchRunnerSessionRawJson"
          )}
          showRawTimelineJson
        />
      </div>
    </div>
  );
}

export function buildAgentGuiBatchSessionDetail({
  result,
  timelineItems,
  workspacePath,
  providerLabel
}: {
  result: AgentGuiBatchRunCaseResult;
  timelineItems: WorkspaceAgentActivityTimelineItem[];
  workspacePath: string | null | undefined;
  providerLabel: string;
}) {
  const sessionId = result.agentSessionId ?? result.providerSessionId ?? "";
  const createdAtUnixMs =
    result.startedAtUnixMs ?? timelineItems[0]?.occurredAtUnixMs ?? Date.now();
  const workspaceId = timelineItems[0]?.workspaceId?.trim() || "";
  const session: WorkspaceAgentActivitySession = {
    id: 0,
    workspaceId,
    agentSessionId: sessionId,
    presenceId: 0,
    userId: "agent-gui-batch-runner",
    provider: result.provider,
    providerSessionId: result.providerSessionId ?? sessionId,
    cwd: workspacePath ?? "/workspace",
    title: result.title ?? result.id,
    status: result.status,
    effectiveStatus: result.status,
    createdAtUnixMs,
    updatedAtUnixMs: result.completedAtUnixMs ?? Date.now()
  };
  const activity: WorkspaceAgentActivityCard = {
    id: `agent-gui-batch-session-${result.provider}-${result.line}-${result.id}`,
    sessionId,
    userId: "agent-gui-batch-runner",
    userName: providerLabel,
    agentProvider: result.provider,
    agentName: providerLabel,
    title: result.title ?? result.id,
    status: activityStatusByBatchStatus[result.status],
    latestActivitySummary: result.error ?? result.title ?? result.id,
    changedFiles: [],
    sortTimeUnixMs:
      result.completedAtUnixMs ?? result.startedAtUnixMs ?? createdAtUnixMs
  };
  return buildWorkspaceAgentSessionDetailViewModel({
    activity,
    session,
    timelineItems,
    workspaceRoot: workspacePath ?? null
  });
}

export function getAgentGuiBatchSessionDiagnostics(
  detail: ReturnType<typeof buildWorkspaceAgentSessionDetailViewModel>,
  result: AgentGuiBatchRunCaseResult
): AgentGuiBatchSessionDiagnostics {
  const visibleErrorCount = detail.turns.reduce(
    (count, turn) =>
      count +
      turn.agentMessages.filter((message) => Boolean(message.visibleError))
        .length,
    0
  );
  const failedToolCount = detail.turns.reduce(
    (count, turn) =>
      count +
      turn.toolCalls.filter((call) => call.statusKind === "failed").length,
    0
  );
  const resultErrorCount =
    result.error || issueStatuses.has(result.status) ? 1 : 0;
  const errorCount = visibleErrorCount + resultErrorCount;
  return {
    errorCount,
    failedToolCount,
    issueCount: errorCount + failedToolCount
  };
}
