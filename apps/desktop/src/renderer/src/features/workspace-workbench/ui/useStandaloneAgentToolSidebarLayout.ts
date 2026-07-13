import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import {
  clampStandaloneAgentToolPanelWidth,
  resolveStandaloneAgentToolPanelMaxWidth,
  resolveStandaloneAgentToolPanelExpansionReset,
  resolveStandaloneAgentToolSidebarLayoutWidth,
  resolveStandaloneAgentToolSidebarWidth,
  standaloneAgentToolPanelDefaultWidthById,
  standaloneAgentToolPanelMinWidthById,
  type StandaloneAgentToolPanelId
} from "./standaloneAgentToolSidebarModel.ts";

type ToolPanelWidths = Record<StandaloneAgentToolPanelId, number>;

interface ToolPanelResizeState {
  panel: StandaloneAgentToolPanelId;
  pointerId: number;
  startClientX: number;
  startWidth: number;
}

interface UseStandaloneAgentToolSidebarLayoutInput {
  activePanel: StandaloneAgentToolPanelId | null;
  mainContentMinWidthPx?: number;
  resizeWindowContentWidth(width: number): Promise<{ width: number }>;
}

export function useStandaloneAgentToolSidebarLayout({
  activePanel,
  mainContentMinWidthPx,
  resizeWindowContentWidth
}: UseStandaloneAgentToolSidebarLayoutInput) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [panelWidths, setPanelWidths] = useState<ToolPanelWidths>(() => ({
    ...standaloneAgentToolPanelDefaultWidthById
  }));
  const [expandedPanel, setExpandedPanel] =
    useState<StandaloneAgentToolPanelId | null>(null);
  const expandedPanelRef = useRef<StandaloneAgentToolPanelId | null>(null);
  const baselineViewportWidthRef = useRef<number | null>(null);
  const panelWidthBeforeExpandRef = useRef<Partial<ToolPanelWidths>>({});
  const resizeRequestRef = useRef(0);
  const resizeStateRef = useRef<ToolPanelResizeState | null>(null);
  const resizeStyleRef = useRef<{
    cursor: string;
    userSelect: string;
  } | null>(null);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isActivePanelExpanded =
    activePanel !== null && expandedPanel === activePanel;
  const activePanelMaxWidth = activePanel
    ? resolveStandaloneAgentToolPanelMaxWidth(
        activePanel,
        viewportWidth,
        isActivePanelExpanded,
        mainContentMinWidthPx
      )
    : 0;
  const activePanelMinWidth = activePanel
    ? Math.min(
        standaloneAgentToolPanelMinWidthById[activePanel],
        activePanelMaxWidth
      )
    : 0;
  const activePanelWidth = activePanel
    ? resolveStandaloneAgentToolSidebarWidth({
        allowFullWidth: isActivePanelExpanded,
        baselineViewportWidth:
          baselineViewportWidthRef.current ?? viewportWidth,
        mainContentMinWidth: mainContentMinWidthPx,
        panel: activePanel,
        preferredWidth: panelWidths[activePanel],
        viewportWidth
      })
    : 0;
  const activePanelLayoutWidth = activePanel
    ? resolveStandaloneAgentToolSidebarLayoutWidth({
        baselineViewportWidth:
          baselineViewportWidthRef.current ?? viewportWidth,
        panelWidth: activePanelWidth,
        viewportWidth
      })
    : 0;

  const resetPanelExpansion = useCallback(
    (nextPanel: StandaloneAgentToolPanelId | null) => {
      const reset = resolveStandaloneAgentToolPanelExpansionReset({
        expandedPanel: expandedPanelRef.current,
        nextPanel,
        widthBeforeExpansion:
          expandedPanelRef.current === null
            ? undefined
            : panelWidthBeforeExpandRef.current[expandedPanelRef.current]
      });
      if (!reset) {
        return;
      }

      expandedPanelRef.current = null;
      setExpandedPanel(null);
      setPanelWidths((current) => ({
        ...current,
        [reset.panel]: reset.width
      }));
      delete panelWidthBeforeExpandRef.current[reset.panel];
    },
    []
  );

  const resizeForPanel = useCallback(
    async (nextPanel: StandaloneAgentToolPanelId | null): Promise<boolean> => {
      resetPanelExpansion(nextPanel);
      const requestId = ++resizeRequestRef.current;
      if (nextPanel !== null && baselineViewportWidthRef.current === null) {
        baselineViewportWidthRef.current = window.innerWidth;
      }
      const baselineViewportWidth = baselineViewportWidthRef.current;
      const requestedWidth =
        nextPanel === null
          ? baselineViewportWidth
          : (baselineViewportWidth ?? window.innerWidth) +
            panelWidths[nextPanel];

      if (requestedWidth !== null) {
        try {
          const result = await resizeWindowContentWidth(requestedWidth);
          if (requestId !== resizeRequestRef.current) {
            return false;
          }
          if (result.width > 0) {
            setViewportWidth(result.width);
          }
        } catch {
          if (requestId !== resizeRequestRef.current) {
            return false;
          }
        }
      }

      if (nextPanel === null) {
        baselineViewportWidthRef.current = null;
      }
      return true;
    },
    [panelWidths, resetPanelExpansion, resizeWindowContentWidth]
  );

  const updatePanelWidth = useCallback(
    (panel: StandaloneAgentToolPanelId, width: number) => {
      setPanelWidths((current) => ({
        ...current,
        [panel]: clampStandaloneAgentToolPanelWidth({
          allowFullWidth: expandedPanel === panel,
          mainContentMinWidth: mainContentMinWidthPx,
          panel,
          viewportWidth,
          width
        })
      }));
    },
    [expandedPanel, mainContentMinWidthPx, viewportWidth]
  );

  const togglePanelExpansion = useCallback(
    (panel: StandaloneAgentToolPanelId) => {
      if (expandedPanelRef.current === panel) {
        resetPanelExpansion(null);
        return;
      }

      resetPanelExpansion(panel);
      expandedPanelRef.current = panel;
      setExpandedPanel(panel);
      setPanelWidths((current) => {
        panelWidthBeforeExpandRef.current[panel] = current[panel];
        return { ...current, [panel]: Number.MAX_SAFE_INTEGER };
      });
    },
    [resetPanelExpansion]
  );

  const stopResizing = useCallback(() => {
    resizeStateRef.current = null;
    const styles = resizeStyleRef.current;
    if (!styles) {
      return;
    }
    document.body.style.cursor = styles.cursor;
    document.body.style.userSelect = styles.userSelect;
    resizeStyleRef.current = null;
  }, []);
  useEffect(() => stopResizing, [stopResizing]);

  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || activePanel === null) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeStateRef.current = {
        panel: activePanel,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startWidth: activePanelWidth
      };
      resizeStyleRef.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [activePanel, activePanelWidth]
  );

  const handleResizePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }
      updatePanelWidth(
        resizeState.panel,
        resizeState.startWidth + resizeState.startClientX - event.clientX
      );
    },
    [updatePanelWidth]
  );

  const handleResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (activePanel === null) {
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        updatePanelWidth(activePanel, activePanelMinWidth);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        updatePanelWidth(activePanel, Number.MAX_SAFE_INTEGER);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        updatePanelWidth(
          activePanel,
          activePanelWidth + (event.key === "ArrowLeft" ? 24 : -24)
        );
      }
    },
    [activePanel, activePanelMinWidth, activePanelWidth, updatePanelWidth]
  );

  return {
    activePanelLayoutWidth,
    activePanelMaxWidth,
    activePanelMinWidth,
    activePanelWidth,
    handleResizeKeyDown,
    handleResizePointerDown,
    handleResizePointerMove,
    isActivePanelExpanded,
    resizeForPanel,
    stopResizing,
    togglePanelExpansion
  };
}
