# API Reference

## CLI Commands

### `gadget run <paths...>`

Run E2E tests from YAML files.

| Option | Description | Default |
|--------|-------------|---------|
| `--headed` | Run browser in headed mode | `false` |
| `--base-url <url>` | Override base URL | — |
| `--timeout <ms>` | Override default timeout | `10000` |
| `--reporter <names>` | Comma-separated reporters | `console` |
| `--output <dir>` | Output directory for results | `.gadget/results` |
| `--provider <name>` | AI provider (`claude`, `openai`, `none`) | `claude` |
| `--stop-on-failure` | Stop on first failure | `false` |
| `--dry-run` | Validate YAML without executing | `false` |

**Exit codes:** `0` all passed, `1` one or more failed, `2` config/parse error.

---

### `gadget audit <paths...>`

Run tests and produce an AI-powered production readiness assessment.

| Option | Description | Default |
|--------|-------------|---------|
| `--headed` | Run browser in headed mode | `false` |
| `--base-url <url>` | Override base URL | — |
| `--timeout <ms>` | Override default timeout | `10000` |
| `--reporter <names>` | Comma-separated reporters | `console` |
| `--output <dir>` | Output directory for results | `.gadget/results` |
| `--provider <name>` | AI provider (`claude`, `openai`, `none`) | `claude` |
| `--stop-on-failure` | Stop on first failure | `false` |
| `--settle <ms>` | Wait time after each step before screenshot | — |
| `--min-score <n>` | Minimum quality score (0–100) to pass | — |

The JSON reporter is always included automatically.

**Exit codes:** `0` verdict is "ready" with no criticals and score above threshold, `1` "not-ready"/criticals/below threshold, `2` config/execution error.

---

### `gadget check`

Auto-generate and run E2E tests from the current git diff.

| Option | Description | Default |
|--------|-------------|---------|
| `--base-url <url>` | Base URL to test against (required) | — |
| `--base-branch <branch>` | Git branch to diff against | `main` |
| `--mr <url>` | Merge request/PR URL for context | — |
| `--output-dir <dir>` | Directory for generated test files | `.gadget/generated` |
| `--no-run` | Only generate tests, don't execute | `false` |
| `--headed` | Run browser in headed mode | `false` |
| `--timeout <ms>` | Override default timeout | `10000` |
| `--reporter <names>` | Comma-separated reporters | `console` |
| `--stop-on-failure` | Stop on first failure | `false` |

**Exit codes:** `0` generated and passed, `1` generated but failed, `2` generation/config error.

---

### `gadget validate <paths...>`

Validate test files without running them.

**Exit codes:** `0` all valid, `2` parse errors found.

---

### `gadget init`

Scaffold a `.gadgetrc.yaml` config file and `tests/example.test.yaml`.

---

### `gadget providers`

List available AI providers with their configuration status.

---

## Configuration File

`.gadgetrc.yaml` — created by `gadget init`. All fields are optional; defaults are shown below.

```yaml
ai:
  provider: "claude"                      # claude | openai | none
  model: "claude-sonnet-4-6"              # model identifier
  apiKey: "{{ env.ANTHROPIC_API_KEY }}"   # supports env var interpolation
  maxTokens: 1024                         # max output tokens

browser:
  headless: true
  viewport:
    width: 1280
    height: 720
  slowMo: 0                              # ms delay between actions

output:
  dir: ".gadget/results"
  reporters:
    - console

audit:                                    # audit command only
  maxTokens: 4096
  minScore: 80                            # fail if score below this (0-100)

check:                                    # check command only
  baseBranch: "main"
  outputDir: ".gadget/generated"
  maxTokens: 8192
  run: true                               # auto-run generated tests
```

CLI options always override config file values.

---

## Test File Schema

### Test file (`.test.yaml`)

```yaml
name: string                   # required — test name

config:                        # optional
  baseUrl: string              # base URL for relative navigations
  timeout: number              # default step timeout in ms (default: 10000)
  screenshot: enum             # "always" | "on-failure" | "never" (default: "on-failure")
  stopOnFailure: boolean       # stop on first step failure (default: false)
  settle: number               # ms to wait after step before screenshot

variables:                     # optional — key-value pairs
  key: string

steps:                         # required — at least one step
  - <step>
```

### Suite file (`.yaml`)

```yaml
name: string                  # required — suite name

config:                       # optional — shared config for all tests
  baseUrl: string
  timeout: number
  screenshot: enum
  stopOnFailure: boolean
  settle: number

tests:                        # required — at least one entry
  - file: string              # relative path to a test file
```

---

## Step Types

### `navigate`

Navigate to a URL (absolute or relative to `baseUrl`).

```yaml
- navigate: "/login"
```

### `fill`

Type into a form field identified by its label.

```yaml
- fill:
    label: "Email"             # required — field label text
    value: "user@example.com"  # required — value to type
    secure: false              # optional — mask value in logs (default: false)
```

### `click`

Click a button, link, or element by its text content.

```yaml
- click: "Sign In"
```

### `assert`

Assert page state. At least one property required.

```yaml
- assert:
    text: "Welcome"            # optional — text visible on page
    visible: true              # optional — used with text (default: true)
    url: "/dashboard"          # optional — current URL contains string
    title: "My App"            # optional — page title matches
```

### `wait`

Wait for a URL change or a CSS selector to appear.

```yaml
- wait:
    url: "/dashboard"          # optional — wait for URL to contain string
    selector: ".loaded"        # optional — wait for CSS selector
    timeout: 15000             # optional — max wait time in ms
```

---

## Variable Interpolation

Use `{{ name }}` for test-level variables and `{{ env.VAR }}` for environment variables. Interpolation is applied recursively to all string values in steps.

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

---

## Types

### Steps

```typescript
type NavigateStep = {
  type: "navigate";
  url: string;
};

type FillStep = {
  type: "fill";
  label: string;
  value: string;
  secure?: boolean;
};

type ClickStep = {
  type: "click";
  target: string;
};

type AssertStep = {
  type: "assert";
  text?: string;
  visible?: boolean;
  url?: string;
  title?: string;
};

type WaitStep = {
  type: "wait";
  url?: string;
  selector?: string;
  timeout?: number;
};

type StepDefinition = NavigateStep | FillStep | ClickStep | AssertStep | WaitStep;
```

### Test & Suite

```typescript
type TestConfig = {
  baseUrl?: string;
  timeout?: number;
  screenshot?: "always" | "on-failure" | "never";
  stopOnFailure?: boolean;
  settle?: number;
};

type TestCase = {
  name: string;
  config: TestConfig;
  variables: Record<string, string>;
  steps: StepDefinition[];
  filePath?: string;
};

type TestSuite = {
  name: string;
  config: TestConfig;
  tests: TestCase[];
};
```

### Results

```typescript
type StepStatus = "pass" | "fail" | "skip";

type StepResult = {
  step: StepDefinition;
  status: StepStatus;
  duration: number;
  error?: string;
  screenshotPath?: string;
};

type TestResult = {
  name: string;
  filePath?: string;
  steps: StepResult[];
  status: "pass" | "fail";
  duration: number;
};

type SuiteResult = {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
};
```

### Audit

```typescript
type FeedbackSeverity = "critical" | "warning" | "nitpick" | "improvement";

type AuditFinding = {
  severity: FeedbackSeverity;
  title: string;
  description: string;
  relatedTest?: string;
  relatedStep?: number;
  screenshotPath?: string;
};

type ProductionReadiness = "ready" | "not-ready" | "needs-attention";

type AuditVerdict = {
  readiness: ProductionReadiness;
  confidence: number;
  qualityScore: number;
  summary: string;
};

type AuditReport = {
  verdict: AuditVerdict;
  findings: AuditFinding[];
  suiteResult: SuiteResult;
  timestamp: string;
  duration: number;
};
```

### Configuration

```typescript
type GadgetConfig = {
  ai: {
    provider: string;
    model?: string;
    apiKey?: string;
    maxTokens?: number;
  };
  browser: {
    headless: boolean;
    viewport: { width: number; height: number };
    slowMo: number;
  };
  output: {
    dir: string;
    reporters: string[];
  };
  check?: {
    baseBranch?: string;
    outputDir?: string;
    maxTokens?: number;
    run?: boolean;
  };
  audit?: {
    maxTokens?: number;
    minScore?: number;
  };
};
```

### AI Provider

```typescript
interface AIProvider {
  name: string;

  generateTests?(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
  }): Promise<string>;

  auditTest?(input: {
    testResult: TestResult;
    screenshots: Array<{ stepIndex: number; data: Buffer }>;
    stepDescriptions: string[];
    maxTokens: number;
  }): Promise<{ verdict: AuditVerdict; findings: AuditFinding[] }>;
}
```

### Reporter

```typescript
interface ReporterInterface {
  onTestStart(name: string): void;
  onStepResult(step: StepDefinition, result: StepResult): void;
  onTestEnd(result: TestResult): void;
  onSuiteEnd(result: SuiteResult): void;
  onAuditEnd?(report: AuditReport): void;
}
```

### Check

```typescript
type CheckResult = {
  generatedFiles: string[];
  suiteResult?: SuiteResult;
};

type CheckOptions = {
  baseUrl: string;
  baseBranch: string;
  mrUrl?: string;
  outputDir: string;
  run: boolean;
  config: GadgetConfig;
  headed?: boolean;
  timeout?: number;
  reporter?: string;
  stopOnFailure?: boolean;
};
```

---

## Reporters

| Name | Output | Use case |
|------|--------|----------|
| `console` | Colored terminal output | Default, real-time feedback |
| `html` | Self-contained HTML with embedded screenshots | Test documentation |
| `junit` | Standard JUnit XML | CI/CD (GitHub Actions, GitLab, Jenkins) |
| `json` | Structured JSON (`suite-result.json`, `audit-report.json`) | Automation, CI artifacts |
| `github` | `::error`/`::warning` annotations + `GITHUB_STEP_SUMMARY` | GitHub Actions PR feedback |

Combine reporters with commas: `--reporter console,html,junit`.

---

## Quality Score

The quality score ranges from 0 to 100 and is computed from audit findings:

| Severity | Deduction |
|----------|-----------|
| Critical | -20 |
| Warning | -10 |
| Nitpick | -3 |
| Improvement | -1 |

The AI may adjust the final score based on overall impression. A score of **80+** generally indicates production readiness.

---

## Environment Variables

| Variable | Required for | Description |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | `audit`, `check` (claude provider) | Anthropic API key |
| `OPENAI_API_KEY` | `audit`, `check` (openai provider) | OpenAI API key |
