import assert from "node:assert/strict";
import test from "node:test";
import {
  clampStandaloneAgentToolPanelWidth,
  createStandaloneAgentToolSidebarState,
  formatStandaloneAgentToolReminderCount,
  isStandaloneAgentToolGroupActive,
  reduceStandaloneAgentToolSidebarState,
  resolveStandaloneAgentToolPanelExpansionReset,
  resolveStandaloneAgentToolSidebarLayoutWidth,
  resolveStandaloneAgentToolSidebarWidth,
  resolveStandaloneAgentToolPanelMaxWidth,
  standaloneAgentToolPanelDefaultWidthById
} from "./standaloneAgentToolSidebarModel.ts";

test("standalone agent tool sidebar opens, swaps, and closes one top-level panel at a time", () => {
  const initial = createStandaloneAgentToolSidebarState();
  const filesOpen = reduceStandaloneAgentToolSidebarState(initial, {
    panel: "files",
    type: "toggle-panel"
  });
  const appsOpen = reduceStandaloneAgentToolSidebarState(filesOpen, {
    panel: "apps",
    type: "toggle-panel"
  });
  const appsClosed = reduceStandaloneAgentToolSidebarState(appsOpen, {
    panel: "apps",
    type: "toggle-panel"
  });

  assert.equal(filesOpen.activePanel, "files");
  assert.equal(appsOpen.activePanel, "apps");
  assert.equal(appsClosed.activePanel, null);
  assert.deepEqual(appsClosed.mountedPanels, ["files", "apps"]);
});

test("standalone agent right-sidebar panels are mutually exclusive for every switch", () => {
  const panels = ["files", "browser", "apps", "tasks", "messages"] as const;

  for (const previousPanel of panels) {
    for (const nextPanel of panels) {
      if (previousPanel === nextPanel) {
        continue;
      }
      const previousOpen = reduceStandaloneAgentToolSidebarState(
        createStandaloneAgentToolSidebarState(),
        previousPanel === "browser"
          ? { panel: previousPanel, type: "select-tool" }
          : { panel: previousPanel, type: "toggle-panel" }
      );
      const nextOpen = reduceStandaloneAgentToolSidebarState(
        previousOpen,
        nextPanel === "browser"
          ? { panel: nextPanel, type: "select-tool" }
          : { panel: nextPanel, type: "toggle-panel" }
      );

      assert.equal(nextOpen.activePanel, nextPanel);
      assert.equal(
        nextOpen.mountedPanels.filter((panel) => panel === nextPanel).length,
        1
      );
    }
  }
});

test("standalone agent tool sidebar opens a requested panel without toggling it closed", () => {
  const filesOpen = reduceStandaloneAgentToolSidebarState(
    createStandaloneAgentToolSidebarState(),
    { panel: "files", type: "open-panel" }
  );
  const filesRequestedAgain = reduceStandaloneAgentToolSidebarState(filesOpen, {
    panel: "files",
    type: "open-panel"
  });
  const appsOpen = reduceStandaloneAgentToolSidebarState(filesRequestedAgain, {
    panel: "apps",
    type: "open-panel"
  });

  assert.equal(filesRequestedAgain.activePanel, "files");
  assert.deepEqual(filesRequestedAgain.mountedPanels, ["files"]);
  assert.equal(appsOpen.activePanel, "apps");
  assert.deepEqual(appsOpen.mountedPanels, ["files", "apps"]);
});

test("standalone agent tool sidebar switches between mounted file and terminal tabs", () => {
  const filesOpen = reduceStandaloneAgentToolSidebarState(
    createStandaloneAgentToolSidebarState(),
    { panel: "files", type: "open-panel" }
  );
  const terminalOpen = reduceStandaloneAgentToolSidebarState(filesOpen, {
    panel: "terminal",
    type: "open-panel"
  });
  const filesReopened = reduceStandaloneAgentToolSidebarState(terminalOpen, {
    panel: "files",
    type: "open-panel"
  });

  assert.equal(terminalOpen.activePanel, "terminal");
  assert.equal(filesReopened.activePanel, "files");
  assert.deepEqual(filesReopened.mountedPanels, ["files", "terminal"]);
});

test("standalone agent tool sidebar opens terminal in the right panel", () => {
  const initial = createStandaloneAgentToolSidebarState();
  const browserOpen = reduceStandaloneAgentToolSidebarState(initial, {
    panel: "browser",
    type: "select-tool"
  });
  const terminalOpen = reduceStandaloneAgentToolSidebarState(browserOpen, {
    panel: "terminal",
    type: "select-tool"
  });
  const filesOpen = reduceStandaloneAgentToolSidebarState(terminalOpen, {
    panel: "files",
    type: "toggle-panel"
  });
  const browserReopened = reduceStandaloneAgentToolSidebarState(filesOpen, {
    panel: "browser",
    type: "select-tool"
  });
  const browserClosed = reduceStandaloneAgentToolSidebarState(browserReopened, {
    type: "close"
  });

  assert.deepEqual(browserOpen, {
    activePanel: "browser",
    mountedPanels: ["browser"],
    terminalMounted: false,
    terminalOpen: false
  });
  assert.deepEqual(terminalOpen, {
    activePanel: "terminal",
    mountedPanels: ["browser", "terminal"],
    terminalMounted: true,
    terminalOpen: true
  });
  assert.equal(browserReopened.activePanel, "browser");
  assert.equal(browserReopened.terminalOpen, true);
  assert.equal(browserClosed.activePanel, null);
  assert.equal(browserClosed.terminalOpen, true);
  assert.deepEqual(browserClosed.mountedPanels, [
    "browser",
    "terminal",
    "files"
  ]);
});

test("standalone agent terminal remains mounted while right-sidebar panels switch", () => {
  const panels = ["files", "browser", "apps", "tasks", "messages"] as const;
  let state = reduceStandaloneAgentToolSidebarState(
    createStandaloneAgentToolSidebarState(),
    { panel: "terminal", type: "select-tool" }
  );

  for (const panel of panels) {
    state = reduceStandaloneAgentToolSidebarState(
      state,
      panel === "browser"
        ? { panel, type: "select-tool" }
        : { panel, type: "toggle-panel" }
    );
    assert.equal(state.activePanel, panel);
    assert.equal(state.terminalMounted, true);
    assert.equal(state.terminalOpen, true);
  }
});

test("standalone agent tool sidebar reports browser and terminal as one active group", () => {
  assert.equal(
    isStandaloneAgentToolGroupActive({
      activePanel: "browser",
      mountedPanels: [],
      terminalMounted: false,
      terminalOpen: false
    }),
    true
  );
  assert.equal(
    isStandaloneAgentToolGroupActive({
      activePanel: "terminal",
      mountedPanels: [],
      terminalMounted: true,
      terminalOpen: true
    }),
    true
  );
  assert.equal(
    isStandaloneAgentToolGroupActive({
      activePanel: "apps",
      mountedPanels: [],
      terminalMounted: true,
      terminalOpen: false
    }),
    false
  );
});

test("standalone agent tool sidebar normalizes reminder counts for compact badges", () => {
  assert.equal(formatStandaloneAgentToolReminderCount(undefined), null);
  assert.equal(formatStandaloneAgentToolReminderCount(-2), null);
  assert.equal(formatStandaloneAgentToolReminderCount(Number.NaN), null);
  assert.equal(formatStandaloneAgentToolReminderCount(1.8), "1");
  assert.equal(formatStandaloneAgentToolReminderCount(99), "99");
  assert.equal(formatStandaloneAgentToolReminderCount(100), "99+");
});

test("standalone agent browser and apps open at the same roomy default width", () => {
  assert.equal(standaloneAgentToolPanelDefaultWidthById.browser, 720);
  assert.equal(
    standaloneAgentToolPanelDefaultWidthById.apps,
    standaloneAgentToolPanelDefaultWidthById.browser
  );
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "browser",
      viewportWidth: 1340,
      width: standaloneAgentToolPanelDefaultWidthById.browser
    }),
    720
  );
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "apps",
      viewportWidth: 1340,
      width: standaloneAgentToolPanelDefaultWidthById.apps
    }),
    720
  );
});

test("standalone agent messages open wide enough for message cards", () => {
  assert.equal(standaloneAgentToolPanelDefaultWidthById.messages, 440);
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "messages",
      viewportWidth: 1340,
      width: standaloneAgentToolPanelDefaultWidthById.messages
    }),
    440
  );
});

test("standalone agent tasks open at the issue-manager workbench width", () => {
  assert.equal(standaloneAgentToolPanelDefaultWidthById.tasks, 860);
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "tasks",
      viewportWidth: 1440,
      width: standaloneAgentToolPanelDefaultWidthById.tasks
    }),
    860
  );
});

test("standalone agent file sidebar opens beside the conversation at the roomy shared width", () => {
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      panel: "files",
      viewportWidth: 1440,
      width: standaloneAgentToolPanelDefaultWidthById.files
    }),
    720
  );
  assert.equal(standaloneAgentToolPanelDefaultWidthById.files, 720);
});

test("standalone agent tool sidebar assigns native outward growth to the sidebar", () => {
  assert.equal(
    resolveStandaloneAgentToolSidebarWidth({
      baselineViewportWidth: 1200,
      mainContentMinWidth: 332,
      panel: "files",
      preferredWidth: 720,
      viewportWidth: 1920
    }),
    720
  );
  assert.equal(
    resolveStandaloneAgentToolSidebarWidth({
      baselineViewportWidth: 1200,
      mainContentMinWidth: 332,
      panel: "browser",
      preferredWidth: 720,
      viewportWidth: 2080
    }),
    880
  );
});

test("standalone agent tool sidebar always reserves its full width beside the message flow", () => {
  const panelWidth = resolveStandaloneAgentToolSidebarWidth({
    baselineViewportWidth: 1200,
    mainContentMinWidth: 332,
    panel: "apps",
    preferredWidth: 720,
    viewportWidth: 1560
  });
  assert.equal(panelWidth, 720);
  assert.equal(
    resolveStandaloneAgentToolSidebarLayoutWidth({
      baselineViewportWidth: 1200,
      panelWidth,
      viewportWidth: 1560
    }),
    720
  );
  assert.equal(resolveStandaloneAgentToolPanelMaxWidth("apps", 1920), 1200);
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      allowFullWidth: true,
      panel: "apps",
      viewportWidth: 1920,
      width: Number.MAX_SAFE_INTEGER
    }),
    1640
  );
});

test("standalone agent tool panels stop at the actual header rail boundary", () => {
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "files",
      viewportWidth: 1340,
      width: Number.MAX_SAFE_INTEGER
    }),
    1008
  );
  assert.equal(
    clampStandaloneAgentToolPanelWidth({
      mainContentMinWidth: 332,
      panel: "files",
      viewportWidth: 760,
      width: Number.MAX_SAFE_INTEGER
    }),
    428
  );
  assert.equal(
    resolveStandaloneAgentToolPanelMaxWidth("files", 760, false, 332),
    428
  );
});

test("standalone agent tool panel restores its width when an expanded panel closes or switches", () => {
  assert.deepEqual(
    resolveStandaloneAgentToolPanelExpansionReset({
      expandedPanel: "browser",
      nextPanel: null,
      widthBeforeExpansion: 720
    }),
    { panel: "browser", width: 720 }
  );
  assert.deepEqual(
    resolveStandaloneAgentToolPanelExpansionReset({
      expandedPanel: "browser",
      nextPanel: "files",
      widthBeforeExpansion: 680
    }),
    { panel: "browser", width: 680 }
  );
  assert.equal(
    resolveStandaloneAgentToolPanelExpansionReset({
      expandedPanel: "browser",
      nextPanel: "browser",
      widthBeforeExpansion: 720
    }),
    null
  );
  assert.equal(
    resolveStandaloneAgentToolSidebarWidth({
      baselineViewportWidth: 1200,
      mainContentMinWidth: 332,
      panel: "browser",
      preferredWidth:
        resolveStandaloneAgentToolPanelExpansionReset({
          expandedPanel: "browser",
          nextPanel: null,
          widthBeforeExpansion: 720
        })?.width ?? Number.MAX_SAFE_INTEGER,
      viewportWidth: 1920
    }),
    720
  );
});
