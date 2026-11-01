#!/usr/bin/env bash
# tools/check-hermes-drift.sh [--strict] — does planning-suite's handler manifest still match hermes's?
#
# hermes-skills-marketplace is the canonical home of the plan-review handlers; claude-craft carries a
# hand-synced copy in plugins/planning-suite/handlers/ (procedure: the upstream SYNC.md, linked below).
# verify-sync.sh proves our files match OUR CANONICAL.sha256; this proves OUR manifest still equals
# the one hermes publishes.
#
# Hermes can move without any change here, so by default drift only WARNS — an upstream commit must
# not turn unrelated pushes red. It fails with --strict, which tools/ci.sh passes when the change
# under test touches the handlers (the moment drift could be introduced) and the weekly scheduled
# run always passes (so drift is surfaced even if nobody touches the handlers).
#
# Env: HERMES_REF (default main), HERMES_CANONICAL_URL (override, e.g. file:// for tests).
# Exit: 0 in sync, or drift in advisory mode | 1 stale or unreachable under --strict
#       77 hermes unreachable in advisory mode (skipped)

set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MINE="$ROOT/plugins/planning-suite/handlers/CANONICAL.sha256"
REF="${HERMES_REF:-main}"
URL="${HERMES_CANONICAL_URL:-https://raw.githubusercontent.com/whichguy/hermes-skills-marketplace/${REF}/plugins/plan-review/handlers/CANONICAL.sha256}"
SYNC_DOC="https://github.com/whichguy/hermes-skills-marketplace/blob/${REF}/plugins/plan-review/handlers/SYNC.md"

strict=0
[ "${1:-}" = "--strict" ] && strict=1

annotate() {  # annotate <error|warning> <message>
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::$1 title=hermes handler drift::$2"; else echo "$(echo "$1" | tr '[:lower:]' '[:upper:]'): $2"; fi
}

THEIRS="$(mktemp)"
trap 'rm -f "$THEIRS"' EXIT

# Advisory runs sit in the pre-push path, so they fail fast (worst case ~10 s); the weekly strict run can afford to retry.
if [ "$strict" -eq 1 ]; then tries=3; budget=20; else tries=1; budget=5; fi

if ! curl -fsS --retry "$tries" --retry-delay 2 --max-time "$budget" "$URL" -o "$THEIRS"; then
  if [ "$strict" -eq 1 ]; then
    annotate error "could not fetch the hermes manifest ($URL), so the staleness check could not run"
    exit 1
  fi
  annotate warning "could not fetch the hermes manifest ($URL) — skipping the staleness check"
  exit 77
fi

if diff -u "$THEIRS" "$MINE"; then
  echo "OK — planning-suite manifest matches hermes ($REF)."
  exit 0
fi

msg="planning-suite handlers are STALE vs hermes canonical ($REF). Re-sync per $SYNC_DOC"
if [ "$strict" -eq 1 ]; then annotate error "$msg"; exit 1; fi
annotate warning "$msg (advisory: this change does not touch the handlers)"
exit 0
