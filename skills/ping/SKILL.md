---
name: ping
description: |
  Smoke-test skill for claude-router end-to-end verification.
  Responds with a structured status line confirming the model and route.
allowed-tools: Bash
---

# /ping — Route Smoke Test

Run this command and output ONLY the result on a single line:

```bash
echo "model=$(claude --version 2>/dev/null || echo unknown)"
```

Then respond with exactly this format (fill in the blanks):

```
PONG route=background model=<model-name-or-unknown> status=ok
```

No other text.
