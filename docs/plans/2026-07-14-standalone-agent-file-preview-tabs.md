# Standalone Agent File Preview Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the Files tool tab open while each opened file appears as its own reusable top-level tab in the standalone Agent right sidebar.

**Architecture:** Extend the UI-local standalone Agent tab model with a file-preview tab descriptor keyed by normalized path. Route file-open requests into that descriptor, focus an existing matching tab when possible, and render the tab body through the existing workspace file-preview workbench contribution so file loading, editing, save state, and host adapters stay shared.

**Tech Stack:** React, TypeScript, Node test runner, `@tutti-os/workbench-surface`, existing desktop workspace file-preview contribution.

---

### Task 1: Model file-preview tabs

**Files:**

- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/standaloneAgentToolSidebarModel.ts`
- Test: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/standaloneAgentToolSidebarModel.test.ts`

**Steps:**

1. Add failing reducer tests proving a file-preview descriptor can be added, reactivated by stable path identity, labeled with its file name, and closed independently.
2. Run the focused model test and confirm the new assertions fail.
3. Introduce a discriminated tab descriptor and reducer action for opening a file-preview tab while preserving existing tool-tab behavior.
4. Run the model test and confirm it passes.

### Task 2: Render a shared file-preview surface

**Files:**

- Create: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/StandaloneAgentFilePreviewPanel.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/StandaloneAgentToolSidebarPanel.tsx`
- Test: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/standaloneAgentToolWorkbench.test.ts`

**Steps:**

1. Add a failing integration-shape test requiring file-preview tabs to select the existing `workspace-file-preview` contribution and render its node body without a second file-loading implementation.
2. Run the focused workbench test and confirm it fails.
3. Build a narrow embedded context for the existing contribution, including activation, runtime state, snapshot state, and title updates.
4. Render that panel only for file-preview tab descriptors and keep the Files manager behavior unchanged.
5. Run the focused workbench test and confirm it passes.

### Task 3: Route file opens to tabs

**Files:**

- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/StandaloneAgentWindow.tsx`
- Modify: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/StandaloneAgentToolSidebar.tsx`
- Test: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/StandaloneAgentWindow.test.ts`
- Test: `apps/desktop/src/renderer/src/features/workspace-workbench/ui/standaloneAgentToolWorkbench.test.ts`

**Steps:**

1. Add failing tests for forwarding the complete activation target and for displaying the manager tab plus a file-name tab.
2. Change the standalone canvas launcher to retain the complete `WorkspaceFileActivationTarget`; keep path-only external reveal requests opening the Files manager.
3. On a previewable file request, add or focus its file-preview tab and resize the right sidebar using the Files panel width rules.
4. Resolve tab label and icon from the tab descriptor, without adding hardcoded user-visible copy.
5. Run focused tests.

### Task 4: Verify and document

**Files:**

- Modify if needed: `docs/architecture/agent-gui-node.md`

**Steps:**

1. Run the standalone sidebar model and workbench tests.
2. Run desktop typecheck and the changed-aware repository check.
3. Build the desktop renderer if focused checks pass.
4. Review the live standalone Agent interaction when the dev session is available: open Files, open two distinct files, switch between all three tabs, reopen one file, and close tabs in different orders.
5. Update the Agent GUI architecture note if the file-preview tab ownership/data flow is not already explicit.
