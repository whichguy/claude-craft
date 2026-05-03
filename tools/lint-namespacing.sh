#!/usr/bin/env bash
# tools/lint-namespacing.sh — flag bare cross-bundle skill/command refs.
# A reference like /<name> is allowed only when the file's bundle owns <name>;
# cross-bundle refs MUST use /<plugin>:<name> form.
#
# Heuristic-based: catches the common bare-slash cases. False-positive prone
# in code blocks / regex examples — exemptions list at the bottom.
set -o pipefail  # not -e: grep returning 1 on no-match is expected
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# build name -> bundle map by scanning plugins/*/skills/*/SKILL.md and commands/*.md
declare -a NAMES BUNDLES
while IFS= read -r f; do
  bundle="$(echo "$f" | awk -F/ '{print $2}')"
  if [[ "$f" == */skills/*/SKILL.md ]]; then
    name="$(basename "$(dirname "$f")")"
  elif [[ "$f" == */commands/*.md ]]; then
    name="$(basename "$f" .md)"
  else
    continue
  fi
  NAMES+=("$name")
  BUNDLES+=("$bundle")
done < <(find plugins -path 'plugins/*/skills/*/SKILL.md' -o -path 'plugins/*/commands/*.md' 2>/dev/null)

bundle_of_name() {
  local q="$1" i
  for i in "${!NAMES[@]}"; do
    [ "${NAMES[$i]}" = "$q" ] && { echo "${BUNDLES[$i]}"; return; }
  done
}

# build alternation regex of all known names
ALT="$(printf '%s\n' "${NAMES[@]}" | sort -u | paste -sd'|' -)"
[ -z "$ALT" ] && { echo "no plugin names found"; exit 0; }

tmp_fails="$(mktemp)"
trap 'rm -f "$tmp_fails"' EXIT

# scan plugins/*.md for bare /<name> refs
LC_ALL=C grep -rnE "(^|[[:space:](\"'\`])/(${ALT})\b" --include='*.md' plugins/ 2>/dev/null \
  | while IFS=: read -r file line rest; do
      # extract the matched name
      name="$(echo "$rest" | LC_ALL=C grep -oE "/(${ALT})\b" | head -1 | sed 's|^/||')"
      [ -z "$name" ] && continue

      # skip case-pattern style /<name>* or /<name>)
      tail_char="$(echo "$rest" | LC_ALL=C grep -oE "/${name}." | head -1 | tail -c 2)"
      [ "$tail_char" = "*" ] && continue
      [ "$tail_char" = ")" ] && continue

      file_bundle="$(echo "$file" | awk -F/ '{print $2}')"
      callee_bundle="$(bundle_of_name "$name")"
      [ -z "$callee_bundle" ] && continue

      # skip self-defining files
      case "$file" in
        */${name}/SKILL.md|*/commands/${name}.md|*/agents/${name}.md) continue ;;
      esac
      # skip fixtures (they're example data, not real refs)
      case "$file" in
        */fixtures/*) continue ;;
      esac

      if [ "$file_bundle" != "$callee_bundle" ]; then
        echo "FAIL: $file:$line — bare /$name (cross-bundle: $file_bundle -> $callee_bundle); use /$callee_bundle:$name" | tee -a "$tmp_fails"
      fi
    done

if [ -s "$tmp_fails" ]; then
  echo
  echo "lint-namespacing FAILED"
  exit 1
fi
echo "ok: lint-namespacing PASSED"
exit 0
