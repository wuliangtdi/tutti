# PR4 系統通知三場景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn 完成 / turn 失敗 / 等待決策三場景接入系統通知：窗口聚焦時僅應用內呈現，未聚焦時發 OS 通知；點擊 OS 通知聚焦窗口並跳轉對應會話。

**Architecture:** 接線工程（spec §3.4 已核實基建完整）。事件源復用消息中心 viewModel 的條目流（`WorkspaceChrome.tsx:360-430` 的 waiting 監聽是既有樣板——含 seenKeys 去重）；呈現走 `compositeNotificationService`（已有聚焦態路由：前台 toast、後台 OS）。`desktopNotificationAccess` 已支持 onClick。不改 daemon/nextopd。

**Tech Stack:** TypeScript/React（apps/desktop renderer + main，vitest）。

**分支:** `capability-negotiation`。

---

### Task A: 完成/失敗場景的通知 builder + 監聽

**Files:**

- Create: `apps/desktop/src/renderer/src/features/workspace-workbench/services/workspaceAgentOutcomeNotification.ts`
- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/WorkspaceChrome.tsx`（在既有 waiting 監聽 effect 旁增加 outcome 監聽 effect,同樣的 seenKeys 去重模式）
- Modify: i18n 三語（標題/正文模板,鍵位沿用 `workspace.agentMessageCenter.*` 命名空間慣例）
- Test: `workspaceAgentOutcomeNotification.test.ts`（vitest,純 builder 測試:completed/failed 條目 → {title, body, level};非 terminal 條目 → null）

**Builder 簽名（鎖定）:**

```ts
export interface WorkspaceAgentOutcomeNotification {
  agentName: string;
  conversationTitle: string;
  level: "success" | "error";
  body: string;
  agentSessionId: string;
}
export function buildWorkspaceAgentOutcomeNotification(
  item: WorkspaceAgentMessageCenterItem,
  labels: {
    completedBody: string;
    failedBody: string;
    fallbackAgentName: string;
  }
): WorkspaceAgentOutcomeNotification | null;
```

**判定:** 消息中心條目的會話狀態進入 terminal（completed→success / failed→error;canceled 不通知——用戶自己取消的不打擾）。先勘察 `WorkspaceAgentMessageCenterItem` 與其 viewModel 的狀態字段（`workspaceAgentMessageCenterViewModel.ts`）,用與 waiting 監聽同源的數據;「新進入 terminal」用 prevState 對比（同 waiting 的 seenKeys 模式,按 `sessionId:status` 做 key）。

**呈現:** 經 `notificationService`（container 注入的 compositeNotificationService——勘察 WorkspaceChrome 可達的服務注入,若 chrome 拿不到,沿 createWorkspaceWindowContainer 找到掛接點傳入）。聚焦態去重由 composite 服務自帶（前台只 toast,後台才 OS）。完成場景前台**不額外彈 toast**（消息中心已有記錄,避免騷擾）——即 NotificationMessage 標記為僅後台級別:勘察 `BackgroundNotificationPolicy` 與 NotificationMessage 的字段,若有 level/policy 控制則用之;若無,僅在 `!visibility.isForeground()` 時調用（在調用側判聚焦,複製 composite 內的 visibility 邏輯或直接用 `document.visibilityState`+`hasFocus`）。

- [x] **Step 1: 失敗測試（builder）** → **Step 2: 確認失敗** → **Step 3: 實現 builder** → **Step 4: WorkspaceChrome 接線 + i18n** → **Step 5: `cd apps/desktop && pnpm typecheck` + vitest + `pnpm check:i18n`** → **Step 6: Commit** `feat(desktop): system notifications for agent turn outcomes`

### Task B: 待決策場景補 OS 通知面 + 點擊跳轉

**Files:**

- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/WorkspaceChrome.tsx`（waiting 監聽 effect:現有 in-app toast 之外,未聚焦時補發 OS 通知,文案復用 `buildWorkspaceAgentDecisionNotification` 的 description）
- Modify: OS 通知點擊跳轉:勘察 `desktopNotificationAccess` 的 onClick 如何從 renderer 傳遞（`hostNotifications.ts` IPC）;點擊後聚焦窗口（main process `BrowserWindow.focus()`——勘察既有 IPC 是否已做）並導航到對應會話(復用消息中心條目點擊的跳轉動作——grep `WorkspaceAgentMessageCenterCard` 的 onClick/onNavigate 去向)。若現有 IPC 通道不傳 payload,擴展 NotificationMessage/show 輸入帶 `onClickNavigate: { agentSessionId }` 並沿 IPC 透傳——保持向後兼容（可選字段）。
- Test: vitest——waiting 條目在未聚焦態觸發 background show 調用（mock notificationService/visibility）;聚焦態不觸發。

- [x] **Step 1: 勘察並記錄（IPC 形態、跳轉動作）** → **Step 2: 失敗測試** → **Step 3: 實現** → **Step 4: 驗證（typecheck + vitest + check:i18n）** → **Step 5: Commit** `feat(desktop): OS notifications for pending agent decisions with session navigation`

### Task C: 回歸驗證

- [ ] **Step 1:** `agentPowerSaveBlocker` 測試重跑（`cd apps/desktop && pnpm vitest run agentPowerSaveBlocker`）+ desktop 全 typecheck。
- [ ] **Step 2:** `pnpm lint:ts 2>&1 | tail -3` 無 error。
