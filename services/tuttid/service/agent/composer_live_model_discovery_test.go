package agent

import "testing"

func TestExtractModelOptionsFromRuntimeContext(t *testing.T) {
	options := extractModelOptionsFromRuntimeContext(map[string]any{
		"configOptions": []any{
			map[string]any{
				"id":           "model",
				"currentValue": "default",
				"options": []any{
					map[string]any{"name": "Default", "value": "default"},
					map[string]any{"name": "Sonnet", "value": "sonnet"},
				},
			},
			map[string]any{
				"id": "effort",
			},
		},
	})
	if len(options) != 2 {
		t.Fatalf("len(options) = %d, want 2", len(options))
	}
	if options[0].Value != "default" || options[1].Value != "sonnet" {
		t.Fatalf("options = %#v, want default and sonnet", options)
	}
}

func TestMergeLiveModelsIntoComposerOptionsUpdatesRuntimeContext(t *testing.T) {
	merged := mergeLiveModelsIntoComposerOptions(ComposerOptions{
		Provider: "claude-code",
		EffectiveSettings: ComposerSettings{
			Model: "default",
		},
		RuntimeContext: map[string]any{
			"configOptions": []map[string]any{
				{
					"id":           "effort",
					"currentValue": "high",
				},
			},
		},
	}, []ComposerConfigOptionValue{
		{ID: "default", Label: "Default", Value: "default"},
		{ID: "sonnet", Label: "Sonnet", Value: "sonnet"},
	})
	if !merged.ModelConfig.Configurable || len(merged.ModelConfig.Options) != 2 {
		t.Fatalf("modelConfig = %#v", merged.ModelConfig)
	}
	if merged.RuntimeContext["modelCatalogSource"] != "acp-live-discovery" {
		t.Fatalf("modelCatalogSource = %#v, want acp-live-discovery", merged.RuntimeContext["modelCatalogSource"])
	}
	configOptions, ok := merged.RuntimeContext["configOptions"].([]map[string]any)
	if !ok || len(configOptions) != 2 || configOptions[0]["id"] != "model" {
		t.Fatalf("configOptions = %#v, want model + effort", merged.RuntimeContext["configOptions"])
	}
}
