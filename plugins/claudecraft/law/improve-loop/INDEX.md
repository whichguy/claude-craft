# improve-loop law index (home A)

Normative law corpus. Runtime agents load the **B monolith** (`skills/improve-loop/SKILL.md`);
this tree is for law editors and structure tests. Operator card: `operator-card.md`.

**Cold start (law edit):** read `phase-0-resume.md` then `ledger-schema.md`; contracts are
pulled in by the phase that cites them.

| File | Contents |
|---|---|
| `ledger-schema.md` | `IMPROVE_LOOP.md` plan-file format (Last cycle + Next, not diary Log), **Until/Max cycles**, **Driver**, non-material streak, blocked tokens |
| `phase-0-resume.md` | **Rehydration** (until/mode from disk), dirty/landed guards, digests |
| `phase-1-execute.md` | Executor + orchestrator **lint** (improve-lint.sh) + test/revert |
| `phase-2-learn.md` | Last cycle replace, counter matrix + **non-material streak** |
| `phase-3-replan.md` | Advisors/native replan, **3v pointer**, Status stops (until P0/P1×2, stalls) |
| `phase-3v-validate.md` | **Spec validation gate** (completion path; fail→seed `validate V<k>`) |
| `phase-4-commit.md` | Staging, vetoes, commit body (+ Validation line when 3v fired) |
| `phase-5-decision.md` | Pulse, host `goal.complete`/`blocked`, **auto worktree teardown**, resume template |
| `contracts/goal.md` | Continuous host: goal iterates improve-loop; disk resume after compact |
| `contracts/progress.md` | Control-channel pulses (ephemeral; Log+git win) + **PLAN_SPEC_STATUS** + **PLAN_ORIENT** (step banners, Spec evidence, tab-switch orientation) |
| `contracts/executor.md` | Implementer must not commit |
| `contracts/advisor.md` | Read-only replan advisors |
| `contracts/planning.md` | Brief, tiers, **PLAN_VALIDATE**, **PLAN_SPEC_SYNC**, R1–R8 (+ R8b–d) + **R9** honest-empty / weakness bar, PLAN_APPLY A vs B |
| `contracts/outer-loop.md` | Ranking: B L1 campaign → `improve` host → optional goal (caps 8) |
| `dual-home.md` | A/B/M shapes, atomic ship checklist (H15–H18), package-parity Proof |
| `improve-loop-learnings.md` | Banked invariants (incl. H15–H18 dual-home hygiene) |

Continuous multi-cycle: B L1 campaign driver (primary); host goal optional; thin alias
`../skills/improve/SKILL.md`.  
Worktree: `../../tools/improve-worktree.sh`.  
Lint: `../../tools/improve-lint.sh` + `improve-lint-discover.js`.
