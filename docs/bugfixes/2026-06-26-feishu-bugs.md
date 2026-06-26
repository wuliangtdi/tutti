# 2026-06-26 Feishu Bug Records

## Avz6rluJkenUiBclttvcETu9nNb - user prompt image/text spacing

- Link: https://ccn53rwonxso.feishu.cn/record/Avz6rluJkenUiBclttvcETu9nNb
- Base record id: `recvmIdLrHJPZm`
- Bug: 复制图片到输入框，和文字一起发送后，会话详情里图片和文字间隔较远。
- Evidence: Feishu attachment `image.png` shows a narrow screenshot preview above the user text bubble with a large visual gap before the text.
- Cause: User prompt image thumbnails were rendered inside a fixed 80px square preview. Wide clipboard screenshots could make the preview area read as empty spacing before the following text bubble.
- Fix: Render single user prompt images as proportional thumbnails with a 160px column and 80px max height, while keeping multi-image grids compact at 80px columns.
- Verification:
  - `corepack pnpm --dir packages/agent/gui exec vitest run --environment jsdom shared/agentConversation/components/AgentTranscriptItemView.spec.tsx`
  - `corepack pnpm --filter @tutti-os/agent-gui typecheck`
  - Web check: opened `http://127.0.0.1:5173/`; page rendered Agent GUI without framework overlay. Current local workspace had no user image message to reproduce visually.
- Status: fixed locally
- Commit: `40cb83d1`
- Feishu status update: confirmed `已修复待打包`.

## QZHZrXdLje5vLNcl0o5c7J61ndb - agent link opens new browser node

- Link: https://ccn53rwonxso.feishu.cn/record/QZHZrXdLje5vLNcl0o5c7J61ndb
- Base record id: `recvngl9SFXOxy`
- Bug: 打开浏览器后再在会话里点击网页链接，会覆盖之前打开的浏览器窗口。
- Evidence: Feishu screen recording shows an existing browser node on Google search, then a conversation URL click navigates that same browser node to the new URL.
- Cause: Agent GUI `open-url` actions used the default workspace browser launch behavior, which reuses the current browser node when one exists.
- Fix: Pass `reuseIfOpen: false` for Agent GUI URL actions so conversation links launch a fresh browser node instead of replacing the current one.
- Verification:
  - `node --import ./apps/desktop/test/register-asset-stub.mjs --test --experimental-strip-types ./apps/desktop/src/renderer/src/features/workspace-agent/services/desktopAgentGUILinkActions.test.ts`
  - `corepack pnpm --filter @tutti-os/desktop typecheck`
  - Web check: opened `http://127.0.0.1:5173/`; page rendered Agent GUI. Existing local conversation link clicks were blocked by the current virtualized transcript/preview layer, so the browser-node behavior was verified by the targeted link action test.
- Status: fixed locally
- Commit: pending; final hash recorded in batch summary.
- Feishu status update: confirmed `已修复待打包`.

## C9Ywrblb9epPvHctNLicN4Z6nJd - completed session still processing

- Link: https://ccn53rwonxso.feishu.cn/record/C9Ywrblb9epPvHctNLicN4Z6nJd
- Base record id: `recvnkVFkJKczo`
- Bug: 会话已完成但一直显示“正在规划下一步”，再发消息显示排队中。
- Evidence: Feishu attachment shows completed tool calls while the transcript still has the processing row and the composer send button remains busy/queued.
- Cause: Agent Activity snapshot projection mapped legacy Host DTO status from `session.status` alone. Runtime state can report lifecycle `active` with `currentPhase: idle` or `turnLifecycle.phase: settled`; ignoring those fields leaves Agent GUI with stale working/queued state.
- Fix: Normalize `status`, `currentPhase`, and `turnLifecycle.phase` together when projecting activity-core sessions into Agent GUI Host DTOs.
- Verification:
  - `corepack pnpm@10.11.0 --filter @tutti-os/agent-gui test -- shared/agentActivitySnapshotProjection.spec.ts`
  - `corepack pnpm@10.11.0 check:agent-activity-runtime-boundaries`
- Status: fixed locally
- Commit: `95b39cc0`
- Feishu status update: confirmed `修复中`.

## CQs9rF6GhekdMAcbDhsc1Q9PnWA - Create App session stops early / command detail empty

- Link: https://ccn53rwonxso.feishu.cn/record/CQs9rF6GhekdMAcbDhsc1Q9PnWA
- Base record id: `recvnD5oHgq1ot`
- Bug: 创建应用任务跑到一半自动停止显示完成，点击最后输出的“执行命令”无任何显示。
- Evidence: Feishu log bundle `tutti-logs-20260626-143851.zip` shows ACP event flow around the issue with `call.failed`, later `session.updated`, and no app crash; app-center snapshot shows the `系统监控` factory job failed validation because no `tutti.app.json` was produced.
- Cause: Same Agent GUI projection gap as above made runtime lifecycle/phase transitions unreliable in the transcript and composer state. The app factory itself marked the job failed after validation; the user-visible "completed/empty command" symptom came from the conversation state projection.
- Fix: Same shared status tuple normalization used for the completed-session issue.
- Verification:
  - `node /Users/wwcome/.codex/skills/feishu-bug-runner/scripts/feishu_bug_fetcher.mjs analyze /private/tmp/feishu-bug-runner/recvnD5oHgq1ot/tutti-logs-20260626-143851.zip --issue '创建应用 任务 跑到一半 自动停止 显示完成 最后输出 执行命令 无任何显示' --anchor '2026-06-26 14:38:42'`
  - `corepack pnpm@10.11.0 --filter @tutti-os/agent-gui test -- shared/agentActivitySnapshotProjection.spec.ts`
  - `corepack pnpm@10.11.0 check:agent-activity-runtime-boundaries`
- Status: fixed locally
- Commit: `95b39cc0`
- Feishu status update: confirmed `修复中`.
