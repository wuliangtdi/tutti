import { describe, expect, it } from "vitest";
import {
  isWorkspaceAgentActivityRuntimeSessionOrigin,
  WORKSPACE_AGENT_ACTIVITY_RUNTIME_SESSION_ORIGIN
} from "./workspaceAgentActivityTypes";

describe("isWorkspaceAgentActivityRuntimeSessionOrigin", () => {
  it("accepts only empty origin or the explicit runtime enum", () => {
    expect(isWorkspaceAgentActivityRuntimeSessionOrigin(undefined)).toBe(true);
    expect(isWorkspaceAgentActivityRuntimeSessionOrigin("")).toBe(true);
    expect(
      isWorkspaceAgentActivityRuntimeSessionOrigin(
        WORKSPACE_AGENT_ACTIVITY_RUNTIME_SESSION_ORIGIN
      )
    ).toBe(true);

    expect(
      isWorkspaceAgentActivityRuntimeSessionOrigin(
        "workspace_agent_session_origin_runtime"
      )
    ).toBe(false);
    expect(isWorkspaceAgentActivityRuntimeSessionOrigin("runtime")).toBe(false);
    expect(isWorkspaceAgentActivityRuntimeSessionOrigin("1")).toBe(false);
    expect(
      isWorkspaceAgentActivityRuntimeSessionOrigin(
        "WORKSPACE_AGENT_SESSION_ORIGIN_UNKNOWN"
      )
    ).toBe(false);
  });
});
