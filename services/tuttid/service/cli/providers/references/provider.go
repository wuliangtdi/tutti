package references

import (
	"context"

	workspaceissues "github.com/tutti-os/tutti/packages/workspace/issues"
	workspacebiz "github.com/tutti-os/tutti/services/tuttid/biz/workspace"
	cliservice "github.com/tutti-os/tutti/services/tuttid/service/cli"
)

const appID = "references"

// AppReferences is the unified egress to a workspace app's produced artifacts.
// Satisfied by *workspaceservice.AppCenterService — the same in-process method the
// desktop picker funnels through (DaemonAPI.ListWorkspaceAppReferences → here → app
// /tutti/references/list). The CLI provider MUST go through this, never its own HTTP.
type AppReferences interface {
	ListReferences(context.Context, string, string, workspacebiz.AppReferenceListInput) (workspacebiz.AppReferenceListResult, error)
}

// IssueOutputs is the unified egress to task (issue / topic) produced artifacts.
// Satisfied by workspaceservice.IssueManagerService.
type IssueOutputs interface {
	GetIssueDetail(context.Context, string, string) (workspaceissues.IssueDetail, error)
	SearchIssueOutputs(context.Context, workspaceissues.RunOutputSearchParams) ([]workspaceissues.RunOutputSearchHit, error)
}

// Provider backs the `reference list` CLI command. It resolves a workspace-reference
// mention handle (app+group / topic+issue) into a flat list of artifact files, so the
// agent can read them on demand instead of receiving every path pre-expanded.
type Provider struct {
	workspaces cliservice.WorkspaceCatalog
	apps       AppReferences
	issues     IssueOutputs
}

func NewProvider(workspaces cliservice.WorkspaceCatalog, apps AppReferences, issues IssueOutputs) Provider {
	return Provider{workspaces: workspaces, apps: apps, issues: issues}
}

func (Provider) AppID() string {
	return appID
}

func (p Provider) Commands() []cliservice.Command {
	return []cliservice.Command{p.newReferenceListCommand()}
}
