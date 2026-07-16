import { describe, expect, it } from "vitest";
import { handoffProjectPathForConversation } from "./agentGUIDetailModelHelpers.ts";

describe("handoffProjectPathForConversation", () => {
  it("keeps the canonical project path for the destination session", () => {
    expect(
      handoffProjectPathForConversation({
        cwd: "/workspace/fallback",
        project: { path: " /workspace/project-a " }
      } as never)
    ).toBe("/workspace/project-a");
  });

  it("falls back to the source cwd when project metadata is unavailable", () => {
    expect(
      handoffProjectPathForConversation({
        cwd: " /workspace/project-b ",
        project: null
      } as never)
    ).toBe("/workspace/project-b");
  });
});
