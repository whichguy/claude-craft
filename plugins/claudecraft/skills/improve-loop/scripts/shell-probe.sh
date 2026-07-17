#!/usr/bin/env bash
# shell-probe.sh — L3: verify shell + git usable for improve-loop plumbing.
#
# Exit codes:
#   0  shell, git, and repo usable
#   1  usage / missing --repo
#   2  git not executable
#   3  not a non-bare git worktree (or git command failed)
#   4  git worktree list failed
#
# Injectable: GIT_CMD (default: git)
set -euo pipefail

GIT_CMD="${GIT_CMD:-git}"
REPO=""

usage() {
  echo "usage: shell-probe.sh --repo <abs-or-rel-path>" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "unknown arg: $1" >&2
      usage
      ;;
  esac
done

[[ -n "$REPO" ]] || usage

if ! command -v "$GIT_CMD" >/dev/null 2>&1; then
  echo "shell-probe: git not found (GIT_CMD=$GIT_CMD)" >&2
  exit 2
fi

if ! "$GIT_CMD" -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "shell-probe: not inside a git worktree: $REPO" >&2
  exit 3
fi

bare="$("$GIT_CMD" -C "$REPO" rev-parse --is-bare-repository 2>/dev/null || echo true)"
if [[ "$bare" == "true" ]]; then
  echo "shell-probe: bare repository refused: $REPO" >&2
  exit 3
fi

if ! "$GIT_CMD" -C "$REPO" worktree list >/dev/null 2>&1; then
  echo "shell-probe: git worktree list failed: $REPO" >&2
  exit 4
fi

# one trivial shell check (spawn path)
true

echo "ok repo=$("$GIT_CMD" -C "$REPO" rev-parse --show-toplevel)"
exit 0
