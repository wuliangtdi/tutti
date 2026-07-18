import type { AgentPromptContentBlock } from "../../../shared/contracts/dto";
import {
  agentComposerFileMentionReferences,
  createAgentComposerFileMentionMarkdown,
  formatAgentFileMentionMarkdown
} from "../agentRichText/agentMentionMarkdown";
import {
  AGENT_PASTED_TEXT_BLOCK_KIND,
  type AgentComposerDraftFile
} from "./agentGuiNodeTypes";

export interface AgentPreparedExternalPromptFile {
  assetId?: string;
  mimeType?: string;
  name: string;
  path?: string;
  sizeBytes?: number;
  uploadStatus?: string;
  uri?: string;
  url?: string;
}

export type AgentExternalPromptFilePreparationResult =
  | {
      sourceIndex: number;
      status: "prepared";
      file: AgentPreparedExternalPromptFile;
    }
  | {
      sourceIndex: number;
      status: "error";
      error: string;
      errorCode?: string;
      retryable?: boolean;
    };

export type AgentExternalPromptFilePreparer = (
  files: readonly File[]
) => Promise<readonly AgentExternalPromptFilePreparationResult[]>;

export interface AgentExternalPromptFilePreparation {
  pendingFiles: AgentComposerDraftFile[];
  complete(
    prepareExternalPromptFiles: AgentExternalPromptFilePreparer
  ): Promise<AgentComposerDraftFile[]>;
}

export function remainingAgentComposerPromptAssetSlots(input: {
  files: number;
  images: number;
  largeTexts: number;
  limit?: number | null;
}): number {
  if (
    typeof input.limit !== "number" ||
    !Number.isFinite(input.limit) ||
    input.limit < 0
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(
    0,
    Math.floor(input.limit) - input.files - input.images - input.largeTexts
  );
}

export function createAgentExternalPromptFilePreparation(
  files: readonly File[]
): AgentExternalPromptFilePreparation {
  const pendingFiles = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name || "file",
    ...(file.type ? { mimeType: file.type } : {}),
    ...(Number.isFinite(file.size) ? { sizeBytes: file.size } : {}),
    uploading: true
  }));

  return {
    pendingFiles,
    async complete(prepareExternalPromptFiles) {
      let results: readonly AgentExternalPromptFilePreparationResult[];
      try {
        results = await prepareExternalPromptFiles(files);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return pendingFiles.map((file) => failedDraftFile(file, message));
      }
      const resultByIndex = new Map(
        results.map((result) => [result.sourceIndex, result])
      );
      return pendingFiles.map((pendingFile, sourceIndex) => {
        const result = resultByIndex.get(sourceIndex);
        if (!result) {
          return failedDraftFile(
            pendingFile,
            "Prompt file preparation returned no result."
          );
        }
        if (result.status === "error") {
          return failedDraftFile(pendingFile, result.error, {
            errorCode: result.errorCode,
            retryable: result.retryable
          });
        }
        const prepared = normalizePreparedFile(result.file);
        if (!hasPreparedFileLocator(prepared)) {
          return failedDraftFile(
            pendingFile,
            "Prepared prompt file requires a locator."
          );
        }
        return {
          id: pendingFile.id,
          name: prepared.name || pendingFile.name,
          ...(prepared.mimeType
            ? { mimeType: prepared.mimeType }
            : pendingFile.mimeType
              ? { mimeType: pendingFile.mimeType }
              : {}),
          ...(prepared.path ? { path: prepared.path } : {}),
          ...(prepared.url ? { url: prepared.url } : {}),
          ...(prepared.uri ? { uri: prepared.uri } : {}),
          ...(prepared.assetId ? { assetId: prepared.assetId } : {}),
          ...(prepared.uploadStatus
            ? { uploadStatus: prepared.uploadStatus }
            : {}),
          ...(typeof prepared.sizeBytes === "number"
            ? { sizeBytes: prepared.sizeBytes }
            : typeof pendingFile.sizeBytes === "number"
              ? { sizeBytes: pendingFile.sizeBytes }
              : {}),
          uploading: false
        };
      });
    }
  };
}

export function agentPreparedPromptFileToDraftFile(
  file: AgentPromptContentBlock & { type: "file" },
  idPrefix: string,
  index: number
): AgentComposerDraftFile {
  return {
    id: `${idPrefix}:file:${index}`,
    name: file.name?.trim() || `file-${index + 1}`,
    mimeType: file.mimeType,
    path: file.path,
    hostPath: file.hostPath,
    url: file.url,
    uri: file.uri,
    assetId: file.assetId,
    uploadStatus: file.uploadStatus,
    sizeBytes: file.sizeBytes
  };
}

export function agentPromptContentToComposerPrompt(
  content: readonly AgentPromptContentBlock[],
  files: readonly AgentComposerDraftFile[]
): string {
  let fileIndex = 0;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text?.trim() ?? "");
      continue;
    }
    if (block.type !== "file" || block.kind === AGENT_PASTED_TEXT_BLOCK_KIND) {
      continue;
    }
    const file = files[fileIndex];
    fileIndex += 1;
    if (!file) continue;
    parts.push(
      createAgentComposerFileMentionMarkdown({
        id: file.id,
        name: file.name,
        status: "ready"
      })
    );
  }
  return parts.join("");
}

export function agentPromptFileBlocks(
  content: readonly AgentPromptContentBlock[]
): Array<AgentPromptContentBlock & { type: "file" }> {
  return content.filter(
    (block): block is AgentPromptContentBlock & { type: "file" } =>
      block.type === "file" &&
      block.kind !== AGENT_PASTED_TEXT_BLOCK_KIND &&
      (typeof block.path === "string" ||
        typeof block.hostPath === "string" ||
        typeof block.url === "string" ||
        typeof block.uri === "string" ||
        typeof block.assetId === "string")
  );
}

export function agentPromptPastedTextBlocks(
  content: readonly AgentPromptContentBlock[]
): Array<AgentPromptContentBlock & { type: "file" }> {
  return content.filter(
    (block): block is AgentPromptContentBlock & { type: "file" } =>
      block.type === "file" &&
      block.kind === AGENT_PASTED_TEXT_BLOCK_KIND &&
      typeof block.path === "string"
  );
}

export function materializeAgentComposerFileMentions(
  prompt: string,
  files: readonly AgentComposerDraftFile[]
): string {
  const references = agentComposerFileMentionReferences(prompt);
  if (references.length === 0) return prompt;
  const fileById = new Map(files.map((file) => [file.id, file]));
  let result = "";
  let cursor = 0;
  for (const reference of references) {
    result += prompt.slice(cursor, reference.start);
    const file = fileById.get(reference.id);
    if (file && !file.uploading && !file.uploadError) {
      const locator = file.path?.trim() || file.url?.trim() || "";
      if (locator) {
        result += formatAgentFileMentionMarkdown(file.name, locator);
      }
    }
    cursor = reference.end;
  }
  return result + prompt.slice(cursor);
}

function normalizePreparedFile(
  file: AgentPreparedExternalPromptFile
): AgentPreparedExternalPromptFile {
  return {
    name: file.name.trim(),
    ...(file.mimeType?.trim() ? { mimeType: file.mimeType.trim() } : {}),
    ...(file.path?.trim() ? { path: file.path.trim() } : {}),
    ...(file.url?.trim() ? { url: file.url.trim() } : {}),
    ...(file.uri?.trim() ? { uri: file.uri.trim() } : {}),
    ...(file.assetId?.trim() ? { assetId: file.assetId.trim() } : {}),
    ...(file.uploadStatus?.trim()
      ? { uploadStatus: file.uploadStatus.trim() }
      : {}),
    ...(typeof file.sizeBytes === "number" && Number.isFinite(file.sizeBytes)
      ? { sizeBytes: file.sizeBytes }
      : {})
  };
}

function hasPreparedFileLocator(
  file: AgentPreparedExternalPromptFile
): boolean {
  return Boolean(file.path || file.url);
}

function failedDraftFile(
  file: AgentComposerDraftFile,
  uploadError: string,
  options: { errorCode?: string; retryable?: boolean } = {}
): AgentComposerDraftFile {
  return {
    ...file,
    uploading: false,
    uploadError: uploadError.trim() || "Prompt file preparation failed.",
    ...(options.errorCode?.trim()
      ? { uploadErrorCode: options.errorCode.trim() }
      : {}),
    ...(typeof options.retryable === "boolean"
      ? { uploadRetryable: options.retryable }
      : {})
  };
}
