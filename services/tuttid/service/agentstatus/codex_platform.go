package agentstatus

import "path/filepath"

// codexNpmPlatformDir returns the @openai npm optional-subpackage directory
// name that holds the platform-specific codex binary, e.g.
// "codex-darwin-arm64". ok is false for platforms codex does not publish.
//
// The @openai/codex npm package is only a JS launcher; the real binary lives
// in a per-platform optionalDependency subpackage. A missing/incomplete
// subpackage is the root cause of the spawn ENOENT seen in the field.
func codexNpmPlatformDir(goos, goarch string) (string, bool) {
	var nodeOS string
	switch goos {
	case "darwin":
		nodeOS = "darwin"
	case "linux":
		nodeOS = "linux"
	case "windows":
		nodeOS = "win32"
	default:
		return "", false
	}
	var nodeArch string
	switch goarch {
	case "arm64":
		nodeArch = "arm64"
	case "amd64":
		nodeArch = "x64"
	case "386":
		nodeArch = "ia32"
	default:
		return "", false
	}
	return "codex-" + nodeOS + "-" + nodeArch, true
}

// codexPlatformBinaryPath returns the absolute path to the platform-specific
// codex binary inside an installed @openai/codex package directory.
func codexPlatformBinaryPath(codexPkgDir, goos, goarch string) (string, bool) {
	dir, ok := codexNpmPlatformDir(goos, goarch)
	if !ok {
		return "", false
	}
	binName := "codex"
	if goos == "windows" {
		binName = "codex.exe"
	}
	return filepath.Join(codexPkgDir, "node_modules", "@openai", dir, binName), true
}

// codexPlatformBinaryComplete reports whether the platform-specific codex
// binary is present and executable inside the given @openai/codex package
// directory. It returns the resolved binary path alongside the verdict.
func (s Service) codexPlatformBinaryComplete(codexPkgDir, goos, goarch string) (string, bool) {
	path, ok := codexPlatformBinaryPath(codexPkgDir, goos, goarch)
	if !ok {
		return "", false
	}
	return path, s.executableFile(path)
}

func codexPackageDirForBinary(binaryPath string) string {
	packageJSONPath := findAdapterPackageJSON(binaryPath, "@openai/codex")
	if packageJSONPath == "" {
		return ""
	}
	return filepath.Dir(packageJSONPath)
}
