# Getting Started with Gadget

Gadget is an AI-powered E2E testing CLI tool that acts as an agentic beta tester. Write tests in YAML, run them against any web application with Playwright, and get production readiness assessments powered by Claude.

## Installation

```bash
# Clone the repository
git clone https://github.com/nicobuchet/gadget.dev.git
cd gadget

# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Build
pnpm build
```

## Quick Start

### 1. Initialize a project

```bash
pnpm exec gadget init
```

This creates:
- `.gadgetrc.yaml` — project configuration
- `tests/example.test.yaml` — a sample test

### 2. Run your first test

```bash
pnpm exec gadget run tests/example.test.yaml
```

You should see colored console output with pass/fail results for each step.

### 3. Run in headed mode (visible browser)

```bash
pnpm exec gadget run tests/example.test.yaml --headed
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
  model: claude-sonnet-4-6                # fallback for both tasks
  # generateModel: claude-haiku-4-5       # optional override for `gadget check`
  # auditModel: claude-sonnet-4-6         # optional override for `gadget audit`
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

audit:
  # minScore: 80
  # linear:
  #   enabled: false
  #   apiKey: "{{ env.LINEAR_API_KEY }}"
  #   teamId: "your-linear-team-id"
  #   # projectId: "optional-linear-project-id"
  #   # createForSeverities: [critical, warning, nitpick, improvement]
  #   # titlePrefix: "[Gadget Audit]"
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
  --settle <ms>             Wait time after each step before screenshot
  --min-score <n>           Minimum quality score (0-100) to pass the audit
  --linear                  Create or update Linear tickets from audit findings
  --linear-team <id>        Override Linear team ID for ticket sync
  --linear-project <id>     Override Linear project ID for ticket sync

gadget validate <paths...>  Validate test files without running
gadget init                 Scaffold config and example test
gadget providers            List available AI providers and their status
```

## Audit Command

The `audit` command turns Gadget into an **AI beta tester**. It runs all test flows with screenshots captured at every step, then sends them to Claude to review the actual UI — exactly as a human tester would.

```bash
pnpm exec gadget audit tests/ --base-url https://staging.myapp.com
```

The AI looks at each screenshot and evaluates the application from a user's perspective: layout, readability, visual bugs, broken flows, UX friction. It does **not** comment on test coverage, security practices, or code quality — only on what a real user would see and experience.

### Quality Score

The AI assigns a **quality score from 0 to 100** based on the overall user experience. The score starts at 100 and is reduced based on findings:

| Finding severity | Deduction |
|------------------|-----------|
| Critical | -20 |
| Warning | -10 |
| Nitpick | -3 |
| Improvement | -1 |

The AI uses this as a guideline but may adjust the score based on its overall impression — for example, a single critical bug that blocks the entire flow may warrant a lower score than the formula suggests.

A score of **80+** generally means the feature is ready for production.

#### Using quality score as a CI gate

Use `--min-score` to fail the audit if the score is below a threshold:

```bash
# Fail if quality score is below 80
pnpm exec gadget audit tests/ --base-url https://staging.myapp.com --min-score 80
```

### Linear tickets

Use `--linear` to create or update Linear tickets directly from audit findings:

```bash
export LINEAR_API_KEY="lin_api_..."
pnpm exec gadget audit tests/ --base-url https://staging.myapp.com --linear --linear-team <team-id>
```

Gadget prefixes created issues with `[Gadget Audit]`, includes the audit description plus screenshots, and adds a comment instead of creating a duplicate when it finds an existing open Gadget-created ticket for the same finding.

You can also set the threshold in `.gadgetrc.yaml`:

```yaml
audit:
  minScore: 80
```

The CLI flag overrides the config value. Exit code is `1` when the score falls below the threshold.

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

- Console: color-coded verdict banner with quality score and findings grouped by severity
- JSON: `audit-report.json` in the output directory (always generated), includes `verdict.qualityScore`
- HTML: verdict section with quality score badge at the top of the HTML report
- GitHub: `::error`/`::warning` annotations + `GITHUB_STEP_SUMMARY` markdown table with quality score

### Configuration

Add an optional `audit` section to `.gadgetrc.yaml`:

```yaml
audit:
  maxTokens: 4096    # max output tokens for the AI audit response
  minScore: 80       # fail if quality score is below this threshold (0-100)
  linear:
    enabled: false
    apiKey: "{{ env.LINEAR_API_KEY }}"
    teamId: "your-linear-team-id"
    # projectId: "optional-linear-project-id"
    # createForSeverities: [critical, warning, nitpick, improvement]
    # titlePrefix: "[Gadget Audit]"
```

## Reporters

### Console (default)

Colored terminal output with pass/fail per step.

### HTML

Generates a self-contained HTML report with embedded screenshots:

```bash
pnpm exec gadget run tests/ --reporter console,html
# Report saved to .gadget/results/report.html
```

### JUnit XML

Standard JUnit XML for CI/CD integration:

```bash
pnpm exec gadget run tests/ --reporter junit
# Report saved to .gadget/results/junit.xml
```

### JSON

Writes structured JSON files for CI artifact consumption:

```bash
pnpm exec gadget run tests/ --reporter json
# Saves .gadget/results/suite-result.json

pnpm exec gadget audit tests/ --base-url https://myapp.com
# Saves .gadget/results/suite-result.json and .gadget/results/audit-report.json
```

The `audit` command always includes the JSON reporter automatically.

### GitHub Actions

Emits `::error` annotations for inline PR feedback. For `audit`, also writes a markdown summary to `GITHUB_STEP_SUMMARY`:

```bash
pnpm exec gadget run tests/ --reporter console,github
```

Use multiple reporters at once:

```bash
pnpm exec gadget run tests/ --reporter console,html,junit
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
pnpm exec gadget run tests/suite.yaml
```

Or run all tests in a directory:

```bash
pnpm exec gadget run tests/
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
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - name: Run Gadget Audit
        run: pnpm exec gadget audit tests/ --base-url ${{ vars.STAGING_URL }} --reporter console,json,github --min-score 80
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
  before_script:
    - corepack enable
  script:
    - pnpm install --frozen-lockfile
    - pnpm exec gadget audit tests/ --base-url $STAGING_URL --reporter console,json --min-score 80
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
| `0` | Verdict is "ready" with no critical findings and quality score is above `--min-score` (if set) |
| `1` | Verdict is "not-ready", critical findings exist, or quality score is below `--min-score` |
| `2` | Configuration or execution error |
