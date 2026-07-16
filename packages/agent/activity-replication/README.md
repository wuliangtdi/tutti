# Activity Replication

`github.com/tutti-os/tutti/packages/agent/activity-replication` is the official
versioned JSON contract for uploading canonical agent activity snapshots to a
cloud projection.

The root package defines the wire batch, mutation, typed entity key, scopes,
five projection snapshots, validation, and acknowledgement/rejection
semantics. Canonical activity vocabulary comes from
`store-sqlite/canonical`; this module does not define a second set of turn or
interaction lifecycle values.

The `conformance` subpackage exposes backend-neutral fixtures through a small
`Sink` interface. Every implementation must run the same fixtures:

- an already committed mutation retried after its HTTP response was lost is
  accepted as a duplicate and returns its original cursor;
- a stale snapshot is an acknowledged no-op and does not block later ordered
  mutations;
- reusing a mutation ID for a different identity is a permanent rejection;
- schema rejection reports the failing mutation and transaction IDs.

The contract owns no database queries, room authorization, transport,
WebSocket behavior, or GUI-derived state. `runtimeOperation`,
`runtimeOperationEvent`, and `submitClaim` are retained only as entity names
for decoding tombstone deletes; new upserts are invalid.

Consumers should validate an ordered batch with `ValidateBatch`, preserve the
original durable cursor for duplicate acknowledgements, count duplicate and
stale mutations in `acceptedCount`, and use `SummarizeAcknowledgements` to
produce the batch result.
