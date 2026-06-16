//nolint:unused // Retain migrated helpers until the next agent-daemon decomposition pass.
package agentsessionstore

import (
	"context"
	"strings"
)

func ReportActivityAsSessionUpdates(
	ctx context.Context,
	reporter SessionActivityReporter,
	input ReportActivityInput,
) (ReportActivityReply, error) {
	reply := ReportActivityReply{
		AcceptedTimelineItemCount: 0,
	}
	if reporter == nil {
		return reply, nil
	}
	for _, stateInput := range SessionStateInputsFromActivity(input) {
		stateReply, err := reporter.ReportSessionState(ctx, stateInput)
		if err != nil {
			return reply, err
		}
		if stateReply.Accepted {
			reply.AcceptedStatePatchCount++
		}
		reply.RequestBodyBytes += stateReply.RequestBodyBytes
	}
	for _, messagesInput := range SessionMessageInputsFromActivity(input) {
		messagesReply, err := reporter.ReportSessionMessages(ctx, messagesInput)
		if err != nil {
			return reply, err
		}
		reply.AcceptedMessageUpdateCount += messagesReply.AcceptedCount
		reply.RequestBodyBytes += messagesReply.RequestBodyBytes
	}
	return reply, nil
}

func SessionStateInputsFromActivity(input ReportActivityInput) []ReportSessionStateInput {
	if len(input.StatePatches) == 0 {
		return nil
	}
	source := input.Source
	source.SessionOrigin = canonicalSessionOriginValue(source.SessionOrigin)
	out := make([]ReportSessionStateInput, 0, len(input.StatePatches))
	for _, patch := range input.StatePatches {
		agentSessionID := strings.TrimSpace(firstNonEmptyString(
			patch.AgentSessionID,
			source.AgentID,
			source.ProviderSessionID,
		))
		if agentSessionID == "" {
			continue
		}
		out = append(out, ReportSessionStateInput{
			WorkspaceID:    input.WorkspaceID,
			AgentSessionID: agentSessionID,
			SessionOrigin:  source.SessionOrigin,
			Connector:      cloneConnector(input.Connector),
			Source:         source,
			State:          sessionStateUpdateFromPatch(patch),
		})
	}
	return out
}

func SessionMessageInputsFromActivity(input ReportActivityInput) []ReportSessionMessagesInput {
	updates := mergeActivityMessageUpdates(nil, input.MessageUpdates)
	if len(updates) == 0 {
		return nil
	}
	source := input.Source
	source.SessionOrigin = canonicalSessionOriginValue(source.SessionOrigin)
	indexBySession := make(map[string]int)
	out := make([]ReportSessionMessagesInput, 0)
	for _, update := range updates {
		agentSessionID := strings.TrimSpace(firstNonEmptyString(
			update.AgentSessionID,
			source.AgentID,
			source.ProviderSessionID,
		))
		if agentSessionID == "" {
			continue
		}
		converted := SessionMessageUpdateFromActivityUpdate(update)
		if strings.TrimSpace(converted.MessageID) == "" {
			continue
		}
		index, ok := indexBySession[agentSessionID]
		if !ok {
			index = len(out)
			indexBySession[agentSessionID] = index
			out = append(out, ReportSessionMessagesInput{
				WorkspaceID:    input.WorkspaceID,
				AgentSessionID: agentSessionID,
				SessionOrigin:  source.SessionOrigin,
				Connector:      cloneConnector(input.Connector),
				Source:         source,
			})
		}
		out[index].Updates = append(out[index].Updates, converted)
	}
	return out
}

func mergeActivityMessageUpdates(derived []WorkspaceAgentMessageUpdate, explicit []WorkspaceAgentMessageUpdate) []WorkspaceAgentMessageUpdate {
	if len(derived) == 0 {
		return append([]WorkspaceAgentMessageUpdate(nil), explicit...)
	}
	if len(explicit) == 0 {
		return derived
	}
	explicitIDs := make(map[string]struct{}, len(explicit))
	for _, update := range explicit {
		agentSessionID := strings.TrimSpace(update.AgentSessionID)
		messageID := strings.TrimSpace(update.MessageID)
		if agentSessionID == "" || messageID == "" {
			continue
		}
		explicitIDs[agentSessionID+"\x00"+messageID] = struct{}{}
	}
	out := make([]WorkspaceAgentMessageUpdate, 0, len(derived)+len(explicit))
	for _, update := range derived {
		key := strings.TrimSpace(update.AgentSessionID) + "\x00" + strings.TrimSpace(update.MessageID)
		if _, ok := explicitIDs[key]; ok {
			continue
		}
		out = append(out, update)
	}
	out = append(out, explicit...)
	return out
}

func SessionMessageUpdateFromActivityUpdate(update WorkspaceAgentMessageUpdate) WorkspaceAgentSessionMessageUpdate {
	payload := clonePayloadMap(update.Payload)
	if payload == nil {
		payload = map[string]any{}
	}
	if update.Seq > 0 {
		payload["seq"] = update.Seq
	}
	if callID := strings.TrimSpace(update.CallID); callID != "" {
		payload["callId"] = callID
	}
	if parentCallID := strings.TrimSpace(update.ParentCallID); parentCallID != "" {
		payload["parentCallId"] = parentCallID
	}
	if rootCallID := strings.TrimSpace(update.RootCallID); rootCallID != "" {
		payload["rootCallId"] = rootCallID
	}
	if title := strings.TrimSpace(update.Title); title != "" {
		payload["title"] = title
	}
	if len(payload) == 0 {
		payload = nil
	}
	return WorkspaceAgentSessionMessageUpdate{
		MessageID:         strings.TrimSpace(update.MessageID),
		TurnID:            strings.TrimSpace(update.TurnID),
		Role:              strings.TrimSpace(update.Role),
		Kind:              strings.TrimSpace(update.Kind),
		Status:            strings.TrimSpace(update.Status),
		Payload:           payload,
		OccurredAtUnixMS:  update.OccurredAtUnixMS,
		StartedAtUnixMS:   update.StartedAtUnixMS,
		CompletedAtUnixMS: update.CompletedAtUnixMS,
	}
}

func sessionStateUpdateFromPatch(patch WorkspaceAgentStatePatch) WorkspaceAgentSessionStateUpdate {
	currentPhase := strings.TrimSpace(patch.CurrentPhase)
	if currentPhase == "" {
		currentPhase = deriveCurrentPhaseFromEntityPatches(patch.Entities)
	}
	out := WorkspaceAgentSessionStateUpdate{
		Provider:          strings.TrimSpace(patch.Provider),
		ProviderSessionID: strings.TrimSpace(patch.ProviderSessionID),
		Model:             strings.TrimSpace(patch.Model),
		Settings:          clonePayloadMap(patch.Settings),
		RuntimeContext:    clonePayloadMap(patch.RuntimeContext),
		CWD:               strings.TrimSpace(patch.CWD),
		Title:             strings.TrimSpace(patch.Title),
		LifecycleStatus:   strings.TrimSpace(patch.LifecycleStatus),
		CurrentPhase:      currentPhase,
		OccurredAtUnixMS:  patch.OccurredAtUnixMS,
	}
	if patch.Turn != nil {
		out.Turn = &WorkspaceAgentTurnStateUpdate{
			TurnID:            strings.TrimSpace(patch.Turn.TurnID),
			Phase:             strings.TrimSpace(patch.Turn.Phase),
			Outcome:           strings.TrimSpace(patch.Turn.Outcome),
			FileChanges:       clonePayloadMap(patch.Turn.FileChanges),
			StartedAtUnixMS:   patch.Turn.StartedAtUnixMS,
			CompletedAtUnixMS: patch.Turn.CompletedAtUnixMS,
		}
	}
	return out
}

func deriveCurrentPhaseFromEntityPatches(entities []WorkspaceAgentEntityPatch) string {
	for _, entity := range entities {
		switch strings.ToLower(strings.TrimSpace(entity.Status)) {
		case "waiting", "waiting_input", "waiting_approval", "awaiting_approval":
			return "waiting_input"
		case "running", "streaming", "in_progress":
			return "working"
		}
	}
	return ""
}

func stringValueFromPayloadMap(payload map[string]any, key string) string {
	if len(payload) == 0 {
		return ""
	}
	value, ok := payload[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}

func cloneConnector(connector *ConnectorInfo) *ConnectorInfo {
	if connector == nil {
		return nil
	}
	cloned := *connector
	return &cloned
}
