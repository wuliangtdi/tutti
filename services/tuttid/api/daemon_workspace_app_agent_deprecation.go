package api

import (
	"context"
	"strings"
	"time"

	reporterservice "github.com/tutti-os/tutti/services/tuttid/service/reporter"
)

const deprecatedWorkspaceAppAgentAPIUsedEvent = "deprecated_workspace_app_agent_api_used"

func (api DaemonAPI) trackDeprecatedWorkspaceAppAgentAPI(
	ctx context.Context,
	route string,
	appID string,
	workspaceAppVersion string,
) {
	if api.AnalyticsReporter == nil {
		return
	}
	route = strings.TrimSpace(route)
	appID = strings.TrimSpace(appID)
	workspaceAppVersion = strings.TrimSpace(workspaceAppVersion)
	if route == "" || appID == "" {
		return
	}
	if workspaceAppVersion == "" {
		workspaceAppVersion = "unknown"
	}
	api.AnalyticsReporter.Track(ctx, reporterservice.Event{
		Name:     deprecatedWorkspaceAppAgentAPIUsedEvent,
		ClientTS: time.Now().UnixMilli(),
		Params: map[string]any{
			"app_id":                appID,
			"migration_target":      "agent-acp-kit-tutti-cli-facade",
			"route":                 route,
			"workspace_app_version": workspaceAppVersion,
		},
	})
}
