import type {
  RichTextAtInsertResult,
  RichTextAtProvider,
  RichTextAtProviderContext,
  RichTextAtQueryMatch
} from "../types/at.ts";

export type RichTextAtFilterId = string;
export type RichTextAtGroupId = string;

export interface RichTextAtFilterTab {
  id: RichTextAtFilterId;
  label: string;
}

export interface RichTextAtProviderGroup {
  id: RichTextAtGroupId;
  label: string;
  providerIds: readonly string[];
  filterId?: RichTextAtFilterId;
  emptyLabel?: string;
  pageSize?: number;
}

export interface RichTextAtPanelReferenceItem {
  key: string;
  label: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  insertResult: RichTextAtInsertResult;
}

export interface RichTextAtPanelMatch<
  TItem = unknown
> extends RichTextAtQueryMatch<TItem> {
  thumbnailUrl?: string | null;
  referenceItems?: readonly RichTextAtPanelReferenceItem[];
  referenceItemsLoading?: boolean;
  referenceNextCursor?: string | null;
}

export interface RichTextAtSearchGroup<TItem = unknown> {
  id: RichTextAtGroupId;
  label: string;
  items: readonly RichTextAtPanelMatch<TItem>[];
  totalCount: number;
  visibleCount: number;
  hasMore: boolean;
  emptyLabel?: string;
}

export type RichTextAtSearchState<TItem = unknown> =
  | {
      status: "idle";
      query: string;
      mode: "browse";
      filter: RichTextAtFilterId;
      categories: readonly RichTextAtFilterTab[];
      groups: readonly RichTextAtSearchGroup<TItem>[];
      error: null;
    }
  | {
      status: "loading" | "ready";
      query: string;
      mode: "results";
      filter: RichTextAtFilterId;
      categories: readonly RichTextAtFilterTab[];
      groups: readonly RichTextAtSearchGroup<TItem>[];
      error: null;
    }
  | {
      status: "error";
      query: string;
      mode: "results";
      filter: RichTextAtFilterId;
      categories: readonly RichTextAtFilterTab[];
      groups: readonly RichTextAtSearchGroup<TItem>[];
      error: string;
    };

export interface RichTextAtSearchInput {
  workspaceId?: string | null;
  currentUserId?: string | null;
  query: string;
  context?: RichTextAtProviderContext;
}

export interface RichTextAtSearchControllerOptions {
  richTextAtProviders?: readonly RichTextAtProvider[];
  providerGroups?: readonly RichTextAtProviderGroup[];
  filterTabs?: readonly RichTextAtFilterTab[];
  defaultFilterId?: RichTextAtFilterId;
  debounceMs?: number;
  pageSize?: number;
  target?: string;
}
