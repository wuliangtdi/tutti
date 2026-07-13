import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentGuiWorkbenchHeader } from "./header.ts";

describe("AgentGuiWorkbenchHeader", () => {
  it("can hide the generic app title for a standalone window", () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Collapse conversations",
          expandConversationRail: "Expand conversations",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed={false}
        nodeId="agent-gui-node-1"
        showAppTitle={false}
        title="Agent"
        onToggleConversationRail={() => {}}
      />
    );

    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
  });

  it("renders an optional primary accessory beside the window controls", () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Collapse conversations",
          expandConversationRail: "Expand conversations",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed={false}
        nodeId="agent-gui-node-1"
        primaryAccessory={<button type="button">Download update</button>}
        onToggleConversationRail={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Download update" })
    ).toBeInTheDocument();
  });

  it("keeps secondary actions in layout beside the expanded session title", () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Collapse conversations",
          expandConversationRail: "Expand conversations",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        conversationTitle="Files"
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed={false}
        nodeId="agent-gui-node-1"
        secondaryAccessory={<button type="button">File tool</button>}
        onToggleConversationRail={() => {}}
      />
    );

    const detail = screen.getByTestId("agent-gui-window-detail-title");
    const actions = screen.getByRole("button", { name: "File tool" });
    expect(detail.parentElement).toContainElement(actions);
  });

  it("keeps secondary actions in the primary row when the rail is collapsed", () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Collapse conversations",
          expandConversationRail: "Expand conversations",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        conversationTitle="Files"
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed
        nodeId="agent-gui-node-1"
        secondaryAccessory={<button type="button">File tool</button>}
        onToggleConversationRail={() => {}}
      />
    );

    const primary = document.querySelector(
      "[data-agent-gui-workbench-header-primary='true']"
    );
    const actions = screen.getByRole("button", { name: "File tool" });
    expect(primary).toContainElement(actions);
  });
});
