package agentstatus

import "sync"

var activeActions = struct {
	sync.Mutex
	byProvider map[string]ActiveAction
}{
	byProvider: map[string]ActiveAction{},
}

func setActiveAction(provider string, action ActiveAction) {
	activeActions.Lock()
	defer activeActions.Unlock()
	activeActions.byProvider[provider] = action
}

func appendActiveActionStdout(provider string, output string) {
	if output == "" {
		return
	}
	activeActions.Lock()
	defer activeActions.Unlock()
	action, ok := activeActions.byProvider[provider]
	if !ok {
		return
	}
	action.Stdout = trimActionOutput(action.Stdout + output)
	activeActions.byProvider[provider] = action
}

func clearActiveAction(provider string) {
	activeActions.Lock()
	defer activeActions.Unlock()
	delete(activeActions.byProvider, provider)
}

func activeActionForProvider(provider string) *ActiveAction {
	activeActions.Lock()
	defer activeActions.Unlock()
	action, ok := activeActions.byProvider[provider]
	if !ok {
		return nil
	}
	return &action
}
