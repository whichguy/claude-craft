<!-- Host-agnostic contract for Phase 1 implementers -->

# Contract: Executor (implement, do not commit)

Phase 1 of improve-loop needs an **executor** that changes the working tree for one backlog item.

## Required behavior

1. Receive: backlog item, paths/pointers to `IMPROVE_LOOP.md` and recent history (not huge inlined dumps).  
2. **Must not** `git commit`, **must not** `git add`/stage for the purpose of committing, **must not** edit `IMPROVE_LOOP.md`.  
3. May edit product code/tests; leave changes in the working tree.  
4. Return at least: `WHAT_CHANGED` (paths), `THESIS` (one line), suggested `OUTCOME`.  
5. Authoritative **STATUS** (PASS/FAIL) is owned by the **orchestrator** after the test command — never by the executor alone.

## Host mappings

| Host | Typical executor |
|---|---|
| Any | Fresh general-purpose subagent / worker with write tools |
| Claude + Codex available | Optional: planner agent returns scoped brief → `codex-worker` implements |
| Grok | Grok write-capable task / main loop implementer |
| Restricted | Orchestrator implements natively (still no mid-cycle commit of ledger) |

If a preferred host plugin is missing, **fall back** to native implementation; do not hard-fail the cycle solely because a named plugin is absent.

## Scope

If the executor declares a file scope and then touches paths outside it, orchestrator sets Outcome `blocked` and does not trust the diff for a non-ledger commit.
