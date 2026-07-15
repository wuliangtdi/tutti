import assert from "node:assert/strict";
import test from "node:test";
import {
  browserElementSnapshotAttachmentName,
  browserElementSnapshotFormat,
  browserElementSnapshotMaxHtmlChars,
  normalizeBrowserElementSelectionResult
} from "./browserElementSnapshot.ts";

test("browser element snapshots bound content and redact secret-looking URL parameters", () => {
  const result = normalizeBrowserElementSelectionResult({
    status: "selected",
    snapshot: {
      capturedAt: "2026-07-15T00:00:00.000Z",
      page: {
        title: "Example",
        url: "https://example.com/page?token=secret&tab=main#private"
      },
      element: {
        attributes: {},
        bounds: { height: 10, width: 20, x: 1, y: 2 },
        classes: ["primary"],
        html: "x".repeat(browserElementSnapshotMaxHtmlChars + 100),
        selector: "#submit",
        styles: {},
        tagName: "BUTTON",
        text: "Submit"
      },
      viewport: { height: 800, width: 1200 }
    }
  });

  assert.equal(result?.status, "selected");
  if (result?.status !== "selected") return;
  assert.equal(result.snapshot.format, browserElementSnapshotFormat);
  assert.equal(
    result.snapshot.element.html.length,
    browserElementSnapshotMaxHtmlChars
  );
  assert.equal(result.snapshot.element.tagName, "button");
  assert.equal(
    result.snapshot.page.url,
    "https://example.com/page?token=%5Bredacted%5D&tab=main"
  );
  assert.equal(
    browserElementSnapshotAttachmentName(result.snapshot),
    "button · Example.json"
  );
});

test("browser element snapshots reject selected results without identity", () => {
  assert.equal(
    normalizeBrowserElementSelectionResult({
      status: "selected",
      snapshot: { element: {}, page: {}, viewport: {} }
    }),
    null
  );
});
