# Agent Host contracts

`packages/agent/host` is the provider-neutral application boundary for
canonical agent session and turn lifecycle orchestration. The package now owns
the create, resume, send, durable submit-claim, canonical title, cancel,
interactive response, plan decision, durable runtime-operation, and complete
goal-control/reconcile application core. `tuttid` routes those commands through
`Host`; transport and HTTP shapes remain unchanged.

The module owns:

- lifecycle command and runtime observation types;
- narrow canonical store, runtime, preparation, attachment, clock, scheduler,
  and post-commit observer ports;
- the runtime-operation coordinator, worker, typed interactive dispositions,
  and startup recovery order;
- the direct and typed goal-control saga, revision actor, durable operation and
  reconcile-inbox workers, provider evidence repair, and goal recovery policy;
- typed conformance scenarios under `conformance`.

`CreateSession` has two explicit modes: an empty session, or one command with
`InitialContent`. The latter prepares its submit claim before provider delivery
and rolls back the provisional canonical shell when delivery fails. Resume
eligibility is decided by `ResolveResumePolicy`: root sessions resume normally,
explicit imports may recreate a missing provider session, and child,
tombstoned, or non-resumable imports are rejected. Canonical titles may be
empty; only an explicit title or the first eligible prompt establishes one.
Cancellation exposes durable intent acceptance, provider confirmation, and
canonical settlement as separate facts. `GoalControl`, `GetGoalState`, and
`ReconcileGoal` are provider-neutral Host APIs; typed `/goal` commands enter the
same durable saga without opening a turn. `Recover` first requeues and recovers
durable runtime operations, then goal operations and the goal reconcile inbox,
and only then settles unrecoverable stale turns. Configuring a goal store
without its runtime or inbox consumer fails recovery with
`ErrGoalConsumerUnavailable` instead of silently accumulating work.

Adapters retain authorization and identity, transport, runtime process or VM
selection, desktop APIs, attachment ingress, and cloud inbox/outbox behavior.
Adapter-only create fields such as transcript source paths and materialized
skill bundles intentionally remain outside the Host contract.

The conformance harness depends only on the public Host contract. An
implementation supplies a `conformance.Driver`, seeds its own canonical and
runtime fakes in `Reset`, and runs every value returned by
`conformance.Scenarios`. This lets `tuttid`, the extracted Host, and downstream
adapters share one behavior baseline without importing one another.
