#!/usr/bin/env bash
# S1 asserter — pass conditions for the CWD-deploy / swap_and_restore fixture.
#
# Pass when the captured delivery-agent transcript shows:
#   1. swap_and_restore helper definition or sourcing before any deploy
#   2. Deploy invocation calls swap_and_restore .clasp.json .sandbox-overlay/.clasp.json
#   3. clasp push ran after swap_and_restore (single &&-chained line)
#   4. Post-deploy `git status --porcelain .clasp.json` is empty (no leak)
#
# Fail if the agent:
#   - Wrote its own bespoke `.clasp.json.preflight-bak` trap snippet
#   - Committed .clasp.json with the sandbox scriptId
#
# Usage: bash s1.sh <transcript-file>

set -u
TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: s1.sh <transcript-file>"
  exit 2
fi

fail=0
check() {
  local label="$1" pattern="$2"
  if grep -qE "$pattern" "$TRANSCRIPT"; then
    echo "  PASS  $label"
  else
    echo "  FAIL  $label   (pattern: $pattern)"
    fail=1
  fi
}
check_absent() {
  local label="$1" pattern="$2"
  if grep -qE "$pattern" "$TRANSCRIPT"; then
    echo "  FAIL  $label   (must not contain: $pattern)"
    fail=1
  else
    echo "  PASS  $label"
  fi
}

echo "S1 — CWD deploy uses swap_and_restore  ($TRANSCRIPT)"
check        "swap_and_restore defined or sourced" 'swap_and_restore\(\)|source.*deploy-helpers|\..*deploy-helpers'
check        "deploy uses helper"                  'swap_and_restore \.clasp\.json'
check        "clasp push ran after helper"         'swap_and_restore .*clasp push|swap_and_restore.*&&.*clasp push'
check        "post-deploy status empty"            'git status --porcelain \.clasp\.json'
check_absent "no bespoke trap snippet"             '\.clasp\.json\.preflight-bak'
check_absent "no sandbox scriptId leak"            'AKfycSANDBOX_test_target.*\.clasp\.json|\.clasp\.json.*AKfycSANDBOX_test_target'
exit $fail
