#!/usr/bin/env bash
# tools/install-hooks.sh — point this clone at the tracked hooks in .githooks/.
#
# Why: git does not install hooks on clone, so a fresh clone (or a CI-agent checkout) has none.
# Setting core.hooksPath to the tracked directory means every worktree of this clone runs the
# hooks of ITS OWN checkout, so a branch that changes a hook is tested with that hook.
#
#   tools/install-hooks.sh            install (idempotent)
#   tools/install-hooks.sh --status   show what is active
#
# Hooks: pre-commit (secret scan + marketplace lints), pre-push (tools/ci.sh pre-push),
#        post-merge (security scan of pulled executables).

set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--status" ]; then
  echo "core.hooksPath = $(git -C "$ROOT" config --get core.hooksPath || echo '(unset → .git/hooks)')"
  for h in "$ROOT"/.githooks/*; do printf '  %-12s %s\n' "$(basename "$h")" "$([ -x "$h" ] && echo executable || echo 'NOT executable')"; done
  exit 0
fi

previous="$(git -C "$ROOT" config --get core.hooksPath || echo '(unset)')"
chmod +x "$ROOT"/.githooks/*
git -C "$ROOT" config core.hooksPath .githooks
echo "core.hooksPath: $previous -> .githooks"
echo "installed: $(ls "$ROOT/.githooks" | tr '\n' ' ')"
echo "bypass once: SKIP_PREPUSH=1 git push   |   git commit/push --no-verify"
