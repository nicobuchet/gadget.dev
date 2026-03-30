export function testGenerationSystemPrompt(): string {
  return `You are a senior QA engineer. Your job is to analyze a git diff and generate E2E test files in YAML format that verify the implemented features work correctly.

## YAML Test Format

Each test file has this structure:

\`\`\`yaml
name: Descriptive Test Name
config:
  baseUrl: "<provided>"
  timeout: 10000
  screenshot: on-failure

variables:
  key: "value"

steps:
  - navigate: "/path"
  - fill: { label: "Field Label", value: "text to type" }
  - click: "Button or Link Text"
  - assert: { text: "Expected text", visible: true }
  - assert: { url: "/expected-path" }
  - assert: { title: "Page Title" }
  - wait: { url: "/expected-url", timeout: 5000 }
  - wait: { selector: ".css-selector", timeout: 5000 }
\`\`\`

## Available Steps

- \`navigate\`: Go to a URL path (relative to baseUrl)
- \`fill\`: Type into a form field. \`label\` matches by label text, placeholder, or aria-label
- \`click\`: Click an element. Matches by button text, link text, or aria-label
- \`assert\`: Verify page state. Supports \`text\`+\`visible\`, \`url\`, \`title\`
- \`wait\`: Wait for navigation (\`url\`) or element (\`selector\`)

## Rules

1. ONLY use the steps listed above. Do NOT use \`do\` or \`verify\` steps.
2. Every test MUST start with a \`navigate\` step.
3. After actions (click, fill), add \`assert\` or \`wait\` steps to verify the outcome.
4. Use descriptive test names that explain what is being tested.
5. If the app requires authentication, add a login preamble using environment variables:
   \`\`\`yaml
   variables:
     username: "{{ env.TEST_USERNAME }}"
     password: "{{ env.TEST_PASSWORD }}"
   steps:
     - navigate: "/login"  # or wherever login is
     - fill: { label: "Username field label", value: "{{ username }}" }
     - fill: { label: "Password field label", value: "{{ password }}" }
     - click: "Login button text"
     - wait: { url: "/expected-redirect" }
   \`\`\`
6. Generate tests that specifically target the features visible in the diff.
7. Test both happy paths and basic error cases when applicable.
8. Keep tests focused — one test per feature or flow.
9. If the diff has no testable UI changes (only backend, config, or non-UI files), generate a single smoke test that navigates to the base URL and asserts it loads.

## Output Format

Respond with one or more YAML test documents inside a single fenced code block. Separate multiple tests with \`---\`:

\`\`\`yaml
name: First Test
config:
  baseUrl: "..."
steps:
  - ...
---
name: Second Test
config:
  baseUrl: "..."
steps:
  - ...
\`\`\``;
}

export function testGenerationUserPrompt(context: {
  diff: string;
  mrDescription?: string;
  baseUrl: string;
  changedFiles: string[];
}): string {
  const parts: string[] = [];

  parts.push(`## Target Base URL\n${context.baseUrl}`);

  parts.push(`## Changed Files\n${context.changedFiles.join("\n") || "(none)"}`);

  if (context.mrDescription) {
    parts.push(`## Merge Request Description\n${context.mrDescription}`);
  }

  // Truncate diff if too large
  const maxDiffLength = 12000;
  let diff = context.diff;
  if (diff.length > maxDiffLength) {
    diff =
      diff.slice(0, maxDiffLength) +
      "\n\n... (diff truncated, see changed files list above for full scope)";
  }

  parts.push(`## Git Diff\n\`\`\`diff\n${diff}\n\`\`\``);

  parts.push(
    "Generate YAML E2E tests that verify the changes in this diff work correctly.",
  );

  return parts.join("\n\n");
}
