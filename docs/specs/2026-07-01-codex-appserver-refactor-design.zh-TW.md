# Codex App-Server 層重構 — 設計文檔

- 日期：2026-07-01
- 分支：`refactor/codex-appserver-layering`
- 狀態：設計（決策已定，待 spec 審查）
- 英文版：`2026-07-01-codex-appserver-refactor-design.md`

## 問題

tutti 已經接入 Codex **App Server**——`packages/agent/daemon/runtime/codex_appserver_adapter.go` 實作了 `Start / Resume / Exec / Cancel / SubmitInteractive`，並把 server request 投影成 approval / interactive prompt。功能是通的，但它的**形狀**已經滑向幾個外部參考項目同款的可維護性陷阱：

1. **沒有 typed protocol 邊界。** 方法是手維護的字串常數（`appServerMethodThreadStart = "thread/start"` …），payload 靠手拼 `map[string]any`。協議漂移只能靠人和測試守住。
2. **糾纏的巨檔。** Codex runtime 層是幾個超大檔案，把 transport、lifecycle、協議、event reduce、approval 全揉在一起：

   | 檔案 | 行數 | 混在一起的職責 |
   |---|---|---|
   | `codex_adapter.go`（ACP，legacy） | 3443 | initialize / prompt / lifecycle |
   | `codex_appserver_adapter.go` | 2182 | lifecycle + 方法字串 + payload 組裝 |
   | `codex_appserver_events.go` | 1726 | event reduce / 映射 |
   | `codex_appserver_review.go` | 140 | review |
   | `codex_appserver_startup_trace.go` | 187 | startup trace |

   約 7.3k 行手寫程式碼，覆蓋的協議 surface **更少**，卻比最乾淨參考（`codex-sdk-go`）的「約 1.6k 行手寫 + 生成型別」更難維護。

本次重構是 **shape-first（選項 C）**：先把既有接入收斂成乾淨、分層、codegen 錨定的形狀，**不先擴充能力範圍**。能力追齊是這個形狀解鎖之後、另一輪獨立的工作。

## 目標與範圍

**範圍內**
- 把 App-Server 接入重構成分層、單一職責的單元，底下墊一層 typed protocol 邊界。
- 每一步 behavior-preserving（既有 app-server 測試保持綠）。
- 把 legacy **ACP** 路徑作為最後的清掃里程碑退場。

**明確不在範圍（延後）**
- 新增協議能力（fork / compact / realtime / inject_items 的產品化 surface 等）。codegen 層會**讓它們可用**，但把它們接進產品是另一件事。
- Provider-relay / 第三方模型（另一條產品線，見 CodexBridge `codex-provider-relay`）。
- Renderer / 桌面 UI 重設計。主體是 daemon 邊界；`apps/desktop` 繼續消費 typed state/events。

## 關鍵決策

| # | 決策 | 理由 |
|---|---|---|
| D1 | **app-server 是唯一未來傳輸路徑；ACP 是 legacy，本次一併退場。** | 產品方向。讓重構聚焦 app-server，並把 ACP 移除當成乾淨的刪除里程碑。 |
| D2 | **typed protocol 邊界來自「錨定官方上游 schema 的 codegen」**，不是手寫 struct，也不是 vendor 外部 SDK。 | 官方 `codex-rs/app-server-protocol` 帶 `src/bin/export.rs`，吐 JSON Schema + TS（型別 `derive(JsonSchema, TS)`）。上游是唯一 source of truth，漂移自動可見。 |
| D3 | **codegen 一步到位**——不做手寫過渡 struct。 | 避免「先建一層 typed 之後又拆掉」的返工；pipeline 很小且下游已驗證。 |
| D4 | **傳輸合一：一個 `Transport` + typed `Client` 同時承接 ACP 與 app-server（過渡期）；** 新 client 落地時 `acp_client.go` 退役（Step 2），ACP 高階邏輯本體之後再刪（Step 6）。 | 過渡期不維護兩套 JSON-RPC client。 |
| D5 | **不把 `codex-sdk-go` 整包 vendor 進 daemon 內核。** 它當 pipeline 模板 + 骨架參考 + 校準基準。 | daemon 內核的供應鏈信任；它的 facade 語意是它自己的產品取捨，未必貼 tutti。 |

## 參考對照（按 concern 分別借鑑，絕不 mono-copy）

| 層 / concern | 最佳參考 | 備註 |
|---|---|---|
| 協議 source of truth（型別、method surface） | **官方 `codex-rs/app-server-protocol`** 的 `bin/export`（JSON Schema + TS，`--experimental` flag） | 其他都是它的下游。 |
| event 語意 / lossless tier | **官方 `app-server-client`**（把 in-process + remote 壓成同一個 `AppServerEvent`；deltas / `item/completed` / `turn/completed` 必送達，progress 可降級） | 權威的 backpressure 設計。 |
| Go 分層（Transport / Client / typed stubs / facade） | **`codex-sdk-go`** | 同語言；約 1.6k 行手寫覆蓋 ~90 個 client + 9 個 server method，靠生成的 `types_gen.go`（3973 生成行）。新鮮度：追上游（`rust-v0.142.3`，撰寫時落後約 4 天）。 |
| event reducer / tool 映射 | `ai-sdk-provider-codex-asp` 的 `CodexEventMapper` | 跨 turn tool-result 回填、worker affinity（需要時才引入）。 |
| approval → durable pending state | `openclaw-codex-app-server` 的 pending-input 模型 | approval/user-input 變 durable state + UI 驅動回覆，而非在 RPC handler 同步卡死。 |
| non-destructive hydration；approval stall detection | `Agmente`（優先 loaded-thread read 而非 resume）、`CodexBridge`（批准後無 signal 的卡死偵測） | 供後續能力工作參考；現在用來校準 reducer/resolver 介面。 |

## 不變量（tutti 架構鐵律）

thread / turn / approval / history 的 reconciliation 屬於 daemon（`services/tuttid` / `packages/agent/daemon`）。`apps/desktop` 只消費 typed state/events 並提交命令（approve / interrupt / start-turn）。**桌面不得長成第二套 Codex business core。** 下面每一步都保這條。

## 目標架構

```
                          ┌─ Event Reducer ──────→ tutti typed activity events（lossless tier）
Transport ──→ typed Client ┤   （app-server notifications）
 (stdio)      (pending req  ├─ Approval Resolver ──→ durable pending state + typed responder
              / server req  │   （server requests）
              / notif sub)  └─ Thread/Turn Facade ─→ lifecycle 編排
                  ▲              （收薄後的 adapter）
           codexproto 包（codegen；錨官方 export；
                           版本戳；CI 漂移檢查）
                  ▲
      ACP 高階邏輯（過渡期暫掛同一個 Client；Step 6 刪除）
```

## 多步對齊計畫

每一步只把「一層」對齊到 codegen 錨定的目標，可獨立 ship，並讓工作區測試保持綠。順序：安全網 → 加法式 codegen → 由下往上（transport → events → approvals → facade）→ legacy 最後刪。

### Step 0 — 特徵化安全網
- 把既有 `codex_appserver_*_test.go` 確立為行為契約。
- 薄弱處補 golden/characterization 測試：event reducer 產出、approval/interactive 投影。
- pin 一個測試用的 Codex 版本 baseline。
- **出口：** 一組後續每步都必須維持綠的測試。

### Step 1 — typed protocol 層（codegen，一步到位）
- 新包（例如 `packages/agent/daemon/runtime/codexproto`）：跑官方 `export` → 生 protocol types + RPC stubs → 版本戳（codex commit/version）。
- 加 CI 漂移檢查（重生成後 diff）。
- **純加法**——還沒人消費它。
- **出口：** 生成的 typed 層可 build；CI 跑漂移檢查。

### Step 2 — 統一 Transport + typed Client（ACP/app-server 合一）
- 定義一個 `Transport`（stdio）+ typed `Client`（pending requests、server-request 處理、notification 訂閱），對齊 `codex-sdk-go` `rpc/`。
- 把 **ACP 和 app-server** 兩邊呼叫端都遷過來；`acp_client.go` 退役。
- app-server adapter 改用 typed stub 呼叫，而非字串 + `map[string]any`。
- **出口：** 單一 JSON-RPC client；`acp_client.go` 消失；測試綠。

### Step 3 — 抽出 Event Reducer
- 把事件處理從 1726 行檔案抽成專職 reducer：app-server notification → tutti typed activity event。
- 內建官方 **lossless tier**：deltas / `item/completed` / `turn/completed` 保證送達；progress 類事件可降級。
- **出口：** reducer 成為獨立、可測試單元；adapter 不再 inline 解析 raw notification。

### Step 4 — 抽出 Approval / Interactive Resolver
- 把 server-request 處理（command/file/permissions approval、`requestUserInput`、MCP elicitation）抽成 resolver，投影成 durable pending state + typed responder。
- 覆蓋 **unknown / 不支援 server-request** 的明確 reject/error surface。
- **出口：** approval 流成為獨立、可測試單元。

### Step 5 — 把 Adapter 收薄成 Thread/Turn facade
- `codex_appserver_adapter.go` 剩下的部分塌到 Thread/Turn lifecycle 編排（facade 形狀依 `codex-sdk-go`）。
- **出口：** adapter 只做編排；不再有協議字串或 inline reduction。

### Step 6 — 退場 ACP 高階邏輯
- 刪 `codex_adapter.go`（3443）與 ACP-only 輔助；傳輸層已於 Step 2 合一。
- **出口：** app-server facade 成為唯一路徑；legacy 移除；整個 runtime 包測試綠。

## 測試策略

- **契約：** Step 0 的特徵化測試是貫穿所有步驟的不變量。
- **逐層：** Step 2–5 各自落地抽出的單元並附專屬測試（transport/client、reducer、resolver、facade）。
- **漂移：** Step 1 的 CI 檢查重生成 `codexproto` 並在非預期 diff 時失敗，讓 typed 邊界對上游誠實。
- **baseline 指令（工作區）：** 在 `packages/agent/daemon` 跑 `go build ./runtime/...` + `go test ./runtime/ -run <app-server pattern>`。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| codegen 工具鏈依賴 Rust `export` bin / `go-jsonschema` | vendor/pin schema 產物或 export 步驟；文檔化重生成指令；CI 漂移檢查抓偏差。 |
| 重構中途上游 schema 變動 | Step 0 pin baseline 版本；版本升級當成獨立、可 review 的 diff。 |
| 抽取過程行為回歸 | behavior-preserving 步驟由 Step 0 契約把關；一步一層。 |
| 「幫快死的 ACP 合傳輸」像白工 | 嚴格來說比過渡期維護兩套 client 更省；不影響 Step 6 的 ACP 本體刪除。 |
| 步驟合批導致爆炸半徑大 | 每步獨立可 ship、可 review；不要合併。 |

## 待議問題（供 spec 審查）

- 生成的 protocol 層確切包名/位置（`codexproto` 或更共享的位置，其他 Go module 之後可能想用）。
- `export` 產物是 commit 進 repo（可重現、build 時不需 Rust）還是 CI 從 pin 的 codex checkout 重生成（永遠新鮮、需 cargo）。
- Step 3/4 介面寬度：reducer/resolver 介面要不要現在就預留延後能力工作（Agmente 式 hydration、CodexBridge stall detection），還是先做最小、之後再長。
