<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 2 — Learn and deterministic bookkeeping (native)

Append a Log entry from Phase 1's report with `Committed: pending`, or the lightweight
empty-backlog entry defined in Phase 0 step 5. Set the header iteration counter to this
cycle's `N`. Update stop-condition counters using plain comparison and arithmetic, never
by asking an LLM to freehand-edit them. The empty-backlog path holds counters exactly as
specified and does not apply the PASS/partial reset row.

If STATUS was PASS, Outcome was `confirmed`, **and `CHANGED_PATHS` was non-empty** (real
code actually landed this cycle), also mark the Backlog item Phase 1 selected as done:
change its `- [ ]` line to
``- [x] <item text> — done <date> (commit: `git log --grep="improve-loop: iteration N —"`)``,
using this cycle's own `N`. Without this step, Phase 1's "select the next unchecked item"
rule could re-select and re-execute work already implemented and committed in a prior
cycle. Leave the item **unchecked** on FAIL, `disproven`, `blocked`, or `partial` — for
`partial`, progress landed but the item is not fully done, so it stays open for the
Phase 3 panel to refine (the panel may rewrite an unchecked item to reflect what remains)
or for a later cycle to finish; checking a `partial` item off as done risks a premature
`complete` that would end the whole loop before the work actually is.

Use this explicit matrix:

| Test STATUS | Outcome | `consecutive-no-progress` | `consecutive-same-error` |
|---|---|---|---|
| PASS | confirmed / partial, **`CHANGED_PATHS` non-empty** | reset → 0 | reset → 0, signature → none |
| PASS | **`CHANGED_PATHS` empty** (no code landed; reconciled to `partial`) | **+1** (a no-op is not progress) | reset → 0, signature → none |
| PASS | disproven (tests still green but thesis wrong) | +1 | reset → 0 |
| FAIL | any, signature **equals** prior entry's signature | +1 | +1 (keep signature) |
| FAIL | any, signature **differs** from prior (or prior was none) | +1 | reset → 1 with new signature |
| — | blocked (could not run meaningfully) | +1 | hold counter and signature exactly as they were — neither increment nor reset |

**Precedence (evaluate top to bottom; first match wins):**
1. Outcome `blocked` — key it on the **Outcome, not on whether tests ran**: use the blocked
   row whenever Outcome is `blocked` for *any* reason, regardless of STATUS. That covers both
   "tests never ran meaningfully" (missing command, broken environment, executor abort before
   a real suite result, a failed revert that left the tree dirty) *and* the case where tests
   ran green but the cycle is blocked anyway (a Phase-1 scope violation: STATUS PASS, Outcome
   `blocked`). Do not mint a signature from setup noise or from a green run; hold the prior
   signature string and `consecutive-same-error` exactly as they were, while increasing only
   `consecutive-no-progress`.
2. **STATUS PASS with empty `CHANGED_PATHS`** (reconciled to `partial` in Phase 1) — use the
   empty-`CHANGED_PATHS` row: `consecutive-no-progress` **+1** (a green no-op is not progress
   and must **not** reset the stall counter), `consecutive-same-error` reset → 0 / signature
   none. This row is why forcing Outcome to `partial` alone is not enough — without it, the
   generic PASS/partial row would wrongly reset the stall counter and hide a no-op streak.
3. Then the normal PASS/FAIL rows above.
4. Separately, the empty-backlog lightweight path (Phase 0 step 5) holds *both* counters and
   the signature and must not fall through into any PASS/partial reset.

Derive an error signature deterministically. Prefer the first failing test node id or
file+line greppable from `TEST_OUTPUT_TAIL`, using language-agnostic lines matching
`FAIL`, `ERROR`, `Error:`, `failed`, or `AssertionError`. Otherwise use the first 12 hex
characters of the SHA-256 of the last 20 non-empty tail lines. Store the exact string in
the Log's `**Error signature:**` field; the next cycle compares by string equality, not
fuzzy “same-ish” judgment.

#### Progress pulse (draft)

After the Log entry and counters are written, **build a draft** control-channel progress
pulse per `contracts/progress.md` (fields: cycle N, outcome, test, backlog done/total,
stall counters, CHANGED_PATHS, thesis/learnings, Committed still `pending`). Do not require
emit until Phase 4/5 finalize — but keep the draft in working memory for the rest of the
cycle. Optional: emit a draft pulse now if Phase 3 may take a long time (advisors).
