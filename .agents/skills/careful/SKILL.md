---
name: careful
description: >
  Blocks destructive commands (rm -rf, force-push, DROP TABLE, reset --hard)
  for the rest of this session. Use /careful when working near production
  config, deployment scripts, or sensitive data.
disable-model-invocation: true
metadata:
  author: portable
  version: "1.0.0"
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: |
            INPUT=$(echo "$CLAUDE_TOOL_INPUT" | tr '[:upper:]' '[:lower:]')
            if echo "$INPUT" | grep -qE 'rm -rf|--force-push|force-push|--hard|drop table|drop database|truncate |delete from|kubectl delete|git clean -f'; then
              echo "BLOCKED by /careful: destructive command detected."
              echo "Disable /careful (start new session) to run this command."
              exit 1
            fi
---

# Careful Mode

Destructive commands are now blocked for this session.

**Blocked patterns:**
- `rm -rf` — recursive force delete
- `git push --force` / `force-push` — overwrites remote history
- `git reset --hard` — discards uncommitted changes
- `git clean -f` — deletes untracked files
- `DROP TABLE` / `DROP DATABASE` — destructive SQL
- `TRUNCATE` / `DELETE FROM` — data-destroying SQL
- `kubectl delete` — destroys Kubernetes resources

To proceed with a blocked command, end the session and start a new one
without `/careful`.
