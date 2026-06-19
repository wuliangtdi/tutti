import assert from "node:assert/strict";
import test from "node:test";
import type { TuttidClient } from "@tutti-os/client-tuttid-ts";
import type { ReferenceScope } from "@tutti-os/workspace-file-reference/contracts";
import type { ReferenceListItem } from "@tutti-os/workspace-file-reference/core";
import { createIssueReferenceListBackend } from "./issueReferenceListBackend.ts";
import { createAppReferenceListBackend } from "./appReferenceListBackend.ts";

const scope: ReferenceScope = { workspaceId: "workspace-1" };

function firstGroupId(items: ReferenceListItem[]): string {
  const first = items[0];
  return first && first.type === "group" ? first.id : "";
}

// 议题 backend:topic → issue 的 group id 编码里带了 topicId,describeHandle 应据此
// 还原出 { source:"task", id: topicId, groupId: issueId }(顶层=topic、子级=issue)。
test("issue backend describeHandle round-trips topic + issue handles", async () => {
  const tuttidClient = {
    listWorkspaceIssueTopics: async () => ({
      topics: [{ topicId: "topic-1", title: "Launch" }]
    }),
    listWorkspaceIssues: async () => ({
      issues: [{ issueId: "issue-9", title: "Fix login" }],
      nextPageToken: null
    }),
    getWorkspaceIssueDetail: async () => ({
      issue: { title: "Fix login" },
      latestOutputs: []
    })
  } as unknown as TuttidClient;
  const backend = createIssueReferenceListBackend(tuttidClient);

  const topics = await backend.list(scope, { parentGroupId: null });
  const topicGroupId = firstGroupId(topics.items);
  const issues = await backend.list(scope, { parentGroupId: topicGroupId });
  const issueGroupId = firstGroupId(issues.items);

  assert.deepEqual(backend.describeHandle?.(topicGroupId), {
    source: "task",
    id: "topic-1"
  });
  assert.deepEqual(backend.describeHandle?.(issueGroupId), {
    source: "task",
    id: "topic-1",
    groupId: "issue-9"
  });
});

// 应用 backend:根层是 app group,describeHandle 还原出 { source:"app", id: appId }。
test("app backend describeHandle resolves the app handle", async () => {
  const tuttidClient = {
    listWorkspaceApps: async () => ({
      apps: [
        {
          appId: "app-7",
          displayName: "Design",
          installed: true,
          enabled: true,
          references: { listSupported: true, searchSupported: false }
        }
      ]
    })
  } as unknown as TuttidClient;
  const backend = createAppReferenceListBackend(tuttidClient);

  const apps = await backend.list(scope, { parentGroupId: null });
  const appGroupId = firstGroupId(apps.items);

  assert.deepEqual(backend.describeHandle?.(appGroupId), {
    source: "app",
    id: "app-7"
  });
});

// 点击 chip 一键定位:locate 产出的「分组 id 路径」叶子,经 describeHandle 反解应回到原句柄。
test("app locate to a group round-trips via describeHandle", async () => {
  const backend = createAppReferenceListBackend({} as unknown as TuttidClient);
  const path = await backend.locate?.(scope, {
    appId: "app-7",
    groupId: "g-9"
  });
  assert.equal((path ?? []).length, 2); // [app 根, app 子分组]
  const leaf = path?.[path.length - 1] ?? "";
  assert.deepEqual(backend.describeHandle?.(leaf), {
    source: "app",
    id: "app-7",
    groupId: "g-9"
  });
});

test("issue locate to an issue round-trips topic + issue via describeHandle", async () => {
  const backend = createIssueReferenceListBackend(
    {} as unknown as TuttidClient
  );
  const path = await backend.locate?.(scope, {
    issueId: "issue-9",
    topicId: "topic-1"
  });
  assert.equal((path ?? []).length, 2); // [topic, issue]
  const leaf = path?.[path.length - 1] ?? "";
  assert.deepEqual(backend.describeHandle?.(leaf), {
    source: "task",
    id: "topic-1",
    groupId: "issue-9"
  });
});

test("issue locate to a whole topic resolves to the topic group", async () => {
  const backend = createIssueReferenceListBackend(
    {} as unknown as TuttidClient
  );
  const path = await backend.locate?.(scope, { topicId: "topic-1" });
  assert.equal((path ?? []).length, 1);
  assert.deepEqual(backend.describeHandle?.(path?.[0] ?? ""), {
    source: "task",
    id: "topic-1"
  });
});
