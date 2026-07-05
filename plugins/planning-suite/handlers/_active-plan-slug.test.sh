#!/usr/bin/env bash
# Regression suite for _active-plan-slug.sh. Run: ./_active-plan-slug.test.sh
set -u
H="$(cd "$(dirname "$0")" && pwd)/_active-plan-slug.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
check() { [ "$3" = "$2" ] && echo "PASS $1" || { echo "FAIL $1 (want $2, got $3)"; fails=$((fails+1)); }; }
hook_input() { python3 -c "import json,sys; print(json.dumps({'transcript_path': sys.argv[1]}))" "$1"; }
shell_slug() { printf '%s' "$1" | sed 's/[^A-Za-z0-9._-]/-/g' | cut -c1-64; }

# shellcheck source=_active-plan-slug.sh
. "$H"

TR="$T/transcript.jsonl"

raw='my plan: review/ready?'
printf '%s\n%s\n' \
  '{"type":"event"}' \
  "$(python3 -c "import json,sys; print(json.dumps({'slug': sys.argv[1]}))" "$raw")" > "$TR"
resolve_active_slug "$(hook_input "$TR")"
check sanitize-special-chars "$(shell_slug "$raw")" "$ACTIVE_SLUG"

raw='abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij-tail!'
printf '%s\n%s\n' \
  '{"slug":"older"}' \
  "$(python3 -c "import json,sys; print(json.dumps({'slug': sys.argv[1]}))" "$raw")" > "$TR"
resolve_active_slug "$(hook_input "$TR")"
check truncate-over-64 "$(shell_slug "$raw")" "$ACTIVE_SLUG"

printf '%s\n%s\n' \
  '{"type":"event"}' \
  '{"slug":""}' > "$TR"
resolve_active_slug "$(hook_input "$TR")"
check empty-or-absent-slug "" "$ACTIVE_SLUG"

echo; [ "$fails" -eq 0 ] && echo "ALL PASS" || echo "$fails FAILURE(S)"; exit "$fails"
