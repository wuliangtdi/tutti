# Codex 节点 Prompt 预填方案

## 目标

任务中心点击 Agent 动作时，只唤起或复用一个 Codex Agent GUI 节点，把生成好的 prompt 填入输入框，等待用户手动发送。

该流程不能创建 agent session，也不能触发执行。

## 现状问题

原来的任务中心链路会走：

```text
IssueManager action
  -> WorkspaceAgentPromptSessionService.createSession({ prompt })
  -> WorkspaceAgentActivityService.activateSession({
       mode: "new",
       initialContent: [{ type: "text", text: prompt }]
     })
  -> requestWorkspaceAgentGuiLaunch({ agentSessionId, provider })
```

`initialContent` 会创建真实 runtime session，并进入 Agent 执行链路，所以不适合作为“只填入 prompt”的能力。

## 新链路

```text
IssueManager action
  -> build prompt text
  -> requestWorkspaceAgentGuiLaunch({
       draftPrompt,
       provider,
       userProjectPath,
       workspaceId
     })
  -> WorkspaceWorkbench
  -> host.launchNode(createWorkspaceAgentGuiDraftLaunchRequest(...))
  -> Workbench 复用一个已有 provider 节点，或创建一个新节点
  -> 节点收到 agent-gui:prefill-prompt activation
  -> AgentGUI 写入 composer draft 并聚焦输入框
```

## 节点响应规则

V1 复用 Workbench 现有 `reuseDockEntryNode` 机制：

- 使用目标 provider 的 `dockEntryId`，Codex 为 `agent-gui`。
- `reuseDockEntryNode: true`。
- 如果已有匹配节点，只把 activation 交给被 Workbench 选中的那个节点。
- 如果没有匹配节点，Workbench 会创建一个新 Agent GUI 节点响应。

因此不会出现多个 Codex 节点同时响应同一个监听。这个设计不是广播，而是一次 launch 对应一个目标节点 activation。

## 数据契约

新增瞬时 activation：

```ts
export const agentGuiWorkbenchPrefillPromptActivationType =
  "agent-gui:prefill-prompt";

export interface AgentGuiWorkbenchPrefillPromptPayload {
  draftPrompt: string;
  userProjectPath?: string | null;
}
```

该 payload 只用于本次 launch，不写入持久化 Workbench snapshot，也不写入外部 node state。

## AgentGUI 消费规则

AgentGUI 节点收到 prefill request 后：

- 根据 activation `sequence` 做幂等，重复 sequence 不会覆盖用户已经编辑的草稿。
- 如果当前正停留在某个会话，先 best-effort `unactivate` 当前会话。
- 切回 home composer。
- 把 prompt 写入 provider 默认草稿槽位。
- 如果带有 `userProjectPath`，同步更新 composer 的项目路径。
- 聚焦输入框。

明确禁止在 prefill 路径中调用：

- `activateSession({ mode: "new" })`
- `sendInput`
- `WorkspaceAgentPromptSessionService.createSession`

## 任务中心行为

任务中心的执行 prompt 和拆解 prompt 继续复用原有 prompt 生成逻辑，但 desktop adapter 不再先创建 session，而是把 prompt 作为 `draftPrompt` 交给 Agent GUI launch。

按钮文案同步改为：

- `填入 Agent`
- `填入拆解提示`

避免用户误以为点击后已经执行。

## 验证点

已覆盖：

- Workbench draft launch request 和 descriptor。
- draft launch 复用 provider dock entry，且没有 `targetAgentSessionId`。
- AgentGUI prefill 写入草稿、不调用 activate、不调用 sendInput。
- 重复 activation sequence 不覆盖用户编辑。
- 任务中心 adapter 只 launch draft prompt，不调用 session creator。
- 中英文任务中心文案更新。
