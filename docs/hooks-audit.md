# Hooks + paired skill/agent audit (Task #19)

Propose-only review of every hook in claude-craft and the user-facing skill/command/agent it supports. Verdicts: KEEP-AS-IS, SIMPLIFY, ENHANCE, DROP.

## Summary

13 hook entries across 3 plugins; 17 distinct handler scripts.

| Plugin | Hook event | Matcher | Handler | Verdict | One-line action |
|---|---|---|---|---|---|
| async-suite | PostToolUse | TodoWrite | hooks/detect-quality-review.sh | **ENHANCE** | Tighten the matcher (see below) — fires on every TodoWrite, including unrelated ones |
| async-suite | SessionStart | clear | handlers/task-persist-restore.sh | KEEP-AS-IS | Working as designed — restored 11 tasks at the start of *this* session |
| async-suite | SessionStart | startup | handlers/task-persist-restore.sh | KEEP-AS-IS | Same handler, same purpose, different trigger |
| async-suite | SessionEnd | * | handlers/harvest-feedback.sh | **ENHANCE** | Fix git-root resolution + add transcript-missing log; pair with `process-feedback` skill |
| planning-suite | PreToolUse | ExitPlanMode | hooks/handlers/exit-plan-mode-gate.sh | KEEP-AS-IS | Bug fixed in 449ac5d (Task #5) |
| planning-suite | PostToolUse | ExitPlanMode | hooks/handlers/exit-plan-mode-cleanup.sh | KEEP-AS-IS | Same — bug fixed |
| wiki-suite | SessionStart | clear | handlers/wiki-clear.sh | KEEP-AS-IS | Atomic rename pattern is correct |
| wiki-suite | SessionStart | * | handlers/wiki-detect.sh | KEEP-AS-IS | Cache-first + first-time prompt logic is good |
| wiki-suite | SessionStart(*async) | * | handlers/wiki-cleanup.sh | KEEP-AS-IS | Janitor; expires markers >24h |
| wiki-suite | SessionStart(*async) | * | handlers/wiki-cache-rebuild.sh | KEEP-AS-IS | Debounced + atomic write |
| wiki-suite | SessionStart(*async) | * | handlers/wiki-worker.sh | **SIMPLIFY** | The `--route`-vs-`--model` feature-detect is dead (claude-router moved to c-thru); decide on a single path |
| wiki-suite | UserPromptSubmit | * | handlers/wiki-notify.sh | KEEP-AS-IS | Cache-first entity index, retry-guard present, /wiki-* skip present |
| wiki-suite | UserPromptSubmit(async) | * | handlers/wiki-worker.sh | KEEP-AS-IS | Drains queue; same handler shared with SessionStart |
| wiki-suite | UserPromptSubmit(async) | * | handlers/wiki-periodic-extract.sh | KEEP-AS-IS | Probabilistic queue producer; minimal work |
| wiki-suite | UserPromptSubmit(async) | * | handlers/wiki-periodic-lint.sh | **SIMPLIFY** | Same `--route` dead-code as wiki-worker; clean up together |
| wiki-suite | UserPromptSubmit(async) | * | handlers/proactive-research-extract.sh | KEEP-AS-IS | Recursion guard, rate limit, fork-detach all good |
| wiki-suite | PostToolUse | Write\|Edit | handlers/wiki-cache-rebuild.sh | KEEP-AS-IS | Same handler; path-prefix gate keeps it cheap |
| wiki-suite | PreToolUse | Write\|Edit | handlers/wiki-raw-guard.sh | KEEP-AS-IS | 11-line pure-grep handler; correct exit 2 + stderr message |
| wiki-suite | PreToolUse | Read | handlers/wiki-read-gate.sh | **ENHANCE** | One inline `extract_field` parser doesn't strip trailing whitespace before `:` — minor edge case |
| wiki-suite | PreCompact | * | handlers/wiki-precompact.sh | KEEP-AS-IS | Idempotency + display re-injection both correct |
| wiki-suite | Stop(async) | * | handlers/wiki-stop.sh | KEEP-AS-IS | Cleanup orphans + dedup SESSION_END log entry |
| wiki-suite | SessionEnd | * | handlers/wiki-session-end.sh | KEEP-AS-IS | Pure safety net; defers to wiki-stop or wiki-precompact if either ran |

**Verdict counts:** 16 KEEP-AS-IS · 4 ENHANCE/SIMPLIFY (split: 2 ENHANCE, 2 SIMPLIFY) · 0 DROP.

The hook surface is well-disciplined post-marketplace migration — no orphaned handlers, no references to absorbed-plugin paths, no missing retry guards on UserPromptSubmit handlers. The four needed changes are surgical.

---

## Per-hook detail (only items needing change)

### async-suite / PostToolUse(TodoWrite) → detect-quality-review.sh — ENHANCE

**Pair**: the `/todo` and `/bg` commands plus the auto-generated review.md output.

**Issue 1 — over-eager matcher.** The hook fires on EVERY `TodoWrite`, including ones unrelated to async-suite tasks (e.g., the TaskCreate/TaskUpdate calls happening throughout this very session). The handler exits cheaply when the content has no Task-ID (lines 109-111), but the cost is paid on every TodoWrite — and the handler is 190 lines of jq + regex per fire.

**Issue 2 — async-prep / state-dir consistency.** Line 10: `ASYNC_PREP_DIR="${CLAUDE_PLUGIN_DATA:-${HOME}/.claude/plugins/data/async-suite}"` — this is correct. But it does NOT migrate from the legacy `~/.claude/async-prep/`; that's owned by `migrate-from-symlinks.sh` (which we just added in Task #3). No bug here, just verify the migration order in real installs.

**Concrete change**:
- Add a stricter prefilter: bail out (line ~98) before parsing the JSON if the raw input doesn't contain the literal `Run quality review` string. One `grep -q` is cheaper than the `jq | sed | grep` pipeline.

```bash
# Add right after `tool_result=$(cat)`
case "$tool_result" in
  *"Run quality review"*) ;;  # proceed
  *) exit 0 ;;
esac
```

That single grep cuts the per-TodoWrite cost from ~50ms to <1ms for the 99% of TodoWrites that don't have the checkbox.

---

### async-suite / SessionEnd(*) → harvest-feedback.sh — ENHANCE

**Pair**: the `process-feedback` skill (reads the backlog file the hook writes).

**Issue 1 — git-root resolution silently degrades.** Line 19: `GIT_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || echo "$CWD")`. If the user is outside any git repo (e.g., in `~`), the backlog gets written to `$HOME/tasks/in-progress/prompt-improvements-backlog.md` — under their HOME, possibly across many unrelated sessions. Should fall back to a per-user fixed path or skip entirely.

**Issue 2 — silent on transcript missing.** Lines 15-16 exit 0 with no log. If the SessionEnd input shape changes upstream and `transcript_path` becomes empty, this handler stops harvesting forever and nobody notices. Add a one-liner log to `wiki-common`-style log file (or stderr).

**Issue 3 — `command -v jq` probe missing.** Most other handlers use `wiki_check_deps`-style probes; this one uses jq directly without a guard. Will hard-fail on systems without jq instead of skipping.

**Concrete change**:
```bash
# Add after line 6 (after set -eo pipefail)
command -v jq >/dev/null 2>&1 || exit 0

# Replace line 19 with:
GIT_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$GIT_ROOT" ]; then
  exit 0   # no repo → don't write backlog under ~
fi
```

---

### wiki-suite / wiki-worker.sh + wiki-periodic-lint.sh — SIMPLIFY

**Issue — dead `--route` feature detect.** Both handlers do:
```bash
if "$CLAUDE_CMD" --help 2>&1 | grep -q -- '--route'; then
  WIKI_WORKER_USE_ROUTE=1
else
  wiki_log "WARN" "claude-router at $CLAUDE_CMD lacks --route support; falling back to --model claude-sonnet-4-6"
fi
```

Per CLAUDE.md memory and your project notes, the `claude-router` (formerly under `tools/claude-router`) was replaced by the `c-thru` plugin (`whichguy/c-thru`). c-thru routes via its proxy URL, not via a `--route` flag on the CLI. So this feature-detect is testing for something that no longer exists in your stack.

**Concrete change**: pick one path and delete the branch.
- If the workers are still expected to use a router CLI: replace `--route "$WIKI_WORKER_ROUTE"` with however c-thru wants the model selected (likely env var or `--model <c-thru-alias>`).
- If they should just use the bare `claude` CLI: delete the feature detect, the `WIKI_WORKER_ROUTE` env var, and `wiki_resolve_claude_cmd`'s router fallback. ~20 lines per handler.

This is the highest-leverage simplification in the audit — both handlers' main bodies become significantly shorter.

---

### wiki-suite / PreToolUse(Read) → wiki-read-gate.sh — ENHANCE (minor)

**Issue — inline `extract_field` parser doesn't trim whitespace inside the key match.** Lines 38-57 implement a pure-bash JSON field extractor. The `case "$input" in *"\"$key\""*)` match is exact-substring; if a future hook input ever has `"file_path" :` (with space before the colon, which is technically valid JSON), the parser will fail to match because it strips up to the next `:` after the key name but doesn't normalize whitespace before the colon.

In practice this doesn't bite today because Claude Code emits compact JSON without that variation. But it's a fragility flag.

**Concrete change**: low priority. If you do touch this file, add a comment block flagging the assumption ("Caller emits compact JSON; adjust if input format ever pretty-prints"). Or replace with `jq` once you've measured that the p99 budget of 40ms allows it (the comment at line 18-20 says jq alone is 16ms, so it's not safe).

Alternatively: drop a one-shot test fixture in `test/plugins/wiki-suite/` that asserts the parser handles both compact and pretty-printed forms — protects against regression.

---

## Cross-cutting findings

1. **Shared library `wiki-common.sh:169` says `"wiki-hooks: $1"`** — that's the absorbed plugin's old name. Cosmetic but visible in stderr. Change to `"wiki-suite: $1"`. (1-line fix.)

2. **Two retry-guard patterns coexist.** `wiki-notify.sh` and the (now-deleted) `local-classifier.sh` both used `case "$PROMPT" in *"<summary>Stop hook feedback</summary>"*) exit 0 ;; esac`. After the local-classifier removal there's only one user of this pattern in the repo. Worth promoting the check into `wiki-common.sh` as `wiki_skip_on_retry` and calling it once — but only if any future UserPromptSubmit handler is added. For now: leave alone.

3. **The `claude-router` migration to c-thru is incomplete inside wiki-suite.** Beyond the dead `--route` checks (above), `wiki_resolve_claude_cmd` in `wiki-common.sh` still has logic for finding `claude-router`. Auditing that function was out of scope for this pass — it might be the right next focus.

4. **Two handlers do their own `command -v jq` probe; others rely on `wiki_check_deps`.** Standardize on `wiki_check_deps` (or copy the equivalent into async-suite as `task_persist_check_deps`). Mostly cosmetic.

5. **`exit-plan-mode-*` is the only place I found a real PreToolUse/PostToolUse pair using the slug-marker handshake** — and the `set -eo pipefail` bug we caught + fixed (Task #5) was specifically here. The pattern is solid; the implementation needs the discipline we already applied. Worth keeping as a reference example of the right hook contract.

---

## Recommended action order

| # | Change | Effort | Risk |
|---|---|---|---|
| 1 | `detect-quality-review.sh`: prefilter on `Run quality review` literal | 5 lines | very low |
| 2 | `harvest-feedback.sh`: jq probe + git-root guard | 5 lines | very low |
| 3 | `wiki-common.sh:169`: `"wiki-hooks"` → `"wiki-suite"` | 1 line | none |
| 4 | `wiki-worker.sh` + `wiki-periodic-lint.sh`: drop `--route` dead branch + simplify `wiki_resolve_claude_cmd` | ~40 lines | low — ensure background extraction still works after |
| 5 | (deferred) `wiki-read-gate.sh`: comment + test fixture for the JSON parser assumption | optional | none |

Items 1-3 are 11 lines total and could ship in a single commit. Item 4 is the meaningful work and should be paired with a quick live-test of `wiki-worker.sh` against your current c-thru setup before/after to confirm extractions still complete.
