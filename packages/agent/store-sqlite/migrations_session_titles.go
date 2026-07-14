package storesqlite

import (
	"context"
	"fmt"

	"github.com/tutti-os/tutti/packages/agent/daemon/titletext"
)

func (s *Store) applyWorkspaceAgentSessionTitlesV1(ctx context.Context) error {
	const migrationID = schemaMigrationWorkspaceAgentSessionTitlesV1
	applied, err := s.hasMigration(ctx, migrationID)
	if err != nil {
		return err
	}
	if applied {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin workspace agent session title canonicalization: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	rows, err := tx.QueryContext(ctx, `
SELECT workspace_id, agent_session_id, title
FROM workspace_agent_sessions
WHERE title != ''
`)
	if err != nil {
		return fmt.Errorf("list workspace agent session titles for canonicalization: %w", err)
	}
	type sessionTitle struct {
		workspaceID    string
		agentSessionID string
		title          string
	}
	var updates []sessionTitle
	for rows.Next() {
		var value sessionTitle
		if err := rows.Scan(&value.workspaceID, &value.agentSessionID, &value.title); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan workspace agent session title for canonicalization: %w", err)
		}
		canonical := titletext.Normalize(value.title)
		if canonical != value.title {
			value.title = canonical
			updates = append(updates, value)
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("iterate workspace agent session titles for canonicalization: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close workspace agent session titles for canonicalization: %w", err)
	}

	for _, update := range updates {
		if _, err := tx.ExecContext(ctx, `
UPDATE workspace_agent_sessions
SET title = ?
WHERE workspace_id = ? AND agent_session_id = ?
`, update.title, update.workspaceID, update.agentSessionID); err != nil {
			return fmt.Errorf("canonicalize workspace agent session title: %w", err)
		}
	}
	if err := recordMigrationTx(ctx, tx, migrationID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit workspace agent session title canonicalization: %w", err)
	}
	committed = true
	return nil
}
