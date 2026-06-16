<div align="center">

<img src="docs/assets/banner.jpg" alt="Tutti" width="720" />

**人与 Agent「同频」协作的地方。**

[官网](https://tutti.sh) · [文档](docs/README.md) · [参与贡献](CONTRIBUTING.zh-CN.md)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-tutti.sh-black.svg)](https://tutti.sh)

</div>

---

喜欢 Tutti？欢迎给我们一个 Star、Fork 仓库、提交 Issue，或者发起 PR。

我们正在和社区一起构建 Tutti。欢迎加入我们的 Discord，认识团队和其他构建者，分享反馈、提出问题，并一起参与接下来的建设：

<img src="docs/assets/join-discord.jpg" alt="加入我们的 Discord —— 扫码认识 Tutti" width="360" />

## Tutti 是什么？

Agent 默认各做各的。Tutti 将它们带入同一个实时工作空间，在这里你的 Claude、Codex、Gemini 能共享上下文、文件、应用和正在运行的任务。你的 Codex 能看到 Claude 构建了什么。

不仅如此，Tutti 还有自己的应用生态：生图、UI/UX 设计、写文档、做 PPT。你可以使用这些应用，你的 Agent 也可以调用。

Codex 调用生图应用做了一张图，Claude Code 可以直接拿去做页面开发，不需要你来回复制粘贴。

一切在 Tutti 中彼此可见、互相连接。任何产物，包括应用生成的输出，都可以在不同 Agent 之间传递，并直接用于下一步。

无需终端。无需复杂配置。打开 Tutti，就可以开始构建。

## 功能

### 实时工作空间

Agent 不再简单交接摘要，而是共享同一个实时工作空间：共享上下文、文件、在跑的任务、应用。你的 Codex 能看到 Claude 改了什么、正在运行什么、项目当前处于什么状态。由此解锁两项能力：

**Big @**

- 在 Codex 中，你可以用 `@` 引用历史对话、文件、应用、应用产物和任务，无需反复复制粘贴，也不用重新上传。
- 你也可以在 Codex 中引用 Claude Code 的历史对话、文件、应用、应用产物和任务，并在此基础上继续构建，无需手动搬运上下文。

**任务编排与多项目构建**

- 各 Agent 彼此「可见」，因此可以自动回避或处理冲突，自行判断该并行还是串行。跨不同服务商的 Agent，比如 Claude 和 Codex、Gemini 和 OpenClaw（DeepSeek），也能协同工作，互不干扰。

![实时工作空间 —— Agent 共享同一份实时上下文、文件与运行态](docs/assets/live-workspace.jpg)

### 原生应用

应用运行在 Tutti 上，你和你的 Agent 都能用。你可以亲自上手，也可以让任意 Agent 调用。用官方、社区共建或自定义的应用来生成图片、视频等内容。

所有应用都复用你已有的 Agent 订阅。

![原生应用 —— 官方、社区共建或自建应用，你和 Agent 都能调用](docs/assets/apps.jpg)

### 任务编排

无需手动拆分每一步。你只需要描述目标。Tutti 会把它拆解为清晰的任务。你只需要审核，再分配给合适的 Agent。

![任务编排 —— 描述目标，Tutti 自动拆解为清晰可分配的任务](docs/assets/goal-to-tasks.jpg)

### 控制中心

不用再在多个 Tab 中来回切换。一个视图看全局：所有 Agent 对话、待你审批的操作、正在运行的任务。需要你确认的地方，快速定位一键批。

![控制中心 —— 所有 Agent 对话、待审批操作与运行中任务尽在一个视图](docs/assets/your-control.jpg)

### 复用你原有的订阅

直接接入你已有的 Claude、Codex、Gemini 订阅。所有应用和 Agent 都在此基础上运行，零额外费用。

![复用你原有的订阅 —— 直接接入已有的 Claude、Codex、Gemini 订阅](docs/assets/bring-your-own-subscriptions.jpg)

### 自定义你的工作空间

你可以根据自己的使用习惯，设置深色 / 浅色模式，更换桌面背景，调整程序坞位置，自定义图标样式等。

![自定义你的工作空间 —— 深色 / 浅色模式、桌面背景、程序坞位置与图标样式](docs/assets/personalize-your-workspace.jpg)

## Tutti 适合谁

任何用 AI Agent 来 build 的人：只要你受够了在不同 Agent、应用之间来回切换，受够了反复重新交代背景、手动搬运产物，受够了为每份订阅单独花钱，Tutti 就是为你设计的。

- **独立开发者**：让 Claude 出方案，Codex 接力开发，不用再重复解释项目背景。
- **设计师**：用设计应用出设计稿，直接让 Codex 拿去开发落地。
- **产品经理**：让 Codex 写完 PRD 后，自动调用 UI/UX 设计应用出原型，不用再打开 Figma。

无论你是什么角色，都能在这里找到各环节里摩擦最低的使用组合方式。全 GUI 界面，无需终端命令行，打开就能用。

## 你可以用 Tutti 做什么

**Tutti · 本地版**（Agent 运行在本地，产物在本地）

- 让 Codex 接着 Claude 的工作继续做，无需重新说明上下文。
- 让 Claude 写完 PRD 后，直接调用设计应用生成图片。
- 使用你已有的 Agent 订阅，调用 Tutti 内的所有应用。
- 描述一个目标，让 Agent 将其拆解成多个子任务，再把每个任务分配给合适的 Agent 执行。

**Tutti · 云端版**（Agent 运行在本地，产物自动在云端）

包含本地版的全部能力，额外实现：

- 开一个云端空间，让多台设备在里面工作，就像在用同一台电脑。
- 和朋友协作时，不用互相发文件、贴进度、总结 Agent 刚做了什么。只要你们在同一个云端工作空间，就能看到彼此在这个空间里的对话、文件、产物、任务进展及应用生成的结果。
- 用 `@` 引用同事的文件、与 Agent 的对话等，并让你的 Agent 在此基础上构建。
- 你本地跑起来的网站（localhost），不用先部署上线，朋友就能在云端工作空间里直接打开预览，给你提意见、帮你改。
- 当任务需要多人时，可以把任务分配给同事的 Agent 执行。

> ⚠️ 以上共享仅以工作空间为维度：邀请人与受邀人需加入同一工作空间，只有在同一工作空间内产出的内容才会被共享，其余内容都保持私密。

## Tutti · 本地版 vs Tutti · 云端版

|              | Tutti · 本地版（开源）                                | Tutti · 云端版（即将上线）                                           |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
| **适合谁**   | 一个人，多个 Agent                                    | 一个人，多个 Agent · 一个人，多台设备 · 两人及以上，及各自的多 Agent |
| **跑在哪**   | 本地，产物在本地                                      | 本地，产物自动在云端                                                 |
| **共享什么** | 多个 Agent 之间共享上下文、应用、产物、任务和运行状态 | 包含本地版的全部内容，另外支持多人、多设备之间共享                   |
| **订阅**     | 你自己的 Claude、Codex、Gemini 等订阅                 | 你自己的 Claude、Codex、Gemini 等订阅                                |

本仓库包含的是 **Tutti · 本地版**：桌面应用与本地守护进程，基于 Apache-2.0 协议免费开源。Tutti · 云端版是独立的托管服务，其代码不在本仓库中。

## FAQ

### 我需要另外购买一个 Agent 订阅吗？

不需要。Tutti 可以使用你已经在用的 Claude、Codex、Gemini 以及其他 Agent 订阅。

### 如果我没有 Agent 订阅怎么办？

你可以在 Tutti 内使用 Tutti Agent。Tutti Agent 在 Early Access 期间免费，之后可能会采用按用量计费。

### Tutti 本地版和云端版有什么区别？

如果你是一个人使用多个 Agent 工作，可以使用本地版。如果你想和团队成员协作、跨多台设备工作，或者希望把产物保存在一个共享的云端工作空间里，可以使用云端版。

### 在云端版本里，我的团队成员能看到我的私人工作内容吗？

只有在云端工作空间内创建的内容，才会被你邀请进该空间的人看到。如果你在 Tutti 云端版里创建一个工作空间并邀请团队成员或朋友，他们就能看到并协作其中构建的内容。其他内容都会保持私密。

### Tutti 会替代我的 coding agent 吗？

不会。Tutti 是围绕你的 agents 构建的工作空间。你仍然可以继续使用你已经信任的 Claude Code、Codex、Gemini 和其他 agents。

### Tutti 只适合 coding 吗？

不是。Tutti 适用于 coding、设计、内容创作、应用工作流，以及任何需要多个 agents 或团队成员共享同一上下文和产物的工作场景。

## 快速开始

### 下载

<!-- TODO: Tutti · 本地版下载链接 -->

下载 Tutti · 本地版 —— 即将开放。

<!-- TODO: Tutti · 云端版 waitlist 链接 -->

加入 Tutti · 云端版 waitlist —— 即将开放。

### 从源码构建

环境要求：

- Node.js `24` 或更高（`.node-version` 固定了基线版本）
- pnpm `10.11.0`
- Go `1.24`

```sh
pnpm install
pnpm setup:dev
make dev-gui
```

完整开发指南见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## 社区与贡献

欢迎参与贡献——请先阅读[贡献指南](CONTRIBUTING.zh-CN.md)，并了解我们的[行为准则](CODE_OF_CONDUCT.md)。

报告安全漏洞请参见 [SECURITY.md](SECURITY.md)。

## 协议

Tutti 基于 [Apache License 2.0](LICENSE) 开源。

> 注：本代码库使用内部代号 `tutti`，你会在目录和二进制命名中看到它（如 `services/tuttid`）。

> 翻译说明：本文档与英文版内容同步，如有出入，以 [英文版](README.md) 为准。
