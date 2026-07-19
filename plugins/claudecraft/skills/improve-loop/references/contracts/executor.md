<!-- Host-agnostic contract for Phase 1 implementers -->

# Contract: Executor (implement, do not commit)

Phase 1 of improve-loop needs an **executor** that changes the working tree for one backlog item.

## Required behavior

1. Receive: backlog item (for **material** kinds: Change + **Decision** + **Preserve** +
   **Acceptance** unchanged — see improve-loop `ledger-schema.md` and phase-1-execute),
   paths/pointers to `IMPROVE_LOOP.md` and recent history (not huge inlined dumps).  
2. **Must not** `git commit`, **must not** `git add`/stage for the purpose of committing, **must not** edit `IMPROVE_LOOP.md`.  
3. May edit product code/tests; leave changes in the working tree.  
4. **Must not** silently reinterpret Decision or violate Preserve. On contradictory
   evidence, report it and suggest `blocked`/`partial` — do not land a different product
   choice without a Phase 3 Backlog rewrite.  
5. Return at least: `WHAT_CHANGED` (paths), `THESIS` (one line), suggested `OUTCOME`.  
6. Authoritative **STATUS** (PASS/FAIL) is owned by the **orchestrator** after the test command — never by the executor alone.

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

## Suite ownership and failure

- May run **narrow/targeted** checks named by the item. Must **not** run the recorded **full** test command — the one Confirm-class suite run is **orchestrator-owned** (U9: never two full suite runs per cycle). Route side-effect artifact paths back so the orchestrator can add them to `TEST_ARTIFACT_PATHS`.
- On timeout / non-response / crash: orchestrator treats the item as `blocked` for this cycle, inspects the tree for partial changes before the Phase 1 revert decision — **never re-dispatch the same item twice in one cycle**. Do not invent PASS. Orchestrator still owns STATUS.
- Report enough for Phase 2: paths changed, thesis, suggested outcome, and any unmet Acceptance / blockers / scope departures known at return (orchestrator reconciles final Outcome against STATUS).

