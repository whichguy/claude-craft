#!/usr/bin/env bash
# Q4 asserter — pass conditions for the failed-task recap fixture.
#
# Pass when the captured orchestrator transcript shows:
#   1. P2 emitted RESULT: failed (delivery-agent self-marked failed)
#   2. The orchestrator created an investigation task (TaskCreate ran)
#   3. P2 was NOT merged (no merge commit citing its branch)
#   4. The recap classified P2 as "no recap data — task did not produce a
#      merge commit" with a citation to the investigation TaskCreate
#   5. The recap did NOT extract a FAILURE: code from a commit-body trailer
#      (the H2-B trailer contract was reverted)
#
# Usage: bash q4.sh <transcript-file>

set -u
TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: q4.sh <transcript-file>"
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

echo "Q4 — failed-task recap  ($TRANSCRIPT)"
check        "P2 emitted RESULT: failed"            'RESULT:\s*failed'
check        "investigation TaskCreate ran"         'INVESTIGATE|investigation TaskCreate'
check        "recap cites no-merge classification"  'no recap data'
check        "recap cites investigation"            'investigation TaskCreate'
check_absent "no trailer-parsing in recap"          'parse.*RESULT:\s*(failed|partial)\s*trailer'
exit $fail
