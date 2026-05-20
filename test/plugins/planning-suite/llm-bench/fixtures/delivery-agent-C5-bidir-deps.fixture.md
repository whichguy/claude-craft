---
name: delivery-agent-C5-bidir-deps
description: "C5 — for every phase dependency pair, delivery-agent calls TaskUpdate in BOTH directions (addBlockedBy on downstream AND addBlocks on upstream). (delivery-agent.md L328–332)"
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
    counts:
      TaskUpdate: { min: 4 }
  semantic:
    - id: c5-bidirectional-dependency-wiring
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        session under direct-prompt invocation. Canonical tool_inputs lists
        every TaskUpdate call's args (sorted top-level keys).

        Contract C5 (delivery-agent.md L328–332): "For every dependency
        pair, call BOTH directions: TaskUpdate({ taskId: downstream,
        addBlockedBy: [upstream] }) AND TaskUpdate({ taskId: upstream,
        addBlocks: [downstream] })."

        Read every TaskUpdate call in OUTPUT_TO_GRADE.
        - Build set A = pairs `(downstream, upstream)` from calls with
          `addBlockedBy: [<upstream>]`, downstream = the taskId arg.
        - Build set B = pairs `(downstream, upstream)` from calls with
          `addBlocks: [<downstream>]`, upstream = the taskId arg.

        PASS iff:
        1. A is non-empty (i.e. the agent wires SOME dependencies — at least
           one `addBlockedBy` call fires; ditto B).
        2. For EVERY pair in A there is a matching pair in B (and
           vice-versa). The two sets are equal.
        3. No unpaired addBlockedBy without its addBlocks counterpart, and
           no unpaired addBlocks without its addBlockedBy counterpart.

        Allow for slight reordering — pairs need not be issued consecutively.

        FAIL if: any unpaired edge; or zero TaskUpdate wiring calls (the
        agent never wired phase deps).

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c5-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/sum-util
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C5
Working directory: /tmp/da-c5-workdir
MAIN_REPO_ROOT: /tmp/da-c5-workdir
MERGE_TARGET: main
Isolation: native worktree
Self-merge: yes
Chain: none
External resources: none

Add a typed utility function `sum(a: number, b: number): number` at src/sum.ts with a JSDoc comment, plus one Mocha unit test at test/sum.test.ts that asserts sum(2,3)===5 and sum(-1,1)===0. Done when src/sum.ts exports sum, test/sum.test.ts passes under `node --test test/sum.test.ts`, and a single commit lands on feat/sum-util.
```
