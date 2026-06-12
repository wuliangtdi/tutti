import type { JSX } from "react";
import { Button, DirectoryIcon, FileIcon } from "@tutti-os/ui-system";
import type {
  IssueManagerContextRef,
  IssueManagerFileReference
} from "../../../contracts/index.ts";
import type { IssueManagerI18nRuntime } from "../../../i18n/issueManagerI18n.ts";

export function IssueManagerContextSection({
  copy,
  emptyLabel,
  onAdd,
  onOpen,
  onRemove,
  refs
}: {
  copy: IssueManagerI18nRuntime;
  emptyLabel: string;
  onAdd: () => void;
  onOpen: (reference: IssueManagerFileReference) => Promise<void>;
  onRemove: (ref: IssueManagerContextRef) => Promise<void>;
  refs: readonly IssueManagerContextRef[];
}): JSX.Element {
  return (
    <section className="rounded-lg border border-border-1 bg-transparent px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">
          {copy.t("labels.contextReferences")}
        </h4>
        <Button
          className="px-3"
          size="dialog"
          type="button"
          variant="secondary"
          onClick={onAdd}
        >
          {copy.t("actions.addReferences")}
        </Button>
      </div>
      {refs.length === 0 ? (
        <p className="text-[13px] leading-5 text-[var(--text-secondary)]">
          {emptyLabel}
        </p>
      ) : (
        <div className="grid gap-2.5">
          {refs.map((ref) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-2)] bg-transparent px-3.5 py-3"
              key={ref.contextRefId}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                type="button"
                onClick={() => {
                  void onOpen({
                    displayName: ref.displayName,
                    kind: ref.path.endsWith("/") ? "folder" : "file",
                    path: ref.path
                  });
                }}
              >
                {ref.path.endsWith("/") ? (
                  <DirectoryIcon
                    className="shrink-0 text-[var(--text-secondary)]"
                    size={16}
                  />
                ) : (
                  <FileIcon
                    className="shrink-0 text-[var(--text-secondary)]"
                    size={16}
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold leading-5 text-[var(--text-primary)]">
                    {ref.displayName}
                  </span>
                  <span className="block truncate text-[11px] leading-[1.55] text-[var(--text-secondary)]">
                    {ref.path}
                  </span>
                </span>
              </button>
              <Button
                className="h-7 rounded-md px-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  void onRemove(ref);
                }}
              >
                {copy.t("actions.removeReference")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
