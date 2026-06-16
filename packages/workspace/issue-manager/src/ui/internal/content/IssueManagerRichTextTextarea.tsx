import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from "react";
import { RichTextAtPanel } from "@tutti-os/ui-rich-text/at-panel";
import { RichTextAtEditor } from "@tutti-os/ui-rich-text/editor";
import { Button, LinkIcon, cn } from "@tutti-os/ui-system";
import type {
  IssueManagerController,
  IssueManagerRichTextSurface
} from "../../react/index.ts";

const issueManagerRichTextTextareaBaseClassName =
  "min-h-20 w-full rounded-[8px] border border-transparent bg-[var(--transparency-block)] p-3 text-[13px] font-normal leading-[1.3] text-[var(--text-primary)] transition-[background-color,border-color,color] outline-none shadow-none placeholder:text-[var(--text-placeholder)] hover:bg-[var(--transparency-hover)] focus:bg-[var(--transparency-hover)] focus-visible:border-transparent focus-visible:bg-[var(--transparency-hover)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-[var(--transparency-block)] disabled:text-[var(--text-disabled)] disabled:opacity-100 aria-invalid:border-[var(--state-danger)] aria-invalid:bg-[var(--transparency-block)] aria-invalid:hover:bg-[var(--transparency-hover)] aria-invalid:focus:bg-[var(--transparency-hover)] aria-invalid:focus-visible:bg-[var(--transparency-hover)] aria-invalid:ring-0 aria-invalid:shadow-none";

const issueManagerRichTextPlaceholderBaseClassName =
  "min-h-20 w-full p-3 text-[13px] font-normal leading-[1.3] text-[var(--text-placeholder)]";

const ISSUE_MANAGER_RICH_AT_PANEL_ENABLED = true;
const ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS = {
  apps: "workspace-app",
  files: "file",
  issues: "workspace-issue",
  sessions: "agent-session"
} as const;

export function IssueManagerRichTextTextarea({
  controller,
  onChange,
  placeholder,
  surface,
  textareaClassName,
  value
}: {
  controller: IssueManagerController;
  onChange: (value: string) => void;
  placeholder?: string;
  surface: IssueManagerRichTextSurface;
  textareaClassName?: string;
  value: string;
}): JSX.Element {
  const providers = useMemo(
    () => controller.resolveRichTextAtProviders(surface),
    [controller, surface]
  );
  const richAtPanelConfig = useMemo(() => {
    const labels = {
      all: controller.copy.t("richTextAt.all"),
      apps: controller.copy.t("richTextAt.apps"),
      files: controller.copy.t("richTextAt.files"),
      issues: controller.copy.t("richTextAt.issues"),
      sessions: controller.copy.t("richTextAt.sessions")
    };
    return {
      filterTabs: [
        { id: "all", label: labels.all },
        { id: "file", label: labels.files },
        { id: "workspace-issue", label: labels.issues },
        { id: "agent-session", label: labels.sessions },
        { id: "workspace-app", label: labels.apps }
      ],
      providerGroups: [
        {
          id: "files",
          label: labels.files,
          providerIds: [ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.files],
          filterId: ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.files
        },
        {
          id: "issues",
          label: labels.issues,
          providerIds: [ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.issues],
          filterId: ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.issues
        },
        {
          id: "sessions",
          label: labels.sessions,
          providerIds: [ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.sessions],
          filterId: ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.sessions
        },
        {
          id: "apps",
          label: labels.apps,
          providerIds: [ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.apps],
          filterId: ISSUE_MANAGER_RICH_AT_PROVIDER_GROUP_IDS.apps
        }
      ]
    };
  }, [controller.copy]);
  const showReferenceAction = controller.canReferenceWorkspaceFiles;
  const [focusSignal, setFocusSignal] = useState(0);
  const [activeFilterId, setActiveFilterId] = useState<string>(
    richAtPanelConfig.filterTabs[0]?.id ?? "all"
  );
  // Tab/Shift+Tab cycle through every filter tab (including empty ones) with
  // wraparound, matching the agent composer's keyboard behavior.
  const cycleFilter = useCallback(
    (delta: 1 | -1) => {
      const ids = richAtPanelConfig.filterTabs.map((tab) => tab.id);
      if (ids.length === 0) {
        return;
      }
      setActiveFilterId((current) => {
        const index = ids.indexOf(current);
        const base = index >= 0 ? index : delta > 0 ? -1 : 0;
        return ids[(base + delta + ids.length) % ids.length] ?? current;
      });
    },
    [richAtPanelConfig.filterTabs]
  );
  const previousValueRef = useRef(value);
  const wasAddingReferenceRef = useRef(false);

  useEffect(() => {
    const isAddingReference =
      controller.referenceTarget?.mode === "insert" &&
      controller.referenceTarget.parentKind === surface;
    if (
      wasAddingReferenceRef.current &&
      !isAddingReference &&
      value !== previousValueRef.current
    ) {
      setFocusSignal((current) => current + 1);
    }
    wasAddingReferenceRef.current = isAddingReference;
    previousValueRef.current = value;
  }, [controller.referenceTarget, surface, value]);

  return (
    <RichTextAtEditor
      focusSignal={focusSignal}
      maxResults={8}
      minQueryLength={ISSUE_MANAGER_RICH_AT_PANEL_ENABLED ? 0 : 1}
      onCycleFilter={ISSUE_MANAGER_RICH_AT_PANEL_ENABLED ? cycleFilter : undefined}
      cycleFilterHintLabel={controller.copy.t("richTextAt.switchCategory")}
      moveSelectionHintLabel={controller.copy.t("richTextAt.switchSelection")}
      providers={providers}
      textOverrides={{
        loadingLabel: controller.copy.t("richTextAt.loading"),
        noMatchesLabel: controller.copy.t("richTextAt.noMatches"),
        removeReferenceActionLabel: controller.copy.t("actions.removeReference")
      }}
      textareaClassName={cn(
        issueManagerRichTextTextareaBaseClassName,
        textareaClassName,
        showReferenceAction && "pb-11"
      )}
      placeholderClassName={cn(
        issueManagerRichTextPlaceholderBaseClassName,
        textareaClassName,
        showReferenceAction && "pb-11"
      )}
      placeholder={placeholder}
      renderPanel={
        ISSUE_MANAGER_RICH_AT_PANEL_ENABLED
          ? (context) => (
              <RichTextAtPanel
                {...context}
                filterTabs={richAtPanelConfig.filterTabs}
                activeFilterId={activeFilterId}
                onActiveFilterChange={setActiveFilterId}
                providerContext={context.providerContext}
                providerGroups={richAtPanelConfig.providerGroups}
                providers={context.providers}
                queryKeyword={context.query.keyword}
                referencePageSize={5}
                text={{
                  ...context.text,
                  allFilterLabel: controller.copy.t("richTextAt.all"),
                  showMoreLabel: (count) =>
                    controller.copy.t("richTextAt.showMore", { count })
                }}
              />
            )
          : undefined
      }
      value={value}
      onChange={onChange}
      overlay={
        showReferenceAction ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex">
            <Button
              className="pointer-events-auto"
              size="default"
              type="button"
              variant="secondary"
              onClick={() => {
                void controller.insertReferences(surface);
              }}
            >
              <LinkIcon size={14} />
              {controller.copy.t("actions.referenceWorkspaceFiles")}
            </Button>
          </div>
        ) : null
      }
    />
  );
}
