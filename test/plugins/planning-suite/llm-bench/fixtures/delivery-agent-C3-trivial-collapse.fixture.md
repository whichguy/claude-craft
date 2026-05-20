---
name: delivery-agent-C3-trivial-collapse
description: "C3 — for trivial-isolation envelopes, L0a collapses to a single line and L1 is skipped; no phase TaskCreate calls fire (delivery-agent.md L287–296)."
model: claude-sonnet-4-6
timeout_seconds: 600
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
    counts:
      TaskCreate: { exact: 0 }
  semantic:
    - id: c3-trivial-collapsed-one-line-agent-selection
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        session against a trivial-isolation envelope, direct-prompt mode.

        Contract C3 (delivery-agent.md L287–296): for `Isolation: none
        (trivial)`, L0a collapses to a single `P<n>: <agent> — trivial
        single-phase task; skipping L1.`-style line and L1 (phase dependency
        wiring) is skipped entirely.

        PASS iff ALL of:
        1. The `## Agent selection` block is collapsed to ONE phase entry
           (e.g. `P2: general-purpose — trivial single-phase task; skipping
           L1.`) — NOT an enumeration of P0/P1/P3/P4/P5/etc.
        2. Zero phase TaskCreate calls fire. (Structurally asserted by
           tool_calls.counts.TaskCreate.exact: 0; this rubric checks the
           absence is by design — the collapsed-line shape — not because the
           agent crashed before L0.)
        3. The agent does not wire phase dependencies via TaskUpdate
           addBlockedBy/addBlocks.

        FAIL if: agent enumerates multiple phases in `## Agent selection`,
        calls TaskCreate for phases, or wires phase dependencies.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c3-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/user-registry
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C3
Working directory: /tmp/da-c3-workdir
MAIN_REPO_ROOT: /tmp/da-c3-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
