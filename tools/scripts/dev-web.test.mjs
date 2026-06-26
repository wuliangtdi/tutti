import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "dev-web.mjs");
const source = readFileSync(scriptPath, "utf8");

test("dev-web passes the analytics debug flag to tuttid", () => {
  assert.match(source, /TUTTI_ANALYTICS_DEBUG:/);
  assert.match(source, /VITE_TUTTI_ANALYTICS_DEBUG/);
});

test("dev-web generates builtin apps before starting tuttid", () => {
  assert.match(source, /installDevCli\(\);\s*generateBuiltinApps\(\);/);
  assert.match(source, /pnpm"\), \["generate:builtin-apps"\]/);
});
