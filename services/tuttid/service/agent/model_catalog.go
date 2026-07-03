package agent

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/tutti-os/tutti/services/tuttid/biz/agentprovider"
	agentsidecarservice "github.com/tutti-os/tutti/services/tuttid/service/agentsidecar"
	tuttitypes "github.com/tutti-os/tutti/services/tuttid/types"
)

const (
	codexModelCacheTTL      = 30 * time.Second
	codexModelErrorCacheTTL = 5 * time.Second
	geminiModelCacheTTL     = 6 * time.Hour
	geminiModelFallbackTTL  = 5 * time.Minute
)

type AgentModelOption struct {
	ID          string
	DisplayName string
	Description string
	IsDefault   bool
}

type AgentModelCatalogResult struct {
	Provider  string
	Source    string
	FetchedAt time.Time
	Models    []AgentModelOption
}

type AgentModelCatalog interface {
	ListModels(context.Context, string) (AgentModelCatalogResult, error)
}

type AgentModelListResult struct {
	Models     []AgentModelOption
	IsFallback bool
}

type AgentModelLister interface {
	ListModels(context.Context) (AgentModelListResult, error)
}

type CachedAgentModelCatalog struct {
	Codex      AgentModelLister
	TuttiAgent AgentModelLister
	Gemini     AgentModelLister
	Now        func() time.Time

	mu              sync.Mutex
	codexCache      *agentModelCatalogCacheEntry
	tuttiAgentCache *agentModelCatalogCacheEntry
	geminiCache     *agentModelCatalogCacheEntry
}

type agentModelCatalogCacheEntry struct {
	result      AgentModelCatalogResult
	err         error
	expiresAtMS int64
}

func NewAgentModelCatalog() *CachedAgentModelCatalog {
	return &CachedAgentModelCatalog{
		Codex:      CodexCLIModelLister{},
		TuttiAgent: defaultTuttiAgentModelLister(),
		Gemini:     GeminiCLIModelLister{},
	}
}

func (c *CachedAgentModelCatalog) ListModels(ctx context.Context, provider string) (AgentModelCatalogResult, error) {
	provider = agentprovider.Normalize(provider)
	switch provider {
	case agentprovider.Codex:
		return c.listCodexModels(ctx)
	case agentprovider.TuttiAgent:
		return c.listTuttiAgentModels(ctx)
	case agentprovider.Gemini:
		return c.listGeminiModels(ctx)
	default:
		return AgentModelCatalogResult{}, ErrInvalidArgument
	}
}

func (c *CachedAgentModelCatalog) listCodexModels(ctx context.Context) (AgentModelCatalogResult, error) {
	now := c.now()
	if cached := c.readCodexCache(now); cached != nil {
		return cached.result, cached.err
	}
	lister := c.Codex
	if lister == nil {
		lister = CodexCLIModelLister{}
	}
	listResult, err := lister.ListModels(ctx)
	result := AgentModelCatalogResult{
		Provider:  agentprovider.Codex,
		Source:    "codex-cli",
		FetchedAt: now,
		Models: applyConfiguredDefaultModel(
			listResult.Models,
			readCodexConfiguredDefaultModel(),
			"Codex configured custom model",
		),
	}
	c.writeCodexCache(now, result, err)
	return cloneAgentModelCatalogResult(result), err
}

// listTuttiAgentModels mirrors the Codex path against the tutti-agent fork's
// app-server. No static fallback list is used: model visibility is decided by
// the Tutti model gateway policy, so only the live model/list result is
// trustworthy.
func (c *CachedAgentModelCatalog) listTuttiAgentModels(ctx context.Context) (AgentModelCatalogResult, error) {
	now := c.now()
	if cached := c.readTuttiAgentCache(now); cached != nil {
		return cached.result, cached.err
	}
	lister := c.TuttiAgent
	if lister == nil {
		lister = defaultTuttiAgentModelLister()
	}
	listResult, err := lister.ListModels(ctx)
	result := AgentModelCatalogResult{
		Provider:  agentprovider.TuttiAgent,
		Source:    "tutti-agent-cli",
		FetchedAt: now,
		Models:    cloneAgentModelOptions(listResult.Models),
	}
	c.writeTuttiAgentCache(now, result, err)
	return cloneAgentModelCatalogResult(result), err
}

func defaultTuttiAgentModelLister() CodexCLIModelLister {
	return CodexCLIModelLister{
		Command:    "tutti-agent",
		ClientName: "tutti_agent",
		PrepareEnv: prepareTuttiAgentModelListEnv,
	}
}

func prepareTuttiAgentModelListEnv(env []string) ([]string, error) {
	env = append([]string(nil), env...)
	env = withoutEnvKeys(env, "TUTTI_AGENT_HOME", "CODEX_HOME")
	tuttiAgentHome := filepath.Join(tuttitypes.DefaultStateDir(), "agent-model-catalog", "tutti-agent-home")
	if err := agentsidecarservice.PrepareTuttiAgentHome(tuttiAgentHome, agentsidecarservice.PrepareInput{}); err != nil {
		return nil, err
	}
	env = append(env, "TUTTI_AGENT_HOME="+tuttiAgentHome)
	// Prevent Tutti Agent's legacy CODEX_HOME fallback from reading Codex's
	// model cache when tuttid itself runs inside a Codex-hosted environment.
	env = append(env, "CODEX_HOME=")
	return env, nil
}

func withoutEnvKeys(env []string, keys ...string) []string {
	if len(env) == 0 || len(keys) == 0 {
		return env
	}
	drop := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		drop[key] = struct{}{}
	}
	filtered := env[:0]
	for _, entry := range env {
		key, _, _ := strings.Cut(entry, "=")
		if _, ok := drop[key]; ok {
			continue
		}
		filtered = append(filtered, entry)
	}
	return filtered
}

func (c *CachedAgentModelCatalog) readTuttiAgentCache(now time.Time) *agentModelCatalogCacheEntry {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.tuttiAgentCache == nil || now.UnixMilli() > c.tuttiAgentCache.expiresAtMS {
		c.tuttiAgentCache = nil
		return nil
	}
	return &agentModelCatalogCacheEntry{
		result: cloneAgentModelCatalogResult(c.tuttiAgentCache.result),
		err:    c.tuttiAgentCache.err,
	}
}

func (c *CachedAgentModelCatalog) writeTuttiAgentCache(now time.Time, result AgentModelCatalogResult, err error) {
	ttl := codexModelCacheTTL
	if err != nil {
		ttl = codexModelErrorCacheTTL
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tuttiAgentCache = &agentModelCatalogCacheEntry{
		result:      cloneAgentModelCatalogResult(result),
		err:         err,
		expiresAtMS: now.Add(ttl).UnixMilli(),
	}
}

func (c *CachedAgentModelCatalog) listGeminiModels(ctx context.Context) (AgentModelCatalogResult, error) {
	now := c.now()
	if cached := c.readGeminiCache(now); cached != nil {
		return cached.result, cached.err
	}
	lister := c.Gemini
	if lister == nil {
		lister = GeminiCLIModelLister{}
	}
	listResult, err := lister.ListModels(ctx)
	result := AgentModelCatalogResult{
		Provider:  agentprovider.Gemini,
		Source:    "gemini-cli",
		FetchedAt: now,
		Models: applyConfiguredDefaultModel(
			listResult.Models,
			readGeminiConfiguredDefaultModel(),
			"Gemini configured custom model",
		),
	}
	c.writeGeminiCache(now, result, listResult.IsFallback, err)
	return cloneAgentModelCatalogResult(result), err
}

func (c *CachedAgentModelCatalog) readCodexCache(now time.Time) *agentModelCatalogCacheEntry {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.codexCache == nil || now.UnixMilli() > c.codexCache.expiresAtMS {
		c.codexCache = nil
		return nil
	}
	return &agentModelCatalogCacheEntry{
		result: cloneAgentModelCatalogResult(c.codexCache.result),
		err:    c.codexCache.err,
	}
}

func (c *CachedAgentModelCatalog) writeCodexCache(now time.Time, result AgentModelCatalogResult, err error) {
	ttl := codexModelCacheTTL
	if err != nil {
		ttl = codexModelErrorCacheTTL
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.codexCache = &agentModelCatalogCacheEntry{
		result:      cloneAgentModelCatalogResult(result),
		err:         err,
		expiresAtMS: now.Add(ttl).UnixMilli(),
	}
}

func (c *CachedAgentModelCatalog) readGeminiCache(now time.Time) *agentModelCatalogCacheEntry {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.geminiCache == nil || now.UnixMilli() > c.geminiCache.expiresAtMS {
		c.geminiCache = nil
		return nil
	}
	return &agentModelCatalogCacheEntry{
		result: cloneAgentModelCatalogResult(c.geminiCache.result),
		err:    c.geminiCache.err,
	}
}

func (c *CachedAgentModelCatalog) writeGeminiCache(now time.Time, result AgentModelCatalogResult, isFallback bool, err error) {
	ttl := geminiModelCacheTTL
	if isFallback || err != nil {
		ttl = geminiModelFallbackTTL
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.geminiCache = &agentModelCatalogCacheEntry{
		result:      cloneAgentModelCatalogResult(result),
		err:         err,
		expiresAtMS: now.Add(ttl).UnixMilli(),
	}
}

func (c *CachedAgentModelCatalog) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

func cloneAgentModelCatalogResult(result AgentModelCatalogResult) AgentModelCatalogResult {
	return AgentModelCatalogResult{
		Provider:  result.Provider,
		Source:    result.Source,
		FetchedAt: result.FetchedAt,
		Models:    cloneAgentModelOptions(result.Models),
	}
}

func cloneAgentModelOptions(models []AgentModelOption) []AgentModelOption {
	if len(models) == 0 {
		return nil
	}
	result := make([]AgentModelOption, len(models))
	copy(result, models)
	return result
}

func applyConfiguredDefaultModel(models []AgentModelOption, configuredDefaultModel string, missingDescription string) []AgentModelOption {
	if configuredDefaultModel == "" {
		return cloneAgentModelOptions(models)
	}
	result := cloneAgentModelOptions(models)
	matched := false
	for index := range result {
		isDefault := result[index].ID == configuredDefaultModel
		result[index].IsDefault = isDefault
		if isDefault {
			matched = true
		}
	}
	if !matched {
		result = append(result, AgentModelOption{
			ID:          configuredDefaultModel,
			DisplayName: configuredDefaultModel,
			Description: missingDescription,
			IsDefault:   true,
		})
	}
	return result
}
