# improve-loop references (index)

Normative one-cycle law. **SKILL.md** is the operator card; open these when executing.

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
| `contracts/progress.md` | Control-channel progress pulses (ephemeral; Log+git win) |
| `contracts/executor.md` | Implementer must not commit |
| `contracts/advisor.md` | Read-only replan advisors |
| `contracts/planning.md` | Brief, tiers, **PLAN_VALIDATE**, spine 1→2→3→4, R1–R8, PLAN_APPLY A vs B |
| `contracts/outer-loop.md` | Ranking: host goal → `improve` driver (finite caps) |

Continuous multi-cycle: host **goal** or `../../improve/SKILL.md`.  
Worktree: `../../../tools/improve-worktree.sh`.  
Lint (discover/cache/run): `../../../tools/improve-lint.sh` + `improve-lint-discover.js`.
