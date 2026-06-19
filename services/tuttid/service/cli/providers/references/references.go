package references

import (
	"context"
	"errors"
	"strings"

	workspaceissues "github.com/tutti-os/tutti/packages/workspace/issues"
	workspacebiz "github.com/tutti-os/tutti/services/tuttid/biz/workspace"
	cliservice "github.com/tutti-os/tutti/services/tuttid/service/cli"
	"github.com/tutti-os/tutti/services/tuttid/service/cli/framework"
)

const (
	sourceApp  = "app"
	sourceTask = "task"

	// referenceListMaxFiles bounds a single resolution (defence against cycles /
	// pathologically large trees); also the default when --limit is omitted.
	referenceListMaxFiles = 1000
	// referenceListPageLimit is the per-page size when paging an app's hierarchy.
	referenceListPageLimit = 200
)

var errInvalidReferenceInput = errors.New("invalid reference input: source must be 'app' or 'task'")

type referenceListInput struct {
	Source  string `cli:"source" validate:"required" description:"Reference source: 'app' or 'task'."`
	ID      string `cli:"id" validate:"required" description:"Top container id: appId when source=app, topicId when source=task."`
	GroupID string `cli:"group-id" description:"Optional sub-scope: an app group id when source=app, an issueId when source=task. Empty = whole app / whole topic."`
	Query   string `cli:"query" description:"Optional file name filter."`
	Limit   int    `cli:"limit" description:"Optional max number of files (default and cap 1000)."`
}

// referenceFile is the normalized, source-agnostic shape both branches map into.
type referenceFile struct {
	Path            string
	DisplayName     string
	SizeBytes       int64
	MediaType       string
	CreatedAtUnixMs int64
}

var referenceColumns = []cliservice.TableColumn{
	{Key: "displayName", Label: "Name"},
	{Key: "path", Label: "Path"},
	{Key: "sizeBytes", Label: "Size"},
}

func (p Provider) newReferenceListCommand() cliservice.Command {
	return framework.Register(framework.CommandSpec[referenceListInput]{
		ID:          appID + ".reference.list",
		Path:        []string{"reference", "list"},
		Summary:     "List artifact files behind a workspace-reference mention",
		Description: "Resolve a workspace-reference handle (app+group / topic+issue) into a flat list of artifact files.",
		Kind:        framework.KindList,
		Workspace:   framework.WorkspaceRequired,
		Workspaces:  p.workspaces,
		Inputs:      framework.FromStruct[referenceListInput](),
		Output: framework.OutputSpec{
			DefaultMode: cliservice.OutputModeJSON,
			DefaultView: framework.ViewSummary,
			JSON:        true,
			Table:       &framework.TableOutputSpec{Columns: referenceColumns, Rows: referenceRows},
			JSONViews:   map[framework.OutputView]func(any) map[string]any{framework.ViewSummary: referenceListJSONValue},
			ListCompact: true,
		},
		Run: p.runReferenceList,
	})
}

func (p Provider) runReferenceList(ctx context.Context, invoke framework.InvokeContext, input referenceListInput) (any, error) {
	limit := input.Limit
	if limit <= 0 || limit > referenceListMaxFiles {
		limit = referenceListMaxFiles
	}
	switch strings.TrimSpace(input.Source) {
	case sourceApp:
		return p.collectAppFiles(ctx, invoke.WorkspaceID, input.ID, input.GroupID, input.Query, limit)
	case sourceTask:
		return p.collectTaskFiles(ctx, invoke.WorkspaceID, input.ID, input.GroupID, input.Query, limit)
	default:
		return nil, errInvalidReferenceInput
	}
}

// collectAppFiles walks the app's reference hierarchy (group → children) breadth-first
// and flattens it to files. This is the old front-end `collectFolderFiles` recursion
// moved server-side, going through the unified AppCenterService.ListReferences egress.
func (p Provider) collectAppFiles(ctx context.Context, workspaceID, appID, groupID, query string, limit int) ([]referenceFile, error) {
	if p.apps == nil {
		return nil, errInvalidReferenceInput
	}
	files := make([]referenceFile, 0, limit)
	seenFiles := make(map[string]struct{})
	visitedGroups := make(map[string]struct{})
	queue := []string{strings.TrimSpace(groupID)}
	for len(queue) > 0 && len(files) < limit {
		current := queue[0]
		queue = queue[1:]
		if _, ok := visitedGroups[current]; ok {
			continue
		}
		visitedGroups[current] = struct{}{}

		cursor := ""
		for len(files) < limit {
			result, err := p.apps.ListReferences(ctx, workspaceID, appID, workspacebiz.AppReferenceListInput{
				ParentGroupID: current,
				FilterText:    strings.TrimSpace(query),
				Limit:         referenceListPageLimit,
				Cursor:        cursor,
				Kinds:         []workspacebiz.AppReferenceKind{workspacebiz.AppReferenceKindFile},
			})
			if err != nil {
				return nil, err
			}
		collectItems:
			for _, item := range result.Items {
				switch item.AppReferenceListItemType() {
				case workspacebiz.AppReferenceListItemTypeGroup:
					if group, ok := item.(workspacebiz.AppReferenceGroup); ok {
						queue = append(queue, group.ID)
					}
				case workspacebiz.AppReferenceListItemTypeReference:
					ref, ok := item.(workspacebiz.AppReferenceListReferenceItem)
					if !ok {
						continue
					}
					file, ok := ref.Reference.(workspacebiz.AppFileReference)
					if !ok {
						continue
					}
					if _, dup := seenFiles[file.Path]; dup {
						continue
					}
					seenFiles[file.Path] = struct{}{}
					files = append(files, referenceFile{
						Path:            file.Path,
						DisplayName:     file.DisplayName,
						SizeBytes:       derefInt64(file.SizeBytes),
						MediaType:       file.MimeType,
						CreatedAtUnixMs: derefInt64(file.MtimeMs),
					})
					if len(files) >= limit {
						break collectItems
					}
				}
			}
			cursor = strOrEmpty(result.NextCursor)
			if cursor == "" {
				break
			}
		}
	}
	return files, nil
}

// collectTaskFiles resolves task artifacts through the in-process IssueManagerService:
// a specific issue (groupId) → its latest outputs; whole topic (id, no groupId) → search.
func (p Provider) collectTaskFiles(ctx context.Context, workspaceID, topicID, issueID, query string, limit int) ([]referenceFile, error) {
	if p.issues == nil {
		return nil, errInvalidReferenceInput
	}
	files := make([]referenceFile, 0, limit)

	if trimmedIssueID := strings.TrimSpace(issueID); trimmedIssueID != "" {
		detail, err := p.issues.GetIssueDetail(ctx, workspaceID, trimmedIssueID)
		if err != nil {
			return nil, err
		}
		needle := strings.ToLower(strings.TrimSpace(query))
		for _, out := range detail.LatestOutputs {
			if needle != "" && !strings.Contains(strings.ToLower(out.DisplayName), needle) {
				continue
			}
			files = append(files, outputToReferenceFile(out))
			if len(files) >= limit {
				break
			}
		}
		return files, nil
	}

	hits, err := p.issues.SearchIssueOutputs(ctx, workspaceissues.RunOutputSearchParams{
		WorkspaceID: workspaceID,
		TopicID:     strings.TrimSpace(topicID),
		Query:       strings.TrimSpace(query),
		Limit:       limit,
	})
	if err != nil {
		return nil, err
	}
	for _, hit := range hits {
		files = append(files, outputToReferenceFile(hit.Output))
		if len(files) >= limit {
			break
		}
	}
	return files, nil
}

func referenceListJSONValue(result any) map[string]any {
	files := result.([]referenceFile)
	items := make([]any, 0, len(files))
	for _, file := range files {
		items = append(items, map[string]any{
			"path":            file.Path,
			"displayName":     file.DisplayName,
			"sizeBytes":       file.SizeBytes,
			"mediaType":       file.MediaType,
			"createdAtUnixMs": file.CreatedAtUnixMs,
		})
	}
	return map[string]any{"items": items}
}

func referenceRows(result any) []map[string]any {
	files := result.([]referenceFile)
	rows := make([]map[string]any, 0, len(files))
	for _, file := range files {
		rows = append(rows, map[string]any{
			"displayName": file.DisplayName,
			"path":        file.Path,
			"sizeBytes":   file.SizeBytes,
		})
	}
	return rows
}

func outputToReferenceFile(out workspaceissues.RunOutput) referenceFile {
	return referenceFile{
		Path:            out.Path,
		DisplayName:     out.DisplayName,
		SizeBytes:       out.SizeBytes,
		MediaType:       out.MediaType,
		CreatedAtUnixMs: out.CreatedAtUnixMS,
	}
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func strOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
