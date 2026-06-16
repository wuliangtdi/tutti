<div align="center">

<img src="docs/assets/banner.jpg" alt="Tutti" width="720" />

**人與 Agent「同步協作」的工作空間。**

[官網](https://tutti.sh) · [文件](docs/README.md) · [參與貢獻](CONTRIBUTING.zh-TW.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-tutti.sh-black.svg)](https://tutti.sh)

</div>

---

喜歡 Tutti？歡迎給我們一顆 Star、Fork 儲存庫、提交 Issue，或發起 PR。

我們正在和社群一起打造 Tutti。歡迎在本 README 末尾加入我們的 Discord，分享回饋、提出問題，並一起參與接下來的建設。

## Tutti 是什麼？

Agent 預設各做各的。Tutti 將它們帶進同一個即時工作空間，在這裡你的 Claude、Codex、Gemini 能共用脈絡、檔案、應用程式和正在執行的任務。你的 Codex 能看到 Claude 建構了什麼。

不僅如此，Tutti 還有自己的應用生態：生圖、UI/UX 設計、寫文件、做 PPT。你可以使用這些應用程式，你的 Agent 也可以呼叫。

Codex 呼叫生圖應用做了一張圖，Claude Code 可以直接拿去做頁面開發，不需要你來回複製貼上。

一切在 Tutti 中彼此可見、互相串接。任何成果，包括應用程式生成的輸出，都可以在不同 Agent 之間傳遞，並直接用於下一步。

無需終端機。無需複雜設定。打開 Tutti，就可以開始建構。

## 功能

### 即時工作空間

Agent 不再只是交接摘要，而是共用同一個即時工作空間：共用脈絡、檔案、正在跑的任務、應用程式。你的 Codex 能看到 Claude 改了什麼、正在執行什麼、專案目前處於什麼狀態。由此解鎖兩項能力：

**Big @**

- 在 Codex 中，你可以用 `@` 引用歷史對話、檔案、應用程式、應用程式成果和任務，無需反覆複製貼上，也不用重新上傳。
- 你也可以在 Codex 中引用 Claude Code 的歷史對話、檔案、應用程式、應用程式成果和任務，並在此基礎上繼續建構，無需手動搬運脈絡。

**任務編排與多專案建構**

- 各 Agent 彼此「可見」，因此可以自動迴避或處理衝突，自行判斷該並行還是串行。跨不同服務商的 Agent，比如 Claude 和 Codex、Gemini 和 OpenClaw（DeepSeek），也能協同工作，互不干擾。

![即時工作空間 —— Agent 共享同一份即時上下文、檔案與執行狀態](docs/assets/live-workspace.jpg)

### 原生應用程式

應用程式執行在 Tutti 上，你和你的 Agent 都能用。你可以自己操作，也可以讓任何 Agent 呼叫。用官方、社群共建或自訂的應用程式來生成圖片、影片等內容。

所有應用程式都複用你已有的 Agent 訂閱。

![原生應用程式 —— 官方、社群共建或自建應用，你和 Agent 都能呼叫](docs/assets/apps.jpg)

### 任務編排

不用手動拆分每一步。你只需要描述目標。Tutti 會把它拆解成清楚的任務。你只需要審核，再分配給合適的 Agent。

![任務編排 —— 描述目標，Tutti 自動拆解成清楚可分配的任務](docs/assets/goal-to-tasks.jpg)

### 控制中心

不用再在多個分頁之間來回切換。一個畫面掌握全局：所有 Agent 對話、待你審核的操作、正在執行的任務。需要你確認的地方，可以快速定位並一鍵核准。

![控制中心 —— 所有 Agent 對話、待審核操作與執行中任務盡在同一畫面](docs/assets/your-control.jpg)

### 複用你原有的訂閱

直接接入你已有的 Claude、Codex、Gemini 訂閱。所有應用程式和 Agent 都在此基礎上執行，零額外費用。

### 自訂你的工作空間

你可以依照自己的使用習慣，設定深色 / 淺色模式，更換桌面背景，調整 Dock 位置，自訂圖示樣式等。

## Tutti 適合誰

任何用 AI Agent 來 build 的人：只要你受夠了在不同 Agent、應用程式之間來回切換，受夠了反覆重新交代背景、手動搬運成果，受夠了為每份訂閱單獨付費，Tutti 就是為你設計的。

- **獨立開發者**：讓 Claude 出方案，Codex 接力開發，不用再重複解釋專案背景。
- **設計師**：用設計應用出設計稿，直接讓 Codex 拿去開發落地。
- **產品經理**：讓 Codex 寫完 PRD 後，自動呼叫 UI/UX 設計應用出原型，不用再打開 Figma。

無論你是什麼角色，都能在這裡找到各環節裡摩擦最低的使用組合方式。全 GUI 介面，無需終端機命令列，打開就能用。

## 你可以用 Tutti 做什麼

**Tutti · 本機版**（Agent 執行在本機，成果在本機）

- 讓 Codex 接著 Claude 的工作繼續做，無需重新說明上下文。
- 讓 Claude 寫完 PRD 後，直接呼叫設計應用生成圖片。
- 使用你已有的 Agent 訂閱，呼叫 Tutti 內的所有應用程式。
- 描述一個目標，讓 Agent 將其拆解成多個子任務，再把每個任務分配給合適的 Agent 執行。

**Tutti · 雲端版**（Agent 執行在本機，成果自動在雲端）

包含本機版的全部能力，額外實現：

- 開一個雲端空間，讓多台裝置在裡面工作，就像在用同一台電腦。
- 和朋友協作時，不用互相傳檔案、貼進度、總結 Agent 剛做了什麼。只要你們在同一個雲端工作空間，就能看到彼此在這個空間裡的對話、檔案、成果、任務進度及應用程式生成的結果。
- 用 `@` 引用同事的檔案、與 Agent 的對話等，並讓你的 Agent 在此基礎上建構。
- 你本機跑起來的網站（localhost），不用先部署上線，朋友就能在雲端工作空間裡直接打開預覽，給你提意見、幫你改。
- 當任務需要多人時，可以把任務分配給同事的 Agent 執行。

> ⚠️ 以上共享僅以工作空間為維度：邀請人與受邀人需加入同一工作空間，只有在同一工作空間內產出的內容才會被共享，其餘內容都保持私密。

## Tutti · 本機版 vs Tutti · 雲端版

|              | Tutti · 本機版（開源）                                  | Tutti · 雲端版（即將上線）                                         |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **適合誰**   | 一個人，多個 Agent                                      | 一個人，多個 Agent · 一個人，多台裝置 · 兩人以上，及各自的多 Agent |
| **跑在哪**   | 本機，成果在本機                                        | 本機，成果自動在雲端                                               |
| **共用什麼** | 多個 Agent 之間共用脈絡、應用程式、成果、任務和執行狀態 | 包含本機版的全部內容，另外支援多人、多裝置之間共用                 |
| **訂閱**     | 你自己的 Claude、Codex、Gemini 等訂閱                   | 你自己的 Claude、Codex、Gemini 等訂閱                              |

本儲存庫包含的是 **Tutti · 本機版**：桌面應用程式與本機常駐服務，基於 Apache-2.0 授權免費開放原始碼。Tutti · 雲端版是獨立的託管服務，其程式碼不在本儲存庫中。

## FAQ

### 我需要另外購買一個 Agent 訂閱嗎？

不需要。Tutti 可以使用你已經在用的 Claude、Codex、Gemini 以及其他 Agent 訂閱。

### 如果我沒有 Agent 訂閱怎麼辦？

你可以在 Tutti 內使用 Tutti Agent。Tutti Agent 在 Early Access 期間免費，之後可能會採用按用量計費。

### Tutti 本機版和雲端版有什麼差別？

如果你是一個人使用多個 Agent 工作，可以使用本機版。如果你想和團隊成員協作、跨多台裝置工作，或者希望把成果保存在一個共用的雲端工作空間裡，可以使用雲端版。

### 在雲端版本裡，我的團隊成員能看到我的私人工作內容嗎？

只有在雲端工作空間內建立的內容，才會被你邀請進該空間的人看到。如果你在 Tutti 雲端版裡建立一個工作空間並邀請團隊成員或朋友，他們就能看到並協作其中建構的內容。其他內容都會保持私密。

### Tutti 會取代我的 coding agent 嗎？

不會。Tutti 是圍繞你的 agents 建構的工作空間。你仍然可以繼續使用你已經信任的 Claude Code、Codex、Gemini 和其他 agents。

### Tutti 只適合 coding 嗎？

不是。Tutti 適用於 coding、設計、內容創作、應用工作流，以及任何需要多個 agents 或團隊成員共用同一脈絡和成果的工作場景。

## 快速開始

### 下載

<!-- TODO: Tutti · 本機版下載連結 -->

下載 Tutti · 本機版 —— 即將開放。

<!-- TODO: Tutti · 雲端版等候名單連結 -->

加入 Tutti · 雲端版等候名單 —— 即將開放。

### 從原始碼建置

環境需求：

- Node.js `24` 或更高（`.node-version` 固定了基線版本）
- pnpm `10.11.0`
- Go `1.24`

```sh
pnpm install
pnpm setup:dev
make dev-gui
```

完整開發指南見 [CONTRIBUTING.zh-TW.md](CONTRIBUTING.zh-TW.md)。

## 社群與貢獻

歡迎參與貢獻——請先閱讀[貢獻指南](CONTRIBUTING.zh-TW.md)，並了解我們的[行為準則](CODE_OF_CONDUCT.md)。

回報安全漏洞請參見 [SECURITY.md](SECURITY.md)。

加入我們的 Discord，認識團隊與其他開發者：

<img src="docs/assets/join-discord.jpg" alt="加入我們的 Discord —— 掃碼認識 Tutti" width="360" />

## 授權

Tutti 基於 [Apache License 2.0](LICENSE) 開放原始碼。

> 註：本程式碼庫使用內部代號 `tutti`，你會在目錄與二進位檔命名中看到它（如 `services/tuttid`）。

> 翻譯說明：本文件與英文版內容同步，如有出入，以[英文版](README.md)為準。
