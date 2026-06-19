import * as React from "react";

import { cn } from "#lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../tooltip/tooltip";

/**
 * 监测元素是否因 overflow 被省略号截断(scrollWidth > clientWidth)。
 * 返回要挂到「截断元素」上的 ref,以及是否正在溢出。随容器尺寸变化实时更新。
 */
export function useTextOverflow<T extends HTMLElement = HTMLElement>(
  watch: unknown
): { ref: React.RefObject<T | null>; overflowing: boolean } {
  const ref = React.useRef<T>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const measure = (): void => {
      setOverflowing(element.scrollWidth - element.clientWidth > 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [watch]);

  return { ref, overflowing };
}

export interface TruncatingPillLabelProps {
  /** 完整文本;仅在标签被省略号截断时,通过 Tooltip 展示。 */
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * mention chip 的标签:省略号截断 + 「超出才显示」的设计系统 Tooltip。
 * 仅当实际溢出(scrollWidth > clientWidth)时,hover 才弹出完整文本,避免短标签也弹无意义 tooltip。
 * 依赖上层已挂载的 TooltipProvider(app 根已提供)。Trigger 始终包裹标签以保持 DOM 稳定,
 * 仅切换 TooltipContent 的渲染,从而 ResizeObserver 不会因重挂载而丢失。
 */
export function TruncatingPillLabel({
  tooltip,
  className,
  children
}: TruncatingPillLabelProps): React.JSX.Element {
  const { ref: labelRef, overflowing } =
    useTextOverflow<HTMLSpanElement>(tooltip);

  const label = (
    <span
      ref={labelRef}
      className={cn(
        "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );

  if (!tooltip) {
    return label;
  }

  // 自带 TooltipProvider:使本组件不依赖上层 Provider,可在任意 MentionPill 使用处工作
  // (嵌套 Provider 在 Radix 中安全,就近配置生效)。
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        {overflowing ? (
          <TooltipContent className="max-w-[min(420px,calc(100vw-32px))] whitespace-normal text-left [overflow-wrap:anywhere]">
            {tooltip}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}
