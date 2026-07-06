package agent

import (
	"strings"

	agentsessionstore "github.com/tutti-os/tutti/packages/agent/daemon/activity"
)

func submitAvailabilityEventPayload(value *agentsessionstore.WorkspaceAgentSubmitAvailability) map[string]any {
	if value == nil {
		return nil
	}
	state := strings.TrimSpace(value.State)
	if state == "" {
		return nil
	}
	payload := map[string]any{"state": state}
	if reason := strings.TrimSpace(value.Reason); reason != "" {
		payload["reason"] = reason
	}
	return payload
}
