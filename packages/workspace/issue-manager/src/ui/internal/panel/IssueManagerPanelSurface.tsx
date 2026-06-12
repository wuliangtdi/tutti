import { type JSX, type ReactNode } from "react";
import { Button, FileCreateIcon } from "@tutti-os/ui-system";

export function IssueManagerEmptyIllustration({
  src
}: {
  src: string;
}): JSX.Element {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="h-[84px] w-[84px] object-contain"
      decoding="async"
      draggable={false}
      src={src}
    />
  );
}

export function IssueManagerTaskEmptyState({
  body,
  ctaLabel,
  illustration,
  onCreate,
  title
}: {
  body: string;
  ctaLabel: string;
  illustration?: ReactNode;
  onCreate: () => void;
  title: string;
}): JSX.Element {
  return (
    <div className="flex min-h-[320px] items-center justify-center px-6 py-10 text-center">
      <div className="grid max-w-[420px] justify-items-center gap-2">
        {illustration ?? null}
        <p className="text-[15px] font-semibold leading-[1.35] text-[var(--text-primary)]">
          {title}
        </p>
        <p className="max-w-[420px] text-[15px] leading-[1.3] text-[var(--text-secondary)]">
          {body}
        </p>
        <Button
          className="mt-2 gap-2 px-[18px]"
          size="dialog"
          type="button"
          onClick={onCreate}
        >
          <FileCreateIcon size={16} />
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}

export function IssueManagerPaneLoadingState(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      <div className="h-6 w-28 rounded-full bg-muted" />
      <div className="h-12 w-2/3 rounded-full bg-muted" />
      <div className="rounded-[28px] border border-border/70 bg-transparent px-5 py-5">
        <div className="h-4 w-24 rounded-full bg-muted" />
        <div className="mt-5 h-4 w-full rounded-full bg-muted" />
        <div className="mt-3 h-4 w-11/12 rounded-full bg-muted" />
        <div className="mt-3 h-4 w-10/12 rounded-full bg-muted" />
      </div>
      <div className="rounded-[24px] border border-border/70 bg-transparent px-5 py-5">
        <div className="h-4 w-32 rounded-full bg-muted" />
        <div className="mt-5 h-4 w-full rounded-full bg-muted" />
        <div className="mt-3 h-4 w-9/12 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function IssueManagerTaskListLoadingState(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg border border-border/70 bg-transparent"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          className="border-b border-border/70 px-3.5 py-3.5 last:border-b-0"
          key={index}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-2/5 rounded-full bg-muted" />
            <div className="h-3.5 w-20 rounded-full bg-muted" />
          </div>
          <div className="mt-3 h-3.5 w-full rounded-full bg-muted" />
          <div className="mt-2 h-3.5 w-4/5 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function IssueManagerTaskDrawerLoadingState(): JSX.Element {
  return (
    <div aria-hidden="true" className="grid gap-5">
      <div className="h-12 w-full rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-10 rounded-xl bg-muted" />
        <div className="h-10 rounded-xl bg-muted" />
      </div>
      <div className="rounded-[24px] border border-border/70 bg-transparent px-4 py-4">
        <div className="h-4 w-24 rounded-full bg-muted" />
        <div className="mt-4 h-4 w-full rounded-full bg-muted" />
        <div className="mt-3 h-4 w-11/12 rounded-full bg-muted" />
        <div className="mt-3 h-4 w-9/12 rounded-full bg-muted" />
      </div>
    </div>
  );
}
