import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type {
  Options as ClaudeQueryOptions,
  SDKMessage,
  SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk";

type RequestEnvelope = {
  id?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

type SidecarEvent = {
  id?: string;
  type: string;
  payload?: Record<string, unknown>;
};

type PromptQueueItem =
  | {
      type: "message";
      message: SDKUserMessage;
    }
  | {
      type: "close";
    };

type ClaudeQueryRuntime = AsyncIterable<SDKMessage> & {
  initializationResult?: () => Promise<unknown>;
  interrupt?: () => Promise<void>;
  close?: () => void;
};

class AsyncPromptQueue {
  private readonly values: PromptQueueItem[] = [];
  private readonly waiters: Array<
    (value: IteratorResult<SDKUserMessage>) => void
  > = [];
  private closed = false;

  push(message: SDKUserMessage): void {
    if (this.closed) {
      throw new Error("prompt queue is closed");
    }
    this.offer({ type: "message", message });
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.offer({ type: "close" });
  }

  async *iterate(): AsyncIterable<SDKUserMessage> {
    for (;;) {
      const next = await this.next();
      if (next.done) {
        return;
      }
      yield next.value;
    }
  }

  private offer(item: PromptQueueItem): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      if (item.type === "close") {
        waiter({ done: true, value: undefined });
      } else {
        waiter({ done: false, value: item.message });
      }
      return;
    }
    this.values.push(item);
  }

  private next(): Promise<IteratorResult<SDKUserMessage>> {
    const item = this.values.shift();
    if (item) {
      if (item.type === "close") {
        return Promise.resolve({ done: true, value: undefined });
      }
      return Promise.resolve({ done: false, value: item.message });
    }
    if (this.closed) {
      return Promise.resolve({ done: true, value: undefined });
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

class SessionRuntime {
  readonly promptQueue = new AsyncPromptQueue();
  query: ClaudeQueryRuntime | undefined;
  providerSessionId: string;
  activeTurnId = "";
  private readonly cwd: string;
  private readonly env: Record<string, string | undefined>;
  private readonly restore: boolean;
  private readonly testDriver: boolean;
  private assistantText = "";
  private consuming = false;

  constructor(
    providerSessionId: string,
    cwd: string,
    env: Record<string, string | undefined>,
    restore: boolean,
    testDriver: boolean
  ) {
    this.providerSessionId = providerSessionId;
    this.cwd = cwd;
    this.env = env;
    this.restore = restore;
    this.testDriver = testDriver;
  }

  async start(): Promise<void> {
    if (this.restore) {
      await this.ensureQuery({ initialize: true });
    }
    emit({
      type: "session_started",
      payload: {
        providerSessionId: this.providerSessionId
      }
    });
  }

  exec(turnId: string, prompt: string): void {
    this.activeTurnId = turnId;
    this.assistantText = "";
    if (this.testDriver) {
      emit({
        type: "assistant_delta",
        payload: {
          turnId,
          content: `Echo: ${prompt}`,
          snapshot: `Echo: ${prompt}`
        }
      });
      emit({
        type: "assistant_completed",
        payload: {
          turnId,
          content: `Echo: ${prompt}`
        }
      });
      emit({
        type: "turn_completed",
        payload: {
          turnId,
          stopReason: "end_turn"
        }
      });
      return;
    }
    this.promptQueue.push({
      type: "user",
      session_id: this.providerSessionId,
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [{ type: "text", text: prompt }]
      }
    } as SDKUserMessage);
    void this.ensureQuery()
      .then(() => this.consume())
      .catch((error) => {
        emit({
          type: "turn_failed",
          payload: {
            turnId: this.activeTurnId,
            error: errorMessage(error)
          }
        });
      });
  }

  async cancel(): Promise<void> {
    if (this.query?.interrupt) {
      await this.query.interrupt();
    }
    if (this.activeTurnId) {
      emit({
        type: "turn_canceled",
        payload: {
          turnId: this.activeTurnId
        }
      });
    }
  }

  close(): void {
    this.promptQueue.close();
    this.query?.close?.();
  }

  private consume(): void {
    if (!this.query || this.consuming) {
      return;
    }
    this.consuming = true;
    void (async () => {
      try {
        for await (const message of this.query ?? []) {
          this.handleMessage(message);
        }
      } catch (error) {
        emit({
          type: "turn_failed",
          payload: {
            turnId: this.activeTurnId,
            error: errorMessage(error)
          }
        });
      } finally {
        this.query = undefined;
        this.consuming = false;
      }
    })();
  }

  private async ensureQuery(
    startOptions: { initialize?: boolean } = {}
  ): Promise<void> {
    if (this.query || this.testDriver) {
      return;
    }
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const queryOptions: ClaudeQueryOptions = {
      cwd: this.cwd || process.cwd(),
      env: {
        ...process.env,
        ...this.env,
        CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS: "1"
      },
      includePartialMessages: true,
      ...(this.restore
        ? { resume: this.providerSessionId }
        : { sessionId: this.providerSessionId }),
      systemPrompt: { type: "preset", preset: "claude_code" }
    };
    this.query = query({
      prompt: this.promptQueue.iterate(),
      options: queryOptions
    }) as ClaudeQueryRuntime;
    if (startOptions.initialize) {
      try {
        await this.query.initializationResult?.();
      } catch (error) {
        this.query.close?.();
        this.query = undefined;
        throw error;
      }
    }
  }

  private handleMessage(message: SDKMessage): void {
    const sessionId = readSDKSessionID(message);
    if (sessionId && sessionId !== this.providerSessionId) {
      this.providerSessionId = sessionId;
      emit({
        type: "session_state",
        payload: {
          providerSessionId: sessionId
        }
      });
    }

    if (message.type === "stream_event") {
      const event = (message as { event?: unknown }).event;
      if (!event || typeof event !== "object") {
        return;
      }
      const streamEvent = event as {
        type?: string;
        delta?: { type?: string; text?: string; thinking?: string };
      };
      if (streamEvent.type !== "content_block_delta") {
        return;
      }
      const delta = streamEvent.delta;
      if (!delta) {
        return;
      }
      const text =
        delta.type === "text_delta"
          ? delta.text
          : delta.type === "thinking_delta"
            ? delta.thinking
            : "";
      if (!text) {
        return;
      }
      if (delta.type === "text_delta") {
        this.assistantText += text;
        emit({
          type: "assistant_delta",
          payload: {
            turnId: this.activeTurnId,
            content: text,
            snapshot: this.assistantText
          }
        });
      }
      return;
    }

    if (message.type === "assistant") {
      const text = assistantTextFromMessage(message);
      if (text) {
        this.assistantText = text;
        emit({
          type: "assistant_completed",
          payload: {
            turnId: this.activeTurnId,
            content: text
          }
        });
      }
      return;
    }

    if (message.type === "result") {
      const result = message as { subtype?: string; errors?: string[] };
      if (result.subtype === "success") {
        emit({
          type: "turn_completed",
          payload: {
            turnId: this.activeTurnId,
            stopReason: "end_turn"
          }
        });
      } else {
        emit({
          type: "turn_failed",
          payload: {
            turnId: this.activeTurnId,
            error: result.errors?.[0] ?? "Claude SDK turn failed"
          }
        });
      }
    }
  }
}

const sessions = new Map<string, SessionRuntime>();

async function handleRequest(request: RequestEnvelope): Promise<void> {
  const id = typeof request.id === "string" ? request.id : undefined;
  try {
    switch (request.type) {
      case "start": {
        const payload = request.payload ?? {};
        const agentSessionId = stringValue(payload.agentSessionId);
        const providerSessionId =
          stringValue(payload.providerSessionId) || crypto.randomUUID();
        const session = new SessionRuntime(
          providerSessionId,
          stringValue(payload.cwd),
          envObject(payload.env),
          booleanValue(payload.restore),
          process.env.TUTTI_CLAUDE_SDK_SIDECAR_TEST_DRIVER === "1"
        );
        sessions.set(agentSessionId, session);
        await session.start();
        emit({
          id,
          type: "ok",
          payload: { providerSessionId: session.providerSessionId }
        });
        return;
      }
      case "exec": {
        const payload = request.payload ?? {};
        const session = requireSession(stringValue(payload.agentSessionId));
        session.exec(stringValue(payload.turnId), stringValue(payload.prompt));
        emit({ id, type: "ok" });
        return;
      }
      case "cancel": {
        const payload = request.payload ?? {};
        const session = requireSession(stringValue(payload.agentSessionId));
        await session.cancel();
        emit({ id, type: "ok" });
        return;
      }
      case "close": {
        const payload = request.payload ?? {};
        const agentSessionId = stringValue(payload.agentSessionId);
        const session = sessions.get(agentSessionId);
        session?.close();
        sessions.delete(agentSessionId);
        emit({ id, type: "ok" });
        return;
      }
      default:
        throw new Error(`unsupported request type ${request.type ?? ""}`);
    }
  } catch (error) {
    emit({
      id,
      type: "error",
      payload: {
        error: errorMessage(error)
      }
    });
  }
}

function requireSession(agentSessionId: string): SessionRuntime {
  const session = sessions.get(agentSessionId);
  if (!session) {
    throw new Error(`session ${agentSessionId} is not started`);
  }
  return session;
}

function emit(event: SidecarEvent): void {
  stdout.write(`${JSON.stringify(event)}\n`);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function envObject(value: unknown): Record<string, string | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string | undefined> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function readSDKSessionID(message: SDKMessage): string {
  const value = (message as { session_id?: unknown }).session_id;
  return typeof value === "string" ? value : "";
}

function assistantTextFromMessage(message: SDKMessage): string {
  const content = (message as { message?: { content?: unknown } }).message
    ?.content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      const item = block as { type?: unknown; text?: unknown };
      return item.type === "text" && typeof item.text === "string"
        ? item.text
        : "";
    })
    .join("");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const lines = readline.createInterface({ input: stdin });
for await (const line of lines) {
  if (!line.trim()) {
    continue;
  }
  try {
    await handleRequest(JSON.parse(line) as RequestEnvelope);
  } catch (error) {
    emit({
      type: "error",
      payload: {
        error: errorMessage(error)
      }
    });
  }
}
