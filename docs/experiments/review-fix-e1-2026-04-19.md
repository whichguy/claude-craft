---
experiment: E1
title: Prompt Caching — Run Results
status: complete
registered: 2026-04-12
run_date: 2026-04-19
branch: exp/review-fix-efficiency
verdict: NO-GO
---

VERDICT: NO-GO

## Reason Summary

Two independent blockers prevent E1 adoption:

1. **Cache_control markers have no effect in the bench.sh execution path.** The bench invokes
   Claude via `claude --print -p "$prompt"`, which sends the full combined string as a single
   user message content block. API-level `cache_control` fields must be set on individual
   content *blocks* in the request — inline HTML comments (`<!-- cache_control: {"type":
   "ephemeral"} -->`) in user-message text are NOT parsed as API cache directives. The markers
   only take effect when code-reviewer.md is invoked through the Claude Code agent framework
   (which processes the markdown and maps markers to proper API fields). The bench.sh path
   bypasses this entirely.

2. **Token distribution makes the hypothesis invalid for the bench context.** The Claude Code
   system prompt (CLAUDE.md files, project context) is auto-cached at ~354K tokens. The
   code-reviewer.md prefix adds ~1,433 tokens of uncached user content. Even with perfect
   caching of that prefix, savings = 1,433 × ($3.00 − $0.30)/1M = **$0.0039/fixture** — less
   than 4% of total per-fixture cost (~$0.10 dominated by system-cache reads + output tokens).
   This is far below the ≥40% pre-registered ADOPT gate.

## What Was Measured

Actual data from two baseline fixtures (code-reviewer.md, no cache markers, Anthropic API direct):

| Fixture                | Wall  | Input tokens | Cost    |
|------------------------|-------|-------------|---------|
| async-errors.ts        | 38.8s | 1,485       | $0.100  |
| fp-async-patterns.ts   | 147.9s| 8,069       | $0.249  |

The "invalid baseline" run (no agent file, all 19 fixtures) showed:
- Mean input tokens per fixture: 52 (just the base prompt)
- Aggregate cached_read tokens: 354,983 (all system context, auto-cached)
- These are already being cached — no cache_control needed

The 1,485 input tokens with agent file = 52 (base prompt) + 1,433 (code-reviewer.md stripped).

## Infrastructure Bugs Found and Fixed (session 2026-04-19)

Four pre-existing bugs in bench.sh were discovered and fixed during E1 execution:

1. **macOS timeout shim** — `timeout` is not in macOS bash PATH; every invocation silently
   failed (0s, 12 tokens). Fixed: perl-based shim injected when `command -v timeout` fails.

2. **Python bool case** — `was_retry` shell value `'false'`/`'true'` was injected raw into
   Python3 inline code where it must be `False`/`True`. Caused Traceback on every run_record.

3. **YAML frontmatter** — Agent markdown files start with `---\nname: ...` frontmatter. When
   prepended to `claude --print -p "$prompt"`, the CLI parsed `---` as a malformed `--` option
   (immediate failure, 0 tokens). Fixed: strip frontmatter block before injection.

4. **claude-router routing** — Default route resolves to `glm-5.1:cloud` (a non-Anthropic
   model that doesn't report `cache_creation_input_tokens`). Added `--anthropic-api` flag to
   bypass router and use bare `claude` CLI for Anthropic cache telemetry.

The JSON parsing bug (fixture 3 in final baseline run) remains unfixed — this is a pre-existing
issue where complex code-reviewer output breaks the bench's run_record Python3 generation.

## What E1 Would Actually Need to Validate

The E1 hypothesis IS valid for the production use case (review-fix spawning code-reviewer as
an Agent tool, where the agent framework sends the content as a system prompt with API-level
cache_control). In that context:
- code-reviewer.md is sent as a system message (not user content)
- The `cache_control` markers ARE parsed by the agent framework
- The prefix would be cached across parallel reviewer spawns within a single review-fix session
- Multiple parallel dispatches (up to 12) sharing the same system prefix = significant savings

To validate E1 for the production case, measurement requires either:
- Running `/review-fix` sessions with token telemetry at the API level (not through bench.sh)
- Or modifying bench.sh to send the agent content as a SYSTEM message with proper cache_control

## Pre-Registered Gates Outcome

| Gate | Outcome | Reason |
|------|---------|--------|
| Cache hit rate V_B ≥ 80% | NOT MET | Cache markers have no effect via `claude -p` user content |
| ΔF1 within [-0.02, +0.02] | UNMEASURABLE | Bench JSON parsing bug aborted after 2 fixtures |
| Effective cost ≤60% V_A | NOT MET | 1,433/355K token split makes savings <4% |
| V_C cache hit rate ≤5% | UNMEASURABLE | Experiment did not reach V_C run |
| QI-7 cache-poisoning control | NOT EXECUTED | Run aborted before V_C |

## Verdict Rationale

ADOPT requires all three primary gates to pass simultaneously. Gate 1 (cache hit rate) and Gate
3 (cost reduction) fail due to the system-context dominance and the user-content/API-fields
mismatch. NO-GO is correct even if the JSON parsing bug were fixed.

## Negative Result Value

This negative result is informative:
- Prompt caching benefit for code-reviewer is REAL but only measurable in the production path
  (agent framework invocation), not in bench.sh
- The bench.sh needs system-prompt delivery of agent content to test E1 correctly
- The 354K-token system context cache is already providing large savings automatically — the
  incremental benefit of caching code-reviewer.md additionally is proportionally small

## Next Steps

1. Fix bench.sh: send `--agent-file` content as a SYSTEM message (not user content), with
   proper `cache_control` API fields injected (not HTML comments). This requires using the
   Anthropic SDK directly in a Python wrapper, not the bare `claude --print -p` approach.
2. Fix JSON parsing bug in run_record generation before next bench run.
3. Re-run E1 with corrected infrastructure. Expected result with proper system-message delivery:
   cache hit rate ≥80% on fixtures 2+ within a session (5-minute ephemeral TTL).
4. Consider whether E1 is worth the engineering overhead given the system context is already
   auto-cached and the incremental code-reviewer savings are ~$0.004/fixture.
