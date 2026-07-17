package agent

import (
	"context"
)

func (s *Service) StepGoalOperationWorker(ctx context.Context, recovering bool) error {
	return s.applicationHost(serviceHostPreparation{service: s}).StepGoalOperationWorker(ctx, recovering)
}

func (s *Service) RecoverGoalOperations(ctx context.Context) error {
	return s.applicationHost(serviceHostPreparation{service: s}).RecoverGoalOperations(ctx)
}

func (s *Service) RunGoalOperationWorker(ctx context.Context) {
	s.applicationHost(serviceHostPreparation{service: s}).RunGoalOperationWorker(ctx)
}
