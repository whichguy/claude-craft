# Delivery-Agent Task Envelope (verbatim)

This file holds the per-task envelope the orchestrator inserts into every Delivery-agent
`TaskCreate.description`. The behavior contract (lifecycle, merge protocol, status protocol,
specialist catalog, sub-task spawning rules) lives in `agents/delivery-agent.md` and is
loaded by the harness when the agent is dispatched via `subagent_type: "delivery-agent"` —
do NOT paste any of that into the description.

The envelope itself is **a small runtime header followed by ONE paragraph of general
guidance** about what to accomplish. The agent infers the implementation contract and
acceptance criteria from that paragraph using the framework in its system prompt — the
orchestrator does not pre-decompose the work.

The orchestrator must `Read` this file in full and paste the envelope verbatim into
`TaskCreate.description` — no paraphrasing.

Substitute placeholders per task:
- `[TASK_ID]` — the TaskCreate-returned task ID, embedded by the orchestrator in Phase 1.5
- `[absolute worktree path]` — e.g. `/repo/.worktrees/chain-1`; use `main workspace` for trivial tasks
- `[MERGE_TARGET value]` — equals Target branch for orchestrator-dispatched tasks; equals the parent agent's working branch for sub-tasks spawned within a delivery-agent
- `Isolation: native worktree` — for worktree tasks; for trivial tasks, use `Isolation: none (trivial)`
- `Self-merge: yes` — for Chain: none and Chain: tail tasks; `no` for Chain: head and Chain: link tasks
- `[symlinked paths outside worktree, or "none"]` — only paths to files outside the git repo that were explicitly symlinked in
- `[one-paragraph guidance]` — a single paragraph (≤ ~120 words) describing what to accomplish: the goal, the file(s) involved, key behavioral expectations, and how success is observable. No code blocks, no numbered steps, no separate Definition-of-done section — the agent derives all of that from this paragraph plus its system prompt.

For trivial tasks: set `Isolation: none (trivial)`, `Self-merge: no`, working directory `main workspace`.

Sub-task spawning is always available — no field controls it. The agent decides at runtime whether parallel sub-task decomposition is warranted.

---

```
Task ID: [TASK_ID]
Working directory: [absolute worktree path]
MERGE_TARGET: [MERGE_TARGET value]
Isolation: native worktree | none (trivial)
Self-merge: yes | no
External resources: [symlinked paths outside worktree, or "none"]

[one-paragraph guidance — what to accomplish, files involved, observable success criteria,
woven into prose. The framework for HOW to execute (phases, specialist agents, commit,
self-merge, status protocol) lives in agents/delivery-agent.md.]
```
