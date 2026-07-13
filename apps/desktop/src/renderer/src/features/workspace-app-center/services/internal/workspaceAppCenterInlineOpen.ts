import type { IWorkspaceAppCenterService } from "../workspaceAppCenterService.interface";

type WorkspaceAppCenterInlineOpenService = Pick<
  IWorkspaceAppCenterService,
  "getViewState" | "prepareAppLaunch" | "setViewState"
>;

export async function openWorkspaceAppInline(input: {
  appId: string;
  service: WorkspaceAppCenterInlineOpenService;
  workspaceId: string;
}): Promise<void> {
  input.service.setViewState({
    state: { openAppId: input.appId },
    workspaceId: input.workspaceId
  });
  const app = await input.service.prepareAppLaunch({
    appId: input.appId,
    workspaceId: input.workspaceId
  });
  if (
    !app &&
    input.service.getViewState(input.workspaceId).openAppId === input.appId
  ) {
    input.service.setViewState({
      state: { openAppId: null },
      workspaceId: input.workspaceId
    });
  }
}
