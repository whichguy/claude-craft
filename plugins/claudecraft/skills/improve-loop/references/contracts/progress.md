<!-- Host-agnostic control-channel progress pulses for improve / improve-loop -->

# Contract: Progress pulses (control channel)

Improve already persists truth in `IMPROVE_LOOP.md` and git commits. **Progress pulses** are
**side-channel** operator/UI updates so humans and host goal dashboards see live status
during iteration. They do **not** replace the ledger and must **not** affect stop predicates
or reintegrate.

## Capability

```text
progress.emit(markdown [, structured?])
# Prefer host goal progress when available:
#   goal.report(progress)  — see goal.md (sibling)
# Always fall back to a user-visible assistant/stdout block so the operator never gets silence.
```

## Required markdown shape

```markdown
## Improve progress — cycle N / run

**When:** <ISO-8601 or local timestamp>
**Target:** <one line from IMPROVE_LOOP title / target>
**Phase:** S8 cycle | phase-1 execute | S2 worktree | S11 reintegrate | S13 done | …
**Status:** active | complete | stopped (<reason>)
**Outcome (this unit):** confirmed | disproven | partial | blocked | n/a
**Test:** PASS | FAIL | skipped | n/a
**Committed:** pending | yes | no — <reason> | n/a

### Progress
- Backlog: <done>/<total> items checked
- Caps: cycle <k>/<max_cycles or ?>; elapsed <m>m[/max <M>m]; stall no-progress=<a> same-error=<b>
- Until: <text or —> → met? yes|no|n/a
- Landed improve commits (grep): <count this run if known>; latest: <subject or —>

### This unit — key changes
- <path>: <≤1 line what changed>
- … (at most 8 paths; or "no code landed")

### This unit — key learnings
- <novel learning or disproof; ≤2 lines>
- … (prefer *new* vs prior improve-loop digest; or "none new")

### Next
- Next backlog item: <first unchecked or —>
- Blockers / risks: <or none>
```

Heading **must** start with `## Improve progress` so headless logs are greppable.

## Optional structured companion

When the host accepts JSON progress (same emit):

```json
{
  "kind": "improve.progress",
  "cycle": 3,
  "phase": "S8 cycle",
  "status": "active",
  "outcome": "confirmed",
  "test": "PASS",
  "committed": "yes",
  "backlog_done": 2,
  "backlog_total": 5,
  "no_progress": 0,
  "same_error": 0,
  "changed_paths": ["README.md"],
  "learnings": ["…"],
  "next": "…"
}
```

Markdown is **mandatory**; JSON is optional.

### Optional pure formatter (deterministic)

Ship path: `plugins/claudecraft/tools/improve-progress-format.js`

```bash
node <plugin>/tools/improve-progress-format.js --file pulse.json
# or: … | node improve-progress-format.js
```

Input JSON fields align with the structured companion above (`cycle` required). Use when the
orchestrator wants a guaranteed schema-compliant pulse; still allowed to hand-author the same
markdown. Exit 2 if `cycle` is missing.

## Field sources (prefer deterministic)

| Field | Source |
|---|---|
| cycle N | Log `### Iteration N` / header `Iteration counter` |
| outcome / test / committed | Latest Log entry |
| backlog done/total | Count `- [x]` vs all `- [ ]`/`- [x]` under `## Backlog` |
| stall counters | `## Stop-condition tracking` |
| changed_paths | Pre-test `CHANGED_PATHS`, or `git show --name-only` if commit landed |
| learnings | Thesis + Outcome (+ disproof) + short Notes; skip restating prior digest |
| next | First unchecked Backlog line after replan |
| caps / elapsed | Driver: k, max_cycles, `started_at` from `.git/improve-runs/*.json` when present |

## When to emit

| Moment | Who | Required? |
|---|---|---|
| After Phase 2 Log append | improve-loop | **Yes** — draft pulse (Committed may still be pending) |
| After Phase 4 commit or veto | improve-loop | **Yes** — finalize Committed + paths (update same cycle’s pulse or emit short amend) |
| End of Phase 5 | improve-loop | **Yes** if not already finalized post-Phase 4 |
| After each S8 cycle | improve driver | **Yes** — ensure pulse exists; synthesize from Log if cycle omitted it |
| S2 / S3 worktree | improve driver | Optional one-liner |
| S11 reintegrate / S12 destroy | improve driver | **Yes** (short result) |
| S13 done | improve driver | **Yes** final summary |
| Mid Phase 1 | improve-loop | Optional **once** if executor is still running past ~soft budget |

**Do not** emit per advisor message, per file write, or per test log line.

## Host map

| Host | Emit |
|---|---|
| Claude goal mode | Progress/update tool with markdown body if available |
| Grok goal mode | `update_goal` message (or equivalent) with markdown |
| No goal facility | User-visible assistant markdown block |
| Headless / CI | stdout with `## Improve progress` |
| Re-invoke wrappers | Assistant-visible pulse each cycle (promise rules unchanged) |

**Order:** try host goal progress → always ensure visible markdown fallback.

## Privacy

- No secret-shaped strings (same patterns as Phase 4 commit scan).  
- No full test logs, `.env`, or raw tokens — at most a one-line test summary / error signature.  
- Truncate paths and learnings rather than pasting large dumps.

## Relation to ledger

| Durable | Ephemeral |
|---|---|
| `IMPROVE_LOOP.md` Log | Progress pulse |
| `improve-loop: iteration N —` commits | Goal UI / chat |

If pulse and Log disagree, **Log + git win**.

Pulses do **not** replace `## Driver` or run-state JSON for resume after compaction — those
are durable; pulses are side-channel only.
