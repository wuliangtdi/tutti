import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const standaloneWindowSource = readFileSync(
  resolve(currentDirectory, "StandaloneAgentWindow.tsx"),
  "utf8"
);
const workbenchBodySource = readFileSync(
  resolve(
    currentDirectory,
    "../../workspace-agent/ui/DesktopAgentGUIWorkbenchBody.tsx"
  ),
  "utf8"
);

test("standalone Agent reuses the OS account menu in the sidebar footer", () => {
  assert.match(
    standaloneWindowSource,
    /import \{ WorkspaceAccountMenu \} from "\.\/WorkspaceAccountMenu";/
  );
  assert.match(
    standaloneWindowSource,
    /function renderStandaloneAgentSidebarFooter\(\): ReactNode \{[\s\S]*<WorkspaceAccountMenu showLeadingDivider=\{false\} \/>/
  );
  assert.match(
    standaloneWindowSource,
    /renderSidebarFooter=\{renderStandaloneAgentSidebarFooter\}/
  );
  assert.match(
    workbenchBodySource,
    /renderSlots=\{\{[\s\S]*sidebarFooter: previewMode \? undefined : renderSidebarFooter[\s\S]*\}\}/
  );
});

test("standalone Agent keeps the app runtime lifecycle active for inline apps", () => {
  assert.match(
    standaloneWindowSource,
    /useEffect\(\s*\(\) => workspaceAppCenterService\.startWorkspacePolling\(workspaceId\),\s*\[workspaceAppCenterService, workspaceId\]\s*\)/
  );
});

test("standalone Agent routes files and apps into the right sidebar", () => {
  assert.match(
    standaloneWindowSource,
    /setCanvasFilePreviewLauncher\([\s\S]*?openFileInSidebar\(target\.path\)/
  );
  assert.match(standaloneWindowSource, /workspaceFilePreviewMode: "canvas"/);
  assert.match(
    standaloneWindowSource,
    /action\.type !== "open-local-asset-preview"[\s\S]*?action\.type !== "open-workspace-file"[\s\S]*?openFileInSidebar\(action\.path\)/
  );
  assert.match(
    standaloneWindowSource,
    /setWorkspaceAppLauncher\([\s\S]*?state: \{ openAppId: appId \}/
  );
  assert.match(
    standaloneWindowSource,
    /<StandaloneAgentToolSidebar[\s\S]*?appOpenId=\{openAppId\}[\s\S]*?fileOpenRequest=\{fileOpenRequest\}/
  );
});

test("standalone Agent restores the active session title in the window header", () => {
  assert.match(
    standaloneWindowSource,
    /activitySnapshot\.sessions\s*\.find\([\s\S]*?session\.agentSessionId[\s\S]*?nodeState\.lastActiveAgentSessionId[\s\S]*?\)\s*\?\.title\?\.trim\(\) \|\| null/
  );
  assert.match(
    standaloneWindowSource,
    /conversationTitle=\{headerConversationTitle\}/
  );
});

test("standalone Agent keeps its window title visible", () => {
  assert.match(
    standaloneWindowSource,
    /showAppTitle\s*\n?\s+title=\{i18n\.t\("workspace\.agentGui\.fallbackAgentLabel"\)\}/
  );
});

test("standalone Agent hides panel toggles until its content mounts", () => {
  assert.match(
    standaloneWindowSource,
    /const \[isContentLoading, setIsContentLoading\] = useState\(true\)/
  );
  assert.match(
    standaloneWindowSource,
    /secondaryAccessory=\{isContentLoading \? null : toolActions\}/
  );
  assert.match(
    standaloneWindowSource,
    /showConversationRailToggle=\{!isContentLoading\}/
  );
  assert.match(
    standaloneWindowSource,
    /<StandaloneAgentWindowContentReady onReady=\{handleContentReady\}>[\s\S]*?<LazyDesktopAgentGUIWorkbenchBody/
  );
});
