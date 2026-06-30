export interface AgentRichTextPromptImage {
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: string;
}

export function imageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null
): File[] {
  if (!dataTransfer) {
    return [];
  }
  const files: File[] = [];
  const items = (dataTransfer as { items?: DataTransferItemList | null }).items;
  if (!items) {
    return Array.from(dataTransfer.files ?? []).filter((file) =>
      supportedPromptImageMimeType(file.type)
    );
  }
  for (const item of Array.from(items)) {
    if (item.kind !== "file" || !supportedPromptImageMimeType(item.type)) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export function nonImageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null
): File[] {
  if (!dataTransfer) {
    return [];
  }
  const files: File[] = [];
  const items = (dataTransfer as { items?: DataTransferItemList | null }).items;
  if (!items) {
    return Array.from(dataTransfer.files ?? []).filter(
      (file) => !supportedPromptImageMimeType(file.type)
    );
  }
  for (const item of Array.from(items)) {
    if (item.kind !== "file" || supportedPromptImageMimeType(item.type)) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export function supportedPromptImageMimeType(
  value: string
): value is AgentRichTextPromptImage["mimeType"] {
  return (
    value === "image/png" || value === "image/jpeg" || value === "image/webp"
  );
}

export async function readAgentRichTextPromptImages(
  files: readonly File[]
): Promise<AgentRichTextPromptImage[]> {
  const images = await Promise.all(
    files.map(async (file) => {
      if (!supportedPromptImageMimeType(file.type)) {
        return null;
      }
      const data = await fileToBase64(file);
      return {
        name: file.name || "clipboard-image",
        mimeType: file.type,
        data
      };
    })
  );
  return images.filter((image): image is AgentRichTextPromptImage =>
    Boolean(image)
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? (result.split(",").pop() ?? "") : result);
    };
    reader.readAsDataURL(file);
  });
}
