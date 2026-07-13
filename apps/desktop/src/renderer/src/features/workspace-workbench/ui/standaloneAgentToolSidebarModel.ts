export type StandaloneAgentToolPanelId =
  | "files"
  | "browser"
  | "apps"
  | "messages"
  | "terminal";

export type StandaloneAgentSharedToolPanelId = "terminal";
export type StandaloneAgentToolLauncherPanelId =
  | "browser"
  | StandaloneAgentSharedToolPanelId;

const standaloneAgentBrowserAndAppsDefaultWidth = 720;

export const standaloneAgentToolPanelDefaultWidthById: Record<
  StandaloneAgentToolPanelId,
  number
> = {
  apps: standaloneAgentBrowserAndAppsDefaultWidth,
  browser: standaloneAgentBrowserAndAppsDefaultWidth,
  files: standaloneAgentBrowserAndAppsDefaultWidth,
  messages: 440,
  terminal: standaloneAgentBrowserAndAppsDefaultWidth
};

export const standaloneAgentToolPanelMinWidthById: Record<
  StandaloneAgentToolPanelId,
  number
> = {
  apps: 420,
  browser: 420,
  files: 480,
  messages: 320,
  terminal: 420
};

export const standaloneAgentToolPanelMaxWidthById: Record<
  StandaloneAgentToolPanelId,
  number
> = {
  apps: 1_200,
  browser: 1_200,
  files: Number.MAX_SAFE_INTEGER,
  messages: 1_200,
  terminal: 1_200
};
export const standaloneAgentMainMinWidth = 280;

export function resolveStandaloneAgentToolPanelExpansionReset(input: {
  expandedPanel: StandaloneAgentToolPanelId | null;
  nextPanel: StandaloneAgentToolPanelId | null;
  widthBeforeExpansion?: number;
}): { panel: StandaloneAgentToolPanelId; width: number } | null {
  if (input.expandedPanel === null || input.expandedPanel === input.nextPanel) {
    return null;
  }

  return {
    panel: input.expandedPanel,
    width:
      typeof input.widthBeforeExpansion === "number" &&
      Number.isFinite(input.widthBeforeExpansion)
        ? input.widthBeforeExpansion
        : standaloneAgentToolPanelDefaultWidthById[input.expandedPanel]
  };
}

export interface StandaloneAgentToolSidebarState {
  activePanel: StandaloneAgentToolPanelId | null;
  mountedPanels: StandaloneAgentToolPanelId[];
  terminalOpen: boolean;
  terminalMounted: boolean;
}

export type StandaloneAgentToolSidebarAction =
  | {
      panel: StandaloneAgentToolPanelId;
      type: "open-panel";
    }
  | {
      panel: Exclude<StandaloneAgentToolPanelId, "browser">;
      type: "toggle-panel";
    }
  | {
      panel: StandaloneAgentToolPanelId;
      type: "close-panel";
    }
  | {
      panel: StandaloneAgentToolLauncherPanelId;
      type: "select-tool";
    }
  | { type: "toggle-terminal" }
  | { type: "close" };

export function createStandaloneAgentToolSidebarState(
  initial?: Partial<StandaloneAgentToolSidebarState>
): StandaloneAgentToolSidebarState {
  const activePanel = initial?.activePanel ?? null;
  return {
    activePanel,
    mountedPanels:
      initial?.mountedPanels ?? (activePanel === null ? [] : [activePanel]),
    terminalMounted: initial?.terminalMounted ?? initial?.terminalOpen === true,
    terminalOpen: initial?.terminalOpen ?? false
  };
}

function mountPanel(
  mountedPanels: StandaloneAgentToolPanelId[],
  panel: StandaloneAgentToolPanelId
): StandaloneAgentToolPanelId[] {
  return mountedPanels.includes(panel)
    ? mountedPanels
    : [...mountedPanels, panel];
}

export function reduceStandaloneAgentToolSidebarState(
  state: StandaloneAgentToolSidebarState,
  action: StandaloneAgentToolSidebarAction
): StandaloneAgentToolSidebarState {
  switch (action.type) {
    case "close":
      return state.activePanel === null
        ? state
        : { ...state, activePanel: null };
    case "close-panel": {
      const mountedPanels = state.mountedPanels.filter(
        (panel) => panel !== action.panel
      );
      const nextActivePanel =
        state.activePanel === action.panel
          ? (mountedPanels[mountedPanels.length - 1] ?? null)
          : state.activePanel;
      return {
        ...state,
        activePanel: nextActivePanel,
        mountedPanels,
        ...(action.panel === "terminal"
          ? { terminalMounted: false, terminalOpen: false }
          : {})
      };
    }
    case "select-tool":
      if (action.panel === "terminal") {
        return {
          ...state,
          activePanel: "terminal",
          mountedPanels: mountPanel(state.mountedPanels, "terminal"),
          terminalMounted: true,
          terminalOpen: true
        };
      }
      return {
        activePanel: action.panel,
        mountedPanels: mountPanel(state.mountedPanels, action.panel),
        terminalMounted: state.terminalMounted,
        terminalOpen: state.terminalOpen
      };
    case "open-panel":
      return {
        ...state,
        activePanel: action.panel,
        mountedPanels: mountPanel(state.mountedPanels, action.panel),
        ...(action.panel === "terminal"
          ? { terminalMounted: true, terminalOpen: true }
          : {})
      };
    case "toggle-panel":
      if (state.activePanel === action.panel) {
        return { ...state, activePanel: null };
      }
      return {
        ...state,
        activePanel: action.panel,
        mountedPanels: mountPanel(state.mountedPanels, action.panel)
      };
    case "toggle-terminal":
      return {
        ...state,
        activePanel: state.activePanel === "terminal" ? null : "terminal",
        mountedPanels: mountPanel(state.mountedPanels, "terminal"),
        terminalMounted: true,
        terminalOpen: !state.terminalOpen
      };
  }
}

export function isStandaloneAgentToolGroupActive(
  state: StandaloneAgentToolSidebarState
): boolean {
  return state.activePanel === "browser" || state.activePanel === "terminal";
}

export function formatStandaloneAgentToolReminderCount(
  value: number | null | undefined
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const count = Math.floor(value);
  return count > 99 ? "99+" : String(count);
}

export function clampStandaloneAgentToolPanelWidth(input: {
  allowFullWidth?: boolean;
  mainContentMinWidth?: number;
  panel: StandaloneAgentToolPanelId;
  viewportWidth: number;
  width: number;
}): number {
  const maxWidth = resolveStandaloneAgentToolPanelMaxWidth(
    input.panel,
    input.viewportWidth,
    input.allowFullWidth,
    input.mainContentMinWidth
  );
  const minWidth = Math.min(
    standaloneAgentToolPanelMinWidthById[input.panel],
    maxWidth
  );
  const width = Number.isFinite(input.width)
    ? input.width
    : standaloneAgentToolPanelDefaultWidthById[input.panel];
  return Math.round(Math.min(maxWidth, Math.max(minWidth, width)));
}

export function resolveStandaloneAgentToolSidebarWidth(input: {
  allowFullWidth?: boolean;
  baselineViewportWidth: number;
  mainContentMinWidth?: number;
  panel: StandaloneAgentToolPanelId;
  preferredWidth: number;
  viewportWidth: number;
}): number {
  const baselineViewportWidth = Number.isFinite(input.baselineViewportWidth)
    ? Math.max(0, input.baselineViewportWidth)
    : input.viewportWidth;
  const outwardWidth = Math.max(0, input.viewportWidth - baselineViewportWidth);

  return clampStandaloneAgentToolPanelWidth({
    allowFullWidth: input.allowFullWidth,
    mainContentMinWidth: input.mainContentMinWidth,
    panel: input.panel,
    viewportWidth: input.viewportWidth,
    width: Math.max(input.preferredWidth, outwardWidth)
  });
}

export function resolveStandaloneAgentToolSidebarLayoutWidth(input: {
  baselineViewportWidth: number;
  panelWidth: number;
  viewportWidth: number;
}): number {
  return Math.round(Math.max(0, input.panelWidth));
}

export function resolveStandaloneAgentToolPanelMaxWidth(
  panel: StandaloneAgentToolPanelId,
  viewportWidth: number,
  allowFullWidth = false,
  mainContentMinWidth = standaloneAgentMainMinWidth
): number {
  const minWidth = standaloneAgentToolPanelMinWidthById[panel];
  const resolvedMainContentMinWidth = Number.isFinite(mainContentMinWidth)
    ? Math.max(0, mainContentMinWidth)
    : standaloneAgentMainMinWidth;
  const resolvedViewportWidth = Number.isFinite(viewportWidth)
    ? viewportWidth
    : resolvedMainContentMinWidth + minWidth;
  return Math.max(
    0,
    Math.min(
      allowFullWidth
        ? Number.MAX_SAFE_INTEGER
        : standaloneAgentToolPanelMaxWidthById[panel],
      resolvedViewportWidth - resolvedMainContentMinWidth
    )
  );
}
