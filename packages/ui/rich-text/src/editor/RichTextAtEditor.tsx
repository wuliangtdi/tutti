import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type JSX
} from "react";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { ViewportMenuSurface } from "@tutti-os/ui-system/components";
import { cn } from "@tutti-os/ui-system/utils";
import { createRichTextMentionAttrs } from "../plugins/index.ts";
import { createRichTextAtRegistry } from "../plugins/atRegistry.ts";
import type {
  RichTextAtInsertResult,
  RichTextAtProviderContext,
  RichTextAtProvider,
  RichTextAtQueryMatch
} from "../types/at.ts";
import {
  normalizeRichTextContent,
  normalizeRichTextLinkHref,
  parseRichTextContentToDocument,
  serializeRichTextDocumentToContent
} from "../core/richTextDocument.ts";
import {
  findRichTextAtQuery,
  queryRichTextAtMatches
} from "./richTextAtQuery.ts";
import { isRichTextImeComposing } from "./richTextIme.ts";
import {
  resolveRichTextAtText,
  type RichTextAtTextOverrides
} from "./richTextAtText.ts";
import type { RichTextI18nRuntime } from "../i18n/richTextI18n.ts";
import { MentionReference } from "../extensions/mentionReference.ts";
import { WorkspaceReference } from "../extensions/workspaceReference.ts";
import {
  mentionReferenceNodeName,
  workspaceReferenceNodeName
} from "../extensions/names.ts";

export interface RichTextAtEditorProps {
  value: string;
  onChange: (value: string) => void;
  providers?: readonly RichTextAtProvider[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  placeholderClassName?: string;
  minQueryLength?: number;
  maxResults?: number;
  removeDecorationAriaLabel?: string;
  i18n?: RichTextI18nRuntime;
  textOverrides?: RichTextAtTextOverrides;
  overlay?: ReactNode;
  focusSignal?: unknown;
  renderPanel?: (context: RichTextAtEditorPanelContext) => ReactNode;
  // Tab/Shift+Tab cycle the at-panel filter tabs (parity with the agent
  // composer). When omitted, Tab is left to the browser.
  onCycleFilter?: (delta: 1 | -1) => void;
  // Footer keyboard hints (parity with the agent composer). The Tab hint only
  // renders when onCycleFilter is provided.
  cycleFilterHintLabel?: string;
  moveSelectionHintLabel?: string;
}

type RichTextEditorAtQueryState = {
  from: number;
  keyword: string;
  to: number;
};

export interface RichTextAtEditorPanelContext {
  activeIndex: number;
  activeMatch: RichTextAtQueryMatch | null;
  isLoading: boolean;
  matches: readonly RichTextAtQueryMatch[];
  maxResults: number;
  onActiveIndexChange: (index: number) => void;
  onActiveMatchChange: (match: RichTextAtQueryMatch | null) => void;
  onNavigationMatchesChange: (
    matches: readonly RichTextAtQueryMatch[] | null
  ) => void;
  onSelect: (match: RichTextAtQueryMatch) => void;
  providerContext: RichTextAtProviderContext;
  providers: readonly RichTextAtProvider[];
  query: RichTextEditorAtQueryState;
  text: ReturnType<typeof resolveRichTextAtText>;
}

export function RichTextAtEditor({
  value,
  onChange,
  providers = [],
  placeholder,
  disabled = false,
  className,
  textareaClassName,
  placeholderClassName,
  minQueryLength = 0,
  maxResults = 8,
  removeDecorationAriaLabel,
  i18n,
  textOverrides,
  overlay,
  focusSignal,
  renderPanel,
  onCycleFilter,
  cycleFilterHintLabel,
  moveSelectionHintLabel
}: RichTextAtEditorProps): JSX.Element {
  const menuOffset = 6;
  const normalizedValue = normalizeRichTextContent(value);
  const text = resolveRichTextAtText(
    textOverrides,
    removeDecorationAriaLabel,
    i18n
  );
  const latestOnChangeRef = useRef(onChange);
  const lastSerializedValueRef = useRef(normalizedValue);
  const lastFocusSignalRef = useRef(focusSignal);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const registry = useMemo(
    () => createRichTextAtRegistry(providers),
    [providers]
  );
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState<RichTextEditorAtQueryState | null>(null);
  const [matches, setMatches] = useState<readonly RichTextAtQueryMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [navigationMatches, setNavigationMatches] = useState<
    readonly RichTextAtQueryMatch[] | null
  >(null);
  const [activeNavigationMatch, setActiveNavigationMatch] =
    useState<RichTextAtQueryMatch | null>(null);
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  latestOnChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      WorkspaceReference.configure({
        removeActionAriaLabel: text.removeReferenceActionLabel
      }),
      MentionReference
    ],
    content: parseRichTextContentToDocument(normalizedValue),
    editorProps: {
      attributes: {
        class: cn(
          "w-full whitespace-pre-wrap break-words outline-none",
          textareaClassName
        )
      }
    },
    onBlur() {
      window.setTimeout(() => {
        setIsFocused(false);
        setMatches([]);
        setActiveIndex(0);
        setIsLoading(false);
        setMenuPoint(null);
      }, 100);
    },
    onFocus() {
      setIsFocused(true);
    },
    onUpdate({ editor }) {
      const serialized = serializeRichTextDocumentToContent(editor.getJSON());
      lastSerializedValueRef.current = serialized;
      latestOnChangeRef.current(serialized);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (lastSerializedValueRef.current === normalizedValue) {
      return;
    }

    const currentSerialized = serializeRichTextDocumentToContent(
      editor.getJSON()
    );
    if (currentSerialized === normalizedValue) {
      lastSerializedValueRef.current = normalizedValue;
      return;
    }

    editor.commands.setContent(
      parseRichTextContentToDocument(normalizedValue),
      {
        emitUpdate: false
      }
    );
    lastSerializedValueRef.current = normalizedValue;
  }, [editor, normalizedValue]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (Object.is(lastFocusSignalRef.current, focusSignal)) {
      return;
    }

    lastFocusSignalRef.current = focusSignal;
    editor.commands.focus("end");
  }, [editor, focusSignal]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
    editor.view.dispatch(
      editor.state.tr.setMeta("richTextEditable", !disabled)
    );
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateQueryState = () => {
      const nextQuery = isFocused ? findEditorAtQuery(editor) : null;
      setQuery(nextQuery);
    };

    const updateFocus = () => {
      setIsFocused(editor.isFocused);
      updateQueryState();
    };

    updateQueryState();
    editor.on("selectionUpdate", updateQueryState);
    editor.on("transaction", updateQueryState);
    editor.on("focus", updateFocus);
    editor.on("blur", updateFocus);
    return () => {
      editor.off("selectionUpdate", updateQueryState);
      editor.off("transaction", updateQueryState);
      editor.off("focus", updateFocus);
      editor.off("blur", updateFocus);
    };
  }, [editor, isFocused]);

  useEffect(() => {
    if (!editor || !query || !isFocused || providers.length === 0) {
      setMatches([]);
      setActiveIndex(0);
      setIsLoading(false);
      setNavigationMatches(null);
      setActiveNavigationMatch(null);
      return;
    }

    if (query.keyword.length < minQueryLength) {
      setMatches([]);
      setActiveIndex(0);
      setIsLoading(false);
      setNavigationMatches(null);
      setActiveNavigationMatch(null);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);

    void queryRichTextAtMatches(registry, {
      abortSignal: abortController.signal,
      keyword: query.keyword,
      maxResults,
      context: createRichTextAtEditorProviderContext(editor)
    })
      .then((nextMatches) => {
        if (abortController.signal.aborted) {
          return;
        }
        setMatches(nextMatches);
        setNavigationMatches(null);
        setActiveNavigationMatch(null);
        setActiveIndex((current) =>
          nextMatches.length === 0
            ? 0
            : Math.max(0, Math.min(current, nextMatches.length - 1))
        );
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [
    editor,
    isFocused,
    maxResults,
    minQueryLength,
    providers.length,
    query,
    registry
  ]);

  useLayoutEffect(() => {
    if (!editor || !query || !isFocused) {
      setMenuPoint(null);
      return;
    }

    const updateMenuPoint = () => {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      setMenuPoint({
        x: coords.left,
        y: coords.bottom + menuOffset
      });
    };

    updateMenuPoint();
    window.addEventListener("resize", updateMenuPoint);
    window.addEventListener("scroll", updateMenuPoint, {
      capture: true,
      passive: true
    });
    return () => {
      window.removeEventListener("resize", updateMenuPoint);
      window.removeEventListener("scroll", updateMenuPoint, true);
    };
  }, [editor, isFocused, menuOffset, query]);

  const isMenuOpen = isFocused && !!query && (isLoading || matches.length > 0);
  const isEmpty =
    !editor ||
    serializeRichTextDocumentToContent(editor.getJSON()).trim().length === 0;
  const updateNavigationMatches = useCallback(
    (nextMatches: readonly RichTextAtQueryMatch[] | null) => {
      setNavigationMatches((current) =>
        haveSameRichTextAtMatches(current, nextMatches) ? current : nextMatches
      );
      setActiveNavigationMatch((current) => {
        if (!nextMatches || !current) {
          return null;
        }
        return nextMatches.some((match) =>
          isSameRichTextAtMatch(match, current)
        )
          ? current
          : null;
      });
    },
    []
  );
  const activeMatch = activeNavigationMatch ?? matches[activeIndex] ?? null;
  const handleActiveIndexChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setActiveNavigationMatch(matches[index] ?? null);
    },
    [matches]
  );

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      const selectableMatches =
        navigationMatches && navigationMatches.length > 0
          ? navigationMatches
          : matches;
      if (selectableMatches.length === 0) {
        return;
      }
      const currentMatch = activeNavigationMatch ?? matches[activeIndex];
      const currentSelectableIndex = currentMatch
        ? selectableMatches.findIndex((match) =>
            isSameRichTextAtMatch(match, currentMatch)
          )
        : -1;
      const selectedIndex =
        currentSelectableIndex >= 0 ? currentSelectableIndex : 0;
      const match =
        selectableMatches[
          (selectedIndex + delta + selectableMatches.length) %
            selectableMatches.length
        ];
      if (!match) {
        return;
      }
      const nextActiveIndex = matches.findIndex((candidate) =>
        isSameRichTextAtMatch(candidate, match)
      );
      if (nextActiveIndex >= 0) {
        setActiveIndex(nextActiveIndex);
      }
      setActiveNavigationMatch(match);
    },
    [activeIndex, activeNavigationMatch, matches, navigationMatches]
  );

  const applyMatch = (match: RichTextAtQueryMatch) => {
    if (!editor || !query) {
      return;
    }

    const content = renderInsertResultAsEditorContent(
      match.providerId,
      match.insertResult
    );
    if (!content) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContentAt({ from: query.from, to: query.to }, content)
      .run();
    setMatches([]);
    setNavigationMatches(null);
    setActiveNavigationMatch(null);
    setActiveIndex(0);
    setIsLoading(false);
    setMenuPoint(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isRichTextImeComposing(event)) {
      return;
    }

    if (!isMenuOpen) {
      return;
    }

    // Tab cycles the filter tabs (parity with the agent composer). Handled
    // before the empty check so it still works while the active tab is empty.
    if (event.key === "Tab" && onCycleFilter) {
      event.preventDefault();
      onCycleFilter(event.shiftKey ? -1 : 1);
      return;
    }

    const selectableMatches =
      navigationMatches && navigationMatches.length > 0
        ? navigationMatches
        : matches;
    if (selectableMatches.length === 0) {
      return;
    }
    const currentMatch = activeNavigationMatch ?? matches[activeIndex];
    const currentSelectableIndex = currentMatch
      ? selectableMatches.findIndex((match) =>
          isSameRichTextAtMatch(match, currentMatch)
        )
      : -1;
    const selectedIndex =
      currentSelectableIndex >= 0 ? currentSelectableIndex : 0;
    const activateSelectableIndex = (nextSelectableIndex: number) => {
      const match = selectableMatches[nextSelectableIndex];
      if (!match) {
        return;
      }
      const nextActiveIndex = matches.findIndex((candidate) =>
        isSameRichTextAtMatch(candidate, match)
      );
      if (nextActiveIndex >= 0) {
        setActiveIndex(nextActiveIndex);
      }
      setActiveNavigationMatch(match);
    };

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activateSelectableIndex((selectedIndex + 1) % selectableMatches.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      activateSelectableIndex(
        (selectedIndex - 1 + selectableMatches.length) %
          selectableMatches.length
      );
      return;
    }

    if (event.key === "Enter") {
      const match = selectableMatches[selectedIndex];
      if (!match) {
        return;
      }
      event.preventDefault();
      applyMatch(match);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMatches([]);
      setNavigationMatches(null);
      setActiveNavigationMatch(null);
      setActiveIndex(0);
      setIsLoading(false);
      setMenuPoint(null);
    }
  };

  return (
    <div
      className={cn("relative min-w-0 w-full", className)}
      ref={containerRef}
    >
      <div className="w-full min-w-0" onKeyDownCapture={handleKeyDown}>
        <EditorContent editor={editor} />
      </div>
      {isEmpty && placeholder ? (
        <div className="pointer-events-none absolute top-0 right-0 left-0 px-0 py-0 text-[var(--text-placeholder)]">
          <div
            className={cn(
              "min-w-0 w-full whitespace-pre-wrap",
              placeholderClassName ?? textareaClassName,
              "text-[var(--text-placeholder)]"
            )}
          >
            {placeholder}
          </div>
        </div>
      ) : null}
      {overlay}
      {isMenuOpen && menuPoint ? (
        <ViewportMenuSurface
          open
          className="tutti-rich-text-at-menu w-[min(28rem,calc(100vw-24px))] p-0"
          placement={{
            type: "point",
            point: menuPoint,
            alignX: "start",
            alignY: "start",
            estimatedSize: {
              width: 360,
              height: 256
            }
          }}
        >
          <div className="flex max-h-64 min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {renderPanel ? (
            renderPanel({
              activeIndex,
              activeMatch,
              isLoading,
              matches,
              maxResults,
              onActiveIndexChange: handleActiveIndexChange,
              onActiveMatchChange: setActiveNavigationMatch,
              onNavigationMatchesChange: updateNavigationMatches,
              onSelect: applyMatch,
              providerContext: editor
                ? createRichTextAtEditorProviderContext(editor)
                : {},
              providers,
              query,
              text
            })
          ) : matches.length > 0 ? (
            matches.map((match, index) => (
              <button
                key={`${match.providerId}:${match.key}`}
                aria-selected={index === activeIndex}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors",
                  index === activeIndex
                    ? "bg-transparency-block text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-transparency-block"
                )}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyMatch(match);
                }}
              >
                <div className="text-[13px] leading-5 font-medium">
                  {match.label}
                </div>
                {match.subtitle ? (
                  <div className="text-[11px] leading-4 text-[var(--text-secondary)]">
                    {match.subtitle}
                  </div>
                ) : null}
              </button>
            ))
              ) : (
                <div className="px-3 py-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                  {isLoading ? text.loadingLabel : text.noMatchesLabel}
                </div>
              )}
            </div>
            <RichTextAtMenuFooter
              cycleFilterHintLabel={
                onCycleFilter ? cycleFilterHintLabel : undefined
              }
              moveSelectionHintLabel={moveSelectionHintLabel}
              onCycleFilter={onCycleFilter}
              onMoveSelection={moveSelection}
            />
          </div>
        </ViewportMenuSurface>
      ) : null}
    </div>
  );
}

function RichTextAtMenuFooter({
  cycleFilterHintLabel,
  moveSelectionHintLabel,
  onCycleFilter,
  onMoveSelection
}: {
  cycleFilterHintLabel?: string;
  moveSelectionHintLabel?: string;
  onCycleFilter?: (delta: 1 | -1) => void;
  onMoveSelection: (delta: 1 | -1) => void;
}): JSX.Element | null {
  const showCycleHint = !!cycleFilterHintLabel && !!onCycleFilter;
  const showMoveHint = !!moveSelectionHintLabel;
  if (!showCycleHint && !showMoveHint) {
    return null;
  }
  const arrowButtonClassName =
    "flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-[var(--line-1)] bg-[var(--transparency-block)] px-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]";
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line-1)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
      {showCycleHint ? (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:text-[var(--text-secondary)]"
          aria-label={cycleFilterHintLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onCycleFilter?.(1)}
        >
          {/* i18n-check-ignore: Keyboard key label. */}
          <kbd className={arrowButtonClassName}>Tab</kbd>
          <span>{cycleFilterHintLabel}</span>
        </button>
      ) : null}
      {showCycleHint && showMoveHint ? (
        <span aria-hidden="true" className="text-[var(--line-1)]">
          ｜
        </span>
      ) : null}
      {showMoveHint ? (
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1">
            <button
              type="button"
              className={arrowButtonClassName}
              aria-label={`↑ ${moveSelectionHintLabel}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onMoveSelection(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={arrowButtonClassName}
              aria-label={`↓ ${moveSelectionHintLabel}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onMoveSelection(1)}
            >
              ↓
            </button>
          </span>
          <span>{moveSelectionHintLabel}</span>
        </span>
      ) : null}
    </div>
  );
}

function findEditorAtQuery(
  editor: TiptapEditor
): RichTextEditorAtQueryState | null {
  const { selection } = editor.state;
  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  if (!$from.parent.isTextblock) {
    return null;
  }

  const textBeforeCursor = $from.parent.textBetween(
    0,
    $from.parentOffset,
    "\n",
    "\uFFFC"
  );
  const query = findRichTextAtQuery(textBeforeCursor, textBeforeCursor.length);
  if (!query) {
    return null;
  }

  const distanceFromQueryStart = textBeforeCursor.length - query.from;
  return {
    from: selection.from - distanceFromQueryStart,
    keyword: query.keyword,
    to: selection.from
  };
}

function createRichTextAtEditorProviderContext(
  editor: TiptapEditor
): RichTextAtProviderContext {
  return {
    blockText: editor.state.selection.$from.parent.textBetween(
      0,
      editor.state.selection.$from.parent.content.size,
      "\n",
      "\uFFFC"
    ),
    documentText: serializeRichTextDocumentToContent(editor.getJSON())
  };
}

function renderInsertResultAsEditorContent(
  providerId: string,
  result: RichTextAtInsertResult
) {
  switch (result.kind) {
    case "mention":
      return {
        type: mentionReferenceNodeName,
        attrs: createRichTextMentionAttrs(providerId, result.mention)
      };
    case "markdown-link": {
      const kind = result.href.endsWith("/") ? "folder" : "file";
      return {
        type: workspaceReferenceNodeName,
        attrs: {
          kind,
          label: result.label,
          path: normalizeRichTextLinkHref(result.href, kind)
        }
      };
    }
    case "text":
      return result.text;
    default:
      return null;
  }
}

function isSameRichTextAtMatch(
  left: RichTextAtQueryMatch,
  right: RichTextAtQueryMatch
): boolean {
  return left.providerId === right.providerId && left.key === right.key;
}

function haveSameRichTextAtMatches(
  left: readonly RichTextAtQueryMatch[] | null,
  right: readonly RichTextAtQueryMatch[] | null
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return left.every((match, index) => {
    const rightMatch = right[index];
    return rightMatch ? isSameRichTextAtMatch(match, rightMatch) : false;
  });
}
