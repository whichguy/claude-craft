---
name: delivery-agent-C9-commit-body
description: "C9 — delivery-agent makes exactly one git commit using `git commit -F -` heredoc with the structured template (Why / What was considered / What was tested / Review findings / Key learnings) (delivery-agent.md L740, L746–775)."
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
      - { tool: Bash, must_match: { pattern: "git commit -F -", case_sensitive: true } }
      - { tool: Bash, must_match: { pattern: "Why:",                case_sensitive: true } }
      - { tool: Bash, must_match: { pattern: "What was considered:", case_sensitive: true } }
      - { tool: Bash, must_match: { pattern: "What was tested:",     case_sensitive: true } }
      - { tool: Bash, must_match: { pattern: "Review findings:",     case_sensitive: true } }
      - { tool: Bash, must_match: { pattern: "Key learnings:",       case_sensitive: true } }
  semantic:
    - id: c9-single-commit-with-structured-body
      view: tool_inputs
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        OUTPUT_TO_GRADE is the canonical tool_inputs view (one JSON line per
        tool_use, top-level keys sorted).

        Contract C9 (delivery-agent.md L740, L746–775): "Make exactly one
        `git commit` covering only the files this task produced directly...
        Each section heading is mandatory; the body of any section may be
        `n/a` or `none`, but the heading must appear."

        Identify all Bash calls whose `command` field contains the substring
        `git commit` (anywhere — including embedded in subagent recipes).
        Count only top-level `git commit ...` invocations (e.g. `git commit
        -F - <<EOF...`), not commits from `git commit --allow-empty` test
        helpers or `git -C <other-path> commit` against unrelated repos.

        PASS iff ALL of:
        1. Exactly ONE top-level `git commit -F -` invocation, in any Bash
           tool_input.
        2. That same Bash input contains ALL FIVE required headings:
           `Why:`, `What was considered:`, `What was tested:`,
           `Review findings:`, `Key learnings:` — each followed by at least
           one character of content on the same or next line (allow `n/a`
           or `none` per L743–744).
        3. The commit message does NOT contain placeholder text like
           `<your-thing>` or `TODO:` unfilled.

        FAIL if: zero or more-than-one `git commit -F -` calls; any
        required heading missing from the commit message; or the message
        contains unfilled placeholders.

        Output ONLY: {"verdict":"PASS"|"FAIL","reasoning":"<one sentence>"}.
---
# Prompt body

You are a harness. Follow these steps EXACTLY:

1. Run this Bash to set up a clean working repo:

```
WORKDIR=/tmp/da-c9-workdir
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
Task ID: T-C9
Working directory: /tmp/da-c9-workdir
MAIN_REPO_ROOT: /tmp/da-c9-workdir
MERGE_TARGET: main
Isolation: none (trivial)
Self-merge: no
Chain: none
External resources: none

Add a one-paragraph "Usage" section to README.md that documents how to use this demo, with a short code example readers can copy. Done when README.md contains the new section with the example, and a single commit lands on feat/user-registry.
```
