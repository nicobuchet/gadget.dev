# Contributing to Gadget

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/nicobuchet/gadget.dev.git
cd gadget.dev
pnpm install
npx playwright install chromium
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm build` to verify the project compiles
4. Run `pnpm test` to ensure tests pass
5. Open a pull request

## Project Structure

- `src/cli/` — CLI commands (commander)
- `src/parser/` — YAML test file parser
- `src/` — Core logic (runner, reporter, AI analysis)
- `tests/` — Test suite (vitest)
- `skills/` — Claude Code skills

## Guidelines

- Use **pnpm** (not npm or yarn)
- Use **zod** for runtime validation of external inputs
- Keep PRs focused — one feature or fix per PR
- Add tests for new functionality

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, etc.)
