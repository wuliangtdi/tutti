import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentMessageBlock } from "./AgentMessageBlock";
import type {
  AgentMessageContentVM,
  AgentMessageRowVM
} from "../contracts/agentMessageRowVM";
import {
  closeAgentEnvPanel,
  getAgentEnvPanelStore
} from "../../agentEnv/agentEnvPanelStore";

function buildRow(
  visibleError: AgentMessageContentVM["visibleError"],
  body = ""
): AgentMessageRowVM {
  return {
    kind: "message",
    id: "row-1",
    turnId: "turn-1",
    speaker: "assistant",
    occurredAtUnixMs: 0,
    thinking: [],
    messages: [
      {
        kind: "message-content",
        id: "msg-1",
        turnId: "turn-1",
        body,
        occurredAtUnixMs: 0,
        visibleError
      }
    ]
  };
}

function renderBlock(row: AgentMessageRowVM) {
  return render(
    <AgentMessageBlock
      workspaceRoot={null}
      basePath="/"
      row={row}
      thinkingLabel="thinking"
    />
  );
}

afterEach(() => {
  closeAgentEnvPanel();
  vi.restoreAllMocks();
});

describe("AgentVisibleErrorMessage domain-coded card", () => {
  it("shows one human sentence + one primary button and deep-links into the env panel", () => {
    const { getByText, getAllByRole } = renderBlock(
      buildRow(
        {
          code: "CODEX_VERSION_TOO_OLD",
          phase: "start",
          provider: "codex",
          detail: '{"raw":"requires a newer version"}',
          retryable: false
        },
        // The raw body must NOT be surfaced as the card title.
        "codex exited: requires a newer version"
      )
    );

    expect(
      getByText("Your Codex version is too old for this request.")
    ).toBeTruthy();
    // Legacy generic title (the raw body) must not also render — no triple
    // rendering of the same error.
    expect(() => getByText("codex exited: requires a newer version")).toThrow();

    const buttons = getAllByRole("button");
    const action = buttons.find(
      (button) => button.textContent === "Upgrade Codex"
    );
    expect(action).toBeTruthy();

    fireEvent.click(action as HTMLButtonElement);
    const store = getAgentEnvPanelStore();
    expect(store.open).toBe(true);
    expect(store.provider).toBe("codex");
    expect(store.focus).toBe("upgrade");
  });

  it("tucks the raw payload behind a single collapsible disclosure", () => {
    const { getByText, queryByText } = renderBlock(
      buildRow({
        code: "CODEX_CLI_MISSING",
        phase: "start",
        provider: "codex",
        detail: "spawn codex ENOENT",
        retryable: false
      })
    );

    // Collapsed by default: the raw payload is not yet visible.
    expect(queryByText("spawn codex ENOENT")).toBeNull();
    fireEvent.click(getByText("Raw error"));
    expect(getByText("spawn codex ENOENT")).toBeTruthy();
  });

  it("falls back to the legacy title for unrecognised codes", () => {
    const { getByText, queryByText } = renderBlock(
      buildRow({
        code: "runtime_unavailable",
        phase: "start",
        provider: "codex",
        detail: null,
        retryable: false
      })
    );

    expect(
      getByText("Codex could not start because the runtime is unavailable")
    ).toBeTruthy();
    expect(queryByText("Upgrade Codex")).toBeNull();
  });
});
