import type { RichTextAtProvider, RichTextAtQueryMatch } from "../types/at.ts";
import {
  DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE,
  RICH_TEXT_AT_ALL_FILTER_ID,
  buildDefaultRichTextAtProviderGroups,
  buildRichTextAtFilterTabs,
  groupRichTextAtMatches,
  normalizeAtPanelQuery
} from "./searchHelpers.ts";
import type {
  RichTextAtFilterId,
  RichTextAtSearchControllerOptions,
  RichTextAtSearchInput,
  RichTextAtSearchState
} from "./types.ts";

type Listener = (state: RichTextAtSearchState) => void;

const DEFAULT_DEBOUNCE_MS = 120;

export class RichTextAtSearchController {
  private readonly providers: readonly RichTextAtProvider[];
  private readonly debounceMs: number;
  private readonly pageSize: number;
  private readonly target: string;
  private readonly listeners = new Set<Listener>();
  private readonly expandedCounts: Record<string, number | undefined> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private disposed = false;
  private currentFilter: RichTextAtFilterId;
  private currentInput: RichTextAtSearchInput = { query: "" };
  private currentMatches: readonly RichTextAtQueryMatch[] = [];
  private readonly providerGroups;
  private readonly filterTabs;
  private state: RichTextAtSearchState;

  constructor(options: RichTextAtSearchControllerOptions = {}) {
    this.providers = options.richTextAtProviders ?? [];
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.pageSize = options.pageSize ?? DEFAULT_RICH_TEXT_AT_PANEL_PAGE_SIZE;
    this.target = options.target ?? "rich-text";
    this.providerGroups =
      options.providerGroups ??
      buildDefaultRichTextAtProviderGroups({ providers: this.providers });
    this.filterTabs =
      options.filterTabs ??
      buildRichTextAtFilterTabs({
        allLabel: RICH_TEXT_AT_ALL_FILTER_ID,
        groups: this.providerGroups
      });
    this.currentFilter =
      options.defaultFilterId ??
      this.filterTabs[0]?.id ??
      RICH_TEXT_AT_ALL_FILTER_ID;
    this.state = {
      status: "idle",
      query: "",
      mode: "browse",
      filter: this.currentFilter,
      categories: this.filterTabs,
      groups: [],
      error: null
    };
  }

  getState(): RichTextAtSearchState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  updateQuery(input: RichTextAtSearchInput): void {
    if (this.disposed) {
      return;
    }
    this.currentInput = {
      ...input,
      query: normalizeAtPanelQuery(input.query)
    };
    this.clearTimer();
    const requestId = ++this.requestId;
    this.resetExpandedCounts();

    if (!this.currentInput.query) {
      this.setState({
        status: "idle",
        query: "",
        mode: "browse",
        filter: this.currentFilter,
        categories: this.filterTabs,
        groups: [],
        error: null
      });
      return;
    }

    this.setState({
      status: "loading",
      query: this.currentInput.query,
      mode: "results",
      filter: this.currentFilter,
      categories: this.filterTabs,
      groups: this.groupMatches([]),
      error: null
    });

    this.timer = setTimeout(() => {
      void this.runSearch(requestId, this.currentInput);
    }, this.debounceMs);
  }

  setFilter(filter: RichTextAtFilterId): void {
    if (this.disposed) {
      return;
    }
    this.currentFilter = filter;
    this.resetExpandedCounts();
    this.setState({
      ...this.state,
      filter,
      groups: this.groupMatches(this.currentMatches)
    });
  }

  expandGroup(groupId: string): void {
    const current =
      this.expandedCounts[groupId] ??
      this.providerGroups.find((group) => group.id === groupId)?.pageSize ??
      this.pageSize;
    this.expandedCounts[groupId] = current + this.pageSize;
    this.setState({
      ...this.state,
      groups: this.groupMatches(this.currentMatches)
    });
  }

  close(): void {
    this.clearTimer();
    this.requestId += 1;
    this.resetExpandedCounts();
    this.currentInput = { query: "" };
    this.currentMatches = [];
    this.currentFilter = this.filterTabs[0]?.id ?? RICH_TEXT_AT_ALL_FILTER_ID;
    this.setState({
      status: "idle",
      query: "",
      mode: "browse",
      filter: this.currentFilter,
      categories: this.filterTabs,
      groups: [],
      error: null
    });
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
    this.requestId += 1;
  }

  private async runSearch(
    requestId: number,
    input: RichTextAtSearchInput
  ): Promise<void> {
    try {
      const matches = await queryProviders({
        providers: this.providers,
        input,
        pageSize: this.pageSize,
        target: this.target
      });
      if (!this.canApply(requestId, input.query)) {
        return;
      }
      this.currentMatches = matches;
      this.setState({
        status: "ready",
        query: input.query,
        mode: "results",
        filter: this.currentFilter,
        categories: this.filterTabs,
        groups: this.groupMatches(matches),
        error: null
      });
    } catch (error) {
      if (!this.canApply(requestId, input.query)) {
        return;
      }
      this.setState({
        status: "error",
        query: input.query,
        mode: "results",
        filter: this.currentFilter,
        categories: this.filterTabs,
        groups: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private groupMatches(
    matches: readonly RichTextAtQueryMatch[]
  ): RichTextAtSearchState["groups"] {
    return groupRichTextAtMatches({
      expandedCounts: this.expandedCounts,
      filterId: this.currentFilter,
      groups: this.providerGroups,
      matches,
      pageSize: this.pageSize
    });
  }

  private canApply(requestId: number, query: string): boolean {
    return (
      !this.disposed &&
      requestId === this.requestId &&
      query === this.currentInput.query
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private resetExpandedCounts(): void {
    for (const group of this.providerGroups) {
      this.expandedCounts[group.id] = group.pageSize ?? this.pageSize;
    }
  }

  private setState(state: RichTextAtSearchState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

async function queryProviders(input: {
  providers: readonly RichTextAtProvider[];
  input: RichTextAtSearchInput;
  pageSize: number;
  target: string;
}): Promise<RichTextAtQueryMatch[]> {
  const context = {
    ...(input.input.context ?? {}),
    metadata: {
      ...(input.input.context?.metadata ?? {}),
      currentUserId: input.input.currentUserId ?? undefined,
      target: input.target,
      workspaceId: input.input.workspaceId ?? undefined
    }
  };
  const results = await Promise.all(
    input.providers.map(async (provider) => {
      const items = await provider.query({
        keyword: input.input.query,
        context,
        maxResults: input.pageSize
      });
      return items.map((item) => ({
        providerId: provider.id,
        key: provider.getItemKey(item),
        label: provider.getItemLabel(item),
        subtitle: provider.getItemSubtitle?.(item) ?? undefined,
        keywords: provider.getItemKeywords?.(item),
        item,
        insertResult: provider.toInsertResult(item)
      }));
    })
  );
  return results.flat();
}
