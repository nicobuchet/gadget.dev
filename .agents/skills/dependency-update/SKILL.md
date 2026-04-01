---
name: dependency-update
description: >
  Safely update project dependencies — audit vulnerabilities, check outdated
  packages, and upgrade one at a time with build verification. Use
  /dependency-update to start an upgrade cycle.
disable-model-invocation: true
metadata:
  author: portable
  version: "1.0.0"
---

# Dependency Update

Safe, systematic dependency upgrades.

## Workflow

### 1. Audit

```bash
pnpm audit          # or npm audit / yarn audit
pnpm outdated       # list outdated packages
```

### 2. Categorize

- **Patch** (1.0.0 → 1.0.1): Safe, update all at once
- **Minor** (1.0.0 → 1.1.0): Usually safe, update in batches
- **Major** (1.0.0 → 2.0.0): Breaking, update one at a time

### 3. Update Patches & Minors

```bash
pnpm update          # updates within semver range
pnpm typecheck       # verify
pnpm build           # verify
```

### 4. Update Majors (One at a Time)

For each major update:
1. Check the changelog for breaking changes
2. Update the package: `pnpm add <package>@latest`
3. Update `@types/<package>` if applicable
4. Run typecheck — fix any type errors
5. Run build — fix any build errors
6. Commit before moving to next major

### 5. Verify Lock File

```bash
git diff pnpm-lock.yaml  # should show changes
```

Lock file must be committed with the update.

## Gotchas

- `@types/react` must match `react` version
- Some packages are coupled (e.g., `@tanstack/react-query` + `@tanstack/react-query-devtools`)
- Peer dependency warnings after update may indicate version conflicts
- Never update all majors at once — if something breaks, you won't know which one
