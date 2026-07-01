# Codex App-Server Layer Refactor — Design

- Date: 2026-07-01
- Branch: `refactor/codex-appserver-layering`
- Status: Design (approved decisions, pending spec review)

## Problem

tutti already integrates the Codex **App Server** — `packages/agent/daemon/runtime/codex_appserver_adapter.go` implements `Start / Resume / Exec / Cancel / SubmitInteractive` and projects server requests into approval / interactive prompts. The integration works, but its *shape* has drifted into the same maintainability trap seen in the external reference projects:

1. **No typed protocol boundary.** Methods are hand-maintained string constants (`appServerMethodThreadStart = "thread/start"`, …) and payloads are hand-assembled `map[string]any`. Protocol drift is caught only by humans and tests.
2. **Tangled monoliths.** The Codex runtime layer is a few very large files mixing transport, lifecycle, protocol, event reduction, and approval handling:

   | File | Lines | Concerns mixed in |
   |---|---|---|
   | `codex_adapter.go` (Codex-over-ACP, legacy) | 3443 | initialize / prompt / lifecycle |
   | `codex_appserver_adapter.go` | 2182 | lifecycle + method strings + payload assembly |
   | `codex_appserver_events.go` | 1726 | event reduce / mapping |
   | `codex_appserver_review.go` | 140 | review |
   | `codex_appserver_startup_trace.go` | 187 | startup trace |

   ~7.3k hand-written lines covering **less** protocol surface, and harder to maintain, than the ~1.6k hand-written lines + generated types of the cleanest reference (`codex-sdk-go`).

This refactor is **shape-first** (option C): converge the existing integration into a clean, layered, codegen-anchored shape *without expanding capability scope first*. Capability parity is a later, separate effort that this shape unlocks.

## Goal & Scope

**In scope**
- Refactor the App-Server integration into layered, single-responsibility units backed by a typed protocol boundary.
- Behavior-preserving at every step (existing app-server tests stay green).
- Retire the legacy **Codex-over-ACP** adapter (`codex_adapter.go`) as the final cleanup milestone — **without** touching the generic ACP stack that other agents use.

**Out of scope (explicitly deferred)**
- Adding new protocol capabilities (fork / compact / realtime / inject_items surfacing, etc.). The codegen layer *makes them available* but wiring them into the product is separate work.
- Provider-relay / third-party-model concerns (a different product line; see CodexBridge `codex-provider-relay`).
- Renderer / desktop UI redesign. The daemon boundary is the subject; `apps/desktop` keeps consuming typed state/events.

## Key Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Only the *Codex-over-ACP* path (`codex_adapter.go`) is retired.** App-server is Codex's only future path. The **generic ACP stack is retained** — other agents integrate through it. | Product direction. `standard_acp_adapter.go` (Gemini / Hermes / Claude / future agents) and the shared ACP infra stay; only Codex's use of ACP goes away. |
| D2 | **The typed protocol boundary comes from codegen anchored on the official upstream schema**, not hand-written structs and not vendoring an external SDK. | Official `codex-rs/app-server-protocol` ships `src/bin/export.rs` emitting JSON Schema + TS (types `derive(JsonSchema, TS)`). Upstream is the single source of truth; drift becomes automatically visible. |
| D3 | **Codegen in one step** — no interim hand-written structs. | Avoids building a typed layer only to throw it away; the pipeline is small and already proven downstream. |
| D4 | **The JSON-RPC transport is already shared and stays shared.** `acp_client.go` is a generic JSON-RPC-over-stdio client (it already exposes both `newACPClient` and `newAppServerJSONRPCClient`); it is **retained** as generic infra. The refactor adds a typed `Client` façade *on top of it* for the Codex app-server path; generic ACP adapters keep using the shared client. | Do not introduce a second client and do not delete the shared one — the goal is a typed boundary above it, not a transport merge/removal. |
| D5 | **Do not vendor `codex-sdk-go` wholesale into the daemon core.** Use it as pipeline template + skeleton reference + calibration baseline. | Supply-chain trust for daemon core; its facade semantics are its own product opinions, not necessarily tutti's. |

## ACP Surface: Keep vs Remove

The ACP code in `packages/agent/daemon/runtime` is a **generic multi-agent stack** with a Codex-specific adapter layered on it. Only the Codex-specific adapter is removed.

| File | Disposition | Why |
|---|---|---|
| `standard_acp_adapter.go` | **Keep** | Generic ACP adapter serving Gemini / Hermes / Claude / future agents (`NewGeminiAdapter`, `NewHermesAdapter`, …). This is the reusable path. |
| `acp_client.go` | **Keep** | Generic JSON-RPC-over-stdio client, already dual-purpose (`newACPClient` + `newAppServerJSONRPCClient`). Shared by generic ACP adapters *and* the Codex app-server path. |
| `acp_live_state.go`, `acp_restore_errors.go`, `acp_turn_normalizer.go` | **Keep** | Shared helpers used by both the generic ACP adapters and the Codex app-server files. Generic turn/state normalization, not Codex-specific. |
| `codex_adapter.go` (3443) | **Remove (Step 6)** | Codex-over-ACP adapter — the legacy path. |
| `codex_appserver_*.go` | **Refactor** | The subject of this effort. |

**Invariant for the deletion (Step 6):** removing `codex_adapter.go` must leave the generic ACP stack fully functional; its tests (`standard_acp_adapter_test.go`, `acp_*_test.go`) stay green. Any Codex-only branch inside a shared `acp_*` helper is pruned in place, not by deleting the helper.

## Reference Mapping (borrow per-concern, never mono-copy)

| Layer / concern | Best reference | Notes |
|---|---|---|
| Protocol source of truth (types, method surface) | **Official `codex-rs/app-server-protocol`** `bin/export` (JSON Schema + TS, `--experimental` flag) | Everything else is downstream of this. |
| Event semantics / lossless tier | **Official `app-server-client`** (unifies in-process + remote into one `AppServerEvent`; deltas / `item/completed` / `turn/completed` must be delivered, progress may degrade) | Canonical backpressure design. |
| Go layering (Transport / Client / typed stubs / facade) | **`codex-sdk-go`** | Same language; ~1.6k hand-written lines cover ~90 client + 9 server methods via generated `types_gen.go` (3973 gen lines). Currency: tracks upstream (`rust-v0.142.3`, ~4 days behind as of writing). |
| Event reducer / tool mapping | `ai-sdk-provider-codex-asp` `CodexEventMapper` | Cross-turn tool-result backfill, worker affinity (only if/when needed). |
| Approval → durable pending state | `openclaw-codex-app-server` pending-input model | Approval/user-input becomes durable state + UI-driven response, not a blocking RPC handler. |
| Non-destructive hydration; approval stall detection | `Agmente` (loaded-thread read over resume), `CodexBridge` (approved-but-no-signal detection) | Referenced for later capability work; informs reducer/resolver interfaces now. |

## Invariant (tutti architecture rule)

Thread / turn / approval / history reconciliation lives in the daemon (`services/tuttid` / `packages/agent/daemon`). `apps/desktop` only consumes typed state/events and submits commands (approve / interrupt / start-turn). **The desktop must not grow into a second Codex business core.** Every step below preserves this.

## Target Architecture

```
                          ┌─ Event Reducer ──────→ tutti typed activity events (lossless tier)
Transport ──→ typed Client ┤   (app-server notifications)
 (stdio)      (pending req  ├─ Approval Resolver ──→ durable pending state + typed responder
              / server req  │   (server requests)
              / notif sub)  └─ Thread/Turn Facade ─→ lifecycle orchestration
                  ▲              (the thinned adapter)
           codexproto pkg (codegen; anchored on official export;
                           version-stamped; CI drift check)
                  ▲
       shared JSON-RPC client (acp_client.go) ── also serves ──▶ generic ACP stack
                  ▲                                              (standard_acp_adapter.go:
       Codex-over-ACP adapter (codex_adapter.go)                 Gemini / Hermes / Claude …)
       — legacy, deleted in Step 6                                — RETAINED
```

## Multi-Step Alignment Plan

Each step aligns exactly one layer to the codegen-anchored target, is independently shippable, and keeps the work-area tests green. Order: safety net → additive codegen → bottom-up (transport → events → approvals → facade) → legacy deletion last.

### Step 0 — Characterization safety net
- Establish existing `codex_appserver_*_test.go` as the behavioral contract.
- Add golden/characterization tests where thin: event reducer output, approval/interactive projection.
- Pin a Codex version baseline used by the tests.
- **Exit:** a test set that any subsequent step must keep green.

### Step 1 — Typed protocol layer (codegen, one step)
- New package (e.g. `packages/agent/daemon/runtime/codexproto`): run official `export` → generate protocol types + RPC stubs → version-stamp (codex commit/version).
- Add CI drift check (regenerate and diff).
- **Purely additive** — nothing consumes it yet.
- **Exit:** generated typed layer builds; drift check runs in CI.

### Step 2 — Typed Client façade over the shared transport
- Add a typed `Client` (pending requests, server-request handling, notification subscriptions) for the Codex app-server path, aligned to `codex-sdk-go` `rpc/`, **wrapping the existing shared `acp_client.go`** (the generic JSON-RPC-over-stdio client) rather than replacing it.
- App-server adapter now calls via typed stubs (`codexproto`) instead of string + `map[string]any`.
- **Do not** delete or restructure `acp_client.go` or the generic ACP adapters — they keep using the shared client as-is.
- **Exit:** Codex app-server path speaks through the typed `Client`; generic ACP stack untouched; tests green.

### Step 3 — Extract Event Reducer
- Pull event handling out of the 1726-line file into a focused reducer: app-server notification → tutti typed activity event.
- Bake in the official **lossless tier**: deltas / `item/completed` / `turn/completed` guaranteed; progress-class events may degrade.
- **Exit:** reducer is a standalone, tested unit; adapter no longer parses raw notifications inline.

### Step 4 — Extract Approval / Interactive Resolver
- Pull server-request handling (command/file/permissions approvals, `requestUserInput`, MCP elicitation) into a resolver that projects to durable pending state + a typed responder.
- Cover the **unknown / unsupported server-request** path with an explicit reject/error surface.
- **Exit:** approval flow is a standalone, tested unit.

### Step 5 — Thin the Adapter into a Thread/Turn facade
- What remains of `codex_appserver_adapter.go` collapses onto Thread/Turn lifecycle orchestration over the new layers (facade shape per `codex-sdk-go`).
- **Exit:** adapter is orchestration only; no protocol strings or inline reduction remain.

### Step 6 — Retire Codex-over-ACP
- Delete `codex_adapter.go` (3443) and any Codex-only helpers/branches; prune Codex-only branches inside shared `acp_*` helpers in place.
- **Explicitly preserve** `standard_acp_adapter.go`, `acp_client.go`, and the shared `acp_*` helpers — the generic ACP stack for other agents.
- **Exit:** Codex speaks only app-server; `codex_adapter.go` gone; generic ACP stack green (`standard_acp_adapter_test.go`, `acp_*_test.go`); full runtime package tests green.

## Testing Strategy

- **Contract:** Step 0's characterization tests are the invariant across all steps.
- **Per-layer:** Steps 2–5 each land their extracted unit with focused tests (transport/client, reducer, resolver, facade).
- **Drift:** Step 1's CI check regenerates `codexproto` and fails on unexpected diff, keeping the typed boundary honest against upstream.
- **Baseline command (work area):** `go build ./runtime/...` + `go test ./runtime/ -run <app-server pattern>` in `packages/agent/daemon`.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Codegen toolchain depends on the Rust `export` bin / `go-jsonschema` | Vendor/pin the schema output or the export step; document the regen command; CI drift check catches skew. |
| Upstream schema churn mid-refactor | Pin a baseline version (Step 0); treat version bumps as isolated, reviewable diffs. |
| Behavior regressions during extraction | Behavior-preserving steps gated by the Step 0 contract; one layer per step. |
| Step 6 deletion accidentally breaks the generic ACP stack (shared client/helpers) | Keep/Remove table + deletion invariant make the boundary explicit; generic ACP tests gate the deletion; prune Codex-only branches in place, never delete shared helpers. |
| Large blast radius if steps are batched | Each step is independently shippable and reviewable; do not combine. |

## Open Questions (for spec review)

- Exact package name/location for the generated protocol layer (`codexproto` vs elsewhere).
- Whether the `export` bin output is committed (vendored) or regenerated in CI from a pinned codex checkout.
- Whether Step 3/4 interfaces should already anticipate the deferred capability work (hydration, stall detection) or stay minimal now.
