#!/usr/bin/env bash
# Q6 asserter — pass conditions for the synthesis-preamble OVERRIDES BODY fixture.
#
# Pass when the captured agent transcript shows:
#   1. Synthesis mode acknowledged in the agent's opening response
#   2. No inventory step ran (no `command -v clasp`, no MCP fork/clone)
#   3. No create/fork/clone primitive ran against [TARGET_SYSTEM]
#   4. Refs JSON written with the supplied sandbox_ref (not source_ref)
#   5. STATUS: success emitted
#
# Usage: bash q6.sh <transcript-file>

set -u
TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: q6.sh <transcript-file>"
  exit 2
fi

fail=0
check() {
  local label="$1" pattern="$2"
  if grep -qiE "$pattern" "$TRANSCRIPT"; then
    echo "  PASS  $label"
  else
    echo "  FAIL  $label   (pattern: $pattern)"
    fail=1
  fi
}
check_absent() {
  local label="$1" pattern="$2"
  if grep -qiE "$pattern" "$TRANSCRIPT"; then
    echo "  FAIL  $label   (must not contain: $pattern)"
    fail=1
  else
    echo "  PASS  $label"
  fi
}

echo "Q6 — synthesis preamble override  ($TRANSCRIPT)"
check        "synthesis mode acknowledged"        'synthesis mode|skipping steps 1|skip(ping)? Steps 1'
check_absent "no inventory step ran"              'command -v clasp|inventorying|mcp__mcp-gas-deploy__fork|mcp__mcp-gas-deploy__create'
check_absent "no create/fork/clone primitive"     'clasp create|fork.*scriptId|projects:create.*gas'
check        "refs json uses supplied sandbox_ref" 'AKfycSANDBOX_pre_existing'
check_absent "refs json did NOT use source_ref"    'sandbox_ref.*AKfycXYZ_production_script'
check        "STATUS: success emitted"            'STATUS:\s*success'
exit $fail
