---
name: delivery-agent-C10-status-block
description: "C10 — delivery-agent's final emission is the status block with all six fields, and DISPATCHED is always `none` (delivery-agent.md L820–829, L837)."
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
  views:
    result:
      must_include:
        - { pattern: "(?:^|\\n)RESULT:[ \\t]*(complete|partial|failed)\\b", case_sensitive: true }
        - { pattern: "(?:^|\\n)WORK:",                                      case_sensitive: true }
        - { pattern: "(?:^|\\n)INCOMPLETE:",                                case_sensitive: true }
        - { pattern: "(?:^|\\n)FAILURE:",                                   case_sensitive: true }
        - { pattern: "(?:^|\\n)ARTIFACT:",                                  case_sensitive: true }
        - { pattern: "(?:^|\\n)DISPATCHED:[ \\t]*none\\b",                  case_sensitive: true }
  tool_calls:
    required: ["Agent"]
  semantic:
    - id: c10-status-block-is-final-emission
      view: result
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the terminal result event's `.result` string for
        a delivery-agent run dispatched via the Agent tool. The agent's final
        message bubbles up as the Agent tool's return content and is
        captured here.

        Contract C10 (delivery-agent.md L820–829, L837): the run's final
        output is the six-line status block:
            RESULT:      <complete|partial|failed>
            WORK:        <one line>
            INCOMPLETE:  <one line; "none" when RESULT: complete>
            FAILURE:     <FAILURE enum or "none">
            ARTIFACT:    <path or "none">
            DISPATCHED:  none
        DISPATCHED is ALWAYS `none`.

        PASS iff ALL of:
        1. All six field labels appear as line-starts somewhere in
           OUTPUT_TO_GRADE.
        2. The DISPATCHED line's value is exactly `none` (case-sensitive),
           not e.g. a task-id list.
        3. The status block is at or near the END of OUTPUT_TO_GRADE — no
           substantive free-text beyond the block, beyond optional
           formatting/agent-id metadata lines.

        FAIL if: any required field missing; DISPATCHED value is not
        exactly `none`; or significant free-text follows the status block.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

You are a harness. Follow these steps EXACTLY:

1. Run this Bash to set up a clean working repo:

```
WORKDIR=/tmp/da-c10-workdir
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
Task ID: T-C10
Working directory: /tmp/da-c10-workdir
MAIN_REPO_ROOT: /tmp/da-c10-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
