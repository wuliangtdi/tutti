import { describe, expect, it } from "vitest";
import { permissionModeSelectionPatch } from "./composerModeSelection";

describe("permissionModeSelectionPatch", () => {
  it("clears plan mode for mutually-exclusive providers (claude-code)", () => {
    expect(
      permissionModeSelectionPatch("acceptEdits", { clearsPlanMode: true })
    ).toEqual({
      permissionModeId: "acceptEdits",
      planMode: false
    });
  });

  it("leaves plan mode intact for independent providers (codex)", () => {
    expect(
      permissionModeSelectionPatch("read-only", { clearsPlanMode: false })
    ).toEqual({
      permissionModeId: "read-only"
    });
  });
});
