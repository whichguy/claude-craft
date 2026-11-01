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
#   CI_OUT=<dir>     write logs here (default: a private per-run dir, copied to test-results/ci at exit)
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

OUT=""   # per-run scratch dir, chosen in main(); a fixed shared path let two concurrent runs overwrite each other's results

STATIC_CHECKS="marketplace-lint namespacing-lint marketplace-smoke handler-sync hermes-drift plugin-versions improve-loop-contract harness-smoke shellcheck python-syntax tracked-artifacts secrets version-bump"
SHARDS="core claudecraft shell"

# ───────────────────────── environment isolation ─────────────────────────
# Tests must behave the same on a laptop and on a runner. A real leak bit us:
# CLAUDE_PLAN_WORKTREE_GATE=0 in a developer shell silently disabled the gate under test
# (14 false failures). A throwaway HOME also means no test can touch the real ~/.claude.
CI_TMP=""
cleanup() {
  # Keep the last run's logs where people (and the artifact upload) look for them, but only after
  # the run: while running, each invocation writes to its own directory.
  if [ -n "$CI_TMP" ] && [ -z "${CI_OUT:-}" ] && [ -d "$OUT" ]; then
    rm -rf "${ROOT:?}/test-results/ci"
    mkdir -p "$ROOT/test-results" && cp -R "$OUT" "$ROOT/test-results/ci"
  fi
  [ -n "$CI_TMP" ] && rm -rf "$CI_TMP"
}
trap cleanup EXIT

isolate_env() {
  local v scrubbed=""
  # git exports GIT_DIR/GIT_INDEX_FILE/... to hooks, and from a LINKED worktree GIT_DIR points at the
  # shared repo. Every test that builds a throwaway repo would then write into the real one (seen:
  # a pre-push from a worktree committed a test fixture onto the developer's branch). Never inherit them.
  # shellcheck disable=SC2046
  unset $(git rev-parse --local-env-vars 2>/dev/null)
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
# Base for "what changed": CI_BASE if given, else the parent commit. A base that was GIVEN but is
# not in this clone (a force-push: `before` is gone) is unknown, not "the last commit": the empty
# result makes every caller fail closed (scan everything, strict drift check, all shards).
resolve_base() {
  local b="${CI_BASE:-}"
  case "$b" in
    ""|0000000000000000000000000000000000000000) b="HEAD~1" ;;
  esac
  git rev-parse --verify --quiet "$b^{commit}" >/dev/null 2>&1 || b=""
  printf '%s' "$b"
}

# Every path the range touches, INCLUDING deletions and the source of a rename (no rename detection).
touched_files() {
  local base; base="$(resolve_base)"
  if [ -n "$base" ]; then git diff --name-only --no-renames "$base" HEAD; else git ls-files; fi
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
  local base rc strict=0
  base="$(resolve_base)"
  # An unknown base fails closed: the change may touch the handlers, so be strict rather than guess.
  if [ -z "$base" ] || ! git diff --quiet "$base" HEAD -- plugins/planning-suite/handlers tools/check-hermes-drift.sh; then strict=1; fi
  if [ "$strict" -eq 1 ]; then ./tools/check-hermes-drift.sh --strict; else ./tools/check-hermes-drift.sh; fi
  rc=$?
  # 77 is that script's own "hermes unreachable, advisory run" signal; map it, do not leak exit codes.
  if [ "$rc" -eq 77 ]; then ci_skip "hermes unreachable (advisory run)"; return 0; fi
  return "$rc"
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
    ci_skip "shellcheck not installed"; return 0
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

# Handlers/tools run on every user's machine; macOS still ships Python 3.9. Prefer a REAL 3.9
# (macOS has one at /usr/bin/python3): ast's feature_version on a newer interpreter is best-effort
# and accepts some newer syntax (nested same-quote f-strings, parenthesised `with`) that stock
# macOS rejects at import time, i.e. a hook that fails on every call for those users.
check_python_syntax() {
  local py="" cand v
  for cand in python3.9 /usr/bin/python3; do
    command -v "$cand" >/dev/null 2>&1 || continue
    # On a Mac without the Command Line Tools, /usr/bin/python3 is a shim that pops an install dialog.
    if [ "$cand" = /usr/bin/python3 ] && [ "$(uname -s)" = Darwin ] && ! xcode-select -p >/dev/null 2>&1; then continue; fi
    v="$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null)"
    if [ "$v" = "3.9" ]; then py="$cand"; break; fi
  done
  if [ -n "$py" ]; then
    echo "using a real Python 3.9: $py"
  else
    py=python3
    echo "no Python 3.9 on this machine: best-effort grammar check (ast feature_version); the macOS leg runs the real thing"
  fi
  "$py" - <<'PY'
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

# Same policy as the pre-commit hook (tools/scan-secrets.sh), applied to EVERY commit this push/PR
# adds (not the net diff: a key committed and then removed in the next commit is still in the
# pushed history), so skipping the hook with --no-verify shows up here. An unknown base scans
# everything tracked. GitHub secret scanning + push protection are the server-side backstop.
check_secrets() {
  local base c tmp list n=0 rc=0 max=300
  base="$(resolve_base)"
  if [ -z "$base" ]; then
    echo "no usable base: scanning every tracked file"
    git ls-files -z | xargs -0 ./tools/scan-secrets.sh
    return
  fi
  tmp="$CI_TMP/secrets-scan"; mkdir -p "$tmp"
  for c in $(git rev-list --no-merges --reverse --max-count="$max" "$base..HEAD"); do
    n=$((n + 1))
    list="$tmp/$c.list"
    git diff-tree -z --root --no-commit-id --name-only -r --diff-filter=ACMRT "$c" > "$list"
    [ -s "$list" ] || continue
    mkdir -p "$tmp/$c"
    while IFS= read -r -d '' f; do
      mkdir -p "$tmp/$c/$(dirname "$f")"
      git show "$c:$f" > "$tmp/$c/$f" 2>/dev/null
    done < "$list"
    if ! ( cd "$tmp/$c" && xargs -0 "$ROOT/tools/scan-secrets.sh" < "$list" ); then echo "  ^ added in commit ${c:0:12}"; rc=1; fi
  done
  echo "secrets: scanned $n commit(s) in ${base:0:12}..HEAD"
  [ "$n" -ge "$max" ] && echo "secrets: only the newest $max commits were scanned"
  return "$rc"
}

# Advisory: updates reach users only when plugin.json's version changes.
check_version_bump() {
  local base; base="$(resolve_base)"
  if [ -z "$base" ]; then ci_skip "no base to compare against"; return 0; fi
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
      echo 0 > "$OUT/$name.rc"; echo 0 > "$OUT/$name.sec"; echo "listed in CI_SKIP" > "$OUT/$name.skip"
      return 0 ;;
  esac
  (
    # shellcheck disable=SC2030  # intentional: ci_skip, called by the check inside this subshell, reads it
    CI_JOB="$name"
    start=$SECONDS
    "$fn" > "$OUT/$name.log" 2>&1
    echo $? > "$OUT/$name.rc"
    echo $((SECONDS - start)) > "$OUT/$name.sec"
  ) &
  JOB_PIDS+=($!)
}

# A check says "not applicable here" with ci_skip + exit 0. It is a marker file, not an exit code:
# a real tool can exit with any number (mocha exits with its failure count, so exactly 77 failing
# tests once read as a skip and the run passed).
# shellcheck disable=SC2031  # CI_JOB is set in the job subshell on purpose
ci_skip() { echo "$*" > "$OUT/${CI_JOB:?ci_skip called outside a check}.skip"; }

label_of() {  # label_of <name>: PASS | SKIP | FAIL (a missing .rc means the check died: FAIL)
  local rc; rc="$(cat "$OUT/$1.rc" 2>/dev/null || echo 99)"
  if [ "$rc" = 0 ] && [ -f "$OUT/$1.skip" ]; then echo SKIP; elif [ "$rc" = 0 ]; then echo PASS; else echo FAIL; fi
}

gh_actions() { [ -n "${GITHUB_ACTIONS:-}" ]; }

report() {  # prints every job's log, a table, and returns 1 if any failed
  local name rc sec fails=0 skips=0 passes=0 label
  local md="${GITHUB_STEP_SUMMARY:-}"
  [ -n "$md" ] && printf '\n### %s\n\n| check | result | seconds |\n|---|---|---|\n' "${1:-ci.sh}" >> "$md"
  for name in "${JOB_NAMES[@]}"; do
    rc="$(cat "$OUT/$name.rc" 2>/dev/null || echo 99)"
    sec="$(cat "$OUT/$name.sec" 2>/dev/null || echo '?')"
    label="$(label_of "$name")"
    case "$label" in
      PASS) passes=$((passes + 1)) ;;
      SKIP) skips=$((skips + 1)) ;;
      *)    fails=$((fails + 1)) ;;
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
    printf '%-24s %-5s %s\n' "$name" "$(label_of "$name")" "$(cat "$OUT/$name.sec" 2>/dev/null || echo '?')"
  done
  printf '%d passed, %d failed, %d skipped  (logs: %s)\n' "$passes" "$fails" "$skips" "${CI_OUT:-test-results/ci}"
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
phase_test() {
  [ -n "${CI_SHARDS:-}" ] && echo "ci.sh: CI_SHARDS='$CI_SHARDS' restricts the test shards (unset it to run them all)"
  # shellcheck disable=SC2086
  run_set shard "test shards" ${CI_SHARDS:-${SHARD_OVERRIDE:-$SHARDS}}
}

# Which shards can this diff affect? A speed heuristic for the local pre-push gate only: CI always
# runs every shard and is the authority. Deletions and the source of a rename count, and anything
# shared (test config, dependencies, tooling, hooks, workflows) selects everything.
shards_for_diff() {
  local files s="core"
  files="$(touched_files)"
  if printf '%s\n' "$files" | grep -qE '^(\.mocharc\.json|package(-lock)?\.json|tools/|\.githooks/|\.github/)'; then printf '%s' "$SHARDS"; return; fi
  if printf '%s\n' "$files" | grep -qE '^(plugins/claudecraft/|test/plugins/claudecraft/)'; then s="$s claudecraft"; fi
  if printf '%s\n' "$files" | grep -qE '^(plugins/claudecraft/|plugins/planning-suite/handlers/)'; then s="$s shell"; fi
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

  isolate_env
  # A scratch dir is needed even when HOME is kept (CI_KEEP_HOME).
  [ -n "$CI_TMP" ] || CI_TMP="$(mktemp -d)"
  OUT="${CI_OUT:-$CI_TMP/out}"
  rm -rf "${OUT:?}"; mkdir -p "$OUT"

  case "$cmd" in
    static)   phase_static ;;
    test)     phase_test ;;
    all)      phase_all ;;
    pre-push)
      SHARD_OVERRIDE="$(shards_for_diff)"
      echo "pre-push: static checks + shards [$SHARD_OVERRIDE]"
      phase_static || { echo "static checks failed — skipping test shards"; return 1; }
      if [ ! -x node_modules/.bin/mocha ]; then
        echo "pre-push: node_modules missing, so test shards [$SHARD_OVERRIDE] were not run (npm ci); CI will run them"
        return 0
      fi
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
