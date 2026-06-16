import { describe, expect, it } from "vitest";
import {
  agentComposerDraftHasContent,
  agentComposerDraftToPromptContent,
  agentPromptContentDisplayText,
  agentPromptContentToComposerDraft,
  emptyAgentComposerDraft
} from "./agentComposerDraft";

describe("agentComposerDraft", () => {
  it("normalizes empty drafts", () => {
    const draft = emptyAgentComposerDraft();

    expect(agentComposerDraftHasContent(draft)).toBe(false);
    expect(
      agentComposerDraftToPromptContent({
        draft,
        provider: "codex",
        skills: []
      })
    ).toEqual([]);
  });

  it("converts text-only drafts into prompt content", () => {
    expect(
      agentComposerDraftToPromptContent({
        draft: { prompt: "  run tests  ", images: [] },
        provider: "codex",
        skills: []
      })
    ).toEqual([{ type: "text", text: "run tests" }]);
  });

  it("converts image-only drafts into prompt content", () => {
    expect(
      agentComposerDraftToPromptContent({
        draft: {
          prompt: "",
          images: [
            {
              id: "image-1",
              name: "screen.png",
              mimeType: "image/png",
              data: "aW1hZ2U=",
              previewUrl: "data:image/png;base64,aW1hZ2U="
            }
          ]
        },
        provider: "codex",
        skills: []
      })
    ).toEqual([
      {
        type: "image",
        mimeType: "image/png",
        data: "aW1hZ2U=",
        name: "screen.png"
      }
    ]);
  });

  it("restores text and image content into stable draft ids", () => {
    const draft = agentPromptContentToComposerDraft(
      [
        { type: "text", text: "describe this" },
        {
          type: "image",
          mimeType: "image/png",
          data: "aW1hZ2U=",
          name: "panel.png"
        }
      ],
      "restore-queued-1"
    );

    expect(draft).toEqual({
      prompt: "describe this",
      images: [
        {
          id: "restore-queued-1:image:0",
          name: "panel.png",
          mimeType: "image/png",
          data: "aW1hZ2U=",
          previewUrl: "data:image/png;base64,aW1hZ2U="
        }
      ]
    });
  });

  it("derives display text from text content only", () => {
    expect(
      agentPromptContentDisplayText([
        { type: "text", text: "first" },
        { type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
        { type: "text", text: "second" }
      ])
    ).toBe("first\nsecond");
  });
});
