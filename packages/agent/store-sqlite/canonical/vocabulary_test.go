package canonical

import "testing"

func TestClosedVocabularyValidation(t *testing.T) {
	t.Parallel()

	for _, phase := range []string{TurnPhaseSubmitted, TurnPhaseRunning, TurnPhaseWaiting, TurnPhaseSettling, TurnPhaseSettled} {
		if !IsKnownTurnPhase(phase) {
			t.Fatalf("IsKnownTurnPhase(%q) = false", phase)
		}
	}
	if IsKnownTurnPhase("planning") {
		t.Fatal("IsKnownTurnPhase(planning) = true")
	}
	for _, outcome := range []string{TurnOutcomeCompleted, TurnOutcomeFailed, TurnOutcomeCanceled, TurnOutcomeInterrupted} {
		if !IsKnownTurnOutcome(outcome) {
			t.Fatalf("IsKnownTurnOutcome(%q) = false", outcome)
		}
	}
}
