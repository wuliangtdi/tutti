import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  InspectIcon,
  LoadingIcon,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn
} from "@tutti-os/ui-system";
import type { AgentComposerDraftFile } from "@tutti-os/agent-gui";
import type { DesktopHostFilesApi } from "@preload/types";
import type { BrowserNodeWebviewTag } from "@tutti-os/browser-node/react";
import {
  browserElementSnapshotAttachmentName,
  normalizeBrowserElementSelectionResult,
  serializeBrowserElementSnapshot
} from "./browserElementSnapshot";
import {
  browserElementSelectorScript,
  cancelBrowserElementSelectorScript
} from "./browserElementSelectorScript";
import {
  cancelBrowserElementWebviewSelection,
  executeBrowserElementWebviewScript
} from "./browserElementWebview";

export interface BrowserElementContextCopy {
  cancel: string;
  failed: string;
  select: string;
}

export function BrowserElementContextAction({
  copy,
  hostFilesApi,
  onAppendFile,
  onError,
  surfaceId,
  workspaceId
}: {
  copy: BrowserElementContextCopy;
  hostFilesApi: Pick<DesktopHostFilesApi, "archiveAgentPromptFile">;
  onAppendFile: (file: AgentComposerDraftFile) => void;
  onError: (message: string) => void;
  surfaceId: string;
  workspaceId: string;
}): ReactNode {
  const [state, setState] = useState<"idle" | "selecting" | "archiving">(
    "idle"
  );
  const mountedRef = useRef(true);
  const selectingWebviewRef = useRef<BrowserNodeWebviewTag | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const webview = selectingWebviewRef.current;
      selectingWebviewRef.current = null;
      void cancelBrowserElementWebviewSelection(
        webview,
        cancelBrowserElementSelectorScript
      );
    };
  }, []);

  const cancelSelection = useCallback(() => {
    void cancelBrowserElementWebviewSelection(
      selectingWebviewRef.current,
      cancelBrowserElementSelectorScript
    );
  }, []);

  const startSelection = useCallback(async () => {
    if (state === "selecting") {
      cancelSelection();
      return;
    }
    if (state !== "idle") return;
    const webview = findActiveBrowserWebview(surfaceId);
    if (!webview?.executeJavaScript) {
      onError(copy.failed);
      return;
    }
    selectingWebviewRef.current = webview;
    setState("selecting");
    try {
      const rawResult = await executeBrowserElementWebviewScript(
        webview,
        browserElementSelectorScript,
        true
      );
      const result = normalizeBrowserElementSelectionResult(rawResult);
      if (!result || result.status === "cancelled") return;
      if (mountedRef.current) setState("archiving");
      const content = serializeBrowserElementSnapshot(result.snapshot);
      const archived = await hostFilesApi.archiveAgentPromptFile({
        dataBase64: utf8ToBase64(content),
        displayName: browserElementSnapshotAttachmentName(result.snapshot),
        mimeType: "application/json",
        workspaceID: workspaceId
      });
      onAppendFile({
        id: createBrowserElementAttachmentId(),
        mimeType: "application/json",
        name: archived.name,
        path: archived.path,
        sizeBytes: archived.sizeBytes
      });
    } catch {
      onError(copy.failed);
    } finally {
      selectingWebviewRef.current = null;
      if (mountedRef.current) setState("idle");
    }
  }, [
    cancelSelection,
    copy.failed,
    hostFilesApi,
    onAppendFile,
    onError,
    state,
    surfaceId,
    workspaceId
  ]);

  const label = state === "selecting" ? copy.cancel : copy.select;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={state === "selecting"}
          className={cn(
            "nodrag shrink-0 rounded-md",
            state === "selecting" &&
              "bg-[var(--transparency-block)] text-[var(--text-primary)]"
          )}
          disabled={state === "archiving"}
          size="icon-sm"
          type="button"
          variant="chrome"
          onClick={() => void startSelection()}
        >
          {state === "archiving" ? (
            <LoadingIcon className="size-[15px] animate-spin" />
          ) : (
            <InspectIcon className="size-[15px]" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function findActiveBrowserWebview(
  surfaceId: string
): BrowserNodeWebviewTag | null {
  const root = [
    ...document.querySelectorAll<HTMLElement>(
      "[data-standalone-agent-browser-surface-id]"
    )
  ].find(
    (element) => element.dataset.standaloneAgentBrowserSurfaceId === surfaceId
  );
  return (
    root?.querySelector<BrowserNodeWebviewTag>(
      '[data-browser-node-tab-content-active="true"] webview[data-browser-node-webview="true"]'
    ) ?? null
  );
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function createBrowserElementAttachmentId(): string {
  return `browser-element:${
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;
}
