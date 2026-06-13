package workspace

import (
	"archive/zip"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultManagedAppRuntimeResolverInjectsBaselineRuntime(t *testing.T) {
	root := t.TempDir()
	pythonBinDir := filepath.Join(root, "python", "bin")
	nodeBinDir := filepath.Join(root, "node", "bin")
	for _, dir := range []string{pythonBinDir, nodeBinDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("mkdir runtime bin dir: %v", err)
		}
	}
	writeExecutable(t, filepath.Join(pythonBinDir, appRuntimePythonBinaryName()))
	writeExecutable(t, filepath.Join(nodeBinDir, appRuntimeNodeBinaryName()))
	writeExecutable(t, filepath.Join(nodeBinDir, appRuntimeNPMBinaryName()))

	resolved, err := DefaultManagedAppRuntimeResolver{
		RuntimeRoot: root,
		Environ:     func() []string { return []string{"PATH=/usr/bin:/bin"} },
	}.Resolve(context.Background())
	if err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}
	env := workspaceAppProcessEnv(append([]string{"TUTTI_APP_ID=test"}, resolved.EnvOverrides...)...)
	pathEnv := appRuntimeEnvValue(env, "PATH")
	if !strings.HasPrefix(pathEnv, pythonBinDir+string(os.PathListSeparator)+nodeBinDir) {
		t.Fatalf("PATH = %q, want managed runtime bins first", pathEnv)
	}
	if appRuntimeEnvValue(env, "TUTTI_APP_PYTHON") != filepath.Join(pythonBinDir, appRuntimePythonBinaryName()) {
		t.Fatalf("TUTTI_APP_PYTHON = %q", appRuntimeEnvValue(env, "TUTTI_APP_PYTHON"))
	}
	if appRuntimeEnvValue(env, "TUTTI_APP_NODE") != filepath.Join(nodeBinDir, appRuntimeNodeBinaryName()) {
		t.Fatalf("TUTTI_APP_NODE = %q", appRuntimeEnvValue(env, "TUTTI_APP_NODE"))
	}
	if !strings.Contains(pathEnv, "/usr/bin") {
		t.Fatalf("PATH = %q, want original path preserved", pathEnv)
	}
}

func TestDefaultManagedAppRuntimeResolverRejectsMissingRuntime(t *testing.T) {
	_, err := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{
				tuttiAppRuntimeCacheRootEnv + "=" + t.TempDir(),
				tuttiAppRuntimeCatalogEnv + "=",
			}
		},
	}.Resolve(context.Background())
	if err == nil {
		t.Fatal("Resolve() error = nil, want missing cached runtime error")
	}
}

func TestDefaultManagedAppRuntimeResolverUsesDaemonCacheRoot(t *testing.T) {
	cacheRoot := t.TempDir()
	root := defaultManagedAppRuntimeRoot([]string{
		tuttiAppRuntimeCacheRootEnv + "=" + cacheRoot,
	})

	if root != filepath.Join(cacheRoot, appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH)) {
		t.Fatalf("defaultManagedAppRuntimeRoot() = %q", root)
	}
}

func TestDefaultManagedAppRuntimeResolverUsesDefaultCatalogWhenUnset(t *testing.T) {
	source := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{"PATH=/usr/bin:/bin"}
		},
	}.runtimeCatalogSource()

	if source != defaultTuttiAppRuntimeCatalogURL {
		t.Fatalf("runtimeCatalogSource() = %q, want %q", source, defaultTuttiAppRuntimeCatalogURL)
	}

	sources := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{"PATH=/usr/bin:/bin"}
		},
	}.runtimeCatalogSources()
	if len(sources) != 2 || sources[0] != defaultTuttiAppRuntimeCatalogURL || sources[1] != legacyDefaultAppRuntimeCatalogURL {
		t.Fatalf("runtimeCatalogSources() = %#v, want Tutti default followed by legacy fallback", sources)
	}
}

func TestDefaultManagedAppRuntimeResolverAllowsEmptyCatalogOverride(t *testing.T) {
	source := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{
				tuttiAppRuntimeCatalogEnv + "=",
				"PATH=/usr/bin:/bin",
			}
		},
	}.runtimeCatalogSource()

	if source != "" {
		t.Fatalf("runtimeCatalogSource() = %q, want empty override", source)
	}
}

func TestDefaultManagedAppRuntimeResolverFallsBackToLegacyDefaultCatalog(t *testing.T) {
	cacheRoot := t.TempDir()
	pythonArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "python")
	pythonSHA256, _, err := fileSHA256AndSize(pythonArtifactPath)
	if err != nil {
		t.Fatalf("fileSHA256AndSize() error = %v", err)
	}
	nodeArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "node")
	nodeSHA256, _, err := fileSHA256AndSize(nodeArtifactPath)
	if err != nil {
		t.Fatalf("fileSHA256AndSize() error = %v", err)
	}
	legacyCatalogJSON := `{
  "schemaVersion": "tutti.app.runtimes.v2",
  "runtimes": {
    "` + appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH) + `": {
      "version": "test",
      "components": {
        "python": {
          "version": "test-python",
          "artifactUrl": "` + filepath.ToSlash(pythonArtifactPath) + `",
          "artifactSha256": "` + pythonSHA256 + `"
        },
        "node": {
          "version": "test-node",
          "artifactUrl": "` + filepath.ToSlash(nodeArtifactPath) + `",
          "artifactSha256": "` + nodeSHA256 + `"
        }
      },
      "profiles": {
        "baseline": ["python", "node"]
      }
    }
  }
}`
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/tutti/catalog.json":
			http.Error(writer, "not migrated yet", http.StatusForbidden)
		case "/nextop/catalog.json":
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(legacyCatalogJSON))
		default:
			http.NotFound(writer, request)
		}
	}))
	t.Cleanup(server.Close)

	resolver := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{
				tuttiAppRuntimeCacheRootEnv + "=" + cacheRoot,
				"PATH=/usr/bin:/bin",
			}
		},
	}
	catalog, err := resolver.loadCatalogWithFallbacks(
		context.Background(),
		[]string{server.URL + "/tutti/catalog.json", server.URL + "/nextop/catalog.json"},
	)
	if err != nil {
		t.Fatalf("loadCatalogWithFallbacks() error = %v", err)
	}
	if _, ok := catalog.Runtimes[appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH)]; !ok {
		t.Fatalf("fallback catalog runtimes = %#v, want current platform", catalog.Runtimes)
	}
}

func TestDefaultManagedAppRuntimeResolverDownloadsRuntimeFromCatalog(t *testing.T) {
	cacheRoot := t.TempDir()
	pythonArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "python")
	pythonSHA256, _, err := fileSHA256AndSize(pythonArtifactPath)
	if err != nil {
		t.Fatalf("fileSHA256AndSize() error = %v", err)
	}
	nodeArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "node")
	nodeSHA256, _, err := fileSHA256AndSize(nodeArtifactPath)
	if err != nil {
		t.Fatalf("fileSHA256AndSize() error = %v", err)
	}
	catalogPath := filepath.Join(t.TempDir(), "runtimes.json")
	catalogJSON := `{
  "schemaVersion": "tutti.app.runtimes.v2",
  "runtimes": {
    "` + appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH) + `": {
      "version": "test",
      "components": {
        "python": {
          "version": "test-python",
          "artifactUrl": "` + filepath.ToSlash(pythonArtifactPath) + `",
          "artifactSha256": "` + pythonSHA256 + `"
        },
        "node": {
          "version": "test-node",
          "artifactUrl": "` + filepath.ToSlash(nodeArtifactPath) + `",
          "artifactSha256": "` + nodeSHA256 + `"
        }
      },
      "profiles": {
        "baseline": ["python", "node"]
      }
    }
  }
}`
	if err := os.WriteFile(catalogPath, []byte(catalogJSON), 0o644); err != nil {
		t.Fatalf("write catalog: %v", err)
	}

	resolved, err := DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{
				tuttiAppRuntimeCacheRootEnv + "=" + cacheRoot,
				tuttiAppRuntimeCatalogEnv + "=" + catalogPath,
				"PATH=/usr/bin:/bin",
			}
		},
	}.Resolve(context.Background())
	if err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}

	wantRoot := filepath.Join(cacheRoot, appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH))
	if resolved.Root != wantRoot {
		t.Fatalf("Root = %q, want %q", resolved.Root, wantRoot)
	}
	for _, path := range []string{resolved.Python, resolved.Node, resolved.NPM} {
		if !strings.HasPrefix(path, wantRoot) {
			t.Fatalf("resolved executable %q is outside runtime root %q", path, wantRoot)
		}
		if !isExecutableFile(path) {
			t.Fatalf("resolved executable %q is not executable", path)
		}
	}
}

func TestDefaultManagedAppRuntimeResolverRejectsRuntimeShaMismatch(t *testing.T) {
	cacheRoot := t.TempDir()
	pythonArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "python")
	nodeArtifactPath := createManagedRuntimeComponentArchiveForTest(t, "node")
	nodeSHA256, _, err := fileSHA256AndSize(nodeArtifactPath)
	if err != nil {
		t.Fatalf("fileSHA256AndSize() error = %v", err)
	}
	catalogPath := filepath.Join(t.TempDir(), "runtimes.json")
	catalogJSON := `{
  "schemaVersion": "tutti.app.runtimes.v2",
  "runtimes": {
    "` + appRuntimePlatformArch(runtime.GOOS, runtime.GOARCH) + `": {
      "version": "test",
      "components": {
        "python": {
          "version": "test-python",
          "artifactUrl": "` + filepath.ToSlash(pythonArtifactPath) + `",
          "artifactSha256": "` + strings.Repeat("0", 64) + `"
        },
        "node": {
          "version": "test-node",
          "artifactUrl": "` + filepath.ToSlash(nodeArtifactPath) + `",
          "artifactSha256": "` + nodeSHA256 + `"
        }
      },
      "profiles": {
        "baseline": ["python", "node"]
      }
    }
  }
}`
	if err := os.WriteFile(catalogPath, []byte(catalogJSON), 0o644); err != nil {
		t.Fatalf("write catalog: %v", err)
	}

	_, err = DefaultManagedAppRuntimeResolver{
		Environ: func() []string {
			return []string{
				tuttiAppRuntimeCacheRootEnv + "=" + cacheRoot,
				tuttiAppRuntimeCatalogEnv + "=" + catalogPath,
			}
		},
	}.Resolve(context.Background())
	if err == nil || !strings.Contains(err.Error(), "sha256 mismatch") {
		t.Fatalf("Resolve() error = %v, want sha256 mismatch", err)
	}
}

func writeExecutable(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create executable parent %s: %v", path, err)
	}
	body := "#!/bin/sh\nexit 0\n"
	mode := os.FileMode(0o755)
	if runtime.GOOS == "windows" {
		body = "@echo off\r\nexit /b 0\r\n"
		mode = 0o644
	}
	if err := os.WriteFile(path, []byte(body), mode); err != nil {
		t.Fatalf("write executable %s: %v", path, err)
	}
}

func createManagedRuntimeComponentArchiveForTest(t *testing.T, componentName string) string {
	t.Helper()

	sourceDir := t.TempDir()
	switch componentName {
	case "python":
		writeExecutable(t, filepath.Join(sourceDir, "python", "bin", appRuntimePythonBinaryName()))
	case "node":
		writeExecutable(t, filepath.Join(sourceDir, "node", "bin", appRuntimeNodeBinaryName()))
		writeExecutable(t, filepath.Join(sourceDir, "node", "bin", appRuntimeNPMBinaryName()))
	default:
		t.Fatalf("unsupported runtime component %q", componentName)
	}

	archivePath := filepath.Join(t.TempDir(), "runtime.zip")
	target, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create runtime archive: %v", err)
	}
	writer := zip.NewWriter(target)
	walkErr := filepath.WalkDir(sourceDir, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relativePath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		if relativePath == "." {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relativePath)
		if entry.IsDir() {
			header.Name += "/"
		}
		archiveEntry, err := writer.CreateHeader(header)
		if err != nil || entry.IsDir() {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		_, err = archiveEntry.Write(data)
		return err
	})
	if err := writer.Close(); err != nil && walkErr == nil {
		walkErr = err
	}
	if err := target.Close(); err != nil && walkErr == nil {
		walkErr = err
	}
	if walkErr != nil {
		t.Fatalf("write runtime archive: %v", walkErr)
	}
	return archivePath
}
