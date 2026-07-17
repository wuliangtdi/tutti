package agent

import (
	"context"
)

func (s *Service) ReconcileGoalFromEvidence(ctx context.Context, input GoalReconcileRequiredInput) error {
	return s.applicationHost(serviceHostPreparation{service: s}).ReconcileGoalFromEvidence(ctx, input)
}
