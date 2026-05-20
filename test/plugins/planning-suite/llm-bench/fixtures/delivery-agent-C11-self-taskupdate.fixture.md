---
name: delivery-agent-C11-self-taskupdate
description: "C11 — On RESULT: complete, delivery-agent self-issues TaskUpdate({ taskId: envelope-task-id, status: completed }) before/around the final status block. (delivery-agent.md L842–845, L868)"
model: claude-sonnet-4-6
timeout_seconds: 900
permission_mode: bypassPermissions
allowed_tools: "Bash Read Write Edit Glob Grep TaskCreate TaskUpdate TaskGet TaskList Agent ToolSearch"
append_system_prompt_file: plugins/planning-suite/agents/delivery-agent.md

runs: 3
quorum: majority

pass_conditions:
  run:
    must_succeed: true
    max_parse_errors: 0
  tool_calls:
    required: ["TaskUpdate"]
    inputs:
      - { tool: TaskUpdate, must_match: { pattern: "\"status\"\\s*:\\s*\"completed\"", case_sensitive: true } }
  semantic:
    - id: c11-self-taskupdate-completed-matches-envelope-taskid
      view: tool_inputs
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the canonical tool_inputs view (one JSON line per
        tool_use, top-level keys sorted).

        Contract C11 (delivery-agent.md L842–845, L868): "On RESULT:
        complete, mark this task completed: TaskUpdate({ taskId:
        '[TASK_ID]', status: 'completed' })." The envelope's Task ID for
        this fixture is the literal string `T-C5-OR-C11` style — in this
        fixture it is `T-C11`.

        PASS iff:
        1. At least one TaskUpdate tool_use's input JSON contains BOTH:
           - `"status":"completed"` (exact)
           - `"taskId":"T-C11"` (exact, matching the envelope's Task ID)
           in the same call.
        2. That call appears AFTER the agent has done meaningful work — not
           as the agent's first action (it should mark completion at the
           END, per `## On RESULT: complete`).

        FAIL if: no TaskUpdate(status:completed) ever fires; or the
        TaskUpdate(status:completed) call uses some other taskId that
        doesn't match the envelope's; or it fires as the very first
        TaskUpdate without prior work.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c11-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/sum-util
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C11
Working directory: /tmp/da-c11-workdir
MAIN_REPO_ROOT: /tmp/da-c11-workdir
MERGE_TARGET: main
Isolation: native worktree
Self-merge: yes
Chain: none
External resources: none

Add a typed utility function `sum(a: number, b: number): number` at src/sum.ts with a JSDoc comment, plus one Mocha unit test at test/sum.test.ts that asserts sum(2,3)===5 and sum(-1,1)===0. Done when src/sum.ts exports sum, test/sum.test.ts passes under `node --test test/sum.test.ts`, and a single commit lands on feat/sum-util.
```
