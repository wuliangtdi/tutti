package agentruntime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	activityshared "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity/events"
)

const (
	claudeCodeRuntimeEnv           = "TUTTI_CLAUDE_CODE_RUNTIME"
	claudeCodeRuntimeSDK           = "sdk"
	claudeSDKSidecarCommandEnv     = "TUTTI_CLAUDE_SDK_SIDECAR_COMMAND"
	claudeSDKSidecarTestDriverEnv  = "TUTTI_CLAUDE_SDK_SIDECAR_TEST_DRIVER"
	claudeSDKSidecarAdapterName    = "claude-agent-sdk"
	claudeSDKSidecarDefaultNodeArg = "--experimental-strip-types"
)

type ClaudeCodeSDKAdapter struct {
	transport ProcessTransport

	mu       sync.Mutex
	sessions map[string]*claudeSDKAdapterSession
}

type claudeSDKAdapterSession struct {
	conn              ProcessConnection
	reader            *claudeSDKLineReader
	providerSessionID string
	assistantMessages map[string]string
}

type claudeSDKSidecarRequest struct {
	ID      string         `json:"id,omitempty"`
	Type    string         `json:"type"`
	Payload map[string]any `json:"payload,omitempty"`
}

type claudeSDKSidecarEvent struct {
	ID      string         `json:"id,omitempty"`
	Type    string         `json:"type"`
	Payload map[string]any `json:"payload,omitempty"`
}

type claudeSDKLineReader struct {
	conn   ProcessConnection
	buffer string
}

func NewClaudeCodeSDKAdapter(transport ProcessTransport) *ClaudeCodeSDKAdapter {
	return &ClaudeCodeSDKAdapter{
		transport: transport,
		sessions:  make(map[string]*claudeSDKAdapterSession),
	}
}

func (a *ClaudeCodeSDKAdapter) Provider() string {
	return ProviderClaudeCode
}

func (a *ClaudeCodeSDKAdapter) Start(ctx context.Context, session Session) ([]activityshared.Event, error) {
	if a == nil || a.transport == nil {
		return nil, ErrSessionDisconnected
	}
	restore := strings.TrimSpace(session.ProviderSessionID) != ""
	providerSessionID := firstNonEmpty(strings.TrimSpace(session.ProviderSessionID), newID())
	session.ProviderSessionID = providerSessionID
	conn, err := a.transport.Start(ctx, ProcessSpec{
		Provider:       ProviderClaudeCode,
		AgentSessionID: session.AgentSessionID,
		RoomID:         session.RoomID,
		CWD:            session.CWD,
		Command:        claudeSDKSidecarCommand(),
		Env:            claudeSDKSidecarEnv(session),
		DirectStart:    true,
	})
	if err != nil {
		return nil, err
	}
	adapterSession := &claudeSDKAdapterSession{
		conn:              conn,
		reader:            &claudeSDKLineReader{conn: conn},
		providerSessionID: providerSessionID,
		assistantMessages: make(map[string]string),
	}
	a.storeSession(session.AgentSessionID, adapterSession)
	if err := adapterSession.send(claudeSDKSidecarRequest{
		ID:   newID(),
		Type: "start",
		Payload: map[string]any{
			"agentSessionId":    session.AgentSessionID,
			"providerSessionId": providerSessionID,
			"cwd":               session.CWD,
			"env":               envListToMap(session.Env),
			"restore":           restore,
		},
	}); err != nil {
		_ = conn.Close()
		a.removeSession(session.AgentSessionID)
		return nil, err
	}

	for {
		event, err := adapterSession.reader.next(ctx)
		if err != nil {
			_ = conn.Close()
			a.removeSession(session.AgentSessionID)
			return nil, err
		}
		if next := a.applySidecarSessionEvent(adapterSession, session, event); next != nil {
			return next, nil
		}
		if event.Type == "error" {
			_ = conn.Close()
			a.removeSession(session.AgentSessionID)
			return nil, errors.New(payloadString(event.Payload, "error"))
		}
	}
}

func (a *ClaudeCodeSDKAdapter) Resume(ctx context.Context, session Session) error {
	if strings.TrimSpace(session.ProviderSessionID) == "" {
		return ErrSessionDisconnected
	}
	_, err := a.Start(ctx, session)
	return classifyClaudeSDKResumeError(session, err)
}

func (*ClaudeCodeSDKAdapter) CanResume(session Session) bool {
	return strings.TrimSpace(session.ProviderSessionID) != ""
}

func (a *ClaudeCodeSDKAdapter) Close(ctx context.Context, session Session) error {
	adapterSession := a.getSession(session.AgentSessionID)
	if adapterSession == nil {
		return nil
	}
	_ = adapterSession.send(claudeSDKSidecarRequest{
		ID:   newID(),
		Type: "close",
		Payload: map[string]any{
			"agentSessionId": session.AgentSessionID,
		},
	})
	a.removeSession(session.AgentSessionID)
	if graceful, ok := adapterSession.conn.(GracefulProcessConnection); ok {
		_ = graceful.CloseInput()
	}
	return adapterSession.conn.Close()
}

func (a *ClaudeCodeSDKAdapter) Exec(
	ctx context.Context,
	session Session,
	content []PromptContentBlock,
	displayPrompt string,
	turnID string,
	emit EventSink,
	_ CommandSnapshotSink,
) ([]activityshared.Event, error) {
	adapterSession := a.getSession(session.AgentSessionID)
	if adapterSession == nil {
		return nil, ErrSessionDisconnected
	}
	session.ProviderSessionID = adapterSession.providerSessionID
	explicitDisplayPrompt, visibleText := explicitAndVisiblePromptText(content, displayPrompt)
	events := make([]activityshared.Event, 0, 4)
	emitEvents := func(next []activityshared.Event) {
		if len(next) == 0 {
			return
		}
		events = append(events, next...)
		if emit != nil {
			emit(next)
		}
	}
	emitEvents([]activityshared.Event{
		newTurnActivityEvent(session, EventMessage, turnID, "", RoleUser, visibleText, userPromptActivityPayload(content, explicitDisplayPrompt, userPromptActivityPayloadExtraFromExecMetadata(ctx, map[string]any{
			"adapter": claudeSDKSidecarAdapterName,
		}))),
		newTurnActivityEvent(session, EventTurnStarted, turnID, SessionStatusWorking, "", "", map[string]any{
			"adapter": claudeSDKSidecarAdapterName,
		}),
	})

	if err := adapterSession.send(claudeSDKSidecarRequest{
		ID:   newID(),
		Type: "exec",
		Payload: map[string]any{
			"agentSessionId": session.AgentSessionID,
			"turnId":         turnID,
			"prompt":         promptTextForClaudeSDK(content, visibleText),
		},
	}); err != nil {
		return events, err
	}

	for {
		event, err := adapterSession.reader.next(ctx)
		if err != nil {
			return events, err
		}
		next, terminal, err := a.sidecarTurnEvents(adapterSession, session, turnID, event)
		if len(next) > 0 {
			emitEvents(next)
		}
		if err != nil {
			return events, err
		}
		if terminal {
			return events, nil
		}
	}
}

func (a *ClaudeCodeSDKAdapter) Cancel(_ context.Context, session Session, _ string) ([]activityshared.Event, error) {
	adapterSession := a.getSession(session.AgentSessionID)
	if adapterSession == nil {
		return nil, nil
	}
	_ = adapterSession.send(claudeSDKSidecarRequest{
		ID:   newID(),
		Type: "cancel",
		Payload: map[string]any{
			"agentSessionId": session.AgentSessionID,
		},
	})
	return nil, nil
}

func (a *ClaudeCodeSDKAdapter) HasLiveSession(session Session) bool {
	return a.getSession(session.AgentSessionID) != nil
}

func (a *ClaudeCodeSDKAdapter) ReleaseLiveSession(ctx context.Context, session Session) error {
	return a.Close(ctx, session)
}

func (a *ClaudeCodeSDKAdapter) SessionState(session Session) SessionStateSnapshot {
	return SessionStateSnapshot{
		RoomID:             session.RoomID,
		AgentSessionID:     session.AgentSessionID,
		Provider:           session.Provider,
		ProviderSessionID:  session.ProviderSessionID,
		Status:             session.Status,
		TurnLifecycle:      cloneRuntimeTurnLifecycle(session.TurnLifecycle),
		SubmitAvailability: cloneRuntimeSubmitAvailability(session.SubmitAvailability),
		PermissionModeID:   session.PermissionModeID,
		Settings:           cloneOptionalSessionSettings(session.Settings),
		RuntimeContext:     claudeSDKRuntimeContext(session),
		UpdatedAtUnixMS:    session.UpdatedAtUnixMS,
	}
}

func (a *ClaudeCodeSDKAdapter) applySidecarSessionEvent(adapterSession *claudeSDKAdapterSession, session Session, event claudeSDKSidecarEvent) []activityshared.Event {
	if event.Type != "session_started" && event.Type != "session_state" {
		return nil
	}
	if providerSessionID := payloadString(event.Payload, "providerSessionId"); providerSessionID != "" {
		adapterSession.providerSessionID = providerSessionID
		session.ProviderSessionID = providerSessionID
	}
	if event.Type != "session_started" {
		return nil
	}
	return []activityshared.Event{newSessionActivityEvent(session, EventSessionStarted, SessionStatusReady, claudeSDKRuntimeContext(session))}
}

func (a *ClaudeCodeSDKAdapter) sidecarTurnEvents(adapterSession *claudeSDKAdapterSession, session Session, turnID string, event claudeSDKSidecarEvent) ([]activityshared.Event, bool, error) {
	if providerSessionID := payloadString(event.Payload, "providerSessionId"); providerSessionID != "" {
		adapterSession.providerSessionID = providerSessionID
		session.ProviderSessionID = providerSessionID
	}
	switch event.Type {
	case "ok", "session_state":
		return nil, false, nil
	case "error":
		return nil, false, errors.New(payloadString(event.Payload, "error"))
	case "assistant_delta":
		messageID := adapterSession.assistantMessageID(turnID)
		content := firstNonEmpty(payloadString(event.Payload, "snapshot"), payloadString(event.Payload, "content"))
		return []activityshared.Event{newTurnActivityEventWithID(session, messageID, EventMessage, turnID, messageStreamStateStreaming, RoleAssistant, content, map[string]any{
			"adapter":     claudeSDKSidecarAdapterName,
			"messageId":   messageID,
			"contentMode": messageContentModeSnapshot,
		})}, false, nil
	case "assistant_completed":
		messageID := adapterSession.assistantMessageID(turnID)
		return []activityshared.Event{newTurnActivityEventWithID(session, messageID, EventMessage, turnID, messageStreamStateCompleted, RoleAssistant, payloadString(event.Payload, "content"), map[string]any{
			"adapter":     claudeSDKSidecarAdapterName,
			"messageId":   messageID,
			"contentMode": messageContentModeSnapshot,
		})}, false, nil
	case "turn_completed":
		return []activityshared.Event{newTurnActivityEvent(session, EventTurnCompleted, turnID, SessionStatusReady, "", "", map[string]any{
			"adapter":    claudeSDKSidecarAdapterName,
			"stopReason": firstNonEmpty(payloadString(event.Payload, "stopReason"), "end_turn"),
		})}, true, nil
	case "turn_canceled":
		return []activityshared.Event{newTurnActivityEvent(session, EventTurnCanceled, turnID, SessionStatusCanceled, "", "", map[string]any{
			"adapter": claudeSDKSidecarAdapterName,
		})}, true, nil
	case "turn_failed":
		return []activityshared.Event{newTurnActivityEvent(session, EventTurnFailed, turnID, SessionStatusFailed, "", "", map[string]any{
			"adapter": claudeSDKSidecarAdapterName,
			"error":   payloadString(event.Payload, "error"),
		})}, true, nil
	default:
		return nil, false, nil
	}
}

func (s *claudeSDKAdapterSession) assistantMessageID(turnID string) string {
	if s.assistantMessages == nil {
		s.assistantMessages = make(map[string]string)
	}
	if messageID := s.assistantMessages[turnID]; messageID != "" {
		return messageID
	}
	messageID := "claude-sdk:assistant:" + turnID
	s.assistantMessages[turnID] = messageID
	return messageID
}

func (s *claudeSDKAdapterSession) send(request claudeSDKSidecarRequest) error {
	if s == nil || s.conn == nil {
		return ErrSessionDisconnected
	}
	data, err := json.Marshal(request)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return s.conn.Send(data)
}

func (r *claudeSDKLineReader) next(ctx context.Context) (claudeSDKSidecarEvent, error) {
	for {
		if line, ok := nextBufferedLine(&r.buffer); ok {
			var event claudeSDKSidecarEvent
			if err := json.Unmarshal([]byte(line), &event); err != nil {
				return claudeSDKSidecarEvent{}, err
			}
			return event, nil
		}
		select {
		case <-ctx.Done():
			return claudeSDKSidecarEvent{}, ctx.Err()
		default:
		}
		frame, err := r.conn.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return claudeSDKSidecarEvent{}, ErrSessionDisconnected
			}
			return claudeSDKSidecarEvent{}, err
		}
		if len(frame.Stderr) > 0 {
			continue
		}
		if frame.ExitCode != nil {
			return claudeSDKSidecarEvent{}, fmt.Errorf("claude sdk sidecar exited with code %d", *frame.ExitCode)
		}
		if len(frame.Stdout) > 0 {
			r.buffer += string(frame.Stdout)
		}
	}
}

func nextBufferedLine(buffer *string) (string, bool) {
	if buffer == nil {
		return "", false
	}
	index := strings.IndexByte(*buffer, '\n')
	if index < 0 {
		return "", false
	}
	line := strings.TrimSpace((*buffer)[:index])
	*buffer = (*buffer)[index+1:]
	return line, line != ""
}

func (a *ClaudeCodeSDKAdapter) storeSession(agentSessionID string, session *claudeSDKAdapterSession) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sessions[agentSessionID] = session
}

func (a *ClaudeCodeSDKAdapter) getSession(agentSessionID string) *claudeSDKAdapterSession {
	if a == nil {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.sessions[agentSessionID]
}

func (a *ClaudeCodeSDKAdapter) removeSession(agentSessionID string) {
	if a == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.sessions, agentSessionID)
}

func claudeCodeSDKRuntimeEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv(claudeCodeRuntimeEnv)), claudeCodeRuntimeSDK)
}

func claudeSDKSidecarCommand() []string {
	if command := strings.TrimSpace(os.Getenv(claudeSDKSidecarCommandEnv)); command != "" {
		return strings.Fields(command)
	}
	root := findRepoRoot()
	if root == "" {
		return []string{"node", claudeSDKSidecarDefaultNodeArg, "packages/agent/claude-sdk-sidecar/src/main.ts"}
	}
	return []string{"node", claudeSDKSidecarDefaultNodeArg, filepath.Join(root, "packages/agent/claude-sdk-sidecar/src/main.ts")}
}

func claudeSDKSidecarEnv(session Session) []string {
	env := append([]string(nil), session.Env...)
	if os.Getenv(claudeSDKSidecarTestDriverEnv) != "" {
		env = append(env, claudeSDKSidecarTestDriverEnv+"="+os.Getenv(claudeSDKSidecarTestDriverEnv))
	}
	return env
}

func claudeSDKRuntimeContext(session Session) map[string]any {
	context := map[string]any{
		"adapter":       claudeSDKSidecarAdapterName,
		"configOptions": []map[string]any{claudeSDKModelConfigOption(session)},
	}
	if cwd := strings.TrimSpace(session.CWD); cwd != "" {
		context["cwd"] = cwd
	}
	if title := strings.TrimSpace(session.Title); title != "" {
		context["title"] = title
	}
	return context
}

func classifyClaudeSDKResumeError(session Session, err error) error {
	if err == nil {
		return nil
	}
	message := strings.TrimSpace(err.Error())
	lower := strings.ToLower(message)
	if strings.Contains(lower, "no conversation found with session id") ||
		strings.Contains(lower, "query closed before response received") {
		return &AppError{
			Code:    AppErrorProviderSessionNotFound,
			Message: "Agent provider session could not be restored.",
			DebugMessage: fmt.Sprintf(
				"Claude SDK restore target missing: room_id=%s provider=%s agent_session_id=%s provider_session_id=%s error=%s",
				strings.TrimSpace(session.RoomID),
				strings.TrimSpace(session.Provider),
				strings.TrimSpace(session.AgentSessionID),
				strings.TrimSpace(session.ProviderSessionID),
				message,
			),
			Cause: err,
		}
	}
	return err
}

func claudeSDKModelConfigOption(session Session) map[string]any {
	selectedModel := "default"
	if session.Settings != nil {
		if candidate := strings.TrimSpace(session.Settings.Model); claudeSDKModelOptionExists(candidate) {
			selectedModel = candidate
		}
	}
	return map[string]any{
		"id":           "model",
		"currentValue": selectedModel,
		"options": []map[string]string{
			{"name": "Default", "value": "default"},
			{"name": "Opus", "value": "opus"},
			{"name": "Sonnet", "value": "sonnet"},
			{"name": "Haiku", "value": "haiku"},
		},
	}
}

func claudeSDKModelOptionExists(model string) bool {
	switch strings.TrimSpace(model) {
	case "default", "opus", "sonnet", "haiku":
		return true
	default:
		return false
	}
}

func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if fileExists(filepath.Join(dir, "pnpm-workspace.yaml")) && fileExists(filepath.Join(dir, "packages/agent/claude-sdk-sidecar/src/main.ts")) {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func envListToMap(env []string) map[string]any {
	if len(env) == 0 {
		return nil
	}
	result := make(map[string]any, len(env))
	for _, item := range env {
		key, value, ok := strings.Cut(item, "=")
		if !ok || strings.TrimSpace(key) == "" {
			continue
		}
		result[key] = value
	}
	return result
}

func promptTextForClaudeSDK(content []PromptContentBlock, fallback string) string {
	var parts []string
	for _, block := range content {
		if strings.TrimSpace(block.Type) == "text" && strings.TrimSpace(block.Text) != "" {
			parts = append(parts, strings.TrimSpace(block.Text))
		}
	}
	if len(parts) > 0 {
		return strings.Join(parts, "\n\n")
	}
	return fallback
}

func cloneOptionalSessionSettings(settings *SessionSettings) *SessionSettings {
	if settings == nil {
		return nil
	}
	cloned := *settings
	if settings.BrowserUse != nil {
		value := *settings.BrowserUse
		cloned.BrowserUse = &value
	}
	if settings.ComputerUse != nil {
		value := *settings.ComputerUse
		cloned.ComputerUse = &value
	}
	return &cloned
}
