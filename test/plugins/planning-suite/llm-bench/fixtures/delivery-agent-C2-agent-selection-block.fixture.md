---
name: delivery-agent-C2-agent-selection-block
description: "C2 — delivery-agent emits the `## Agent selection` declaration block as its first action with machine-parseable phase lines, BEFORE any Write/Edit/Bash/TaskCreate (L113–117, L273–283)."
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
  views:
    assistant_text:
      must_include:
        - { pattern: "(?m)^## Agent selection\\s*$", case_sensitive: true }
  semantic:
    - id: c2-agent-selection-block-shape-and-order
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        session under direct-prompt invocation.

        Contract C2 (delivery-agent.md L113–117 + L273–283): the agent's
        first emitted action is a `## Agent selection` declaration block,
        machine-parseable, naming one specialist agent per non-skipped phase
        with a justification. Must appear BEFORE any Write/Edit/Bash/
        TaskCreate tool_use.

        PASS iff ALL of:
        1. An assistant_text block opens with `## Agent selection` on its
           own line.
        2. The block body contains one or more `P<n>:` lines (e.g. `P4:
           general-purpose — ...`) or `P<n>.a:` / `P<n>.b:` lines for split
           phases. Each line names a real subagent type and includes a
           justification (text after `—` or `--`).
        3. The `## Agent selection` block precedes the first
           Write/Edit/Bash/TaskCreate tool_use. (Read-only existence-check
           Read on `.task-plan.md` permitted before the block per L139–140.)

        For trivial-isolation envelopes the block legitimately collapses to
        a single `P<n>: <agent> — trivial single-phase task; skipping L1.`
        line — that counts as PASS, since it still matches the
        machine-parseable shape.

        FAIL if: block missing, block has no `P<n>` body, block contains
        only prose with no machine-parseable phase lines, or any
        Write/Edit/Bash/TaskCreate fires before the block.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c2-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/user-registry
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C2
Working directory: /tmp/da-c2-workdir
MAIN_REPO_ROOT: /tmp/da-c2-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
