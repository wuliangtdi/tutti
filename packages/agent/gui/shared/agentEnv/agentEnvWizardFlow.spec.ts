import { describe, expect, it } from "vitest";
import {
  deriveAgentSetupStages,
  resolveWizardAutoStartAction
} from "./agentEnvWizardFlow";

const labels = {
  detect: "Detect",
  install: "Install",
  login: "Login",
  ready: "Ready"
};

describe("deriveAgentSetupStages", () => {
  it("shows detect running and the rest pending before status is known", () => {
    const stages = deriveAgentSetupStages({
      detected: false,
      cliInstalled: false,
      versionTooOld: false,
      authenticated: false,
      authRequired: false,
      ready: false,
      activePhase: null,
      loginPending: false,
      cliVersionDetail: null,
      accountDetail: null,
      labels
    });
    expect(stages.map((s) => [s.id, s.status])).toEqual([
      ["detect", "running"],
      ["install", "pending"],
      ["login", "pending"],
      ["ready", "pending"]
    ]);
  });

  it("marks install running while the active phase is installing", () => {
    const stages = deriveAgentSetupStages({
      detected: true,
      cliInstalled: false,
      versionTooOld: false,
      authenticated: false,
      authRequired: false,
      ready: false,
      activePhase: "install",
      loginPending: false,
      cliVersionDetail: null,
      accountDetail: null,
      labels
    });
    expect(stage(stages, "detect").status).toBe("ok");
    expect(stage(stages, "install").status).toBe("running");
    expect(stage(stages, "login").status).toBe("pending");
  });

  it("flags install as error when the version is too old", () => {
    const stages = deriveAgentSetupStages({
      detected: true,
      cliInstalled: true,
      versionTooOld: true,
      authenticated: false,
      authRequired: false,
      ready: false,
      activePhase: null,
      loginPending: false,
      cliVersionDetail: "0.100.0",
      accountDetail: null,
      labels
    });
    expect(stage(stages, "install").status).toBe("error");
    expect(stage(stages, "install").detail).toBe("0.100.0");
  });

  it("marks login running while a login action is pending", () => {
    const stages = deriveAgentSetupStages({
      detected: true,
      cliInstalled: true,
      versionTooOld: false,
      authenticated: false,
      authRequired: true,
      ready: false,
      activePhase: null,
      loginPending: true,
      cliVersionDetail: "0.142.1",
      accountDetail: null,
      labels
    });
    expect(stage(stages, "install").status).toBe("ok");
    expect(stage(stages, "login").status).toBe("running");
  });

  it("marks login pending (not error) when auth is required but install is not done", () => {
    const stages = deriveAgentSetupStages({
      detected: true,
      cliInstalled: false,
      versionTooOld: false,
      authenticated: false,
      authRequired: true,
      ready: false,
      activePhase: null,
      loginPending: false,
      cliVersionDetail: null,
      accountDetail: null,
      labels
    });
    expect(stage(stages, "login").status).toBe("pending");
  });

  it("marks every stage ok when ready", () => {
    const stages = deriveAgentSetupStages({
      detected: true,
      cliInstalled: true,
      versionTooOld: false,
      authenticated: true,
      authRequired: false,
      ready: true,
      activePhase: "done",
      loginPending: false,
      cliVersionDetail: "0.142.1",
      accountDetail: "user@example.com",
      labels
    });
    expect(stages.map((s) => s.status)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(stage(stages, "login").detail).toBe("user@example.com");
  });
});

describe("resolveWizardAutoStartAction", () => {
  const base = {
    detected: true,
    ready: false,
    installPending: false,
    loginPending: false
  };

  it("returns install for install/repair/upgrade focus", () => {
    expect(resolveWizardAutoStartAction({ ...base, focus: "install" })).toBe(
      "install"
    );
    expect(resolveWizardAutoStartAction({ ...base, focus: "repair" })).toBe(
      "install"
    );
    expect(resolveWizardAutoStartAction({ ...base, focus: "upgrade" })).toBe(
      "install"
    );
  });

  it("returns login for auth focus", () => {
    expect(resolveWizardAutoStartAction({ ...base, focus: "auth" })).toBe(
      "login"
    );
  });

  it("returns null for non-remediation focus", () => {
    expect(
      resolveWizardAutoStartAction({ ...base, focus: "detect" })
    ).toBeNull();
    expect(
      resolveWizardAutoStartAction({ ...base, focus: "network" })
    ).toBeNull();
    expect(
      resolveWizardAutoStartAction({ ...base, focus: "registry" })
    ).toBeNull();
    expect(resolveWizardAutoStartAction({ ...base, focus: null })).toBeNull();
  });

  it("returns null until detection has settled", () => {
    expect(
      resolveWizardAutoStartAction({
        ...base,
        detected: false,
        focus: "install"
      })
    ).toBeNull();
  });

  it("returns null when already ready", () => {
    expect(
      resolveWizardAutoStartAction({ ...base, ready: true, focus: "auth" })
    ).toBeNull();
  });

  it("returns null when the matching action is already pending", () => {
    expect(
      resolveWizardAutoStartAction({
        ...base,
        focus: "install",
        installPending: true
      })
    ).toBeNull();
    expect(
      resolveWizardAutoStartAction({
        ...base,
        focus: "auth",
        loginPending: true
      })
    ).toBeNull();
  });
});

function stage(stages: ReturnType<typeof deriveAgentSetupStages>, id: string) {
  const found = stages.find((s) => s.id === id);
  if (!found) {
    throw new Error(`stage ${id} not found`);
  }
  return found;
}
