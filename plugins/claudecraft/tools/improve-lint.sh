#!/usr/bin/env bash
# improve-lint.sh — discover + run path-scoped linters for improve-loop Phase 1.
#
# Subcommands:
#   discover --repo <path> [--force-refresh]
#   run      --repo <path> (--paths <p>… | --paths-file <f>) [--force-refresh]
#
# Exit codes:
#   0  pass or skipped (no paths / no matching tools)
#   1  lint failure (one or more tools non-zero)
#   2  usage / discover error
#
# Cache: <repo>/.git/improve-runs/lint-map.json (via improve-lint-discover.js)
# No network installs. Stdout = JSON summary; tool noise on stderr.
# Bash 3.2+ compatible (macOS /bin/bash).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVER_JS="${SCRIPT_DIR}/improve-lint-discover.js"
NODE_BIN="${NODE_BIN:-node}"

usage() {
  cat <<'EOF' >&2
Usage:
  improve-lint.sh discover --repo <path> [--force-refresh]
  improve-lint.sh run      --repo <path> (--paths <p>… | --paths-file <f>) [--force-refresh]
EOF
}

die() { local c="$1"; shift; printf '%s\n' "$*" >&2; exit "$c"; }

[[ -f "$DISCOVER_JS" ]] || die 2 "missing $DISCOVER_JS"
command -v "$NODE_BIN" >/dev/null 2>&1 || die 2 "node not found (set NODE_BIN)"

CMD="${1:-}"
[[ -n "$CMD" ]] || { usage; exit 2; }
shift || true

REPO=""
FORCE_REFRESH=0
PATHS=()
PATHS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="${2:-}"; shift 2 ;;
    --force-refresh) FORCE_REFRESH=1; shift ;;
    --paths)
      shift
      while [[ $# -gt 0 && "$1" != --* ]]; do PATHS+=("$1"); shift; done
      ;;
    --paths-file) PATHS_FILE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) PATHS+=("$1"); shift ;;
  esac
done

[[ -n "$REPO" ]] || { usage; exit 2; }
REPO="$(cd "$REPO" && pwd)"

discover_args=(discover --repo "$REPO")
if [[ "$FORCE_REFRESH" -eq 1 ]]; then
  discover_args+=(--force-refresh)
fi

if [[ "$CMD" == "discover" ]]; then
  exec "$NODE_BIN" "$DISCOVER_JS" "${discover_args[@]}"
fi

if [[ "$CMD" != "run" ]]; then
  usage
  exit 2
fi

if [[ -n "$PATHS_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # trim
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    PATHS+=("$line")
  done <"$PATHS_FILE"
fi

plan_args=(run-plan --repo "$REPO")
if [[ "$FORCE_REFRESH" -eq 1 ]]; then
  plan_args+=(--force-refresh)
fi
if [[ ${#PATHS[@]} -gt 0 ]]; then
  plan_args+=(--paths "${PATHS[@]}")
fi

PLAN_JSON="$("$NODE_BIN" "$DISCOVER_JS" "${plan_args[@]}")"
printf '%s\n' "$PLAN_JSON"

STATUS="$(printf '%s' "$PLAN_JSON" | "$NODE_BIN" -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(0,"utf8"));
process.stdout.write(j.status||"");
')"

if [[ "$STATUS" == "skipped" ]]; then
  exit 0
fi

# Run each linter via a small node driver (avoids bash 3.2 mapfile / array edge cases)
export IMPROVE_LINT_REPO="$REPO"
export IMPROVE_LINT_PLAN="$PLAN_JSON"
set +e
"$NODE_BIN" <<'NODE'
'use strict';
const { spawnSync } = require('child_process');
const plan = JSON.parse(process.env.IMPROVE_LINT_PLAN || '{}');
const repo = process.env.IMPROVE_LINT_REPO;
let fail = 0;
let n = 0;
for (const L of plan.linters || []) {
  n++;
  const cmd = L.cmd || [];
  if (!cmd.length) continue;
  const args = cmd.slice(1);
  if ((L.scope || 'paths') === 'paths') {
    for (const p of L.paths || []) args.push(p);
  }
  process.stderr.write(
    `improve-lint: running ${L.id} (scope=${L.scope || 'paths'}, paths=${(L.paths || []).length})\n`
  );
  const r = spawnSync(cmd[0], args, {
    cwd: repo,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.stdout) process.stderr.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    process.stderr.write(`improve-lint: FAIL ${L.id}\n`);
    fail = 1;
  } else {
    process.stderr.write(`improve-lint: PASS ${L.id}\n`);
  }
}
if (n === 0) process.exit(0);
process.exit(fail);
NODE
rc=$?
set -e
exit "$rc"
