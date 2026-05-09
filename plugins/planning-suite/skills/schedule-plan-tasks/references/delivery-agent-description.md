# Delivery-Agent Task Envelope (verbatim)

Per-task envelope the orchestrator inserts into every Delivery-agent `TaskCreate.description`.
The behavior contract (lifecycle, merge, status protocol, specialist catalog, sub-task spawning)
lives in `agents/delivery-agent.md` — do NOT paste any of that here.

Shape: small runtime header + ONE paragraph of guidance. The agent infers the implementation
contract and acceptance criteria from the paragraph; orchestrator does not pre-decompose.

`Read` this file in full and paste the envelope verbatim into `TaskCreate.description`.

**Two rules:** template = verbatim (substitute placeholders only); paragraph slot =
distilled prose per Step 3 of `SKILL.md` (no code blocks, no numbered steps, ≤ ~120 words).
"No paraphrase" applies to the template structure, not to the paragraph content.

Substitute placeholders per task:
- `[TASK_ID]` — the TaskCreate-returned task ID, embedded by the orchestrator in Phase 1.5
- `[absolute worktree path]` — e.g. `/repo/.worktrees/chain-1`; use `main workspace` for trivial tasks. Always absolute — never relative — because the agent's host CWD may differ from the target repo root.
- `[MAIN_REPO_ROOT value]` — absolute path to the working tree where `MERGE_TARGET` is checked out. Orchestrator-dispatched: `$REPO_ROOT`. Sub-task: parent agent's `WORKTREE_PATH`. Read by self-merge block to locate merge host (worktree's `rev-parse --show-toplevel` returns the worktree, not main repo).
- `[MERGE_TARGET value]` — Target branch (orchestrator dispatch) or parent agent's working branch (sub-task).
- `Isolation: native worktree` — for worktree tasks; for trivial tasks, use `Isolation: none (trivial)`
- `Self-merge: yes` — for Chain: none and Chain: tail tasks; `no` for Chain: head and Chain: link tasks
- `Chain: <chain-K | none>` — substituted from `metadata.chain_id` and `metadata.chain_role`; `none` for standalones, `chain-K` for chain members (head/link/tail). The agent's self-merge block reads this header to choose between standalone and chain merge-commit bodies.
- `Cascade: required` — fixed literal. Precondition reminder: before `RESULT: complete`, the agent must have run TaskList, gated candidates, and recorded unblocked IDs in `DISPATCHED:`. Full contract in `agents/delivery-agent.md`.
- `Prior chain commits:` — chain `link`/`tail` only (omit for `head` and standalones). Tells the agent to read predecessor commits' "Key learnings" sections before starting.
- `[symlinked paths outside worktree, or "none"]` — only paths to files outside the git repo that were explicitly symlinked in
- `[one-paragraph guidance]` — a single paragraph (≤ ~120 words) describing what to accomplish: the goal, the file(s) involved, key behavioral expectations, and how success is observable. No code blocks, no numbered steps, no separate Definition-of-done section — the agent derives all of that from this paragraph plus its system prompt.

For trivial tasks: set `Isolation: none (trivial)`, `Self-merge: no`, working directory `main workspace`.

Sub-task spawning is always available — no field controls it. The agent decides at runtime whether parallel sub-task decomposition is warranted.

---

```
Task ID: [TASK_ID]
Working directory: [absolute worktree path]
MAIN_REPO_ROOT: [MAIN_REPO_ROOT value]
MERGE_TARGET: [MERGE_TARGET value]
Isolation: native worktree | none (trivial)
Self-merge: yes | no
Chain: <chain-K | none>
Cascade: required (TaskList → gate-check → record unblocked IDs in DISPATCHED: BEFORE emitting RESULT: complete)
Prior chain commits: <chain-link/tail only — omit line for head and standalones>
External resources: [symlinked paths outside worktree, or "none"]

[one-paragraph guidance — what to accomplish, files involved, observable success criteria,
woven into prose. The framework for HOW to execute (phases, specialist agents, commit,
self-merge, status protocol) lives in agents/delivery-agent.md.]
```
