# QABot — AI-Powered E2E Testing Tool

## Overview

QABot is a standalone CLI tool that executes E2E tests defined in YAML files against any web application. It uses Playwright for browser automation and a pluggable LLM layer (Claude, OpenAI, etc.) to analyze failures, interpret natural language steps, and provide intelligent QA feedback.

## Goals

- YAML-based test definitions with structured commands + natural language fallback
- Deterministic execution with AI-powered analysis on failure
- Pluggable LLM provider (Claude, OpenAI, custom)
- CI/CD-ready: exit codes, HTML reports, JUnit XML, GitHub Actions annotations
- Standalone package, reusable across any web project

## Architecture: Layered Monolith

Single package with clean internal boundaries across four layers.

```
CLI → Parser → Runner → Analyzer → Reporter
```

### Project Structure

```
qabot/
├── src/
│   ├── cli/              # CLI entry point, arg parsing
│   │   └── index.ts
│   ├── parser/           # YAML parsing + validation
│   │   ├── schema.ts     # Zod schemas for test files
│   │   ├── parser.ts     # YAML → typed TestSuite
│   │   └── resolver.ts   # Resolves natural language steps to commands
│   ├── runner/           # Playwright execution engine
│   │   ├── runner.ts     # Orchestrates test execution
│   │   ├── commands/     # One handler per command type
│   │   │   ├── navigate.ts
│   │   │   ├── fill.ts
│   │   │   ├── click.ts
│   │   │   ├── assert.ts
│   │   │   └── wait.ts
│   │   └── context.ts    # Browser/page lifecycle management
│   ├── analyzer/         # AI-powered analysis
│   │   ├── analyzer.ts   # Orchestrates AI feedback
│   │   ├── providers/    # Pluggable LLM providers
│   │   │   ├── provider.ts    # Interface
│   │   │   ├── claude.ts
│   │   │   └── openai.ts
│   │   └── prompts.ts    # Prompt templates for analysis
│   ├── reporter/         # Output generation
│   │   ├── console.ts    # Terminal output
│   │   ├── html.ts       # HTML report with screenshots
│   │   ├── junit.ts      # JUnit XML for CI
│   │   └── github.ts     # GitHub Actions annotations
│   └── types/            # Shared types
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Tech stack:** TypeScript, Playwright, Zod, `yaml`, `commander`.

## YAML Test Format

### Test File

```yaml
# tests/login.test.yaml
name: Login Flow
config:
  baseUrl: "https://app.example.com"
  timeout: 10000           # ms, per step
  screenshot: on-failure   # always | on-failure | never

variables:
  email: "admin@test.com"
  password: "password123"

steps:
  # Structured commands
  - navigate: "/login"

  - fill:
      label: "Email"           # matches by label, placeholder, or aria-label
      value: "{{ email }}"

  - fill:
      label: "Password"
      value: "{{ password }}"

  - click: "Submit"            # matches by text content, aria-label, or role

  - wait:
      url: "/dashboard"        # wait for navigation
      timeout: 5000

  # Natural language fallback (AI interprets + executes)
  - do: "Check that a welcome message is displayed"

  # Structured assertion
  - assert:
      text: "Welcome back"
      visible: true

  # AI-powered assertion (screenshot + analysis)
  - verify: "The dashboard shows a sidebar with navigation links and a main content area"
```

### Key Decisions

- **`fill`/`click`** use human-readable identifiers (label, text) — Playwright's `getByLabel()`, `getByText()`, `getByRole()` under the hood.
- **`{{ variables }}`** for reusable values, also supports env vars via `{{ env.API_KEY }}`.
- **`do`** = natural language action — AI interprets the page and performs it.
- **`verify`** = AI visual assertion — takes a screenshot, sends to LLM, asks "does this match?"
- **`assert`** = deterministic assertion — fails fast with no AI cost.

### Suite File

```yaml
# tests/suite.yaml
name: Smoke Tests
config:
  baseUrl: "https://app.example.com"

tests:
  - file: login.test.yaml
  - file: dashboard.test.yaml
  - file: logout.test.yaml
```

## Execution Flow

```
CLI invoked
  │
  ├─ 1. Parse YAML files (Zod validation)
  │     → fail fast on schema errors
  │
  ├─ 2. Launch Playwright browser (headless by default)
  │     → one browser context per test file
  │     → fresh page per test (isolation)
  │
  ├─ 3. Execute steps sequentially
  │     │
  │     ├─ Structured command (fill, click, navigate, assert, wait)
  │     │   → direct Playwright call
  │     │   → on success: log + move on
  │     │   → on failure: screenshot + send to AI analyzer
  │     │
  │     ├─ "do" step (natural language action)
  │     │   → screenshot current page
  │     │   → send screenshot + page HTML summary + instruction to LLM
  │     │   → LLM returns Playwright action(s) to execute
  │     │   → execute them, screenshot result
  │     │
  │     └─ "verify" step (AI visual assertion)
  │         → screenshot current page
  │         → send screenshot + assertion text to LLM
  │         → LLM returns { pass: bool, reason: string, details: string }
  │
  ├─ 4. AI Failure Analysis (on any step failure)
  │     → sends to LLM: screenshot, step definition, error message, page HTML excerpt
  │     → LLM returns:
  │        - what likely went wrong
  │        - is this a test bug or an app bug?
  │        - suggested fix
  │
  └─ 5. Generate reports
        ├─ Console: colored pass/fail per step with AI feedback inline
        ├─ HTML: full report with screenshots + AI analysis per failure
        ├─ JUnit XML: standard format for CI parsers
        └─ GitHub annotations: inline PR comments on failure (optional)
```

### Behaviors

- A failed step **does not stop the test** by default (configurable via `stopOnFailure: true`).
- Screenshots are stored in a `.qabot/` output directory.
- AI calls are only made when needed (failures, `do`, `verify`) to minimize cost.
- The LLM receives a **trimmed HTML summary** (visible elements, labels, roles) not the full DOM — keeps tokens low.

## AI Provider Interface

```typescript
interface AIProvider {
  name: string;

  analyzeFailure(input: {
    screenshot: Buffer;
    step: StepDefinition;
    error: string;
    htmlSummary: string;
  }): Promise<FailureAnalysis>;

  verifyVisual(input: {
    screenshot: Buffer;
    assertion: string;
    htmlSummary: string;
  }): Promise<VerifyResult>;

  interpretAction(input: {
    screenshot: Buffer;
    instruction: string;
    htmlSummary: string;
  }): Promise<PlaywrightAction[]>;
}

interface FailureAnalysis {
  summary: string;           // One-line: what went wrong
  category: "test-bug" | "app-bug" | "environment" | "flaky";
  details: string;           // Detailed explanation
  suggestedFix?: string;     // Actionable suggestion
}

interface VerifyResult {
  pass: boolean;
  reason: string;            // Why it passed or failed
  confidence: number;        // 0-1, how sure the AI is
}

interface PlaywrightAction {
  command: "click" | "fill" | "select" | "scroll" | "wait";
  params: Record<string, string>;
}
```

## Configuration

`.qabotrc.yaml` at project root:

```yaml
ai:
  provider: claude              # claude | openai | custom
  model: claude-sonnet-4-6     # provider-specific model
  apiKey: "{{ env.ANTHROPIC_API_KEY }}"
  maxTokens: 1024

browser:
  headless: true
  viewport: { width: 1280, height: 720 }
  slowMo: 0                    # ms delay between actions

output:
  dir: ".qabot/results"
  reporters:
    - console
    - html
    - junit
```

## CLI Interface

```bash
# Run tests
qabot run tests/                        # all tests in directory
qabot run tests/login.test.yaml         # specific file
qabot run tests/suite.yaml              # suite file

# Options
qabot run tests/ \
  --headed                              # show browser
  --base-url http://localhost:3000      # override config
  --timeout 15000                       # override default timeout
  --reporter console,html,junit        # override reporters
  --output ./results                    # override output dir
  --provider openai                    # override AI provider
  --stop-on-failure                    # halt on first failure
  --parallel 3                         # run test files in parallel
  --dry-run                            # validate YAML without executing

# Utilities
qabot validate tests/                  # validate YAML schemas only
qabot init                             # scaffold .qabotrc.yaml + example test
qabot providers                        # list available AI providers
```

### Exit Codes

- `0` — all tests passed
- `1` — one or more tests failed
- `2` — configuration/parse error

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run E2E tests
  run: npx qabot run tests/ --reporter console,junit,github
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: qabot-report
    path: .qabot/results/
```

### GitLab CI

```yaml
e2e:
  script:
    - npx qabot run tests/ --reporter console,junit
  artifacts:
    reports:
      junit: .qabot/results/junit.xml
    paths:
      - .qabot/results/
    when: always
```
