---
name: gadget-check
description: >
  Auto-generate E2E tests from the current git diff using AI, optionally run
  them. Use /gadget-check after making changes to auto-test what changed,
  before opening a PR, or to validate new features have test coverage.
disable-model-invocation: true
metadata:
  author: pyratzlabs
  version: "1.0.0"
---

# Gadget Check

Auto-generate E2E tests from git changes and optionally run them.

## Workflow

### 1. Check Prerequisites

- Verify `ANTHROPIC_API_KEY` is set (required for AI test generation)
- Verify there are actual changes to diff:
  ```bash
  git diff --stat main...HEAD
  ```
  If no diff, tell the user there are no changes to generate tests for.

### 2. Gather Parameters

- **Base URL** (required): Ask "What URL should the generated tests run against?"
- **Base branch**: Default is `main`. Ask if they want to diff against a different branch.
  ```bash
  git branch -r --list "origin/*" | head -10
  ```
- **Run tests?**: Ask "Should I run the generated tests, or just generate them? (default: generate and run)"
- **MR/PR URL**: Optional. Ask if there's a PR/MR URL for additional context.

### 3. Build and Execute

```bash
npx @pyratzlabs/gadget check \
  --base-url <url> \
  [--base-branch <branch>] \
  [--mr <url>] \
  [--output-dir <dir>] \
  [--no-run] \
  [--headed] \
  [--timeout <ms>] \
  [--reporter <names>]
```

### 4. Review Generated Tests

After execution, read the generated test files:

```bash
ls .gadget/generated/
```

For each generated file, read it and summarize:
- What user flow it tests
- What assertions it makes
- Whether it looks correct for the changed code

### 5. Interpret Results

If tests were run (default):
- **All pass:** "Generated tests for your changes pass. The diff is covered."
- **Failures:** Analyze whether the failure is:
  - A real bug in the code (help fix it)
  - A bad test generation (suggest manual edits to the YAML)
  - A base URL / environment issue

If `--no-run` was used:
- List generated files and offer to run them with `/gadget-run`

### 6. Follow-Up

- Offer to move generated tests into the permanent test suite
- Suggest editing generated tests to improve coverage
- Offer to run `/gadget-audit` on the generated tests for UI/UX review
