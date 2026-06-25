import { describe, expect, it } from "vitest";
import {
  CODEX_ERROR_CODES,
  resolveCodexErrorPresentation
} from "./codexErrorPresentation";

describe("resolveCodexErrorPresentation", () => {
  it("maps every structured Codex domain code to a focus + button + message", () => {
    const expectations: Record<
      string,
      { focus: string; actionKey: string; messageKey: string }
    > = {
      [CODEX_ERROR_CODES.cliMissing]: {
        focus: "install",
        actionKey: "agentHost.agentGui.visibleErrorActionInstall",
        messageKey: "agentHost.agentGui.visibleErrorCodexCliMissing"
      },
      [CODEX_ERROR_CODES.platformPkgIncomplete]: {
        focus: "repair",
        actionKey: "agentHost.agentGui.visibleErrorActionRepair",
        messageKey: "agentHost.agentGui.visibleErrorCodexPlatformPkgIncomplete"
      },
      [CODEX_ERROR_CODES.versionTooOld]: {
        focus: "upgrade",
        actionKey: "agentHost.agentGui.visibleErrorActionUpgrade",
        messageKey: "agentHost.agentGui.visibleErrorCodexVersionTooOld"
      },
      [CODEX_ERROR_CODES.authRequired]: {
        focus: "auth",
        actionKey: "agentHost.agentGui.visibleErrorActionRelogin",
        messageKey: "agentHost.agentGui.visibleErrorCodexAuthRequired"
      },
      [CODEX_ERROR_CODES.network]: {
        focus: "network",
        actionKey: "agentHost.agentGui.visibleErrorActionRetry",
        messageKey: "agentHost.agentGui.visibleErrorCodexNetwork"
      }
    };

    for (const [code, expected] of Object.entries(expectations)) {
      const presentation = resolveCodexErrorPresentation(code);
      expect(presentation, code).not.toBeNull();
      expect(presentation?.code).toBe(code);
      expect(presentation?.focus).toBe(expected.focus);
      expect(presentation?.actionKey).toBe(expected.actionKey);
      expect(presentation?.messageKey).toBe(expected.messageKey);
    }
  });

  it("returns null for legacy/unknown/empty codes", () => {
    expect(resolveCodexErrorPresentation("auth_required")).toBeNull();
    expect(resolveCodexErrorPresentation("runtime_unavailable")).toBeNull();
    expect(resolveCodexErrorPresentation("WHATEVER")).toBeNull();
    expect(resolveCodexErrorPresentation(null)).toBeNull();
    expect(resolveCodexErrorPresentation(undefined)).toBeNull();
    expect(resolveCodexErrorPresentation("")).toBeNull();
  });
});
