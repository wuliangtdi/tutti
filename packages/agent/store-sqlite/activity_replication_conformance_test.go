package storesqlite_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"

	activityreplication "github.com/tutti-os/tutti/packages/agent/activity-replication"
	"github.com/tutti-os/tutti/packages/agent/activity-replication/conformance"
	storesqlite "github.com/tutti-os/tutti/packages/agent/store-sqlite"
	_ "modernc.org/sqlite"
)

type receipt struct {
	identity string
	cursor   uint64
}

type sqliteSink struct {
	db        *sql.DB
	store     *storesqlite.Store
	next      uint64
	receipts  map[string]receipt
	snapshots map[string]activityreplication.Mutation
}

func TestSQLiteCanonicalStoreConformance(t *testing.T) {
	t.Parallel()

	for _, fixture := range conformance.Fixtures() {
		fixture := fixture
		t.Run(fixture.Name, func(t *testing.T) {
			t.Parallel()
			sink := newSQLiteSink(t)
			if err := conformance.Run(context.Background(), sink, fixture); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func newSQLiteSink(t *testing.T) *sqliteSink {
	t.Helper()
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatalf("open SQLite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}
	store := storesqlite.New(db, storesqlite.Options{})
	if err := store.Migrate(context.Background()); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	return &sqliteSink{db: db, store: store}
}

func (s *sqliteSink) Reset(ctx context.Context) error {
	for _, table := range []string{
		"workspace_agent_messages", "workspace_agent_interactions", "workspace_agent_turns",
		"workspace_agent_sessions", "agent_targets",
	} {
		if _, err := s.db.ExecContext(ctx, "DELETE FROM "+table); err != nil {
			return fmt.Errorf("clear %s: %w", table, err)
		}
	}
	s.next = 0
	s.receipts = make(map[string]receipt)
	s.snapshots = make(map[string]activityreplication.Mutation)
	return nil
}

func (s *sqliteSink) Apply(ctx context.Context, batch activityreplication.ChangeBatch) (conformance.ApplyReport, error) {
	if err := activityreplication.ValidateBatch(batch); err != nil {
		return conformance.ApplyReport{}, err
	}
	acknowledgements := make([]activityreplication.MutationAcknowledgement, 0, len(batch.Mutations))
	for _, mutation := range batch.Mutations {
		identity, err := mutationIdentity(mutation)
		if err != nil {
			return conformance.ApplyReport{}, err
		}
		if existing, ok := s.receipts[mutation.MutationID]; ok {
			if existing.identity != identity {
				return conformance.ApplyReport{}, activityreplication.NewPermanentRejection(
					activityreplication.RejectionIdentity, mutation, errors.New("mutation identity conflicts with committed receipt"),
				)
			}
			acknowledgements = append(acknowledgements, activityreplication.AcknowledgeDuplicate(mutation, existing.cursor))
			continue
		}
		if s.isStale(mutation) {
			acknowledgements = append(acknowledgements, activityreplication.AcknowledgeStale(mutation))
			continue
		}
		if err := s.applyMutation(ctx, mutation); err != nil {
			return conformance.ApplyReport{}, err
		}
		s.next++
		s.receipts[mutation.MutationID] = receipt{identity: identity, cursor: s.next}
		s.snapshots[snapshotKey(mutation.EntityType, mutation.Key)] = mutation
		acknowledgements = append(acknowledgements, activityreplication.AcknowledgeApplied(mutation, s.next))
	}
	result, err := activityreplication.SummarizeAcknowledgements(acknowledgements)
	return conformance.ApplyReport{Result: result, Acknowledgements: acknowledgements}, err
}

func mutationIdentity(mutation activityreplication.Mutation) (string, error) {
	identity := struct {
		SourceDeviceID string                         `json:"sourceDeviceId"`
		WorkspaceID    string                         `json:"workspaceId"`
		EntityType     activityreplication.EntityType `json:"entityType"`
		Operation      activityreplication.Operation  `json:"operation"`
		Key            activityreplication.EntityKey  `json:"key"`
	}{mutation.SourceDeviceID, mutation.WorkspaceID, mutation.EntityType, mutation.Operation, mutation.Key}
	raw, err := json.Marshal(identity)
	return string(raw), err
}

func (s *sqliteSink) isStale(mutation activityreplication.Mutation) bool {
	existing, ok := s.snapshots[snapshotKey(mutation.EntityType, mutation.Key)]
	if !ok || mutation.Operation == activityreplication.OperationDelete {
		return false
	}
	switch mutation.EntityType {
	case activityreplication.EntityTarget:
		return mutation.Target.UpdatedAtUnixMS < existing.Target.UpdatedAtUnixMS
	case activityreplication.EntitySession:
		return mutation.Session.UpdatedAtUnixMS < existing.Session.UpdatedAtUnixMS
	case activityreplication.EntityTurn:
		return mutation.Turn.UpdatedAtUnixMS < existing.Turn.UpdatedAtUnixMS
	case activityreplication.EntityInteraction:
		return mutation.Interaction.UpdatedAtUnixMS < existing.Interaction.UpdatedAtUnixMS
	case activityreplication.EntityMessage:
		return mutation.Message.Version < existing.Message.Version
	default:
		return false
	}
}

func (s *sqliteSink) applyMutation(ctx context.Context, mutation activityreplication.Mutation) error {
	if mutation.Operation == activityreplication.OperationDelete {
		return errors.New("SQLite conformance adapter only needs upserts for the published fixtures")
	}
	switch mutation.EntityType {
	case activityreplication.EntityTarget:
		_, err := s.store.PutAgentTarget(ctx, storesqlite.Target{
			ID: mutation.Target.ID, Provider: mutation.Target.Provider, LaunchRefJSON: string(mutation.Target.LaunchRef),
			Name: mutation.Target.Name, IconKey: dereference(mutation.Target.IconKey), IconURL: mutation.Target.IconURL,
			HeroImageURL: mutation.Target.HeroImageURL, Enabled: mutation.Target.Enabled, Source: mutation.Target.Source,
			SortOrder: int(mutation.Target.SortOrder), CreatedAtUnixMS: mutation.Target.CreatedAtUnixMS,
		})
		return err
	case activityreplication.EntitySession:
		settings, err := decodeObject(mutation.Session.Settings)
		if err != nil {
			return err
		}
		runtimeContext, err := decodeObject(mutation.Session.InternalRuntimeContext)
		if err != nil {
			return err
		}
		result, err := s.store.ReportSessionState(ctx, storesqlite.SessionStateReport{
			WorkspaceID: mutation.Session.WorkspaceID, AgentSessionID: mutation.Session.AgentSessionID,
			Kind: mutation.Session.Kind, RootAgentSessionID: dereference(mutation.Session.RootAgentSessionID),
			RootTurnID: dereference(mutation.Session.RootTurnID), ParentAgentSessionID: dereference(mutation.Session.ParentAgentSessionID),
			ParentTurnID: dereference(mutation.Session.ParentTurnID), ParentToolCallID: dereference(mutation.Session.ParentToolCallID),
			Origin: mutation.Session.Origin, UserID: mutation.Session.UserID, AgentTargetID: dereference(mutation.Session.AgentTargetID),
			Provider: mutation.Session.Provider, ProviderSessionID: mutation.Session.ProviderSessionID, Model: mutation.Session.Model,
			Settings: settings, RuntimeContext: runtimeContext, Cwd: mutation.Session.CWD, Title: mutation.Session.Title,
			OccurredAtUnixMS: mutation.Session.LastEventAtUnixMS, StartedAtUnixMS: mutation.Session.StartedAtUnixMS,
			EndedAtUnixMS: mutation.Session.EndedAtUnixMS, CreatedAtUnixMS: mutation.Session.CreatedAtUnixMS,
		})
		if err == nil && !result.Accepted {
			return errors.New("SQLite canonical store rejected session snapshot")
		}
		return err
	case activityreplication.EntityTurn:
		turn := mutation.Turn
		_, accepted, err := s.store.RecordTurnTransition(ctx, storesqlite.TurnTransition{
			WorkspaceID: turn.WorkspaceID, AgentSessionID: turn.AgentSessionID, TurnID: turn.TurnID,
			Phase: turn.Phase, Outcome: dereference(turn.Outcome), Origin: turn.Origin,
			SourceGoalOperationID: dereference(turn.SourceGoalOperationID), SourceGoalRevision: dereferenceInt64(turn.SourceGoalRevision),
			SourceGoalRepairEpoch: dereferenceInt64(turn.SourceGoalRepairEpoch), StartedAtUnixMS: turn.StartedAtUnixMS,
			SettledAtUnixMS: dereferenceInt64(turn.SettledAtUnixMS), OccurredAtUnixMS: turn.UpdatedAtUnixMS,
		})
		if err == nil && !accepted {
			return errors.New("SQLite canonical store rejected turn snapshot")
		}
		return err
	case activityreplication.EntityInteraction:
		interaction := mutation.Interaction
		input, err := decodeObject(interaction.Input)
		if err != nil {
			return err
		}
		output, err := decodeObject(interaction.Output)
		if err != nil {
			return err
		}
		metadata, err := decodeObject(interaction.Metadata)
		if err != nil {
			return err
		}
		_, result, err := s.store.UpsertInteraction(ctx, storesqlite.InteractionUpsert{
			WorkspaceID: interaction.WorkspaceID, AgentSessionID: interaction.AgentSessionID, RequestID: interaction.RequestID,
			TurnID: interaction.TurnID, Kind: interaction.Kind, Status: interaction.Status, ToolName: interaction.ToolName,
			Input: input, Output: output, Metadata: metadata, OccurredAtUnixMS: interaction.UpdatedAtUnixMS,
		})
		if err == nil && result == storesqlite.InteractionTransitionConflict {
			return errors.New("SQLite canonical store rejected interaction snapshot")
		}
		return err
	case activityreplication.EntityMessage:
		message := mutation.Message
		payload, err := decodeObject(message.Payload)
		if err != nil {
			return err
		}
		result, err := s.store.ReportSessionMessages(ctx, storesqlite.SessionMessageReport{
			WorkspaceID: message.WorkspaceID, AgentSessionID: message.AgentSessionID, Messages: []storesqlite.MessageUpdate{{
				MessageID: message.MessageID, TurnID: dereference(message.TurnID), Role: message.Role, Kind: message.Kind,
				Status: message.Status, Payload: payload, OccurredAtUnixMS: message.OccurredAtUnixMS,
				StartedAtUnixMS: message.StartedAtUnixMS, CompletedAtUnixMS: message.CompletedAtUnixMS,
			}},
		})
		if err == nil && result.AcceptedCount != 1 {
			return fmt.Errorf("SQLite canonical store accepted %d messages, want 1", result.AcceptedCount)
		}
		return err
	default:
		return fmt.Errorf("unsupported SQLite conformance entity %q", mutation.EntityType)
	}
}

func (s *sqliteSink) Lookup(ctx context.Context, entityType activityreplication.EntityType, key activityreplication.EntityKey) (json.RawMessage, bool, error) {
	mutation, ok := s.snapshots[snapshotKey(entityType, key)]
	if !ok {
		return nil, false, nil
	}
	var snapshot any
	switch entityType {
	case activityreplication.EntitySession:
		stored, found, err := s.store.GetSession(ctx, mutation.WorkspaceID, key.AgentSessionID)
		if err != nil || !found {
			return nil, found, err
		}
		copy := *mutation.Session
		copy.Title, copy.Provider, copy.Origin = stored.Title, stored.Provider, stored.Origin
		snapshot = &copy
	case activityreplication.EntityTurn:
		stored, found, err := s.store.GetTurn(ctx, mutation.WorkspaceID, key.AgentSessionID, key.TurnID)
		if err != nil || !found {
			return nil, found, err
		}
		copy := *mutation.Turn
		copy.Phase, copy.Origin = stored.Phase, stored.Origin
		if stored.Outcome == "" {
			copy.Outcome = nil
		} else {
			copy.Outcome = &stored.Outcome
		}
		snapshot = &copy
	case activityreplication.EntityMessage:
		page, found, err := s.store.ListSessionMessages(ctx, storesqlite.ListSessionMessagesInput{
			WorkspaceID: mutation.WorkspaceID, AgentSessionID: key.AgentSessionID, Limit: 100,
		})
		if err != nil || !found {
			return nil, found, err
		}
		for _, stored := range page.Messages {
			if stored.MessageID == key.MessageID {
				copy := *mutation.Message
				copy.Version, copy.Role, copy.Kind, copy.Status = stored.Version, stored.Role, stored.Kind, stored.Status
				copy.Payload, err = json.Marshal(stored.Payload)
				if err != nil {
					return nil, false, err
				}
				snapshot = &copy
				break
			}
		}
		if snapshot == nil {
			return nil, false, nil
		}
	default:
		snapshot = snapshotFromMutation(mutation)
	}
	raw, err := json.Marshal(snapshot)
	return raw, err == nil, err
}

func snapshotFromMutation(mutation activityreplication.Mutation) any {
	switch mutation.EntityType {
	case activityreplication.EntityTarget:
		return mutation.Target
	case activityreplication.EntitySession:
		return mutation.Session
	case activityreplication.EntityTurn:
		return mutation.Turn
	case activityreplication.EntityInteraction:
		return mutation.Interaction
	case activityreplication.EntityMessage:
		return mutation.Message
	default:
		return nil
	}
}

func snapshotKey(entityType activityreplication.EntityType, key activityreplication.EntityKey) string {
	raw, _ := json.Marshal(key)
	return string(entityType) + ":" + string(raw)
}

func decodeObject(raw json.RawMessage) (map[string]any, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func dereferenceInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func TestMutationIdentityIgnoresRetryTransactionOnly(t *testing.T) {
	t.Parallel()

	left := activityreplication.Mutation{SourceDeviceID: "device", WorkspaceID: "workspace", EntityType: activityreplication.EntitySession,
		Operation: activityreplication.OperationUpsert, Key: activityreplication.EntityKey{AgentSessionID: "session"}, TransactionID: "first"}
	right := left
	right.TransactionID = "retry"
	leftIdentity, err := mutationIdentity(left)
	if err != nil {
		t.Fatal(err)
	}
	rightIdentity, err := mutationIdentity(right)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(leftIdentity, rightIdentity) {
		t.Fatalf("retry transaction changed identity: %q != %q", leftIdentity, rightIdentity)
	}
}
