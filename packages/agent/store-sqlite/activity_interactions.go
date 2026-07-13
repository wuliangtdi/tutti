package storesqlite

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// UpsertInteraction records an interaction status transition and ensures the
// owning turn row exists so the foreign key holds even when the prompt arrives
// before the turn's own state report (the turn is synthesized as waiting).
// Pending interactions are independent entities; a new request never
// supersedes an unrelated pending request.
// Answered/superseded are terminal; a terminal row rejects regressions to
// pending (accepted=false) so replays stay idempotent.
func (s *Store) UpsertInteraction(ctx context.Context, upsert InteractionUpsert) (Interaction, InteractionTransitionResult, error) {
	if s == nil || s.db == nil {
		return Interaction{}, InteractionTransitionConflict, errors.New("workspace database is not initialized")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Interaction{}, InteractionTransitionConflict, fmt.Errorf("begin workspace agent interaction upsert: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	interaction, result, err := s.upsertInteractionTx(ctx, tx, upsert, unixMs(time.Now().UTC()))
	if err != nil {
		return Interaction{}, InteractionTransitionConflict, err
	}
	if err := tx.Commit(); err != nil {
		return Interaction{}, InteractionTransitionConflict, fmt.Errorf("commit workspace agent interaction upsert: %w", err)
	}
	committed = true
	return interaction, result, nil
}
