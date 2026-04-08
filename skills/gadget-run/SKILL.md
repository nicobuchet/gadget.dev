---
name: gadget-run
description: >
  Run Gadget E2E tests from YAML files using Playwright. Use /gadget-run
  when the user wants to execute E2E tests, check if tests pass, or run
  a specific test file.
disable-model-invocation: true
metadata:
  author: pyratzlabs
  version: "1.0.0"
---

# Gadget Run

Execute E2E tests from YAML files using Playwright.

## Workflow

### 1. Discover Test Files

Look for test files the user might want to run:

```bash
find . -name "*.test.yaml" -not -path "./.gadget/*" -not -path "./node_modules/*"
```

If the user specified a path, use it. Otherwise, present the discovered files and ask which to run.

### 2. Check Configuration

- Verify `.gadgetrc.yaml` exists (suggest `/gadget-init` if not)
- Read `.gadgetrc.yaml` to know the configured `baseUrl`
- If no `baseUrl` is configured in the config or test files, ask the user

### 3. Build the Command

Construct the `npx @pyratzlabs/gadget run` command with appropriate flags:

```bash
npx @pyratzlabs/gadget run <paths...> [options]
```

Available options to consider:
- `--base-url <url>` — if the user provided one or tests lack a baseUrl
- `--headed` — if the user wants to see the browser (ask if not specified)
- `--timeout <ms>` — only if the user wants a non-default timeout
- `--reporter <names>` — default is `console`; suggest `html` for shareable reports
- `--output <dir>` — only if non-default
- `--stop-on-failure` — suggest for large suites
- `--dry-run` — if user just wants to validate without executing

### 4. Execute

Run the command and let the output stream to the user.

### 5. Interpret Results

After execution:
- **All pass (exit 0):** Confirm success, mention number of tests/steps passed
- **Failures (exit 1):** For each failed test, identify:
  - Which step failed and why
  - The error message
  - Suggest fixes (e.g., wrong selector, timeout too short, baseUrl mismatch)
- **Parse error (exit 2):** Read the error, help fix the YAML

### 6. Follow-Up

If tests failed, offer to:
- Read the failing test file and suggest fixes
- Re-run with `--headed` to debug visually
- Run with `--dry-run` to validate YAML separately
- Run `/gadget-validate` to check syntax
