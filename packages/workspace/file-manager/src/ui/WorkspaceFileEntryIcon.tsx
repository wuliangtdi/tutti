import {
  FileCodeIcon,
  FileTextIcon,
  FolderFilledIcon,
  ImageFileIcon,
  LoadingIcon,
  VideoFileIcon,
  cn
} from "@tutti-os/ui-system";
import type { ReactElement } from "react";
import { resolveWorkspaceFileVisualKind } from "../services/workspaceFileManagerModel.ts";
import type { WorkspaceFileEntry } from "../services/workspaceFileManagerTypes.ts";
import {
  resolveWorkspaceFileEntryIconCacheKey,
  isWorkspaceApplicationBundle
} from "./workspaceFileEntryIconPolicy.ts";

export function WorkspaceFileEntryIcon({
  entry,
  frameClassName,
  iconClassName = "size-4",
  iconUrlByCacheKey,
  isEnteringDirectory = false
}: {
  entry: WorkspaceFileEntry;
  frameClassName?: string;
  iconClassName?: string;
  iconUrlByCacheKey?: ReadonlyMap<string, string | null>;
  isEnteringDirectory?: boolean;
}): ReactElement {
  const visualKind = resolveWorkspaceFileVisualKind(entry);
  const isAppBundle = isWorkspaceApplicationBundle(entry);
  const iconUrl =
    iconUrlByCacheKey?.get(resolveWorkspaceFileEntryIconCacheKey(entry)) ??
    null;

  return (
    <span
      className={cn(
        "grid flex-none place-items-center overflow-hidden",
        frameClassName,
        isEnteringDirectory
          ? "text-[var(--text-tertiary)]"
          : entryIconColorClassName(visualKind, isAppBundle)
      )}
    >
      {isEnteringDirectory ? (
        <LoadingIcon className={iconClassName + " animate-spin"} />
      ) : iconUrl ? (
        <img
          alt=""
          className={cn(iconClassName, "rounded-[4px] object-contain")}
          draggable={false}
          src={iconUrl}
        />
      ) : (
        <DefaultEntryIcon
          entry={entry}
          iconClassName={iconClassName}
          visualKind={visualKind}
        />
      )}
    </span>
  );
}

function DefaultEntryIcon({
  entry,
  iconClassName,
  visualKind
}: {
  entry: WorkspaceFileEntry;
  iconClassName: string;
  visualKind: ReturnType<typeof resolveWorkspaceFileVisualKind>;
}): ReactElement {
  if (isWorkspaceApplicationBundle(entry)) {
    return <FileTextIcon className={iconClassName} />;
  }

  switch (visualKind) {
    case "directory":
      return <FolderFilledIcon className={iconClassName} />;
    case "image":
      return <ImageFileIcon className={iconClassName} />;
    case "video":
      return <VideoFileIcon className={iconClassName} />;
    case "markdown":
    case "document":
      return <FileTextIcon className={iconClassName} />;
    case "code":
      return <FileCodeIcon className={iconClassName} />;
    case "binary":
      return <FileTextIcon className={iconClassName} />;
    default:
      return <FileTextIcon className={iconClassName} />;
  }
}

function entryIconColorClassName(
  visualKind: ReturnType<typeof resolveWorkspaceFileVisualKind>,
  isAppBundle: boolean
): string {
  if (isAppBundle) {
    return "text-[var(--text-tertiary)]";
  }
  return visualKind === "directory"
    ? "text-[var(--rich-text-mention-file)]"
    : "text-[var(--text-tertiary)]";
}
