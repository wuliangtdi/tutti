import type { TuttidClient } from "@tutti-os/client-tuttid-ts";
import type { DesktopHostFilesApi } from "@preload/types";
import type { IAccountService } from "../accountService.interface";
import { createAccountStore } from "./accountStore.ts";

const loginStatusPollMs = 1000;

export interface AccountServiceDependencies {
  hostFilesApi: Pick<DesktopHostFilesApi, "openExternal">;
  tuttidClient: Pick<
    TuttidClient,
    | "getAccountLoginStatus"
    | "getAccountUserInfo"
    | "logoutAccount"
    | "startAccountLogin"
  >;
}

export class AccountService implements IAccountService {
  readonly _serviceBrand: undefined;
  readonly store = createAccountStore();

  private readonly dependencies: AccountServiceDependencies;

  constructor(dependencies: AccountServiceDependencies) {
    this.dependencies = dependencies;
  }

  async refreshUserInfo(): Promise<void> {
    this.store.loading = true;
    this.store.error = null;
    try {
      this.store.user =
        await this.dependencies.tuttidClient.getAccountUserInfo();
    } catch (error) {
      this.store.error = readAccountError(error);
    } finally {
      this.store.loading = false;
    }
  }

  async startLogin(): Promise<void> {
    if (this.store.signingIn) {
      return;
    }
    this.store.signingIn = true;
    this.store.error = null;
    this.store.loginStatus = "pending";
    try {
      const started = await this.dependencies.tuttidClient.startAccountLogin();
      await this.dependencies.hostFilesApi.openExternal(started.login_url);
      await this.pollLoginStatus(started.attempt_id, started.expires_at);
      await this.refreshUserInfo();
    } catch (error) {
      this.store.error = readAccountError(error);
    } finally {
      this.store.signingIn = false;
    }
  }

  async logout(): Promise<void> {
    if (this.store.signingOut) {
      return;
    }
    this.store.signingOut = true;
    this.store.error = null;
    try {
      await this.dependencies.tuttidClient.logoutAccount();
      this.store.user = null;
    } catch (error) {
      this.store.error = readAccountError(error);
    } finally {
      this.store.signingOut = false;
    }
  }

  private async pollLoginStatus(
    attemptID: string,
    expiresAt: number
  ): Promise<void> {
    while (Date.now() <= expiresAt) {
      const status =
        await this.dependencies.tuttidClient.getAccountLoginStatus(attemptID);
      this.store.loginStatus = status.status;
      if (status.status === "completed") {
        return;
      }
      if (status.status === "failed" || status.status === "expired") {
        throw new Error(status.error ?? status.status);
      }
      await delay(loginStatusPollMs);
    }
    throw new Error("Login timed out");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readAccountError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Account request failed.";
}
