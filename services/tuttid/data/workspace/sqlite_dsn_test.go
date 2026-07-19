package workspace

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestSQLiteDSNUsesWindowsFileURIForm(t *testing.T) {
	t.Parallel()

	if runtime.GOOS != "windows" {
		t.Skip("windows path URI shape")
	}

	dbPath := `C:\Users\example\.tutti\tuttid.db`
	dsn := sqliteDSN(dbPath, false)
	if !strings.HasPrefix(dsn, "file:///C:/Users/example/.tutti/tuttid.db?") {
		t.Fatalf("sqliteDSN() = %q, want file:///C:/... URI form", dsn)
	}
	if strings.Contains(dsn, `\\`) || strings.Contains(dsn, "%5C") {
		t.Fatalf("sqliteDSN() kept backslashes: %q", dsn)
	}
}

func TestSQLiteDSNUnixAbsolutePath(t *testing.T) {
	t.Parallel()

	if runtime.GOOS == "windows" {
		t.Skip("unix path URI shape")
	}

	dbPath := "/home/example/.tutti/tuttid.db"
	dsn := sqliteDSN(dbPath, false)
	if !strings.HasPrefix(dsn, "file:///home/example/.tutti/tuttid.db?") {
		t.Fatalf("sqliteDSN() = %q", dsn)
	}
}

func TestOpenSQLiteStoreEnablesWAL(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "tuttid.db")
	store, err := OpenSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("OpenSQLiteStore() error = %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	var mode string
	if err := store.writeDB.QueryRow("PRAGMA journal_mode").Scan(&mode); err != nil {
		t.Fatalf("PRAGMA journal_mode error = %v", err)
	}
	if strings.ToLower(mode) != "wal" {
		t.Fatalf("journal_mode = %q, want wal", mode)
	}
}
