import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./BrowserElementContextAction.tsx", import.meta.url),
  "utf8"
);
const browserPanelSource = readFileSync(
  new URL("../ui/StandaloneAgentBrowserToolPanel.tsx", import.meta.url),
  "utf8"
);

test("browser element selection action uses a shared hover tooltip", () => {
  assert.match(
    source,
    /<TooltipTrigger asChild>[\s\S]*?<Button[\s\S]*?<TooltipContent side="bottom">\{label\}<\/TooltipContent>/
  );
});

test("browser element selection action uses the shared inspect icon", () => {
  assert.match(source, /<InspectIcon className="size-\[15px\]" \/>/);
  assert.doesNotMatch(source, /WebScrapeIcon/);
});

test("standalone browser statically loads the element selection action", () => {
  assert.match(
    browserPanelSource,
    /import \{ BrowserElementContextAction \} from "\.\.\/browser-element-context\/BrowserElementContextAction\.tsx";/u
  );
  assert.doesNotMatch(browserPanelSource, /LazyBrowserElementContextAction/u);
});
