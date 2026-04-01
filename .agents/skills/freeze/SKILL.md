---
name: freeze
description: >
  Locks file edits to a specific directory for this session. Use /freeze when
  debugging — allows adding logs in one area while preventing accidental
  changes elsewhere.
disable-model-invocation: true
metadata:
  author: portable
  version: "1.0.0"
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: |
            SKILL_DIR="$(dirname "$0")/.."
            CONFIG="$SKILL_DIR/config.json"
            if [ ! -f "$CONFIG" ]; then
              echo "ERROR: /freeze config not set. Run /freeze first to set the allowed directory."
              exit 1
            fi
            ALLOWED=$(python3 -c "import json; print(json.load(open('$CONFIG'))['allowed_dir'])")
            if [ -z "$ALLOWED" ]; then
              echo "ERROR: allowed_dir is empty in config.json. Please set it."
              exit 1
            fi
            FILE_PATH="$CLAUDE_TOOL_INPUT"
            if echo "$FILE_PATH" | grep -q "$ALLOWED"; then
              exit 0
            else
              echo "BLOCKED by /freeze: edits only allowed in $ALLOWED"
              echo "This file is outside the allowed directory."
              exit 1
            fi
---

# Freeze Mode

Edits are restricted to a specific directory for this session.

## Setup

Before using, I need to know which directory to allow edits in. I'll ask you
and save the answer to `config.json` in this skill's directory.

**Which directory should I allow edits in?**

Once configured, any Write/Edit outside that directory will be blocked.
This is useful when debugging: you want to add logs in one feature but not
accidentally "fix" unrelated code.

To unfreeze: end the session or start a new one.
