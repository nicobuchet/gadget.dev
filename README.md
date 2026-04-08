# Gadget

AI-powered E2E testing CLI that acts as an agentic beta tester.

Write tests in YAML, run them against any web application with [Playwright](https://playwright.dev), and get production readiness assessments powered by [Claude](https://www.anthropic.com).

## Quick Start

### 1. Install

```bash
npm i -g @pyratzlabs/gadget
npx playwright install chromium
```

### 2. Initialize a project

```bash
gadget init
```

This creates a `.gadgetrc.yaml` config file and a sample test in `tests/example.test.yaml`.

### 3. Run an audit

Set your Anthropic API key, then run the audit command against your app:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
gadget audit tests/ --base-url https://staging.myapp.com
```

Gadget runs every test flow with screenshots at each step, then sends them to Claude to evaluate the UI from a real user's perspective. You get a verdict (**ready**, **not-ready**, or **needs-attention**), a quality score (0-100), and actionable findings.

## Writing Tests

Tests are YAML files with a `name`, optional `config`/`variables`, and a list of `steps`:

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

Use `{{ variableName }}` for test variables and `{{ env.VAR_NAME }}` for environment variables. Mark sensitive fields with `secure: true` to mask values in logs.

## Commands

| Command | Description |
|---------|-------------|
| `gadget run <paths...>` | Run E2E tests |
| `gadget audit <paths...>` | Run tests + AI production readiness assessment |
| `gadget check` | Auto-generate and run tests from git diff |
| `gadget validate <paths...>` | Validate test files without running |
| `gadget init` | Scaffold `.gadgetrc.yaml` and example test |
| `gadget providers` | List available AI providers and their status |

## AI Audit & Quality Score

The `audit` command captures a screenshot after every step and sends them to Claude for review. The AI evaluates layout, readability, visual bugs, broken flows, and UX friction — exactly what a human tester would look at.

Findings are categorized by severity:

| Severity | Impact on score |
|----------|----------------|
| Critical | -20 |
| Warning | -10 |
| Nitpick | -3 |
| Improvement | -1 |

A score of **80+** generally means production-ready. Use `--min-score` as a CI gate:

```bash
gadget audit tests/ --base-url https://staging.myapp.com --min-score 80
```

## Reporters

Use `--reporter` to choose output formats (combine with commas):

- **console** — colored terminal output (default)
- **html** — self-contained HTML report with embedded screenshots
- **junit** — standard JUnit XML for CI/CD
- **json** — structured JSON for automation
- **github** — GitHub Actions annotations + step summary

```bash
gadget run tests/ --reporter console,html,junit
```

## CI Integration

Gadget is designed to run in CI pipelines. Example workflow files are available in the [`examples/`](examples/) directory for both GitHub Actions and GitLab CI.

See the [full documentation](docs/getting-started.md) for detailed CI setup guides.

## Configuration

Project settings live in `.gadgetrc.yaml` (created by `gadget init`). CLI flags override config values. See the [getting started guide](docs/getting-started.md) for all options.

## Documentation

- **[Getting Started](docs/getting-started.md)** — full guide with all step types, test suites, variable interpolation, CI examples, and exit codes
- **[API Reference](docs/api-reference.md)** — complete CLI options, configuration schema, test file format, and TypeScript types
