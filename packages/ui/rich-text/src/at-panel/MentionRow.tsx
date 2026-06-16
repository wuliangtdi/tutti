import { Badge, StatusDot, cn } from "@tutti-os/ui-system";
import type {
  MentionRowAppItem,
  MentionRowFileItem,
  MentionRowItem,
  MentionRowSessionItem,
  MentionRowStatusTag
} from "./mentionRowTypes.ts";
import { mentionStatusBadgeClassName } from "./mentionStatusTone.ts";

/**
 * Render the inner content of a single `@`-mention palette row from a
 * fully-resolved {@link MentionRowItem}. The surrounding option button / active
 * state is provided by the shared `MentionPalette` shell; this renders only the
 * row body. The markup is reproduced verbatim from the agent composer so the
 * DOM/classes stay byte-identical across every mention surface.
 */
export function renderMentionRow(item: MentionRowItem): React.ReactNode {
  if (item.kind === "file") {
    return <MentionFileRow item={item} />;
  }

  if (item.kind === "session") {
    return (
      <span className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          <MentionSessionAvatarStack item={item} />
          <span className="min-w-0 truncate text-[13px] font-semibold leading-[16px] text-[var(--text-primary)]">
            <MentionSessionTitle item={item} />
          </span>
        </span>
        {item.statusTag ? (
          <MentionStatusBadge statusTag={item.statusTag} />
        ) : null}
      </span>
    );
  }

  if (item.kind === "app") {
    return (
      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
        <MentionWorkspaceAppIcon iconUrl={item.iconUrl} />
        <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
          <span className="min-w-0 max-w-[40%] shrink-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
            {item.name}
          </span>
          {item.description ? (
            <span className="min-w-0 flex-1 truncate text-[13px] font-normal text-[var(--text-secondary)]">
              {item.description}
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  if (item.kind === "app-factory") {
    return (
      <span className="grid min-w-0 overflow-hidden gap-1">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {item.name}
        </span>
      </span>
    );
  }

  return (
    <span className="grid min-w-0 overflow-hidden gap-1">
      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {item.title}
        </span>
        {item.statusTag ? (
          <MentionStatusBadge statusTag={item.statusTag} />
        ) : null}
      </span>
      {item.creatorName ? (
        <span className="truncate text-[13px] font-normal text-[var(--text-secondary)]">
          {item.creatorName}
        </span>
      ) : null}
    </span>
  );
}

function MentionFileRow({
  item
}: {
  item: MentionRowFileItem;
}): React.JSX.Element {
  return (
    <span
      className="flex min-w-0 items-center gap-2"
      data-agent-file-mention="true"
      data-agent-mention-kind="file"
      {...(item.entryKind
        ? { "data-agent-file-entry-kind": item.entryKind }
        : {})}
      data-agent-file-visual-kind={item.visualKind}
      {...(item.mentionNavigation
        ? { "data-agent-mention-navigation": item.mentionNavigation }
        : {})}
    >
      <MentionFileIcon item={item} />
      <span className="flex min-w-0 items-baseline gap-1 overflow-hidden">
        <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {item.name}
        </span>
        {item.childCountLabel ? (
          <span className="shrink-0 text-[13px] font-normal text-[var(--text-secondary)]">
            {item.childCountLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function MentionFileIcon({
  item
}: {
  item: MentionRowFileItem;
}): React.JSX.Element {
  const thumbnailUrl =
    item.visualKind === "image" ? item.thumbnailUrl?.trim() || "" : "";
  if (thumbnailUrl) {
    return (
      <span
        className="agent-gui-node__mention-file-thumb"
        data-agent-mention-file-thumb="true"
        aria-hidden="true"
      >
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span
      className="agent-gui-node__mention-file-icon"
      data-agent-file-visual-kind={item.visualKind}
      aria-hidden="true"
    />
  );
}

function MentionWorkspaceAppIcon({
  iconUrl
}: {
  iconUrl?: string | null;
}): React.JSX.Element {
  const normalizedIconUrl = iconUrl?.trim() ?? "";
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-block text-[var(--text-secondary)]"
      data-agent-mention-app-icon="true"
      data-workspace-app-icon="true"
      aria-hidden="true"
    >
      {normalizedIconUrl ? (
        <img
          src={normalizedIconUrl}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span className="tsh-agent-object-token__kind-icon h-4 w-4" />
      )}
    </span>
  );
}

function MentionSessionAvatarStack({
  item
}: {
  item: MentionRowSessionItem;
}): React.JSX.Element {
  const userAvatarUrl = item.userAvatarUrl?.trim() ?? "";
  const placeholderUrl = item.userAvatarPlaceholderUrl;
  const userImageUrl = userAvatarUrl || placeholderUrl;
  return (
    <span
      className="relative isolate block h-5 w-9 shrink-0"
      aria-hidden="true"
    >
      <span
        className="absolute left-0 top-0 z-0 grid h-5 w-5 overflow-hidden rounded-full bg-block"
        data-agent-mention-user-avatar="true"
      >
        <img
          src={userImageUrl}
          alt=""
          className={cn(
            "h-full w-full object-cover",
            !userAvatarUrl &&
              "workspace-agents-status-panel__avatar-img--user-placeholder"
          )}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={(event) => {
            if (event.currentTarget.dataset.fallbackAvatarApplied === "true") {
              return;
            }
            event.currentTarget.dataset.fallbackAvatarApplied = "true";
            event.currentTarget.src = placeholderUrl;
            event.currentTarget.classList.add(
              "workspace-agents-status-panel__avatar-img--user-placeholder"
            );
          }}
        />
      </span>
      <span
        className="absolute left-4 top-0 z-10 grid h-5 w-5 overflow-hidden rounded-full bg-block"
        data-agent-mention-agent-avatar="true"
      >
        <img
          src={item.agentIconUrl}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      </span>
    </span>
  );
}

function MentionSessionTitle({
  item
}: {
  item: MentionRowSessionItem;
}): React.JSX.Element {
  return (
    <>
      <span className="text-[13px] leading-[16px]">{item.participant}</span>
      <span className="text-[13px] font-normal leading-[16px] text-[var(--text-secondary)]">
        {" "}
        {item.summary ?? ""}
      </span>
    </>
  );
}

function MentionStatusBadge({
  statusTag
}: {
  statusTag: MentionRowStatusTag;
}): React.JSX.Element {
  if (statusTag.variant === "issue") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "shrink-0 text-[13px]",
          mentionStatusBadgeClassName({
            tone: statusTag.tone,
            variant: "issue"
          })
        )}
        data-agent-mention-status-tag="true"
        {...(statusTag.dataStatus
          ? { "data-status": statusTag.dataStatus }
          : {})}
      >
        {statusTag.label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[4px] px-2 text-[11px] font-semibold leading-none",
        mentionStatusBadgeClassName({
          tone: statusTag.tone,
          variant: "activity"
        })
      )}
      data-agent-mention-status-tag="true"
      {...(statusTag.dataStatus ? { "data-status": statusTag.dataStatus } : {})}
      data-tone={statusTag.tone}
      title={statusTag.label}
    >
      <StatusDot
        tone={statusTag.tone}
        pulse={statusTag.pulse ?? false}
        size="xs"
        title={statusTag.label}
      />
      <span>{statusTag.label}</span>
    </Badge>
  );
}
