---
name: delivery-agent-C6-task-plan-updates
description: "C6 — delivery-agent writes `.task-plan.md` at run start and Edits it at each phase transition (delivery-agent.md L131–137, L142–182)."
model: claude-sonnet-4-6
timeout_seconds: 600
permission_mode: bypassPermissions
allowed_tools: "Bash Read Write Edit Glob Grep TaskCreate TaskUpdate TaskGet TaskList Agent ToolSearch Task"
append_system_prompt: ""

runs: 3
quorum: majority

pass_conditions:
  run:
    must_succeed: true
    max_parse_errors: 0
  tool_calls:
    required: ["Agent"]
    counts:
      Write: { min: 1 }
      Edit: { min: 1 }
    inputs:
      - { tool: Write, must_match: { pattern: "\\.task-plan\\.md", case_sensitive: true } }
      - { tool: Edit,  must_match: { pattern: "\\.task-plan\\.md", case_sensitive: true } }
  semantic:
    - id: c6-task-plan-edits-at-transitions-not-batched
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        run dispatched via the Agent tool. Subagent events surface with
        parent_tool_use_id != null. The canonical tool_inputs view shows
        every Write and Edit call's file_path + content.

        Contract C6 (delivery-agent.md L131–182): "A single `Edit` per
        transition. Do not batch across phases — write at each transition
        so a context reset recovers the latest state."

        PASS iff ALL of:
        1. At least one Write to a path ending in `.task-plan.md` (the
           initial journal creation).
        2. At least one Edit to a path ending in `.task-plan.md` (a phase
           transition update).
        3. The Edit(s) to `.task-plan.md` are interleaved with OTHER work
           tool_uses (Bash, other Edits, etc.) — i.e. NOT all stacked at the
           end after every other tool call completed. Specifically: between
           the first `.task-plan.md` Write and the LAST `.task-plan.md` Edit,
           at least one non-`.task-plan.md` tool_use must appear.

        FAIL if: no `.task-plan.md` Write; no `.task-plan.md` Edit; or all
        `.task-plan.md` Edits cluster at the very end of the run with no
        other tool_uses between them and the initial Write.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

You are a harness. Follow these steps EXACTLY:

1. Run this Bash to set up a clean working repo:

```
WORKDIR=/tmp/da-c6-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/user-registry \
  && echo OK
```

2. Use the Agent tool with `subagent_type: "planning-suite:delivery-agent"` and the envelope below as the prompt, verbatim. (Claude Code's underlying tool name for subagent dispatch is `Agent`; some UIs surface it as `Task`. Use whichever name your tool list contains.)

3. After the Agent returns, print its full final output verbatim on its own block, then stop. Do not edit files yourself.

ENVELOPE (paste verbatim into the Agent prompt):

```
Task ID: T-C6
Working directory: /tmp/da-c6-workdir
MAIN_REPO_ROOT: /tmp/da-c6-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
