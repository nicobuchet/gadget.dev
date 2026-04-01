# Gadget - AI-powered E2E testing CLI

## Quick Reference

- **Package manager:** pnpm (not npm/yarn)
- **Build:** `pnpm build` (tsc)
- **Test:** `pnpm test` (vitest)
- **Dev:** `pnpm dev` (tsc --watch)

## Conventions

- Source lives in `src/`, compiled output in `dist/` (never edit dist)
- Use zod for runtime validation of external inputs
- CLI uses commander — subcommands go in `src/cli/`

## Non-obvious Rules

- Playwright is a dependency, not a devDependency — it ships with the CLI
- Test files parsed by the tool use a custom YAML-based format (see `src/parser/`)
- The Anthropic SDK is used at runtime for AI-driven test analysis — API key must be set as `ANTHROPIC_API_KEY`
