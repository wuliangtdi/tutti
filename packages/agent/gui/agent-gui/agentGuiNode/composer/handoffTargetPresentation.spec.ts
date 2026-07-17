import { describe, expect, it } from "vitest";
import { resolveHandoffTargetOwnershipLabel } from "./handoffTargetPresentation";

const labels = { self: "My Agent", shared: "Shared Agent" };

describe("resolveHandoffTargetOwnershipLabel", () => {
  it("identifies targets without an external owner as the current user's agent", () => {
    expect(resolveHandoffTargetOwnershipLabel({}, labels)).toBe("My Agent");
  });

  it("identifies shared targets by owner name without changing the agent name", () => {
    expect(
      resolveHandoffTargetOwnershipLabel({ ownerLabel: " Ricky " }, labels)
    ).toBe("Ricky · Shared Agent");
  });

  it("still identifies a shared target when only its owner badge is available", () => {
    expect(
      resolveHandoffTargetOwnershipLabel(
        { badge: { iconUrl: "app://owner.png" } },
        labels
      )
    ).toBe("Shared Agent");
  });
});
