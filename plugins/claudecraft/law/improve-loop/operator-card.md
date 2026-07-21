---
name: improve-loop
description: >-
  Run one evidence-led improvement cycle in any git repository (host-agnostic kernel):
  bounded backlog item → test → deterministic learnings → replan → one ledger commit.
  Invoke as "/claudecraft:improve-loop <target>" when installed via claude-craft, or by
  loading this skill in other harnesses. Multi-cycle continuity: host goal iterates this
  skill (contracts/goal.md) or use the improve driver skill — not a Stop-hook re-invoke plugin.
---

# Improve loop — operator card (home A law)

**Law-edit path only.** Runtime campaigns load home **B** (`plugins/claudecraft/skills/improve-loop`
monolith). This card indexes the modular law tree beside it.

**Exactly one cycle** is the atomic L2 unit (or Phase 0 short-circuit / ledger-flush). Multi-cycle:
primary = **B L1** autonomous campaign; optional host **goal** observability; thin **`improve`**
driver alias — see `contracts/goal.md` + `dual-home.md` product model.

Normative detail lives in sibling files (see `INDEX.md`). **When editing a phase, Read that
phase’s law file** before applying its rules.

> **Home A (law):** `plugins/claudecraft/law/improve-loop/` — never rsync into B/M.
> **Home B/M (runtime):** monolith + scripts + tests. Law changes start here; surgical mirror to B; then M (`dual-home.md`).

## Operator card

| Item | Rule |
|---|---|
| Scope | One git repo root; `IMPROVE_LOOP.md` (+ `## Driver`) + optional code |
| Commits | **Yes** — orchestrator may commit once per cycle; prefer worktree |
| Tests | Stated or already recorded; **never invented** |
| Continuous | B L1 campaign (primary) or **`improve`** host / optional goal; default until = no P0/P1 ×2 green (on disk); max_cycles **8** |
| Automation | Most appropriate safe path by default; **stop only when blocked**; resume from **disk** |
| Resume | Phase 0: disk only — header Until/Max cycles + Driver mode/until/streak; chat untrusted |
| Progress | Pulse each cycle → `contracts/progress.md`; prefer `../../tools/improve-progress-format.js` |
| Lifecycle | Worktree default: dirty launch → create+carry (drain launch), cycle in WT, once-mode reintegrate; never force-destroy dirty tips |
| Kernel | Host-agnostic; Claude slash names are plugin packaging only |

## Invocation

Free-form target (and ideally the test command):

```text
/claudecraft:improve-loop "error handling in scripts/ingest.py, tests via pytest"
```

Other harnesses: load this skill and pass the same free-form target.  
Optional alias: bare `/improve-loop` via local planning-suite alias.

If the test command is missing: **ask once** when a human is present; record it in
`IMPROVE_LOOP.md`. Unattended outer loops with no test command: write a blocked Last cycle,
commit ledger-only, stop cleanly (see `phase-0-resume.md` / outer-loop contract).

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- Git repo: `git rev-parse --show-toplevel` succeeds (remember this root).
- `IMPROVE_LOOP.md` at that root is **not** gitignored (`git check-ignore -q IMPROVE_LOOP.md` fails).
- Prefer gitignoring test artifacts (caches, coverage) so they do not trip the next Phase 0 dirty guard.
- Tools: `git`, shell for the recorded test command; an **executor** per `contracts/executor.md`
  (host code agent / optional codex-worker — fall back native if missing).

## Durable state

Schema, **`## Driver`**, **## Last cycle** (replace each cycle — not diary Log), Spec
validation header, iteration counter `N`, and stop-condition matrix:

→ **Read** `ledger-schema.md`

After context compaction or a user re-prompt: **rehydrate from disk only** (Phase 0), then
follow `next_auto`. Print the Phase 5 resume template whenever blocked.

Commit subject (load-bearing): `improve-loop: iteration N — <summary>`  
(em-dash after `N` required so greps do not treat `1` as a prefix of `10`).

## The cycle (checklist)

Execute in order. For each step, **Read** the linked file and follow it fully.

| Phase | What | Reference |
|---|---|---|
| 0 | Resume, dirty/landed guards, digests, caps probe | `phase-0-resume.md` |
| 1 | Execute one backlog item; orchestrator tests once; revert on FAIL | `phase-1-execute.md` |
| 2 | **Replace** `## Last cycle`; update counters; check off only confirmed+code; **draft progress pulse** | `phase-2-learn.md` |
| 3 | Advisor/native replan; surgical Backlog | `phase-3-replan.md` |
| 3v | **Spec validation gate** (when open P0/P1 = 0); fail→seed `validate V<k>`; then Status stops | `phase-3v-validate.md` |
| 4 | One commit (or code-dirty/secret veto); body + Validation line when 3v fired; **finalize pulse** | `phase-4-commit.md` |
| 5 | **Emit control-channel progress pulse**; host `goal.complete`/`blocked` if terminal **and** landed | `phase-5-decision.md` |

**Load rule:** do not rely on memory — open the phase reference for the phase you are in (the B runtime monolith is ~2,700 lines; nobody holds it).

## Contracts (portable)

| Contract | File |
|---|---|
| Goal (continuous host) | `contracts/goal.md` |
| Progress pulses | `contracts/progress.md` |
| Planning (PLAN_*, R1–R8, Spec validation) | `contracts/planning.md` |
| Executor | `contracts/executor.md` |
| Advisor | `contracts/advisor.md` |
| Outer loop / quotas | `contracts/outer-loop.md` |

## Related

- Ship / dual-home hygiene (A/B/M, H15–H18): `dual-home.md`
- Continuous driver: `../improve/SKILL.md`  
- Worktree tool: `../../tools/improve-worktree.sh`
