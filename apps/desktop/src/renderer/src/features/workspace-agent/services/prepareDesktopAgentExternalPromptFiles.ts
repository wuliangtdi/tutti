import type {
  AgentActivityRuntime,
  AgentActivityRuntimePromptContentBlock,
  AgentExternalPromptFilePreparationResult,
  AgentExternalPromptFilePreparer,
  AgentPreparedExternalPromptFile
} from "@tutti-os/agent-gui";
import type { DesktopPlatformApi } from "@preload/types";
import { uint8ArrayToBase64 } from "./desktopAgentRuntimeSubmitDiagnostics.ts";

type ExternalPromptFileContent = AgentActivityRuntimePromptContentBlock & {
  type: "file";
  data?: string;
};

type UploadedPromptFile = AgentActivityRuntimePromptContentBlock & {
  type: "file";
};

type ExternalPromptFileSource =
  | {
      content: ExternalPromptFileContent;
      sourceIndex: number;
      status: "ready";
    }
  | {
      result: AgentExternalPromptFilePreparationResult;
      status: "error";
    };

export function createDesktopAgentExternalPromptFilePreparer(input: {
  agentActivityRuntime: AgentActivityRuntime;
  folderUnsupportedError: string;
  preparationFailedError: string;
  platformApi: Pick<DesktopPlatformApi, "resolveDroppedEntries">;
  workspaceId: string;
}): AgentExternalPromptFilePreparer {
  return async (files) => {
    const entries = input.platformApi.resolveDroppedEntries([...files]);
    const sources = await Promise.all(
      files.map(
        async (file, sourceIndex): Promise<ExternalPromptFileSource> => {
          const entry = entries[sourceIndex];
          if (entry?.kind === "folder") {
            return {
              status: "error",
              result: failedExternalPromptFile(
                sourceIndex,
                input.folderUnsupportedError
              )
            };
          }
          try {
            const hostPath = entry?.path.trim() ?? "";
            return {
              status: "ready",
              sourceIndex,
              content: {
                type: "file",
                name: file.name || "file",
                ...(file.type ? { mimeType: file.type } : {}),
                ...(hostPath
                  ? { hostPath }
                  : {
                      data: uint8ArrayToBase64(
                        new Uint8Array(await file.arrayBuffer())
                      )
                    }),
                ...(Number.isFinite(file.size) ? { sizeBytes: file.size } : {}),
                kind: "file"
              }
            };
          } catch (error) {
            return {
              status: "error",
              result: failedExternalPromptFile(sourceIndex, error)
            };
          }
        }
      )
    );
    const readySources = sources.filter(
      (
        source
      ): source is Extract<ExternalPromptFileSource, { status: "ready" }> =>
        source.status === "ready"
    );
    if (readySources.length === 0) {
      return sources.map((source) =>
        source.status === "error"
          ? source.result
          : failedExternalPromptFile(
              source.sourceIndex,
              input.preparationFailedError
            )
      );
    }

    const uploadPromptContent = input.agentActivityRuntime.uploadPromptContent;
    if (!uploadPromptContent) {
      return sources.map((source) =>
        source.status === "error"
          ? source.result
          : failedExternalPromptFile(
              source.sourceIndex,
              input.preparationFailedError
            )
      );
    }

    let uploadedFiles: UploadedPromptFile[];
    try {
      const uploaded = await uploadPromptContent({
        content: readySources.map((source) => source.content),
        workspaceId: input.workspaceId
      });
      uploadedFiles = uploaded.content.filter(
        (block): block is UploadedPromptFile => block.type === "file"
      );
    } catch (error) {
      return sources.map((source) =>
        source.status === "error"
          ? source.result
          : failedExternalPromptFile(source.sourceIndex, error)
      );
    }

    let uploadedIndex = 0;
    return sources.map((source) => {
      if (source.status === "error") {
        return source.result;
      }
      const uploaded = uploadedFiles[uploadedIndex++];
      if (!uploaded) {
        return failedExternalPromptFile(
          source.sourceIndex,
          input.preparationFailedError
        );
      }
      const file = externalPromptFileFromUploaded(uploaded, source.content);
      if (!file.path && !file.url) {
        return failedExternalPromptFile(
          source.sourceIndex,
          input.preparationFailedError
        );
      }
      return {
        sourceIndex: source.sourceIndex,
        status: "prepared",
        file
      };
    });
  };
}

function failedExternalPromptFile(
  sourceIndex: number,
  error: unknown
): AgentExternalPromptFilePreparationResult {
  return {
    sourceIndex,
    status: "error",
    error: error instanceof Error ? error.message : String(error)
  };
}

function externalPromptFileFromUploaded(
  uploaded: UploadedPromptFile,
  source: ExternalPromptFileContent
): AgentPreparedExternalPromptFile {
  return {
    name: uploaded.name?.trim() || source.name?.trim() || "file",
    ...(uploaded.mimeType?.trim()
      ? { mimeType: uploaded.mimeType.trim() }
      : source.mimeType?.trim()
        ? { mimeType: source.mimeType.trim() }
        : {}),
    ...(uploaded.path?.trim() ? { path: uploaded.path.trim() } : {}),
    ...(uploaded.url?.trim() ? { url: uploaded.url.trim() } : {}),
    ...(uploaded.uri?.trim() ? { uri: uploaded.uri.trim() } : {}),
    ...(uploaded.assetId?.trim() ? { assetId: uploaded.assetId.trim() } : {}),
    ...(uploaded.uploadStatus?.trim()
      ? { uploadStatus: uploaded.uploadStatus.trim() }
      : {}),
    ...(typeof uploaded.sizeBytes === "number"
      ? { sizeBytes: uploaded.sizeBytes }
      : typeof source.sizeBytes === "number"
        ? { sizeBytes: source.sizeBytes }
        : {})
  };
}
