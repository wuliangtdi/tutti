import type { AgentToolCallVM } from "./agentToolCallVM";

export type AgentTaskSubAgentStatus =
  | "running"
  | "completed"
  | "failed"
  | "canceled";

// Live view of one delegated sub-agent thread (Codex collab child thread).
// The child thread's transcript rows are segregated out of the parent
// conversation; this VM is the parent-side surface that keeps the sub-agent
// perceivable while it runs.
export interface AgentTaskSubAgentVM {
  ownerThreadId: string;
  status: AgentTaskSubAgentStatus;
  title: string;
  task: string | null;
  laneIndex: number;
  laneCount: number;
  latestActivity: string | null;
  latestActivityKind: "message" | "reasoning" | "tool" | null;
  failureDetail: string | null;
  startedAtUnixMs: number | null;
  latestActivityAtUnixMs: number | null;
  terminalAtUnixMs: number | null;
}

export interface AgentTaskStepVM {
  id: string;
  turnId: string;
  name: string;
  toolName: string | null;
  status: string | null;
  summary: string;
  payload: Record<string, unknown> | null;
  tool: AgentToolCallVM | null;
  occurredAtUnixMs: number | null;
}

export interface AgentTaskItemVM {
  kind: "task";
  id: string;
  turnId: string;
  title: string;
  status: string | null;
  prompt?: string | null;
  delegateSessionId?: string | null;
  steps: AgentTaskStepVM[];
  subAgents?: AgentTaskSubAgentVM[];
  result?: string | null;
  resultMarkdown?: string | null;
  durationMs?: number | null;
  occurredAtUnixMs: number | null;
}
