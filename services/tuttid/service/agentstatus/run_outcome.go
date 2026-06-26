package agentstatus

import "sync"

// RunOutcomeStore remembers, per provider, whether a recent agent RUN failed
// authentication. The stateless status probe judges login by a local marker file
// / `auth status` command, which still reports "logged in" after a token has been
// revoked or expired — the failure only shows when an actual request 401s. The
// runtime records that here so the next status probe can override the stale
// "authenticated" verdict and surface "needs login" in the dock and wizard.
//
// It is a pointer so it survives the value-copies of Service: the runtime and the
// status probe share one store.
type RunOutcomeStore struct {
	mu         sync.RWMutex
	authFailed map[string]bool
}

func NewRunOutcomeStore() *RunOutcomeStore {
	return &RunOutcomeStore{authFailed: map[string]bool{}}
}

// RecordAuthFailure marks a provider's login as invalidated by a runtime
// authentication failure (e.g. a 401 when sending a message or on a trial run).
func (s *RunOutcomeStore) RecordAuthFailure(provider string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.authFailed[provider] = true
}

// RecordSuccess clears the invalidation once a request goes through, so a fixed
// login stops being reported as broken.
func (s *RunOutcomeStore) RecordSuccess(provider string) {
	s.clear(provider)
}

// ClearAuthInvalidated drops the stale-failure flag when the user re-authenticates
// (the login action), optimistically trusting the fresh login.
func (s *RunOutcomeStore) ClearAuthInvalidated(provider string) {
	s.clear(provider)
}

func (s *RunOutcomeStore) clear(provider string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.authFailed, provider)
}

// AuthInvalidated reports whether a recent run authentication failure means the
// provider should be treated as needing login.
func (s *RunOutcomeStore) AuthInvalidated(provider string) bool {
	if s == nil {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.authFailed[provider]
}
