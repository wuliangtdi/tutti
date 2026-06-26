import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentTurnSummaryRow } from "./AgentTurnSummaryRow";

vi.mock("../../../i18n/index", () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key
}));

describe("AgentTurnSummaryRow", () => {
  it("renders a change card with expandable file diff rows and dispatches workspace actions", async () => {
    const onLinkAction = vi.fn();
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:1",
          turnId: "turn-1",
          fileCount: 2,
          modifiedCount: 2,
          createdCount: 0,
          occurredAtUnixMs: 10,
          files: [
            {
              label: "src/app.ts",
              path: "src/app.ts",
              fileName: "app.ts",
              directory: "src",
              changeType: "modified",
              toolName: "Edit",
              messageId: "call:1",
              unifiedDiff:
                "diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-const ready = false\n+const ready = true\n",
              occurredAtUnixMs: 10
            },
            {
              label: "src/feature.ts",
              path: "src/feature.ts",
              fileName: "feature.ts",
              directory: "src",
              changeType: "modified",
              toolName: "Edit",
              messageId: "call:2",
              unifiedDiff:
                "diff --git a/src/feature.ts b/src/feature.ts\n--- a/src/feature.ts\n+++ b/src/feature.ts\n@@ -1 +1 @@\n-export const enabled = false\n+export const enabled = true\n",
              occurredAtUnixMs: 10
            }
          ]
        }}
        workspaceRoot="/workspace/demo"
        label="Changed files"
        onLinkAction={onLinkAction}
      />
    );

    expect(
      screen.getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
    ).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("-2")).toBeTruthy();
    expect(
      screen
        .getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .closest("div")?.className
    ).toContain("text-[15px]");
    expect(
      screen
        .getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .closest("div")?.className
    ).toContain("text-[var(--text-primary)]");
    expect(screen.getByText("+2").parentElement?.className).toContain(
      "inline-flex"
    );
    expect(screen.getByText("+2").className).toContain(
      "workspace-agents-status-panel__detail-tool-diff-added"
    );
    expect(screen.getByText("+2").className).not.toContain(
      "tsh-ui-pill-success"
    );
    expect(screen.getByText("+2").className).not.toContain("text-emerald");
    expect(screen.getByText("-2").className).toContain(
      "workspace-agents-status-panel__detail-tool-diff-removed"
    );
    expect(screen.getByText("-2").className).not.toContain(
      "tsh-ui-pill-danger"
    );
    expect(screen.getByText("-2").className).not.toContain("text-rose");
    expect(
      screen.getByText("+2").parentElement?.parentElement?.className
    ).toContain("items-center");
    expect(screen.getByText("+2").parentElement?.parentElement).toBe(
      screen.getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .parentElement
    );
    expect(
      screen
        .getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .closest("section")?.firstElementChild?.className
    ).toContain("agent-turn-summary-card");
    expect(
      screen
        .getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .closest("section")?.firstElementChild?.className
    ).not.toContain("border-[var(--line-1)]");
    expect(screen.queryByText("Changed files")).toBeNull();
    expect(
      screen.queryByText("agentHost.agentGui.turnSummaryOpenFile")
    ).toBeNull();
    const firstFileToggle = screen.getAllByRole("button", {
      name: /src\/app\.ts/i
    })[0]!;
    expect(firstFileToggle.className).toContain("items-center");
    expect(firstFileToggle.className).toContain("gap-1");
    expect(
      firstFileToggle
        .querySelector("svg")
        ?.classList.contains("lucide-chevron-right")
    ).toBe(true);
    expect(
      firstFileToggle.querySelector(".lucide-chevron-right")?.parentElement
        ?.className
    ).toContain("text-[var(--text-tertiary)]");
    expect(
      firstFileToggle.querySelector(".lucide-chevron-right")?.parentElement
        ?.className
    ).toContain("opacity-0");
    expect(
      firstFileToggle.querySelector(".lucide-chevron-right")?.parentElement
        ?.className
    ).toContain("group-hover/file-toggle:opacity-100");
    expect(
      firstFileToggle.querySelector(".lucide-chevron-right")?.className
    ).toContain("transition-transform");
    expect(firstFileToggle.querySelector(".lucide-file-text")).toBeNull();
    expect(firstFileToggle.querySelector(".lucide-file-pen-line")).toBeNull();
    expect(firstFileToggle.querySelector(".lucide-file-plus-2")).toBeNull();
    expect(screen.getByTitle("src/app.ts").className).toContain(
      "text-[var(--text-secondary)]"
    );
    expect(screen.getByTitle("src/app.ts").className).toContain("text-[13px]");
    expect(
      screen
        .getByText("agentHost.agentGui.turnSummaryFilesChanged:2")
        .closest("section")?.className
    ).toContain("workspace-agents-status-panel__detail-turn-summary");

    fireEvent.click(firstFileToggle);

    expect(
      firstFileToggle.querySelector(".lucide-chevron-right")?.className
    ).toContain("rotate-90");
    await waitFor(() => {
      expect(screen.getByText("const ready = false")).toBeTruthy();
      expect(screen.getByText("const ready = true")).toBeTruthy();
    });
    expect(
      screen
        .getByText("const ready = false")
        .closest(".workspace-agents-status-panel__detail-tool-diff")?.className
    ).toContain("border-[var(--line-2)]");
    expect(
      screen
        .getByText("const ready = false")
        .closest(".workspace-agents-status-panel__detail-tool-diff")
        ?.parentElement?.className
    ).not.toContain("bg-[color:var(--transparency-block)]");
    expect(
      screen
        .getByText("const ready = false")
        .closest(".workspace-agents-status-panel__detail-tool-diff")
        ?.parentElement?.className
    ).toContain("rounded-none");
    await waitFor(() => {
      expect(
        screen
          .getByText("const ready = false")
          .closest(".agent-collapsible-reveal")
      ).toHaveAttribute("data-expanded", "true");
    });

    const openFileButton = screen.getByRole("button", {
      name: /agentHost\.workspaceAgentSessionDetailOpenFile:src\/app\.ts/i
    });

    expect(openFileButton.className).toContain("h-7");
    expect(openFileButton.className).toContain("w-7");
    expect(openFileButton.className).not.toContain("h-8");
    expect(openFileButton.className).not.toContain("w-8");

    fireEvent.click(openFileButton);

    expect(
      openFileButton.querySelector('svg[data-tutti-chrome-glyph="fill"]')
    ).toBeTruthy();
    expect(
      openFileButton
        .querySelector('svg[data-tutti-chrome-glyph="fill"]')
        ?.getAttribute("class")
    ).toContain("text-[var(--text-secondary)]");

    expect(onLinkAction).toHaveBeenCalled();
  });

  it("animates the overflow file list when there are more than three files", async () => {
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:2",
          turnId: "turn-2",
          fileCount: 4,
          modifiedCount: 4,
          createdCount: 0,
          occurredAtUnixMs: 20,
          files: Array.from({ length: 4 }, (_, index) => ({
            label: `src/file-${index + 1}.ts`,
            path: `src/file-${index + 1}.ts`,
            fileName: `file-${index + 1}.ts`,
            directory: "src",
            changeType: "modified" as const,
            toolName: "Edit",
            messageId: `call:${index + 1}`,
            unifiedDiff: `diff --git a/src/file-${index + 1}.ts b/src/file-${index + 1}.ts\n--- a/src/file-${index + 1}.ts\n+++ b/src/file-${index + 1}.ts\n@@ -1 +1 @@\n-export const value = ${index}\n+export const value = ${index + 1}\n`,
            occurredAtUnixMs: 20
          }))
        }}
        workspaceRoot="/workspace/demo"
        label="Changed files"
      />
    );

    expect(screen.queryByText("src/file-4.ts")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /agentHost\.agentGui\.turnSummaryShowMoreFiles:1/i
      })
    );

    await waitFor(() => {
      expect(screen.getByText("src/file-4.ts")).toBeTruthy();
    });
    expect(
      screen.getByText("src/file-4.ts").closest(".agent-collapsible-reveal")
    ).toHaveAttribute("data-expanded", "true");
    expect(
      screen.getByRole("button", {
        name: /agentHost\.agentGui\.turnSummaryShowFewerFiles/i
      })
    ).toBeTruthy();
  });

  it("dispatches workspace actions for external absolute file changes", async () => {
    const onLinkAction = vi.fn();
    const externalPath =
      "/var/folders/17/demo/T/codex-presentations/test-note.md";
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:external",
          turnId: "turn-external",
          fileCount: 1,
          modifiedCount: 0,
          createdCount: 1,
          occurredAtUnixMs: 25,
          files: [
            {
              label: externalPath,
              path: externalPath,
              fileName: "test-note.md",
              directory: "/var/folders/17/demo/T/codex-presentations",
              changeType: "created",
              toolName: "write_file",
              messageId: "call:external",
              content: "# Test note",
              newString: "# Test note",
              occurredAtUnixMs: 25
            }
          ]
        }}
        workspaceRoot="/Users/demo/project"
        label="Changed files"
        onLinkAction={onLinkAction}
      />
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /test-note\.md/i
      })[0]!
    );

    const openFileButton = await screen.findByRole("button", {
      name: /agentHost\.workspaceAgentSessionDetailOpenFile:\/var\/folders\/17\/demo\/T\/codex-presentations\/test-note\.md/i
    });
    fireEvent.click(openFileButton);

    expect(onLinkAction).toHaveBeenCalledWith(
      expect.objectContaining({
        path: externalPath,
        type: "open-workspace-file"
      })
    );
  });

  it("renders created edit-file content without falling back to monaco loading", async () => {
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:3",
          turnId: "turn-3",
          fileCount: 1,
          modifiedCount: 0,
          createdCount: 1,
          occurredAtUnixMs: 30,
          files: [
            {
              label: "/workspace/today.txt",
              path: "/workspace/today.txt",
              fileName: "today.txt",
              directory: "/workspace",
              changeType: "created",
              toolName: "Edit",
              messageId: "call:3",
              content: "2026-05-19",
              newString: "2026-05-19",
              occurredAtUnixMs: 30
            }
          ]
        }}
        workspaceRoot="/workspace"
        label="Changed files"
      />
    );

    expect(
      screen.getByText("agentHost.agentGui.turnSummaryFilesChanged:1")
    ).toBeTruthy();
    expect(screen.getAllByText("+1")).toHaveLength(2);
    expect(screen.queryByText("-1")).toBeNull();
    expect(
      screen.queryByText("agentHost.agentGui.turnSummaryCreatedTag")
    ).toBeNull();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /today\.txt/i
      })[0]!
    );

    await waitFor(() => {
      expect(screen.getByText("2026-05-19")).toBeTruthy();
    });
    expect(
      screen.queryByText("agentHost.agentTool.details.loadingDiff")
    ).toBeNull();
  });

  it("renders deleted file content as removed lines", async () => {
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:deleted",
          turnId: "turn-deleted",
          fileCount: 1,
          modifiedCount: 1,
          createdCount: 0,
          occurredAtUnixMs: 35,
          files: [
            {
              label: "/workspace/a.md",
              path: "/workspace/a.md",
              fileName: "a.md",
              directory: "/workspace",
              changeType: "deleted",
              toolName: "apply_patch",
              messageId: "call:deleted",
              oldString: "aaaaa",
              newString: "",
              occurredAtUnixMs: 35
            }
          ]
        }}
        workspaceRoot="/workspace"
        label="Changed files"
      />
    );

    expect(screen.getAllByText("-1")).toHaveLength(2);
    expect(screen.queryByText("+1")).toBeNull();
    expect(screen.getByText("/workspace/a.md").className).toContain(
      "line-through"
    );

    expect(
      screen.queryByText("agentHost.agentGui.turnSummaryCreatedTag")
    ).toBeNull();
  });

  it("marks long file paths as shrinkable so truncation can prevent overflow", () => {
    render(
      <AgentTurnSummaryRow
        row={{
          kind: "turn-summary",
          id: "turn-summary:4",
          turnId: "turn-4",
          fileCount: 1,
          modifiedCount: 1,
          createdCount: 0,
          occurredAtUnixMs: 40,
          files: [
            {
              label:
                "/workspace/very/deep/path/to/a/file/with/a/really-long-name/today_news_summary_2026-05-20.txt",
              path: "/workspace/very/deep/path/to/a/file/with/a/really-long-name/today_news_summary_2026-05-20.txt",
              fileName: "today_news_summary_2026-05-20.txt",
              directory:
                "/workspace/very/deep/path/to/a/file/with/a/really-long-name",
              changeType: "modified",
              toolName: "Edit",
              messageId: "call:4",
              unifiedDiff:
                "diff --git a/today_news_summary_2026-05-20.txt b/today_news_summary_2026-05-20.txt\n--- a/today_news_summary_2026-05-20.txt\n+++ b/today_news_summary_2026-05-20.txt\n@@ -1 +1 @@\n-old\n+new\n",
              occurredAtUnixMs: 40
            }
          ]
        }}
        workspaceRoot="/workspace"
        label="Changed files"
      />
    );

    const pathLabel = screen.getByTitle(
      "/workspace/very/deep/path/to/a/file/with/a/really-long-name/today_news_summary_2026-05-20.txt"
    );
    const pathToggle = pathLabel.closest("button");
    const pathContainer = pathLabel.parentElement;
    const fileRow = pathToggle?.closest(".agent-turn-summary-card__file");
    const summarySection = screen
      .getByText("agentHost.agentGui.turnSummaryFilesChanged:1")
      .closest("section");

    expect(pathLabel.className).toContain("truncate");
    expect(pathLabel.className).toContain("block");
    expect(pathLabel.className).toContain("min-w-0");
    expect(pathContainer?.className).toContain("flex-1");
    expect(pathContainer?.className).toContain("overflow-hidden");
    expect(pathToggle?.className).toContain("flex-1");
    expect(pathToggle?.className).toContain("overflow-hidden");
    expect(fileRow?.firstElementChild?.className).toContain("overflow-hidden");
    expect(fileRow?.firstElementChild?.className).toContain(
      "agent-turn-summary-card__file-row"
    );
    expect(summarySection?.firstElementChild?.className).toContain("w-full");
  });
});
