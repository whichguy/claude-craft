---
name: sync-status
description: |
  Show registration status of all claude-craft extensions and register/update any that
  are missing. Wraps tools/sync-status.sh for status, sync, add, and publish operations.

  AUTOMATICALLY INVOKE when:
  - "what's registered", "registration status", "sync status", "what is registered"
  - "which agents are installed", "which skills are installed", "which commands are installed"
  - "are my agents registered", "is X registered", "check registration"
  - "sync extensions", "register missing", "install missing", "sync agents", "sync skills"
  - "what extensions do I have", "what's in ~/.claude", "what's active"
  - User wants to know what claude-craft extensions are installed or missing

  NOT for: Updating extension content/best-practices (use /craft-update), creating new
  extensions (edit the repo directly), git operations on the repo (use Bash directly)
argument-hint: "[status|sync|add|publish] [--repo PATH]"
allowed-tools: Bash, Read, Glob
---

# /sync-status — Claude Craft Extension Registration

Show what's registered in `~/.claude/` and register any missing extensions from the
claude-craft repo.

## Step 0 — Parse Arguments

Parse `$ARGUMENTS` (empty = default to `status`):

```
action    = first non-flag token: status | sync | add | publish
            empty or unrecognized → "status"
repo_flag = "--repo <path>" if --repo present, else ""
```

## Step 1 — Locate Sync Script

Discover `REPO_ROOT` and `SYNC_SCRIPT`:

```bash
REPO_ROOT="$HOME/claude-craft"
for p in "$HOME/claude-craft" "$HOME/repos/claude-craft"; do
  [ -f "$p/tools/sync-status.sh" ] && REPO_ROOT="$p" && break
done
SYNC_SCRIPT="$REPO_ROOT/tools/sync-status.sh"
```

If `SYNC_SCRIPT` does not exist, stop and tell the user:
> sync-status.sh not found. Run `~/claude-craft/install.sh` to set up claude-craft, or
> use `--repo /path/to/claude-craft` if it's installed elsewhere.

## Step 2 — Execute Action

### status (default)
Show full registration status across all 6 extension types:
```bash
"$SYNC_SCRIPT" status ${repo_flag}
```

### sync
Pull latest then create/refresh all symlinks:
```bash
git -C "$REPO_ROOT" pull --ff-only origin main 2>/dev/null || true
"$SYNC_SCRIPT" sync ${repo_flag}
```

### add
Show repo extensions not yet linked into `~/.claude/`:
```bash
"$SYNC_SCRIPT" add ${repo_flag}
```

### publish
Show `~/.claude/` items not backed by the repo (local-only):
```bash
"$SYNC_SCRIPT" publish ${repo_flag}
```

## Step 3 — Present Results

After running the script, present the output. Add context based on action:

**status**: Summarize — how many registered vs available vs local-only per type.
If any extensions are unregistered (shown with `✗` or `?`), highlight them and offer to sync:
> X extensions in the repo are not registered. Run `/sync-status sync` to install them.

**sync**: Confirm what was linked. Remind the user:
> Changes take effect immediately (symlinks). No Claude Code restart needed for most
> extensions; agents/skills may need a restart if not auto-detected.

**add**: List the unregistered items by type. Offer:
> Run `/sync-status sync` to register all of them at once.

**publish**: Explain these are local `~/.claude/` items not tracked in the repo. They
won't be affected by sync. To add them to the repo, copy the files into the appropriate
`~/claude-craft/<type>/` directory and commit.

## Step 4 — Footer (status and add only)

When showing status or add results, append available actions:

```
Available actions:
  /sync-status sync      — Register all missing extensions
  /sync-status add       — List only unregistered repo extensions
  /sync-status publish   — List local-only extensions (not in repo)
  /craft-update          — Audit and fix extension best practices
```
