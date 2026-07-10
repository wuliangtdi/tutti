import type {
  AgentActivityComposerOptions,
  AgentActivityComposerSettings
} from "./types.ts";

export interface ComposerOptionsCacheCoordinator {
  activeLoad(
    cacheKey: string,
    requestSignature: string
  ): Promise<AgentActivityComposerOptions> | null;
  cacheKey(provider: string, agentTargetId: string | null): string;
  finishActive(
    cacheKey: string,
    load: Promise<AgentActivityComposerOptions>
  ): void;
  invalidate(cacheKey: string): void;
  isLatest(cacheKey: string, loadVersion: number): boolean;
  markActive(
    cacheKey: string,
    requestSignature: string,
    load: Promise<AgentActivityComposerOptions>
  ): void;
  markSettled(cacheKey: string, requestSignature: string): void;
  nextLoadVersion(cacheKey: string): number;
  requestSignature(input: {
    cwd?: string | null;
    settings?: AgentActivityComposerSettings | null;
  }): string;
  settledCacheKeys(): IterableIterator<string>;
  settledMatches(cacheKey: string, requestSignature: string): boolean;
}

export function createComposerOptionsCacheCoordinator(): ComposerOptionsCacheCoordinator {
  const activeLoads = new Map<string, Promise<AgentActivityComposerOptions>>();
  const activeSignatures = new Map<string, string>();
  const loadVersions = new Map<string, number>();
  const settledSignatures = new Map<string, string>();
  return {
    activeLoad: (cacheKey, signature) =>
      activeSignatures.get(cacheKey) === signature
        ? (activeLoads.get(cacheKey) ?? null)
        : null,
    cacheKey: (provider, agentTargetId) =>
      agentTargetId ? `target:${agentTargetId}` : `provider:${provider}`,
    finishActive: (cacheKey, load) => {
      if (activeLoads.get(cacheKey) === load) {
        activeLoads.delete(cacheKey);
        activeSignatures.delete(cacheKey);
      }
    },
    invalidate: (cacheKey) => settledSignatures.delete(cacheKey),
    isLatest: (cacheKey, version) => loadVersions.get(cacheKey) === version,
    markActive: (cacheKey, signature, load) => {
      activeLoads.set(cacheKey, load);
      activeSignatures.set(cacheKey, signature);
    },
    markSettled: (cacheKey, signature) =>
      settledSignatures.set(cacheKey, signature),
    nextLoadVersion: (cacheKey) => {
      const version = (loadVersions.get(cacheKey) ?? 0) + 1;
      loadVersions.set(cacheKey, version);
      return version;
    },
    requestSignature: composerOptionsRequestSignature,
    settledCacheKeys: () => settledSignatures.keys(),
    settledMatches: (cacheKey, signature) =>
      settledSignatures.get(cacheKey) === signature
  };
}

function composerOptionsRequestSignature(input: {
  cwd?: string | null;
  settings?: AgentActivityComposerSettings | null;
}): string {
  const settings = input.settings;
  const normalizedText = (value: string | null | undefined): string | null =>
    value?.trim() || null;
  return JSON.stringify({
    cwd: input.cwd?.trim() ?? "",
    settings: {
      model: normalizedText(settings?.model),
      reasoningEffort: normalizedText(settings?.reasoningEffort),
      speed: normalizedText(settings?.speed),
      planMode:
        typeof settings?.planMode === "boolean" ? settings.planMode : null,
      permissionModeId: normalizedText(settings?.permissionModeId)
    }
  });
}
