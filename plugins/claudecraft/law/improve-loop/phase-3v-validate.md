<!-- PLAN_VALIDATE gate — runs between Phase 3 surgical apply and Status rules 3/4 -->

# Phase 3v — Spec validation gate

**When:** After Phase 3 surgical Backlog/Deferred apply, **before** Status complete/active
ordering (rules 3/4 in phase-3-replan). Own step — does **not** renumber Phases 4/5.

**Does not replace residual×2.** Failures block complete only by **seeding open P0/P1**.

Full planning spine: `contracts/planning.md` (PLAN_VALIDATE, **PLAN_SPEC_SYNC**, R1–R8,
quarantine). **Sync ownership is Phase 3** (after applied Backlog); this file is **prove**
only (`3v-prove`). Control-channel prove card: `contracts/progress.md` (PLAN_SPEC_STATUS).
Pure helpers (B): `scripts/spec-validate.js` when present — parse / seed / dedupe.

---

## Trigger (all must hold)

1. No counter-stop this cycle (same-error ×3 / no-progress ×3 already decided).
2. Open P0/P1 count **= 0** after replan.
3. **Product residual survey** (if `SEED_MODE` product/mixed and still **pending**) runs
   **before** this gate; if survey opens material, **skip 3v** this cycle.
4. Then:
   - Section missing / all rows `n/a` → **vacuous pass** (set header `n/a`; today’s
     complete path). Exception: tier **T2/design-change required** and section missing →
     seed once `- [ ] P1: [defect] write Spec validation section (required at tier T2)`
     (U6 fallback; Phase 0 MUST-write is primary).
   - Else run the gate over non-`n/a` rows.

Operator phrases (“spec validation review”, “intention→artifact”, “did we meet the spec?”)
invoke the **same** procedure in **report mode** (card; seed only if operator asks).

---

## Executable vs manual rows

| Kind | At 3v |
|---|---|
| suite, L3-test, prose-sweep, dual-home, skill-law (with rg/path) | **Executable** — must pass for header `pass` |
| **habitat** | **Executable** when Proof non-empty — must pass for header `pass`; **never** treat host suite green as habitat Feature pass |
| manual | **Never** blocks unattended complete; leave Status `pending`; pulse/body `unverified (manual): k` |

Re-run **all executable** rows every gate firing (U-new-4). Prefer **narrow** Proof commands
(single file / rg / habitat smoke) so 3v does not approximate a second full suite. Soft-check
bundle (PLAN_SPEC_SOFT) after sync is **warnings only** — disposition Notes; never auto-seed.

---

## Proof execution (orchestrator-native)

1. For each **executable** row (Status `pending`, `fail`, **or** `pass` — re-run all every firing; suite-kind may reuse this cycle’s suite STATUS only — never a second full suite run):
   - Run Proof cell as shell from WORKSPACE (or absolute path in cell).
   - **suite kind:** reuse this cycle’s suite STATUS if already run; else one Confirm-class
     run — **never two full suite runs in one cycle** (U9).
   - Capture side effects into `TEST_ARTIFACT_PATHS` (Phase 1 shared rule) so proof litter
     does not trip code-dirty veto.
2. Success semantics from Proof cell: `exit 0`, `match`, or `no match` as stated.
3. Write row **Status** `pass` | `fail` (orchestrator only — never executor/advisors).
4. Update header `**Spec validation:** pass` only if every executable row is `pass`;
   else `pending`.
5. Emit **Spec prove** control-channel card (`contracts/progress.md`): non-pass rows only
   in the evidence table; compact `pass: V…` line for passes; **Loop effect** never
   “done”/“complete”. On fail/seed use pulse phrasing verbatim:  
   `Validation fail → seeded V… → continuing cycle K+1` (R8d).

---

## Fail → seed coding work

On any executable **fail**:

1. Build seed title:  
   `- [ ] P1: [defect] validate V<k>: <intention short> (<artifact>)`
2. **Dedupe:** if Backlog already has an open title matching the colon-terminated token
   `validate V<k>:` (not bare `validate V1` — that would false-match `validate V10`), do **not**
   seed again.
3. Clauses (material six-clause or thin residual per package norms):  
   - Evidence: proof output tail / exit code  
   - Acceptance: `V<k> Status pass` (and un-quarantine if product Acceptance required it)
4. Append seed under Backlog (**package** A continuous dialect: open line; **package** B open-only: greppable form — dialect follows target ledger, not skill home).
5. Error signature for later same-error: `validate:V<k>:<short-sig>` (first 12 hex of tail
   or short token).

**Never** uncheck A `[x]` or resurrect B-deleted blocks.  
Executing a `validate V<k>` item may fix **product or proof** (U-new-6 / R6).  
On **re-seed** of the same `V<k>`, Notes should record last choice:
`fix target: product | proof` (helps same-error review and proof-chasing detection).

After seeding, open P0/P1 > 0 → Status rules **cannot** set `complete` this cycle.

### Auto-iterate (R8) — closed campaign loop

**3v fail is never a terminal Status and never an L1 exit reason.**

In **autonomous** mode, after Phase 4 lands a cycle that 3v-seeded work, L1 **must
immediately** start the next L2 cycle (do not ask the user, do not end the turn as done).
That next L2 may be a **Validate-fix cycle** (lint intensity): ordinary Phases 0–5 with
Phase 1 executing the seeded item — **not** an in-gate fix/re-prove loop and not a second
campaign. Replan intensity for that cycle: native 5-block surgical / T1; package A defers
periodic full-panel cadence per `skills/improve/references/throttle.md` (definition:
`contracts/planning.md` § Validate-fix cycle). Fall through to ordinary replan if new
material appears.

Continue until:

- header `**Spec validation:** pass` (or vacuous `n/a`) **and** residual×2 complete, **or**
- hard stop: same-error ×3 (`validate:V<k>:…`), no-progress ×3, max-cycles, blocked.

**`--once`:** seed + Status `active` + exit; operator re-invokes (R8c).

Pulse / discovery after 3v fail: `Validation fail → seeded V… → continuing cycle K+1`
(R8d) — never campaign report “done.”

---

## Pass path

All executable rows `pass` → header `pass` → fall through to residual×2 / complete rules
unchanged. Manual rows may remain `pending`.

---

## Commit body (Phase 4)

When the gate **fired** this cycle, fold into existing **Test evidence** (not a new required
enumerated field):

```text
Validation: N pass / M fail (V3, V7) / K n/a [unverified manual: k]
```

---

## Caps

- ≤15 V-rows soft cap (planning.md).
- Same-error ×3 on `validate:V<k>:…` stops the campaign honestly.
- No new stop-counter schema.

---

## Progress pulse

When section exists: emit the **canonical** Validation line per `contracts/progress.md` (order: pass / fail / pending / n/a · sync=…).
