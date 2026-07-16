import { act, render, screen } from "@testing-library/react";
import type { AgentActivityTurn } from "@tutti-os/agent-activity-core";
import { describe, expect, it, vi } from "vitest";
import type { AgentTranscriptRowVM } from "../contracts/agentTranscriptRowVM";
import type { AgentTranscriptTurnGroup } from "./agentTranscriptModel";
import { AgentTurnWorkSection } from "./AgentTurnWorkSection";
import type { AgentTurnDisclosureStore } from "./AgentTurnDisclosureContext";

vi.mock("../../../i18n/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../i18n/index")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        key === "agentHost.agentGui.turnProcessedSeconds"
          ? `Processed for ${String(options?.seconds)}s`
          : key
    })
  };
});

const disclosureStore: AgentTurnDisclosureStore = {
  expandedOverrides: {},
  setExpandedOverride: () => {}
};

describe("AgentTurnWorkSection", () => {
  it("ticks only the duration label without rerendering transcript rows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(50_000);
    const renderRow = vi.fn((row: AgentTranscriptRowVM, rowIndex: number) => (
      <div key={`${row.id}:${rowIndex}`}>{row.id}</div>
    ));

    try {
      render(
        <AgentTurnWorkSection
          group={turnGroup()}
          sessionId="session-1"
          turn={canonicalTurn()}
          isActiveTurn
          disclosureStore={disclosureStore}
          renderRow={renderRow}
        />
      );

      expect(screen.getByText("Processed for 45s")).toBeTruthy();
      renderRow.mockClear();
      act(() => vi.advanceTimersByTime(5_000));
      expect(screen.getByText("Processed for 50s")).toBeTruthy();
      expect(renderRow).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start a live timer for a non-active canonical turn", () => {
    vi.useFakeTimers();
    vi.setSystemTime(50_000);

    try {
      render(
        <AgentTurnWorkSection
          group={turnGroup()}
          sessionId="session-1"
          turn={canonicalTurn()}
          isActiveTurn={false}
          disclosureStore={disclosureStore}
          renderRow={(row, rowIndex) => (
            <div key={`${row.id}:${rowIndex}`}>{row.id}</div>
          )}
        />
      );

      expect(screen.queryByText(/Processed for/)).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

function canonicalTurn(): AgentActivityTurn {
  return {
    agentSessionId: "session-1",
    origin: "user_prompt",
    phase: "running",
    startedAtUnixMs: 5_000,
    turnId: "turn-1",
    updatedAtUnixMs: 6_000
  };
}

function turnGroup(): AgentTranscriptTurnGroup {
  const row: AgentTranscriptRowVM = {
    kind: "message",
    id: "user-row",
    turnId: "turn-1",
    speaker: "user",
    messages: [
      {
        kind: "message-content",
        id: "user-message",
        turnId: "turn-1",
        body: "Please fix it",
        presentationKind: "content",
        occurredAtUnixMs: 5_000
      }
    ],
    thinking: [],
    occurredAtUnixMs: 5_000
  };
  return {
    key: "turn-1",
    turnId: "turn-1",
    rows: [{ row, rowIndex: 0 }]
  };
}
