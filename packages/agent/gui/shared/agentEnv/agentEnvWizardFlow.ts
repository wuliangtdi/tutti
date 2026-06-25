import type { AgentEnvPanelFocus } from "./agentEnvPanelStore";
import type {
  CodexSetupPhase,
  CodexSetupStepStatus
} from "./codexSetupContract";

export type AgentSetupStageId = "detect" | "install" | "login" | "ready";

export interface AgentSetupStage {
  id: AgentSetupStageId;
  label: string;
  status: CodexSetupStepStatus;
  detail: string | null;
}

export interface AgentSetupStageLabels {
  detect: string;
  install: string;
  login: string;
  ready: string;
}

export interface DeriveAgentSetupStagesInput {
  detected: boolean;
  cliInstalled: boolean;
  versionTooOld: boolean;
  authenticated: boolean;
  authRequired: boolean;
  ready: boolean;
  activePhase: CodexSetupPhase | null;
  loginPending: boolean;
  cliVersionDetail: string | null;
  accountDetail: string | null;
  labels: AgentSetupStageLabels;
}

const INSTALLING_PHASES: ReadonlySet<CodexSetupPhase> = new Set([
  "install",
  "repair",
  "verify"
]);

/**
 * Maps primitive provider-status flags onto the fixed 4-stage track the wizard
 * renders. Version verification folds into the install stage (an unsupported
 * version means install is `error`, not `ok`). Login `running` is driven by the
 * caller's pending flag because login runs as a terminal action, not via the
 * activeAction phase stream.
 */
export function deriveAgentSetupStages(
  input: DeriveAgentSetupStagesInput
): AgentSetupStage[] {
  const installing = input.activePhase
    ? INSTALLING_PHASES.has(input.activePhase)
    : false;
  const installOk =
    input.ready || (input.cliInstalled && !input.versionTooOld && !installing);

  const detectStatus: CodexSetupStepStatus = input.detected ? "ok" : "running";

  const installStatus: CodexSetupStepStatus = installing
    ? "running"
    : installOk
      ? "ok"
      : input.versionTooOld
        ? "error"
        : "pending";

  const loginStatus: CodexSetupStepStatus = input.authenticated
    ? "ok"
    : input.loginPending
      ? "running"
      : "pending";

  const readyStatus: CodexSetupStepStatus = input.ready ? "ok" : "pending";

  return [
    {
      id: "detect",
      label: input.labels.detect,
      status: detectStatus,
      detail: null
    },
    {
      id: "install",
      label: input.labels.install,
      status: installStatus,
      detail: input.cliVersionDetail
    },
    {
      id: "login",
      label: input.labels.login,
      status: loginStatus,
      detail: input.accountDetail
    },
    {
      id: "ready",
      label: input.labels.ready,
      status: readyStatus,
      detail: null
    }
  ];
}

export interface ResolveWizardAutoStartInput {
  focus: AgentEnvPanelFocus | null;
  detected: boolean;
  ready: boolean;
  installPending: boolean;
  loginPending: boolean;
}

/**
 * Decides whether opening the wizard with a remediation focus should auto-start
 * an action. Returns the action id to run, or null when nothing should run
 * (non-remediation focus, detection not settled, already ready, or already
 * pending). The caller is responsible for firing this at most once per open.
 */
export function resolveWizardAutoStartAction(
  input: ResolveWizardAutoStartInput
): "install" | "login" | null {
  const candidate = autoStartCandidate(input.focus);
  if (!candidate) {
    return null;
  }
  if (!input.detected || input.ready) {
    return null;
  }
  if (candidate === "install" && input.installPending) {
    return null;
  }
  if (candidate === "login" && input.loginPending) {
    return null;
  }
  return candidate;
}

function autoStartCandidate(
  focus: AgentEnvPanelFocus | null
): "install" | "login" | null {
  switch (focus) {
    case "install":
    case "repair":
    case "upgrade":
      return "install";
    case "auth":
      return "login";
    default:
      return null;
  }
}
