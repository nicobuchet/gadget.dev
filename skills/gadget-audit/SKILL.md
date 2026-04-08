---
name: gadget-audit
description: >
  Run Gadget E2E tests with AI-powered production readiness assessment.
  Screenshots every step, sends them to Claude for UI/UX review, returns a
  quality score and findings. Use /gadget-audit before releases, after UI
  changes, or when checking production readiness.
disable-model-invocation: true
metadata:
  author: pyratzlabs
  version: "1.0.0"
---

# Gadget Audit

Run E2E tests and produce an AI-powered production readiness assessment.
The audit captures screenshots at every step and sends them to Claude for
UI/UX review — like an automated beta tester.

## Workflow

### 1. Check Prerequisites

- Verify `ANTHROPIC_API_KEY` is set (required for audit):
  ```bash
  echo "${ANTHROPIC_API_KEY:+set}"
  ```
  If not set, tell the user: "Gadget audit requires ANTHROPIC_API_KEY. Set it with `export ANTHROPIC_API_KEY=sk-...`"
- Verify `.gadgetrc.yaml` exists (suggest `/gadget-init` if not)

### 2. Discover Test Files

```bash
find . -name "*.test.yaml" -not -path "./.gadget/*" -not -path "./node_modules/*"
```

Ask the user which tests to audit, or use a directory path for all.

### 3. Gather Parameters

Ask the user for any they haven't provided:
- **Base URL** — required if not in config/test files. Ask: "What URL should I audit? (e.g., https://staging.myapp.com)"
- **Min score** — optional. Ask: "Do you want a minimum quality score threshold? (0-100, common: 80)"
- **Headed mode** — ask if they want to watch the browser

### 4. Build and Execute

```bash
npx @pyratzlabs/gadget audit <paths...> \
  --base-url <url> \
  --reporter console,json \
  [--min-score <n>] \
  [--headed] \
  [--settle <ms>] \
  [--timeout <ms>]
```

Note: Always include `json` reporter — the audit produces a JSON report for structured parsing.

### 5. Interpret the Audit Report

After execution, read the JSON report if available:

```bash
cat .gadget/results/audit-report.json
```

Present the results in a structured format:

#### Verdict
- **Ready** (score 80+): "Your application passed the audit. Quality score: X/100."
- **Needs Attention** (score 50-79): "The audit found issues worth addressing. Quality score: X/100."
- **Not Ready** (score <50 or has criticals): "The audit found critical issues. Quality score: X/100."

#### Findings by Severity
Group findings and present them clearly:
- **Critical** — must fix before release
- **Warning** — should fix, degrades UX
- **Nitpick** — minor polish items
- **Improvement** — suggestions for better UX

For each finding, include: title, description, which test/step it relates to.

### 6. Follow-Up Actions

Based on the audit results:
- **Critical findings:** Offer to help fix the underlying code
- **Low score:** Suggest which findings to prioritize
- **All clean:** Congratulate and suggest running in CI
- Offer to re-run after fixes with `/gadget-audit`
