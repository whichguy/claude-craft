#!/usr/bin/env bash
# regen-phase-index.sh — regenerate the PHASE INDEX comment in skills/review-plan/SKILL.md
# Greps canonical `<!-- PHASE <id> — <name> ... -->` markers and rewrites the
# `<!-- PHASE INDEX: ... -->` line in-place.
#
# Usage:
#   tools/regen-phase-index.sh           # rewrite in place
#   tools/regen-phase-index.sh --check   # exit 1 if rewrite would change file (dry run)
set -eo pipefail

SKILL="${SKILL_PATH:-plugins/review-suite/skills/review-plan/SKILL.md}"
[[ -f "$SKILL" ]] || { echo "regen-phase-index: missing $SKILL" >&2; exit 1; }

# Build "id~LINE | id~LINE | ..." from canonical markers.
# Match: <!-- PHASE <id> — ...   (em-dash U+2014, after the id, with optional whitespace)
build_index() {
  awk '
    /^[[:space:]]*<!-- PHASE [0-9][0-9a-z.]*[[:space:]]+—/ {
      # capture id (the token after "PHASE ", e.g. "4.1", "3c.5")
      match($0, /<!-- PHASE [0-9][0-9a-z.]*/)
      id = substr($0, RSTART + 11, RLENGTH - 11)
      printf "%s%s~%d", (n++ ? " | " : ""), id, NR
    }
    END { print "" }
  ' "$SKILL"
}

idx="$(build_index)"
[[ -n "$idx" ]] || { echo "regen-phase-index: no canonical PHASE markers found in $SKILL" >&2; exit 1; }

new_line="<!-- PHASE INDEX: ${idx} -->"

# Locate existing PHASE INDEX line.
existing_lineno="$(grep -nE '^<!-- PHASE INDEX: ' "$SKILL" | head -1 | cut -d: -f1 || true)"
[[ -n "$existing_lineno" ]] || { echo "regen-phase-index: no existing PHASE INDEX line in $SKILL" >&2; exit 1; }

existing_line="$(sed -n "${existing_lineno}p" "$SKILL")"

if [[ "$1" == "--check" ]]; then
  if [[ "$existing_line" == "$new_line" ]]; then
    exit 0
  else
    echo "regen-phase-index: PHASE INDEX is stale." >&2
    echo "  current:  $existing_line" >&2
    echo "  expected: $new_line" >&2
    exit 1
  fi
fi

if [[ "$existing_line" == "$new_line" ]]; then
  exit 0  # idempotent no-op
fi

# In-place rewrite of just that line. Use a tmp file to avoid sed -i portability issues.
tmp="$(mktemp)"
awk -v ln="$existing_lineno" -v new="$new_line" 'NR==ln {print new; next} {print}' "$SKILL" > "$tmp"
mv "$tmp" "$SKILL"
echo "regen-phase-index: updated $SKILL line $existing_lineno"
