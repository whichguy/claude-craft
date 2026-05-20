# delivery-agent prompt — structural contracts inventory

Source of truth for what "the prompt's structure is working" means. Each
row below names one **load-bearing contract** in
`plugins/planning-suite/agents/delivery-agent.md` — a specific emission,
ordering, or behavior the prompt prescribes — paired with where the signal
appears in the stream-json event log, which harness view exposes it, and
how it will be graded.

A fixture is authored in Phase 1 for every contract here that lands in
**ACTIVE** status. Contracts in **DEFERRED** status are recorded so we
remember why they weren't tested; they do not generate fixtures unless
re-classified.

The goal is failure attribution: when we edit `delivery-agent.md`, the
fixture(s) for the affected contract(s) should be the ones that flip red.
If a prompt edit breaks something *not* covered here, that's a gap in
this inventory — file a row, don't widen an existing rubric to absorb it.

Status legend:
- **ACTIVE** — fixture written in Phase 1.
- **DEFERRED–C12** — no clean deterministic trigger on V2; revisit after C1–C11 ship.
- **DEFERRED–C13** — needs filesystem inspection (Phase-3 workdir capability) before it can be expressed.

---

## C1 — Preamble paragraph before any tool call

**Source.** delivery-agent.md L30: *"State your inferred purpose /
what-to-do / DoD in one short paragraph at the start of your run (no
pause for confirmation), then execute."* Reinforced by L114–116: no file
edits or bash commands may happen before the `## Agent selection` block
(C2 is the stricter sibling). C1 captures the *paragraph* requirement
specifically — that there is a Purpose/What-to-do/DoD restatement at all,
and that the agent does **not** pause for confirmation.

**Signal.** The first assistant `text` block in the run, appearing before
any `tool_use` block.

**View.** `assistant_text`.

**Grading.** `semantic` rubric: "First assistant text block names purpose,
what-to-do, and definition-of-done in a single short paragraph; agent
does NOT ask the user to confirm before proceeding to tool calls." FAIL
if the preamble is missing, splits across multiple turns, or contains a
question/pause for confirmation. Status: **ACTIVE**.

---

## C2 — `## Agent selection` block as first emitted action

**Source.** L113–117 (Directive): *"First action upon receiving the
envelope: emit the `## Agent selection` declaration block per Step L0a
(below). No file edits, bash commands, or implementation may happen
before that block is on screen."* L273–283 specifies the block's
machine-parseable shape.

**Signal.** An assistant `text` block whose content matches
`^## Agent selection\n` (anchored to start-of-block), emitted before any
non-read tool_use (read-only existence checks against `.task-plan.md` are
explicitly allowed alongside the block per L139–140).

**View.** `assistant_text` (header presence) + `tool_calls.order`
(ordering vs. first write/bash/edit).

**Grading.** `views.assistant_text.must_include`: regex
`^## Agent selection`. `semantic` rubric on `assistant_text` checks the
block's body shape — `P<n>: ...` lines for single-agent phases,
`P<n>.a/.b/.c` for split phases — and verifies the block is emitted
before any Write/Edit/Bash tool_use. Status: **ACTIVE**.

---

## C3 — Trivial-task collapse

**Source.** L287–296: *"When the envelope sets `Isolation: none
(trivial)`, L0a collapses to a single line and L1 is skipped."* Implies
no phase TaskCreate calls and no `## Agent selection` enumeration of P0…P10.

**Signal.** For a trivial-envelope fixture only: zero `TaskCreate`
tool_use blocks for phases; a single-line `## Agent selection` such as
`P2: general-purpose — trivial single-phase task; skipping L1.`

**View.** `tool_calls` (counts) + `assistant_text` (block shape).

**Grading.** `tool_calls.counts.TaskCreate: { exact: 0 }` (trivial
fixture only); `semantic` rubric on `assistant_text` confirms the
collapsed single-line shape and absence of P3/P4/P5/etc. enumeration.
Status: **ACTIVE**.

---

## C4 — Phase Tasks created in one parallel TaskCreate batch

**Source.** L222–225 (Step L0): *"Create a Task for each applicable phase
in ONE parallel batch."*

**Signal.** Multiple `TaskCreate` tool_uses emitted within a single
assistant message (same parent message id), one per applicable phase.

**View.** `tool_calls` (parent-message grouping) + `tool_calls.inputs`
(phase identity per call).

**Grading.** `semantic` rubric on the canonical `tool_inputs` listing:
"All P0/P1/…/P10 TaskCreate calls share one parent assistant message id;
none appear in a later message." FAIL if phase TaskCreate calls are
spread across multiple assistant turns. Status: **ACTIVE** (for a
non-trivial envelope only — C3 covers the trivial path).

---

## C5 — Phase dependencies wired in BOTH directions

**Source.** L328–332 (Step L1): *"For every dependency pair, call BOTH
directions: `TaskUpdate({ taskId: downstream, addBlockedBy: [upstream]
})` and `TaskUpdate({ taskId: upstream, addBlocks: [downstream] })`."*

**Signal.** For every `TaskUpdate(X, addBlockedBy: [Y])` call there is a
matching `TaskUpdate(Y, addBlocks: [X])` call.

**View.** `tool_calls.inputs` (canonical JSON listing of every
TaskUpdate's args).

**Grading.** `semantic` rubric: judge reads the canonical TaskUpdate
inputs in chronological order and verifies pair-symmetry — every
`addBlockedBy` is paired with a matching `addBlocks`. Unpaired edges =
FAIL. Status: **ACTIVE**.

---

## C6 — `.task-plan.md` created and updated at phase transitions

**Source.** L131–137 ("Working journal"), L142–182. *"The journal is
updated at every phase transition, not batched at the end."* L172–182
makes the per-transition Edit explicit: *"A single `Edit` per
transition. Do not batch across phases."*

**Signal.** One `Write` tool_use targeting `.task-plan.md` (creation),
followed by ≥1 `Edit` tool_uses on the same path interleaved with phase
work — not all bunched at the end of the run.

**View.** `tool_calls.inputs` (path patterns) + `tool_calls.order`
(transitions vs. phase work).

**Grading.** `tool_calls.inputs.Write.must_match: { pattern:
"\\.task-plan\\.md$" }`; `tool_calls.counts.Edit.min: 1`. `semantic`
rubric: "`.task-plan.md` Edits land at phase transitions throughout the
run, not as a single batch at the end." Status: **ACTIVE**.

---

## C7 — `.task-plan.md` registered in worktree-local `info/exclude`

**Source.** L188–196: *"Register it as a worktree-local exclude before
the first write so it stays invisible to `git status`, `git add`, and
`git diff`"* — followed by the literal bash block writing
`.task-plan.md` to `$(git rev-parse --git-dir)/info/exclude`.

**Signal.** A `Bash` tool_use whose canonical command string contains
`info/exclude` and references `.task-plan.md`, emitted **before** the
first Write/Edit of `.task-plan.md`.

**View.** `tool_calls.inputs` (Bash command) + `tool_calls.order`
(exclude registration before first journal write).

**Grading.** `tool_calls.inputs.Bash.must_match: { pattern:
"info/exclude" }`; `semantic` rubric: "The info/exclude registration
Bash call precedes the first `.task-plan.md` Write." Status: **ACTIVE**.

---

## C8 — Pre-commit headers emitted immediately before `git commit`

**Source.** L637–736 ("Pre-commit checks (before ANY git commit)").
Three required headings: `## Scope-drift` (L644), `## Assumptions to
verify` (L699), `## Citation gap` (L722, conditional on guidance
referencing citations). L639–642: *"All go to the orchestrator as part
of your run output (above the commit body), not into the commit body
itself. Empty cases must still emit the heading + `none`."*

**Signal.** Three assistant `text` blocks containing the header strings,
each chronologically before the `Bash` invocation that runs `git
commit`. The `## Citation gap` block is only required when guidance
demands citations; the fixture envelope controls whether it applies.

**View.** `assistant_text` (header presence) + `tool_calls.order`
(headers vs. `git commit` Bash call).

**Grading.** `views.assistant_text.must_include` for `^## Scope-drift`
and `^## Assumptions to verify` (and `^## Citation gap` in the
citation-bearing fixture variant); `semantic` rubric on the full
chronological view: "All required pre-commit headers appear before the
first occurrence of `git commit` in any tool input." Status: **ACTIVE**.

---

## C9 — Single `git commit` with structured body

**Source.** L740 ("Make exactly one `git commit`…") and the literal
template block at L746–775. Mandatory body sections (each heading must
appear so `git log --grep` works reliably): `Why:`, `What was
considered:`, `What was tested:`, `Review findings:`, `Key learnings:`.
L778: *"One commit per task — consolidate any inline `git commit`
calls."*

**Signal.** Exactly one `Bash` tool_use whose canonical input contains
`git commit -F -`; the heredoc body in that same input contains each of
the five required headings.

**View.** `tool_calls.counts` (Bash) + `tool_calls.inputs` (commit body
content).

**Grading.** `tool_calls.inputs.Bash.must_match` for `git commit -F -`
and for each required heading (`Why:`, `What was considered:`, `What was
tested:`, `Review findings:`, `Key learnings:`). `semantic` rubric:
"Exactly one `git commit` invocation; every required heading is present
and its body is non-empty (allowing `n/a`/`none` per L743–744)." Status:
**ACTIVE**.

---

## C10 — Final emission is the status block; `DISPATCHED: none`

**Source.** L820–829 (status protocol template), L837: *"`DISPATCHED` is
always `none` — the orchestrator owns cascade dispatch."* Reinforced at
L818, L845, L861.

**Signal.** The terminal `result` event's `.result` string is (or ends
with) the status block, and the `DISPATCHED:` line value is exactly
`none`.

**View.** `result`.

**Grading.** `result.must_match` for each field's header (`RESULT:`,
`WORK:`, `INCOMPLETE:`, `FAILURE:`, `ARTIFACT:`, `DISPATCHED:`);
`result.must_match: { pattern: "DISPATCHED:\\s*none",
case_sensitive: true }`. `semantic` rubric: "Status block is the final
content in the result; no further free-text after it." Status:
**ACTIVE**.

---

## C11 — On RESULT: complete, self-`TaskUpdate(status: completed)`

**Source.** L842–845 (On RESULT: complete, Step 1): *"Mark this task
completed: `TaskUpdate({ taskId: "[TASK_ID]", status: "completed"
})`."* Reinforced by L868: *"The agent owns its own status transition."*

**Signal.** A `TaskUpdate` tool_use with `status: "completed"` and
`taskId` matching the envelope's Task ID, emitted around the final
status block (typically before).

**View.** `tool_calls.inputs`.

**Grading.** `tool_calls.inputs.TaskUpdate.must_match: { pattern:
"\"status\"\\s*:\\s*\"completed\"" }`; `semantic` rubric: "The
self-TaskUpdate's `taskId` matches the envelope's `Task ID:` value
verbatim." Status: **ACTIVE**.

---

## C12 — Retry-bound (≤3 distinct fix attempts on one obstacle)

**Source.** L122–126: *"Retry bound: make at most 3 distinct fix
attempts on any single obstacle. … After 3 attempts on the same
problem, stop immediately and emit the status block with `RESULT:
failed`."*

**Signal.** Up to 3 retries on the same failing tool call before
`RESULT: failed`. Identifying "same obstacle" requires semantic
clustering of failures that V2 grading cannot do deterministically; a
capable model also usually decides early whether an obstacle is fatal,
so the 3-attempt boundary is rarely reached cleanly.

**View.** n/a in V2.

**Grading.** **DEFERRED–C12.** No fixture authored in Phase 1. Revisit
after C1–C11 ship, possibly with a synthetic envelope that forces a
known-flaky operation; even then, the rubric is loose and the signal
fragile. Document the deferral in `## Why this plan` if it persists.

---

## C13 — Sandbox-Refs handling: no overlay leakage into tracked config

**Source.** L36–110 (External-system sandboxes). Concrete check at
L85–88: *"After every deploy, run `git status --porcelain` against the
tracked config paths the recipe touched and **fail the task** with
`STATUS: failure — sandbox overlay leaked into tracked config` if any
modification remains. Verify this before any commit you make."*

**Signal.** After commit, the workdir's `git status --porcelain
<tracked-paths>` is empty; no `.sandbox-overlay/` files appear in the
commit.

**View.** filesystem (workdir scan + git ls-tree against the deliverable
commit).

**Grading.** **DEFERRED–C13.** Requires the Phase-3 `workdir: true` +
`artifact.verify` harness capability described in the plan. Phase-4
conditional — not authored unless Phase 3 fires.

---

## Coverage summary

| Contract | Status   | View(s)                               | Phase |
|----------|----------|---------------------------------------|-------|
| C1       | ACTIVE   | assistant_text                        | 1     |
| C2       | ACTIVE   | assistant_text + tool_calls.order     | 1     |
| C3       | ACTIVE   | tool_calls.counts + assistant_text    | 1     |
| C4       | ACTIVE   | tool_calls (parent-msg) + inputs      | 1     |
| C5       | ACTIVE   | tool_calls.inputs                     | 1     |
| C6       | ACTIVE   | tool_calls.inputs + order             | 1     |
| C7       | ACTIVE   | tool_calls.inputs + order             | 1     |
| C8       | ACTIVE   | assistant_text + tool_calls.order     | 1     |
| C9       | ACTIVE   | tool_calls.counts + inputs            | 1     |
| C10      | ACTIVE   | result                                | 1     |
| C11      | ACTIVE   | tool_calls.inputs                     | 1     |
| C12      | DEFERRED | —                                     | —     |
| C13      | DEFERRED | filesystem (workdir+verify)           | 4     |

Eleven active contracts → Phase 1 authors 8–10 fixtures (some contracts
collapse to a single envelope — for example C8 + C9 may share one
commit-focused fixture, and C2 + C4 may share one non-trivial-envelope
fixture).
