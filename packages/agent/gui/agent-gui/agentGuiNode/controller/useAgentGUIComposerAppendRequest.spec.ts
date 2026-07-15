import { describe, expect, it } from "vitest";
import {
  appendAgentGUIComposerFiles,
  resolveAgentGUIComposerAppendRequest,
  type AgentGUIComposerAppendRequest
} from "./useAgentGUIComposerAppendRequest";
import { buildAgentComposerDraft } from "../model/agentComposerDraft";

const existingFile = {
  id: "existing",
  name: "existing.txt",
  path: "/tmp/existing.txt"
};
const browserElementFile = {
  id: "browser-element-1",
  mimeType: "application/json",
  name: "button · Example",
  path: "/tmp/browser-element.json",
  sizeBytes: 42
};

describe("appendAgentGUIComposerFiles", () => {
  it("preserves prompt and existing attachments while appending files", () => {
    const draft = buildAgentComposerDraft({
      files: [existingFile],
      prompt: "Fix this element"
    });

    expect(appendAgentGUIComposerFiles(draft, [browserElementFile])).toEqual([
      { type: "text", text: "Fix this element" },
      { type: "file", kind: "file", ...existingFile },
      { type: "file", kind: "file", ...browserElementFile }
    ]);
  });

  it("deduplicates files by attachment id", () => {
    const draft = buildAgentComposerDraft({
      files: [browserElementFile],
      prompt: ""
    });

    expect(appendAgentGUIComposerFiles(draft, [browserElementFile])).toEqual(
      draft
    );
  });
});

describe("resolveAgentGUIComposerAppendRequest", () => {
  it("resolves each request sequence once against the active draft scope", () => {
    const initialDraft = buildAgentComposerDraft({ prompt: "Keep me" });
    const request: AgentGUIComposerAppendRequest = {
      files: [browserElementFile],
      sequence: 7
    };

    const resolved = resolveAgentGUIComposerAppendRequest({
      activeConversationId: "session-1",
      draftByScopeKey: { "session:session-1": initialDraft },
      handledSequence: null,
      request
    });

    expect(resolved?.draftKey).toBe("session:session-1");
    expect(resolved?.nextDraft).toHaveLength(2);
    expect(
      resolveAgentGUIComposerAppendRequest({
        activeConversationId: "session-1",
        draftByScopeKey: { "session:session-1": resolved!.nextDraft },
        handledSequence: 7,
        request
      })
    ).toBeNull();
  });
});
