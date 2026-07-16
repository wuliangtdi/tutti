package conformance

import (
	"encoding/json"

	activityreplication "github.com/tutti-os/tutti/packages/agent/activity-replication"
	"github.com/tutti-os/tutti/packages/agent/store-sqlite/canonical"
)

func Fixtures() []Fixture {
	return []Fixture{
		retryAfterLostResponseFixture(),
		staleDoesNotBlockLaterMutationsFixture(),
		duplicateIdentityConflictFixture(),
		permanentSchemaRejectionFixture(),
	}
}

func retryAfterLostResponseFixture() Fixture {
	mutation := sessionMutation("retry-session", "transaction-original", "Retry title", 100)
	retry := mutation
	retry.TransactionID = "transaction-retry"
	return Fixture{
		Name: "committed response lost then identical mutation retry",
		Steps: []Step{
			{
				Name: "original commit", Batch: batch(mutation),
				WantResult:       activityreplication.ApplyResult{AcceptedCount: 1, Cursor: 1},
				WantDispositions: []activityreplication.AcknowledgementDisposition{activityreplication.AcknowledgementApplied},
			},
			{
				Name: "rebuilt batch retry", Batch: batch(retry),
				WantResult:       activityreplication.ApplyResult{AcceptedCount: 1, Cursor: 1},
				WantDispositions: []activityreplication.AcknowledgementDisposition{activityreplication.AcknowledgementDuplicate},
			},
		},
		WantSnapshots: []SnapshotExpectation{snapshotExpectation(mutation)},
	}
}

func staleDoesNotBlockLaterMutationsFixture() Fixture {
	runningTurn := turnMutation("running-turn", "transaction-seed", canonical.TurnPhaseRunning, nil, 200)
	currentSession := sessionMutation("current-session", "transaction-seed", "Current title", 200)
	staleSession := sessionMutation("stale-session", "transaction-update", "Stale title", 100)
	settledAt := int64(300)
	outcome := canonical.TurnOutcomeCompleted
	completedTurn := turnMutation("completed-turn", "transaction-update", canonical.TurnPhaseSettled, &outcome, 300)
	completedTurn.Turn.SettledAtUnixMS = &settledAt
	correctTitle := sessionMutation("correct-title", "transaction-update", "Correct title", 400)
	message := messageMutation("final-message", "transaction-update", 500)
	return Fixture{
		Name: "stale snapshot does not block completed title and message",
		Steps: []Step{
			{
				Name: "seed current projection", Batch: batch(currentSession, runningTurn),
				WantResult: activityreplication.ApplyResult{AcceptedCount: 2, Cursor: 2},
				WantDispositions: []activityreplication.AcknowledgementDisposition{
					activityreplication.AcknowledgementApplied, activityreplication.AcknowledgementApplied,
				},
			},
			{
				Name: "apply ordered update", Batch: batch(staleSession, completedTurn, correctTitle, message),
				WantResult: activityreplication.ApplyResult{AcceptedCount: 4, Cursor: 5},
				WantDispositions: []activityreplication.AcknowledgementDisposition{
					activityreplication.AcknowledgementStale, activityreplication.AcknowledgementApplied,
					activityreplication.AcknowledgementApplied, activityreplication.AcknowledgementApplied,
				},
			},
		},
		WantSnapshots: []SnapshotExpectation{
			snapshotExpectation(correctTitle), snapshotExpectation(completedTurn), snapshotExpectation(message),
		},
	}
}

func duplicateIdentityConflictFixture() Fixture {
	original := sessionMutation("collision", "transaction-original", "Original", 100)
	conflict := original
	conflict.TransactionID = "transaction-conflict"
	conflict.SourceDeviceID = "other-device"
	conflict.SessionScope = sessionScope("other-device")
	return Fixture{
		Name: "duplicate mutation id with different identity is rejected",
		Steps: []Step{
			{
				Name: "original commit", Batch: batch(original),
				WantResult:       activityreplication.ApplyResult{AcceptedCount: 1, Cursor: 1},
				WantDispositions: []activityreplication.AcknowledgementDisposition{activityreplication.AcknowledgementApplied},
			},
			{
				Name: "identity collision", Batch: batch(conflict),
				WantRejection: &RejectionExpectation{
					Kind: activityreplication.RejectionIdentity, MutationID: "collision", TransactionID: "transaction-conflict",
				},
			},
		},
		WantSnapshots: []SnapshotExpectation{snapshotExpectation(original)},
	}
}

func permanentSchemaRejectionFixture() Fixture {
	invalid := turnMutation("invalid-turn", "transaction-invalid", "unknown", nil, 100)
	return Fixture{
		Name: "invalid canonical vocabulary is permanently rejected",
		Steps: []Step{{
			Name: "invalid phase", Batch: batch(invalid),
			WantRejection: &RejectionExpectation{
				Kind: activityreplication.RejectionSchema, MutationID: "invalid-turn", TransactionID: "transaction-invalid",
			},
		}},
	}
}

func batch(mutations ...activityreplication.Mutation) activityreplication.ChangeBatch {
	return activityreplication.ChangeBatch{SchemaVersion: activityreplication.SchemaVersion, Mutations: mutations}
}

func sessionMutation(mutationID, transactionID, title string, updatedAt int64) activityreplication.Mutation {
	session := &activityreplication.Session{
		WorkspaceID: "workspace-1", AgentSessionID: "session-1", Kind: canonical.SessionKindRoot,
		Origin: canonical.TurnOriginUserPrompt, UserID: "owner-1", Provider: "codex", ProviderSessionID: "provider-session-1",
		Settings: json.RawMessage(`{}`), SessionMetadata: json.RawMessage(`{}`), InternalRuntimeContext: json.RawMessage(`{}`),
		RailSectionKind: "conversations", RailSectionKey: "conversations", Title: title,
		CreatedAtUnixMS: 50, UpdatedAtUnixMS: updatedAt, LastEventAtUnixMS: updatedAt,
	}
	return activityreplication.Mutation{
		SchemaVersion: activityreplication.SchemaVersion, MutationID: mutationID, TransactionID: transactionID,
		SourceDeviceID: "device-1", WorkspaceID: "workspace-1", EntityType: activityreplication.EntitySession,
		Operation: activityreplication.OperationUpsert, Key: activityreplication.EntityKey{AgentSessionID: "session-1"},
		Session: session, SessionScope: sessionScope("device-1"),
	}
}

func turnMutation(mutationID, transactionID, phase string, outcome *string, updatedAt int64) activityreplication.Mutation {
	turn := &activityreplication.Turn{
		WorkspaceID: "workspace-1", AgentSessionID: "session-1", TurnID: "turn-1", Phase: phase, Outcome: outcome,
		Origin: canonical.TurnOriginUserPrompt, CreatedAtUnixMS: 100, UpdatedAtUnixMS: updatedAt,
	}
	return activityreplication.Mutation{
		SchemaVersion: activityreplication.SchemaVersion, MutationID: mutationID, TransactionID: transactionID,
		SourceDeviceID: "device-1", WorkspaceID: "workspace-1", EntityType: activityreplication.EntityTurn,
		Operation: activityreplication.OperationUpsert,
		Key:       activityreplication.EntityKey{AgentSessionID: "session-1", TurnID: "turn-1"},
		Turn:      turn, SessionScope: sessionScope("device-1"),
	}
}

func messageMutation(mutationID, transactionID string, updatedAt int64) activityreplication.Mutation {
	turnID := "turn-1"
	message := &activityreplication.Message{
		WorkspaceID: "workspace-1", AgentSessionID: "session-1", MessageID: "message-1", Version: 1,
		TurnID: &turnID, Role: "assistant", Kind: "text", Status: "completed", Semantics: json.RawMessage(`null`),
		Payload: json.RawMessage(`{"text":"done"}`), OccurredAtUnixMS: updatedAt, CompletedAtUnixMS: updatedAt,
		CreatedAtUnixMS: updatedAt, UpdatedAtUnixMS: updatedAt,
	}
	return activityreplication.Mutation{
		SchemaVersion: activityreplication.SchemaVersion, MutationID: mutationID, TransactionID: transactionID,
		SourceDeviceID: "device-1", WorkspaceID: "workspace-1", EntityType: activityreplication.EntityMessage,
		Operation: activityreplication.OperationUpsert,
		Key:       activityreplication.EntityKey{AgentSessionID: "session-1", MessageID: "message-1"},
		Message:   message, SessionScope: sessionScope("device-1"),
	}
}

func sessionScope(deviceID string) *activityreplication.SessionScope {
	return &activityreplication.SessionScope{
		InitiatorUserID: "caller-1", ExecutorOwnerUserID: "owner-1", SourceDeviceID: deviceID,
		LaunchKind: "shared-agent", Visibility: activityreplication.VisibilityMembers,
	}
}

func snapshotExpectation(mutation activityreplication.Mutation) SnapshotExpectation {
	var snapshot any
	switch mutation.EntityType {
	case activityreplication.EntitySession:
		snapshot = mutation.Session
	case activityreplication.EntityTurn:
		snapshot = mutation.Turn
	case activityreplication.EntityMessage:
		snapshot = mutation.Message
	default:
		panic("unsupported fixture snapshot entity")
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		panic(err)
	}
	return SnapshotExpectation{EntityType: mutation.EntityType, Key: mutation.Key, Snapshot: raw}
}
