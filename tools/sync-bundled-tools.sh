#!/usr/bin/env bash
# Sync bundled tools from tools/ source-of-truth into each consuming plugin's
# tools/ dir. Plugin cache copies are read-only at runtime, so we ship a copy
# per plugin; this script keeps the copies byte-identical to the originals.
#
# Wire into pre-commit so the in-plugin copies cannot drift from tools/.
#
# Usage:
#   tools/sync-bundled-tools.sh            # sync (copy + git add changes)
#   tools/sync-bundled-tools.sh --check    # exit non-zero if any copy differs
set -eo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# bundled_map: <source path> -> "<dest-relative-to-plugin> <plugin1> <plugin2> ..."
# Source-of-truth lives in tools/ (single-file) or tools/shared-templates/<dir>/ (set of files).
# Each row: source path, then dest path relative to plugin root, then list of plugin names.
# Lean — duplication is the cost; only bundle what's actually consumed.
bundled_map() {
  cat <<'EOF'
tools/review-fix-bench.sh                                  tools/review-fix-bench.sh                  review-bench
tools/shared-templates/skills-shared/judge-pattern.md      skills/shared/judge-pattern.md             review-suite review-bench gas-suite planning-suite
tools/shared-templates/skills-shared/question-cross-reference.md  skills/shared/question-cross-reference.md  review-suite review-bench gas-suite planning-suite
tools/shared-templates/skills-shared/self-referential-protection.md  skills/shared/self-referential-protection.md  review-suite review-bench gas-suite planning-suite
tools/shared-templates/skills-shared/skill-authoring-conventions.md  skills/shared/skill-authoring-conventions.md  review-suite review-bench gas-suite planning-suite
EOF
}

mode="${1:-sync}"

drift=0
while read -r src dest plugins; do
  [ -z "$src" ] && continue
  case "$src" in '#'*) continue ;; esac
  [ -f "$src" ] || { echo "WARN: source missing: $src"; continue; }
  for plugin in $plugins; do
    dst="plugins/$plugin/$dest"
    if [ "$mode" = "--check" ]; then
      if ! cmp -s "$src" "$dst" 2>/dev/null; then
        echo "DRIFT: $dst differs from $src"
        drift=1
      fi
    else
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
      echo "synced: $src -> $dst"
    fi
  done
done < <(bundled_map | awk '{$1=$1; print}')

[ "$mode" = "--check" ] && exit "$drift"
exit 0
