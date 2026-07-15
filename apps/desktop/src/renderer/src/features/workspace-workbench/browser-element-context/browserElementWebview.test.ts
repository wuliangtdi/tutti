import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserNodeWebviewTag } from "@tutti-os/browser-node/react";
import {
  cancelBrowserElementWebviewSelection,
  executeBrowserElementWebviewScript,
  isBrowserElementWebviewReady,
  waitForBrowserElementWebviewReady
} from "./browserElementWebview.ts";

class MockBrowserElementWebview extends EventTarget {
  isConnected = true;
  ready = false;
  executedScripts: string[] = [];

  executeJavaScript<T>(script: string): Promise<T> {
    this.executedScripts.push(script);
    return Promise.resolve("selected" as T);
  }

  getWebContentsId(): number {
    if (!this.ready) {
      throw new Error(
        "The WebView must be attached to the DOM and the dom-ready event emitted"
      );
    }
    return 42;
  }
}

function asBrowserWebview(
  webview: MockBrowserElementWebview
): BrowserNodeWebviewTag {
  return webview as unknown as BrowserNodeWebviewTag;
}

test("browser element execution waits for the active webview dom-ready event", async () => {
  const mock = new MockBrowserElementWebview();
  const webview = asBrowserWebview(mock);
  const execution = executeBrowserElementWebviewScript<string>(
    webview,
    "select()",
    true
  );

  assert.deepEqual(mock.executedScripts, []);
  mock.ready = true;
  mock.dispatchEvent(new Event("dom-ready"));

  assert.equal(await execution, "selected");
  assert.deepEqual(mock.executedScripts, ["select()"]);
});

test("detached browser element webviews fail readiness without executing", async () => {
  const mock = new MockBrowserElementWebview();
  mock.isConnected = false;
  const webview = asBrowserWebview(mock);

  assert.equal(isBrowserElementWebviewReady(webview), false);
  assert.equal(await waitForBrowserElementWebviewReady(webview, 1), false);
  await assert.rejects(
    executeBrowserElementWebviewScript(webview, "select()"),
    /not ready/u
  );
  assert.deepEqual(mock.executedScripts, []);
});

test("browser element cancellation ignores a webview detached during cleanup", async () => {
  const mock = new MockBrowserElementWebview();
  mock.isConnected = false;

  await cancelBrowserElementWebviewSelection(
    asBrowserWebview(mock),
    "cancel()"
  );

  assert.deepEqual(mock.executedScripts, []);
});
