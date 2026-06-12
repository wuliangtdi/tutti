import type * as React from "react";
import { useCallback, useEffect } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CapabilityIcon,
  HealthIcon,
  LoadingIcon,
  WarningLinedIcon,
  NextopMark,
  PlatformIcon,
  Separator
} from "@tutti-os/ui-system";
import { useWorkspaceCatalogService } from "@renderer/features/workspace-catalog";
import { useTranslation } from "@renderer/i18n";
import { cn, formatTimestamp } from "@renderer/lib/format";

export interface WorkspaceOverviewProps {
  headerSlot?: React.ReactNode;
  routeView: string;
  workspaceID: string | null;
}

export function WorkspaceOverview({
  headerSlot,
  routeView,
  workspaceID
}: WorkspaceOverviewProps) {
  const { service, state } = useWorkspaceCatalogService();
  const { t } = useTranslation();
  const loadWorkspaceWindow = useCallback(() => {
    void service.loadWorkspaceWindow(workspaceID, routeView);
  }, [routeView, service, workspaceID]);

  useEffect(() => {
    loadWorkspaceWindow();
  }, [loadWorkspaceWindow]);

  if (state.status === "missing-context") {
    return (
      <WorkspaceFallbackState
        description={t("workspace.fallback.missingContextDescription")}
        title={t("workspace.fallback.missingContextTitle")}
      />
    );
  }

  if (state.status === "unavailable") {
    return (
      <WorkspaceFallbackState
        description={
          state.workspaceError ?? t("workspace.fallback.loadingDescription")
        }
        onRetry={loadWorkspaceWindow}
        title={t("workspace.fallback.unavailableTitle")}
        tone="destructive"
      />
    );
  }

  if (state.status === "loading" || !state.workspace) {
    return (
      <WorkspaceFallbackState
        description={t("workspace.fallback.loadingDescription")}
        isLoading
        title={t("workspace.fallback.loadingTitle")}
      />
    );
  }

  const workspace = state.workspace;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col gap-4">
        {headerSlot}
        <Card>
          <CardHeader className="gap-5 border-b border-border/60 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-14 items-center justify-center rounded-lg bg-transparency-block text-primary">
                  <NextopMark size={30} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Badge className="w-fit" variant="outline">
                    {t("common.workspace")}
                  </Badge>
                  <div className="space-y-1">
                    <CardTitle className="truncate text-3xl tracking-tight sm:text-4xl">
                      {t("common.workspace")}
                    </CardTitle>
                    <CardDescription className="truncate text-[15px] text-muted-foreground">
                      {workspace.id}
                    </CardDescription>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <MetaBadge
                  icon={<PlatformIcon className="size-4" />}
                  label={t("workspace.meta.platformLabel")}
                  value={state.platform}
                />
                <HealthBadge status={state.health} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 pt-5">
            <section className="grid gap-3 lg:grid-cols-3">
              <InfoCard
                description={t("workspace.info.idDescription")}
                label={t("workspace.info.idLabel")}
                value={workspace.id}
              />
              <InfoCard
                description={t("workspace.info.lastOpenedDescription")}
                label={t("workspace.info.lastOpenedLabel")}
                value={formatTimestamp(workspace.lastOpenedAt)}
              />
              <InfoCard
                description={t("workspace.info.rendererRoleDescription")}
                label={t("workspace.info.rendererRoleLabel")}
                value={t("workspace.info.rendererRoleValue")}
              />
            </section>

            <Separator />

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <CapabilityIcon className="size-4 text-primary" />
                    {t("workspace.ready.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("workspace.ready.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-[13px] text-muted-foreground">
                  <div className="rounded-lg border border-border/70 bg-transparency-block px-4 py-4">
                    {t("workspace.ready.panelOne")}
                  </div>
                  <div className="rounded-lg border border-border/70 bg-transparency-block px-4 py-4">
                    {t("workspace.ready.panelTwo")}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HealthIcon className="size-4 text-primary" />
                    {t("workspace.runtime.statusTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("workspace.runtime.statusDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <StatusPanel
                    description={
                      state.health
                        ? t("workspace.runtime.connectedDescription", {
                            service: state.health.service
                          })
                        : state.healthError ||
                          t("workspace.runtime.pendingDescription")
                    }
                    title={
                      state.health
                        ? state.health.status
                        : t("common.unreachable")
                    }
                    tone={state.health ? "success" : "destructive"}
                  />
                  <StatusPanel
                    description={t("workspace.routeDescription")}
                    title={`view=${state.routeView || "workspace"}`}
                    tone="neutral"
                  />
                </CardContent>
              </Card>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

interface WorkspaceFallbackStateProps {
  description: string;
  isLoading?: boolean;
  onRetry?: () => void;
  title: string;
  tone?: "default" | "destructive";
}

function WorkspaceFallbackState({
  description,
  isLoading = false,
  onRetry,
  title,
  tone = "default"
}: WorkspaceFallbackStateProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl items-center justify-center">
        <div className="flex max-w-3xl flex-col items-center text-center">
          <div
            className={cn(
              "text-primary",
              tone === "destructive" && "text-[var(--state-danger)]"
            )}
          >
            {isLoading ? (
              <LoadingIcon className="size-9 animate-spin" />
            ) : (
              <WarningLinedIcon className="size-9" />
            )}
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <CardTitle className="text-3xl tracking-tight">{title}</CardTitle>
            <CardDescription className="text-[15px] text-muted-foreground">
              {description}
            </CardDescription>
            {onRetry ? (
              <Button
                className="mt-3 h-10 rounded-lg px-4"
                type="button"
                onClick={onRetry}
              >
                {t("workspace.fallback.retryAction")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

interface MetaBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaBadge({ icon, label, value }: MetaBadgeProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-transparency-block text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-[13px] font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function HealthBadge({ status }: { status: { status: string } | null }) {
  const { t } = useTranslation();

  if (status) {
    return (
      <MetaBadge
        icon={<HealthIcon className="size-4" />}
        label={t("workspace.meta.daemonLabel")}
        value={status.status}
      />
    );
  }

  return (
    <MetaBadge
      icon={<WarningLinedIcon className="size-4" />}
      label={t("workspace.meta.daemonLabel")}
      value={t("common.unreachable")}
    />
  );
}

function InfoCard({
  description,
  label,
  value
}: {
  description: string;
  label: string;
  value: string;
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-2">
        <Badge className="w-fit" variant="outline">
          {label}
        </Badge>
        <CardTitle className="text-lg">{value}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function StatusPanel({
  description,
  title,
  tone
}: {
  description: string;
  title: string;
  tone: "destructive" | "neutral" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        tone === "success" &&
          "border-[var(--state-success)] bg-[color-mix(in_srgb,var(--state-success)_8%,transparent)] text-[var(--state-success)]",
        tone === "destructive" &&
          "border-[var(--state-danger)] bg-[var(--on-danger)] text-[var(--state-danger)]",
        tone === "neutral" &&
          "border-border/70 bg-transparency-block text-foreground"
      )}
    >
      <p className="text-[13px] font-semibold">{title}</p>
      <p
        className={cn(
          "mt-1 text-[13px]",
          tone === "neutral" ? "text-muted-foreground" : "text-current/80"
        )}
      >
        {description}
      </p>
    </div>
  );
}
