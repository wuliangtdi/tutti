package agentruntime

import (
	"strings"
	"testing"

	activityshared "github.com/tutti-os/tutti/packages/agentactivity/daemon/activity/events"
)

func TestFinalizeThinkingItemReplacesWordTokenStream(t *testing.T) {
	t.Parallel()

	session := testSession()
	normalizer := newACPTurnNormalizer()
	normalizer.SetThinkingPresentation("review-process")

	for _, chunk := range []string{"It", "looks", "like", "a", "bug"} {
		if events := normalizer.AppendThinkingChunk(session, "turn-1", chunk); len(events) != 0 {
			t.Fatalf("AppendThinkingChunk(%q) emitted %d events, want deferred review-process stream", chunk, len(events))
		}
	}

	events := normalizer.FinalizeThinkingItem(session, "turn-1", "It looks like a bug")
	if len(events) != 1 {
		t.Fatalf("FinalizeThinkingItem events = %d, want 1", len(events))
	}
	if got := events[0].Payload.Content; got != "It looks like a bug" {
		t.Fatalf("content = %q, want authoritative completed summary", got)
	}
	if got := events[0].Payload.Metadata["messageKind"]; got != "review-process" {
		t.Fatalf("messageKind = %#v, want review-process", got)
	}
	if events[0].Payload.Role != activityshared.MessageRole(RoleAssistantThinking) {
		t.Fatalf("role = %q, want assistant thinking role", events[0].Payload.Role)
	}
}

func TestAppendAssistantChunkIgnoresDuplicateSnapshotChunk(t *testing.T) {
	t.Parallel()

	session := testSession()
	normalizer := newACPTurnNormalizer()
	fullText := "你好！有什么可以帮你的吗？"

	for _, chunk := range []string{"你好", "！有什么", "可以帮你的吗？"} {
		events := normalizer.AppendAssistantChunk(session, "turn-1", chunk)
		if len(events) != 1 {
			t.Fatalf("AppendAssistantChunk(%q) events = %d, want 1", chunk, len(events))
		}
	}

	events := normalizer.AppendAssistantChunk(session, "turn-1", fullText)
	if len(events) != 1 {
		t.Fatalf("duplicate snapshot chunk events = %d, want 1", len(events))
	}
	if got := events[0].Payload.Content; got != fullText {
		t.Fatalf("content = %q, want single authoritative snapshot without duplication", got)
	}

	normalizer.ApplyAssistantFinalText(fullText)
	completed := normalizer.FinishCompleted(session, "turn-1")
	for _, event := range completed {
		if event.Type != EventMessage {
			continue
		}
		if got := event.Payload.Content; got != fullText {
			t.Fatalf("completed content = %q, want %q", got, fullText)
		}
	}
}

func TestAppendAssistantChunkReplacesCumulativeSnapshotChunk(t *testing.T) {
	t.Parallel()

	session := testSession()
	normalizer := newACPTurnNormalizer()
	_ = normalizer.AppendAssistantChunk(session, "turn-1", "Hello")

	events := normalizer.AppendAssistantChunk(session, "turn-1", "Hello world")
	if len(events) != 1 {
		t.Fatalf("cumulative snapshot chunk events = %d, want 1", len(events))
	}
	if got := events[0].Payload.Content; got != "Hello world" {
		t.Fatalf("content = %q, want cumulative snapshot replacement", got)
	}
}

func TestAppendThinkingChunkStillStreamsWithoutReviewPresentation(t *testing.T) {
	t.Parallel()

	session := testSession()
	normalizer := newACPTurnNormalizer()
	events := normalizer.AppendThinkingChunk(session, "turn-1", "Need context.")
	if len(events) != 1 {
		t.Fatalf("AppendThinkingChunk events = %d, want 1", len(events))
	}
	if !strings.Contains(events[0].Payload.Content, "Need context.") {
		t.Fatalf("content = %q", events[0].Payload.Content)
	}
}
