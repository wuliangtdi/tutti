import type { AgentEnvPanelFocus } from "./agentEnvPanelStore";

/**
 * Structured Codex failure codes emitted by the backend (services/tuttid
 * agentstatus/codex_error.go) and carried verbatim on `visibleError.code`.
 * Keep this list aligned with the Go `CodexErrorCode` constants (片4 contract).
 */
export const CODEX_ERROR_CODES = {
  cliMissing: "CODEX_CLI_MISSING",
  platformPkgIncomplete: "CODEX_PLATFORM_PKG_INCOMPLETE",
  versionTooOld: "CODEX_VERSION_TOO_OLD",
  authRequired: "CODEX_AUTH_REQUIRED",
  network: "CODEX_NETWORK"
} as const;

export type CodexErrorCode =
  (typeof CODEX_ERROR_CODES)[keyof typeof CODEX_ERROR_CODES];

export interface CodexErrorPresentation {
  /** Domain code this presentation describes. */
  code: CodexErrorCode;
  /** i18n key for the one human sentence shown in the card. */
  messageKey: string;
  /** i18n key for the single primary remediation button. */
  actionKey: string;
  /** Section the env panel deep-links to when the button is pressed. */
  focus: AgentEnvPanelFocus;
}

const PRESENTATIONS: Record<CodexErrorCode, CodexErrorPresentation> = {
  [CODEX_ERROR_CODES.cliMissing]: {
    code: CODEX_ERROR_CODES.cliMissing,
    messageKey: "agentHost.agentGui.visibleErrorCodexCliMissing",
    actionKey: "agentHost.agentGui.visibleErrorActionInstall",
    focus: "install"
  },
  [CODEX_ERROR_CODES.platformPkgIncomplete]: {
    code: CODEX_ERROR_CODES.platformPkgIncomplete,
    messageKey: "agentHost.agentGui.visibleErrorCodexPlatformPkgIncomplete",
    actionKey: "agentHost.agentGui.visibleErrorActionRepair",
    focus: "repair"
  },
  [CODEX_ERROR_CODES.versionTooOld]: {
    code: CODEX_ERROR_CODES.versionTooOld,
    messageKey: "agentHost.agentGui.visibleErrorCodexVersionTooOld",
    actionKey: "agentHost.agentGui.visibleErrorActionUpgrade",
    focus: "upgrade"
  },
  [CODEX_ERROR_CODES.authRequired]: {
    code: CODEX_ERROR_CODES.authRequired,
    messageKey: "agentHost.agentGui.visibleErrorCodexAuthRequired",
    actionKey: "agentHost.agentGui.visibleErrorActionRelogin",
    focus: "auth"
  },
  [CODEX_ERROR_CODES.network]: {
    code: CODEX_ERROR_CODES.network,
    messageKey: "agentHost.agentGui.visibleErrorCodexNetwork",
    actionKey: "agentHost.agentGui.visibleErrorActionRetry",
    focus: "network"
  }
};

/**
 * Resolves a structured remediation presentation for a domain error code.
 * Returns null for unknown/legacy codes so the caller can fall back to the
 * existing generic title rendering.
 */
export function resolveCodexErrorPresentation(
  code: string | null | undefined
): CodexErrorPresentation | null {
  if (!code) {
    return null;
  }
  return PRESENTATIONS[code as CodexErrorCode] ?? null;
}
