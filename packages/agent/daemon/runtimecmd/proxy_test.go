package runtimecmd

import (
	"strings"
	"testing"
)

// Real-world `scutil --proxy` output with Clash Verge system proxy enabled
// (HTTP/HTTPS/SOCKS all pointing at 127.0.0.1:7890).
const scutilProxyEnabled = `<dictionary> {
  ExceptionsList : <array> {
    0 : 127.0.0.1
    1 : localhost
    2 : *.local
  }
  HTTPEnable : 1
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7890
  HTTPSProxy : 127.0.0.1
  ProxyAutoConfigEnable : 0
  SOCKSEnable : 1
  SOCKSPort : 7890
  SOCKSProxy : 127.0.0.1
}`

const scutilProxyDisabled = `<dictionary> {
  ExceptionsList : <array> {
    0 : 127.0.0.1
    1 : localhost
  }
  HTTPEnable : 0
  HTTPSEnable : 0
  ProxyAutoConfigEnable : 0
  SOCKSEnable : 0
}`

func TestParseScutilProxyEnabled(t *testing.T) {
	got := parseScutilProxy(scutilProxyEnabled)
	want := map[string]string{
		"HTTPS_PROXY": "http://127.0.0.1:7890",
		"HTTP_PROXY":  "http://127.0.0.1:7890",
		"NO_PROXY":    noProxyDefault,
	}
	for k, v := range want {
		if got[k] != v {
			t.Fatalf("parseScutilProxy()[%q] = %q, want %q", k, got[k], v)
		}
	}
}

func TestParseScutilProxyDisabledReturnsNil(t *testing.T) {
	if got := parseScutilProxy(scutilProxyDisabled); got != nil {
		t.Fatalf("parseScutilProxy() = %v, want nil", got)
	}
}

func TestParseScutilProxyHTTPOnly(t *testing.T) {
	out := `<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 10.0.0.2
  HTTPPort : 3128
  HTTPSEnable : 0
  SOCKSEnable : 0
}`
	got := parseScutilProxy(out)
	if got["HTTP_PROXY"] != "http://10.0.0.2:3128" || got["HTTPS_PROXY"] != "http://10.0.0.2:3128" {
		t.Fatalf("parseScutilProxy() = %v, want HTTP(S)_PROXY=http://10.0.0.2:3128", got)
	}
}

func TestParseScutilProxySOCKSOnlyIgnored(t *testing.T) {
	out := `<dictionary> {
  HTTPEnable : 0
  HTTPSEnable : 0
  SOCKSEnable : 1
  SOCKSProxy : 127.0.0.1
  SOCKSPort : 7890
}`
	if got := parseScutilProxy(out); got != nil {
		t.Fatalf("parseScutilProxy() with SOCKS only = %v, want nil (SOCKS skipped)", got)
	}
}

func TestEnvInjectsSystemProxy(t *testing.T) {
	resolver := Resolver{
		Environ:     func() []string { return []string{"PATH=/usr/bin:/bin"} },
		HomeDir:     func() (string, error) { return t.TempDir(), nil },
		ScutilProxy: func() (string, bool) { return scutilProxyEnabled, true },
	}
	env := resolver.Env(nil)
	if got := envValue(env, "HTTPS_PROXY"); got != "http://127.0.0.1:7890" {
		t.Fatalf("HTTPS_PROXY = %q, want http://127.0.0.1:7890", got)
	}
	if got := envValue(env, "HTTP_PROXY"); got != "http://127.0.0.1:7890" {
		t.Fatalf("HTTP_PROXY = %q, want http://127.0.0.1:7890", got)
	}
	if got := envValue(env, "NO_PROXY"); got != noProxyDefault {
		t.Fatalf("NO_PROXY = %q, want %q", got, noProxyDefault)
	}
}

func TestEnvDoesNotOverrideExplicitProxy(t *testing.T) {
	resolver := Resolver{
		// User already exported a (lowercase) proxy — must be preserved.
		Environ: func() []string {
			return []string{"PATH=/usr/bin:/bin", "https_proxy=http://user-set:1080"}
		},
		HomeDir:     func() (string, error) { return t.TempDir(), nil },
		ScutilProxy: func() (string, bool) { return scutilProxyEnabled, true },
	}
	env := resolver.Env(nil)
	if got := envValue(env, "https_proxy"); got != "http://user-set:1080" {
		t.Fatalf("https_proxy = %q, want it preserved as http://user-set:1080", got)
	}
	// And we must not have appended a conflicting upper-case HTTPS_PROXY.
	count := 0
	for _, item := range env {
		if k, _, _ := strings.Cut(item, "="); strings.EqualFold(k, "HTTPS_PROXY") {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("found %d HTTPS_PROXY entries, want exactly 1 (no override)", count)
	}
}

func TestEnvNoProxyWhenScutilUnavailable(t *testing.T) {
	resolver := Resolver{
		Environ:     func() []string { return []string{"PATH=/usr/bin:/bin"} },
		HomeDir:     func() (string, error) { return t.TempDir(), nil },
		ScutilProxy: func() (string, bool) { return "", false },
	}
	env := resolver.Env(nil)
	if got := envValue(env, "HTTPS_PROXY"); got != "" {
		t.Fatalf("HTTPS_PROXY = %q, want empty when scutil unavailable", got)
	}
}
