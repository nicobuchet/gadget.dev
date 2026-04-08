---
name: gadget-validate
description: >
  Validate Gadget YAML test files without executing them. Use /gadget-validate
  to check test file syntax, catch YAML errors, or verify test files before
  running them.
disable-model-invocation: true
metadata:
  author: pyratzlabs
  version: "1.0.0"
---

# Gadget Validate

Validate YAML test files without running them. Catches syntax errors, missing
required fields, and schema violations.

## Workflow

### 1. Discover Test Files

If the user did not specify paths:

```bash
find . -name "*.test.yaml" -not -path "./.gadget/*" -not -path "./node_modules/*"
```

Ask which files to validate, or validate all.

### 2. Execute Validation

```bash
npx @pyratzlabs/gadget validate <paths...>
```

### 3. Interpret Results

- **All valid (exit 0):** Report "All X test file(s) are valid."
- **Errors (exit 2):** For each invalid file:
  - Show the file path and error message
  - Read the file and identify the exact issue
  - Suggest the fix (missing field, wrong type, bad YAML indentation)

### 4. Fix Assistance

If errors were found, offer to fix them:
- Read each invalid file
- Apply the fix
- Re-run validation to confirm

### Common Errors

- Missing `name` field (required)
- Missing `steps` or empty steps array (at least one step required)
- Invalid step type (not navigate/fill/click/assert/wait)
- `fill` step missing `label` or `value`
- `assert` step with no properties (needs at least one of text/url/title)
- Bad YAML indentation or syntax
