# Wiki Context-Noise Audit — Consolidated Proposal

**Status:** Audit complete. CLAUDE.md ship done. Remaining items ranked & descoped against empirical cache data.
**Date:** 2026-04-19
**Related:** `plans/watchful-reading-beacon.md` (parent PR plan)

---

## TL;DR

Anthropic's prompt cache absorbs ~95% of the wiki-notify mandate cost when it hits. But the user runs across multiple providers and doesn't want to rely on a single vendor's caching layer for efficiency. The audit now optimizes for **provider-agnostic efficiency**: fewer tokens in, fewer tokens out, fewer downstream tool calls, regardless of whether caching helps.

**Scope note:** wiki-hooks only fire under Claude Code — on Gemini/OpenAI/local runs, the hook cost is already $0. But the hygiene principles (CLAUDE.md size, system-prompt content, response verbosity, tool-call discipline) transfer across providers.

---

## Empirical finding (probe against 304-turn transcript)

| Signal | Observed | Interpretation |
|---|---|---|
| `input_tokens` per turn | 1–6, flat across 304 turns | Uncached increment does NOT grow by mandate size — mandate is cached |
| `cache_read_input_tokens` growth | ~229 tok/turn | Matches mandate (~216 tok) — it's flowing through cache |
| `cache_creation_input_tokens` | One-time ~52K, then ~5K bumps | Stable prefix established at session start; per-turn additions small |

**Cost per 20-turn session:**
- Cached (observed): ~215 creation + (215 × 19 × 0.1) ≈ **630 tok**
- Uncached (counterfactual): 215 × 20 ≈ **4,300 tok**
- **Caching saves ~85%.**

This reframes every audit finding. Anything that is (a) stable content and (b) injected into the user turn is effectively free after the first turn. The targets worth attacking are anything that *varies* per turn or anything whose downstream cost (tool calls, page loads) isn't bounded by caching.

---

## Shipped

| Change | File | Savings |
|---|---|---|
| Remove `## Wiki` block from CLAUDE.md | `CLAUDE.md` | 160 tok/session for non-wiki repos; cleaner architecture for wiki repos |
| Expand wiki-detect.sh SessionStart injection to carry the directive | `plugins/wiki-hooks/handlers/wiki-detect.sh` | +45 tok, but only when wiki exists |

Net per session: −160 tok non-wiki, −114 tok wiki repos. Tests pass.

---

## Revised priority matrix (provider-agnostic stance)

Cost columns: "Anthropic cached" = warm-cache Anthropic session, "Uncached" = any fresh session or non-Anthropic provider where hooks still fire.

| ID | Item | Anthropic cached | Uncached | Decision |
|---|---|---|---|---|
| N1 | Collapse wiki-notify mandate to SessionStart one-shot | ~500 tok/session | **~4,300 tok/20-turn session** | **Keep** — worth it for uncached case |
| N2 | Bound the `NEW_NAMES` entity list in wiki-notify | Moderate (content varies → breaks cache anyway) | Moderate | Keep |
| N3 | Read-gate session memo (skip repeat hints) | Low (caching covers it) | Low (PR2 already emits only on hit) | Descope |
| N4 | Drop SessionStart additionalContext overlap with CLAUDE.md | Done | Done | **Closed** |
| N5 | Skip mandate on `/wiki-*` commands | Always-on waste (about *usefulness*, not bytes) | Same | Keep |
| A1 | Amplifier: mandate triggers needless `/wiki-load` | **Highest remaining cost** — page loads are 1–5 KB each, uncached on all providers | Same | Keep |
| P1 | Trim CLAUDE.md system-prompt content | Minimal (system cached) | Small but universal | Done (wiki block removed); revisit other sections if needed |
| P2 | Response verbosity / output token discipline | Not cached on any provider — full rate every response | Same | **New — see below** |

---

## Recommended ship order

### 1. N1 — collapse wiki-notify mandate to SessionStart + delta-only per-prompt (1 hr)

**Problem:** `wiki-notify.sh` re-injects the full ~216-token `<wiki_grounding_required>` block on every UserPromptSubmit. Cached on Anthropic, fully paid elsewhere.

**Change:** Move the evergreen directive into wiki-detect.sh's SessionStart injection (already expanded in the CLAUDE.md ship). Per-prompt handler emits only the delta: new entity names, pending queue entries, changed pages. If no delta → silent exit.

**Implementation:**
- Strip the `<wiki_grounding_required>` block from `wiki-notify.sh`
- Add a guard that only emits when `NEW_NAMES`, `QUEUE_COUNT`, or `CHANGED_FILES` is non-empty
- Session marker (`wiki/.session-${SID}-notified`) prevents reintroducing the mandate mid-session

**Cost impact:** 
- Anthropic cached: −500 tok/session
- Uncached: −4,000 tok/20-turn session
- Applies to every wiki repo, every session

### 2. N5 — skip wiki-notify entirely on `/wiki-*` prompts (30 min)

**Problem:** Handler fires on every UserPromptSubmit, including `/wiki-load x`, `/wiki-query x`, `/wiki-lint`, etc. — the user has already engaged the wiki system.

**Change:** Add early-exit when the user prompt starts with `/wiki-` (already has `/wiki-` prefix exemption for some paths — audit + expand).

**Cost impact:** 0 tokens when fires skipped. Marginal bytes, but removes confusing double-signal.

### 3. A1 — amplifier guard on `/wiki-load` triggers (45 min)

**Problem:** Mandate framing nudges the LLM to call `/wiki-load <topic>` defensively even when the topic is clearly not project-domain. Each needless load = 1–5 KB fresh content at full input rate on every provider. Uncached always.

**Change (ship both):**
- **(a)** Soften mandate from "REQUIRED" → "consider" and add explicit negative criteria ("skip if: prompt is about general coding patterns, math, conversation meta, or prior tool output")
- **(b)** Add lightweight logging of `/wiki-load` invocations with triggering prompt → review weekly → tune

**Cost impact:** Variable. A single needless 3 KB page load ≈ 12× the mandate. Expected reduction: 30–50% of false-positive loads.

### 4. N2 — bound `NEW_NAMES` list (optional, 20 min)

**Problem:** `wiki-notify.sh` injects a list of new entity slugs since last session. Unbounded — if there are 50 new entities, 50 slugs ship. Turn-varying → breaks cache → paid at full rate.

**Change:** Cap at 10 entries, add `... +N more` overflow marker (same pattern as file-refs.tsv in PR1).

**Cost impact:** Small. Only matters in repos with very active wiki authoring sessions. Ship if convenient, skip if not.

### 4. Close audit, return to PR3

PR3 (`/verify` skill, from `watchful-reading-beacon.md`) is higher-leverage for the original problem (hallucinated file references) than further squeezing the mandate.

---

## Provider-portable efficiency (new scope)

These apply whether you're on Anthropic, Gemini, OpenAI, or local. None rely on vendor caching.

### P2 — response verbosity discipline

**Observation:** Output tokens are NOT cached on any provider. A 500-token response costs full rate every time, on every provider. Typical Claude Code / Cowork responses skew long because the agent narrates its reasoning, restates the question, and adds postamble.

**Levers:**
- Add a project-level response-style guide to CLAUDE.md: "Default to direct answers. Skip preamble. Tables only when ≥3 items. No restating the question."
- Tight system prompts for scripted flows (batch analysis, triage)
- Audit the 10 longest response types — are any structurally bloated?

**Expected impact:** 20–40% output token reduction on routine interactions. On a 50-interaction day averaging 800 output tokens each, that's 8–16K tokens/day saved, uncached everywhere.

### P3 — tool-call discipline

**Observation:** Every tool call is a round-trip. Tool results get billed as input on the NEXT assistant turn. Needless tool calls multiply cost on both axes.

**Levers:**
- Prefer `Read` with a byte range over `Read` of whole file (we already do this pattern; enforce in skills)
- Use `Grep` with `files_with_matches` before `content` mode when scanning
- Prefer `ToolSearch` batch-load over sequential `select:` calls for deferred tools
- For long outputs, redirect to file rather than re-reading

**Expected impact:** Hard to quantify. Highest ROI is in long agent-loop tasks where 20+ tool calls accumulate.

### P4 — plugin / skill footprint

**Observation:** Every loaded skill adds its description to the skill-router context. Every active plugin adds hook files, command definitions, and potentially slash commands to the session.

**Levers:**
- Disable unused plugins per repo (`.claude/plugins.json` manifest)
- Skills listed but rarely used: cost is the description block (~50-100 chars each, cached on Anthropic, paid fresh elsewhere)
- Quarterly audit: which skills/plugins fire in real sessions? Disable the rest.

**Expected impact:** Modest on Anthropic (cached), larger on providers without caching. Primary value is cognitive clarity — fewer false-positive skill activations.

### P5 — CLAUDE.md discipline (ongoing)

**Current CLAUDE.md:** ~900 chars / ~225 tokens.
**Remaining content:** Directives (codeblock of SYNC/TYPES/SYMLINKS/etc.), Dev Guide, Install.

Most of this is genuinely useful. Candidates for further trim:
- Install section (user already knows how to install; belongs in README, not system prompt)
- Dev Guide → could move to a `docs/` file referenced on-demand

Not urgent. Total remaining savings if fully trimmed: ~150 tokens/session on cold cache, negligible on warm cache.

---

## What we're NOT doing (and why)

- **N3 (Read-gate session memo):** Already handled at creation (grep -F exact match, 5-slug cap). Low marginal value.
- **PR4 (risky-verb matcher + calibration) from parent plan:** Keep on backlog. The mandate cost concern motivated it; N1 addresses the cost more directly.
- **Full rewrite to single master kill-switch (`WIKI_QUIET=1`):** Deferred. Revisit if we add more kill-switches.
- **Response-style enforcement via automated linting:** Not yet. Start with the CLAUDE.md directive and measure.

---

## Monitoring / escape hatches

No new env vars introduced by this audit. Existing surface:
- `WIKI_SKIP=1` — suppress all wiki-notify injection for the current prompt
- `WIKI_READ_GATE=0` — disable PR2 Read-gate hint

If caching behavior changes (e.g. Anthropic shifts cache boundary), re-run the probe in `plans/wiki-context-audit.md` § "Empirical finding" — same methodology, look for input_tokens stepping up per turn.

---

## Verification

- [x] Shipped CLAUDE.md + wiki-detect.sh change, 5/5 wiki-detect tests pass
- [x] Empirical cache probe against 304-turn transcript confirms mandate caches on Anthropic
- [ ] **N1** patch + test (collapse mandate → SessionStart only, delta-only per-prompt)
- [ ] **N5** patch + test (skip on `/wiki-*`)
- [x] **A1** patch (soften mandate framing + add false-positive logging — wiki-detect.sh "consult when"/skip-criteria framing; wiki-notify.sh "possible/if relevant" match block + `wiki_log "AMPLIFIER_MATCH" …` per fire; 3 new tests, 50/50 wiki-hooks pass)
- [x] **N2** patch (bound NEW_NAMES list — MAX_NEW=10 + `…+N more` overflow marker, 9/9 wiki-notify tests pass)
- [x] **G1** post-review test: AMPLIFIER_MATCH NOT logged on silent exit (regression guard against moving wiki_log outside the match-count conditional)
- [x] **G2** post-review test: exactly MAX_NEW=10 → no overflow marker (off-by-one guard on `NEW_COUNT > MAX_NEW`)
- [ ] **P2** CLAUDE.md directive: response-style guidance
- [ ] Full `npm test` clean before closing audit
