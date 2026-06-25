import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { useSyncExternalStore } from "react";
import type {
  AgentProviderStatus,
  WorkspaceAgentProvider
} from "@tutti-os/client-tuttid-ts";
import {
  Button,
  CheckIcon,
  CopyIcon,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DownloadIcon,
  LoadingIcon,
  RefreshIcon,
  SuccessFilledIcon,
  WarningFilledIcon
} from "@tutti-os/ui-system";
import {
  readCodexSetupActiveAction,
  useAgentEnvPanelRequest,
  closeAgentEnvPanel,
  type AgentEnvPanelFocus,
  type CodexSetupStep,
  type CodexSetupStepStatus
} from "@tutti-os/agent-gui/agent-env";
import { useTranslation } from "@renderer/i18n";
import type { IAgentProviderStatusService } from "../services/agentProviderStatusService.interface";
import {
  desktopManagedAgentProviders,
  isDesktopManagedAgentProvider
} from "../services/internal/desktopManagedAgentProviders.ts";

interface AgentEnvPanelProps {
  agentProviderStatusService: IAgentProviderStatusService;
  workspaceId: string;
  workbenchHost?: unknown;
}

const PROVIDER_LABELS: Partial<Record<WorkspaceAgentProvider, string>> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  gemini: "Gemini",
  nexight: "Nexight",
  hermes: "Hermes",
  openclaw: "OpenClaw"
};

// Best-effort manual install command for the "install it yourself" escape hatch.
// The daemon owns the real install; this is only a copyable fallback.
const MANUAL_INSTALL_COMMANDS: Partial<Record<WorkspaceAgentProvider, string>> =
  {
    codex: "npm install -g @openai/codex",
    "claude-code": "npm install -g @anthropic-ai/claude-code"
  };

function resolveProviderLabel(provider: WorkspaceAgentProvider): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function useStatusSnapshot(service: IAgentProviderStatusService) {
  return useSyncExternalStore(
    (listener) => service.subscribe(listener),
    () => service.getSnapshot()
  );
}

/**
 * The deep-link focus picks which remediation the user landed for; it maps to a
 * primary action id so that button is emphasised when the panel opens.
 */
function focusToActionId(focus: AgentEnvPanelFocus | null): string | null {
  switch (focus) {
    case "install":
    case "repair":
    case "upgrade":
      return "install";
    case "auth":
      return "login";
    case "detect":
    case "network":
    case "registry":
      return "refresh";
    default:
      return null;
  }
}

function StepStatusIcon({
  status
}: {
  status: CodexSetupStepStatus;
}): JSX.Element {
  if (status === "ok") {
    return <SuccessFilledIcon className="size-4 text-[var(--tutti-purple)]" />;
  }
  if (status === "running") {
    return <LoadingIcon className="size-4 animate-spin" />;
  }
  if (status === "error") {
    return <WarningFilledIcon className="size-4 text-[var(--state-danger)]" />;
  }
  return (
    <span
      aria-hidden="true"
      className="size-4 rounded-full border border-[var(--border-1)]"
    />
  );
}

export function AgentEnvPanel({
  agentProviderStatusService,
  workspaceId,
  workbenchHost
}: AgentEnvPanelProps): JSX.Element | null {
  const { t } = useTranslation();
  const request = useAgentEnvPanelRequest();
  const snapshot = useStatusSnapshot(agentProviderStatusService);
  const [copied, setCopied] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const provider: WorkspaceAgentProvider = useMemo(() => {
    const requested = request.provider;
    if (requested && isDesktopManagedAgentProvider(requested)) {
      return requested;
    }
    if (
      snapshot.defaultProvider &&
      isDesktopManagedAgentProvider(snapshot.defaultProvider)
    ) {
      return snapshot.defaultProvider;
    }
    return desktopManagedAgentProviders.includes("codex")
      ? "codex"
      : desktopManagedAgentProviders[0];
  }, [request.provider, snapshot.defaultProvider]);

  const status: AgentProviderStatus | null = useMemo(
    () =>
      snapshot.statuses.find((entry) => entry.provider === provider) ?? null,
    [snapshot.statuses, provider]
  );

  const open = request.open;
  const providerLabel = resolveProviderLabel(provider);

  // Live detection: every open (or re-open via a fresh deep-link) re-checks the
  // provider so the mode is driven by reality, never a persisted install flag.
  useEffect(() => {
    if (!open) {
      return;
    }
    setCopied(false);
    setLogExpanded(false);
    void agentProviderStatusService.refresh([provider]);
  }, [open, provider, request.requestSequence, agentProviderStatusService]);

  const handleClose = useCallback((next: boolean) => {
    if (!next) {
      closeAgentEnvPanel();
    }
  }, []);

  const runAction = useCallback(
    (actionId: string) => {
      void agentProviderStatusService.runAction(provider, actionId, {
        workbenchHost,
        workspaceId
      });
    },
    [agentProviderStatusService, provider, workbenchHost, workspaceId]
  );

  const handleCopyManualCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard?.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, []);

  if (!open) {
    return null;
  }

  const ready = status?.availability.status === "ready";
  const activeAction = readCodexSetupActiveAction(status);
  const installPending = agentProviderStatusService.isActionPending(
    provider,
    "install"
  );
  const loginPending = agentProviderStatusService.isActionPending(
    provider,
    "login"
  );
  const busy =
    installPending ||
    activeAction?.phase === "install" ||
    activeAction?.phase === "repair" ||
    activeAction?.phase === "verify";
  const primaryActionId = focusToActionId(request.focus);

  const steps: CodexSetupStep[] = activeAction?.steps.length
    ? activeAction.steps
    : synthesizeSteps(status, providerLabel, t);

  const manualCommand = MANUAL_INSTALL_COMMANDS[provider] ?? null;
  const registry = activeAction?.registry ?? null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[min(640px,calc(100vh-32px))] flex-col gap-0 overflow-hidden bg-[var(--background-fronted)] p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b border-[var(--border-1)] px-5 py-4">
          <DialogTitle>
            {ready
              ? t("workspace.agentEnv.configTitle", { provider: providerLabel })
              : t("workspace.agentEnv.wizardTitle", {
                  provider: providerLabel
                })}
          </DialogTitle>
          <DialogDescription>
            {ready
              ? t("workspace.agentEnv.configDescription", {
                  provider: providerLabel
                })
              : t("workspace.agentEnv.wizardDescription", {
                  provider: providerLabel
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!isDesktopManagedAgentProvider(provider) ? (
            <p className="m-0 text-[13px] text-[var(--text-secondary)]">
              {t("workspace.agentEnv.providerUnsupported")}
            </p>
          ) : ready ? (
            <ConfigPanelBody status={status} registry={registry} t={t} />
          ) : (
            <WizardBody
              busy={Boolean(busy)}
              providerLabel={providerLabel}
              steps={steps}
              log={activeAction?.log ?? []}
              registry={registry}
              logExpanded={logExpanded}
              onToggleLog={() => setLogExpanded((value) => !value)}
              manualCommand={manualCommand}
              copied={copied}
              onCopyManualCommand={(command) =>
                void handleCopyManualCommand(command)
              }
              error={activeAction?.error ?? null}
              t={t}
            />
          )}
        </div>

        <DialogFooter className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border-1)] px-5 py-4">
          <Button
            size="dialog"
            type="button"
            variant="ghost"
            disabled={snapshot.isLoading}
            onClick={() => void agentProviderStatusService.refresh([provider])}
          >
            <RefreshIcon className="size-4" />
            {t("workspace.agentEnv.actionDetect")}
          </Button>
          {ready ? (
            <>
              <Button
                size="dialog"
                type="button"
                variant={primaryActionId === "install" ? undefined : "ghost"}
                disabled={busy}
                onClick={() => runAction("install")}
              >
                {t("workspace.agentEnv.actionUpgrade")}
              </Button>
              <Button
                size="dialog"
                type="button"
                variant={primaryActionId === "login" ? undefined : "ghost"}
                disabled={loginPending}
                onClick={() => runAction("login")}
              >
                {t("workspace.agentEnv.actionRelogin")}
              </Button>
            </>
          ) : (
            <Button
              size="dialog"
              type="button"
              disabled={busy}
              onClick={() => runAction("install")}
            >
              {busy ? (
                <LoadingIcon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {status?.cli.installed
                ? t("workspace.agentEnv.actionRepair")
                : t("workspace.agentEnv.actionInstall")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function synthesizeSteps(
  status: AgentProviderStatus | null,
  providerLabel: string,
  t: ReturnType<typeof useTranslation>["t"]
): CodexSetupStep[] {
  const cliInstalled = status?.cli.installed ?? false;
  const ready = status?.availability.status === "ready";
  const versionTooOld = (status?.availability.reasonCode ?? "")
    .toLowerCase()
    .includes("version");
  const authStatus = status?.auth.status ?? "unknown";
  return [
    {
      id: "cli",
      label: t("workspace.agentEnv.stepCli", { provider: providerLabel }),
      status: cliInstalled ? "ok" : "pending",
      detail: status?.cli.binaryPath ?? null
    },
    {
      id: "version",
      label: t("workspace.agentEnv.stepVersion"),
      status: versionTooOld
        ? "error"
        : ready
          ? "ok"
          : cliInstalled
            ? "running"
            : "pending",
      detail: status?.cli.version ?? null
    },
    {
      id: "auth",
      label: t("workspace.agentEnv.stepAuth"),
      status:
        authStatus === "authenticated"
          ? "ok"
          : authStatus === "required"
            ? "error"
            : "pending",
      detail: status?.auth.accountLabel ?? null
    }
  ];
}

function WizardBody({
  busy,
  providerLabel,
  steps,
  log,
  registry,
  logExpanded,
  onToggleLog,
  manualCommand,
  copied,
  onCopyManualCommand,
  error,
  t
}: {
  busy: boolean;
  providerLabel: string;
  steps: CodexSetupStep[];
  log: string[];
  registry: string | null;
  logExpanded: boolean;
  onToggleLog: () => void;
  manualCommand: string | null;
  copied: boolean;
  onCopyManualCommand: (command: string) => void;
  error: { code: string | null; message: string | null } | null;
  t: ReturnType<typeof useTranslation>["t"];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] text-[var(--text-secondary)]">
        {busy
          ? t("workspace.agentEnv.busyInstalling", { provider: providerLabel })
          : t("workspace.agentEnv.detecting", { provider: providerLabel })}
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-2.5 rounded-[8px] bg-[var(--transparency-block)] p-3"
          >
            <span className="mt-0.5 shrink-0">
              <StepStatusIcon status={step.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                {step.label ?? step.id}
              </span>
              {step.detail ? (
                <span className="mt-0.5 block truncate text-[12px] text-[var(--text-secondary)]">
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {error?.message ? (
        <p className="m-0 text-[12px] text-[var(--state-danger)]">
          {t("workspace.agentEnv.actionFailed")}
        </p>
      ) : null}

      {(log.length > 0 || registry) && (
        <div className="rounded-[8px] border border-[var(--border-1)]">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-3 py-2 text-left text-[12px] font-semibold text-[var(--text-primary)]"
            aria-expanded={logExpanded}
            onClick={onToggleLog}
          >
            <span>{t("workspace.agentEnv.logToggle")}</span>
            {registry ? (
              <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                {t("workspace.agentEnv.registryLabel")}: {registry}
              </span>
            ) : null}
          </button>
          {logExpanded ? (
            <pre className="m-0 max-h-[200px] overflow-auto whitespace-pre-wrap break-words border-t border-[var(--border-1)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
              {log.length > 0 ? log.join("\n") : "—"}
            </pre>
          ) : null}
        </div>
      )}

      {manualCommand ? (
        <div className="rounded-[8px] border border-[var(--border-1)] bg-[var(--transparency-block)] p-3">
          <strong className="text-[12px] font-semibold text-[var(--text-primary)]">
            {t("workspace.agentEnv.manualTitle")}
          </strong>
          <p className="mt-1 mb-2 text-[12px] text-[var(--text-secondary)]">
            {t("workspace.agentEnv.manualDescription")}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[6px] bg-[var(--background-fronted)] px-2 py-1.5 font-[var(--tsh-font-mono)] text-[12px] text-[var(--text-primary)]">
              {manualCommand}
            </code>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onCopyManualCommand(manualCommand)}
            >
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <CopyIcon className="size-4" />
              )}
              {copied
                ? t("workspace.agentEnv.manualCopied")
                : t("workspace.agentEnv.manualCopy")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConfigPanelBody({
  status,
  registry,
  t
}: {
  status: AgentProviderStatus | null;
  registry: string | null;
  t: ReturnType<typeof useTranslation>["t"];
}): JSX.Element {
  const unknown = t("workspace.agentEnv.valueUnknown");
  const rows: { label: string; value: string }[] = [
    {
      label: t("workspace.agentEnv.fieldVersion"),
      value: status?.cli.version ?? unknown
    },
    {
      label: t("workspace.agentEnv.fieldPath"),
      value: status?.cli.binaryPath ?? t("workspace.agentEnv.valueNotInstalled")
    },
    {
      label: t("workspace.agentEnv.fieldTargetNode"),
      value: status?.adapter.command?.join(" ") || unknown
    },
    {
      label: t("workspace.agentEnv.fieldAccount"),
      value:
        status?.auth.accountLabel ?? t("workspace.agentEnv.valueNotSignedIn")
    },
    {
      label: t("workspace.agentEnv.fieldRegistry"),
      value: registry ?? unknown
    }
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-[8px] bg-[var(--transparency-block)] p-3">
        <SuccessFilledIcon className="size-5 text-[var(--tutti-purple)]" />
        <span className="text-[13px] font-medium text-[var(--text-primary)]">
          {t("workspace.agentEnv.ready", {
            provider: status
              ? resolveProviderLabel(status.provider)
              : t("workspace.agentEnv.valueUnknown")
          })}
        </span>
      </div>
      <dl className="m-0 flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3"
          >
            <dt className="text-[12px] text-[var(--text-secondary)]">
              {row.label}
            </dt>
            <dd className="m-0 min-w-0 truncate text-[13px] text-[var(--text-primary)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
