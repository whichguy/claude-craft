---
name: smoke-echo
description: Smoke test — Bash echo + final-result format. Exercises every V2 condition family (run.*, views.*, tool_calls.*, tool_results.*, result.*, semantic).
model: claude-haiku-4-5-20251001
timeout_seconds: 90
permission_mode: bypassPermissions
allowed_tools: Bash Read
append_system_prompt: ""
runs: 1
quorum: majority
pass_conditions:
  run:
    must_succeed: true
    max_duration_ms: 90000
    max_parse_errors: 0
  views:
    tool_inputs:
      must_include:
        - { pattern: "harness-smoke-token-abc", case_sensitive: true }
    everything:
      must_not_include:
        - { pattern: "command -v clasp",         case_sensitive: false }
  tool_calls:
    required:  ["Bash"]
    forbidden: ["WebFetch", "WebSearch"]
    counts:
      Bash: { exact: 1 }
    inputs:
      - { tool: Bash, must_match: { pattern: "\"command\":\"echo ", case_sensitive: true } }
  tool_results:
    all_succeeded: true
    per_tool:
      Bash: { must_succeed: true }
  result:
    must_match:     { pattern: "STATUS:\\s*OK",   case_sensitive: true }
    must_not_match: { pattern: "STATUS:\\s*FAIL", case_sensitive: true }
  semantic:
    - id: produces-valid-status-block
      view: result
      judge_model: claude-haiku-4-5-20251001
      rubric: |
        The output must contain a single line of the form "STATUS: OK".
        - PASS if a STATUS line is present and its value indicates success.
        - FAIL if missing, malformed, or indicates failure.
        Output ONLY a JSON object: {"verdict": "PASS"|"FAIL", "reasoning": "<one sentence>"}.
---
# Prompt body

You are a smoke-test target for an LLM harness. Follow these steps EXACTLY:

1. Use the Bash tool ONCE to run: `echo harness-smoke-token-abc`
2. After the tool returns, output a single final line with the literal text:

STATUS: OK

Do not output anything else after that line. Do not use the Read or Write tools.
