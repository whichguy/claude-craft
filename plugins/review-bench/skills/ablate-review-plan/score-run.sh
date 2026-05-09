#!/usr/bin/env bash
# score-run.sh — extract verdict tier + optional concept hit from a single review-plan run output.
#
# Usage:
#   score-run.sh --output <run-output.md> [--concept-regex <pcre>] [--verdict-only]
#
# Stdout (TSV, one line):
#   <verdict>\t<concept_hit:0|1>\t<file>
#
# verdict ∈ {PASS, NEEDS_UPDATE, NOT_READY, UNKNOWN}.
# Tie precedence within the scanned tail: NOT_READY > NEEDS_UPDATE > PASS.
# Returns exit 2 on UNKNOWN — caller decides whether to retry.

set -o pipefail
shopt -s nullglob

OUTPUT=""
CONCEPT=""
VERDICT_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --output)         OUTPUT="$2"; shift 2 ;;
    --concept-regex)  CONCEPT="$2"; shift 2 ;;
    --verdict-only)   VERDICT_ONLY=1; shift ;;
    *) echo "score-run.sh: unknown arg: $1" >&2; exit 64 ;;
  esac
done

if [ -z "$OUTPUT" ] || [ ! -f "$OUTPUT" ]; then
  echo "score-run.sh: --output <file> required and must exist" >&2
  exit 64
fi

# Verdict tier — scan last 50 lines, return strongest (NOT_READY > NEEDS_UPDATE > PASS).
TAIL=$(tail -n 50 "$OUTPUT")
verdict="UNKNOWN"
if echo "$TAIL" | grep -Eqi '\bNOT[ _]READY\b'; then
  verdict="NOT_READY"
elif echo "$TAIL" | grep -Eqi '\bNEEDS[ _]UPDATE\b'; then
  verdict="NEEDS_UPDATE"
elif echo "$TAIL" | grep -Eqi '\bPASS\b'; then
  verdict="PASS"
fi

concept_hit=0
if [ "$VERDICT_ONLY" -eq 0 ] && [ -n "$CONCEPT" ]; then
  if grep -Eqi -- "$CONCEPT" "$OUTPUT"; then
    concept_hit=1
  fi
fi

printf '%s\t%s\t%s\n' "$verdict" "$concept_hit" "$OUTPUT"
[ "$verdict" = "UNKNOWN" ] && exit 2
exit 0
