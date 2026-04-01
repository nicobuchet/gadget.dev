---
name: verify-build
description: >
  Use after completing feature work, before committing, or when asked to verify
  the build. Runs typecheck and build, reports errors. Also available as
  /verify-build for manual invocation.
metadata:
  author: portable
  version: "1.0.0"
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: |
            if grep -q '"typecheck"' package.json 2>/dev/null; then
              pnpm typecheck 2>&1 | tail -20
            elif grep -q '"typecheck"' package.json 2>/dev/null; then
              npm run typecheck 2>&1 | tail -20
            else
              npx tsc --noEmit 2>&1 | tail -20
            fi
---

# Verify Build

Runs typecheck and build to verify code compiles. Activates on-demand hooks
that run typecheck after every Write/Edit for the rest of this session.

## Workflow

1. Detect the project's typecheck and build commands from `package.json`
2. Run typecheck first — faster, catches most issues
3. If typecheck passes, run build
4. Parse errors and summarize findings
5. Fix any errors found

## On-Demand Hooks

When this skill is invoked, it activates a PostToolUse hook that runs typecheck
after every Write/Edit for the remainder of the session. This replaces always-on
hooks — only enable when you want the safety net.

See `gotchas.md` for common build issues.
