---
name: improve-loop
description: >-
  Run one evidence-led improvement cycle in any git repository (host-agnostic kernel):
  bounded backlog item → test → deterministic learnings → replan → one ledger commit.
  Invoke as "/claudecraft:improve-loop <target>" when installed via claude-craft, or by
  loading this skill in other harnesses. Continuous multi-cycle runs → improve driver skill
  (or host goal per references/contracts/goal.md). Optional finite outer re-invoke wrappers OK.
---

# Improve loop (one cycle)

**Exactly one cycle** per invocation (or Phase 0 short-circuit / ledger-flush).  
Continuous runs: use the **`improve`** driver skill, or a host **goal** facility bound to
`references/contracts/goal.md`. Do not invent a second persistence path outside git.

This file is the **operator card + phase index**. Normative detail lives in `references/`
(see `references/INDEX.md`). **When executing a phase, Read that phase’s reference file**
before applying its rules.

## Operator card

| Item | Rule |
|---|---|
| Scope | One git repo root; `IMPROVE_LOOP.md` + optional code |
| Commits | **Yes** — orchestrator may commit once per cycle; prefer a branch/worktree |
| Tests | Stated or already recorded; **never invented** |
| Continuous | `improve` driver or host goal — not unlimited outer quotas |
| Progress | Pulse each cycle → `references/contracts/progress.md`; prefer `../../tools/improve-progress-format.js` |
| Lifecycle | `../../tools/improve-worktree.sh` (create/carry/reintegrate/destroy) |
| Kernel | Host-agnostic; Claude slash names are plugin packaging only |

## Invocation

Free-form target (and ideally the test command):

```text
/claudecraft:improve-loop "error handling in scripts/ingest.py, tests via pytest"
```

Other harnesses: load this skill and pass the same free-form target.  
Optional alias: bare `/improve-loop` via local planning-suite alias.

If the test command is missing: **ask once** when a human is present; record it in
`IMPROVE_LOOP.md`. Unattended outer loops with no test command: write a blocked Log entry,
commit ledger-only, stop cleanly (see `references/phase-0-resume.md` / outer-loop contract).

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- Git repo: `git rev-parse --show-toplevel` succeeds (remember this root).
- `IMPROVE_LOOP.md` at that root is **not** gitignored (`git check-ignore -q IMPROVE_LOOP.md` fails).
- Prefer gitignoring test artifacts (caches, coverage) so they do not trip the next Phase 0 dirty guard.
- Tools: `git`, shell for the recorded test command; an **executor** per `references/contracts/executor.md`
  (host code agent / optional codex-worker — fall back native if missing).

## Durable state

Schema, Log rules, iteration counter `N`, and stop-condition matrix:

→ **Read** `references/ledger-schema.md`

Commit subject (load-bearing): `improve-loop: iteration N — <summary>`  
(em-dash after `N` required so greps do not treat `1` as a prefix of `10`).

## The cycle (checklist)

Execute in order. For each step, **Read** the linked file and follow it fully.

| Phase | What | Reference |
|---|---|---|
| 0 | Resume, dirty/landed guards, digests, caps probe | `references/phase-0-resume.md` |
| 1 | Execute one backlog item; orchestrator tests once; revert on FAIL | `references/phase-1-execute.md` |
| 2 | Append Log; update counters; check off only confirmed+code; **draft progress pulse** | `references/phase-2-learn.md` |
| 3 | Advisor/native replan; surgical Backlog; Status stops | `references/phase-3-replan.md` |
| 4 | One commit (or code-dirty/secret veto); 7-field body; **finalize pulse Committed/paths** | `references/phase-4-commit.md` |
| 5 | **Emit control-channel progress pulse**; outer promise only if terminal **and** landed | `references/phase-5-decision.md` |

**Load rule:** do not rely on memory of a 900-line monolith — open the phase reference for the phase you are in.

## Contracts (portable)

| Contract | File |
|---|---|
| Goal (continuous host) | `references/contracts/goal.md` |
| Progress pulses | `references/contracts/progress.md` |
| Executor | `references/contracts/executor.md` |
| Advisor | `references/contracts/advisor.md` |
| Outer loop / quotas | `references/contracts/outer-loop.md` |

## Related

- Continuous driver: `../improve/SKILL.md`  
- Worktree tool: `../../tools/improve-worktree.sh`
