---
description: "Deprecated — redirects to wiki-load and wiki-process (reflection absorbed into wiki system)"
argument-hint: "<topic> | --process-queue"
allowed-tools: Bash, Read, Glob, Grep
---

# /reflect — Redirect (Deprecated)

The reflection system has been absorbed into the wiki system.

**Routing:**
- `/reflect --process-queue` → Use `/wiki-process` instead
- `/reflect <topic>` → Use `/wiki-load --global <topic>` instead
- `/reflect` (no args) → Use `/wiki-process --status` instead

**If invoked with `--process-queue`**: Run `/wiki-process` (the Skill tool with skill="wiki-process").

**If invoked with a topic**: Run `/wiki-load` with the topic as argument and `--global` flag.

**If invoked with no args**: Run `/wiki-process --status`.
