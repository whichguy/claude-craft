---
name: delivery-agent-C4-parallel-taskcreate
description: "C4 — for non-trivial envelopes, delivery-agent creates a Task per applicable phase in ONE parallel TaskCreate batch (delivery-agent.md L222–225)."
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
    required: ["TaskCreate"]
    counts:
      TaskCreate: { min: 3 }
  semantic:
    - id: c4-parallel-taskcreate-batch
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        session against a non-trivial envelope, direct-prompt mode. The
        canonical tool_inputs view records each TaskCreate call in order.

        Contract C4 (delivery-agent.md L222–225): "Create a Task for each
        applicable phase in ONE parallel batch."

        PASS iff ALL of:
        1. At least 3 TaskCreate calls fire (covering at minimum phases P3,
           P4, P5 — additional P6/P7/P8 etc. are bonus, not required).
        2. The TaskCreate calls are issued in a SINGLE parallel batch — i.e.
           they appear consecutively in the chronological tool_use stream,
           with NO intervening tool_use of a different type (no Bash, no
           Write, no TaskUpdate) between any pair of TaskCreate calls. (If
           the platform groups them under one assistant message that's the
           ideal; consecutive same-tool calls also count.)
        3. Each TaskCreate's `subject` identifies a phase (e.g. contains
           `P0`/`P1`/`P3`/`P4`/`P5` etc., or `Phase` followed by a number).

        FAIL if: fewer than 3 TaskCreates fire; TaskCreates are interleaved
        with non-TaskCreate tool_uses; or subjects do not reference phases.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c4-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/sum-util
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C4
Working directory: /tmp/da-c4-workdir
MAIN_REPO_ROOT: /tmp/da-c4-workdir
MERGE_TARGET: main
Isolation: native worktree
Self-merge: yes
Chain: none
External resources: none

Add a typed utility function `sum(a: number, b: number): number` at src/sum.ts with a JSDoc comment, plus one Mocha unit test at test/sum.test.ts that asserts sum(2,3)===5 and sum(-1,1)===0. Done when src/sum.ts exports sum, test/sum.test.ts passes under `node --test test/sum.test.ts`, and a single commit lands on feat/sum-util.
```
