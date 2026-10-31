#!/usr/bin/env bash
# tools/scan-secrets.sh <file>... — secret-scan POLICY shared by .githooks/pre-commit and tools/ci.sh.
#
#   code files                                  → blocking: a hit makes this script exit 1
#   tests, fixtures, docs, examples             → warn only: they legitimately hold fake keys
#     (test/ tests/ fixtures/ docs/ examples/ directories, *.test.* *.spec.* *_test.* test_* files,
#      *.example, *.md, *.txt)                    (sanitizer tests, scanner fixtures)
# Matching is by path SEGMENT, not substring: the first version treated any path containing "test"
# as a test file, so latest-session.sh or contest.js were exempt from the gate.
#
# The pattern engine is tools/simple-secrets-scan.sh. It exits non-zero ONLY when its second
# argument is "true"; with "false" it is report-only and always exits 0. The pre-commit hook
# used to pass "false" and therefore could never block anything, so this wrapper always asks
# for "true" and applies the strict/lenient policy itself.
#
# Exit: 0 clean (warnings allowed) | 1 secret pattern in a code file.

set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/tools/simple-secrets-scan.sh"
[ -x "$ENGINE" ] || { echo "scan-secrets: $ENGINE not found or not executable" >&2; exit 2; }

gh_actions() { [ -n "${GITHUB_ACTIONS:-}" ]; }

blocked=0 warned=0 scanned=0
for f in "$@"; do
  [ -f "$f" ] || continue
  scanned=$((scanned + 1))
  "$ENGINE" "$f" true >/dev/null 2>&1 && continue   # clean
  case "$f" in
    test/*|*/test/*|tests/*|*/tests/*|fixtures/*|*/fixtures/*|example/*|*/example/*|examples/*|*/examples/*|docs/*|*/docs/*|\
    *.test.*|*.spec.*|*_test.*|test_*|*/test_*|*.example|*.md|*.txt)
      warned=$((warned + 1))
      if gh_actions; then echo "::warning file=$f::secret-like pattern in a test/doc file (allowed; use obviously fake values)"
      else echo "warn:    $f (secret-like pattern in a test/doc file — fine if it is a fake)"; fi ;;
    *)
      blocked=$((blocked + 1))
      if gh_actions; then echo "::error file=$f::secret-like pattern in a code file"
      else echo "BLOCKED: $f (secret-like pattern in a code file)"; fi ;;
  esac
done

echo "scan-secrets: $scanned files, $blocked blocking, $warned warning"
[ "$blocked" -eq 0 ]
