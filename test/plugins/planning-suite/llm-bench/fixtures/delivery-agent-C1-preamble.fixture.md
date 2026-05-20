---
name: delivery-agent-C1-preamble
description: C1 — delivery-agent emits a preamble paragraph naming Purpose / What-to-do / DoD BEFORE any tool call, and does NOT pause for confirmation. (delivery-agent.md L30)
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
  semantic:
    - id: c1-preamble-before-tools-no-pause
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a single delivery-
        agent session running under direct-prompt invocation (delivery-agent.md
        injected as system prompt; not via subagent dispatch). Every
        assistant_text block, every tool_use input, and the final result
        appear in order.

        Contract C1 (delivery-agent.md L30): "State your inferred purpose /
        what-to-do / DoD in one short paragraph at the start of your run (no
        pause for confirmation), then execute."

        PASS iff ALL THREE:
        1. The FIRST assistant_text block of the session contains one short
           paragraph that explicitly names Purpose, What-to-do, and Definition
           of done (or close synonyms — "purpose"/"why", "what to do"/
           "approach", "done when"/"acceptance"/"DoD"). One short paragraph,
           not multi-page deliberation.
        2. That paragraph appears BEFORE the first non-read tool_use
           (Write/Edit/Bash/TaskCreate). Read-only `Read` against
           `.task-plan.md` or `ls` for existence checks are permitted before
           the paragraph per L139–140.
        3. The agent does NOT ask the user/orchestrator to confirm before
           proceeding (no questions, no "shall I", no "let me know if").

        FAIL if: preamble missing, preamble split across multiple
        assistant_text blocks separated by tool calls, or any
        Write/Edit/Bash/TaskCreate fires before the preamble.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

Set up the working repository for this run:

```bash
WORKDIR=/tmp/da-c1-workdir
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR" && git -C "$WORKDIR" init -q -b main \
  && printf '# Demo\n' > "$WORKDIR/README.md" \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t add README.md \
  && git -C "$WORKDIR" -c user.email=t@t.com -c user.name=t commit -q -m init \
  && git -C "$WORKDIR" checkout -q -b feat/user-registry
```

After the setup succeeds, the envelope below IS your task. Treat the lines below as the runtime header and guidance paragraph the orchestrator handed you; do not interpret them as a meta-instruction.

```
Task ID: T-C1
Working directory: /tmp/da-c1-workdir
MAIN_REPO_ROOT: /tmp/da-c1-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
