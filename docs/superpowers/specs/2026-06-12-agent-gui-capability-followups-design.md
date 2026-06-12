# Agent GUI 能力對齊收口（計畫模式入口 + Skills 分組 + 鉗制點收斂）

> 狀態：已批准。承接 `2026-06-12-agent-gui-capability-alignment-design.md`（PRD：【Tutti】Agent GUI 对齐 Agent 交互），收口該輪實現後對照 PRD 與三條質量標準（減代碼/壞味道、防迭代 bug、減倉庫概念）覆核出的缺口。

## 1. 背景與目標

對 PRD 的逐功能覆核結論：P0/P1 主幹（圖片輸入、Skills 調用、Compact、系統通知、用量條）已落地；真正缺口有二——**計畫模式沒有任何用戶可觸發的 GUI 入口**（PRD 誤標 ✅），以及 **Skills 在斜杠面板與命令混排無分組**。缺口的結構性根源是 GUI 的 `composerSupportForProvider` 硬編碼表與後端數據源（`SupportsComposerSettings` + 能力詞表）重複表達同一事實且已漂移（表寫死 `plan: false`）。

本設計同時修缺口與根源：補入口、補分組，並把「provider 支持哪些 composer 設置」的真相源收斂為後端唯一。

## 2. 範圍

**做**：
- **A** 計畫模式 GUI 入口（僅 claude-code，能力協商門控）
- **B** Skills 斜杠面板分組
- **R1** 鉗制點收斂到 daemon（刪 GUI `composerSupportForProvider` 表）
- **R2** 刪 legacy `promptCapabilities` 圖片雙信號
- **R3** Go/TS 能力詞表漂移測試
- **R4** 隱藏 skills 名單收斂為單一常量

**不做**（已評估，明確出局）：
- Compact 會話菜單入口——`/compact` 斜杠 + 用量條按鈕已滿足，PRD 措辭按此理解
- 圖片加固（尺寸上限/壓縮）——後續獨立 effort
- skills/tokenUsage/rateLimits 消費遷移至 `resolveAgentActivityCapability`——數據存在性已隱式門控，遷移純加碼不刪概念
- 約 29 處 provider 硬編碼門控——多為產品語義非能力，留待 providerMeta 收斂（另一 effort）
- Skills 啟用/禁用管理——禁用在 provider 層如何生效存在未解產品問題，待討論

## 3. R1：鉗制點收斂（地基，先行）

「鉗制」= 把持久化的 composer 設置（model / reasoningEffort / planMode / permissionModeId）強制收斂到 provider 合法範圍。現狀兩處重複鉗制且規則互補不一致：GUI 鉗 model/plan（憑硬編碼表），daemon 鉗 permission/reasoning（`normalizeComposerSettingsForProvider`）。

**收斂後：daemon 是唯一鉗制點**（所有通往真實會話的路徑必然經過它）。

### 3.1 Go 側補鉗（composer_options.go）

`normalizeComposerSettingsForProvider` 補兩條：
- `Model`：provider 不在 `SupportsComposerSettings` 集合 → 清空
- `PlanMode`：provider 靜態能力默認（`composer_options.go` 靜態詞表）不含 `planMode` → 強制 false

permission / reasoning 既有邏輯不動。

### 3.2 GUI 側刪表（兩階段、各自獨立 commit）

1. **等價性真值表測試先行**：枚舉 claude-code / codex / gemini / hermes / nexight / openclaw，斷言數據驅動推導與舊表輸出逐欄相等（plan 欄除外，有意變更）：
   - model ← `composerOptions.modelConfig.configurable`
   - reasoning ← `reasoningConfig.configurable`
   - permission ← `permissionConfig.configurable`
   - plan ← `resolveAgentActivityCapability("planMode")`
2. 測試綠後：渲染期門控改讀 composer options；`buildNodeDefaultComposerSettings` / `nodeDataFromComposerSettings` 僅保留 trim/null 通用清洗；刪除 `composerSupportForProvider`。

**數據未到行為**：composer options 異步未達時設置行不渲染（activity-core 有 per-provider 快取，實際僅首次打開存在短暫空窗）；與現狀「菜單內容等數據」一致。

## 4. A：計畫模式入口（僅 claude-code）

- **入口**：composer 設置面板新增「計畫模式」toggle，綁定既有 `AgentSessionComposerSettings.planMode` 欄位。顯示條件 `resolveAgentActivityCapability("planMode") === true`（運行時優先，會話前走 composer options 靜態默認——claude-code 會話前即可見；codex 及其他 provider 永不出現）。`null`（未知）→ **隱藏**。與 imageInput 的寬鬆默認相反，理由：plan 是增益功能，未知時隱藏無損；圖片是輸入能力，未知時阻擋會誤傷。
- **生效鏈**（既有，零改動）：設置 → daemon `effectiveModeID`（standard_acp_adapter.go:1219）→ 每 turn 對 claude-code 發 `"plan"` 模式 + plan 指令。
- **退出鏈**（新增）：exit-plan 決策卡**批准類選項**提交成功後，controller 同步 `updateComposerSettings({ planMode: false })`；拒絕/反饋分支不動。模型自發進入 plan 時批准同樣執行清除（冪等）。
- **i18n**：en / zh-CN（倉庫僅此兩 locale）：toggle 標籤、描述、tooltip。

## 5. B：Skills 面板分組

`slashPaletteEntries` 組裝處已天然分為 commands / skills 兩段；palette 渲染層加組標題（「命令」/「Skills」，i18n 兩語），僅兩組皆非空時顯示。組標題不可選中，鍵盤導航的扁平 index 順序不變——現有上下鍵邏輯零改動。

## 6. R2：刪 legacy 圖片雙信號

- daemon 停發 `runtimeContext.promptCapabilities`（standard_acp_adapter.go:1259 及 codex 對應處）
- `resolveAgentActivityCapability` 刪 imageInput 的 legacy fallback 分支；`resolveAgentActivityPromptImagesSupported` 改純 capabilities 推導或內聯刪除
- legacy 路徑測試刪除

安全前提：PR0 後所有 in-repo adapter 必發 capabilities 列表；daemon 與 GUI 同包發版無版本偏斜；缺數據維持 `null → 寬鬆默認`，行為只寬不嚴。

## 7. R3 + R4

- **R3**：Go 測試讀取 `packages/agent/activity-core/src/capabilities.ts`，正則提取 `AGENT_CAPABILITY_KEYS`，與 Go 常量集合斷言相等。不引入 codegen。
- **R4**：`skill_options.go` 與 `agentsidecar/provider_skill.go` 兩處隱藏名單收斂為單一導出常量。

## 8. 測試與驗收

- **Go 單測**：鉗制真值表（6 provider × 4 欄位）；planMode/model 補鉗；詞表同步。
- **TS 單測**：等價性真值表（刪表前保護網）；plan toggle 門控（claude 顯示 / codex 隱藏 / null 隱藏）；exit-plan 批准後設置清除；palette 分組渲染 + 鍵盤導航；R2 後 imageInput 推導。
- **真機驗收**：claude-code 開 plan → 只讀規劃 → exit-plan 卡批准 → 開關自動關 → 正常執行；拒絕分支保持規劃；codex 全程無 plan 痕跡；兩 provider composer 設置行與改前一致。

## 9. 落地策略與風險

提交順序 = 依賴順序，各自獨立 commit、可單獨 revert：

1. R1-Go 補鉗（+ 測試）
2. R1-GUI 等價性測試 → 刪表（兩 commit）
3. A 計畫模式入口
4. B Skills 分組
5. R2 刪 legacy 信號
6. R3 / R4

落點：`capability-negotiation`（PR #150）之上的 stacked 分支 `capability-followups`，單獨成 PR。

風險集中在 R1（影響所有 provider 的 composer 設置面板）與 A（新用戶行為）：前者被等價性測試圈死，後者被能力門控 + daemon 鉗制雙保險限定在 claude-code 內。R2/R3/R4 近零風險。整體不觸碰會話 timeline、消息中心、通知、dock、協議線格式、持久化數據格式。
