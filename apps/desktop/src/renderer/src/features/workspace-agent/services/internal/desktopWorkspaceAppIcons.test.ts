import assert from "node:assert/strict";
import test from "node:test";
import { resolveDesktopWorkspaceAppIconEntries } from "./desktopWorkspaceAppIcons.ts";

test("desktop workspace app icon entries include built-in agent launcher apps", () => {
  const entries = resolveDesktopWorkspaceAppIconEntries({
    apps: [],
    resolveAppIconUrl: (appId) =>
      appId === "agent-codex"
        ? "codex.png"
        : appId === "agent-claude-code"
          ? "claudecode.png"
          : null,
    workspaceId: "workspace-1"
  });

  assert.deepEqual(entries, [
    {
      appId: "agent-codex",
      iconUrl: "codex.png",
      workspaceId: "workspace-1"
    },
    {
      appId: "agent-claude-code",
      iconUrl: "claudecode.png",
      workspaceId: "workspace-1"
    }
  ]);
});

test("desktop workspace app icon entries keep App Center icons and prefer resolver overrides", () => {
  const entries = resolveDesktopWorkspaceAppIconEntries({
    apps: [
      {
        appId: "automation",
        availableIconUrl: "available-automation.png",
        iconUrl: "stored-automation.png"
      },
      {
        appId: "notes",
        availableIconUrl: "available-notes.png",
        iconUrl: null
      }
    ],
    resolveAppIconUrl: (appId) =>
      appId === "automation" ? "resolved-automation.png" : null,
    workspaceId: "workspace-1"
  });

  assert.deepEqual(entries, [
    {
      appId: "automation",
      iconUrl: "resolved-automation.png",
      workspaceId: "workspace-1"
    },
    {
      appId: "notes",
      iconUrl: "available-notes.png",
      workspaceId: "workspace-1"
    }
  ]);
});
