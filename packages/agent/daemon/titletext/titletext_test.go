package titletext

import "testing"

func TestNormalize(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "plain text", input: "  hello   world ", want: "hello world"},
		{name: "file path with spaces", input: "[@renderer.js](/Users/Sun/first cc/renderer.js)", want: "@renderer.js"},
		{name: "href with parentheses", input: "[report](file:///tmp/a_(final).md)", want: "report"},
		{name: "escaped label", input: `[a\[b\]](https://example.com)`, want: "a[b]"},
		{name: "unmatched link stays readable", input: "[not a link](missing", want: "[not a link](missing"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := Normalize(test.input); got != test.want {
				t.Fatalf("Normalize(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}
