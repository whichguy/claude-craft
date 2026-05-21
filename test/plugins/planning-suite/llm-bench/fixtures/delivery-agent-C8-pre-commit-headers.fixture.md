---
name: delivery-agent-C8-pre-commit-headers
description: "C8 — delivery-agent emits `## Scope-drift` and `## Assumptions to verify` headers immediately before the `git commit` invocation (delivery-agent.md L637–736)."
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
        - { pattern: "(?:^|\\n)## Scope-drift[ \\t]*(?:\\n|$)", case_sensitive: true }
        - { pattern: "(?:^|\\n)## Assumptions to verify[ \\t]*(?:\\n|$)", case_sensitive: true }
  tool_calls:
    required: ["Agent"]
  semantic:
    - id: c8-pre-commit-headers-precede-commit
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        run dispatched via the Agent tool. The agent's final return message
        bubbles up to the outer session as the Agent tool's result content
        and is also captured in the terminal `result` event of this stream.

        Contract C8 (delivery-agent.md L637–736): "Three emissions are
        required immediately before the `git commit` call... `## Scope-
        drift`, `## Assumptions to verify`, and (when guidance demands)
        `## Citation gap`." Empty cases must still emit the heading + `none`.

        Note for this fixture: the envelope DOES NOT demand citations
        (no `cite|citation|Rev. Proc.|IRC §|RFC|ISO` references), so
        `## Citation gap` is not required. Only `## Scope-drift` and
        `## Assumptions to verify` are mandatory.

        PASS iff ALL of:
        1. Both `## Scope-drift` and `## Assumptions to verify` headings
           appear in OUTPUT_TO_GRADE (in subagent-dispatch mode they surface
           via the Agent tool's final response, captured in both
           tool_outputs and the terminal result).
        2. Each heading is followed either by `none` or by a substantive
           one-line declaration (not left empty).
        3. No `git commit` invocation appears in any Bash tool_input BEFORE
           both headers have been emitted. (In subagent-dispatch mode the
           headers come back in the final result message, AFTER the commit
           ran inside the subagent — that's still PASS because the contract
           is about emission ordering inside the subagent, and the subagent
           DID emit them before the commit per its prompt; the surface here
           is the final message which contains both.)

        FAIL if: either heading is missing from OUTPUT_TO_GRADE; or the
        headers appear without `none` or content beneath them.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

You are a harness. Follow these steps EXACTLY:

1. Run this Bash to set up a clean working repo:

```
WORKDIR=/tmp/da-c8-workdir
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
Task ID: T-C8
Working directory: /tmp/da-c8-workdir
MAIN_REPO_ROOT: /tmp/da-c8-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
