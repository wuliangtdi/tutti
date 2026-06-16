import assert from "node:assert/strict";
import test from "node:test";
import { RichTextAtSearchController } from "./RichTextAtSearchController.ts";
import type { RichTextAtProvider } from "../types/at.ts";

test("RichTextAtSearchController debounces and applies the latest result", async () => {
  const queries: string[] = [];
  const provider = createProvider((keyword) => {
    queries.push(keyword);
    return [{ id: keyword }];
  });
  const controller = new RichTextAtSearchController({
    debounceMs: 0,
    richTextAtProviders: [provider],
    providerGroups: [{ id: "files", label: "Files", providerIds: ["file"] }]
  });

  controller.updateQuery({ query: "a" });
  controller.updateQuery({ query: "ab" });
  await tick();

  assert.deepEqual(queries, ["ab"]);
  assert.equal(controller.getState().status, "ready");
  assert.deepEqual(
    controller.getState().groups[0]?.items.map((item) => item.label),
    ["ab"]
  );
});

test("RichTextAtSearchController drops stale in-flight results", async () => {
  const pending = new Map<string, Deferred<readonly { id: string }[]>>();
  const provider = createProvider((keyword) => {
    const deferred = createDeferred<readonly { id: string }[]>();
    pending.set(keyword, deferred);
    return deferred.promise;
  });
  const controller = new RichTextAtSearchController({
    debounceMs: 0,
    richTextAtProviders: [provider],
    providerGroups: [{ id: "files", label: "Files", providerIds: ["file"] }]
  });

  controller.updateQuery({ query: "a" });
  await tick();
  controller.updateQuery({ query: "ab" });
  await tick();

  pending.get("ab")?.resolve([{ id: "ab" }]);
  await tick();
  pending.get("a")?.resolve([{ id: "a" }]);
  await tick();

  assert.equal(controller.getState().status, "ready");
  assert.deepEqual(
    controller.getState().groups[0]?.items.map((item) => item.label),
    ["ab"]
  );
});

test("RichTextAtSearchController filters and expands groups", async () => {
  const provider = createProvider(() => [
    { id: "a" },
    { id: "b" },
    { id: "c" }
  ]);
  const controller = new RichTextAtSearchController({
    debounceMs: 0,
    pageSize: 2,
    richTextAtProviders: [provider],
    providerGroups: [
      { id: "files", label: "Files", providerIds: ["file"], filterId: "file" }
    ],
    filterTabs: [
      { id: "all", label: "All" },
      { id: "file", label: "Files" }
    ]
  });

  controller.updateQuery({ query: "a" });
  await tick();
  controller.setFilter("file");
  assert.equal(controller.getState().filter, "file");
  assert.equal(controller.getState().groups[0]?.visibleCount, 2);
  controller.expandGroup("files");
  assert.equal(controller.getState().groups[0]?.visibleCount, 3);
});

function createProvider(
  query: (
    keyword: string
  ) => readonly { id: string }[] | Promise<readonly { id: string }[]>
): RichTextAtProvider {
  return {
    id: "file",
    query: (input) => query(input.keyword),
    getItemKey: (item) => fakeItemId(item),
    getItemLabel: (item) => fakeItemId(item),
    toInsertResult: (item) => ({ kind: "text", text: fakeItemId(item) })
  };
}

function fakeItemId(item: unknown): string {
  if (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as { id?: unknown }).id === "string"
  ) {
    return (item as { id: string }).id;
  }
  throw new TypeError("Expected a fake rich-text @ item with an id");
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
