# PRD: Agent Unified Dock

## 1. Summary

This PRD defines the first iteration of the Agent dock upgrade.

The product direction is to aggregate the existing Codex and Claude Code dock
entries behind one Agent dock entry, while keeping provider-specific Agent GUI
nodes available. The first iteration supports only native local CLI targets for
Codex and Claude Code. Future iterations can add user-defined agent targets,
including skill-backed personas, without changing the dock model again.

The default rollout mode remains the current split dock experience. Users can
switch to the unified dock experience through the existing settings preference
system.

## 2. Goals

- Keep the legacy split dock as the default experience.
- Add an AB setting that lets users switch between split and unified Agent dock
  layouts.
- Introduce a lightweight Agent Target data model with default system targets
  for Codex and Claude Code.
- In unified mode, show one Agent dock entry that groups all Agent GUI nodes.
- Preserve provider-specific multi-window behavior. Codex and Claude Code nodes
  may still be opened at the same time.
- Add first-iteration conversation-list filters: All, Codex, Claude Code.
- Keep composer provider selection independent from the top filter.
- Preserve historical sessions, historical workbench node state, and legacy
  dock entry launch compatibility.

## 3. Non-Goals

- Do not build user-defined agent personas in this iteration.
- Do not add skill configuration, prompt templates, MCP configuration, model
  defaults, or permission defaults to the Agent Target table.
- Do not migrate or rewrite historical sessions.
- Do not force all providers into one singleton Agent GUI window.
- Do not make the top filter change the composer provider.
- Do not remove legacy dock entry identifiers.

## 4. Terminology

- **Provider**: the real execution provider, such as `codex` or `claude-code`.
- **Agent Target**: a selectable launch target shown in Agent UI. First
  iteration targets map one-to-one to native local CLI providers.
- **Launch ref**: a controlled provider-facing JSON union that describes the
  target identity needed for launch. It is not a general extension bag.
- **Split dock**: the current behavior where Codex and Claude Code have
  separate dock entries.
- **Unified dock**: the new behavior where one Agent dock entry groups
  provider-specific Agent GUI nodes.

## 5. Agent Target Data Model

Create a durable Agent Target registry in `services/tuttid`.

### 5.1 Table Shape

```sql
agent_targets

id                  text primary key
provider            text not null
launch_ref_json     text not null
name                text not null
icon_key            text
enabled             integer not null default 1
source              text not null
sort_order          integer not null default 0
created_at_ms       integer not null
updated_at_ms       integer not null
```

### 5.2 Field Semantics

- `id`: stable Agent Target identity used by UI state, preferences, and future
  launch attribution.
- `provider`: real execution provider. For this iteration, supported values are
  `codex` and `claude-code`.
- `launch_ref_json`: controlled launch-target reference. It describes only the
  provider target identity needed for launch.
- `name`: display name.
- `icon_key`: stable icon lookup key. It is presentation metadata, not launch
  logic.
- `enabled`: whether the target should be selectable.
- `source`: ownership of the target record. First iteration values are
  `system` and `user`.
- `sort_order`: deterministic display order.
- `created_at_ms` / `updated_at_ms`: durable timestamps.

### 5.3 Launch Ref Schema

`launch_ref_json` must be validated as a controlled union. It must not become a
free-form configuration blob.

First iteration:

```ts
type AgentTargetLaunchRef = {
  type: "local_cli";
  provider: "codex" | "claude-code";
};
```

Rules:

- `launch_ref_json.type` must be a known union discriminator.
- `launch_ref_json.provider` must match the table `provider`.
- UI display must not read labels, icons, or sort behavior from
  `launch_ref_json`.
- Composer settings must not be stored in `launch_ref_json`.
- Skill, prompt, MCP, model, and permission configuration must not be stored in
  `launch_ref_json`.

Future extension example:

```ts
type AgentTargetLaunchRef =
  | { type: "local_cli"; provider: "codex" | "claude-code" }
  | { type: "agent_profile"; provider: string; profile_id: string };
```

The profile payload itself should live in a separate profile/config table.

### 5.4 Default Rows

Initialize two system targets during repository/workspace setup:

```json
{
  "id": "local:codex",
  "provider": "codex",
  "launch_ref_json": {
    "type": "local_cli",
    "provider": "codex"
  },
  "name": "Codex",
  "icon_key": "codex",
  "enabled": true,
  "source": "system",
  "sort_order": 10
}
```

```json
{
  "id": "local:claude-code",
  "provider": "claude-code",
  "launch_ref_json": {
    "type": "local_cli",
    "provider": "claude-code"
  },
  "name": "Claude Code",
  "icon_key": "claude-code",
  "enabled": true,
  "source": "system",
  "sort_order": 20
}
```

System rows must not be deleted by normal user actions. They may be disabled or
hidden only through explicit product behavior.

## 6. AB Setting

Add a setting through the existing desktop preference path.

```ts
type AgentDockLayout = "legacySplit" | "unified";
```

Default:

```text
legacySplit
```

Behavior:

- `legacySplit`: keep current separate Codex and Claude Code dock entries.
- `unified`: show one Agent dock entry that groups all Agent GUI nodes.
- Switching the setting must not migrate sessions or rewrite workbench state.
- The setting is a presentation preference. It does not affect provider
  execution, session storage, or Agent Target records.

## 7. Dock Behavior

### 7.1 Legacy Split Mode

Keep current behavior:

- Codex has its own dock entry.
- Claude Code has its own dock entry.
- Existing node matching and launch behavior remain compatible.

### 7.2 Unified Mode

Unified mode changes dock presentation only:

- Render one Agent dock entry.
- The Agent dock entry matches all Agent GUI nodes, regardless of provider.
- Multiple provider-specific Agent GUI nodes can be open at the same time.
- The dock popup/minimized preview groups matching Agent GUI nodes under the
  single Agent entry.

Dock click default behavior:

```text
if matching Agent GUI nodes exist
  -> use existing workbench grouped dock behavior
else
  -> create an Agent GUI node for the first available target
```

Default target resolution:

```text
desktopPreferences.defaultAgentProvider if currently available
-> first enabled Agent Target by sort_order whose provider is available
-> Codex fallback
```

Availability should consider provider probe status when available. `enabled`
alone is not enough to prove the local CLI can run on the current machine.

## 8. Launch Compatibility

Legacy identifiers remain valid:

- `agent-gui` continues to mean Codex when no provider is otherwise specified.
- `agent-gui:codex` continues to mean Codex.
- `agent-gui:claude-code` continues to mean Claude Code.

Launch resolution rules:

- If the launch payload includes a provider, use that provider.
- If the launch payload includes a session id, resolve the session provider and
  open/focus the corresponding provider-specific Agent GUI node.
- If the launch comes from a legacy provider dock id, preserve that provider.
- In unified mode, the resulting node is still grouped under the single Agent
  dock entry.

Historical workbench state must continue to render:

- Existing Codex nodes remain Codex nodes.
- Existing Claude Code nodes remain Claude Code nodes.
- Switching AB modes must not delete, rewrite, or merge existing nodes.

## 9. Conversation Filtering

Unified Agent GUI adds a top filter with exactly these first-iteration options:

- All
- Codex
- Claude Code

Rules:

- The filter affects only the conversation list.
- The filter does not change the composer provider.
- The filter does not change the default target for the next launch.
- Historical sessions are filtered by `session.provider`.
- If future sessions include `agent_target_id`, filtering must still fall back
  to `session.provider` so old sessions remain visible.

## 10. Composer Behavior

Composer provider/target selection is out of scope for this iteration except
for compatibility with existing behavior.

Rules:

- Top filter and composer provider are independent.
- Selecting Codex or Claude Code in the filter must not mutate composer state.
- Existing composer defaults by provider remain valid.
- New target-aware composer UX will be designed separately.

## 11. API And Runtime Notes

The implementation should keep the existing Agent Activity boundaries:

```text
tuttid durable data and provider launch
  -> desktop AgentActivityAdapter / WorkspaceAgentActivityService
  -> AgentActivityRuntime
  -> AgentGUI UI and local view state
```

Ownership:

- `services/tuttid` owns Agent Target storage, validation, default rows, and
  provider-facing launch ref validation.
- `apps/desktop` owns concrete preference wiring, provider availability probing,
  and workbench contribution configuration.
- `@tutti-os/agent-gui` owns reusable Agent GUI presentation, target list
  consumption, and conversation-list filtering.

Do not put durable Agent Target business rules only in `apps/desktop`.

## 12. Acceptance Criteria

### Data

- A fresh workspace has system Agent Targets for Codex and Claude Code.
- `launch_ref_json` is validated as a controlled union.
- Invalid launch refs are rejected or ignored safely.
- System targets cannot be accidentally deleted through normal target editing.

### Settings

- The Agent dock layout setting exists in the existing settings/preference
  system.
- Default value is `legacySplit`.
- Changing the setting updates dock presentation without restarting the app.

### Legacy Split

- Codex and Claude Code dock entries behave as they do today.
- Existing tests for provider-specific dock launch behavior still pass.

### Unified Dock

- Only one Agent dock entry is visible for Agent GUI.
- Codex and Claude Code Agent GUI nodes can both be open.
- The Agent dock popup groups all matching Agent GUI nodes.
- Clicking Agent when no node is open creates a node for the first available
  target.
- Legacy launch ids still route to the correct provider-specific node.

### Filtering

- The top filter includes All, Codex, and Claude Code only.
- Filtering changes the conversation list only.
- Composer provider/target state does not change when the filter changes.
- Historical sessions without target ids remain visible under provider filters.

## 13. Suggested Test Coverage

- Agent Target default row initialization and validation.
- Desktop preference default and update behavior for `agentDockLayout`.
- Workbench contribution creates split entries in `legacySplit`.
- Workbench contribution creates one grouped Agent entry in `unified`.
- Legacy dock ids still parse and launch the expected provider.
- Unified dock matches existing Codex and Claude Code nodes.
- Conversation filter model handles All, Codex, Claude Code, and historical
  sessions.
- Composer state is unchanged after filter changes.

## 14. Rollout

Phase 1:

- Add Agent Target registry with two system rows.
- Add AB preference, defaulting to `legacySplit`.
- Keep current dock behavior unchanged by default.

Phase 2:

- Enable unified dock behind the setting.
- Add top filter in unified Agent GUI.
- Verify historical session and node compatibility.

Phase 3:

- Design target-aware composer UX.
- Add user-defined Agent Targets and profile/config tables if product scope
  requires them.
