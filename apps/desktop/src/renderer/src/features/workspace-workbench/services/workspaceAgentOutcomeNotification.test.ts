import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceAgentMessageCenterItem } from "@tutti-os/agent-gui/agent-message-center";
import {
  buildWorkspaceAgentOutcomeNotification,
  workspaceAgentOutcomeNotificationKey,
  type WorkspaceAgentOutcomeNotificationLabels
} from "./workspaceAgentOutcomeNotification.ts";

const labels: WorkspaceAgentOutcomeNotificationLabels = {
  completedBody: "The agent finished this run.",
  failedBody: "The agent run failed.",
  fallbackAgentName: "Agent"
};

test("outcome notification builder reports completed turns as success", () => {
  assert.deepEqual(
    buildWorkspaceAgentOutcomeNotification(
      item({ status: "completed" }),
      labels
    ),
    {
      agentName: "Codex",
      agentSessionId: "session-1",
      body: "The agent finished this run.",
      conversationTitle: "Build feature",
      level: "success"
    }
  );
});

test("outcome notification builder reports latest completed turn outcomes while the session is idle", () => {
  const completedTurn = item({
    status: "idle",
    latestTurnOutcome: {
      notificationKey: "session-1:turn:turn-2:completed",
      status: "completed",
      turnId: "turn-2"
    }
  });

  assert.equal(
    workspaceAgentOutcomeNotificationKey(completedTurn),
    "session-1:turn:turn-2:completed"
  );
  assert.deepEqual(
    buildWorkspaceAgentOutcomeNotification(completedTurn, labels),
    {
      agentName: "Codex",
      agentSessionId: "session-1",
      body: "The agent finished this run.",
      conversationTitle: "Build feature",
      level: "success"
    }
  );
});

test("outcome notification builder reports terminal session status instead of stale turn outcomes", () => {
  const failedSession = item({
    status: "failed",
    latestTurnOutcome: {
      notificationKey: "session-1:turn:turn-1:completed",
      status: "completed",
      turnId: "turn-1"
    }
  });

  assert.equal(
    workspaceAgentOutcomeNotificationKey(failedSession),
    "session-1:session:failed"
  );
  assert.deepEqual(
    buildWorkspaceAgentOutcomeNotification(failedSession, labels),
    {
      agentName: "Codex",
      agentSessionId: "session-1",
      body: "The agent run failed.",
      conversationTitle: "Build feature",
      level: "error"
    }
  );
});

test("outcome notification builder reports failed turns as error", () => {
  assert.deepEqual(
    buildWorkspaceAgentOutcomeNotification(item({ status: "failed" }), labels),
    {
      agentName: "Codex",
      agentSessionId: "session-1",
      body: "The agent run failed.",
      conversationTitle: "Build feature",
      level: "error"
    }
  );
});

test("outcome notification builder stays silent for canceled turns", () => {
  assert.equal(
    buildWorkspaceAgentOutcomeNotification(
      item({ status: "canceled" }),
      labels
    ),
    null
  );
});

test("outcome notification builder stays silent for non-terminal items", () => {
  for (const status of ["idle", "waiting", "working"] as const) {
    assert.equal(
      buildWorkspaceAgentOutcomeNotification(item({ status }), labels),
      null
    );
  }
});

test("outcome notification builder formats multi-part provider names", () => {
  const notification = buildWorkspaceAgentOutcomeNotification(
    item({ provider: "claude-code", status: "completed" }),
    labels
  );

  assert.equal(notification?.agentName, "Claude Code");
});

test("outcome notification builder falls back to the agent label", () => {
  const notification = buildWorkspaceAgentOutcomeNotification(
    item({ provider: "  ", status: "failed" }),
    labels
  );

  assert.equal(notification?.agentName, "Agent");
});

test("outcome notification builder trims the conversation title", () => {
  const notification = buildWorkspaceAgentOutcomeNotification(
    item({ status: "completed", title: "  Build feature  " }),
    labels
  );

  assert.equal(notification?.conversationTitle, "Build feature");
});

function item(
  overrides: Partial<WorkspaceAgentMessageCenterItem>
): WorkspaceAgentMessageCenterItem {
  return {
    agentSessionId: "session-1",
    userId: null,
    cwd: "/workspace",
    id: "message-center-session-1",
    identity: null,
    digest: {
      primary: {
        kind: "progress",
        summary: "Summarized progress",
        occurredAtUnixMs: 100
      }
    },
    lastAgentMessageAtUnixMs: 100,
    lastAgentMessageSummary: "Summarized progress",
    needsAttentionKind: null,
    needsAttentionSummary: null,
    pendingPrompt: null,
    provider: "codex",
    sortTimeUnixMs: 100,
    status: "working",
    title: "Build feature",
    ...overrides
  };
}
