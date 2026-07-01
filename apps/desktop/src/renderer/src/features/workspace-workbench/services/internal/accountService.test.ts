import assert from "node:assert/strict";
import test from "node:test";
import { AccountService } from "./accountService.ts";

test("AccountService opens login URL and refreshes user after completion", async () => {
  const opened: string[] = [];
  const service = new AccountService({
    hostFilesApi: {
      async openExternal(url) {
        opened.push(url);
      }
    },
    tuttidClient: {
      async startAccountLogin() {
        return {
          attempt_id: "attempt-1",
          expires_at: Date.now() + 10_000,
          login_url: "https://tutti.sh/auth/login?state=test"
        };
      },
      async getAccountLoginStatus() {
        return {
          attempt_id: "attempt-1",
          expires_at: Date.now() + 10_000,
          status: "completed" as const
        };
      },
      async getAccountUserInfo() {
        return {
          user_id: "user-1",
          name: "Tutti User",
          email: "user@example.com"
        };
      },
      async logoutAccount() {}
    }
  });

  await service.startLogin();

  assert.deepEqual(opened, ["https://tutti.sh/auth/login?state=test"]);
  assert.equal(service.store.user?.user_id, "user-1");
  assert.equal(service.store.signingIn, false);
});
