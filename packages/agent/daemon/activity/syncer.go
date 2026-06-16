//nolint:unused // Retain migrated helpers until the next agent-daemon decomposition pass.
package agentsessionstore

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"
)

const (
	syncInterval    = 5 * time.Second
	messagePageSize = 20
	messageMaxPages = 10
)

type sessionSyncer struct {
	svc      *Store
	client   ReadRepository
	triggers chan string
}

func newSessionSyncer(svc *Store, client ReadRepository) *sessionSyncer {
	return &sessionSyncer{
		svc:      svc,
		client:   client,
		triggers: make(chan string, 64),
	}
}

func (s *sessionSyncer) run(ctx context.Context) {
	if s == nil || s.svc == nil || s.client == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}

	s.syncAllRooms(ctx)

	ticker := time.NewTicker(syncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncAllRooms(ctx)
		case roomID := <-s.triggers:
			s.syncTriggeredRooms(ctx, roomID)
		}
	}
}

func (s *sessionSyncer) triggerRoom(roomID string) {
	roomID = strings.TrimSpace(roomID)
	if s == nil || roomID == "" {
		return
	}

	select {
	case s.triggers <- roomID:
	default:
	}
}

func (s *sessionSyncer) syncAllRooms(ctx context.Context) {
	if s == nil || s.svc == nil || s.client == nil {
		return
	}
	s.syncRooms(ctx, s.svc.listRoomIDs())
}

func (s *sessionSyncer) syncTriggeredRooms(ctx context.Context, firstRoomID string) {
	if ctx == nil {
		ctx = context.Background()
	}
	select {
	case <-ctx.Done():
		return
	default:
	}

	rooms := map[string]struct{}{}
	if firstRoomID = strings.TrimSpace(firstRoomID); firstRoomID != "" {
		rooms[firstRoomID] = struct{}{}
	}

	for remaining := len(s.triggers); remaining > 0; remaining-- {
		select {
		case <-ctx.Done():
			return
		case roomID := <-s.triggers:
			if roomID = strings.TrimSpace(roomID); roomID != "" {
				rooms[roomID] = struct{}{}
			}
		}
	}

	roomIDs := make([]string, 0, len(rooms))
	for roomID := range rooms {
		roomIDs = append(roomIDs, roomID)
	}
	s.syncRooms(ctx, roomIDs)
}

func (s *sessionSyncer) syncRooms(ctx context.Context, roomIDs []string) {
	var wg sync.WaitGroup
	seen := make(map[string]struct{}, len(roomIDs))
	for _, roomID := range roomIDs {
		roomID = strings.TrimSpace(roomID)
		if roomID == "" {
			continue
		}
		if _, ok := seen[roomID]; ok {
			continue
		}
		seen[roomID] = struct{}{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.syncRoom(ctx, roomID)
		}()
	}
	wg.Wait()
}

func (s *sessionSyncer) syncRoom(ctx context.Context, roomID string) {
	current, ok := s.syncSessionState(ctx, roomID)
	if !ok {
		return
	}
	s.syncSessionMessages(ctx, roomID, current)
}

func (s *sessionSyncer) syncSessionState(ctx context.Context, roomID string) ([]WorkspaceAgentSession, bool) {
	if s == nil || s.svc == nil || s.client == nil {
		return nil, false
	}

	snapshot, err := s.client.ListAgents(ctx, roomID)
	if err != nil {
		slog.Warn("agent activity session state sync failed", "room_id", roomID, "error", err)
		return nil, false
	}
	if snapshot == nil {
		s.svc.updateStateForOrigin(roomID, WorkspaceAgentSnapshot{}, WorkspaceAgentSessionOriginRuntime)
		return nil, true
	}
	s.svc.updateStateForOrigin(roomID, *snapshot, WorkspaceAgentSessionOriginRuntime)
	return snapshot.Sessions, true
}

func (s *sessionSyncer) roomSessions(roomID string) []WorkspaceAgentSession {
	if s == nil || s.svc == nil {
		return nil
	}
	state, ok := s.svc.GetAgentState(roomID)
	if !ok {
		return nil
	}
	return state.Sessions
}

func isActiveSession(session WorkspaceAgentSession) bool {
	switch strings.ToLower(strings.TrimSpace(session.LifecycleStatus)) {
	case "completed", "failed", "canceled", "ended":
		return false
	}

	switch strings.ToLower(strings.TrimSpace(session.EffectiveStatus)) {
	case "working", "active", "running":
		return true
	default:
		return false
	}
}

func isTerminalSession(session WorkspaceAgentSession) bool {
	switch strings.ToLower(strings.TrimSpace(session.LifecycleStatus)) {
	case "completed", "failed", "canceled", "ended":
		return true
	default:
		return false
	}
}

func (s *sessionSyncer) syncSessionMessages(
	ctx context.Context,
	roomID string,
	sessions []WorkspaceAgentSession,
) {
	if s == nil || s.svc == nil || s.client == nil {
		return
	}
	seen := make(map[string]string, len(sessions))
	for _, session := range sessions {
		sessionID := strings.TrimSpace(session.AgentSessionID)
		if sessionID == "" {
			continue
		}
		if _, ok := seen[sessionID]; ok {
			continue
		}
		seen[sessionID] = NormalizeSessionOrigin(session.SessionOrigin)
		s.syncSessionMessagePages(ctx, roomID, sessionID, seen[sessionID])
	}
}

func (s *sessionSyncer) syncSessionMessagePages(ctx context.Context, roomID, agentSessionID string, sessionOrigin string) {
	if s == nil || s.svc == nil || s.client == nil {
		return
	}
	agentSessionID = strings.TrimSpace(agentSessionID)
	if agentSessionID == "" {
		return
	}

	afterVersion := s.svc.getMessageVersionCursor(roomID, agentSessionID)
	for page := 0; page < messageMaxPages; page++ {
		reply, err := s.client.ListSessionMessages(ctx, ListSessionMessagesInput{
			WorkspaceID:    roomID,
			AgentSessionID: agentSessionID,
			AfterVersion:   afterVersion,
			Limit:          messagePageSize,
			SessionOrigin:  sessionOrigin,
		})
		if err != nil {
			slog.Warn("agent activity message sync failed", "room_id", roomID, "agent_session_id", agentSessionID, "error", err)
			return
		}
		if reply == nil {
			return
		}
		s.svc.appendSessionMessages(roomID, agentSessionID, reply.Messages, reply.LatestVersion)
		nextVersion := reply.LatestVersion
		if nextVersion <= afterVersion {
			nextVersion = maxSessionMessageVersion(afterVersion, reply.Messages)
		}
		if !reply.HasMore || nextVersion <= afterVersion {
			return
		}
		afterVersion = nextVersion
	}
}
