# Getting Started with Gadget

Gadget is an AI-powered E2E testing CLI tool. Write tests in YAML, run them against any web application with Playwright, and get intelligent failure analysis powered by Claude.

## Installation

```bash
# Clone the repository
git clone git@gitlab.com:pyratzlabs/software/gadget.git
cd gadget

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build
npm run build
```

## Quick Start

### 1. Initialize a project

```bash
npx gadget init
```

This creates:
- `.gadgetrc.yaml` — project configuration
- `tests/example.test.yaml` — a sample test

### 2. Run your first test

```bash
npx gadget run tests/example.test.yaml
```

You should see colored console output with pass/fail results for each step.

### 3. Run in headed mode (visible browser)

```bash
npx gadget run tests/example.test.yaml --headed
```

## Writing Tests

Tests are YAML files with a `name`, optional `config`, and a list of `steps`.

### Basic example

```yaml
name: Login Flow
config:
  baseUrl: "https://myapp.com"
  timeout: 10000
  screenshot: on-failure

variables:
  username: "testuser"
  password: "secret123"

steps:
  - navigate: "/login"

  - fill:
      label: "Email"
      value: "{{ username }}"

  - fill:
      label: "Password"
      value: "{{ password }}"

  - click: "Sign In"

  - assert:
      url: "/dashboard"

  - assert:
      text: "Welcome back"
      visible: true
```

### Available Steps

| Step | Description | Example |
|------|-------------|---------|
| `navigate` | Go to a URL (relative or absolute) | `- navigate: "/login"` |
| `fill` | Type into a form field by label | `- fill: { label: "Email", value: "test@example.com" }` |
| `click` | Click a button, link, or element by text | `- click: "Submit"` |
| `assert` | Assert text visibility, URL, or page title | `- assert: { title: "Dashboard" }` |
| `wait` | Wait for a URL or CSS selector | `- wait: { selector: ".loaded" }` |
| `do` | Natural language action (requires AI) | `- do: "Close the cookie banner"` |
| `verify` | Visual assertion (requires AI) | `- verify: "The page shows a success message"` |

### Assert variants

```yaml
# Assert text is visible
- assert:
    text: "Welcome"
    visible: true

# Assert current URL contains a string
- assert:
    url: "/dashboard"

# Assert page title matches
- assert:
    title: "My App"
```

### Wait variants

```yaml
# Wait for URL to change
- wait:
    url: "/dashboard"

# Wait for a selector to appear
- wait:
    selector: ".data-table"
    timeout: 15000
```

### Variables

Use `{{ variableName }}` to interpolate variables defined in the test file, and `{{ env.VAR_NAME }}` for environment variables:

```yaml
variables:
  email: "test@example.com"

steps:
  - fill:
      label: "Email"
      value: "{{ email }}"

  - fill:
      label: "API Key"
      value: "{{ env.TEST_API_KEY }}"
```

## AI-Powered Steps

Gadget can use Claude to interpret natural language actions and visual assertions. This requires an `ANTHROPIC_API_KEY` environment variable.

### `do` — Natural language actions

The AI looks at the current page screenshot and HTML summary, then determines which Playwright actions to perform:

```yaml
- do: "Close the cookie consent banner"
- do: "Select the second item in the dropdown"
```

### `verify` — Visual assertions

The AI analyzes the page screenshot to determine if an assertion is true:

```yaml
- verify: "The shopping cart shows 3 items"
- verify: "There is an error message displayed in red"
```

### AI failure analysis

When a structured step (navigate, click, fill, assert, wait) fails and an AI provider is configured, Gadget automatically analyzes the failure and provides:

- A summary of what went wrong
- A category (`test-bug`, `app-bug`, `environment`, `flaky`)
- Suggested fixes

Without an API key, `do`/`verify` steps are skipped and failure analysis is omitted. The tool works fully without AI.

## Configuration

### `.gadgetrc.yaml`

```yaml
ai:
  provider: claude                        # claude | openai | none
  model: claude-sonnet-4-6                 # model to use
  apiKey: "{{ env.ANTHROPIC_API_KEY }}"   # API key (supports env vars)
  maxTokens: 1024

browser:
  headless: true
  viewport: { width: 1280, height: 720 }
  slowMo: 0                              # ms delay between actions

output:
  dir: ".gadget/results"
  reporters:
    - console
```

### CLI Options

All CLI options override `.gadgetrc.yaml` values:

```
gadget run <paths...>       Run E2E tests
  --headed                  Run browser in headed mode
  --base-url <url>          Override base URL
  --timeout <ms>            Override default timeout
  --reporter <names>        Comma-separated reporters (console,html,junit,github)
  --output <dir>            Output directory for reports/screenshots
  --provider <name>         AI provider (claude, openai, none)
  --stop-on-failure         Stop on first failure
  --dry-run                 Validate YAML without executing

gadget validate <paths...>  Validate test files without running
gadget init                 Scaffold config and example test
gadget providers            List available AI providers and their status
```

## Reporters

### Console (default)

Colored terminal output with pass/fail per step.

### HTML

Generates a self-contained HTML report with embedded screenshots:

```bash
npx gadget run tests/ --reporter console,html
# Report saved to .gadget/results/report.html
```

### JUnit XML

Standard JUnit XML for CI/CD integration:

```bash
npx gadget run tests/ --reporter junit
# Report saved to .gadget/results/junit.xml
```

### GitHub Actions

Emits `::error` annotations for inline PR feedback. Auto-activates when `GITHUB_ACTIONS` env var is present:

```bash
npx gadget run tests/ --reporter console,github
```

Use multiple reporters at once:

```bash
npx gadget run tests/ --reporter console,html,junit
```

## Test Suites

Group multiple test files into a suite:

```yaml
# tests/suite.yaml
name: Full Regression
config:
  baseUrl: "https://myapp.com"
  timeout: 15000

tests:
  - file: login.test.yaml
  - file: dashboard.test.yaml
  - file: checkout.test.yaml
```

Run the suite:

```bash
npx gadget run tests/suite.yaml
```

Or run all tests in a directory:

```bash
npx gadget run tests/
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |
| `2` | Configuration or parse error |
