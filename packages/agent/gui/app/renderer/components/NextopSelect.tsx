import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import {
  MENU_BOUNDARY_PADDING,
  clampMenuPositionToBoundary,
  resolveMenuBoundaryFromElement
} from "./menuBoundary";

export interface NextopSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  menuColumn?: "left" | "right";
  disabled?: boolean;
  badge?: string;
  description?: string;
  labelClassName?: string;
  /** 应用到选项按钮（如终端字体列表预览） */
  optionStyle?: React.CSSProperties;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

type MenuPlacement = "auto" | "top" | "bottom";
type MenuLayout = "list" | "split";

const SPLIT_MENU_MIN_WIDTH = 480;
const SPLIT_MENU_MAX_WIDTH = 620;

export function NextopSelectOptionContent({
  option,
  hasIconColumn = Boolean(option.icon),
  iconClassName,
  className
}: {
  option: NextopSelectOption;
  hasIconColumn?: boolean;
  iconClassName?: string;
  className?: string;
}): React.JSX.Element {
  "use memo";
  return (
    <span
      className={cn("flex min-w-0 flex-1 items-center gap-2.5", className)}
      data-nextop-select-option-content="true"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "flex min-w-0 items-center font-semibold leading-[1.2]",
            option.labelClassName
          )}
        >
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
        </span>
        {option.description ? (
          <span className="m-0 whitespace-normal text-[11px] leading-[1.3] text-muted-foreground">
            {option.description}
          </span>
        ) : null}
      </span>
      {hasIconColumn ? (
        <span
          className={cn(
            "flex w-[18px] shrink-0 justify-center",
            option.icon ? "text-[var(--tsh-shell-accent)]" : "text-current",
            iconClassName
          )}
          aria-hidden={option.icon ? undefined : "true"}
        >
          {option.icon}
        </span>
      ) : null}
    </span>
  );
}

/** 按选项文案（及 badge / description）估算列表最小宽度，避免窄触发器导致标签被 ellipsis。 */
function resolveNextopSelectMenuContentMinWidth(
  trigger: HTMLElement,
  options: readonly NextopSelectOption[]
): number {
  if (options.length === 0) {
    return 0;
  }
  const family = getComputedStyle(trigger).fontFamily.trim() || "sans-serif";

  const labelFont = `13px ${family}`;
  const descFont = `11px `;
  const badgeFont = `10px ${family}`;

  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return 0;
  }

  let max = 0;
  for (const option of options) {
    ctx.font = labelFont;
    let primaryRow = ctx.measureText(option.label).width;
    if (option.badge?.trim()) {
      ctx.font = badgeFont;
      primaryRow += 10 + ctx.measureText(option.badge.trim()).width;
    }
    max = Math.max(max, primaryRow);
    if (option.description?.trim()) {
      ctx.font = descFont;
      max = Math.max(max, ctx.measureText(option.description.trim()).width);
    }
  }

  /* 选项左右 padding 12+12；菜单容器左右 padding 4+4；与真实渲染留白略有偏差 */
  return Math.ceil(max + 24 + 8 + 6);
}

function resolveNextopSelectSplitMenuContentWidth(
  trigger: HTMLElement,
  options: readonly NextopSelectOption[]
): number {
  if (options.length === 0) {
    return 0;
  }
  const family = getComputedStyle(trigger).fontFamily.trim() || "sans-serif";

  const labelFont = `13px ${family}`;
  const descFont = `11px `;

  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return 0;
  }

  let leftMax = 0;
  let rightMax = 0;
  for (const option of options) {
    ctx.font = labelFont;
    let optionMax = ctx.measureText(option.label).width;
    if (option.description?.trim()) {
      ctx.font = descFont;
      optionMax = Math.max(
        optionMax,
        ctx.measureText(option.description.trim()).width
      );
    }
    if (option.menuColumn === "right") {
      rightMax = Math.max(rightMax, optionMax);
    } else {
      leftMax = Math.max(leftMax, optionMax);
    }
  }

  const leftColumn = Math.max(Math.ceil(leftMax + 24 + 30), 332);
  const rightColumn = Math.min(
    Math.max(Math.ceil(rightMax + 24 + 30), 104),
    132
  );
  const menuChrome = 8 + 8 + 1;

  return Math.ceil(leftColumn + rightColumn + menuChrome);
}

function resolveEnabledIndex(
  startIndex: number,
  direction: 1 | -1,
  list: readonly NextopSelectOption[]
): number {
  if (list.length === 0) {
    return -1;
  }

  let currentIndex = startIndex;
  for (let steps = 0; steps < list.length; steps += 1) {
    currentIndex = (currentIndex + direction + list.length) % list.length;
    if (!list[currentIndex]?.disabled) {
      return currentIndex;
    }
  }

  return -1;
}

const nextopFieldClassName = cn(
  "w-full min-h-[42px] rounded-[var(--nextop-radius-xl)] border border-border",
  "bg-[var(--cove-field)] px-[14px] py-[10px] text-left text-[13px] text-foreground",
  "transition-[background-color,border-color,box-shadow,color] duration-180 ease-in-out",
  "placeholder:text-[var(--cove-text-faint)] disabled:cursor-not-allowed disabled:opacity-[0.62]",
  "hover:enabled:border-[color:color-mix(in_srgb,var(--tsh-shell-accent)_36%,var(--cove-border))]",
  "hover:enabled:bg-[color:color-mix(in_srgb,var(--cove-field)_82%,var(--tsh-shell-highlight))]",
  "focus:outline-none focus-visible:outline-none",
  "focus:border-[var(--tsh-shell-accent)]",
  "focus:shadow-[0_0_0_1px_color-mix(in_srgb,var(--tsh-shell-accent)_80%,transparent),0_12px_28px_color-mix(in_srgb,var(--tsh-shell-accent)_16%,transparent)]"
);

const nextopFieldCompactClassName = cn(
  "min-h-9 rounded-[var(--nextop-radius-lg)] px-[10px] py-[7px] text-[11px]"
);

export function NextopSelect({
  id,
  value,
  options,
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
  chevronClassName,
  optionClassName,
  size = "default",
  triggerKind = "field",
  testId,
  triggerTestId,
  menuTestId,
  chevronTestId,
  ariaLabel,
  searchable = false,
  searchPlaceholder,
  emptySearchText,
  menuExtra,
  renderTriggerLabel,
  onOpenChange,
  /** `trigger`：列表宽与触发器一致（默认）。`content`：按当前列表项文案测量，至少能完整显示标签。 */
  menuWidthMode = "trigger",
  menuPlacement = "auto",
  menuLayout = "list",
  splitMenuColumnLabels,
  onChange
}: {
  id?: string;
  value: string;
  options: readonly NextopSelectOption[];
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  chevronClassName?: string;
  optionClassName?: string;
  size?: "default" | "compact";
  triggerKind?: "field" | "button";
  testId?: string;
  triggerTestId?: string;
  menuTestId?: string;
  chevronTestId?: string;
  ariaLabel?: string;
  /** 在菜单内显示搜索框，按 label 过滤 */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchText?: string;
  /** 显示在搜索框与选项列表之间（如「显示全部字体」） */
  menuExtra?: React.ReactNode;
  renderTriggerLabel?: (
    selectedOption: NextopSelectOption | null
  ) => React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  menuWidthMode?: "trigger" | "content";
  menuPlacement?: MenuPlacement;
  menuLayout?: MenuLayout;
  splitMenuColumnLabels?: { left?: React.ReactNode; right?: React.ReactNode };
  onChange: (nextValue: string) => void;
}): React.JSX.Element {
  "use memo";
  const listboxId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const shouldKeepHighlightedOptionVisibleRef = useRef(false);
  const measuredCurrentOpenMenuRef = useRef(false);
  /** 打开菜单时若需指定高亮下标（如键盘自触发器打开） */
  const openMenuIndexOverride = useRef<number | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedOptions = useMemo(() => [...options], [options]);

  const menuOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return normalizedOptions;
    }
    const q = searchQuery.trim().toLowerCase();
    return normalizedOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalizedOptions, searchQuery, searchable]);
  const hasMenuIconColumn = useMemo(
    () => menuOptions.some((option) => option.icon),
    [menuOptions]
  );
  const indexedMenuOptions = useMemo(
    () => menuOptions.map((option, index) => ({ option, index })),
    [menuOptions]
  );
  const splitMenuColumns = useMemo(() => {
    const left: Array<{ option: NextopSelectOption; index: number }> = [];
    const right: Array<{ option: NextopSelectOption; index: number }> = [];

    for (const item of indexedMenuOptions) {
      if (item.option.menuColumn === "right") {
        right.push(item);
      } else {
        left.push(item);
      }
    }

    return { left, right };
  }, [indexedMenuOptions]);

  const selectedIndex = useMemo(
    () => normalizedOptions.findIndex((option) => option.value === value),
    [normalizedOptions, value]
  );
  const selectedOption =
    selectedIndex >= 0 ? (normalizedOptions[selectedIndex] ?? null) : null;

  const menuSelectedIndex = useMemo(
    () => menuOptions.findIndex((option) => option.value === value),
    [menuOptions, value]
  );

  const resolveInitialIndex = useCallback((): number => {
    if (menuSelectedIndex >= 0 && !menuOptions[menuSelectedIndex]?.disabled) {
      return menuSelectedIndex;
    }

    return resolveEnabledIndex(-1, 1, menuOptions);
  }, [menuOptions, menuSelectedIndex]);

  const closeMenu = useCallback((): void => {
    setIsOpen(false);
    setMenuPosition(null);
    setSearchQuery("");
    measuredCurrentOpenMenuRef.current = false;
    onOpenChange?.(false);
  }, [onOpenChange]);

  const updateMenuPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const boundary = resolveMenuBoundaryFromElement(trigger);
    const viewportHeight = boundary.height;
    const viewportWidth = boundary.width;
    const menuGap = 8;
    const edge = MENU_BOUNDARY_PADDING;
    const splitColumnHeaderRows =
      menuLayout === "split" &&
      (splitMenuColumnLabels?.left || splitMenuColumnLabels?.right)
        ? 30
        : 0;
    const headRows =
      (searchable ? 44 : 0) + (menuExtra ? 36 : 0) + splitColumnHeaderRows + 8;
    const preferredOptionCount =
      menuLayout === "split"
        ? Math.max(
            splitMenuColumns.left.length,
            splitMenuColumns.right.length,
            1
          )
        : Math.max(menuOptions.length, 1);
    const preferredOptionHeight = menuLayout === "split" ? 56 : 40;
    const preferredHeight = Math.min(
      preferredOptionCount * preferredOptionHeight + 12 + headRows,
      320
    );
    const relativeRectTop = rect.top - boundary.top;
    const relativeRectBottom = rect.bottom - boundary.top;
    const relativeRectLeft = rect.left - boundary.left;
    const spaceBelow = viewportHeight - relativeRectBottom - menuGap - edge;
    const spaceAbove = relativeRectTop - menuGap - edge;
    const shouldOpenAbove =
      menuPlacement === "top" ||
      (menuPlacement === "auto" &&
        spaceBelow < preferredHeight &&
        spaceAbove > spaceBelow);
    const availableHeight = Math.max(
      0,
      shouldOpenAbove ? spaceAbove : spaceBelow
    );
    const maxHeight = Math.max(48, Math.min(preferredHeight, availableHeight));
    const viewportMaxWidth = Math.max(48, viewportWidth - edge * 2);
    let width: number;
    if (menuLayout === "split") {
      const measuredMin =
        menuWidthMode === "content"
          ? resolveNextopSelectSplitMenuContentWidth(trigger, menuOptions)
          : 0;
      width = Math.min(
        Math.max(SPLIT_MENU_MIN_WIDTH, measuredMin),
        SPLIT_MENU_MAX_WIDTH,
        viewportMaxWidth
      );
    } else {
      width = Math.min(rect.width, viewportMaxWidth);
    }
    if (menuLayout !== "split" && menuWidthMode === "content") {
      const measuredMin = resolveNextopSelectMenuContentMinWidth(
        trigger,
        menuOptions
      );
      if (measuredMin > 0) {
        width = Math.min(Math.max(width, measuredMin), viewportMaxWidth);
      }
    }
    const rawLeft =
      boundary.left + Math.min(relativeRectLeft, viewportWidth - width - edge);
    const renderedMenuHeight =
      menuRef.current?.getBoundingClientRect().height ?? 0;
    const positionedMenuHeight =
      renderedMenuHeight > 0
        ? Math.min(renderedMenuHeight, maxHeight)
        : maxHeight;
    const rawTop = shouldOpenAbove
      ? boundary.top +
        Math.max(edge, relativeRectTop - menuGap - positionedMenuHeight)
      : rect.bottom + menuGap;
    const { left, top } = clampMenuPositionToBoundary({
      left: rawLeft,
      top: rawTop,
      width,
      height: positionedMenuHeight,
      boundary,
      padding: edge
    });

    setMenuPosition((previous) => {
      if (
        previous &&
        previous.top === top &&
        previous.left === left &&
        previous.width === width &&
        previous.maxHeight === maxHeight &&
        previous.placement === (shouldOpenAbove ? "top" : "bottom")
      ) {
        return previous;
      }

      return {
        top,
        left,
        width,
        maxHeight,
        placement: shouldOpenAbove ? "top" : "bottom"
      };
    });
  }, [
    menuExtra,
    menuLayout,
    menuOptions,
    menuPlacement,
    menuWidthMode,
    searchable,
    splitMenuColumnLabels?.left,
    splitMenuColumnLabels?.right,
    splitMenuColumns.left.length,
    splitMenuColumns.right.length
  ]);

  const scrollHighlightedOptionIntoMenu = useCallback(
    (optionIndex: number): void => {
      const menu = menuRef.current;
      if (!menu || optionIndex < 0) {
        return;
      }

      const option = menu.querySelector<HTMLElement>(
        `[data-nextop-select-option-index="${optionIndex}"]`
      );
      const scroller = option?.closest<HTMLElement>(
        '[data-nextop-select-options-scroller="true"]'
      );
      if (!option || !scroller) {
        return;
      }

      const optionRect = option.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (optionRect.top < scrollerRect.top) {
        scroller.scrollTop -= scrollerRect.top - optionRect.top;
        return;
      }
      if (optionRect.bottom > scrollerRect.bottom) {
        scroller.scrollTop += optionRect.bottom - scrollerRect.bottom;
      }
    },
    []
  );

  const setKeyboardHighlightedIndex = useCallback((nextIndex: number): void => {
    shouldKeepHighlightedOptionVisibleRef.current = true;
    setHighlightedIndex(nextIndex);
  }, []);

  const openMenu = useCallback(
    (indexOverride?: number): void => {
      if (disabled) {
        return;
      }
      if (searchable) {
        setSearchQuery("");
      }
      if (indexOverride !== undefined) {
        openMenuIndexOverride.current = indexOverride;
      } else {
        openMenuIndexOverride.current = undefined;
      }
      measuredCurrentOpenMenuRef.current = false;
      setIsOpen(true);
      onOpenChange?.(true);
    },
    [disabled, onOpenChange, searchable]
  );

  useLayoutEffect(() => {
    if (
      !isOpen ||
      !menuPosition ||
      !menuRef.current ||
      measuredCurrentOpenMenuRef.current
    ) {
      return;
    }

    measuredCurrentOpenMenuRef.current = true;
    updateMenuPosition();
  }, [isOpen, menuPosition, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (openMenuIndexOverride.current !== undefined) {
      setKeyboardHighlightedIndex(openMenuIndexOverride.current);
      openMenuIndexOverride.current = undefined;
      return;
    }
    setHighlightedIndex(-1);
  }, [isOpen, setKeyboardHighlightedIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    };

    const handleWindowChange = () => {
      updateMenuPosition();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleWindowChange);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleWindowChange);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen || !shouldKeepHighlightedOptionVisibleRef.current) {
      return;
    }

    shouldKeepHighlightedOptionVisibleRef.current = false;
    scrollHighlightedOptionIntoMenu(highlightedIndex);
  }, [highlightedIndex, isOpen, scrollHighlightedOptionIntoMenu]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (highlightedIndex < 0) {
      return;
    }

    const highlightedOption = menuOptions[highlightedIndex];
    const highlightedIsValid =
      highlightedIndex >= 0 &&
      highlightedIndex < menuOptions.length &&
      !highlightedOption?.disabled;

    if (!highlightedIsValid) {
      setKeyboardHighlightedIndex(resolveInitialIndex());
    }
  }, [
    highlightedIndex,
    isOpen,
    menuOptions,
    resolveInitialIndex,
    setKeyboardHighlightedIndex
  ]);

  const selectOption = (nextValue: string): void => {
    onChange(nextValue);
    closeMenu();
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (isOpen) {
        setKeyboardHighlightedIndex(
          resolveEnabledIndex(highlightedIndex, 1, menuOptions)
        );
        return;
      }

      openMenu(resolveEnabledIndex(menuSelectedIndex - 1, 1, menuOptions));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (isOpen) {
        setKeyboardHighlightedIndex(
          resolveEnabledIndex(highlightedIndex, -1, menuOptions)
        );
        return;
      }

      openMenu(resolveEnabledIndex(menuSelectedIndex + 1, -1, menuOptions));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen && highlightedIndex >= 0) {
        const highlightedOption = menuOptions[highlightedIndex];
        if (highlightedOption && !highlightedOption.disabled) {
          selectOption(highlightedOption.value);
        }
        return;
      }

      openMenu();
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
    }
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    optionIndex: number
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setKeyboardHighlightedIndex(
        resolveEnabledIndex(optionIndex, 1, menuOptions)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setKeyboardHighlightedIndex(
        resolveEnabledIndex(optionIndex, -1, menuOptions)
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setKeyboardHighlightedIndex(resolveEnabledIndex(-1, 1, menuOptions));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setKeyboardHighlightedIndex(resolveEnabledIndex(0, -1, menuOptions));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = menuOptions[optionIndex];
      if (option && !option.disabled) {
        selectOption(option.value);
      }
    }
  };

  const isCompact = size === "compact";
  const rootClassName = cn("relative w-full", className);
  const triggerClassNames = cn(
    "inline-flex w-full items-center justify-between gap-2.5 text-left",
    triggerKind === "field" &&
      cn(
        nextopFieldClassName,
        isCompact && nextopFieldCompactClassName,
        "border-none bg-block shadow-none",
        "hover:enabled:border-none hover:enabled:bg-block-hover hover:enabled:shadow-none",
        "active:enabled:border-none active:enabled:bg-[var(--transparency-block-active)] active:enabled:shadow-none",
        "focus:border-none focus:bg-block focus:shadow-none",
        "focus-visible:border-none focus-visible:bg-block focus-visible:shadow-none"
      ),
    triggerClassName
  );
  const labelClassName = "inline-flex min-w-0 flex-1 items-center gap-2";
  const labelTextClassName = "min-w-0 flex-1 truncate";
  const pillClassName = cn(
    "inline-flex min-h-[18px] flex-none items-center whitespace-nowrap rounded-[var(--nextop-radius-md)]",
    "border border-[var(--cove-border-subtle)] bg-[color:color-mix(in_srgb,var(--tsh-shell-highlight)_68%,transparent)]",
    "px-2 py-px text-[10px] leading-[1.2] text-muted-foreground select-none"
  );
  const menuClassNames = cn(
    "t-dropdown is-open fixed z-[var(--tsh-global-modal-floating-z,100600)] flex flex-col overflow-hidden rounded-[var(--nextop-radius-xl)]",
    "border border-hairline bg-background-fronted p-1",
    "shadow-[var(--tsh-shell-shadow)]",
    menuClassName
  );
  const renderMenuOption = (
    option: NextopSelectOption,
    index: number
  ): React.JSX.Element => {
    const isSelected = option.value === value;
    const isHighlighted = index === highlightedIndex;

    return (
      <button
        key={option.value}
        type="button"
        className={cn(
          "flex min-h-[38px] w-full items-center justify-between gap-2.5 rounded-[var(--nextop-radius-lg)]",
          "border-0 bg-transparent px-3 py-[9px] text-left text-[13px] text-foreground",
          "shadow-none outline-none [-webkit-tap-highlight-color:transparent]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          "hover:bg-block",
          isHighlighted && "bg-block",
          optionClassName
        )}
        style={option.optionStyle}
        role="option"
        aria-selected={isSelected}
        data-highlighted={isHighlighted ? "true" : undefined}
        data-selected={isSelected ? "true" : undefined}
        data-nextop-select-option-index={index}
        data-nextop-select-option-value={option.value}
        disabled={option.disabled}
        tabIndex={-1}
        onClick={() => selectOption(option.value)}
        onPointerDown={(event) => {
          if (event.button !== 0 || option.disabled) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          selectOption(option.value);
        }}
        onKeyDown={(event) => handleOptionKeyDown(event, index)}
        onMouseEnter={() => {
          if (option.disabled) {
            return;
          }

          setHighlightedIndex(index);
        }}
      >
        <NextopSelectOptionContent
          option={option}
          hasIconColumn={hasMenuIconColumn}
        />
        {option.badge ? (
          <span className={pillClassName}>{option.badge}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div ref={rootRef} className={rootClassName} data-nextop-select="true">
      {testId ? (
        <input type="hidden" data-testid={testId} value={value} readOnly />
      ) : null}
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={triggerClassNames}
        data-testid={
          triggerTestId ?? (testId ? `${testId}-trigger` : undefined)
        }
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={labelClassName}>
          {renderTriggerLabel ? (
            renderTriggerLabel(selectedOption)
          ) : (
            <>
              <span className={labelTextClassName}>
                {selectedOption?.label ?? ""}
              </span>
              {selectedOption?.badge ? (
                <span className={pillClassName}>{selectedOption.badge}</span>
              ) : null}
            </>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={isCompact ? 14 : 16}
          data-testid={chevronTestId}
          className={cn(
            "flex-none transition-transform duration-150 ease-out",
            disabled ? "text-current" : "text-[var(--cove-text-faint)]",
            isOpen && "rotate-180",
            chevronClassName
          )}
        />
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              id={listboxId}
              ref={menuRef}
              className={menuClassNames}
              data-testid={
                menuTestId ?? (testId ? `${testId}-menu` : undefined)
              }
              data-nextop-select-menu="true"
              data-origin={
                menuPosition.placement === "top" ? "bottom-right" : "top-right"
              }
              role="listbox"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                ...(menuLayout === "split"
                  ? { height: menuPosition.maxHeight }
                  : { maxHeight: menuPosition.maxHeight })
              }}
            >
              {searchable ? (
                <div
                  className="shrink-0 pb-1.5"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <input
                    id={searchId}
                    type="text"
                    className={cn(
                      nextopFieldClassName,
                      nextopFieldCompactClassName,
                      "box-border"
                    )}
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setKeyboardHighlightedIndex(0);
                    }}
                    autoFocus
                    aria-label={searchPlaceholder}
                  />
                </div>
              ) : null}
              {menuExtra ? (
                <div className="shrink-0 pb-1">{menuExtra}</div>
              ) : null}
              <div
                className={cn(
                  "min-h-0 flex-1",
                  menuLayout === "split" ? "overflow-hidden" : "overflow-y-auto"
                )}
                data-nextop-select-options-scroller={
                  menuLayout === "split" ? undefined : "true"
                }
              >
                {menuOptions.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground">
                    {emptySearchText ?? ""}
                  </div>
                ) : menuLayout === "split" ? (
                  <div
                    className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_1px_minmax(104px,132px)] gap-1 overflow-hidden"
                    data-nextop-select-menu-layout="split"
                  >
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      {splitMenuColumnLabels?.left ? (
                        <div className="shrink-0 px-2 pb-2 pt-1 text-[11px] leading-[18px] text-[var(--text-tertiary)]">
                          {splitMenuColumnLabels.left}
                        </div>
                      ) : null}
                      <div
                        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
                        data-nextop-select-options-scroller="true"
                      >
                        {splitMenuColumns.left.map(({ option, index }) =>
                          renderMenuOption(option, index)
                        )}
                      </div>
                    </div>
                    <div
                      className="self-stretch bg-[var(--cove-border-subtle)]"
                      aria-hidden="true"
                    />
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      {splitMenuColumnLabels?.right ? (
                        <div className="shrink-0 px-2 pb-2 pt-1 text-[11px] leading-[18px] text-[var(--text-tertiary)]">
                          {splitMenuColumnLabels.right}
                        </div>
                      ) : null}
                      <div
                        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain"
                        data-nextop-select-options-scroller="true"
                      >
                        {splitMenuColumns.right.map(({ option, index }) =>
                          renderMenuOption(option, index)
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  menuOptions.map((option, index) =>
                    renderMenuOption(option, index)
                  )
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
