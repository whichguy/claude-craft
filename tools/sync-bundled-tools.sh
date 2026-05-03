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

# bundled_map: <source path under tools/> -> space-separated list of plugin names
# Add rows here as more tools are bundled. Keep this lean — duplication is the cost.
bundled_map() {
  cat <<'EOF'
tools/review-fix-bench.sh   review-bench
EOF
}

mode="${1:-sync}"

drift=0
while IFS=$'\t ' read -r src plugins; do
  [ -z "$src" ] && continue
  case "$src" in '#'*) continue ;; esac
  [ -f "$src" ] || { echo "WARN: source missing: $src"; continue; }
  for plugin in $plugins; do
    dst="plugins/$plugin/tools/$(basename "$src")"
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
done < <(bundled_map | tr -s ' \t' ' ' | sed 's/^ *//')

[ "$mode" = "--check" ] && exit "$drift"
exit 0
