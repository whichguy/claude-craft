---
name: delivery-agent-C7-info-exclude
description: "C7 — delivery-agent registers `.task-plan.md` in worktree-local `info/exclude` via Bash BEFORE the first `.task-plan.md` Write (delivery-agent.md L188–196)."
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
    required: ["Agent", "Bash"]
    inputs:
      - { tool: Bash, must_match: { pattern: "info/exclude", case_sensitive: true } }
  semantic:
    - id: c7-info-exclude-precedes-first-task-plan-write
      view: everything
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the chronological event log of a delivery-agent
        run dispatched via the Agent tool. Subagent events appear interleaved
        with outer events; canonical tool_inputs lists every Bash command and
        Write file_path in order.

        Contract C7 (delivery-agent.md L188–196): before the first write to
        `.task-plan.md`, the subagent registers `.task-plan.md` in the
        worktree-local exclude file via a Bash command targeting
        `info/exclude` (the literal command block at L191–196 references
        `rev-parse --git-dir` to land in `<gitdir>/info/exclude`).

        PASS iff ALL of:
        1. Some Bash call in the run has a `command` field containing the
           substring `info/exclude`.
        2. That Bash call appears BEFORE the FIRST tool_use that writes to a
           path ending in `.task-plan.md` (Write or Edit).
        3. The Bash call appends or registers `.task-plan.md` in the exclude
           file (not just inspecting it). Look for redirection (`>>`),
           tee-style appending, or the canonical L191–196 snippet
           (`grep -qxF ... || echo ... >> "$EXCLUDE_FILE"`).

        FAIL if: no Bash references `info/exclude`; or the
        `info/exclude` Bash fires AFTER the first `.task-plan.md` write; or
        the Bash only reads/inspects the exclude file without modifying it.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

You are a harness. Follow these steps EXACTLY:

1. Run this Bash to set up a clean working repo:

```
WORKDIR=/tmp/da-c7-workdir
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
Task ID: T-C7
Working directory: /tmp/da-c7-workdir
MAIN_REPO_ROOT: /tmp/da-c7-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
