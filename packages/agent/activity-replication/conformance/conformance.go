// Package conformance provides backend-neutral activity replication fixtures.
// SQLite builders and MySQL sinks implement Sink in their own test packages;
// this package owns no database or transport code.
package conformance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"

	activityreplication "github.com/tutti-os/tutti/packages/agent/activity-replication"
)

type ApplyReport struct {
	Result           activityreplication.ApplyResult
	Acknowledgements []activityreplication.MutationAcknowledgement
}

type Sink interface {
	Reset(context.Context) error
	Apply(context.Context, activityreplication.ChangeBatch) (ApplyReport, error)
	Lookup(context.Context, activityreplication.EntityType, activityreplication.EntityKey) (json.RawMessage, bool, error)
}

type Step struct {
	Name             string
	Batch            activityreplication.ChangeBatch
	WantResult       activityreplication.ApplyResult
	WantDispositions []activityreplication.AcknowledgementDisposition
	WantRejection    *RejectionExpectation
}

type RejectionExpectation struct {
	Kind          activityreplication.RejectionKind
	MutationID    string
	TransactionID string
}

type SnapshotExpectation struct {
	EntityType activityreplication.EntityType
	Key        activityreplication.EntityKey
	Snapshot   json.RawMessage
}

type Fixture struct {
	Name          string
	Steps         []Step
	WantSnapshots []SnapshotExpectation
}

func Run(ctx context.Context, sink Sink, fixture Fixture) error {
	if err := sink.Reset(ctx); err != nil {
		return fmt.Errorf("reset sink: %w", err)
	}
	for _, step := range fixture.Steps {
		report, err := sink.Apply(ctx, step.Batch)
		if step.WantRejection != nil {
			if rejectionErr := matchRejection(err, *step.WantRejection); rejectionErr != nil {
				return fmt.Errorf("step %q: %w", step.Name, rejectionErr)
			}
			continue
		}
		if err != nil {
			return fmt.Errorf("step %q: apply: %w", step.Name, err)
		}
		if report.Result != step.WantResult {
			return fmt.Errorf("step %q: result %#v, want %#v", step.Name, report.Result, step.WantResult)
		}
		gotDispositions := make([]activityreplication.AcknowledgementDisposition, 0, len(report.Acknowledgements))
		for _, acknowledgement := range report.Acknowledgements {
			gotDispositions = append(gotDispositions, acknowledgement.Disposition)
		}
		if !reflect.DeepEqual(gotDispositions, step.WantDispositions) {
			return fmt.Errorf("step %q: dispositions %#v, want %#v", step.Name, gotDispositions, step.WantDispositions)
		}
	}
	for _, expectation := range fixture.WantSnapshots {
		got, found, err := sink.Lookup(ctx, expectation.EntityType, expectation.Key)
		if err != nil {
			return fmt.Errorf("lookup %s: %w", expectation.EntityType, err)
		}
		if !found {
			return fmt.Errorf("lookup %s: snapshot not found", expectation.EntityType)
		}
		if !jsonEqual(got, expectation.Snapshot) {
			return fmt.Errorf("lookup %s: snapshot %s, want %s", expectation.EntityType, got, expectation.Snapshot)
		}
	}
	return nil
}

func matchRejection(err error, want RejectionExpectation) error {
	if err == nil {
		return errors.New("expected permanent rejection, got nil")
	}
	var rejection *activityreplication.PermanentRejection
	if !errors.As(err, &rejection) {
		return fmt.Errorf("error %T is not a permanent rejection: %w", err, err)
	}
	if rejection.Kind != want.Kind || rejection.MutationID != want.MutationID || rejection.TransactionID != want.TransactionID {
		return fmt.Errorf("rejection %#v, want %#v", rejection, want)
	}
	return nil
}

func jsonEqual(left, right json.RawMessage) bool {
	var leftValue any
	var rightValue any
	return json.Unmarshal(left, &leftValue) == nil && json.Unmarshal(right, &rightValue) == nil && reflect.DeepEqual(leftValue, rightValue)
}
