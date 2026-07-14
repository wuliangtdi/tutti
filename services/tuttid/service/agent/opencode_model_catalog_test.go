package agent

import "testing"

func TestParseOpenCodeModelsOutput(t *testing.T) {
	t.Parallel()

	models := parseOpenCodeModelsOutput([]byte(`
Provider  Model
anthropic claude-sonnet-4-5 anthropic/claude-sonnet-4-5
openai    gpt-5                  openai/gpt-5
duplicate openai/gpt-5
`))

	if len(models) != 2 {
		t.Fatalf("len(models) = %d, want 2: %#v", len(models), models)
	}
	if models[0].ID != "anthropic/claude-sonnet-4-5" || models[0].IsDefault {
		t.Fatalf("first model = %#v", models[0])
	}
	if models[1].ID != "openai/gpt-5" || models[1].IsDefault {
		t.Fatalf("second model = %#v", models[1])
	}
}

func TestParseVerboseOpenCodeModelsOutputUsesModelVariants(t *testing.T) {
	t.Parallel()

	models := parseOpenCodeModelsOutput([]byte(`opencode/big-pickle
{
  "name": "Big Pickle",
  "capabilities": {"input": {"image": false}},
  "variants": {}
}
opencode/deepseek-v4-flash-free
{
  "name": "DeepSeek V4 Flash Free",
  "capabilities": {"input": {"image": true}},
  "variants": {
    "max": {"reasoningEffort": "max"},
    "low": {"reasoningEffort": "low"},
    "high": {"reasoningEffort": "high"},
    "medium": {"reasoningEffort": "medium"}
  }
}
`))

	if len(models) != 2 {
		t.Fatalf("len(models) = %d, want 2: %#v", len(models), models)
	}
	if !models[0].ReasoningEffortsAdvertised || len(models[0].SupportedReasoningEfforts) != 0 {
		t.Fatalf("Big Pickle reasoning profile = %#v", models[0])
	}
	if models[0].SupportsImageInput == nil || *models[0].SupportsImageInput {
		t.Fatalf("Big Pickle image support = %#v", models[0].SupportsImageInput)
	}
	wantEfforts := []string{"low", "medium", "high", "max"}
	for index, want := range wantEfforts {
		if models[1].SupportedReasoningEfforts[index].Value != want {
			t.Fatalf("DeepSeek reasoning efforts = %#v", models[1].SupportedReasoningEfforts)
		}
	}
	if models[1].SupportsImageInput == nil || !*models[1].SupportsImageInput {
		t.Fatalf("DeepSeek image support = %#v", models[1].SupportsImageInput)
	}
}
