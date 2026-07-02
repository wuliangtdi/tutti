import type { JSX } from "react";
import { translate } from "../../../../i18n/index";
import type { AgentTaskSubAgentVM } from "../../contracts/agentTaskItemVM";
import {
  ToolMarkdownBlock,
  ToolSection,
  type AgentToolRendererProps
} from "./agentToolContentShared";
import { AgentTaskStepList } from "../AgentTaskStepList";
import {
  formatAgentToolDurationMs,
  getTaskRenderData
} from "./render-data/agentToolRenderData";

export function AgentTaskContent({
  call,
  onLinkClick
}: AgentToolRendererProps): JSX.Element {
  "use memo";
  const task = getTaskRenderData(call);
  const subAgents = call.task?.subAgents ?? [];
  const failureMarkdown =
    task.errorMarkdown ??
    (isFailedTaskStatus(call.statusKind, task.status, call.status)
      ? translate("agentHost.agentTool.details.missingFailureDetails")
      : null);

  return (
    <div className="workspace-agents-status-panel__detail-tool-body">
      <div className="workspace-agents-status-panel__detail-tool-answer">
        <strong>{task.title}</strong>
        {task.status ? (
          <span className="workspace-agents-status-panel__detail-tool-answer--muted">
            {" · "}
            {task.status}
          </span>
        ) : null}
        {task.durationText ? (
          <span className="workspace-agents-status-panel__detail-tool-answer--muted">
            {" · "}
            {task.durationText}
          </span>
        ) : null}
      </div>
      {task.status === "running" && task.latestStepSummary ? (
        <ToolSection title={translate("agentHost.agentTool.details.summary")}>
          <div className="workspace-agents-status-panel__detail-tool-answer workspace-agents-status-panel__detail-tool-answer--muted">
            {task.latestStepSummary}
          </div>
        </ToolSection>
      ) : null}
      {subAgents.length > 0 ? (
        <div className="workspace-agents-status-panel__detail-subagents">
          {subAgents.map((subAgent) => (
            <AgentTaskSubAgentCard
              key={subAgent.ownerThreadId}
              subAgent={subAgent}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>
      ) : null}
      {task.prompt ? (
        <ToolSection title={translate("agentHost.agentTool.details.prompt")}>
          <ToolMarkdownBlock content={task.prompt} onLinkClick={onLinkClick} />
        </ToolSection>
      ) : null}
      {task.childSessionId ? (
        <ToolSection
          title={translate("agentHost.agentTool.details.delegateSession")}
        >
          <div className="workspace-agents-status-panel__detail-tool-answer">
            {task.childSessionId}
          </div>
        </ToolSection>
      ) : null}
      {task.steps.length > 0 ? (
        <ToolSection title={translate("agentHost.agentTool.details.steps")}>
          <AgentTaskStepList steps={task.steps} onLinkClick={onLinkClick} />
        </ToolSection>
      ) : null}
      {task.resultMarkdown ? (
        <ToolSection title={translate("agentHost.agentTool.details.output")}>
          <ToolMarkdownBlock
            content={task.resultMarkdown}
            onLinkClick={onLinkClick}
            collapsible
          />
        </ToolSection>
      ) : null}
      {failureMarkdown ? (
        <ToolSection title={translate("agentHost.agentTool.details.error")}>
          <ToolMarkdownBlock
            content={failureMarkdown}
            onLinkClick={onLinkClick}
            collapsible
          />
        </ToolSection>
      ) : null}
    </div>
  );
}

function AgentTaskSubAgentCard({
  subAgent,
  onLinkClick
}: {
  subAgent: AgentTaskSubAgentVM;
  onLinkClick?: AgentToolRendererProps["onLinkClick"];
}): JSX.Element {
  "use memo";
  const statusLabel = subAgentStatusLabel(subAgent.status);
  const elapsedText = subAgentElapsedText(subAgent);
  const title =
    subAgent.laneCount > 1
      ? `${subAgent.title} ${subAgent.laneIndex}`
      : subAgent.title;
  const progressText =
    subAgent.failureDetail ??
    subAgent.latestActivity ??
    translate("agentHost.agentTool.details.subAgentStarting");
  return (
    <details
      className="workspace-agents-status-panel__detail-subagent-card"
      data-status={subAgent.status}
      open={subAgent.status === "running"}
    >
      <summary className="workspace-agents-status-panel__detail-subagent-header">
        <span className="workspace-agents-status-panel__detail-subagent-chevron" />
        <span
          className={`workspace-agents-status-panel__detail-subagent-status workspace-agents-status-panel__detail-subagent-status--${subAgent.status}`}
          role="img"
          aria-label={statusLabel}
        />
        <span className="workspace-agents-status-panel__detail-subagent-title">
          {title}
        </span>
        <span className="workspace-agents-status-panel__detail-subagent-meta">
          {elapsedText ? `${elapsedText} · ` : ""}
          {statusLabel}
        </span>
      </summary>
      <div className="workspace-agents-status-panel__detail-subagent-body">
        <ToolSection
          title={translate("agentHost.agentTool.details.subAgentTask")}
        >
          <ToolMarkdownBlock
            content={subAgent.task ?? subAgent.title}
            onLinkClick={onLinkClick}
          />
        </ToolSection>
        <ToolSection
          title={translate("agentHost.agentTool.details.subAgentProgress")}
        >
          <div className="workspace-agents-status-panel__detail-subagent-activity">
            {progressText}
          </div>
        </ToolSection>
      </div>
    </details>
  );
}

function subAgentStatusLabel(status: AgentTaskSubAgentVM["status"]): string {
  switch (status) {
    case "completed":
      return translate("agentHost.agentTool.statusCompleted");
    case "failed":
      return translate("agentHost.agentTool.statusFailed");
    case "canceled":
      return translate("agentHost.agentTool.statusCanceled");
    case "running":
    default:
      return translate("agentHost.agentTool.statusWorking");
  }
}

function subAgentElapsedText(subAgent: AgentTaskSubAgentVM): string | null {
  const started = subAgent.startedAtUnixMs;
  const latest = subAgent.latestActivityAtUnixMs;
  if (
    typeof started !== "number" ||
    typeof latest !== "number" ||
    latest <= started
  ) {
    return null;
  }
  return formatAgentToolDurationMs(latest - started);
}

function isFailedTaskStatus(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    const normalized = (value ?? "").trim().toLowerCase();
    return normalized === "failed" || normalized === "error";
  });
}
