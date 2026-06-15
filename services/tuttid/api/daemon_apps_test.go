package api

import (
	"context"
	"net/http"
	"strings"
	"testing"

	workspacebiz "github.com/tutti-os/tutti/services/tuttid/biz/workspace"
	workspaceservice "github.com/tutti-os/tutti/services/tuttid/service/workspace"
)

func TestDaemonAPIGeneratedRoutesSearchWorkspaceAppReferences(t *testing.T) {
	mux := http.NewServeMux()
	var gotWorkspaceID string
	var gotAppID string
	var gotInput workspacebiz.AppReferenceSearchInput
	searchCalls := 0
	RegisterRoutes(
		mux,
		NewRoutes(DaemonAPI{
			AppCenterService: stubWorkspaceAppCenterService{
				searchReferencesFn: func(_ context.Context, workspaceID string, appID string, input workspacebiz.AppReferenceSearchInput) (workspacebiz.AppReferenceSearchResult, error) {
					searchCalls++
					gotWorkspaceID = workspaceID
					gotAppID = appID
					gotInput = input
					return workspacebiz.AppReferenceSearchResult{}, nil
				},
			},
		}),
	)

	recorder := performGeneratedRouteRequest(
		t,
		mux,
		http.MethodPost,
		"/v1/workspaces/workspace-1/apps/docs/references/search",
		map[string]any{
			"query":  " guide ",
			"limit":  5,
			"cursor": " cursor ",
			"kinds":  []string{"file"},
		},
	)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if searchCalls != 1 {
		t.Fatalf("expected one search call, got %d", searchCalls)
	}
	if gotWorkspaceID != "workspace-1" {
		t.Fatalf("expected workspace id workspace-1, got %q", gotWorkspaceID)
	}
	if gotAppID != "docs" {
		t.Fatalf("expected app id docs, got %q", gotAppID)
	}
	if gotInput.Query != "guide" {
		t.Fatalf("expected trimmed query, got %q", gotInput.Query)
	}
	if gotInput.Limit != 5 {
		t.Fatalf("expected limit 5, got %d", gotInput.Limit)
	}
	if gotInput.Cursor != "cursor" {
		t.Fatalf("expected trimmed cursor, got %q", gotInput.Cursor)
	}
	if len(gotInput.Kinds) != 1 || gotInput.Kinds[0] != workspacebiz.AppReferenceKindFile {
		t.Fatalf("expected file kind filter, got %#v", gotInput.Kinds)
	}
}

func TestDaemonAPIGeneratedRoutesSearchWorkspaceAppReferencesRejectsInvalidRequest(t *testing.T) {
	tests := []struct {
		name string
		body map[string]any
	}{
		{
			name: "missing query",
			body: map[string]any{},
		},
		{
			name: "query too long",
			body: map[string]any{"query": strings.Repeat("x", 201)},
		},
		{
			name: "limit below minimum",
			body: map[string]any{"query": "guide", "limit": 0},
		},
		{
			name: "limit above maximum",
			body: map[string]any{"query": "guide", "limit": 51},
		},
		{
			name: "cursor too long",
			body: map[string]any{"query": "guide", "cursor": strings.Repeat("c", 2049)},
		},
		{
			name: "unknown kind",
			body: map[string]any{"query": "guide", "kinds": []string{"url"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mux := http.NewServeMux()
			searchCalls := 0
			RegisterRoutes(
				mux,
				NewRoutes(DaemonAPI{
					AppCenterService: stubWorkspaceAppCenterService{
						searchReferencesFn: func(context.Context, string, string, workspacebiz.AppReferenceSearchInput) (workspacebiz.AppReferenceSearchResult, error) {
							searchCalls++
							return workspacebiz.AppReferenceSearchResult{}, nil
						},
					},
				}),
			)

			recorder := performGeneratedRouteRequest(
				t,
				mux,
				http.MethodPost,
				"/v1/workspaces/workspace-1/apps/docs/references/search",
				tt.body,
			)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
			}
			if searchCalls != 0 {
				t.Fatalf("expected search not to be called, got %d calls", searchCalls)
			}
		})
	}
}

type stubWorkspaceAppCenterService struct {
	searchReferencesFn func(context.Context, string, string, workspacebiz.AppReferenceSearchInput) (workspacebiz.AppReferenceSearchResult, error)
}

func (stubWorkspaceAppCenterService) Add(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) DeletePackage(context.Context, string, string) error {
	return nil
}

func (stubWorkspaceAppCenterService) ExportPackage(context.Context, string, string, string) (workspaceservice.AppPackageArchiveResult, error) {
	return workspaceservice.AppPackageArchiveResult{}, nil
}

func (stubWorkspaceAppCenterService) ImportPackage(context.Context, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) Install(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) Launch(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) List(context.Context, string) ([]workspacebiz.WorkspaceApp, error) {
	return nil, nil
}

func (stubWorkspaceAppCenterService) CatalogLoadState() workspacebiz.AppCatalogLoadState {
	return workspacebiz.AppCatalogLoadState{}
}

func (stubWorkspaceAppCenterService) RefreshCatalog(context.Context, string) ([]workspacebiz.WorkspaceApp, error) {
	return nil, nil
}

func (stubWorkspaceAppCenterService) Remove(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) ReplaceIcon(context.Context, string, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) Retry(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (stubWorkspaceAppCenterService) Rollback(context.Context, string, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}

func (s stubWorkspaceAppCenterService) SearchReferences(ctx context.Context, workspaceID string, appID string, input workspacebiz.AppReferenceSearchInput) (workspacebiz.AppReferenceSearchResult, error) {
	if s.searchReferencesFn == nil {
		return workspacebiz.AppReferenceSearchResult{}, nil
	}
	return s.searchReferencesFn(ctx, workspaceID, appID, input)
}

func (stubWorkspaceAppCenterService) StartEnabled(context.Context, string) ([]workspacebiz.WorkspaceApp, error) {
	return nil, nil
}

func (stubWorkspaceAppCenterService) StopAll(context.Context, string) ([]workspacebiz.WorkspaceApp, error) {
	return nil, nil
}

func (stubWorkspaceAppCenterService) Uninstall(context.Context, string, string) (workspacebiz.WorkspaceApp, error) {
	return workspacebiz.WorkspaceApp{}, nil
}
