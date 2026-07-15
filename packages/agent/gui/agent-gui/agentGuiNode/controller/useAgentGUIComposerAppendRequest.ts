import {
  agentComposerDraftFiles,
  emptyAgentComposerDraft,
  updateAgentComposerDraft
} from "../model/agentComposerDraft";
import type {
  AgentComposerDraft,
  AgentComposerDraftFile
} from "../model/agentGuiNodeTypes";
import { resolveAgentComposerDraftScopeKey } from "../model/agentComposerDraftScope";

export interface AgentGUIComposerAppendRequest {
  files: readonly AgentComposerDraftFile[];
  sequence: number;
}

export function appendAgentGUIComposerFiles(
  draft: AgentComposerDraft,
  incomingFiles: readonly AgentComposerDraftFile[]
): AgentComposerDraft {
  const files = agentComposerDraftFiles(draft);
  const knownIds = new Set(files.map((file) => file.id));
  for (const file of incomingFiles) {
    if (!knownIds.has(file.id)) {
      knownIds.add(file.id);
      files.push({ ...file });
    }
  }
  return updateAgentComposerDraft(draft, { files });
}

export function resolveAgentGUIComposerAppendRequest(input: {
  activeConversationId: string | null;
  draftByScopeKey: Record<string, AgentComposerDraft>;
  handledSequence: number | null;
  request?: AgentGUIComposerAppendRequest | null;
}): {
  draftKey: string;
  nextDraft: AgentComposerDraft;
  sequence: number;
} | null {
  const {
    activeConversationId,
    draftByScopeKey,
    handledSequence,
    request = null
  } = input;
  if (!request || handledSequence === request.sequence) {
    return null;
  }
  const draftKey = resolveAgentComposerDraftScopeKey({
    agentSessionId: activeConversationId
  });
  const currentDraft = draftByScopeKey[draftKey] ?? emptyAgentComposerDraft();
  return {
    draftKey,
    nextDraft: appendAgentGUIComposerFiles(currentDraft, request.files),
    sequence: request.sequence
  };
}
