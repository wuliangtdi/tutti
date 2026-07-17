package agenthost

import (
	"context"
	"time"
)

type Config struct {
	CanonicalStore       CanonicalStore
	Runtime              RuntimeController
	RuntimePreparation   RuntimePreparationPort
	Attachments          AttachmentMaterializer
	Clock                Clock
	SessionLocker        SessionLocker
	RuntimeStartGate     RuntimeStartGate
	LifecycleObserver    LifecycleObserver
	RuntimeOperations    RuntimeOperationStore
	OperationEvents      RuntimeOperationEventPublisher
	OperationOwner       string
	Scheduler            Scheduler
	StaleTurnSettler     StaleTurnSettler
	GoalStore            GoalStateStore
	GoalRuntime          GoalRuntimeController
	GoalAudits           GoalAuditPublisher
	GoalInbox            GoalReconcileInboxStore
	GoalOwner            string
	GoalClock            Clock
	GoalAttemptTimeout   time.Duration
	GoalRecoveryBudget   time.Duration
	GoalMaxAttempts      int
	GoalDispatchDeadline time.Duration
	GoalActor            *GoalActor
}

type Host struct {
	store                CanonicalStore
	runtime              RuntimeController
	preparation          RuntimePreparationPort
	attachments          AttachmentMaterializer
	clock                Clock
	locker               SessionLocker
	startupGate          RuntimeStartGate
	observer             LifecycleObserver
	operations           RuntimeOperationStore
	events               RuntimeOperationEventPublisher
	owner                string
	scheduler            Scheduler
	staleTurns           StaleTurnSettler
	goals                GoalStateStore
	goalRuntime          GoalRuntimeController
	goalAudits           GoalAuditPublisher
	goalInbox            GoalReconcileInboxStore
	goalOwner            string
	goalClock            Clock
	goalAttemptTimeout   time.Duration
	goalRecoveryBudget   time.Duration
	goalMaxAttempts      int
	goalDispatchDeadline time.Duration
	goalActor            *GoalActor
}

func New(config Config) *Host {
	goalActor := config.GoalActor
	if goalActor == nil {
		goalActor = NewGoalActor()
	}
	return &Host{
		store: config.CanonicalStore, runtime: config.Runtime,
		preparation: config.RuntimePreparation, attachments: config.Attachments,
		clock: config.Clock, locker: config.SessionLocker, startupGate: config.RuntimeStartGate,
		observer:   config.LifecycleObserver,
		operations: config.RuntimeOperations, events: config.OperationEvents,
		owner: config.OperationOwner, scheduler: config.Scheduler, staleTurns: config.StaleTurnSettler,
		goals: config.GoalStore, goalRuntime: config.GoalRuntime,
		goalAudits: config.GoalAudits, goalInbox: config.GoalInbox,
		goalOwner: config.GoalOwner, goalClock: config.GoalClock,
		goalAttemptTimeout: config.GoalAttemptTimeout, goalRecoveryBudget: config.GoalRecoveryBudget,
		goalMaxAttempts: config.GoalMaxAttempts, goalDispatchDeadline: config.GoalDispatchDeadline,
		goalActor: goalActor,
	}
}

func (h *Host) observeStep(ctx context.Context, flow, name, sessionID, provider string, startedAt time.Time, err error) {
	if h != nil && h.observer != nil {
		h.observer.ObserveLifecycleStep(ctx, LifecycleStep{
			Flow: flow, Name: name, AgentSessionID: sessionID, Provider: provider, StartedAt: startedAt, Err: err,
		})
	}
}

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now() }

func (h *Host) now() time.Time {
	if h != nil && h.clock != nil {
		return h.clock.Now()
	}
	return systemClock{}.Now()
}
