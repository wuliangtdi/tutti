package agent

import "context"

func (s *Service) StepGoalReconcileInboxWorker(ctx context.Context) error {
	return s.applicationHost(serviceHostPreparation{service: s}).StepGoalReconcileInboxWorker(ctx)
}

func (s *Service) RecoverGoalReconcileInbox(ctx context.Context) error {
	return s.applicationHost(serviceHostPreparation{service: s}).RecoverGoalReconcileInbox(ctx)
}

func (s *Service) RunGoalReconcileInboxWorker(ctx context.Context) {
	s.applicationHost(serviceHostPreparation{service: s}).RunGoalReconcileInboxWorker(ctx)
}
