#!/usr/bin/env bash
# tools/ci.sh — the single definition of "CI passes" for claude-craft.
#
# GitHub Actions (.github/workflows/ci.yml), the pre-push hook and `npm run ci`
# all call this script, so a green local run means a green remote run and the
# list of checks cannot drift between them.
#
#   tools/ci.sh static                  lints, syntax, policy checks        (~15s)
#   tools/ci.sh test                    test shards, run concurrently       (~60s)
#   tools/ci.sh all                     static, then test            (default)
#   tools/ci.sh pre-push [--base REF]   static + only the shards the diff touches
#   tools/ci.sh run <check>...          run named checks/shards only
#   tools/ci.sh list                    list checks and shards
#
# Env:
#   CI_BASE=<ref>    diff base for changed-file checks (secrets, version bump, pre-push)
#   CI_SKIP="a b"    checks/shards to skip, reported as SKIP (e.g. a tool the machine lacks)
#   CI_SHARDS="a b"  run only these test shards (the workflow splits shards across VMs on 3-core macOS)
#   CI_OUT=<dir>     log directory (default: test-results/ci, gitignored)
#   CI_KEEP_HOME=1   do not isolate HOME (default: a throwaway HOME + git identity)
#   CI_VERBOSE=1     print passing checks' logs too (always grouped on GitHub Actions)
#
# Exit: 0 all passed (or skipped) | 1 a check failed | 2 usage/preflight error.
# Style: bash 3.2 compatible (macOS /bin/bash), pipefail, deliberately no `set -e`
# (a failing check must not abort the others), cleanup via trap.

set -o pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2

OUT="${CI_OUT:-$ROOT/test-results/ci}"
SKIP_RC=77   # a check exits 77 to say "not applicable here" (automake convention)

STATIC_CHECKS="marketplace-lint namespacing-lint marketplace-smoke handler-sync hermes-drift plugin-versions improve-loop-contract harness-smoke shellcheck python-syntax tracked-artifacts secrets version-bump"
SHARDS="core claudecraft shell"

# ───────────────────────── environment isolation ─────────────────────────
# Tests must behave the same on a laptop and on a runner. Two real leaks bit us:
# CLAUDE_PLAN_WORKTREE_GATE=0 in a developer shell silently disabled the gate
# under test (14 false failures), and handler tests write under ~/.claude.
CI_TMP=""
cleanup() { [ -n "$CI_TMP" ] && rm -rf "$CI_TMP"; }
trap cleanup EXIT

isolate_env() {
  local v scrubbed=""
  # compgen+grep -E, not sed: BSD sed (macOS) has no `\|`, which once made this a silent no-op.
  for v in $(compgen -e | grep -E '^(CLAUDE_PLAN|CODEX_)'); do scrubbed="$scrubbed $v"; unset "$v"; done
  [ -n "$scrubbed" ] && echo "ci.sh: ignoring from your shell (they change what the tests measure):$scrubbed"
  export PYTHONDONTWRITEBYTECODE=1
  if [ -z "${CI_KEEP_HOME:-}" ]; then
    CI_TMP="$(mktemp -d)"
    export HOME="$CI_TMP/home"
    mkdir -p "$HOME"
    # A real HOME's global git config must not decide test outcomes either.
    printf '[user]\n\temail = ci@example.com\n\tname = ci\n[init]\n\tdefaultBranch = main\n' > "$HOME/.gitconfig"
    export GIT_CONFIG_NOSYSTEM=1
  fi
}

# ───────────────────────── changed-file helpers ─────────────────────────
# Base for "what changed": explicit CI_BASE, else the parent commit.
resolve_base() {
  local b="${CI_BASE:-}"
  case "$b" in ""|0000000000000000000000000000000000000000) b="HEAD~1" ;; esac
  git rev-parse --verify --quiet "$b^{commit}" >/dev/null 2>&1 || b="HEAD~1"
  git rev-parse --verify --quiet "$b^{commit}" >/dev/null 2>&1 || b=""
  printf '%s' "$b"
}

# NUL-separated changed paths (added/copied/modified/renamed) between base and HEAD.
changed_files_z() {
  local base; base="$(resolve_base)"
  if [ -n "$base" ]; then
    git diff -z --name-only --diff-filter=ACMR "$base" HEAD
  else
    git ls-files -z
  fi
}

# ───────────────────────────── static checks ─────────────────────────────
check_marketplace_lint()  { ./tools/lint-marketplace.sh; }
check_namespacing_lint()  { ./tools/lint-namespacing.sh; }
check_marketplace_smoke() { ./tools/e2e-marketplace-smoke.sh; }
check_handler_sync()      { bash plugins/planning-suite/handlers/verify-sync.sh; }
check_plugin_versions()   { python3 tools/check-plugin-versions.py; }

# Staleness vs hermes's canonical manifest depends on a mutable ref in ANOTHER repo, so it only
# blocks when this change touches the handlers (where drift could be introduced). Otherwise it
# warns; the weekly run in .github/workflows/scheduled.yml enforces it unconditionally.
check_hermes_drift() {
  local base; base="$(resolve_base)"
  if [ -n "$base" ] && ! git diff --quiet "$base" HEAD -- plugins/planning-suite/handlers tools/check-hermes-drift.sh; then
    ./tools/check-hermes-drift.sh --strict
  else
    ./tools/check-hermes-drift.sh
  fi
}

check_improve_loop_contract() {
  local skill=plugins/claudecraft/skills/improve-loop out
  # Pins only against the source tree — never default to a Live copy under $HOME.
  IMPROVE_LOOP_PARITY=0 node "$skill/scripts/contract-check.js" \
    --skill-dir "$PWD/$skill" --mirror "$PWD/$skill/SKILL.md" || return 1
  node "$skill/scripts/package-parity.js" --self-test || return 1
  # A self-peer must hard-fail (no false green).
  out=$(node "$skill/scripts/package-parity.js" --skill-dir "$PWD/$skill" --peer "$PWD/$skill" --json 2>/dev/null || true)
  case "$out" in
    *peer_is_self*) echo "OK peer_is_self hard-fail" ;;
    *) echo "expected peer_is_self, got: $out"; return 1 ;;
  esac
}

check_harness_smoke() {
  local dir=plugins/review-bench/skills/ablate-review-plan result verdict
  result="$(bash "$dir/score-run.sh" --output "$dir/fixtures/ci-smoke.md" --verdict-only)"
  verdict="${result%%$'\t'*}"
  echo "score-run.sh verdict: $verdict"
  [ "$verdict" = "PASS" ] || { echo "expected PASS from canned fixture"; return 1; }
}

# Shipped shell runs on users' machines (hooks fire on every tool call), so
# syntax-level errors block. Warnings are reported but do not, to avoid a
# flag-day cleanup of pre-existing findings. Fixtures are deliberately bad code.
check_shellcheck() {
  if ! command -v shellcheck >/dev/null 2>&1; then
    echo "shellcheck not installed"
    [ -n "${GITHUB_ACTIONS:-}" ] && return 1
    return "$SKIP_RC"
  fi
  local list="$CI_TMP/shellcheck.list" n warn
  { git ls-files -z -- '*.sh' ':!test/fixtures' ':!test/benchmarks'
    git ls-files -z -- '.githooks/*'; } > "$list"
  n=$(tr -cd '\0' < "$list" | wc -c | tr -d ' ')
  xargs -0 shellcheck --severity=error --external-sources < "$list" || return 1
  echo "shellcheck: $n files clean at error severity"
  warn=$(xargs -0 shellcheck --severity=warning --external-sources --format=gcc < "$list" 2>/dev/null | wc -l | tr -d ' ')
  echo "shellcheck: $warn warning-level findings (non-blocking, pre-existing)"
}

# Handlers/tools run on every user's machine; macOS still ships Python 3.9.
check_python_syntax() {
  python3 - <<'PY'
import ast, subprocess, sys
raw = subprocess.check_output(["git", "ls-files", "-z", "--", "plugins/*.py"]).decode()
skip = ("/fixtures/", "/tests/", "/test/")
bad = 0
files = [f for f in raw.split("\0") if f and not any(s in "/" + f for s in skip)]
for f in files:
    try:
        ast.parse(open(f, encoding="utf-8").read(), f, feature_version=(3, 9))
    except SyntaxError as e:
        bad += 1
        print("FAIL %s:%s: %s (needs newer than Python 3.9?)" % (f, e.lineno, e.msg))
print("python syntax floor 3.9: %d files, %d failing" % (len(files), bad))
sys.exit(1 if bad else 0)
PY
}

check_tracked_artifacts() {
  local bad
  bad="$(git ls-files | grep -E '(^|/)(node_modules|__pycache__|\.nyc_output|coverage)/|\.pyc$|(^|/)\.DS_Store$')"
  if [ -n "$bad" ]; then
    echo "generated/system files are tracked (git rm --cached them and ignore them):"
    echo "$bad"
    return 1
  fi
  echo "no generated artifacts tracked"
}

# Same policy as the pre-commit hook (tools/scan-secrets.sh), applied to what
# this push/PR changed so it cannot be bypassed with --no-verify.
check_secrets() {
  changed_files_z | xargs -0 ./tools/scan-secrets.sh
}

# Advisory: updates reach users only when plugin.json's version changes.
check_version_bump() {
  local base; base="$(resolve_base)"
  if [ -z "$base" ]; then echo "no base to compare against"; return "$SKIP_RC"; fi
  python3 tools/check-plugin-versions.py --bump-advisory "$base"
}

# ─────────────────────────────── test shards ─────────────────────────────
need_node_modules() {
  [ -x node_modules/.bin/mocha ] || { echo "node_modules missing — run: npm ci"; return 2; }
}

shard_core() {
  need_node_modules || return 2
  npm run --silent test:core
}

shard_claudecraft() {
  need_node_modules || return 2
  local rc=0
  npm run --silent test:improve-loop || rc=1
  node plugins/claudecraft/tools/improve-lint.test.js || rc=1
  return "$rc"
}

# Standalone shell suites; each runs to completion so one failure shows the rest.
shard_shell() {
  local rc=0 t
  for t in plugins/claudecraft/skills/improve-loop/tests/scripts.test.sh \
           plugins/planning-suite/handlers/plan-unknowns-gate.test.sh \
           plugins/planning-suite/handlers/plan-worktree-gate.test.sh; do
    echo "── $t"
    bash "$t" || { echo "FAILED: $t"; rc=1; }
  done
  return "$rc"
}

# ───────────────────────────── job runner/reporter ─────────────────────────
JOB_NAMES=()
JOB_PIDS=()

fn_for() { printf '%s_%s' "$1" "${2//-/_}"; }   # kind=check|shard, name → function

launch() {  # launch <kind> <name>: run in background, capture log/rc/seconds
  local kind="$1" name="$2" fn
  fn="$(fn_for "$kind" "$name")"
  if ! type "$fn" >/dev/null 2>&1; then echo "unknown $kind: $name" >&2; return 2; fi
  JOB_NAMES+=("$name")
  case " ${CI_SKIP:-} " in
    *" $name "*)  # reported as SKIP, never as a silent pass
      echo "skipped: $name is listed in CI_SKIP" > "$OUT/$name.log"
      echo "$SKIP_RC" > "$OUT/$name.rc"; echo 0 > "$OUT/$name.sec"
      return 0 ;;
  esac
  (
    start=$SECONDS
    "$fn" > "$OUT/$name.log" 2>&1
    echo $? > "$OUT/$name.rc"
    echo $((SECONDS - start)) > "$OUT/$name.sec"
  ) &
  JOB_PIDS+=($!)
}

gh_actions() { [ -n "${GITHUB_ACTIONS:-}" ]; }

report() {  # prints every job's log, a table, and returns 1 if any failed
  local name rc sec fails=0 skips=0 passes=0 label
  local md="${GITHUB_STEP_SUMMARY:-}"
  [ -n "$md" ] && printf '\n### %s\n\n| check | result | seconds |\n|---|---|---|\n' "${1:-ci.sh}" >> "$md"
  for name in "${JOB_NAMES[@]}"; do
    rc="$(cat "$OUT/$name.rc" 2>/dev/null || echo 99)"
    sec="$(cat "$OUT/$name.sec" 2>/dev/null || echo '?')"
    case "$rc" in
      0)  label="PASS"; passes=$((passes + 1)) ;;
      "$SKIP_RC") label="SKIP"; skips=$((skips + 1)) ;;
      *)  label="FAIL"; fails=$((fails + 1)) ;;
    esac
    if gh_actions; then
      if [ "$label" = "FAIL" ]; then
        echo "::error title=ci.sh $name failed::$name exited $rc — see its log"
        echo "::group::✗ $name (${sec}s) — FAILED"; cat "$OUT/$name.log"; echo "::endgroup::"
      else
        echo "::group::$([ "$label" = PASS ] && echo ✓ || echo ○) $name (${sec}s)"; cat "$OUT/$name.log"; echo "::endgroup::"
      fi
    elif [ "$label" = "FAIL" ]; then
      printf '\n✗ %s (rc=%s, %ss) — last 40 lines of %s\n' "$name" "$rc" "$sec" "$OUT/$name.log"
      tail -n 40 "$OUT/$name.log"
    elif [ -n "${CI_VERBOSE:-}" ]; then
      printf '\n── %s\n' "$name"; cat "$OUT/$name.log"
    fi
    [ -n "$md" ] && printf '| %s | %s | %s |\n' "$name" "$label" "$sec" >> "$md"
  done
  echo
  printf '%-24s %-5s %s\n' CHECK RESULT SECONDS
  for name in "${JOB_NAMES[@]}"; do
    rc="$(cat "$OUT/$name.rc" 2>/dev/null || echo 99)"
    case "$rc" in 0) label=PASS ;; "$SKIP_RC") label=SKIP ;; *) label=FAIL ;; esac
    printf '%-24s %-5s %s\n' "$name" "$label" "$(cat "$OUT/$name.sec" 2>/dev/null || echo '?')"
  done
  printf '%d passed, %d failed, %d skipped  (logs: %s)\n' "$passes" "$fails" "$skips" "${OUT#"$ROOT"/}"
  [ "$fails" -eq 0 ]
}

run_set() {  # run_set <kind> <title> <names...>: launch all, wait, report
  local kind="$1" title="$2" name pid; shift 2
  JOB_NAMES=(); JOB_PIDS=()
  for name in "$@"; do launch "$kind" "$name" || return 2; done
  for pid in "${JOB_PIDS[@]}"; do wait "$pid"; done
  report "$title"
}

# ───────────────────────────────── phases ────────────────────────────────
# The check/shard lists are space-separated names: word splitting is intended.
# shellcheck disable=SC2086
phase_static() { run_set check "static checks" $STATIC_CHECKS; }
# shellcheck disable=SC2086
phase_test()   { run_set shard "test shards" ${CI_SHARDS:-${SHARD_OVERRIDE:-$SHARDS}}; }

# Which shards can this diff possibly affect? CI always runs all of them; this
# keeps the local pre-push gate fast without letting a broken push through.
shards_for_diff() {
  local files s="core"
  files="$(changed_files_z | tr '\0' '\n')"
  if printf '%s\n' "$files" | grep -qE '^(plugins/claudecraft/|test/plugins/claudecraft/|package(-lock)?\.json$|tools/ci\.sh$)'; then s="$s claudecraft"; fi
  if printf '%s\n' "$files" | grep -qE '^(plugins/claudecraft/|plugins/planning-suite/handlers/|tools/ci\.sh$)'; then s="$s shell"; fi
  printf '%s' "$s"
}

phase_all() {
  local rc=0
  phase_static || rc=1
  # No point spending a minute on tests when the cheap checks already failed.
  if [ "$rc" -ne 0 ]; then echo "static checks failed — skipping test shards"; return 1; fi
  phase_test || rc=1
  return "$rc"
}

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; }

main() {
  local cmd="${1:-all}"; [ $# -gt 0 ] && shift
  case "$cmd" in -h|--help|help) usage; return 0 ;; esac
  if [ "$cmd" = "list" ]; then
    echo "static checks: $STATIC_CHECKS"; echo "test shards:   $SHARDS"; return 0
  fi
  while [ $# -gt 0 ]; do
    case "$1" in
      --base) CI_BASE="${2:?--base needs a ref}"; export CI_BASE; shift 2 ;;
      *) break ;;
    esac
  done

  rm -rf "$OUT"; mkdir -p "$OUT"
  isolate_env
  # Skipped-check bookkeeping needs a scratch dir even when HOME is kept.
  [ -n "$CI_TMP" ] || CI_TMP="$(mktemp -d)"

  case "$cmd" in
    static)   phase_static ;;
    test)     phase_test ;;
    all)      phase_all ;;
    pre-push)
      SHARD_OVERRIDE="$(shards_for_diff)"
      echo "pre-push: static checks + shards [$SHARD_OVERRIDE]"
      phase_static || { echo "static checks failed — skipping test shards"; return 1; }
      phase_test ;;
    run)
      [ $# -gt 0 ] || { usage; return 2; }
      local name kind rc=0; JOB_NAMES=(); JOB_PIDS=()
      # Validate every name first so a typo can't leave earlier ones running unattended.
      for name in "$@"; do
        type "$(fn_for check "$name")" >/dev/null 2>&1 || type "$(fn_for shard "$name")" >/dev/null 2>&1 \
          || { echo "unknown check or shard: $name (see: tools/ci.sh list)" >&2; return 2; }
      done
      for name in "$@"; do
        if type "$(fn_for check "$name")" >/dev/null 2>&1; then kind=check; else kind=shard; fi
        launch "$kind" "$name" || return 2
      done
      for pid in "${JOB_PIDS[@]}"; do wait "$pid"; done
      report "ci.sh run" || rc=1
      return "$rc" ;;
    *) echo "unknown command: $cmd" >&2; usage; return 2 ;;
  esac
}

main "$@"
