# Plan: PreToolUse:Read Gate, File-Reference Markers, Verify-Before-Assert

Codename: `watchful-reading-beacon`
Created: 2026-04-19
Drives: claude-craft wiki subsystem upgrades from the 2026-04 Karpathy research thread
Upstream research: `outputs/karpathy-wiki-research-report.md`, `wiki/sources/llm-wiki-v2-and-implementations-2026.md`
Intended home: move to `~/.claude/plans/` after review (matches existing convention)

---

## Context

The 2026-04 research pass validated that `claude-craft/wiki/` sits at or below the complexity floor of every mature public Karpathy-pattern implementation while matching or exceeding their capability surface — with three exceptions worth importing as patterns rather than whole projects:

1. **File Read Gate** (claude-mem / thedotmack) — PreToolUse:Read intercepts Read calls, injects a timeline of prior observations so Claude skips re-deriving from scratch. Today claude-craft has no PreToolUse:Read hook at all; the only PreToolUse coverage is `wiki-raw-guard.sh` on Write|Edit blocking writes into `raw/`.

2. **File-reference markers** — when a wiki page cites a source file (e.g., `wiki/entities/wiki-notify-hook.md` references `plugins/wiki-hooks/handlers/wiki-notify.sh`), today that edge only exists in prose. Claude has to notice a file name while reading the wiki page. There is no reverse index from file path → wiki pages that discuss it. The opportunity: build a cache so that when Claude Reads the file, the hook can inject "this file is documented at `entities/wiki-notify-hook.md` — consider `/wiki-load wiki-notify-hook`."

3. **Verify-before-assert** (redmizt "Beyond the Wiki") — a discipline scaffold that forces Claude to state "what would need to be true for this to be wrong" before committing to a plan or marking something done. Analogous to the existing `confidence:` field in wiki frontmatter, but at the level of a single response rather than a wiki page.

This plan sequences these three imports into shippable PRs and rolls up every outstanding recommendation from the research report into KEEP / SHIP-NOW / DEFER / DROP buckets so nothing falls through the cracks.

**Intended outcome:** ship three bounded features (one cache extension, one new PreToolUse:Read hook in file-ref-hint mode only, one `/verify` skill + risky-verb matcher) while explicitly deferring observation-timeline gating, vector search, and every other heavyweight extension from the community survey until a concrete pain justifies them.

---

## Ground truth (verified 2026-04-19 via Read)

| Component | Current state |
|---|---|
| `plugins/wiki-hooks/hooks/hooks.json` | Registers SessionStart (clear, detect, cleanup, cache-rebuild, worker), UserPromptSubmit (notify, worker, periodic-extract, periodic-lint), PostToolUse Write\|Edit (cache-rebuild), PreToolUse Write\|Edit (raw-guard), PreCompact, Stop, SessionEnd. **No PreToolUse:Read matcher.** |
| `handlers/wiki-raw-guard.sh` | Pure bash stdin grep. No jq. `exit 2` with stderr message on match against `"file_path": ".../raw/..."`. Blueprint for fast PreToolUse handlers. |
| `handlers/wiki-cache-rebuild.sh` | Async, debounced 30s. Builds `wiki/.cache/{display.txt, context.txt, entity-index.tsv, mtime}`. Uses `wiki-common.sh` for `wiki_parse_input`, `wiki_find_root`, `wiki_debounce`. Atomic write via `.tmp` + `mv`. |
| `handlers/wiki-notify.sh` | UserPromptSubmit. Already injects `<wiki_grounding_required>` XML-tagged directive on every prompt unless `WIKI_SKIP=1`. Entity-index matches prompt against cached entity names; directive-only injection (no content) to avoid context poison. |
| `handlers/wiki-common.sh` | Provides `wiki_parse_input`, `wiki_find_root`, `wiki_queue_entry`, `wiki_detect_changes`, `wiki_queue_changes`, `wiki_debounce`, `wiki_cleanup_orphans`, `wiki_log`, `wiki_check_deps`. All helpers idempotent. |
| `wiki/.cache/` | Contains `display.txt`, `context.txt`, `entity-index.tsv`, `mtime`, `last-rebuild`, `.lint-last-run`. Cache-first pattern already established. |
| `~/.claude/reflection-queue/` | Existing queue dir used by `wiki_queue_entry` for Stop-hook session synthesis. Processed by `wiki-worker.sh`. Correct home for any future observation queue. |
| `wiki/SCHEMA.md` | Schema v2 live: `name, type, description, tags, confidence, last_verified, created, last_updated, sources, related`. All optional at write time; lint advisory-only. |
| `wiki/` inventory (per last-v2 source page) | 76 entities, 91-line index. Well below Karpathy's 300-500 page FTS/vector threshold. |
| `~/.claude/plans/` naming convention | Adjective-verbing-noun codenames (e.g., `modular-twirling-planet.md`). Plans contain Context → Ground truth → Design decisions → PRs → Risks → Verification sections. |

---

## Design decisions

### D1. Merge "File Read Gate" and "file-reference marker" into one PreToolUse:Read handler — `wiki-read-gate.sh`

Both features sit on the same hook event (`PreToolUse` matcher `Read`) and share 90% of the fast-path code: parse hook input, extract `tool_input.file_path`, resolve relative to `REPO_ROOT`, fast-exit if the file is outside the repo or in an exclusion list. Splitting them into two hooks would double the per-Read latency (two `jq` invocations, two file-existence checks) for no architectural benefit. They live in one handler behind feature flags.

The handler runs in two modes:
- **Mode A — file-ref hint (ships in PR2):** look up the read path in `wiki/.cache/file-refs.tsv`; if hit, inject an `additionalContext` directive naming the wiki pages that reference this file. Always allow the Read.
- **Mode B — observation timeline (defers to PR6):** if an observation exists for this path AND mtime + size match the current file, inject the captured timeline as additional context. Still allow the Read (fail-open).

Mode B is behind an env flag (`WIKI_READ_GATE_OBS=1`) and disabled by default on initial ship. It becomes the default only after Mode A has been bedded in for at least 2 weeks without issues.

### D2. File-reference cache is built by extending `wiki-cache-rebuild.sh`, not a new handler

The cache rebuild hook already fires on SessionStart (async) and PostToolUse:Write|Edit when a wiki file changes. Adding a third artifact (`file-refs.tsv`) to that build slots in cleanly. Total added latency to the rebuild: a single scan of `wiki/entities/*.md` and `wiki/sources/*.md` with one grep per file. At 76 entities this is <100ms even on cold cache.

Cache shape:
```
# wiki/.cache/file-refs.tsv
# <repo-relative-path>\t<comma-separated-slugs>
plugins/wiki-hooks/handlers/wiki-notify.sh	wiki-notify-hook,wiki-context-injection
plugins/wiki-hooks/hooks/hooks.json	wiki-hooks-architecture
tools/sync-status.sh	sync-engine
```

Extraction regex (conservative — match what's grep-able in one pass, don't try to parse Markdown):
- Backtick-wrapped paths: `` `([a-zA-Z0-9][a-zA-Z0-9_/.-]+\.[a-z]+)` ``
- Exclude any extracted path that doesn't actually exist in `REPO_ROOT` (filters out pseudo-paths like `foo.bar` or prose-mentioned but unreal examples)
- Exclude any path starting with `wiki/` (wiki-internal cross-refs are handled by the `related:` frontmatter field, not by this cache)

Reverse index: many entities may reference the same file. Aggregate to one row per path with comma-joined slugs, sorted. The resulting file is grep-friendly: `grep -F "$FILE_PATH" file-refs.tsv` returns at most one line.

### D3. No source-file pollution — the marker is external, not inline

Rejected approach: write `<!-- wiki-ref: entities/foo.md -->` into source files. This:
- Pollutes the codebase with comments maintained by a separate system
- Conflicts with the `raw/` protection principle (the wiki should not touch code Claude didn't ask it to touch)
- Breaks on binary files, images, minified JS
- Creates a commit-noise problem every time the wiki cross-ref shifts

The external-cache approach matches the existing `entity-index.tsv` pattern: cache-first, invalidation on write, no source-of-truth duplication.

### D4. Verify-before-assert has two surfaces — a skill (explicit) and a narrow UserPromptSubmit matcher (ambient)

Rejected: adding a second always-fires XML directive to `wiki-notify.sh` alongside `<wiki_grounding_required>`. Two unconditional directives compete for Claude's attention. The WIKI_CHECK directive is deliberately the only one; it should stay the only one.

Shipped shape:
- **`/verify` skill** (PR3): explicit invocation. Claude runs it when Jim asks "verify X" or "is this right" or when Claude wants to self-audit before asserting something. Pure content — no hook, no passive cost. The skill body is a rubric: the claim being verified, the evidence consulted, the failure modes considered, the confidence level, and which wiki pages (if any) were grounded in.
- **UserPromptSubmit risky-verb matcher** (PR4): narrow addition to `wiki-notify.sh`. When the user's prompt contains high-stakes verbs — `ship`, `deploy`, `production`, `merge`, `commit to main`, `release`, `it's done`, `all good` — inject a small `<verify_before_assert>` directive asking Claude to state (a) what it verified end-to-end, and (b) one failure mode it checked for. Fires on roughly 1% of prompts (back-of-envelope from transcript survey). This is the passive safety net; the skill is the explicit tool.

The skill and matcher share one rubric file (`skills/verify/rubric.md`) so the directive can reference it by path rather than duplicating the prompt.

### D5. Every PR is fail-open or behind a flag; blast radius stays small

Composed from the existing handler conventions:
- `trap 'exit 0' ERR` at the top of every new handler
- Any `stat` / `jq` / `grep` failure → silent exit 0 (no gate, Claude reads normally)
- Cache file missing or unparseable → silent exit 0
- Mode B (observation timeline) ships OFF (`WIKI_READ_GATE_OBS=0`)
- `/verify` skill cannot fire unless Claude explicitly invokes it
- Risky-verb matcher can be disabled with `VERIFY_SKIP=1` in the same spirit as `WIKI_SKIP=1`

Every feature on this plan can be rolled back by deleting a single file or unsetting a single env var.

### D6. Plan targets PR-at-a-time shipping with explicit dependencies

The four PRs land independently in order PR1 → PR2 → PR3 → PR4, with PR5 (docs) and PR6 (Mode B observation timeline) landing after a soak period. Each PR is independently revertable and independently testable.

---

## Spike0 — Verify PreToolUse:Read hook output schema ✅ RESOLVED (2026-04-19)

**Outcome: docs-verified, mechanically validated. PR1 unblocked.**

Canonical shape (pinned):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "additionalContext": "<=10,000 char hint string — this is the LLM-facing channel>"
  }
}
```

Key findings (see `wiki/sources/pretooluse-read-schema-2026.md` for full report):
- `additionalContext` IS supported on PreToolUse (not just UserPromptSubmit / SessionStart). Docs show explicit exemplar.
- `permissionDecisionReason` is **user-facing only** — shown in the permission prompt, not injected into LLM context. Not useful for PR2. (Earlier draft of this plan incorrectly treated it as a candidate.)
- 10,000-char cap on injected context (quoted verbatim from the docs). PR2 hints are <200 chars; no concern.
- Emit via `exit 0 + JSON on stdout`. `exit 2` remains the deny-path used by `wiki-raw-guard.sh` — different code path, don't conflate.
- GitHub issue anthropics/claude-code#19115 is about `PostToolUse` schema ambiguity, not PreToolUse. Not blocking.

Artifacts:
- Docs-verified source page: `wiki/sources/pretooluse-read-schema-2026.md`
- Test hook + fixture for optional live confirm: `plans/spike0/{pretooluse-read-test.sh, spike0-fixture.txt, README.md}`
- Mechanical validation passed under simulated stdin (JSON valid, exit 0, negative path exits silently)

**Plan B (if live confirm later fails):** `exit 0 + systemMessage` (user-visible toast) plus a `wiki/.cache/last-read-hints.txt` side-effect file picked up by the next UserPromptSubmit hook. Uglier but always available. Probability of needing Plan B: low given docs are unambiguous.

---

## PRs

### PR1 — File-reference cache build in `wiki-cache-rebuild.sh`

**Scope:** add a new block to `wiki-cache-rebuild.sh` after the existing `entity-index.tsv` build, before the `display.txt` build. Extract file-path references from `wiki/entities/*.md` and `wiki/sources/*.md`, aggregate, write `wiki/.cache/file-refs.tsv` atomically.

**Extraction rules (explicit):**
1. Sources mined per wiki page: (a) backtick-wrapped paths in the body matching `` `[a-zA-Z0-9][a-zA-Z0-9_/.-]{2,}\.[a-z0-9]{1,6}` ``; (b) paths appearing in the YAML frontmatter `sources:` field when the value looks like a repo-relative path (contains `/`, ends with an extension, resolves under `REPO_ROOT`).
2. **Filter — must exist on disk:** every extracted path is tested with `[ -f "$REPO_ROOT/$PATH" ]`; non-existent paths are dropped. This removes prose examples, stale references to deleted files, and accidental string matches.
3. **Filter — exclude noise directories:** drop anything starting with `wiki/`, `.git/`, `node_modules/`, `raw/`, `.cache/`, or matching `*.lock`, `*.log`, `*.tmp`.
4. **Aggregate:** one row per path. Slugs joined by comma, sorted alphabetically, capped at 5 slugs per row with `...+N` suffix for overflow (prevents one hot file from producing a 2KB hint string).
5. **Stale-row cleanup:** the rebuild is a full rewrite, not an append. Deleted wiki pages or deleted source files naturally drop out.

**Cache shape (confirmed format):**
```
# wiki/.cache/file-refs.tsv
# <repo-relative-path>\t<slugs_comma_joined>
plugins/wiki-hooks/handlers/wiki-notify.sh	wiki-hooks-architecture,wiki-notify-injection
plugins/wiki-hooks/hooks/hooks.json	wiki-hooks-architecture
tools/sync-status.sh	sync-engine
```

**Touch:** one file (`handlers/wiki-cache-rebuild.sh`).
**New dependencies:** none (bash + grep already in use).
**Cost estimate:** 1–2 hours including manual verification.
**Verification (concrete):**
- `wc -l wiki/.cache/file-refs.tsv` is between 10 and (entity-count + source-count); upper bound anchored to avoid runaway extraction.
- `awk -F'\t' 'NF != 2' wiki/.cache/file-refs.tsv | wc -l` returns 0 (no malformed rows).
- `awk -F'\t' '{print $1}' wiki/.cache/file-refs.tsv | while read p; do [ -f "$REPO_ROOT/$p" ] || echo "MISSING: $p"; done` returns no lines (every path resolves).
- Touch any `wiki/entities/*.md` via `Edit`; wait 31s for debounce to clear; confirm `file-refs.tsv` mtime advances.
- Delete a file that's known to be referenced; rebuild; confirm the row is gone.

**Rollback:** delete the new block; cache regenerates on next trigger without the file. No downstream consumers until PR2.
**Blast radius:** zero — no consumers yet.

### PR2 — `wiki-read-gate.sh` in file-ref hint mode (Mode A)

**Scope:** new handler `plugins/wiki-hooks/handlers/wiki-read-gate.sh`; register in `hooks.json` under `PreToolUse` with matcher `"Read"`; timeout 2s; no `async` (context injection must land before the Read returns to Claude).

**Handler logic, in order:**
1. `trap 'exit 0' ERR` + `set +e` (fail-open on any error — see D5)
2. **Kill switch check:** `[ "${WIKI_READ_GATE:-1}" = "0" ] && exit 0` — env var lets Jim disable the hook without editing `hooks.json`
3. Source `wiki-common.sh`, `wiki_check_deps || exit 0`
4. `wiki_parse_input`; exit if `AGENT_ID` set or no `CWD`
5. Parse `tool_input.file_path` from `HOOK_INPUT` via jq; exit on parse failure
6. **Path normalization:** resolve `~` expansion and relative paths to absolute; bail if the result is outside `REPO_ROOT` (via `wiki_find_root`) — handles the cross-repo case where Claude Reads files from a different project
7. Compute `REL_PATH="${ABS_PATH#$REPO_ROOT/}"`; exit if result is absolute (means file is outside the repo)
8. **Noise filter:** exit if `REL_PATH` starts with `wiki/`, `.git/`, `node_modules/`, `raw/`, `.cache/`, or ends with `.lock`, `.log`, `.tmp`
9. Load cache: `[ -f "$CACHE_DIR/file-refs.tsv" ] || exit 0`
10. Lookup: `HIT=$(grep -F -- "$REL_PATH"$'\t' "$CACHE_DIR/file-refs.tsv" | head -1)`; exit 0 if empty
11. Parse slugs from the second tab-separated column
12. Compose hint string (≤200 chars); emit JSON per Spike0-confirmed schema
13. **Observability:** append one line to `wiki/log.md`: `[TIMESTAMP] READ_GATE session:${SESSION_SHORT} path:$REL_PATH slugs:$SLUGS dur:${DUR}ms`

**Removed from prior draft:** the 4KB size threshold. On reflection the hint's value is independent of file size (a small config file referenced by a wiki page benefits from the hint just as much as a large source file). Hook cost is ~5–10ms regardless of file size; no reason to gate on it.

**Touch:** new handler; one-line addition to `hooks.json` (new PreToolUse matcher `"Read"` block with this handler).
**New dependencies:** none.
**Cost estimate:** 3–5 hours (handler logic + edge cases + log integration + verification).

**Verification (concrete, scripted):**
- Benchmark script `tests/bench-read-gate.sh` that Reads a cached file 100 times in a tight loop and reports p50/p99 latency. **Target: p50 < 15ms, p99 < 40ms** (revised from <10/<30 — realistic given jq + file I/O).
- Correctness:
  - Read `plugins/wiki-hooks/handlers/wiki-notify.sh` in a fresh session → hint lands (verify via grep on transcript for sentinel string from Spike0).
  - Read `README.md` (not in cache, assuming) → no hint, no latency spike.
  - Read a file from a different repo (e.g., `/tmp/foo.txt`) → hook exits 0, no crash.
  - `WIKI_READ_GATE=0 claude ...` → no hints in session.
  - `echo "corrupt garbage" > wiki/.cache/file-refs.tsv` → subsequent Reads still succeed, hook logs error but exits 0.
  - `chmod -x wiki-read-gate.sh` → Reads still succeed; Claude Code logs hook error but tool proceeds.
- Observability: `grep READ_GATE wiki/log.md | tail -20` shows hook fires with durations.

**Rollback:** remove the PreToolUse:Read block from `hooks.json`, OR set `WIKI_READ_GATE=0` for live-session disable. Delete `wiki-read-gate.sh` for a clean remove. No persistent state.
**Blast radius:** Read tool latency per call; fail-open on any error; kill switch always available.
**Depends on:** Spike0 (hook output schema) + PR1 (cache).

### PR3 — `/verify` skill

**Scope:** new skill at `skills/verify/SKILL.md` with a rubric file `skills/verify/rubric.md`.

**Output format (explicit):** Claude embeds a single Markdown block at the end of its answer with six fixed sections. Each section is prefixed with a **compliance signature** — a literal short string that makes the rubric grep-able:

```
### Verify

**[VERIFY/claim]** One-sentence restatement of the claim being made.
**[VERIFY/evidence]** Files read: <list>. Commands run: <list>. Tests: <list>.
**[VERIFY/failures]** At least two ways this claim could still be wrong.
**[VERIFY/counter-check]** What would have to be true for this to fail; whether I looked for it.
**[VERIFY/confidence]** high | medium | low — calibrated to `wiki/SCHEMA.md`.
**[VERIFY/wiki]** Entities consulted: <list> OR "none applied — [reason]".
```

The signatures (`[VERIFY/claim]`, etc.) are the reason this is useful — a later `/wiki-lint` check or a grep over transcripts can detect whether Claude is actually producing the block vs. pattern-matching a loose paraphrase. If the six labels aren't present, the rubric wasn't followed.

**When Claude should invoke it:**
1. User explicitly invokes `/verify` — primary path.
2. User message contains a trigger phrase ("is this right", "double-check", "verify", "are you sure", "confident"). Claude may embed the rubric proactively.
3. Claude just produced a diff, committed to a plan, or declared something "done" / "shipped" — proactive self-audit. This is the case where PR4's UserPromptSubmit directive nudges Claude toward the skill.

**Explicit non-goals:** the skill is not a separate response, not a tool call, not a hook. It's a content template Claude embeds inline. Keeping it passive avoids turning every answer into a mini-ceremony.

**Touch:** two new files (`skills/verify/SKILL.md`, `skills/verify/rubric.md`).
**New dependencies:** none.
**Cost estimate:** 1 hour.

**Verification:**
- Manually prompt `/verify: is the hooks.json file registering 7 hook types?` — confirm the rubric renders with all six compliance signatures.
- Grep for `[VERIFY/claim]` on 3 sample outputs — all present means compliance is mechanically detectable.
- Invoke `/verify` twice in one session — confirm Claude produces the block both times (not only the first).
- Future: `wiki-lint` extension to flag risky-verb responses that lack the block (tracked as a follow-up, not blocking PR3).

**Rollback:** delete `skills/verify/`. No hook, no side effects.
**Blast radius:** zero (opt-in).

### PR4 — UserPromptSubmit risky-verb matcher in `wiki-notify.sh`

**Scope:** add a block to `wiki-notify.sh` after the existing WIKI_CHECK block, before the entity-match block. Match the user's prompt against a calibrated regex of high-stakes verbs; on match, append a `<verify_before_assert>` directive to `WIKI_CHECK_REMINDER`.

**Verb list calibration (required before ship):** the initial draft list was heuristic and will have high false-positive rate on Jim's prose ("ship" and "done" in particular). Before shipping, run:

```bash
# Calibration script — not part of the PR
grep -cE '\b(ship|shipped|shipping|deploy|deployed|deploying|production|prod|release|released|merge|merged|committed?|all good|lgtm|approved)\b' \
  $(find ~/.claude/projects -name '*.jsonl' -mtime -30 | head -20)
```

Count the fires; pull 50 random matches; classify as true-positive (Jim really is marking completion) vs. false-positive (casual use). Aim for ≥70% true-positive rate on the final list. If below 70%, tighten: `\b(shipped|shipping it|deployed to prod|merged to main|committed to main|pushing to main|ready to ship|ready to deploy|lgtm)\b` (phrase-based, not single-verb).

Ship with the calibrated list; document the calibration run in a comment header in `wiki-notify.sh`.

**Directive body (defensive — works with or without PR3 shipped):**
```
<verify_before_assert>
The prompt invokes a high-stakes verb. Before asserting completion, state:
(1) what you verified end-to-end (file paths, commands, tests run);
(2) one concrete failure mode you checked for;
(3) confidence level (high/medium/low).
If the /verify skill is available, embed the full [VERIFY/claim]..[VERIFY/wiki] block.
Escape: set VERIFY_SKIP=1 in the shell hosting Claude Code.
</verify_before_assert>
```

**Directive ordering:** `<wiki_grounding_required>` fires first (unconditional, always present), `<verify_before_assert>` second. Rationale: recency-of-position in context is an attention cue — the conditional directive that's actually relevant to THIS prompt should sit closer to the user's message. `WIKI_CHECK_REMINDER` variable already lands before the entity-match content, so this ordering is easy to preserve.

**Escape valve:** `[ "${VERIFY_SKIP:-}" = "1" ]` check before regex match.

**Touch:** `handlers/wiki-notify.sh` (single block add, ~25 lines).
**New dependencies:** none.
**Cost estimate:** 1–2 hours (including the calibration run).

**Verification:**
- Calibration report committed as header comment in `wiki-notify.sh` showing TP/FP rate on a 50-match sample.
- Send "shipped it" → directive appears in `additionalContext`.
- Send "what does this file do" → directive does NOT appear.
- `VERIFY_SKIP=1 claude ...` → matcher disabled even on verb hit.
- Send a prompt where both matcher and WIKI_CHECK fire → both directives present, wiki first.
- Send 20 prompts from recent transcript logs → manually count directive fires; compare to calibration prediction.

**Rollback:** remove the block from `wiki-notify.sh`, OR set `VERIFY_SKIP=1` for live disable.
**Blast radius:** estimated 1–5% of prompts pay a ~150-token injection. Re-estimated after calibration.
**Depends on:** PR3 recommended but not strictly required — the directive is defensively worded to give usable guidance even if `/verify` isn't installed.

### PR5 — Documentation update

**Scope:** update `wiki/SCHEMA.md` with a short section on the new cache file; add entries to `wiki/entities/` for:
- `wiki-read-gate` (the new hook)
- `file-reference-cache` (the new cache artifact)
- `verify-before-assert-pattern` (the research-backed discipline)
- Update the existing `wiki/entities/wiki-notify-injection.md` to reference the new risky-verb matcher block.

Note on naming collision: existing entities `verify-assertion-classification.md` and `verify-spec-coverage-invariant.md` are about **skill-VERIFY.md test-spec authoring** — a different domain from the response-level verify-before-assert discipline in this plan. Use `verify-before-assert-pattern` as the new slug to stay disambiguated. Cross-link via `related:` frontmatter, don't merge.

Add one source page: `wiki/sources/file-read-gate-2026.md` documenting the upstream claude-mem / thedotmack pattern and what this plan imported vs. deferred.

**Touch:** 4-6 wiki files.
**New dependencies:** none.
**Verification:** `/wiki-lint` passes on new pages; `/wiki-load wiki-read-gate` works in a fresh session.
**Rollback:** delete new pages (but don't — wiki grows monotonically).
**Blast radius:** zero; pure content.
**Depends on:** PR1, PR2, PR3, PR4 all landed.

### PR6 — (DEFERRED) Observation timeline mode (Mode B of wiki-read-gate.sh)

**Scope:** enable Mode B of `wiki-read-gate.sh`. Observation store at `~/.claude/read-observations/<path-hash>.json` with fields `{path, mtime, size, sha256?, timeline[]}`. Timeline entries captured by Stop hook via Agent-SDK extraction against the session transcript for each file that was Read in the session. On subsequent Read: if observation exists AND mtime matches AND size matches AND (optional) sha256 matches, inject the timeline as additional context in addition to the file-ref hint.

**Trigger to un-defer:** 4 weeks after PR2 ships with no regressions, OR Jim explicitly requests it.

**Depends on:** PR2 bedded in, plus Stop-hook extraction pipeline extension.

---

## Rollout, observability, and kill switches

Every feature on this plan has a kill switch and a diagnostic trail. This is non-negotiable for hooks that fire on every Read or every prompt.

**Kill switches (env vars, honored at runtime without edit/redeploy):**

| Feature | Env var | Effect |
|---|---|---|
| Wiki grounding mandate (existing) | `WIKI_SKIP=1` | Suppresses `<wiki_grounding_required>` injection |
| Read-gate hook (PR2) | `WIKI_READ_GATE=0` | Hook exits 0 immediately; no hint, no overhead |
| Read-gate observation mode (PR6) | `WIKI_READ_GATE_OBS=1` | OFF by default; turn on after soak |
| Risky-verb matcher (PR4) | `VERIFY_SKIP=1` | Suppresses `<verify_before_assert>` injection |

**Observability:**
- `wiki/log.md` already gets SessionStart / SESSION_END entries. Extend format to include `READ_GATE` per-fire lines (path + duration) in PR2, and `VERIFY_MATCH` per-fire lines (matched verb + prompt prefix) in PR4.
- After PR2 lands, a one-line diagnostic: `grep READ_GATE wiki/log.md | awk '{print $NF}' | sort -n | tail -5` shows slowest p99 latencies.
- After PR4 lands, `grep VERIFY_MATCH wiki/log.md | wc -l` / total prompt count gives the fire rate over a window.

**Soak criteria before promoting to default:**
- PR2 soak: 2 weeks of daily use, 0 Read failures attributable to the hook, p99 latency < 40ms, no unexpected behavior changes flagged by Jim.
- PR4 soak: 2 weeks of daily use, fire rate within 2× of calibration estimate, 0 false-negative escape-valve complaints.
- PR6 un-defer: separately, 4 weeks of clean PR2 soak.

**Rollback protocol if any feature misbehaves:**
1. Set the kill-switch env var in the parent shell (immediate, in-session).
2. Comment out the relevant block in `hooks.json` (next-session takes effect).
3. If truly broken, remove the handler file entirely and commit.

Every rollback step is a one-liner.

---

## Cost estimates (Jim-hours)

| Item | Estimate |
|---|---|
| Spike0 — verify hook output schema | 0.5–1 hour |
| PR1 — file-refs cache | 1–2 hours |
| PR2 — read-gate hook + verification | 3–5 hours |
| PR3 — `/verify` skill | 1 hour |
| PR4 — risky-verb matcher + calibration | 1–2 hours |
| PR5 — wiki documentation | 2–3 hours |
| PR6 — observation timeline mode (deferred) | 1–2 days (when un-deferred) |
| **Total through PR5** | **8.5–14 hours** |

PRs 1–5 can realistically land across 2–3 focused sessions. PR6 is a separate effort, intentionally gated on soak data from PR2.

---

## Research-report recommendation roll-up

Below is a complete disposition of every actionable recommendation surfaced by the 2026-04 Karpathy research thread and the frozen v2 source page. Nothing falls through the cracks.

### Already KEEP (shipped; verify coverage in PR5)

| ID | Item | Where it lives |
|---|---|---|
| K1 | YAML frontmatter (name/type/description/tags) | `wiki/SCHEMA.md` + every entity page |
| K2 | `confidence` field as discipline scaffold | `wiki/SCHEMA.md` |
| K3 | `sources` + `related` frontmatter graph edges | `wiki/SCHEMA.md` |
| K4 | Source-type dispatch in ingest | `skills/wiki-ingest` |
| K5 | `## Contradictions / Open Questions` section | `wiki/SCHEMA.md` formatting guidance |
| K6 | Lint: missing-frontmatter / stale-high-confidence / unresolved-contradictions | `/wiki-lint` |

### SHIP-NOW (this plan)

| ID | Item | PR |
|---|---|---|
| N1 | File-reference cache (`file-refs.tsv`) | PR1 |
| N2 | PreToolUse:Read gate — file-ref hint mode | PR2 |
| N3 | `/verify` skill | PR3 |
| N4 | UserPromptSubmit risky-verb matcher | PR4 |
| N5 | Documentation updates for N1–N4 | PR5 |

### DEFER (concrete un-defer triggers)

| ID | Item | Trigger to revisit |
|---|---|---|
| F1 | Vector embeddings / semantic search | wiki > 300 pages OR measurable retrieval misses in `/wiki-query` |
| F2 | SQLite FTS5 / PostgreSQL FTS | wiki > 150 pages OR grep+index latency > 500ms p95 |
| F3 | 4-tier consolidation memory (rohitg00) | N/A — reject even at scale; 2-tier project+global already partitions |
| F4 | `/wiki-synthesize` per-cluster overviews | index > 250 lines |
| F5 | Tiered/clustered index | index > 250 lines |
| F6 | BM25 + vector + graph hybrid (RRF) | wiki > 500 pages |
| F7 | Observation timeline mode (Mode B) | 4 weeks post-PR2 ship with clean soak |
| F8 | Typed links in frontmatter (Penfield Labs) | `/wiki-query` answers at least 3 times in a week wrongly conflate "A references B" with "A depends on B" or "A supersedes B"; OR a concrete consumer of typed edges lands (e.g., a `/wiki-impact <slug>` command that needs dependency semantics) |
| F9 | LLM-as-compiler framing (coleam00) | conceptual only — never implement as separate agents |
| F10 | Reflector/Curator split (ACE framework) | conceptual only — already approximated by Stop-hook queueing + `/wiki-ingest` |

**Meta re-survey trigger.** The entire DEFER table should be re-evaluated when any of the following happens: (a) `wiki/` crosses 250 pages (current 76 — re-assess F1/F2/F4/F5 at that point); (b) a v3 upstream LLM Wiki post lands from Karpathy or a widely-discussed successor pattern emerges (re-read and re-bucket); (c) Jim proposes a specific un-defer for any DEFERRED item with a named pain-driver (treat as a mini-RFC, not a one-line change). Without one of these three triggers, re-opening this table is premature.

### DROP (will not implement)

| ID | Item | Why |
|---|---|---|
| D1 | Ebbinghaus-style 90-day confidence decay | `last_verified` is human-updated; decay-by-timer is over-engineering |
| D2 | Bullet-level supersession markers `(SUPERSEDES abc123)` | Brittle NLP; `## Contradictions` section is the correct fix |
| D3 | `source_hashes:` tracking for cluster overviews | Consequence of dropping cluster overviews |
| D4 | Batched Sonnet migration with resume state | 68/76 pages already have frontmatter; bash heuristics cover it |
| D5 | Narrative sediment lint (>8 bullets) | Only 1 page exceeds; not a pattern |
| D6 | Inline `<!-- wiki-ref: ... -->` comments in source | Source-file pollution; external cache is the right answer (D3 of this plan) |
| D7 | Full-stack rebuild on Next.js + FastAPI + Postgres + PGroonga | 10× complexity for capabilities not yet needed (see complexity table in research thread) |
| D8 | Adopting rohitg00 LLM Wiki v2 wholesale | Same reason — cherry-pick K1–K6 conventions, reject the infrastructure stack |
| D9 | Adopting lucasastorian/llmwiki, sage-wiki, CRATE, etc. wholesale | None pass the adoption test (capability Claude can't build in <100 lines of bash + markdown AND retires a concrete current pain) |

---

## Risks and mitigations

**R1. PreToolUse:Read latency on hot files.** If Claude Reads the same file 30 times in a session, each Read pays the hook cost. Mitigation: the grep-over-TSV + early noise-filter exits target p50<15ms / p99<40ms (see PR2 benchmark requirement). Additional mitigation if it becomes a problem: short-lived per-session memo file (`/tmp/wiki-read-gate-seen-${SESSION_SHORT}`) recording paths already hinted this session, skip on repeat — but do not optimize pre-emptively.

**R2. File-refs cache staleness.** Cache rebuilds on PostToolUse:Write to wiki/ files (existing). But if someone edits a wiki page via an external editor (not Claude's Write/Edit), the cache stays stale until the next SessionStart. Mitigation: SessionStart rebuild already covers this. A wiki page edit that isn't reflected for one session is an acceptable window.

**R3. False-positive path matches.** `plugins/foo.sh` referenced in prose as "the plugins/foo.sh file" gets extracted even if the reference is actually a stale paragraph about an old version. The `grep -F` used in the gate is exact-match on file path so at least the noise is bounded by "files that exist." Accepting the false-positive rate as a cost of simplicity; the worst case is Claude loads a wiki page that turns out to be tangentially relevant.

**R4. Risky-verb matcher false positives.** Jim might say "ship" in a non-commit context (e.g., "the ship sailed on that design"). Mitigation: matcher regex is verb-shaped (`\bship(?:ped|ping|s)?\b`, etc.) rather than substring. Low but nonzero false-positive rate; `VERIFY_SKIP=1` is the escape valve.

**R5. `/verify` being ignored when invoked.** Skills can be invoked but Claude may give them cursory treatment. Mitigation: the rubric is structured enough that partial compliance is visible (missing numbered points). If underuse emerges, add a `wiki-lint` check that flags responses containing high-stakes verbs without the verify block.

**R6. Two directives competing for attention in UserPromptSubmit.** `<wiki_grounding_required>` + `<verify_before_assert>` both fire when the matcher triggers. Mitigation: the verify directive is <100 tokens and explicitly references `/verify` for the full rubric rather than inlining it. Directive order: wiki-grounding first (it's the unconditional one), verify-before-assert second.

**R7. JSON schema drift on PreToolUse hook output.** Claude Code hook output schema has moved between versions. **Mitigation: promoted to Spike0 — verified before PR1 lands.** The Spike0 report in `wiki/sources/pretooluse-read-schema-2026.md` pins the chosen shape with a working transcript. If the chosen shape later drifts, the kill-switch `WIKI_READ_GATE=0` disables the hook in one env var while the handler is updated. `exit 0` behavior (allow) is stable across all versions, so fail-open is always available.

**R8. Mode B observation timeline causing staleness bugs.** Deferring to PR6 is the primary mitigation. When/if PR6 ships, the mtime + size + sha256 triple-check plus fail-open-on-any-mismatch is the structural guard (see the read-after-write consistency analysis from this thread).

---

## Verification plan

After each PR lands:

**PR1 verification:**
- `cat wiki/.cache/file-refs.tsv` shows ≥ 5 rows (paths referenced by wiki)
- Edit any `wiki/entities/*.md`; wait 30s for debounce; confirm `file-refs.tsv` mtime updates
- `wc -l wiki/.cache/file-refs.tsv` bounded — should be less than number of unique files in `wiki/entities/` + `wiki/sources/`

**PR2 verification:**
- New session: `Read plugins/wiki-hooks/handlers/wiki-notify.sh` — confirm `additionalContext` hint appears in transcript
- New session: `Read README.md` (not in cache) — confirm NO injection, no latency spike
- Time 100 consecutive Reads of a cached file via `tests/bench-read-gate.sh`; p50 < 15ms, p99 < 40ms
- Intentionally corrupt `file-refs.tsv` (`echo garbage > ...`); confirm hook still exits 0, Reads still proceed
- Force hook error (`chmod -x wiki-read-gate.sh`); confirm Reads still proceed

**PR3 verification:**
- Manually invoke `/verify` on a trivial claim
- Confirm rubric renders with all six compliance signatures (`[VERIFY/claim]` through `[VERIFY/wiki]`)
- Confirm Claude's output embeds the rubric rather than replacing the normal response

**PR4 verification:**
- Prompt "ship it" — confirm `<verify_before_assert>` appears in `additionalContext`
- Prompt "what does this do" — confirm directive does NOT appear
- `VERIFY_SKIP=1 claude ...` — confirm matcher disabled
- Confirm `<wiki_grounding_required>` still fires when both would apply

**PR5 verification:**
- `/wiki-lint` passes with zero errors on new pages
- `/wiki-load wiki-read-gate` returns content in a fresh session

**Integration test (after all PRs):**
- Full session: open claude, ask a question that touches a wiki-referenced file, confirm both wiki-grounding and file-ref hints land in the right order, `/verify` is referenced in the answer if a risky verb was used, and WIKI_SKIP=1 / VERIFY_SKIP=1 each disable the correct subsystem independently.

---

## Out of scope for this plan

- Upgrading `/wiki-query` to use SQLite FTS5 — defer per F2
- Adding vector embeddings — defer per F1
- Typed-link frontmatter fields — defer per F8
- Observation timeline Mode B — defer per F7 / PR6
- Any changes to `wiki-worker.sh` or the reflection-queue pipeline
- Any changes to the `/wiki-ingest` flow
- Any changes to the `/clear` session-handling logic
- Any cross-repo wiki sharing (the global `~/.claude/wiki/topics/` tier is unaffected)

---

## Appendix A — why not just adopt one of the community repos

Summarized from the 2026-04 research thread's complexity/leanness comparison. Relevant because part of this plan's value is the explicit rejection of heavier alternatives.

| Candidate | Why not |
|---|---|
| `lucasastorian/llmwiki` (Next.js + FastAPI + Postgres + PGroonga + MCP) | 10× moving parts, stack doesn't match solo-operator ergonomics, nothing to retire at 76 pages |
| `rohitg00` LLM Wiki v2 (full infrastructure) | Vector DB + BM25 + decay cron + 4-tier consolidator is capacity without concrete pain |
| `Pratiyush/llm-wiki` (multi-LLM harvester) | Solves the "5 LLM surfaces unified" problem Jim doesn't have |
| `NicholasSpisak/second-brain` (Obsidian-native) | No session hooks; regression from current injection layer |
| `Astro-Han/karpathy-llm-wiki` (lightweight port) | Below current capability; no hooks |
| `sage-wiki` (Go + MCP server) | New daemon, new language, no retire-a-pain case |
| `CRATE` (Python CLI) | Python dependency; no session integration |
| `claude-mem` / `thedotmack` (File Read Gate) | Pattern imported (PR2/PR6), not project adopted |
| `coleam00/claude-memory-compiler` (LLM-as-compiler) | Conceptual only; no adoption |
| `redmizt` (verify-before-assert toolkit) | Pattern imported (PR3/PR4), not project adopted |

Adoption test, applied to every candidate: *does it add a capability I can't replicate in under ~100 lines of bash + markdown, and is that capability retiring a concrete pain I feel today?* Only the File Read Gate and verify-before-assert patterns pass a weakened version of this test, and only because they cost < 100 lines each and target named pains (token waste on re-reads, unverified assertions). Everything else fails.

---

## Appendix B — file inventory for implementation

New files:
- `plugins/wiki-hooks/handlers/wiki-read-gate.sh` (PR2)
- `skills/verify/SKILL.md` (PR3)
- `skills/verify/rubric.md` (PR3)
- `wiki/entities/wiki-read-gate.md` (PR5)
- `wiki/entities/file-reference-cache.md` (PR5)
- `wiki/entities/verify-before-assert-pattern.md` (PR5)
- `wiki/sources/file-read-gate-2026.md` (PR5)

Modified files:
- `plugins/wiki-hooks/handlers/wiki-cache-rebuild.sh` (PR1 — add file-refs build block)
- `plugins/wiki-hooks/hooks/hooks.json` (PR2 — register PreToolUse:Read)
- `plugins/wiki-hooks/handlers/wiki-notify.sh` (PR4 — add risky-verb matcher)
- `wiki/SCHEMA.md` (PR5 — document the new cache artifact)
- `wiki/entities/wiki-notify-injection.md` (PR5 — reference the new risky-verb matcher; verified to exist)

Verified at plan-write time (2026-04-19):
- `plugins/wiki-hooks/handlers/wiki-raw-guard.sh` — exists; pattern template for PR2 handler shape
- `plugins/wiki-hooks/handlers/wiki-cache-rebuild.sh` — exists; PR1 extends this
- `plugins/wiki-hooks/handlers/wiki-notify.sh` — exists; PR4 extends this
- `plugins/wiki-hooks/handlers/wiki-common.sh` — exists; all cited helpers (`wiki_parse_input`, `wiki_find_root`, `wiki_check_deps`, `wiki_debounce`) present
- `skills/wiki-ingest/SKILL.md` — exists; K4 (source-type dispatch) lives here
- `skills/wiki-load/SKILL.md`, `skills/wiki-query/SKILL.md`, `skills/wiki-lint/SKILL.md` — all exist
- `wiki/entities/verify-assertion-classification.md` and `verify-spec-coverage-invariant.md` — exist but cover skill-VERIFY.md test-spec authoring (different domain); use `verify-before-assert-pattern` slug to disambiguate
- `plans/watchful-reading-beacon.md` — this plan; written to `claude-craft/plans/` because `~/.claude/plans/` is outside the session's writable workspace; move after review

No deleted files. No schema migrations. No external dependencies added.
