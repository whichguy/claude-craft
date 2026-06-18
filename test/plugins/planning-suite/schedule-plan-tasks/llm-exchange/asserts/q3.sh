#!/usr/bin/env bash
# Q3 asserter — pass conditions for the additive-conflict manual-resolve fixture.
#
# Pass when the captured orchestrator transcript shows:
#   1. The orchestrator detected MERGE_FAIL_REASON=retries_exhausted
#   2. The K-Option-2 probe ran and found all 3 conditions held
#   3. The python conflict resolver was invoked
#   4. The audit banner "[merge] manual-resolved" was printed
#   5. The cascade continued (a second downstream agent was dispatched)
#
# Fail otherwise — surface which condition failed so the operator can
# inspect the transcript for LLM drift.
#
# Usage: bash q3.sh <transcript-file>

set -u
TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: q3.sh <transcript-file>"
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

echo "Q3 — additive-conflict manual-resolve  ($TRANSCRIPT)"
check "retries_exhausted observed"  'MERGE_FAIL_REASON=retries_exhausted'
check "K-Option-2 probe ran"        'CONFLICT_FILES|Shared-registration'
check "resolver invoked"            'resolve-additive-conflict\.py'
check "audit banner printed"        '\[merge\] manual-resolved'
check "cascade continued"           'cascade dispatch|step 3b'
exit $fail
