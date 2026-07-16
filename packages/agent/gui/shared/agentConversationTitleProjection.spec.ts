import { describe, expect, it } from "vitest";
import {
  resolveAgentGUIConversationBrowserFreeTitle,
  resolveAgentGUIConversationTitleDisplayPrompt,
  resolveAgentGUIConversationTitleLeadingMentionKind
} from "./agentConversationTitleProjection";

describe("resolveAgentGUIConversationTitleLeadingMentionKind", () => {
  it("maps the first session and task references to rail marker kinds", () => {
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(
        "[@Conversation](mention://agent-session/session-1?workspaceId=workspace-1) follow up"
      )
    ).toBe("session");
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(
        "[@Task](mention://workspace-issue/issue-1?workspaceId=workspace-1) inspect"
      )
    ).toBe("task");
  });

  it("maps app, file, and Agent references to rail marker kinds", () => {
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(
        "[@Weather](mention://workspace-app/weather?workspaceId=workspace-1) inspect"
      )
    ).toBe("app");
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(
        "[@notes.md](/workspace/notes.md) inspect"
      )
    ).toBe("file");
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(
        "[@Codex](mention://agent-target/local%3Acodex?workspaceId=workspace-1) inspect"
      )
    ).toBe("agent");
  });

  it("keeps browser elements in the rich header title without adding a rail marker", () => {
    const displayPrompt =
      "[@<a>](mention://browser-element/element-1?workspaceId=workspace-1&tag=a) inspect";
    expect(
      resolveAgentGUIConversationTitleLeadingMentionKind(displayPrompt)
    ).toBeNull();
    expect(
      resolveAgentGUIConversationTitleDisplayPrompt({
        firstUserDisplayPrompt: displayPrompt,
        title: "@<a> inspect"
      })
    ).toBe(displayPrompt);
  });
});

describe("resolveAgentGUIConversationBrowserFreeTitle", () => {
  const browserPrompt =
    "[@<div>](mention://browser-element/element-1?workspaceId=workspace-1&tag=div) 这里说的什么";

  it("removes browser elements and keeps only the conversation text", () => {
    expect(
      resolveAgentGUIConversationBrowserFreeTitle({
        firstUserDisplayPrompt: browserPrompt,
        title: "@<div> 这里说的什么"
      })
    ).toBe("这里说的什么");
  });

  it("returns an empty presentation title when the prompt contains only browser elements", () => {
    const prompt =
      "[@<div>](mention://browser-element/element-1?workspaceId=workspace-1&tag=div)";

    expect(
      resolveAgentGUIConversationBrowserFreeTitle({
        firstUserDisplayPrompt: prompt,
        title: "@<div>"
      })
    ).toBe("");
  });

  it("preserves an explicitly renamed title", () => {
    expect(
      resolveAgentGUIConversationBrowserFreeTitle({
        firstUserDisplayPrompt: browserPrompt,
        title: "Google 登录链接"
      })
    ).toBe("Google 登录链接");
  });

  it("does not change supported mention-derived titles", () => {
    const prompt =
      "[@Task](mention://workspace-issue/issue-1?workspaceId=workspace-1) 看看";

    expect(
      resolveAgentGUIConversationBrowserFreeTitle({
        firstUserDisplayPrompt: prompt,
        title: "@Task 看看"
      })
    ).toBe("@Task 看看");
  });
});
