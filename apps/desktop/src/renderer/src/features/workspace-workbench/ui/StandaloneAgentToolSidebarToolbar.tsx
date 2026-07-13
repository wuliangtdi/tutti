import type { ReactNode } from "react";
import {
  Button,
  ChatIcon,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FileCodeIcon,
  FolderIcon,
  NavApplicationsLinedIcon,
  ToolsIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  WebIcon,
  cn
} from "@tutti-os/ui-system";
import {
  formatStandaloneAgentToolReminderCount,
  isStandaloneAgentToolGroupActive,
  type StandaloneAgentToolLauncherPanelId,
  type StandaloneAgentToolPanelId
} from "./standaloneAgentToolSidebarModel.ts";
import { WorkspaceAgentStatusPetIcon } from "./WorkspaceAgentStatusPetIcon";

export type ToolSidebarCopy = Record<
  | StandaloneAgentToolPanelId
  | "terminal"
  | "close"
  | "expand"
  | "shrink"
  | "tool",
  string
> & {
  unavailable: string;
};

export type ToolSidebarReminderCounts = Partial<
  Record<StandaloneAgentToolPanelId | "terminal", number>
>;

export function StandaloneAgentToolSidebarToolbar({
  activePanel,
  copy,
  reminders,
  terminalOpen,
  onSelectTool,
  onTogglePanel
}: {
  activePanel: StandaloneAgentToolPanelId | null;
  copy: ToolSidebarCopy;
  reminders: ToolSidebarReminderCounts;
  terminalOpen: boolean;
  onSelectTool: (panel: StandaloneAgentToolLauncherPanelId) => void;
  onTogglePanel: (
    panel: Exclude<StandaloneAgentToolPanelId, "browser">
  ) => void;
}): ReactNode {
  const toolReminderCount =
    (reminders.browser ?? 0) + (reminders.terminal ?? 0);
  const toolActive = isStandaloneAgentToolGroupActive({
    activePanel,
    mountedPanels: [],
    terminalMounted: terminalOpen,
    terminalOpen
  });

  return (
    <TooltipProvider>
      <nav
        aria-label={copy.tool}
        className="nodrag pointer-events-auto flex items-center gap-0.5 [-webkit-app-region:no-drag]"
        data-standalone-agent-tool-sidebar-toolbar="true"
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ToolSidebarButton
          active={activePanel === "files"}
          icon={<FolderIcon aria-hidden className="size-4" />}
          label={copy.files}
          reminderCount={reminders.files}
          onClick={() => onTogglePanel("files")}
        />
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={copy.tool}
                  className="relative h-7 gap-1 px-1.5 text-[var(--text-secondary)]"
                  data-standalone-agent-tool-menu-trigger="true"
                  size="sm"
                  type="button"
                  variant={toolActive ? "secondary" : "chrome"}
                >
                  <ToolsIcon aria-hidden className="size-4" />
                  <ChevronDownIcon aria-hidden className="size-3" />
                  <ReminderBadge count={toolReminderCount} floating />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{copy.tool}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onSelect={() => onSelectTool("browser")}>
              <WebIcon aria-hidden className="size-4" />
              <span>{copy.browser}</span>
              <ReminderBadge count={reminders.browser} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSelectTool("terminal")}>
              <FileCodeIcon aria-hidden className="size-4" />
              <span>{copy.terminal}</span>
              <ReminderBadge count={reminders.terminal} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span aria-hidden className="mx-1 h-4 w-px bg-[var(--border-1)]" />
        <ToolSidebarButton
          active={activePanel === "apps"}
          icon={<NavApplicationsLinedIcon aria-hidden className="size-4" />}
          label={copy.apps}
          reminderCount={reminders.apps}
          onClick={() => onTogglePanel("apps")}
        />
        <ToolSidebarButton
          active={activePanel === "messages"}
          icon={
            (reminders.messages ?? 0) > 0 ? (
              <WorkspaceAgentStatusPetIcon
                className="my-0 size-5"
                imageClassName="size-5"
                mood="running"
              />
            ) : (
              <ChatIcon aria-hidden className="size-4" />
            )
          }
          label={copy.messages}
          reminderCount={reminders.messages}
          onClick={() => onTogglePanel("messages")}
        />
      </nav>
    </TooltipProvider>
  );
}

function ToolSidebarButton({
  active,
  icon,
  label,
  reminderCount,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  reminderCount?: number;
  onClick: () => void;
}): ReactNode {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={active}
          className="relative"
          size="icon-sm"
          type="button"
          variant={active ? "secondary" : "chrome"}
          onClick={onClick}
        >
          {icon}
          <ReminderBadge count={reminderCount} floating />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function ReminderBadge({
  count,
  floating = false
}: {
  count?: number;
  floating?: boolean;
}): ReactNode {
  const formattedCount = formatStandaloneAgentToolReminderCount(count);
  if (!formattedCount) {
    return null;
  }
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--state-danger)] px-1 text-[9px] leading-4 font-semibold text-[var(--white-stationary)]",
        floating && "absolute -top-1 -right-1 ml-0"
      )}
    >
      {formattedCount}
    </span>
  );
}
