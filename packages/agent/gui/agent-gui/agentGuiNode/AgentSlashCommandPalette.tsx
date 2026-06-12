import { useEffect, useRef } from "react";
import type { AgentSessionCommand } from "../../shared/agentSessionTypes";
import { cn } from "../../app/renderer/lib/utils";
import { menuItemClassName } from "@tutti-os/ui-system";
import type { AgentGUIProviderSkillOption } from "./model/agentGuiNodeTypes";

export type AgentSlashPaletteEntry =
  | {
      type: "command";
      key: string;
      label: string;
      description?: string;
      command: AgentSessionCommand;
    }
  | {
      type: "skill";
      key: string;
      label: string;
      description?: string;
      skill: AgentGUIProviderSkillOption;
    };

interface AgentSlashCommandPaletteProps {
  entries: readonly AgentSlashPaletteEntry[];
  highlightedIndex: number;
  label: string;
  onHighlightChange: (index: number) => void;
  onSelect: (command: AgentSessionCommand) => void;
  onSelectSkill: (skill: AgentGUIProviderSkillOption) => void;
}

const paletteStyles = {
  palette:
    "nodrag agent-gui-node__mention-palette flex h-full min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1 pt-2 [-webkit-app-region:no-drag]",
  option: cn(
    menuItemClassName,
    "nodrag min-h-9 w-full min-w-0 justify-start overflow-hidden rounded-[6px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-[var(--transparency-block)] focus:bg-[var(--transparency-block)] focus-visible:outline-none data-[highlighted]:bg-[var(--transparency-block)] active:bg-[var(--transparency-active)]"
  ),
  copy: "flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden leading-[16px]",
  name: "min-w-0 max-w-[48%] shrink-0 truncate text-[11px] font-semibold text-[var(--text-primary)]",
  descriptionText:
    "min-w-0 flex-1 truncate text-[11px] font-normal text-[var(--text-secondary)]"
};

export function AgentSlashCommandPalette({
  entries,
  highlightedIndex,
  label,
  onHighlightChange,
  onSelect,
  onSelectSkill
}: AgentSlashCommandPaletteProps): React.JSX.Element | null {
  "use memo";
  const highlightedOptionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    highlightedOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  if (entries.length === 0) {
    return null;
  }
  return (
    <div className={paletteStyles.palette} role="listbox" aria-label={label}>
      {entries.map((entry, index) => {
        const isHighlighted = index === highlightedIndex;
        return (
          <button
            key={entry.key}
            ref={isHighlighted ? highlightedOptionRef : null}
            type="button"
            className={cn(
              paletteStyles.option,
              isHighlighted && "bg-[var(--transparency-block)]"
            )}
            role="option"
            aria-selected={isHighlighted}
            data-highlighted={isHighlighted ? "" : undefined}
            onMouseEnter={() => onHighlightChange(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              entry.type === "command"
                ? onSelect(entry.command)
                : onSelectSkill(entry.skill)
            }
          >
            <span className={paletteStyles.copy}>
              <span className={paletteStyles.name}>{entry.label}</span>
              {entry.description ? (
                <span className={paletteStyles.descriptionText}>
                  {entry.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
