# Agent Activity Packages

Status: implementation converging. The canonical core, desktop adapter, Agent
GUI runtime input, grouped node contract, and Message Center snapshot model are
implemented. The controller is 715 lines and acts as a thin assembly module.
Activation settings and results are core-owned canonical contracts; legacy
Host Session, activation, pin, `providerTargetRef`, and synthesized
`session_update` mirrors are removed. Persisted launch-field readers remain
only at explicit private migration seams, and product consumers read canonical
sessions through activity-core selectors.

This document records the package split for reusable Agent Activity and Agent
GUI surfaces. The goal is to make the agent session data flow reusable by other
repositories while keeping host-specific transport and desktop integration out
of the shared packages.

## Goals

- Replace the legacy `@tutti-os/agentactivity-renderer` package name with
  clearer public package names.
- Put reusable agent session state, event merging, and attention selectors
  behind a host-agnostic core package.
- Keep `apps/desktop` responsible for `tuttid`, preload, Electron, local file,
  and runtime integration.
- Let Agent GUI and the future Agent Message Center consume one shared Agent
  Activity snapshot instead of building separate session caches.
- Prepare for external repository adoption through a narrow adapter interface.

## Package Plan

The long-term package family is:

```text
packages/agent/activity-core
  @tutti-os/agent-activity-core

packages/agent/gui
  @tutti-os/agent-gui

packages/agent/message-center
  @tutti-os/agent-message-center
```

This iteration creates the first two packages only.
`@tutti-os/agent-message-center` remains a planned package name until the
header message UI is implemented.

## Responsibilities

### `@tutti-os/agent-activity-core`

`agent-activity-core` is host-agnostic and must not import React, Electron,
desktop preload APIs, or the generated `tuttid` client.

It owns:

- agent activity contracts used by UI packages and host adapters
- the host adapter interface
- session and message snapshot state
- live event subscription lifecycle
- retained stream reference counting when multiple consumers watch the same
  session
- message merge, version ordering, and duplicate handling
- selectors for reusable derived state
- `selectNeedsAttentionCount`
- `selectNeedsAttentionItems`
- the workspace session engine (`createAgentSessionEngine` under
  `src/engine/`): intent dispatch loop, domain-composed pure reducers,
  command-description effect executor, expiry-intent clock, and intent frame
  batching, with scheduler/clock/command ports injected by the host (see
  `docs/architecture/agent-gui-refactor-plan.md` section 3.3)

It does not own:

- HTTP path construction
- authentication
- `EventSource` or fetch implementation details
- `tuttid` generated client usage
- workspace file access
- Electron IPC or preload APIs
- React hooks or UI components

### `@tutti-os/agent-gui`

`agent-gui` is the renamed successor of
`@tutti-os/agentactivity-renderer`.

It owns:

- `AgentGUI`
- `AgentActivityRuntime` provider and hooks
- Agent GUI workbench node UI
- session list and detail rendering
- timeline, tool call, approval, and interactive prompt presentation
- package-owned stylesheet entrypoint
- React-facing hooks or providers that are specific to Agent GUI

It may depend on `@tutti-os/agent-activity-core`.

Agent GUI must read and write agent session/activity data through
`AgentActivityRuntime`. `AgentHostApi` remains available for host capabilities
such as files, clipboard, runtime metadata, account lookup, composer options,
and temporary desktop-only session-control behavior.
Conversation rail sections are also an `AgentActivityRuntime` contract:
AgentGUI calls `listSessionSections` for the first page of every returned rail
section and `listSessionSectionPage` for Show more by `sectionKey` and cursor.
Hosts must pass those calls through to the daemon section endpoints so project
sections come from current user projects and session membership comes from
persisted `rail_section_key`, not frontend cwd grouping or project-root
filters.
The `listSessionSections` bootstrap also carries the first pinned session page,
and pinned Show more uses the dedicated pinned page endpoint/runtime method.
Pinned is not a section kind; it is a session/rail-record projection derived
from `pinnedAtUnixMs` so pinned conversations can render on first load even
when they are older than the first ordinary project or Chats page.
When AgentGUI's provider rail is narrowed to one target, the runtime request
must include `agentTargetId`; hosts and the daemon apply it before section
pagination so `hasMore` describes the target-filtered rail, not the unfiltered
workspace history.
Activating a conversation must not by itself call `listSessionSections` again.
Likewise, active detail provider changes should not reload section first pages.
AgentGUI may merge updated props for already-rendered rows from the activity
snapshot, but section first-page reloads should be tied to workspace, rail
filter, user project, or session membership changes.

`AgentActivity*` types are the canonical frontend agent activity data model.
Agent GUI must import `AgentActivitySession`, `AgentActivitySnapshot`, and
`AgentActivityPresence` from `agent-activity-core`; it must not recreate those
entities in a handwritten aggregate. GUI-only projections stay in focused
timeline, synchronization, summary, and message-overlay modules. Working and
completion decisions derive from canonical `activeTurn` and `latestTurn`
state, not from legacy session-level lifecycle mirrors.
Canonical sessions also carry typed `settings`, `permissionConfig`,
`capabilities`, `usage`, `backgroundAgents`, `goal`, and `imported` fields from
the daemon. Desktop adapters preserve those fields and must not recreate them
from `runtimeContext`, `lastError`, or module-global per-session defaults.
Provider context-window and quota updates enter the daemon at the runtime
adapter boundary, are split into typed durable session metadata, and reach
Agent GUI through the protocol-v2 `usage` field. GUI projections must not read
provider-private runtime context to render usage. Existing
session control state is read from the daemon; pre-session edits remain in the
engine-owned activation/draft record until the daemon confirms the session.
`AgentHostWorkspaceAgent*` types may only appear in compatibility or projection
layers while the legacy Agent GUI internals are being migrated. Production read
paths must not call `workspaceAgents.list`,
`workspaceAgents.listSessionMessages`, `agentSessions.retainEventStream`, or
`agentSessions.subscribeEvents` directly. Production write paths must not call
`agentSessions.exec`, `agentSessions.cancel`,
`agentSessions.submitInteractive`, or `agentSessions.pinSession`; use
`AgentActivityRuntime` instead. Legacy host DTOs are allowlisted only in the
host API contract, explicit projection helpers, and message merge/page-loading
helpers that accept runtime-shaped adapters.

The desktop activity diagnostics module is the only narrow consumer allowed to
serialize legacy lifecycle fields while comparing old host events with the
canonical model. Those values are diagnostic evidence only and must never feed
session, turn, submit, or rendering decisions.

Slash command behavior is descriptor-authoritative. The provider catalog's
typed slash policy owns fallback commands and command effects; a missing policy
produces no provider slash commands or local command effects. Agent GUI must not
infer Cursor, Codex, Claude, or universal command behavior from provider names.

The synthesized `plan-implementation` / `implement` decision crosses the
desktop boundary as one semantic, turn-and-request-scoped daemon command with
a caller-stable idempotency key. Desktop transport must not expand that command
into local settings or send operations. `tuttid` prepares a leased
`plan_decision` operation, checkpoints the idempotent plan-mode target write,
persists `send_dispatched` before provider execution, and confirms the result
only from a different durable turn/message carrying the operation's stable
`clientSubmitId`; an unknown send result is never blindly replayed. Completion
and its outbox event commit atomically. The `send_dispatched` checkpoint also
persists a session-level `agent_system_notice` with notice kind
`plan_implementation_pending_confirmation` and its message-update outbox event
in the same transaction, so an open client can observe the unknown window even
if the provider call hangs or the process exits. Completion upgrades the same
message to `plan_implementation_completed`, and its outbox publishes both the
confirmed turn and notice update. These payloads contain semantic IDs only;
user-visible copy belongs to consumer i18n. Provider-originated exit-plan
prompts remain ordinary durable interaction responses and use the existing
`interactive_response` operation rather than this synthetic-plan endpoint.

Protocol-v2 session responses expose `activeTurnId` (required and nullable),
`pendingInteractions` (required and never null), independent `activeTurn` /
`latestTurn` projections, typed capabilities/usage/background-agent/goal/import
fields, and Unix-millisecond timestamps. They do not expose legacy session
status, turn lifecycle, submit availability, last error, ISO timestamps, or
the raw runtime context. SQLite migrations split typed session metadata from
provider-private recovery context, remove the legacy status/current-phase/
last-error/runtime-context columns, and enforce nullable exact
`active_turn_id` ownership plus Turn/Interaction/message foreign keys. Public
activity events are version 2: full Turn and Interaction entities use
`turn_update`/`interaction_update`; a session invalidation that requires an
authoritative read is explicitly named `session_reconcile_required` and must
never be applied as a partial Session entity. The old public `state_patch` and
storage message row id are removed.

Message `turnId` is explicitly nullable. Runtime execution messages should use
the exact durable Turn id, while historical imports without trustworthy
provider turn boundaries stay session-scoped (`turnId = null`); import must not
manufacture one live synthetic Turn per transcript message.

It should not know how a host connects to `tuttid`, opens SSE streams, resolves
workspace paths, or talks to Electron.

### `@tutti-os/agent-message-center`

This package is planned but not created in this iteration.

It is expected to own:

- the header Agent Message trigger
- needs-attention badge UI
- needs-attention popover/list UI
- actions that open the relevant Agent GUI session or submit the required user
  response

It should consume `agent-activity-core` selectors instead of interpreting raw
message payloads directly.

### `apps/desktop`

The desktop app owns the concrete adapter from `tuttid` and Electron runtime
capabilities into `agent-activity-core`.

It owns:

- `tuttid` client calls
- SSE connection implementation
- backend base URL and authentication details
- preload/runtime/file adapters
- `IWorkspaceAgentActivityService` and the desktop
  `AgentActivityRuntime` wrapper
- workspace chrome placement
- workbench contribution wiring
- desktop i18n overrides

`WorkspaceAgentActivityService` is the desktop renderer source for workspace
agent activity snapshots. Desktop chrome MessageCenter and AgentGUI workbench
nodes must subscribe to the same service instance for the same workspace.

## Core Adapter Shape

The core package should be constructed from a host adapter rather than from
desktop-specific objects:

```ts
createAgentActivityController({
  workspaceId,
  adapter
});
```

The adapter should expose the host operations needed by the controller:

```ts
export interface AgentActivityAdapter {
  listSessions(input: {
    workspaceId: string;
    signal?: AbortSignal;
  }): Promise<AgentActivitySessionList>;

  listSessionMessages(input: {
    workspaceId: string;
    agentSessionId: string;
    afterVersion?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<AgentActivityMessagePage>;

  subscribeSessionEvents(input: {
    workspaceId: string;
    agentSessionId: string;
    afterVersion?: number;
    signal: AbortSignal;
    onEvent(event: AgentActivitySessionEventEnvelope): void;
    onError?(error: unknown): void;
  }): Promise<() => void>;

  createSession(
    input: AgentActivityCreateSessionInput
  ): Promise<AgentActivitySession>;
  sendInput(
    input: AgentActivitySendInput
  ): Promise<AgentActivitySendInputResult>;
  cancelTurn(input: {
    workspaceId: string;
    agentSessionId: string;
    turnId: string;
  }): Promise<AgentActivityTurnCancelResult>;
  respondPermission(
    input: AgentActivityPermissionResponseInput
  ): Promise<unknown>;
  deleteSession(
    input: AgentActivityDeleteSessionInput
  ): Promise<AgentActivityDeleteSessionResult>;
}
```

`AgentActivitySendInputResult` contains the authoritative canonical `turn` in
addition to its session and turn id. Desktop adapters must reject a successful
transport response that omits that turn; they must not reconstruct it from the
deprecated session-level lifecycle or submit-availability fields.

`AgentActivityRuntime.activateSession` requires `agentTargetId` for
`mode: "new"`. Shared UI passes it through unchanged; trusted host or daemon code
resolves it against `agent_targets`, validates enabled state and launch ref
shape, and derives the execution `provider` and runtime `providerTargetRef`
from the resolved target. Target-backed create requests may omit `provider`; if
both fields are present, the daemon rejects provider mismatches. Client-provided
`providerTargetRef` is not allowed to override the daemon-derived runtime ref
when `agentTargetId` is present. The resulting
`AgentActivitySession` and session events should preserve `agentTargetId` when
present. State patch reducers must update the session when an event includes
`agentTargetId`, but a patch that omits the field must not clear an existing
target id because older runtimes and historical imports are provider-only.

Composer options are cached by `agentTargetId` when a target-backed request
includes one. Provider-keyed composer options remain a legacy/provider-only
cache and serve only requests without an `agentTargetId`; target-backed UI must
not fall back to it. While a live session refreshes its catalog, UI may continue
presenting an already loaded target snapshot, but a genuinely missing target
snapshot remains loading until target-scoped options arrive. Target-backed loads
must not reuse or overwrite the provider cache. Each composer-options snapshot
also carries its effective pre-session settings; AgentGUI resolves displayed
settings field by field in this order: authoritative session settings,
optimistic first-create settings, preloaded effective settings, then home
defaults. A partial session projection must not erase a usable preloaded model
or reasoning selection while live metadata is still arriving. Because the
effective settings are request-dependent, composer-options cache freshness and
in-flight reuse include both normalized `cwd` and normalized requested settings;
target/provider identity alone is not a complete cache key.

Composer-options loading may be suppressed while a new-session activation is
pending, but that guard follows the current engine state rather than a
mount-time snapshot. The transition from creating to settled must trigger a
fresh target-scoped load so model, reasoning, skill, and slash-command metadata
cannot remain absent for the lifetime of the node. Before the first
target-scoped composer-options snapshot arrives, configurable-setting support is
unknown rather than unsupported: the composer footer renders disabled loading
controls for permission and model/reasoning selection, then replaces or removes
them according to the authoritative snapshot. Slash command fallback and effect
policy remain provider-descriptor-owned; every supported provider that exposes
local fallback commands declares them in its registry descriptor.

`AgentActivityCreateSessionInput.providerTargetRef` is an optional opaque
host-owned legacy reference for selecting which target under the real provider
should launch the session. It is not authority, a credential, or an invocation
plan. New runtime launches must provide `agentTargetId`; `providerTargetRef`
must not be used as a provider-only launch fallback. Target-backed launches use
the daemon-derived ref shape from `agent_targets` instead. Adapters and trusted
launchers must re-authenticate and resolve it before using any concrete provider
invocation. UI packages must keep `provider` as the real provider identity and
must not synthesize providers for shared or remote targets.

The adapter decides how to connect. The controller decides when to connect,
when to disconnect, and how to merge the resulting events.

Hosts may accept older provider/runtime reports with missing transcript
ownership or ordering fields, but those gaps must be filled before events enter
`agent-activity-core` or `@tutti-os/agent-gui`. Session-level notices and
statuses should use state patches or explicit notice semantics; they should not
be published as ordinary assistant transcript messages without a turn scope.
Activity reports may carry a host-defined user id in the activity source before
they reach durable session projection. Local single-user hosts should leave the
field empty instead of deriving it from account login state; cloud
collaboration hosts may inject real account user ids so downstream views can
distinguish self-owned and peer-owned sessions. Reporters run on the streaming
persistence hot path, so identity enrichment there must use host-provided local
state; it must not call account refresh or user-info APIs that perform network
round-trips or write refreshed auth state.

## Stream Lifecycle

SSE lifecycle belongs in `agent-activity-core` at the semantic level:

- subscribe when a session is visible, active, or explicitly retained by a UI
- retain one stream for multiple consumers of the same session
- abort and unsubscribe when the last consumer releases the session
- merge live message events into the cached snapshot
- keep persisted message pages and live events ordered by version
- deduplicate messages by stable message identity and version
- treat transcript `message_update` messages as normalized input: each message
  must have `messageId`, positive `version`/`seq`, `turnId`, and
  `occurredAtUnixMs` before core merges it

SSE implementation belongs in the host adapter:

- URL construction
- token or cookie usage
- `EventSource`, `fetch`, IPC, or another transport
- raw protocol decoding
- host-specific retry capability

Generic retry and backoff can live in core only when the adapter exposes enough
transport-neutral error information.

## Needs Attention Contract

The future Agent Message Center counts user-actionable items, not all session
messages.

The initial selector surface is:

```ts
selectNeedsAttentionCount(snapshot): number;
selectNeedsAttentionItems(snapshot): AgentActivityNeedsAttentionItem[];
```

`AgentActivityNeedsAttentionItem` should contain:

```ts
export interface AgentActivityNeedsAttentionItem {
  id: string;
  workspaceId: string;
  agentSessionId: string;
  provider: string;
  title: string;
  cwd: string;
  kind: "permission" | "question" | "constraint" | "other";
  summary: string;
  occurredAtUnixMs: number;
}
```

The selector should count pending actionable prompts such as permission
approvals, ask-user questions, and constraint confirmations. Completed,
canceled, superseded, or already answered prompts must not be counted.

Failed sessions are not automatically needs-attention items unless they expose a
specific user action that can resolve the failure.

## Migration Plan

### Step 1: Breaking package rename

Move the legacy package:

```text
packages/agent/renderer
@tutti-os/agentactivity-renderer
```

to:

```text
packages/agent/gui
@tutti-os/agent-gui
```

Update all imports, stylesheet imports, Vite externals, package references,
local shims, and boundary documentation.

The stylesheet contract becomes:

```ts
import "@tutti-os/agent-gui/styles.css";
```

This step should not change runtime behavior.

### Step 2: Create `agent-activity-core`

Create `packages/agent/activity-core` with:

- package manifest and build scripts
- public contracts
- adapter interface
- controller/store skeleton
- message merge helpers
- needs-attention selectors
- unit tests for merge and attention counting

The package must typecheck without React or desktop dependencies.

### Step 3: Add the desktop adapter

In `apps/desktop`, create a concrete adapter that wraps the generated
`tuttid` client and event stream APIs.

Desktop keeps transport and host knowledge. Core receives normalized contracts.

The first implementation routes desktop session-message cache merging and
retained event stream lifecycle through `agent-activity-core`. The concrete
desktop adapter owns the `tuttid` calls, SSE subscription, and host event
normalization.

`createDesktopAgentHostApi` remains the compatibility adapter from the shared
activity controller into the existing Agent GUI Host API. It may still call
desktop-only Host APIs directly when those operations are outside the shared
activity snapshot.

### Step 4: Connect Agent GUI to core

Update `@tutti-os/agent-gui` and the desktop Agent GUI workbench body to use
the shared controller or snapshot source.

AgentGUI now requires `agentActivityRuntime: AgentActivityRuntime` in
production. Desktop passes a runtime wrapper over
`WorkspaceAgentActivityService` together with `agentHostApi`.

AgentGUI production code should call the runtime hook directly and keep
UI-local state limited to selection, drafts, scroll/loading/error state,
highlight state, and optimistic overlays. Legacy host session-control helpers
(`activate`, `unactivate`, `getState`, `updateSettings`, and
`getComposerOptions`) remain temporary host capabilities; they must not be used
as list, timeline, message, or write-operation data sources.

`@tutti-os/agent-gui` now also exposes
`buildAgentActivitySnapshotProjection(snapshot)`, so shared Agent GUI surfaces
can start from the core snapshot and shared needs-attention selectors without
rebuilding Host DTO projection locally.

### Step 5: Message Center Snapshot Model

Do not create an empty `@tutti-os/agent-message-center` package in this
iteration.

Desktop chrome MessageCenter remains in `@tutti-os/agent-gui` for now. Its
model is derived directly from `AgentActivitySnapshot`,
`AgentActivitySession`, `AgentActivityMessage`, and
`selectNeedsAttentionItems`; it must not round-trip through
`AgentHostWorkspaceAgent*` DTOs.

## Testing Expectations

For package rename work:

- `pnpm typecheck`
- `pnpm --filter @tutti-os/desktop typecheck`
- `pnpm check:ui-boundaries` when stylesheet boundary rules change
- `pnpm check:renderer-boundaries` when desktop renderer imports change

For `agent-activity-core`:

- unit tests for message merge ordering and deduplication
- unit tests for retained stream lifecycle
- unit tests for needs-attention selectors
- package typecheck

For desktop adapter integration:

- existing desktop workspace-agent tests
- adapter tests for `tuttid` response normalization
- live event merge tests using a fake subscription adapter

For Agent GUI behavior:

- existing Agent GUI component and projection tests
- focused tests for working, waiting, completed, failed, and needs-attention
  states
- tests that AgentGUI list/detail and write operations use
  `AgentActivityRuntime` when provided

For runtime boundary enforcement:

- `pnpm check:agent-activity-runtime-boundaries`
- the same check is included in `pnpm check:full`

## Non-Goals

- Do not move desktop transport into a package.
- Do not create a vague `shared`, `common`, or `utils` package.
- Do not create an empty message-center package before there is UI behavior.
- Do not rewrite all Agent GUI projection code in the first migration step.
- Do not change daemon HTTP contracts without first updating
  `services/tuttid/api/openapi/tuttid.v1.yaml`.

## Review Rules

- New public exports in `agent-activity-core` should be stable contracts, not
  convenience exports for one host.
- A selector belongs in core when both Agent GUI and Agent Message Center can
  consume it without knowing host details.
- A React hook belongs in `agent-gui` or the future `agent-message-center`, not
  in core.
- A `tuttid` mapping belongs in the desktop adapter unless it is a
  host-agnostic contract type.
- External repository adoption should require implementing the adapter, not
  copying session merge or needs-attention logic.
