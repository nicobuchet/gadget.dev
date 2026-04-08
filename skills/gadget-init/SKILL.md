---
name: gadget-init
description: >
  Initialize a Gadget E2E testing project. Scaffolds .gadgetrc.yaml and an
  example test file. Use /gadget-init when setting up E2E testing for the
  first time, or when the user asks about Gadget setup.
disable-model-invocation: true
metadata:
  author: pyratzlabs
  version: "1.0.0"
---

# Gadget Init

Scaffold a Gadget E2E testing project with config and example test.

## Workflow

### 1. Check Prerequisites

- Verify `npx` is available
- Check if `.gadgetrc.yaml` already exists (warn the user if so)
- Check if `ANTHROPIC_API_KEY` is set (needed for audit/check commands, not required for run)

### 2. Run Init

```bash
npx @pyratzlabs/gadget init
```

### 3. Post-Init Guidance

After scaffolding, tell the user:
- Review `.gadgetrc.yaml` and adjust `baseUrl`, viewport, and AI settings
- The example test is at `tests/example.test.yaml` — edit it for their app
- Run their first test with `/gadget-run`
- If they want AI-powered auditing, ensure `ANTHROPIC_API_KEY` is set

### 4. Offer Next Steps

Ask if the user wants to:
- Edit the generated config for their specific app
- Write a real test for one of their user flows
- Run the example test immediately
