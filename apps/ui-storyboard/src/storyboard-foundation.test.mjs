import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const storyboardThemeSource = readFileSync(
  new URL("./storyboardTheme.ts", import.meta.url),
  "utf8"
);
const foundationContentUrl = new URL(
  "./foundation/content.ts",
  import.meta.url
);
const colorsContentUrl = new URL("./foundation/colors.json", import.meta.url);

test("ui storyboard reads foundation docs content from the foundation content module", () => {
  assert.match(
    appSource,
    /from "\.\/foundation\/content"/,
    "App.tsx should read foundation sections from ./foundation/content"
  );
});

test("foundation content module sources overview, colors, typography, and metrics from json", () => {
  assert.equal(
    existsSync(foundationContentUrl),
    true,
    "src/foundation/content.ts should exist"
  );

  const foundationContentSource = readFileSync(foundationContentUrl, "utf8");

  for (const jsonFile of [
    "./overview.json",
    "./colors.json",
    "./typography.json",
    "./metrics.json"
  ]) {
    assert.match(
      foundationContentSource,
      new RegExp(
        `import .* from "${jsonFile.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}" with \\{ type: "json" \\}`,
        "g"
      ),
      `missing json import ${jsonFile}`
    );
  }
});

test("foundation colors document stationary black and white tokens", () => {
  const colors = JSON.parse(readFileSync(colorsContentUrl, "utf8"));
  const labels = new Set(
    colors.groups.flatMap((group) => group.tokens.map((token) => token.label))
  );

  assert.equal(labels.has("--white-stationary"), true);
  assert.equal(labels.has("--black-stationary"), true);
});

test("foundation colors place running status in state runtime group", () => {
  const colors = JSON.parse(readFileSync(colorsContentUrl, "utf8"));
  const stateRuntimeGroup = colors.groups.find(
    (group) => group.title === "State / Runtime"
  );

  assert.equal(
    stateRuntimeGroup?.tokens.some(
      (token) => token.label === "--status-running"
    ),
    true
  );
});

test("foundation colors use the updated #3C3C3C light token base in examples", () => {
  const colors = JSON.parse(readFileSync(colorsContentUrl, "utf8"));
  const tokens = new Map(
    colors.groups.flatMap((group) =>
      group.tokens.map((token) => [token.label, token])
    )
  );

  for (const [label, alpha] of [
    ["--transparency-block", "0.04"],
    ["--transparency-hover", "0.06"],
    ["--transparency-active", "0.06"],
    ["--text-primary-hover", "0.90"],
    ["--text-secondary", "0.70"],
    ["--text-tertiary", "0.50"],
    ["--text-placeholder", "0.30"],
    ["--text-disabled", "0.30"],
    ["--border-1", "0.08"],
    ["--border-2", "0.08"],
    ["--line-1", "0.08"],
    ["--line-2", "0.08"],
    ["--line-focus-window", "0.12"]
  ]) {
    const token = tokens.get(label);

    assert.equal(
      token?.light,
      `rgba(60, 60, 60, ${alpha})`,
      `${label} should use the #3C3C3C light base`
    );
    assert.match(token?.usage ?? "", /#3C3C3C/);
  }

  assert.equal(tokens.get("--text-primary")?.light, "rgb(60, 60, 60)");
  assert.equal(tokens.get("--text-inverted")?.dark, "rgb(60, 60, 60)");
  assert.match(tokens.get("--text-primary")?.usage ?? "", /#3C3C3C/);
  assert.match(tokens.get("--text-inverted")?.usage ?? "", /#3C3C3C/);

  assert.doesNotMatch(readFileSync(colorsContentUrl, "utf8"), /43, 43, 43/);
});

test("storyboard theme maps Codex accent for light and dark modes", () => {
  assert.match(
    storyboardThemeSource,
    /"--accent-codex":\s*"rgb\(65, 130, 245\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--accent-codex":\s*"rgb\(79, 143, 255\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--accent-codex-border":\s*"color-mix\(in srgb, var\(--accent-codex\) 20%, transparent\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--status-running":\s*"rgb\(65, 130, 245\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--status-running":\s*"rgb\(79, 143, 255\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--tutti-purple":\s*"rgb\(109, 127, 245\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--tutti-purple":\s*"rgb\(136, 152, 255\)"/
  );
  assert.match(
    storyboardThemeSource,
    /const storyboardLightThemeVars = \{[\s\S]*?"--tutti-purple":\s*"rgb\(109, 127, 245\)"/
  );
  assert.match(
    storyboardThemeSource,
    /const storyboardDarkThemeVars = \{[\s\S]*?"--tutti-purple":\s*"rgb\(136, 152, 255\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--tutti-purple-bg":\s*"color-mix\(in srgb, var\(--background-fronted\) 88%, var\(--tutti-purple\) 12%\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--border-focus":\s*"rgba\(65, 130, 245, 0\.24\)"/
  );
  assert.match(
    storyboardThemeSource,
    /"--border-focus":\s*"rgba\(79, 143, 255, 0\.24\)"/
  );
});

test("icon storyboard keeps both nav applications variants visible", () => {
  assert.match(appSource, /"nav-applications-icon"/);
  assert.match(appSource, /const alwaysShowIconBases = new Set/);
});
