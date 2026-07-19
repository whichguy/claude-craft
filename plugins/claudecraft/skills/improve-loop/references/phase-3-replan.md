<!-- Host-specific agent names: prefer contracts/advisor.md; preserve behavioral rules below. -->
<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 3 — Advisor Panel and replan

Run this phase on every full cycle that reaches Phase 3, including empty-backlog
lightweight cycles. Ledger-flush turns skip Phases 1–3. The panel is multi-model when
advisors are configured: independent review, native consolidation, cross-exposure/rebuttal
when needed, final consolidation, then a surgical Backlog update. It prevents an unattended
loop from drifting silently.

**Portable defaults:** see `contracts/advisor.md`, `contracts/planning.md` (PLAN_APPLY,
structured 5-block schema, plan tiers), and the continuous driver's `throttle.md` (full
panel every **3rd** cycle or stall — do not override from planning.md). Default when no
advisors are available or throttle says so: **native-only replan** (still run Consolidation
rules and disproven-thesis guard). Full multi-model panel is optional and host-mapped.
**Apply (A continuous):** preserve already-`[x]` items verbatim — never open-only delete.

#### Advisor configuration and non-edit authority

Use a configurable advisor list. Host examples when installed: cross-model rescue/review
agents (e.g. Codex- and Grok-forwarding advisors on Claude Craft). Dispatch each via the
host's subagent/async mechanism so they run concurrently — do not hand-roll brittle
background polling unless the host requires it. Advisors return review text only. They have
repository access and are expected to see uncommitted diffs and the full `IMPROVE_LOOP.md`
Log (this cycle's Phase 2 entry included). The scope boundary is not filesystem privacy —
it is that (a) advisors never edit, and (b) consolidation keeps new Backlog items scoped to
the stated target (out-of-scope observations go in Last cycle Notes, not Backlog bullets).

**Read-only dispatch.** In every advisor prompt, ask for read-only behavior in plain
language: `This is a read-only advisory review. Do not make any edits or run any write
commands. Diagnose and recommend only.` That plain-language request is the primary control;
hosts may map it to a real `--read` flag when available. The post-panel tree check further
below is the backstop if an advisor writes anyway.

#### Budget and usability

Give each advisor round a soft wall-clock budget of ~**180 s** (a documented skill constant
may raise it). If an advisor has not returned usable text within the budget, or returns an
error, mark it **failed for that round** and proceed. Advisor flakiness must never stall the
cycle; continue with whichever advisors responded.

An advisor result is **usable** only when it is non-empty review text that addresses the
ask (not an error stack, not an empty string).

#### Round 1 — independent parallel review

Launch every configured advisor **in parallel** as a fresh dispatch (never continue a prior
cycle's advisor). Give each the target description; the path to `IMPROVE_LOOP.md`, which
already includes this cycle's Phase 2 entry and counters; the **prior-learnings digest**
built in Phase 0 step 7 (the last 15 iterations' Thesis/Outcome/evidence/Notes extracted
from git history, with any disproven theses highlighted), plus a pointer to general
non-improve-loop history (the `git log --oneline -20` retained for repo context); and this
cycle's Phase 1 report, or the lightweight empty-backlog Thesis/Outcome. Pass pointers and
paths rather than inlining all content; each advisor has repository access. Ask independently:

> Does the recent work—and the Backlog's overall direction—still serve the stated purpose?
> What do you recommend next? What risks or concerns exist? Review the learnings from prior
> iterations in the digest. Do not recommend re-attempting a thesis whose most-recent
> recorded outcome was disproven, unless you give a concrete reason the prior disproof does
> not hold (new evidence, changed conditions, or the prior disproof was flawed).
> When recommending new or revised P0/P1 work, preserve existing Decision/Preserve/
> Acceptance intent unless you cite new contradictory evidence. Classify each material
> recommendation as must-fix | decision | simplify | defer.

The **native-replanner fallback** (Consolidation 1, below) receives the same inputs as Round
1, so it gets the digest automatically; the disproven-thesis guard below applies to its
candidate identically.

Prefer a structured response with recommended next Backlog bullets, but accept free prose.
Tell every advisor explicitly: any already-`[x]`-checked Backlog item, including the one
just completed this cycle, must be preserved verbatim in a proposed Backlog — never
deleted or unchecked; only unchecked (`- [ ]`) items may be added, reprioritized, or
dropped. Record per advisor its returned text (or failure) **and its Agent id/name** — that
id is how Round 2 resumes that exact advisor.

#### Consolidation 1 — native

Do this synthesis in the orchestrating context, not another dispatch. Identify agreement,
disagreement, and the range of recommendations. If zero advisors produced usable Round-1
text, skip Round 2 and use the **native-replanner fallback** for this cycle only. Give that
single native replanner the same inputs Round 1 received and require a Backlog body only.
Append one line to the latest Last cycle Notes recording the full-panel failure. Do not allow
advisor infrastructure flakiness to stall the loop.

When usable Round-1 advisors show strong agreement—all recommend the same direction, have
no risk disagreement, make the same continue-versus-stop call, and have no material
conflict on next Backlog items—skip Round 2 and treat Consolidation 1 as final. This is a
cost-control early exit, not a change to the panel's purpose. When any risk-level or
direction disagreement exists, Round 2 is mandatory.

#### Round 2 — rebuttal

For every advisor with usable Round-1 text, **resume that exact advisor transcript** via
the host's resume mechanism (same agent id/thread — not a vague “latest session for cwd”
resume that can attach to the wrong run). If the host cannot resume, keep the Round-1
position and mark `no rebuttal (resume unavailable)`. When resume works, send each advisor
its own Round-1 position plus the Round-1 consolidation, all in parallel:

> Here's what you said, here's the consolidated view across all advisors—final pass,
> revise or stand by your recommendation.

Apply the same ~180 s budget. Do not resume advisors that failed Round 1. If a Round-2
resume fails or times out (e.g. the underlying tool hits a resume collision), keep that
advisor's Round-1 position, mark it in Consolidation 2 as `no rebuttal (resume failed)`,
and proceed. A Round-2 failure is not a full-panel failure and never triggers the
native-replanner fallback; only zero usable Round-1 text does.

#### Consolidation 2 and surgical apply

Synthesize rebuttal text plus Round-1-only/no-rebuttal positions in the main context. If
advisors still disagree, expose that disagreement in the Backlog rationale rather than
silently choosing a side. Lean conservative when the disagreement is about risk rather
than merely backlog priority.

The final product—Consolidation 2, Consolidation 1 on early exit, or native-replanner
fallback—must be a **Backlog body only**: markdown checklist lines (`- [ ]` or `- [x]`)
with short rationale phrases on the same lines (plus the required clause sub-bullets for
P0/P1 per `ledger-schema.md`). It must not be a free-form essay or a whole-file rewrite.

**Advisor recommendation taxonomy (classify each material suggestion before apply):**

| Class | Meaning | Backlog effect |
|---|---|---|
| `must-fix` | Violates an existing contract or broken suite | New/updated `[defect]` or residual thin item |
| `decision` | Multiple defensible behaviors; needs explicit choice | New/updated `[product-choice]` or `[architecture]` with Decision filled |
| `simplify` | Same behavior, less surface | Optional `[implementation]` or P2 — never silently drop Preserve |
| `defer` | Out of target scope or not worth a cycle | Last cycle Notes only; **not** a new P0/P1 unless operator elevates |

**Intent fidelity locks (normative):**

- **Retain** Decision / Preserve / Acceptance on still-open material items when evidence is
  unchanged. Amend those clauses **only** with new source/runtime evidence (or an explicit
  operator redirect).
- Write **new** unchecked P0/P1 with the same contract as Phase 0: material → six-clause;
  `[residual]` → thin Evidence + Acceptance only; P2/optional/YAGNI → one-line exempt.
- **Cannot** silently drop Decision, Preserve, or Acceptance from a material item that
  remains open. If evidence invalidates Decision, rewrite Decision (and Unknown if needed)
  with a Notes line — do not delete the clauses to “simplify.”
- Prefer branch-testing Unknowns before promoting them into scope-changing Decision text
  (guidance only — not structure-tested).

Apply it surgically and natively: replace only the `## Backlog` body through the next
`## ` heading in `IMPROVE_LOOP.md`. Never ask an advisor or fallback replanner to rewrite
the whole file; that can clobber deterministic counters and **## Last cycle** and stop counters.

**Disproven-thesis guard (native, before the surgical apply).** Before applying the
candidate Backlog, the orchestrator — the LLM context running this phase, not a subagent —
runs these native steps so the loop does not burn cycles re-trying approaches already shown
not to work:

- Build the **disproven-theses list** from the Phase 0 step 7 digest. Include a thesis
  **only if its most-recent recorded outcome was `disproven`**: scan the digest newest-first,
  and once an iteration addresses a thesis, ignore older outcomes for that same thesis. This
  stops a stale disproven record from blocking a thesis that a later iteration confirmed.
- For each proposed *unchecked* (`- [ ]`) item in the candidate, judge **semantically** —
  not by substring match — whether it re-asserts a thesis on the disproven-theses list, and
  whether its rationale states a concrete reason the prior disproof no longer holds. This is
  a judgment call; a naive substring check would miss paraphrases and must not be used.
- If the item re-asserts a disproven thesis **without** a stated reason: drop or rewrite the
  item and append one line to the latest Last cycle Notes:
  `replanner proposed re-attempt of disproven thesis (iter K): <short> — dropped/rewritten`.
- If the item re-asserts a disproven thesis **with** a stated reason: keep the item and
  **write that reason into the surviving Backlog line's rationale phrase**, e.g.
  `- [ ] <item> — re-opened: <one-line reason prior disproof may not hold>`, so the Phase 1
  selection backstop can detect it.
- This guard operates on **unchecked** items only, so it never conflicts with the rule that
  `[x]` items are preserved verbatim. If the guard drops *every* proposed item, the
  candidate is empty and the validation below fires
  `replan output unusable; Backlog unchanged`; append a clarifying Notes line
  `all proposed items re-asserted disproven theses; Backlog unchanged` so the cause is
  legible (the output was filtered, not unparseable).

Before replacing, validate the candidate contains at least one checklist line matching
`^- \[[ xX]\] ` (accept both `- [x]` and `- [X]`), **or** is an intentional empty-backlog
completion: a clearly stated
explicit `no remaining work` or zero-item complete call. Advisors and the native-replanner
fallback may add, reprioritize, or drop *unchecked* (`- [ ]`) items freely, but must never
delete or uncheck an already-`[x]`-checked item, including the one Phase 2 just checked
off this cycle — the Round-1 prompt above must say so explicitly. If the candidate drops
or unchecks a previously-checked item, restore that entry before applying the rest of the
candidate. Separately, if it is empty, unparseable, or would wipe a formerly non-empty
Backlog without explicit complete/stop rationale, do not apply it at all. Keep the prior
Backlog, append `replan output unusable; Backlog unchanged` to the latest Notes, and let
the terminal test below evaluate only counters and host/improve caps; do not invent
`complete` from a wiped list.

After the rounds and surgical apply or deliberate non-apply, re-check for code-dirtiness
using the **shared code-dirty definition** (Phase 0 step 4; excludes `IMPROVE_LOOP.md` and
this turn's `TEST_ARTIFACT_PATHS`). Advisors are read-only. If any code path is newly dirty
relative to the post-Phase-1/post-revert baseline and is not already accounted for in this
cycle's PASS `CHANGED_PATHS`, treat it as an infrastructure fault:
do not stage it and append `unexpected dirty paths after advisor panel: …` to Notes. On a
ledger-only turn, Phase 4's code-dirty veto will correctly refuse to commit; on a PASS
turn, leave unexpected paths unstaged so the next invocation's Phase 0 dirty-tree guard
stops. Never fold advisor-side dirt into the cycle commit.

**Surgical apply order (orchestrator, after strips/guards) — PLAN_SPEC_SYNC:**

1. `## Campaign brief` (if rewritten)  
2. `## Backlog` (post open-only / anti-reseed / P2 / disproven-thesis guards; fallback may keep prior)  
3. `## Deferred (P2)`  
4. `## Spec validation` — **re-read applied ledger from disk**; derive V-rows from plan
   statements (planning.md PLAN_SPEC_SYNC). Marker `<!-- spec-sync: iter N -->` on sync;
   Notes `spec sync n/a: plan unchanged since iter <N>` on skip (required). Never sync from
   pre-guard candidate. Step id `3-spec-sync` (control channel: `contracts/progress.md`).

Immediately after surgical apply (incl. Spec sync) or deliberate non-apply, and without a
subagent:

**Phase 3v — Spec validation gate (before Status complete rules).** Step id `3v-prove`.  
When open P0/P1 = 0 after replan and rules 1–2 below would not already stop, run
`phase-3v-validate.md` (product residual survey first if still pending). Failures seed
deduped `validate V<k>` P1 items so complete cannot fire; residual×2 remains sole complete
law. Prefer pure helper `scripts/spec-validate.js` (B) for parse/seed/dedupe when present.
Then use the counters Phase 2 already wrote to update Status *in this exact order*
(canonical table: `contracts/goal.md` — terminal status → same-error → no-progress → caps →
until). When Node is available, prefer `tools/improve-stop-decision.js` with a snapshot whose
`until_kind` the caller derived from the ledger header (`default` / `custom` / `none`); pass
`custom_until_met: false` here (only S8 / goal host may set true). Map helper
`decision: complete|stop` onto Status; `confirm` → leave `active` + Notes
`confirm: verification cycle required`; `continue` → leave `active`. Markdown rules below
remain the no-Node fallback:

1. `consecutive-same-error >= 3` → `stopped (same-error ×3)`
2. `consecutive-no-progress >= 3` → `stopped (no-progress ×3)`
3. **Until P0/P1×2 (disk) — default form only:** if header/Driver `until` is **non-empty and
   not `none`** and matches the default form
   `no material P0/P1 for 2 consecutive cycles (green tests)` (case-insensitive substring
   `P0/P1` + `2` consecutive, or the full default string) **and** zero unchecked **P0/P1**
   after replan **and** `consecutive-non-material-cycles >= 2`:
   - **this cycle's suite is green (current-cycle PASS)** → set Status `complete` (until
     satisfied). Stop reason `until: no-P0/P1×2`.
   - **no suite ran this cycle** (lightweight residual, carried PASS, cold resume) → leave
     Status **`active`** (Confirm path — **not** complete). Notes:
     `confirm: verification cycle required`. Next cycle Phase 1 **must** run the recorded
     suite despite empty backlog; re-evaluate. A consecutive confirm where the suite is
     *still* absent increments `consecutive-no-progress` (no-progress×3 bounds the loop).
     Do **not** complete on "the last non-material cycle was PASS" alone.
   - **this cycle's suite FAIL** → leave Status `active`; seed regression P0/P1 as needed
     (not complete).

   Do **not** invent until in chat; only honor disk. If `until` is `none`/absent (typical
   **once** mode), skip this rule. User-specified **custom** until strings are **not**
   auto-evaluated here — the outer host (improve S8 per caps.md, **or** host goal per
   `contracts/goal.md`) must judge them against disk after each cycle and may only complete
   when the criterion is met **and** a current-cycle suite PASS exists. improve-loop only
   auto-completes on this default until form under the conditions above.
4. Backlog has zero unchecked **P0/P1** items after replan (P2-only optional bullets may remain
   unchecked without blocking) → `complete`, **but gate it on a green
   suite** — a "tested improvement" loop must never sign off, or record a green result,
   without a green suite.

   **Suppress rule 4 when default until is active.** If header/Driver `until` matches the
   default P0/P1×2 form (same match as rule 3 above), **do not** set Status `complete` here —
   leave Status `active` even when the backlog is empty. Empty-backlog / last-item-checked
   cycles must keep running so Phase 2 can accumulate `consecutive-non-material-cycles`;
   only rule 3 (zero open P0/P1 + streak ≥ 2 + **current-cycle** green, or Confirm) completes
   under the default continuous criteria. Still run confirmation-suite sub-cases when useful
   for evidence, but a PASS must **not** flip Status to `complete` while default until is on
   disk and streak is below 2.

   **Also suppress rule 4 for custom non-`none` until.** Empty-backlog complete under a
   custom until is outer-host only — never auto-complete here just because the backlog is
   empty. Custom until is an authoritative product decision evaluated by S8/goal host.

   When rule 4 is **not** suppressed (`until` is `none`/absent only — typical once mode),
   three sub-cases, by what happened *this* cycle:
   - **(a) A normal PASS cycle that just checked off its last item** (the suite already ran
     and PASSED this cycle, with non-empty `CHANGED_PATHS`): that green run is the
     confirmation → set `complete`.
   - **(b) The empty-backlog / no-execute lightweight path** (suite not run this cycle): run
     the recorded test command once now as the confirmation — snapshot `pre_suite` immediately
     before it and **extend `TEST_ARTIFACT_PATHS`** immediately after (Phase 1's shared capture
     rule), *before* the Phase 4 veto, so the confirmation suite's own litter is not mistaken
     for abandoned dirt (this path has no clean-tree precondition, so a live `pre_suite`
     snapshot — not a hard-coded empty set — is what keeps any pre-existing dirt subject to the
     veto). PASS → `complete`. FAIL → do
     **not** complete: leave Status `active`; append one unchecked item (`- [ ] fix
     regression surfaced by completion check: <short error>`); **correct this cycle's
     not-yet-committed lightweight entry in place** (the Phase-3 completion-gate exception):
     rewrite `Test result` → `FAIL`, `Outcome` → `blocked`, `Error signature` → the real
     signature (Phase 2 derivation). The lightweight Phase 2 *held* the counters, so **apply
     the completion-gate counter rule now, once, here in Phase 3** (do not re-enter Phase 2's
     matrix): `consecutive-no-progress` **+1**; set `consecutive-same-error` by **FAIL-row
     semantics** — if the new signature **equals** the stop-counter signature as of Phase 2
     start (or this gate's prior stop-counter value) → +1, else → reset to 1 with the new
     signature. Do **not** use the blocked-row "hold signature `none`" here: holding `none`
     would never let repeated completion-gate failures trip a same-error stop.
   - **(c) A FAIL cycle whose revert succeeded and whose replan emptied the Backlog** (STATUS
     was FAIL this cycle, the tree is **not** code-dirty under the shared definition in
     Phase 0, and zero unchecked items remain after replan): run the recorded test command
     once now on the reverted baseline as the confirmation (same shared capture rule — snapshot
     `pre_suite` before, extend `TEST_ARTIFACT_PATHS` after). PASS → `complete`, and do **not**
     reset the counters — this cycle's FAIL already `+1`'d `consecutive-no-progress`, which is
     the honest record that no fix landed. FAIL → leave Status `active`, append the same
     failure Backlog item, add a Notes line with the confirmation tail, and do **not** apply
     case (b)'s counter package — this entry was already FAIL-scored in Phase 2, so re-scoring
     would double-count. **Precondition:** if the revert failed, Outcome is `blocked`, or the
     tree is code-dirty, do **not** complete here — leave it to Phase 4's code-dirty veto and
     Phase 0's next-invocation guard.
5. **Improve driver / host caps exhausted** (when continuous): if the continuous **host**
   ends the run (improve caps or goal budget), do **not** invent a new Status token here.
   Prefer leaving Status `active` for a mid-cap cycle, or `stopped (user)` only if the
   operator explicitly stopped — outer caps (`max_cycles`, budget) are enforced by the host
   (`goal.blocked` / improve S9); improve-loop does not own `cycle_index` increments (improve S8 does).
6. Otherwise leave Status `active`.

Advisors never edit counters, so a panel that wants to continue cannot override a counter
stop. The order matters: every FAIL increments no-progress, so three identical FAILs reach
both thresholds together; checking same-error first preserves the more specific reason.
Update Status before Phase 4 so the terminal note is in the same commit as the cycle.
