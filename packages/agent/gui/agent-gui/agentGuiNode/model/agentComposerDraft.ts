import type { AgentPromptContentBlock } from "../../../shared/contracts/dto";
import type {
  AgentComposerDraft,
  AgentComposerDraftImage,
  AgentGUIProviderSkillOption
} from "./agentGuiNodeTypes";
import { promptForProviderSkills } from "./agentSkillOptions";

export const MAX_AGENT_COMPOSER_DRAFT_IMAGES = 8;

type AgentPromptImageContentBlock = AgentPromptContentBlock & {
  type: "image";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: string;
};

export function emptyAgentComposerDraft(): AgentComposerDraft {
  return { prompt: "", images: [] };
}

export function agentComposerDraftHasContent(
  draft: AgentComposerDraft
): boolean {
  return draft.prompt.trim() !== "" || draft.images.length > 0;
}

export function normalizeAgentPromptContentBlocks(
  content: readonly AgentPromptContentBlock[]
): AgentPromptContentBlock[] {
  const result: AgentPromptContentBlock[] = [];
  for (const block of content) {
    if (block.type === "text") {
      const text = block.text?.trim() ?? "";
      if (text) {
        result.push({ type: "text", text });
      }
      continue;
    }
    if (block.type === "image") {
      const mimeType = block.mimeType?.trim();
      const data = block.data?.trim();
      if (
        !data ||
        (mimeType !== "image/png" &&
          mimeType !== "image/jpeg" &&
          mimeType !== "image/webp")
      ) {
        continue;
      }
      result.push({
        type: "image",
        mimeType,
        data,
        ...(block.name?.trim() ? { name: block.name.trim() } : {})
      });
    }
  }
  return result;
}

export function agentPromptContentDisplayText(
  content: readonly AgentPromptContentBlock[]
): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function agentPromptContentHasImage(
  content: readonly AgentPromptContentBlock[]
): boolean {
  return content.some((block) => block.type === "image");
}

export function agentPromptContentImageBlocks(
  content: readonly AgentPromptContentBlock[]
): AgentPromptImageContentBlock[] {
  return normalizeAgentPromptContentBlocks(content).filter(
    (block): block is AgentPromptImageContentBlock =>
      block.type === "image" &&
      typeof block.data === "string" &&
      typeof block.mimeType === "string"
  );
}

export function agentPromptContentToComposerDraft(
  content: readonly AgentPromptContentBlock[],
  idPrefix: string
): AgentComposerDraft {
  const normalizedContent = normalizeAgentPromptContentBlocks(content);
  return {
    prompt: agentPromptContentDisplayText(normalizedContent),
    images: agentPromptContentImageBlocks(normalizedContent)
      .slice(0, MAX_AGENT_COMPOSER_DRAFT_IMAGES)
      .map((image, index) =>
        agentPromptImageBlockToDraftImage(image, idPrefix, index)
      )
  };
}

export function agentComposerDraftToPromptContent(input: {
  draft: AgentComposerDraft;
  provider: string;
  skills: readonly AgentGUIProviderSkillOption[];
}): AgentPromptContentBlock[] {
  return normalizeAgentPromptContentBlocks([
    ...textPromptContent(
      promptForProviderSkills({
        prompt: input.draft.prompt,
        provider: input.provider,
        skills: input.skills
      })
    ),
    ...input.draft.images
      .slice(0, MAX_AGENT_COMPOSER_DRAFT_IMAGES)
      .map((image) => ({
        type: "image" as const,
        mimeType: image.mimeType,
        data: image.data,
        name: image.name
      }))
  ]);
}

export function textPromptContent(prompt: string): AgentPromptContentBlock[] {
  const text = prompt.trim();
  return text ? [{ type: "text", text }] : [];
}

function agentPromptImageBlockToDraftImage(
  image: AgentPromptImageContentBlock,
  idPrefix: string,
  index: number
): AgentComposerDraftImage {
  return {
    id: `${idPrefix}:image:${index}`,
    name: image.name?.trim() || `image-${index + 1}`,
    mimeType: image.mimeType,
    data: image.data,
    previewUrl: `data:${image.mimeType};base64,${image.data}`
  };
}
