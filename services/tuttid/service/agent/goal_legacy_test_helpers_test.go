package agent

import (
	"context"
	"strings"
	"time"

	agenthost "github.com/tutti-os/tutti/packages/agent/host"
	agentactivitybiz "github.com/tutti-os/tutti/services/tuttid/biz/agentactivity"
)

const (
	goalReconcileInboxLease       = 5 * time.Minute
	goalReconcileInboxMaxAttempts = 24
)

type typedGoalControl = agenthost.TypedGoalControl

func parseTypedGoalControl(content []PromptContentBlock, _ string, guidance bool) (typedGoalControl, bool) {
	return agenthost.ParseTypedGoalControl(content, guidance)
}

func resolveRuntimeGoalRecoveryPolicy(ctx context.Context, controller RuntimeController, input RuntimeGoalControlInput) (RuntimeGoalRecoveryPolicy, error) {
	return agenthost.ResolveRuntimeGoalRecoveryPolicy(ctx, controller, input)
}

func (s *Service) goalOperationOwner() string {
	owner := strings.TrimSpace(s.GoalOperationOwner)
	if owner == "" {
		owner = strings.TrimSpace(s.RuntimeOperationOwner)
	}
	if owner == "" {
		owner = "goal-worker-local"
	}
	return owner
}

func (s *Service) withGoalActor(ctx context.Context, workspaceID, agentSessionID string, fn func(context.Context) error) error {
	s.goalActorOnce.Do(func() {
		s.goalActor = agenthost.NewGoalActor()
	})
	return s.goalActor.Do(ctx, agenthost.SessionRef{WorkspaceID: workspaceID, AgentSessionID: agentSessionID}, fn)
}

func (s *Service) retryRecoveredGoalOperation(ctx context.Context, op agentactivitybiz.GoalControlOperation, cause error) error {
	now := time.Now().UTC()
	if s.GoalOperationClock != nil {
		now = s.GoalOperationClock().UTC()
	}
	_, _, err := s.GoalStateStore.ReleaseGoalControlOperation(ctx, agentactivitybiz.ReleaseGoalControlOperationInput{
		WorkspaceID: op.WorkspaceID, OperationID: op.OperationID, LeaseOwner: s.goalOperationOwner(),
		ProviderPhase: op.ProviderPhase, Evidence: clonePayload(op.Evidence), LastError: cause.Error(), NowUnixMS: now.UnixMilli(),
		NextAttemptAtMS: runtimeOperationNextAttemptAt(now, op.Attempt, !isRetryableRuntimeOperationError(cause)),
		Fail:            !isRetryableRuntimeOperationError(cause), RepairEpoch: op.RepairEpoch,
	})
	return err
}

func (s *Service) attachGoalProvenanceQuiesceRepair(ctx context.Context, input GoalReconcileRequiredInput) error {
	input.QuiesceSucceeded = false
	return s.applicationHost(serviceHostPreparation{service: s}).ReconcileGoalFromEvidence(ctx, input)
}

func (s *Service) goalReconcileEvidenceFenceMatches(ctx context.Context, input GoalReconcileRequiredInput) (bool, error) {
	if s.GoalStateStore == nil {
		return true, nil
	}
	switch strings.TrimSpace(input.FenceMode) {
	case "current_durable":
		return strings.TrimSpace(input.ExpectedOperationID) == "" && input.ExpectedRevision == 0, nil
	case "operation":
		operationID := strings.TrimSpace(input.ExpectedOperationID)
		if operationID == "" || input.ExpectedRevision <= 0 {
			return false, nil
		}
		state, found, err := s.GoalStateStore.GetSessionGoalState(ctx, input.WorkspaceID, input.AgentSessionID)
		if err != nil || !found || state.Revision != input.ExpectedRevision {
			return false, err
		}
		operation, found, err := s.GoalStateStore.GetGoalControlOperation(ctx, input.WorkspaceID, operationID)
		if err != nil || !found {
			return false, err
		}
		if operation.AgentSessionID != input.AgentSessionID || operation.GoalRevision != input.ExpectedRevision || operation.RepairEpoch != input.ExpectedRepairEpoch {
			return false, nil
		}
		if pending := strings.TrimSpace(state.PendingOperationID); pending != "" {
			return pending == operationID && (operation.Status == agentactivitybiz.GoalOperationStatusPrepared || operation.Status == agentactivitybiz.GoalOperationStatusDispatched), nil
		}
		return operation.Status == agentactivitybiz.GoalOperationStatusCompleted && !operation.RepairRequired, nil
	default:
		return false, nil
	}
}
