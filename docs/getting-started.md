# Getting Started with Gadget

Gadget is an AI-powered E2E testing CLI tool that acts as an agentic beta tester. Write tests in YAML, run them against any web application with Playwright, and get production readiness assessments powered by Claude.

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
      secure: true

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
| `fill` (secure) | Fill a field, masking value in logs | `- fill: { label: "Password", value: "...", secure: true }` |
| `click` | Click a button, link, or element by text | `- click: "Submit"` |
| `assert` | Assert text visibility, URL, or page title | `- assert: { title: "Dashboard" }` |
| `wait` | Wait for a URL or CSS selector | `- wait: { selector: ".loaded" }` |

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

### Secure inputs

Use `secure: true` on fill steps to mask sensitive values (passwords, tokens) in console output, reports, and JSON artifacts. This prevents secrets from leaking into CI job logs.

```yaml
- fill:
    label: "Password"
    value: "{{ env.PASSWORD }}"
    secure: true
```

Output: `Fill "Password" with "••••••" (32ms)` — the real value is never logged.

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

## AI-Powered Audit

Gadget uses Claude to review your application's UI after test execution. AI is only used in the `audit` command — it analyzes screenshots captured during test runs to provide production readiness assessments. This requires an `ANTHROPIC_API_KEY` environment variable.

The `run` command works fully without AI — no API key needed.

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
  --reporter <names>        Comma-separated reporters (console,html,junit,github,json)
  --output <dir>            Output directory for reports/screenshots
  --provider <name>         AI provider (claude, openai, none)
  --stop-on-failure         Stop on first failure
  --dry-run                 Validate YAML without executing

gadget audit <paths...>     Run tests + AI production readiness assessment
  --headed                  Run browser in headed mode
  --base-url <url>          Override base URL
  --timeout <ms>            Override default timeout
  --reporter <names>        Comma-separated reporters (default: console,json)
  --output <dir>            Output directory for reports/screenshots
  --provider <name>         AI provider (required)
  --stop-on-failure         Stop on first failure

gadget validate <paths...>  Validate test files without running
gadget init                 Scaffold config and example test
gadget providers            List available AI providers and their status
```

## Audit Command

The `audit` command turns Gadget into an **AI beta tester**. It runs all test flows with screenshots captured at every step, then sends them to Claude to review the actual UI — exactly as a human tester would.

```bash
npx gadget audit tests/ --base-url https://staging.myapp.com
```

The AI looks at each screenshot and evaluates the application from a user's perspective: layout, readability, visual bugs, broken flows, UX friction. It does **not** comment on test coverage, security practices, or code quality — only on what a real user would see and experience.

### Verdict

The AI returns a verdict — **ready**, **not-ready**, or **needs-attention** — with a confidence score and a summary of the user experience.

### Findings

Each finding is categorized by severity:

| Severity | Meaning |
|----------|---------|
| **Critical** | Broken UI that prevents users from completing the flow. Blank pages, forms that don't submit, dead navigation. |
| **Warning** | UI problems that degrade the experience. Hard-to-read text, confusing layout, misleading labels. |
| **Nitpick** | Small visual details — spacing, alignment, truncated text, minor styling imperfections. |
| **Improvement** | UX suggestions — better button placement, clearer labels, visual hierarchy improvements. |

The AI deduplicates findings: if the same issue appears across multiple flows, it's reported once.

### Output

- Console: color-coded verdict banner with findings grouped by severity
- JSON: `audit-report.json` in the output directory (always generated)
- HTML: verdict section injected at the top of the HTML report
- GitHub: `::error`/`::warning` annotations + `GITHUB_STEP_SUMMARY` markdown

### Configuration

Add an optional `audit` section to `.gadgetrc.yaml`:

```yaml
audit:
  maxTokens: 4096    # max output tokens for the AI audit response
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

### JSON

Writes structured JSON files for CI artifact consumption:

```bash
npx gadget run tests/ --reporter json
# Saves .gadget/results/suite-result.json

npx gadget audit tests/ --base-url https://myapp.com
# Saves .gadget/results/suite-result.json and .gadget/results/audit-report.json
```

The `audit` command always includes the JSON reporter automatically.

### GitHub Actions

Emits `::error` annotations for inline PR feedback. For `audit`, also writes a markdown summary to `GITHUB_STEP_SUMMARY`:

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

## CI Integration

Gadget is designed to run as a scheduled job in your CI pipeline. Use the `audit` command for automated production readiness checks.

### GitHub Actions

```yaml
# .github/workflows/gadget-audit.yml
name: Gadget Audit

on:
  schedule:
    - cron: "0 6 * * *" # daily at 6:00 UTC
  workflow_dispatch: {}

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run Gadget Audit
        run: npx gadget audit tests/ --base-url ${{ vars.STAGING_URL }} --reporter console,json,github
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: gadget-audit-report
          path: .gadget/results/
```

### GitLab CI

```yaml
gadget-audit:
  image: mcr.microsoft.com/playwright:v1.50.0-noble
  stage: test
  script:
    - npm ci
    - npx gadget audit tests/ --base-url $STAGING_URL --reporter console,json
  artifacts:
    when: always
    paths:
      - .gadget/results/audit-report.json
      - .gadget/results/suite-result.json
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"
```

Schedule the pipeline via **GitLab > CI/CD > Schedules** (e.g. daily at 06:00 UTC). Required CI/CD variables: `ANTHROPIC_API_KEY`, `STAGING_URL`.

Full example files are available in the `examples/` directory.

## Exit Codes

### `gadget run`

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |
| `2` | Configuration or parse error |

### `gadget audit`

| Code | Meaning |
|------|---------|
| `0` | Verdict is "ready" with no critical findings |
| `1` | Verdict is "not-ready" or critical findings exist |
| `2` | Configuration or execution error |
