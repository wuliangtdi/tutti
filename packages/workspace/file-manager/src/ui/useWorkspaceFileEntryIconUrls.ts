import { useEffect, useMemo, useState } from "react";
import type { WorkspaceFileEntry } from "../services/workspaceFileManagerTypes.ts";
import {
  resolveWorkspaceFileEntryIconCacheKey,
  shouldResolveWorkspaceFileEntryIcon
} from "./workspaceFileEntryIconPolicy.ts";

function buildIconTargetSignature(
  entries: readonly WorkspaceFileEntry[]
): string {
  return entries
    .filter(shouldResolveWorkspaceFileEntryIcon)
    .map((entry) => resolveWorkspaceFileEntryIconCacheKey(entry))
    .join("\0");
}

export function useWorkspaceFileEntryIconUrls(input: {
  entries: readonly WorkspaceFileEntry[];
  resolveEntryIconUrl?: (
    entry: WorkspaceFileEntry
  ) => Promise<string | null | undefined>;
}): ReadonlyMap<string, string | null> {
  const { entries, resolveEntryIconUrl } = input;
  const [iconUrlByCacheKey, setIconUrlByCacheKey] = useState<
    ReadonlyMap<string, string | null>
  >(() => new Map());
  const iconTargetSignature = useMemo(
    () => buildIconTargetSignature(entries),
    [entries]
  );

  useEffect(() => {
    if (!resolveEntryIconUrl) {
      setIconUrlByCacheKey((current) =>
        current.size === 0 ? current : new Map()
      );
      return;
    }

    const targets = entries.filter(shouldResolveWorkspaceFileEntryIcon);
    if (targets.length === 0) {
      setIconUrlByCacheKey((current) =>
        current.size === 0 ? current : new Map()
      );
      return;
    }

    let cancelled = false;

    void Promise.all(
      targets.map(async (entry) => {
        const cacheKey = resolveWorkspaceFileEntryIconCacheKey(entry);
        try {
          const iconUrl = await resolveEntryIconUrl(entry);
          return [cacheKey, iconUrl?.trim() || null] as const;
        } catch {
          return [cacheKey, null] as const;
        }
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }

      setIconUrlByCacheKey((current) => {
        const nextCacheKeys = new Set(results.map(([cacheKey]) => cacheKey));
        let changed = false;
        const next = new Map<string, string | null>();

        for (const [cacheKey, iconUrl] of results) {
          next.set(cacheKey, iconUrl);
          if (current.get(cacheKey) !== iconUrl) {
            changed = true;
          }
        }

        if (current.size !== next.size) {
          changed = true;
        } else if (!changed) {
          for (const cacheKey of current.keys()) {
            if (!nextCacheKeys.has(cacheKey)) {
              changed = true;
              break;
            }
          }
        }

        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [entries, iconTargetSignature, resolveEntryIconUrl]);

  return iconUrlByCacheKey;
}
