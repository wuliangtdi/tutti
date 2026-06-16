import { useEffect, useMemo, useState, type JSX, type ReactNode } from "react";
import { cn } from "@tutti-os/ui-system/utils";
import type {
  RichTextAtProvider,
  RichTextAtProviderContext,
  RichTextAtQueryMatch,
  RichTextAtReferenceItem,
  RichTextAtReferenceItemsResult,
  RichTextAtReferenceItemsResponse
} from "../types/at.ts";
import {
  DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE,
  RICH_TEXT_AT_ALL_FILTER_ID,
  groupRichTextAtMatches,
  richTextAtGroupExpandCount
} from "./searchHelpers.ts";
import type {
  RichTextAtFilterId,
  RichTextAtPanelReferenceItem,
  RichTextAtProviderGroup,
  RichTextAtSearchGroup
} from "./types.ts";

export interface RichTextAtPanelText {
  loadingLabel: string;
  noMatchesLabel: string;
  allFilterLabel?: string;
  showMoreLabel?: (count: number) => string;
  showMoreReferencesLabel?: (count: number) => string;
}

export interface RichTextAtPanelProps {
  activeIndex: number;
  activeMatch?: RichTextAtQueryMatch | null;
  isLoading: boolean;
  matches: readonly RichTextAtQueryMatch[];
  text: RichTextAtPanelText;
  filterTabs?: readonly { id: RichTextAtFilterId; label: string }[];
  // Controlled active filter. When provided, the panel reflects it and reports
  // changes through onActiveFilterChange (so Tab-cycling stays in sync with the
  // editor keyboard). When omitted, the panel manages the filter internally.
  activeFilterId?: RichTextAtFilterId;
  onActiveFilterChange?: (filterId: RichTextAtFilterId) => void;
  providerContext?: RichTextAtProviderContext;
  providerGroups?: readonly RichTextAtProviderGroup[];
  providers?: readonly RichTextAtProvider[];
  queryKeyword?: string;
  referencePageSize?: number;
  renderItemIcon?: (match: RichTextAtQueryMatch) => ReactNode;
  onActiveIndexChange?: (index: number) => void;
  onActiveMatchChange?: (match: RichTextAtQueryMatch | null) => void;
  onNavigationMatchesChange?: (
    matches: readonly RichTextAtQueryMatch[] | null
  ) => void;
  onSelect: (match: RichTextAtQueryMatch) => void;
}

interface ReferenceItemsState {
  items: readonly RichTextAtPanelReferenceItem[];
  loading: boolean;
  nextCursor: string | null;
}

export function RichTextAtPanel({
  activeIndex,
  activeMatch,
  isLoading,
  filterTabs,
  activeFilterId,
  onActiveFilterChange,
  matches,
  providerContext = {},
  providerGroups,
  providers = [],
  queryKeyword = "",
  referencePageSize = DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE,
  renderItemIcon,
  text,
  onActiveIndexChange,
  onActiveMatchChange,
  onNavigationMatchesChange,
  onSelect
}: RichTextAtPanelProps): JSX.Element {
  if (providerGroups && providerGroups.length > 0) {
    return (
      <RichTextAtGroupedPanel
        activeIndex={activeIndex}
        activeMatch={activeMatch ?? null}
        filterTabs={filterTabs}
        activeFilterId={activeFilterId}
        onActiveFilterChange={onActiveFilterChange}
        isLoading={isLoading}
        matches={matches}
        providerContext={providerContext}
        providerGroups={providerGroups}
        providers={providers}
        queryKeyword={queryKeyword}
        referencePageSize={referencePageSize}
        renderItemIcon={renderItemIcon}
        text={text}
        onActiveIndexChange={onActiveIndexChange}
        onActiveMatchChange={onActiveMatchChange}
        onNavigationMatchesChange={onNavigationMatchesChange}
        onSelect={onSelect}
      />
    );
  }

  if (matches.length === 0) {
    return (
      <RichTextAtPanelEmptyState
        label={isLoading ? text.loadingLabel : text.noMatchesLabel}
      />
    );
  }

  return (
    <>
      {matches.map((match, index) => (
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
          onMouseEnter={() => {
            onActiveIndexChange?.(index);
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(match);
          }}
        >
          <RichTextAtPanelRowContent
            match={match}
            renderItemIcon={renderItemIcon}
          />
        </button>
      ))}
    </>
  );
}

function RichTextAtGroupedPanel({
  activeIndex,
  activeMatch,
  filterTabs,
  activeFilterId: controlledActiveFilterId,
  onActiveFilterChange,
  isLoading,
  matches,
  providerContext,
  providerGroups,
  providers,
  queryKeyword,
  referencePageSize,
  renderItemIcon,
  text,
  onActiveIndexChange,
  onActiveMatchChange,
  onNavigationMatchesChange,
  onSelect
}: Required<
  Pick<
    RichTextAtPanelProps,
    | "activeIndex"
    | "activeMatch"
    | "isLoading"
    | "matches"
    | "providerContext"
    | "providerGroups"
    | "providers"
    | "queryKeyword"
    | "referencePageSize"
    | "text"
    | "onSelect"
  >
> &
  Pick<
    RichTextAtPanelProps,
    | "filterTabs"
    | "activeFilterId"
    | "onActiveFilterChange"
    | "onActiveIndexChange"
    | "onActiveMatchChange"
    | "onNavigationMatchesChange"
    | "renderItemIcon"
  >): JSX.Element {
  const [internalFilterId, setInternalFilterId] = useState<RichTextAtFilterId>(
    filterTabs?.[0]?.id ?? RICH_TEXT_AT_ALL_FILTER_ID
  );
  const activeFilterId = controlledActiveFilterId ?? internalFilterId;
  const setActiveFilterId = (filterId: RichTextAtFilterId) => {
    onActiveFilterChange?.(filterId);
    if (controlledActiveFilterId === undefined) {
      setInternalFilterId(filterId);
    }
  };
  const [expandedCounts, setExpandedCounts] = useState<
    Record<string, number | undefined>
  >({});
  const [referenceItemsByMatchKey, setReferenceItemsByMatchKey] = useState<
    Record<string, ReferenceItemsState | undefined>
  >({});
  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers]
  );
  const groups = useMemo(
    () =>
      groupRichTextAtMatches({
        expandedCounts,
        filterId: activeFilterId,
        groups: providerGroups,
        matches,
        pageSize: DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE
      }),
    [activeFilterId, expandedCounts, matches, providerGroups]
  );
  const matchIndexByKey = useMemo(
    () =>
      new Map(
        matches.map((match, index) => [richTextAtPanelMatchKey(match), index])
      ),
    [matches]
  );
  const navigationMatches = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.flatMap((match) => {
          const referenceItems =
            referenceItemsByMatchKey[richTextAtPanelMatchKey(match)]?.items ??
            [];
          return [
            match,
            ...referenceItems.map((referenceItem) =>
              richTextAtPanelReferenceMatch(match, referenceItem)
            )
          ];
        })
      ),
    [groups, referenceItemsByMatchKey]
  );
  const effectiveFilterTabs = useMemo(
    () =>
      filterTabs ?? [
        {
          id: RICH_TEXT_AT_ALL_FILTER_ID,
          label: text.allFilterLabel ?? RICH_TEXT_AT_ALL_FILTER_ID
        },
        ...providerGroups.map((group) => ({
          id: group.filterId ?? group.id,
          label: group.label
        }))
      ],
    [filterTabs, providerGroups, text.allFilterLabel]
  );

  useEffect(() => {
    // In controlled mode the consumer owns filter validity.
    if (controlledActiveFilterId !== undefined) {
      return;
    }
    const availableFilterIds = new Set(
      effectiveFilterTabs.map((filter) => filter.id)
    );
    if (!availableFilterIds.has(internalFilterId)) {
      setInternalFilterId(
        effectiveFilterTabs[0]?.id ?? RICH_TEXT_AT_ALL_FILTER_ID
      );
    }
  }, [controlledActiveFilterId, internalFilterId, effectiveFilterTabs]);

  useEffect(() => {
    onNavigationMatchesChange?.(navigationMatches);
  }, [navigationMatches, onNavigationMatchesChange]);

  useEffect(() => {
    return () => {
      onNavigationMatchesChange?.(null);
    };
  }, [onNavigationMatchesChange]);

  useEffect(() => {
    if (navigationMatches.length === 0) {
      return;
    }
    const effectiveActiveMatch = activeMatch ?? matches[activeIndex];
    if (
      effectiveActiveMatch &&
      navigationMatches.some((match) =>
        richTextAtPanelMatchesEqual(match, effectiveActiveMatch)
      )
    ) {
      return;
    }
    const nextActiveMatch = navigationMatches[0];
    if (!nextActiveMatch) {
      return;
    }
    const nextActiveIndex = matchIndexByKey.get(
      richTextAtPanelMatchKey(nextActiveMatch)
    );
    if (nextActiveIndex !== undefined && nextActiveIndex >= 0) {
      onActiveIndexChange?.(nextActiveIndex);
    }
    onActiveMatchChange?.(nextActiveMatch);
  }, [
    activeIndex,
    activeMatch,
    matchIndexByKey,
    matches,
    navigationMatches,
    onActiveIndexChange,
    onActiveMatchChange
  ]);

  useEffect(() => {
    const activeMatchKeys = new Set(matches.map(richTextAtPanelMatchKey));
    setReferenceItemsByMatchKey((current) => {
      const nextEntries = Object.entries(current).filter(([matchKey]) =>
        activeMatchKeys.has(matchKey)
      );
      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
  }, [matches]);

  useEffect(() => {
    let cancelled = false;
    for (const match of matches) {
      const provider = providersById.get(match.providerId);
      if (!provider?.getItemReferenceItems) {
        continue;
      }
      const matchKey = richTextAtPanelMatchKey(match);
      if (referenceItemsByMatchKey[matchKey]) {
        continue;
      }
      setReferenceItemsByMatchKey((current) => ({
        ...current,
        [matchKey]: {
          items: [],
          loading: true,
          nextCursor: null
        }
      }));
      void Promise.resolve(
        provider.getItemReferenceItems(match.item, {
          keyword: queryKeyword,
          maxResults: referencePageSize,
          context: providerContext
        })
      )
        .then(normalizeReferenceItems)
        .catch(() => ({ items: [], nextCursor: null }))
        .then((result) => {
          if (cancelled) {
            return;
          }
          setReferenceItemsByMatchKey((current) => ({
            ...current,
            [matchKey]: {
              items: result.items,
              loading: false,
              nextCursor: result.nextCursor
            }
          }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    matches,
    providerContext,
    providersById,
    queryKeyword,
    referenceItemsByMatchKey,
    referencePageSize
  ]);

  // Keep the filter tabs visible even when the active tab is empty (parity with
  // the agent composer); an empty active tab shows the centered empty state.
  const hasVisibleMatches = groups.some((group) => group.items.length > 0);

  return (
    <div className="rich-text-at-panel grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div className="flex gap-1 border-b border-[var(--line-1)] px-1 py-1">
        {effectiveFilterTabs.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors",
              filter.id === activeFilterId
                ? "bg-transparency-block text-[var(--text-primary)]"
                : "hover:bg-transparency-block hover:text-[var(--text-primary)]"
            )}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              setActiveFilterId(filter.id);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 overflow-y-auto px-1 py-2">
        {hasVisibleMatches ? (
          <div className="grid gap-3">
            {groups.map((group) => (
            <RichTextAtPanelGroup
              activeIndex={activeIndex}
              activeMatch={activeMatch}
              group={group}
              key={group.id}
              matchIndexByKey={matchIndexByKey}
              referenceItemsByMatchKey={referenceItemsByMatchKey}
              referencePageSize={referencePageSize}
              renderItemIcon={renderItemIcon}
              text={text}
              onActiveIndexChange={onActiveIndexChange}
              onActiveMatchChange={onActiveMatchChange}
              onExpandGroup={() => {
                setExpandedCounts((current) => ({
                  ...current,
                  [group.id]:
                    (current[group.id] ??
                      providerGroups.find(
                        (candidate) => candidate.id === group.id
                      )?.pageSize ??
                      DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE) +
                    DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE
                }));
              }}
              onLoadMoreReferences={(match) => {
                void loadMoreReferenceItems({
                  match,
                  providersById,
                  providerContext,
                  queryKeyword,
                  referenceItemsByMatchKey,
                  referencePageSize,
                  setReferenceItemsByMatchKey
                });
              }}
              onSelect={onSelect}
            />
            ))}
          </div>
        ) : (
          <RichTextAtPanelEmptyState
            label={isLoading ? text.loadingLabel : text.noMatchesLabel}
          />
        )}
      </div>
    </div>
  );
}

function RichTextAtPanelGroup({
  activeIndex,
  activeMatch,
  group,
  matchIndexByKey,
  referenceItemsByMatchKey,
  referencePageSize,
  renderItemIcon,
  text,
  onActiveIndexChange,
  onActiveMatchChange,
  onExpandGroup,
  onLoadMoreReferences,
  onSelect
}: {
  activeIndex: number;
  activeMatch?: RichTextAtQueryMatch | null;
  group: RichTextAtSearchGroup;
  matchIndexByKey: ReadonlyMap<string, number>;
  referenceItemsByMatchKey: Record<string, ReferenceItemsState | undefined>;
  referencePageSize: number;
  renderItemIcon?: (match: RichTextAtQueryMatch) => ReactNode;
  text: RichTextAtPanelText;
  onActiveIndexChange?: (index: number) => void;
  onActiveMatchChange?: (match: RichTextAtQueryMatch | null) => void;
  onExpandGroup: () => void;
  onLoadMoreReferences: (match: RichTextAtQueryMatch) => void;
  onSelect: (match: RichTextAtQueryMatch) => void;
}): JSX.Element {
  return (
    <section className="grid gap-1">
      <div className="px-2 text-[12px] font-medium text-[var(--text-secondary)]">
        {group.label}
      </div>
      {group.items.length === 0 ? (
        <div className="px-2 py-1 text-[12px] text-[var(--text-tertiary)]">
          {group.emptyLabel}
        </div>
      ) : null}
      {group.items.map((match) => {
        const matchIndex =
          matchIndexByKey.get(richTextAtPanelMatchKey(match)) ?? -1;
        const matchKey = richTextAtPanelMatchKey(match);
        const referenceState = referenceItemsByMatchKey[matchKey];
        const matchActive = activeMatch
          ? richTextAtPanelMatchesEqual(match, activeMatch)
          : matchIndex === activeIndex;
        return (
          <div className="grid gap-1" key={matchKey}>
            <RichTextAtPanelMatchButton
              active={matchActive}
              match={match}
              renderItemIcon={renderItemIcon}
              onActiveIndexChange={
                matchIndex >= 0
                  ? () => {
                      onActiveIndexChange?.(matchIndex);
                      onActiveMatchChange?.(match);
                    }
                  : undefined
              }
              onSelect={onSelect}
            />
            {referenceState?.items.map((referenceItem) => {
              const referenceMatch = richTextAtPanelReferenceMatch(
                match,
                referenceItem
              );
              const referenceActive =
                !!activeMatch &&
                richTextAtPanelMatchesEqual(referenceMatch, activeMatch);
              return (
                <button
                  key={`${matchKey}:reference:${referenceItem.key}`}
                  aria-selected={referenceActive}
                  className={cn(
                    "ml-6 flex w-[calc(100%-1.5rem)] cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left text-[var(--text-primary)] outline-none transition-colors hover:bg-transparency-block",
                    referenceActive && "bg-transparency-block"
                  )}
                  type="button"
                  onMouseEnter={() => {
                    onActiveMatchChange?.(referenceMatch);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(referenceMatch);
                  }}
                >
                  <span className="flex min-w-0 max-w-full items-start gap-2">
                    {referenceItem.thumbnailUrl ? (
                      <img
                        alt=""
                        className="mt-0.5 h-4 w-4 shrink-0 rounded object-cover"
                        src={referenceItem.thumbnailUrl}
                      />
                    ) : null}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate text-[13px] leading-5 font-medium">
                        {referenceItem.label}
                      </span>
                      {referenceItem.subtitle ? (
                        <span className="truncate text-[11px] leading-4 text-[var(--text-secondary)]">
                          {referenceItem.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
            {referenceState?.nextCursor ? (
              <button
                className="ml-6 w-[calc(100%-1.5rem)] rounded-md px-2.5 py-1.5 text-center text-[12px] font-medium text-[var(--text-secondary)] hover:bg-transparency-block hover:text-[var(--text-primary)] disabled:opacity-60"
                disabled={referenceState.loading}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onLoadMoreReferences(match);
                }}
              >
                {text.showMoreReferencesLabel?.(referencePageSize) ??
                  text.showMoreLabel?.(referencePageSize) ??
                  `+${referencePageSize}`}
              </button>
            ) : null}
          </div>
        );
      })}
      {group.hasMore ? (
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:bg-transparency-block hover:text-[var(--text-primary)]"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={onExpandGroup}
        >
          {text.showMoreLabel?.(
            richTextAtGroupExpandCount(
              group,
              DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE
            )
          ) ?? `+${richTextAtGroupExpandCount(group)}`}
        </button>
      ) : null}
    </section>
  );
}

function RichTextAtPanelMatchButton({
  active,
  match,
  renderItemIcon,
  onActiveIndexChange,
  onSelect
}: {
  active: boolean;
  match: RichTextAtQueryMatch;
  renderItemIcon?: (match: RichTextAtQueryMatch) => ReactNode;
  onActiveIndexChange?: () => void;
  onSelect: (match: RichTextAtQueryMatch) => void;
}): JSX.Element {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors",
        active
          ? "bg-transparency-block text-[var(--text-primary)]"
          : "text-[var(--text-primary)] hover:bg-transparency-block"
      )}
      type="button"
      onMouseEnter={onActiveIndexChange}
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect(match);
      }}
    >
      <RichTextAtPanelRowContent
        match={match}
        renderItemIcon={renderItemIcon}
      />
    </button>
  );
}

function RichTextAtPanelRowContent({
  match,
  renderItemIcon
}: {
  match: RichTextAtQueryMatch;
  renderItemIcon?: (match: RichTextAtQueryMatch) => ReactNode;
}): JSX.Element {
  const icon = renderItemIcon?.(match);
  return (
    <span className="flex min-w-0 max-w-full items-start gap-2">
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[13px] leading-5 font-medium">
          {match.label}
        </span>
        {match.subtitle ? (
          <span className="truncate text-[11px] leading-4 text-[var(--text-secondary)]">
            {match.subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function RichTextAtPanelEmptyState({ label }: { label: string }): JSX.Element {
  return (
    <div
      className="flex min-h-[7rem] flex-1 items-center justify-center px-4 py-6 text-center"
      data-testid="rich-text-at-panel-empty-state"
    >
      <div className="flex max-w-[30ch] flex-col items-center justify-center gap-3 text-[12px] leading-5 text-[var(--text-tertiary)]">
        <RichTextAtKeyboardIcon className="h-6 w-6 text-[var(--text-tertiary)]" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function RichTextAtKeyboardIcon({
  className
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  );
}

function richTextAtPanelMatchKey(match: RichTextAtQueryMatch): string {
  return `${match.providerId}:${match.key}`;
}

function richTextAtPanelMatchesEqual(
  left: RichTextAtQueryMatch,
  right: RichTextAtQueryMatch
): boolean {
  return richTextAtPanelMatchKey(left) === richTextAtPanelMatchKey(right);
}

function richTextAtPanelReferenceMatch(
  match: RichTextAtQueryMatch,
  referenceItem: RichTextAtPanelReferenceItem
): RichTextAtQueryMatch {
  return {
    providerId: match.providerId,
    key: `${match.key}:reference:${referenceItem.key}`,
    label: referenceItem.label,
    subtitle: referenceItem.subtitle,
    item: referenceItem,
    insertResult: referenceItem.insertResult
  };
}

function normalizeReferenceItems(result: RichTextAtReferenceItemsResponse): {
  items: readonly RichTextAtPanelReferenceItem[];
  nextCursor: string | null;
} {
  const normalized: {
    items: readonly RichTextAtReferenceItem[];
    nextCursor: string | null;
  } = isReferenceItemsResult(result)
    ? {
        items: result.items,
        nextCursor: result.nextCursor?.trim() || null
      }
    : {
        items: result,
        nextCursor: null
      };
  return {
    items: normalized.items.map((item, index) => ({
      key: item.key?.trim() || `${item.label}:${index}`,
      label: item.label,
      subtitle: item.subtitle ?? undefined,
      thumbnailUrl: item.thumbnailUrl ?? null,
      insertResult: item.insertResult
    })),
    nextCursor: normalized.nextCursor
  };
}

function isReferenceItemsResult(
  result: RichTextAtReferenceItemsResponse
): result is RichTextAtReferenceItemsResult {
  return typeof result === "object" && result !== null && "items" in result;
}

async function loadMoreReferenceItems(input: {
  match: RichTextAtQueryMatch;
  providersById: ReadonlyMap<string, RichTextAtProvider>;
  providerContext: RichTextAtProviderContext;
  queryKeyword: string;
  referenceItemsByMatchKey: Record<string, ReferenceItemsState | undefined>;
  referencePageSize: number;
  setReferenceItemsByMatchKey: (
    updater: (
      current: Record<string, ReferenceItemsState | undefined>
    ) => Record<string, ReferenceItemsState | undefined>
  ) => void;
}): Promise<void> {
  const matchKey = richTextAtPanelMatchKey(input.match);
  const current = input.referenceItemsByMatchKey[matchKey];
  const cursor = current?.nextCursor;
  const provider = input.providersById.get(input.match.providerId);
  if (!cursor || !provider?.getItemReferenceItems) {
    return;
  }
  input.setReferenceItemsByMatchKey((state) => ({
    ...state,
    [matchKey]: {
      items: state[matchKey]?.items ?? [],
      loading: true,
      nextCursor: cursor
    }
  }));
  const result = await Promise.resolve(
    provider.getItemReferenceItems(input.match.item, {
      keyword: input.queryKeyword,
      maxResults: input.referencePageSize,
      cursor,
      context: input.providerContext
    })
  )
    .then(normalizeReferenceItems)
    .catch(() => ({ items: [], nextCursor: null }));
  input.setReferenceItemsByMatchKey((state) => {
    const previousItems = state[matchKey]?.items ?? [];
    const seen = new Set(previousItems.map((item) => item.key));
    const nextItems = [
      ...previousItems,
      ...result.items.filter((item) => {
        if (seen.has(item.key)) {
          return false;
        }
        seen.add(item.key);
        return true;
      })
    ];
    return {
      ...state,
      [matchKey]: {
        items: nextItems,
        loading: false,
        nextCursor: result.nextCursor
      }
    };
  });
}
