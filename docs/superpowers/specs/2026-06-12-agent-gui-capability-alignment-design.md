# Agent GUI 能力對齊設計（本期）

- 日期：2026-06-12
- 狀態：已實施（capability-negotiation 分支,堆疊於 codex-app-server;真機驗收清單待跑）
- 需求來源：[【Tutti】Agent GUI 对齐 Agent 交互](https://ccn53rwonxso.feishu.cn/wiki/BkgPwgCFpiuCT6kzDsNcRA29nUc)（PRD）；[Codex 功能重要性分析](https://ccn53rwonxso.feishu.cn/docx/GTCmdgIimowmjBxG7BacIaXZnVg)（11 人投票，22 項功能）
- 前置依賴：`codex-app-server` 分支（PR #143）先合入——圖片透傳、`/compact`、usage/rateLimits/capabilities 上報均建立在其上

## 1. 背景與目標

PRD 結論：CLI 老用戶的「會話核心循環」操作（圖片輸入、Skills、壓縮上下文、通知）在 Agent GUI 未完全承接，用戶被迫切回終端。本期把這些基礎交互原生搬進 GUI，並建立能力協商機制，讓每項能力按 provider 可用性自動亮起或降級。

本期範圍：單人視角、單 workspace、Agent GUI 節點內的會話級交互。

## 2. 已確認的決策

| 決策點        | 結論                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 計畫範圍      | PRD 本期範圍減圖片項：P0 三項（Skills、壓縮上下文、通知）+ P1 用量展示，全棧（GUI + 能力協商 + daemon/adapter）。圖片鏈路經核實已端到端可用，本期不投入，加固項後置 |
| Provider 驗收 | codex + claude-code 全量驗收；gemini/hermes/openclaw/nexight 只保證優雅降級（置灰不報錯）                                                                           |
| Skills 深度   | 只讀列表 + 調用；啟用/禁用/安裝本期不做                                                                                                                             |
| 交付節奏      | 按能力垂直切片，每切片一條端到端鏈路獨立成 PR；能力協商底座先行                                                                                                     |
| 計畫口徑      | 按代碼實際現狀「驗證+補缺」，不按 PRD 現狀欄當全缺失重做                                                                                                            |
| 能力協商      | 方案 A 為主（daemon 運行時上報為單一事實源）、方案 B 兜底（會話建立前用靜態保守預設渲染）                                                                           |

## 3. 核實後的現狀基線（4 個獨立核實 agent 的結論）

PRD 的「現狀」欄與代碼實際有出入。以下為逐鏈路核實結果，本設計以此為基線。

### 3.1 圖片輸入：端到端完整，無斷點

- 粘貼（`AgentRichTextEditor.tsx:243`）與拖拽（編輯器層 `:309` + Composer 層 `AgentComposer.tsx:1529`）均已實現，產出 `{type:"image", mimeType, data(base64), name}`。
- 門控 `resolveAgentActivityPromptImagesSupported`（`activity-core/selectors.ts:25`）：會話運行時 `promptCapabilities.image` 優先，composer options 靜態值兜底——與本設計的 A 主 B 兜底結構天然一致。
- 傳輸鏈完整：`AgentPromptContentBlock[]` → nextopd → daemon `PromptContentBlock`，claude 走 ACP `{mimeType,data}`，codex 走 app-server data URL。
- 持久化/回顯：image 的 `data` 不入 `messages.jsonl`，以 `attachmentId` 引用，回顯經 `readSessionAttachment` 重建 data URL（`AgentMessageBlock.tsx:152-244`）。
- 已知缺口：無單圖尺寸/體積限制、無壓縮（原始 base64）；上限 8 張（`MAX_PROMPT_IMAGES`）。

### 3.2 Skills：鏈路完整，有一個高優緩存缺口

- 發現：`skill_options.go` 按 provider 掃描（codex：項目 `.codex/skills` 沿 cwd 向上 + `~/.agents/skills` + `~/.codex/skills` + `$CODEX_HOME`；claude：`.claude/skills` + `~/.claude/skills` + 插件目錄），解析 SKILL.md frontmatter。
- 觸發詞：codex `$name`，claude `/name` 或 `/plugin:name`；GUI 選擇時自動做跨 provider 前綴替換（`agentSkillOptions.ts:91-108`）。
- **缺口（高優）**：composer options 按 provider 鍵緩存（`activity-core/controller.ts:140`），不感知 cwd 變化——切換項目後祖先目錄 skills 不刷新，需 force 或新會話。
- 設置頁無任何 skills 視圖（確認為新建工作）；現有 tab：general / appearance / apps / developer。

### 3.3 用量與 Compact：數據已實時，缺常駐 UI 與閾值提醒

- 兩個 adapter（`standard_acp_adapter.go:1282`、`codex_appserver_adapter.go`）均把 `usage`（contextWindow + quotas）寫入 `RuntimeContext`；`usage_update` / `thread/tokenUsage/updated` 事件**在 turn 中即時**觸發 state patch 推送——GUI 數據源已具備實時性。
- `/status` 面板（`AgentComposerSlashStatus`）展示 context 百分比與限流，但僅斜杠命令按需觸發，**無常駐 UI**。
- `/compact` 已在兩個 provider 的 availableCommands 中，且有 `hasCompactableContext` 過濾（`agentSlashCommandProviderPolicy.ts:217`）；**無任何閾值提醒邏輯**（已 grep 確認）。

### 3.4 通知：基建完整，缺接線

- OS 通知通道完整：main process `hostNotifications.ts`（`new Notification`）+ `desktopNotificationAccess.ts`（onClick/onFailed）。
- 聚焦感知路由已實現：`compositeNotificationService` 已做「前台只 toast、未聚焦才發系統通知」判定。
- 「待決策」已有**應用內** toast（`WorkspaceChrome.tsx:360-430`，帶審批選項、seenKeys 去重），但不是 OS 通知；**完成/失敗連 in-app toast 都沒有**；無任何 agent 事件調用 `notificationService`（grep 確認）。

### 3.5 能力門控：30+ 處硬編碼站點

盤點見附錄 A。本期只遷移阻塞 P0/P1 切片的站點（image、planMode、compact/slash 命令路由）；其餘（reasoning 檔位映射、權限模式表、模型別名等）入清單後置，避免 PR0 膨脹。

## 4. 架構：能力協商（A 主 B 兜底）

```
adapter 上報 capabilities/usage/skills
  → SessionStateSnapshot.RuntimeContext / ComposerOptions
  → nextopd state patch / activity snapshot
  → GUI selectors（activity-core）
  → 組件（Composer / 標題欄 / 通知 / 設置頁）
```

- **統一能力詞表**（Go/TS 各一份常量，key 對齊）：`imageInput`、`skills`、`compact`、`tokenUsage`、`rateLimits`、`planMode`、`interrupt`。
- **A（運行時）**：codex 已有 `codexAppServerCapabilities()`；`StandardACPAdapter` 補同等上報（從 ACP `initialize` 的 `promptCapabilities`/`agentCapabilities` + `availableCommands` 派生），統一落到 `runtimeContext.capabilities`。
- **B（兜底）**：nextopd `GetComposerOptions` 保留每 provider 靜態保守預設表（替換現有 `composerPromptCapabilities` 硬編碼 switch 的角色），僅用於會話建立前的初始渲染；會話建立後被運行時上報覆蓋。
- **GUI**：`activity-core` 新增 `resolveCapability(snapshot, key)`（沿用 `resolveAgentActivityPromptImagesSupported` 的「runtime 優先、靜態兜底」模式並泛化）；能力缺失 → 控件置灰 + tooltip。

## 5. 五個垂直切片

### 切片 0 · 能力協商底座（PR0）

- daemon：`StandardACPAdapter` 補 `capabilities` 上報；codex 詞表對齊。
- nextopd：靜態預設表 + 活躍會話運行時覆蓋的合併邏輯。
- GUI：`resolveCapability` selector；遷移三個站點（image 門控來源、planMode 判斷、compact 命令可用性）。
- 驗收：codex/claude-code 正確亮起；其餘四 provider 全部置灰零報錯。

### 切片 1 ·（本期移除）圖片/多模態輸入

經核實鏈路端到端可用（見 3.1），本期不投入。尺寸/體積上限與壓縮等加固項列入後置清單（第 9 節）。image 能力 key 仍保留在統一詞表中（其運行時門控數據已存在，PR0 的 `composerPromptCapabilities` 替換順帶覆蓋，無額外成本）。

### 切片 2 · Skills（P0，補缺+設置頁視圖）

- 修復 cwd 感知：composer options 緩存鍵加入 cwd（或 cwd 變化時失效重取）。
- 真機驗收：兩 provider 的發現、搜索、觸發詞替換、調用發送。
- 新建：設置頁「Agent」分組 Skills 只讀視圖（按 provider 列 name/description/sourceKind/pluginName），數據復用 `GetComposerOptions.Skills`，零新後端接口。

### 切片 3 · 壓縮上下文顯性入口（P0）

- GUI 新建:會話菜單 + 用量條上的 Compact 按鈕（復用現有 `/compact` 提交鏈路與 `hasCompactableContext` 過濾）。
- 閾值提醒（全新）：usage selector 達 80% 弱提示（用量條變色+一次性 toast）、95% 強提醒（帶 Compact 行動按鈕），常量可調；同會話同檔位只提醒一次。
- 門控：capability `compact`。

### 切片 4 · 系統通知三場景（P0，接線工程）

- 把三場景事件接入現有 `compositeNotificationService`：
  - 待決策：復用 `buildWorkspaceAgentDecisionNotification` 數據,補 OS 通知面（in-app toast 已有）;
  - 完成 / 失敗：新增兩個輕量 builder（標題=會話名,正文=結果摘要）。
- 去重直接吃現成的聚焦態路由：聚焦時僅消息中心/toast,未聚焦才 OS 通知——同一事件單 surface 打擾。
- OS 通知 onClick → 聚焦工作區窗口 + 跳轉對應會話（復用消息中心路由）。
- i18n 文案（zh-CN/zh-TW/en）。
- 回歸驗證：agentPowerSaveBlocker 在 app-server provider 下行為不變。

### 切片 5 · 常駐用量指示器（P1）

- 會話標題欄 usage chip：context 佔用百分比；hover 展開 token 明細 + 限流配額（復用 `AgentComposerSlashStatus` 結構與 `runtimeContext.usage` 實時數據）。
- 與切片 3 共用 usage selector;數據缺失時整個 chip 隱藏（不顯示 0%）。

## 6. 錯誤處理原則

- 能力缺失 → 置灰 + tooltip，永不報錯彈窗；會話未建立 → 靜態預設兜底。
- usage 無數據 → 隱藏而非顯示零值。
- 系統通知發送失敗 → 靜默降級到消息中心（compositeNotificationService 已有 best-effort 吞錯）。

## 7. 測試與驗收

- Go 單測：兩個 adapter 的 capabilities 上報；composer options「預設+運行時覆蓋」合併；skills cwd 失效邏輯。
- TS 單測：`resolveCapability`；Composer 門控；閾值提醒檔位/去重；通知聚焦態矩陣。
- 真機驗收清單（codex + claude-code 各跑一遍）：skill 調用、Compact 按鈕+兩檔提醒、通知三場景（聚焦/未聚焦 × 完成/失敗/待決策）、用量條實時性。
- codex 復用 `NEXTOP_REAL_CODEX_TEST` 門控真機測試擴展。

## 8. PR 切分與里程碑

| PR  | 內容                            | 依賴                  |
| --- | ------------------------------- | --------------------- |
| PR0 | 能力協商底座                    | codex-app-server 合入 |
| PR2 | Skills cwd 修復 + 設置頁視圖    | PR0                   |
| PR5 | 常駐用量條（含 usage selector） | PR0                   |
| PR3 | Compact 入口 + 閾值提醒         | PR0、PR5              |
| PR4 | 系統通知三場景                  | 無（可全程並行）      |

里程碑：M1 輸入側（PR0+PR2）→ M2 上下文管理（PR5→PR3）→ M3 通知（PR4 並行）。PR 編號沿用切片號（PR1 已隨切片 1 移除）。

## 9. 風險與後置清單

- 風險：能力詞表 Go/TS 雙份常量可能漂移——以 Go 為源,TS 側加對齊單測鎖定。
- 風險：閾值提醒的 contextWindow 語義在 provider 間略有差異（codex 為最近一次請求佔用,claude 為累計）——文案用「約 X%」措辭,不承諾精確。
- 後置：圖片加固（單圖尺寸/體積上限、超限自動壓縮、不支持 provider 的拒絕提示文案核驗、真機多圖回顯驗收）；附錄 A 中未遷移的門控站點；Skills 啟用/禁用；steering 的 controller 打通；登錄流程；命令輸出增量流。

## 附錄 A：能力門控站點盤點（節選，完整清單見核實記錄）

本期遷移：`composerPromptCapabilities`（composer_options.go:128）、planMode 判斷（useAgentGUINodeController.ts:1295）、compact/slash 命令路由（agentSlashCommandProviderPolicy.ts:42-219）。
後置：reasoning 檔位與映射（composer_options.go:163/477/484）、權限模式表（composer_options.go:261-321、controller.go:357-386）、claude 模型別名與自定義模型限制（standard_acp_adapter.go:1061/1173）、`AGENT_PROVIDER_CAPABILITIES`（providerMeta.ts）等約 25 處。
