import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentGuiWorkbenchHeader } from "./header.ts";

describe("AgentGuiWorkbenchHeader", () => {
  it.each([
    { collapsed: false, label: "Hide sidebar" },
    { collapsed: true, label: "Show sidebar" }
  ])("shows the $label tooltip on hover", async ({ collapsed, label }) => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Hide sidebar",
          expandConversationRail: "Show sidebar",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed={collapsed}
        nodeId="agent-gui-node-1"
        onToggleConversationRail={() => {}}
      />
    );

    const toggleButton = screen.getByRole("button", { name: label });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerMove(toggleButton, { pointerType: "mouse" });

    expect(await screen.findByRole("tooltip")).toHaveTextContent(label);
  });

  it("shows the new conversation tooltip on hover", async () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Hide sidebar",
          expandConversationRail: "Show sidebar",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation"
        }}
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed
        nodeId="agent-gui-node-1"
        onCreateConversation={() => {}}
        onToggleConversationRail={() => {}}
      />
    );

    const newConversationButton = screen.getByRole("button", {
      name: "New conversation"
    });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerMove(newConversationButton, { pointerType: "mouse" });

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "New conversation"
    );
  });

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

  it("can hide the conversation rail toggle while its content is loading", () => {
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
        showConversationRailToggle={false}
        onToggleConversationRail={() => {}}
      />
    );

    expect(
      screen.queryByTestId("agent-gui-toggle-conversation-rail")
    ).not.toBeInTheDocument();
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

  it("uses the open-link-lined asset for the detached window action", () => {
    render(
      <AgentGuiWorkbenchHeader
        copy={{
          collapseConversationRail: "Collapse conversations",
          expandConversationRail: "Expand conversations",
          fallbackAgentLabel: "Agent",
          newConversation: "New conversation",
          openDetachedWindow: "Open detached window"
        }}
        isConversationRailAutoCollapsed={false}
        isConversationRailCollapsed={false}
        nodeId="agent-gui-node-1"
        onOpenDetachedWindow={() => {}}
        onToggleConversationRail={() => {}}
      />
    );

    expect(
      screen
        .getByTestId("agent-gui-open-detached-window")
        .querySelector('[data-agent-gui-icon="open-link-lined"]')
    ).toBeInTheDocument();
  });
});
