import React from "react";
import {
  Button,
  CloseIcon,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  WarningFilledIcon,
  cn
} from "@tutti-os/ui-system";
import { translate } from "../../../i18n/index";

export function WarningDialog({
  dataTestId,
  title,
  summary,
  statusLabel,
  statusAriaLabel,
  lead,
  children,
  actions,
  onCloseClick,
  onBackdropClick,
  disableBackdropDismiss = false,
  tone = "warning",
  backdropClassName,
  dialogClassName
}: {
  dataTestId: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  statusLabel?: React.ReactNode;
  statusAriaLabel?: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  actions: React.ReactNode;
  onCloseClick?: () => void;
  onBackdropClick?: () => void;
  disableBackdropDismiss?: boolean;
  /** `warning`: amber-tint surfaces. `neutral`: standard modal panel + backdrop. */
  tone?: "warning" | "neutral";
  backdropClassName?: string;
  dialogClassName?: string;
}): React.JSX.Element {
  if (typeof document === "undefined" || !document.body) {
    return <></>;
  }

  const isNeutralTone = tone === "neutral";

  return (
    <Dialog open>
      <DialogContent
        className={cn(
          "t-modal is-open nextop-window workspace-warning-dialog nodrag tsh-desktop-no-drag",
          isNeutralTone && "workspace-warning-dialog--neutral",
          dialogClassName
        )}
        overlayClassName={cn(
          "t-modal-backdrop is-open nextop-window-backdrop workspace-warning-dialog-backdrop nodrag tsh-desktop-no-drag",
          isNeutralTone && "workspace-warning-dialog-backdrop--neutral",
          backdropClassName
        )}
        showCloseButton={false}
        data-testid={dataTestId}
        data-warning-dialog-root="true"
        data-warning-dialog-tone={tone}
        aria-label={typeof title === "string" ? title : undefined}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          if (disableBackdropDismiss) {
            return;
          }

          onBackdropClick?.();
        }}
      >
        {onCloseClick ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="workspace-warning-dialog__close h-[28px] w-[28px] min-w-[28px] rounded-[4px] p-0"
            data-warning-dialog-close="true"
            aria-label={translate("common.close")}
            onClick={onCloseClick}
          >
            <CloseIcon aria-hidden="true" />
          </Button>
        ) : null}
        <DialogHeader className="workspace-warning-dialog__header flex flex-col gap-3">
          <div
            className={cn(
              "workspace-warning-dialog__topline flex items-start justify-between gap-3",
              isNeutralTone && "gap-2"
            )}
            data-warning-dialog-topline="true"
          >
            <div
              className="workspace-warning-dialog__title-group flex min-w-0 flex-1 flex-col gap-2"
              data-warning-dialog-title-group="true"
            >
              <DialogTitle>{title}</DialogTitle>
              {summary ? (
                <p className="workspace-warning-dialog__summary m-0 text-[13px] leading-[1.45] text-muted-foreground">
                  {summary}
                </p>
              ) : null}
            </div>
            {statusLabel ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--tsh-shell-warning)_14%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tsh-shell-warning)]"
                aria-label={statusAriaLabel}
              >
                <WarningFilledIcon size={14} aria-hidden="true" />
                <span>{statusLabel}</span>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {lead ? (
          <div
            className="workspace-warning-dialog__lead text-[13px] leading-[1.45] text-muted-foreground"
            data-warning-dialog-lead="true"
          >
            {lead}
          </div>
        ) : null}
        {children ? (
          <div
            className="workspace-warning-dialog__body text-[13px] leading-[1.45] text-muted-foreground"
            data-warning-dialog-body="true"
          >
            {children}
          </div>
        ) : null}

        <div
          className="nextop-window__actions workspace-warning-dialog__actions mt-1 flex flex-wrap items-center justify-end gap-2.5"
          data-warning-dialog-actions="true"
        >
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
