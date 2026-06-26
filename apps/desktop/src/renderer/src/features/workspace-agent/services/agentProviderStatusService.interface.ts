import { createDecorator } from "@tutti-os/infra/di";
import type {
  AgentProviderStatus,
  AgentProviderStatusListResponse,
  AgentProviderTerminalCommand,
  WorkspaceAgentProvider
} from "@tutti-os/client-tuttid-ts";

export interface AgentProviderStatusActionContext {
  workbenchHost?: unknown;
  workspaceId?: string;
}

// A closable handle to the terminal a command opened, so the caller can dismiss
// it once the command's purpose is fulfilled (e.g. close the login terminal after
// authentication succeeds).
export interface AgentProviderTerminalCommandHandle {
  close(): void;
}

export interface AgentProviderTerminalCommandRunner {
  runTerminalCommand(
    command: AgentProviderTerminalCommand,
    context?: AgentProviderStatusActionContext
  ): Promise<AgentProviderTerminalCommandHandle | void>;
}

export interface AgentProviderStatusPendingAction {
  actionId: string;
  provider: WorkspaceAgentProvider;
}

export interface AgentProviderStatusSnapshot {
  error: string | null;
  isLoading: boolean;
  pendingActions: readonly AgentProviderStatusPendingAction[];
  statuses: readonly AgentProviderStatus[];
  capturedAt: string | null;
  defaultProvider: WorkspaceAgentProvider | null;
}

export interface IAgentProviderStatusService {
  readonly _serviceBrand: undefined;

  getRevision(): number;
  getSnapshot(): AgentProviderStatusSnapshot;
  isActionPending(provider: WorkspaceAgentProvider, actionId: string): boolean;
  getStatus(provider: WorkspaceAgentProvider): AgentProviderStatus | null;
  ensureLoaded(input?: {
    providers?: WorkspaceAgentProvider[];
  }): Promise<AgentProviderStatusListResponse | null>;
  runAction(
    provider: WorkspaceAgentProvider,
    actionId: string,
    context?: AgentProviderStatusActionContext
  ): Promise<void>;
  refresh(providers?: WorkspaceAgentProvider[]): Promise<void>;
  subscribe(listener: () => void): () => void;
  /** Whether the user agreed to send fuller diagnostics via "report problem". */
  getDiagnosticsConsent(): boolean;
  setDiagnosticsConsent(value: boolean): void;
  /** Send the consent-gated diagnostic report for a provider (no-op without consent). */
  reportEnvIssue(provider: WorkspaceAgentProvider): Promise<void>;
}

export const IAgentProviderStatusService =
  createDecorator<IAgentProviderStatusService>("agent-provider-status-service");
