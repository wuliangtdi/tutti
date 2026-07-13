import assert from "node:assert/strict";
import test from "node:test";
import type {
  WorkspaceAppCenterApp,
  WorkspaceAppCenterViewState
} from "@tutti-os/workspace-app-center";
import { openWorkspaceAppInline } from "./workspaceAppCenterInlineOpen.ts";

test("inline app open selects the app before preparing its runtime", async () => {
  const calls: string[] = [];
  let viewState: WorkspaceAppCenterViewState = {
    activeAppTab: "recommended",
    openAppId: null
  };
  const app = { appId: "ai-slide" } as WorkspaceAppCenterApp;

  await openWorkspaceAppInline({
    appId: app.appId,
    service: {
      getViewState: () => viewState,
      prepareAppLaunch: async () => {
        calls.push(`prepare:${viewState.openAppId ?? ""}`);
        return app;
      },
      setViewState: ({ state }) => {
        viewState = { ...viewState, ...state };
        calls.push(`select:${viewState.openAppId ?? ""}`);
      }
    },
    workspaceId: "workspace-1"
  });

  assert.equal(viewState.openAppId, "ai-slide");
  assert.deepEqual(calls, ["select:ai-slide", "prepare:ai-slide"]);
});

test("inline app open restores the catalog when launch preparation fails", async () => {
  let viewState: WorkspaceAppCenterViewState = {
    activeAppTab: "recommended",
    openAppId: null
  };

  await openWorkspaceAppInline({
    appId: "ai-slide",
    service: {
      getViewState: () => viewState,
      prepareAppLaunch: async () => null,
      setViewState: ({ state }) => {
        viewState = { ...viewState, ...state };
      }
    },
    workspaceId: "workspace-1"
  });

  assert.equal(viewState.openAppId, null);
});

test("a stale failed launch does not clear a newer inline app selection", async () => {
  let resolveFirstLaunch: (
    value: WorkspaceAppCenterApp | null
  ) => void = () => {
    assert.fail("first launch resolver was not initialized");
  };
  let viewState: WorkspaceAppCenterViewState = {
    activeAppTab: "recommended",
    openAppId: null
  };
  const service = {
    getViewState: () => viewState,
    prepareAppLaunch: () =>
      new Promise<WorkspaceAppCenterApp | null>((resolve) => {
        resolveFirstLaunch = resolve;
      }),
    setViewState: ({
      state
    }: {
      state: Partial<WorkspaceAppCenterViewState>;
    }) => {
      viewState = { ...viewState, ...state };
    }
  };
  const firstLaunch = openWorkspaceAppInline({
    appId: "ai-slide",
    service,
    workspaceId: "workspace-1"
  });

  service.setViewState({ state: { openAppId: "ai-doc" } });
  resolveFirstLaunch(null);
  await firstLaunch;

  assert.equal(viewState.openAppId, "ai-doc");
});
