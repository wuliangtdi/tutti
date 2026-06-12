import { InstantiationService, ServiceRegistry } from "@zk-tech/bedrock/di";
import {
  isAnalyticsDebugAvailable,
  registerAnalyticsDebugServices
} from "@renderer/features/analytics-debug";
import {
  registerReporterServices,
  startPredefinePageviewAnalytics
} from "@renderer/features/analytics";
import { registerAppUpdateServices } from "@renderer/features/app-update";
import { registerDesktopPreferencesServices } from "@renderer/features/desktop-preferences";
import { registerRichTextAtServices } from "@renderer/features/rich-text-at";
import { registerWorkspaceAgentServices } from "@renderer/features/workspace-agent";
import { registerWorkspaceAppCenterServices } from "@renderer/features/workspace-app-center";
import { registerWorkspaceCatalogServices } from "@renderer/features/workspace-catalog";
import { registerWorkspaceFileManagerServices } from "@renderer/features/workspace-file-manager";
import { registerWorkspaceUserProjectServices } from "@renderer/features/workspace-user-project";
import {
  createAgentProviderTerminalCommandRunner,
  registerWorkspaceWorkbenchServices
} from "@renderer/features/workspace-workbench";
import { INotificationService } from "@tutti-os/ui-notifications";
import { createToastNotificationService } from "@renderer/lib/notificationService";
import {
  createCompositeNotificationService,
  createDefaultBackgroundNotificationPolicy,
  createDocumentNotificationVisibilityState,
  createHostBackgroundNotificationPresenter
} from "@renderer/lib/compositeNotificationService";
import { installRendererDiagnostics } from "@renderer/lib/rendererDiagnostics";
import { resolveDesktopEnvironment } from "@renderer/platform/desktop/resolveDesktopEnvironment";
import { createDesktopNextopdEventStreamClient } from "@renderer/platform/nextopd/createDesktopNextopdEventStreamClient";
import { createDesktopNextopdClient } from "@renderer/platform/nextopd/createDesktopNextopdClient";
import { startDesktopDaemonConnectionAnalytics } from "@renderer/platform/nextopd/desktopDaemonConnectionAnalytics";

export interface WorkspaceWindowContainerResult {
  container: InstantiationService;
  environmentMode: "desktop" | "web";
  startupWorkspaceID: string | null;
}

export function createWorkspaceWindowContainer(): WorkspaceWindowContainerResult {
  const environment = resolveDesktopEnvironment(window.nextop);
  const desktopApi = environment.desktopApi;
  const nextopdClient = createDesktopNextopdClient(desktopApi.runtime);
  const nextopdEventStreamClient = createDesktopNextopdEventStreamClient(
    desktopApi.runtime
  );
  const registry = new ServiceRegistry();
  const foregroundNotificationService = createToastNotificationService();
  const notificationService = createCompositeNotificationService({
    background: createHostBackgroundNotificationPresenter(
      desktopApi.host.notifications
    ),
    foreground: {
      show(message) {
        foregroundNotificationService.notify(message);
      }
    },
    policy: createDefaultBackgroundNotificationPolicy(),
    visibility: createDocumentNotificationVisibilityState({
      hasFocus: () => document.hasFocus(),
      visibilityState: () => document.visibilityState
    })
  });
  registry.registerInstance(INotificationService, notificationService);
  const analyticsDebugAvailable = isAnalyticsDebugAvailable({
    isDev: import.meta.env.DEV
  });
  registerAnalyticsDebugServices(registry, {
    available: analyticsDebugAvailable,
    eventStreamClient: nextopdEventStreamClient
  });
  const reporterService = registerReporterServices(registry, {
    nextopdClient
  });
  const predefinePageviewAnalytics = startPredefinePageviewAnalytics({
    reporterService
  });
  installRendererDiagnostics(
    desktopApi.runtime,
    "workspace-renderer",
    reporterService
  );
  registerDesktopPreferencesServices(
    registry,
    nextopdClient,
    nextopdEventStreamClient
  );
  const daemonConnectionAnalytics = startDesktopDaemonConnectionAnalytics({
    eventStreamClient: nextopdEventStreamClient,
    reporterService
  });
  let releasedWindowAnalytics = false;
  const releaseWindowAnalytics = () => {
    if (releasedWindowAnalytics) {
      return;
    }
    releasedWindowAnalytics = true;
    window.removeEventListener("beforeunload", releaseWindowAnalytics);
    predefinePageviewAnalytics.dispose();
    daemonConnectionAnalytics.release();
  };
  window.addEventListener("beforeunload", releaseWindowAnalytics);
  registerAppUpdateServices(registry, desktopApi, {
    reporterService
  });
  registerWorkspaceCatalogServices(registry, {
    hostApi: {
      platform: desktopApi.platform.os,
      workspace: desktopApi.host.workspace
    },
    nextopdClient,
    reporterService
  });
  registerWorkspaceFileManagerServices(registry, {
    hostFilesApi: desktopApi.host.files,
    nextopdClient,
    platformApi: desktopApi.platform,
    reporterService
  });
  registerRichTextAtServices(registry, {
    nextopdClient
  });
  const workspaceUserProjectService = registerWorkspaceUserProjectServices(
    registry,
    {
      hostFilesApi: desktopApi.host.files,
      nextopdClient,
      notifications: notificationService,
      platformApi: desktopApi.platform,
      workspaceId: environment.startupWorkspaceID ?? "__default__"
    }
  );
  registerWorkspaceAgentServices(registry, {
    eventStreamClient: nextopdEventStreamClient,
    hostFilesApi: desktopApi.host.files,
    nextopdClient,
    reporterService,
    runtimeApi: desktopApi.runtime,
    terminalCommandRunner: createAgentProviderTerminalCommandRunner(
      desktopApi.runtime
    ),
    workspaceUserProjectService
  });
  registerWorkspaceAppCenterServices(registry, {
    eventStreamClient: nextopdEventStreamClient,
    hostFilesApi: desktopApi.host.files,
    hostWorkspaceApi: desktopApi.host.workspace,
    nextopdClient,
    reporterService,
    runtimeApi: desktopApi.runtime
  });
  registerWorkspaceWorkbenchServices(registry, {
    browserApi: desktopApi.browser,
    developerApi: desktopApi.developer,
    dockPreviewCacheApi: desktopApi.dockPreviewCache,
    eventStreamClient: nextopdEventStreamClient,
    hostFilesApi: desktopApi.host.files,
    hostNotificationsApi: desktopApi.host.notifications,
    hostWindowApi: desktopApi.host.window,
    hostWorkspaceApi: desktopApi.host.workspace,
    nextopdClient,
    platformApi: desktopApi.platform,
    reporterService,
    runtimeApi: desktopApi.runtime,
    wallpaperApi: desktopApi.wallpaper
  });
  return {
    container: new InstantiationService(registry.makeCollection()),
    environmentMode: environment.mode,
    startupWorkspaceID: environment.startupWorkspaceID
  };
}
