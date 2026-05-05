#!/bin/bash
# wiki-bump-access.sh — wrapper for wiki_bump_access from wiki-common.sh.
# Used by skills (which can't conveniently source the library) to record an
# access on a wiki entity page. Hooks should source wiki-common.sh directly.
#
# Usage:  bash wiki-bump-access.sh <abs_page_path> [<abs_page_path> ...]
# Exit:   always 0 (errors are silent — bumping is a best-effort signal).

set +e

# Resolve wiki-common.sh: prefer ${CLAUDE_PLUGIN_ROOT} (set by Claude Code in
# skill/hook context); fall back to a path relative to this file.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/handlers/wiki-common.sh" ]; then
  COMMON="${CLAUDE_PLUGIN_ROOT}/handlers/wiki-common.sh"
else
  HERE=$(cd "$(dirname "$0")" 2>/dev/null && pwd)
  COMMON="$HERE/../handlers/wiki-common.sh"
fi

[ -f "$COMMON" ] || exit 0
. "$COMMON"

for page in "$@"; do
  wiki_bump_access "$page" 2>/dev/null
done

exit 0
