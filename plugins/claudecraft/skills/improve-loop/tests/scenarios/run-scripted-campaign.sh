#!/usr/bin/env bash
# run-scripted-campaign.sh — deterministic improve path for a scenario (no LLM)
# Implements known-good sequencing for harness regression.
#
# Usage:
#   bash run-scripted-campaign.sh --scenario greeter-bug|boundary-age|dual-defect
#   bash run-scripted-campaign.sh --all
#
# Exit: 0 oracle pass · 2 fail
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SCENARIO_ID=""
ALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) SCENARIO_ID="$2"; shift 2 ;;
    --all) ALL=1; shift ;;
    *) echo "unknown $1" >&2; exit 1 ;;
  esac
done

run_one() {
  local id="$1"
  local FIX="$ROOT/fixtures/$id"
  local SCENARIO_JSON="$FIX/scenario.json"
  local OUT
  OUT="$(bash "$ROOT/run-scenario.sh" --scenario "$id" --prepare)"
  local WS
  WS="$(echo "$OUT" | sed -n 's/^workspace=//p')"
  echo "scripted $id workspace=$WS"

  case "$id" in
    greeter-bug)
      cp "$FIX/golden/src/greeter.js" "$WS/src/greeter.js"
      _cycle_material "$WS" 1 "fix greeter" "src/greeter.js"
      _cycle_residual "$WS" 2 1
      _cycle_residual "$WS" 3 2 complete
      ;;
    boundary-age)
      # Material: fix + test debt in one land
      cp "$FIX/golden/src/age.js" "$WS/src/age.js"
      cp "$FIX/golden/test/age.test.js" "$WS/test/age.test.js"
      _cycle_material "$WS" 1 "fix isAdult boundary + test debt" "src/age.js test/age.test.js" "TEST_GAP closed"
      _cycle_residual "$WS" 2 1
      _cycle_residual "$WS" 3 2 complete
      ;;
    dual-defect)
      # Cycle 1: fix add only (suite still red) — partial material
      cat >"$WS/src/math.js" <<'JS'
'use strict';
function add(a, b) { return a + b; }
function mul(a, b) { return a; }
module.exports = { add, mul };
JS
      _cycle_material_red "$WS" 1 "fix add only" "src/math.js"
      # Cycle 2: residual would not advance honestly while suite red — land mul (material resets)
      cp "$FIX/golden/src/math.js" "$WS/src/math.js"
      _cycle_material "$WS" 2 "fix mul (second material; streak reset)" "src/math.js"
      _cycle_residual "$WS" 3 1
      _cycle_residual "$WS" 4 2 complete
      ;;
    *)
      echo "no scripted path for $id" >&2
      return 2
      ;;
  esac

  bash "$ROOT/run-scenario.sh" --scenario "$id" --validate --workspace "$WS"
}

_cycle_material() {
  local WS="$1" N="$2" thesis="$3" paths="$4"
  local extra="${5:-}"
  cd "$WS"
  local TEST_CMD
  TEST_CMD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).test_command)" "$ROOT/fixtures/$SCENARIO_ID/scenario.json" 2>/dev/null || true)"
  # detect scenario from path
  local sid
  sid="$(basename "$(dirname "$(dirname "$ROOT/fixtures/x")")")" # unused
  # use env SCENARIO_ID from caller
  TEST_CMD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).test_command)" "$ROOT/fixtures/${SCENARIO_ID}/scenario.json")"
  set +e
  bash -lc "$TEST_CMD" >/tmp/scripted-suite.txt 2>&1
  local EC=$?
  set -e
  [[ "$EC" -eq 0 ]] || { echo "material suite fail N=$N"; cat /tmp/scripted-suite.txt; return 2; }
  mkdir -p .improve-loop/artifacts
  cat >".improve-loop/artifacts/iter-${N}-test-diagnostic.md" <<EOF
SUITE: exit=0
SUITE_DELTA: NEW=[] FIXED=[material] STILL=[]
CLASS: OK
ERROR_SIG: none
THESIS: re-verified
$extra
trace=.improve-loop/artifacts/iter-${N}-test-diagnostic.md
EOF
  python3 - "$N" "$thesis" "$paths" <<'PY'
import pathlib, re, sys
n, thesis, paths = sys.argv[1:4]
p = pathlib.Path('IMPROVE_LOOP.md')
t = p.read_text()
t = re.sub(r'\*\*Iteration counter:\*\*\s*\d+', f'**Iteration counter:** {n}', t)
t = re.sub(r'cycle_index:\s*\d+', f'cycle_index: {n}', t)
t = re.sub(r'(## Backlog\n).*?(## Deferred)', r'\1_(open: empty)_\n\n\2', t, count=1, flags=re.S)
t = re.sub(r'consecutive-non-material-cycles:\s*\d+', 'consecutive-non-material-cycles: 0', t)
last = f'''## Last cycle
**N:** {n}
**Thesis:** {thesis}
**Outcome:** confirmed
**Test result:** PASS
**Committed:** pending
**Error signature:** none
**CHANGED_PATHS:** {paths}
**Notes:**
SUITE: exit=0
SUITE_DELTA: NEW=[] FIXED=[material] STILL=[]
CLASS: OK
ERROR_SIG: none
THESIS: re-verified
trace=.improve-loop/artifacts/iter-{n}-test-diagnostic.md
replan-seed: residual
'''
t = re.sub(r'## Last cycle\n.*', last, t, count=1, flags=re.S)
p.write_text(t)
PY
  git add -A
  git commit -m "$(cat <<EOF
improve-loop: iteration $N — $thesis

CLASS: OK
ERROR_SIG: none
SUITE_DELTA: NEW=[] FIXED=[material] STILL=[]
replan-seed: residual
trace: .improve-loop/artifacts/iter-${N}-test-diagnostic.md
EOF
)"
}

_cycle_material_red() {
  local WS="$1" N="$2" thesis="$3" paths="$4"
  cd "$WS"
  local TEST_CMD
  TEST_CMD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).test_command)" "$ROOT/fixtures/${SCENARIO_ID}/scenario.json")"
  set +e
  bash -lc "$TEST_CMD" >/tmp/scripted-suite.txt 2>&1
  local EC=$?
  set -e
  [[ "$EC" -ne 0 ]] || { echo "expected red suite after partial fix"; return 2; }
  mkdir -p .improve-loop/artifacts
  echo "SUITE: exit=$EC CLASS: OK partial" >".improve-loop/artifacts/iter-${N}-test-diagnostic.md"
  python3 - "$N" "$thesis" "$paths" <<'PY'
import pathlib, re, sys
n, thesis, paths = sys.argv[1:4]
p = pathlib.Path('IMPROVE_LOOP.md')
t = p.read_text()
t = re.sub(r'\*\*Iteration counter:\*\*\s*\d+', f'**Iteration counter:** {n}', t)
t = re.sub(r'cycle_index:\s*\d+', f'cycle_index: {n}', t)
# leave open backlog item
t = re.sub(r'consecutive-non-material-cycles:\s*\d+', 'consecutive-non-material-cycles: 0', t)
last = f'''## Last cycle
**N:** {n}
**Thesis:** {thesis}
**Outcome:** partial
**Test result:** FAIL
**Committed:** pending
**Error signature:** test:still-red
**CHANGED_PATHS:** {paths}
**Notes:**
SUITE: exit=1
CLASS: OK
ERROR_SIG: test:still-red
THESIS: partial land
trace=.improve-loop/artifacts/iter-{n}-test-diagnostic.md
replan-seed: fix remaining defect
'''
t = re.sub(r'## Last cycle\n.*', last, t, count=1, flags=re.S)
p.write_text(t)
PY
  git add -A
  git commit -m "$(cat <<EOF
improve-loop: iteration $N — $thesis (suite still red)

CLASS: OK
ERROR_SIG: test:still-red
SUITE_DELTA: FIXED=[partial] STILL=[remaining]
replan-seed: fix remaining defect
EOF
)"
}

_cycle_residual() {
  local WS="$1" N="$2" streak="$3"
  local status="${4:-active}"
  cd "$WS"
  local TEST_CMD
  TEST_CMD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).test_command)" "$ROOT/fixtures/${SCENARIO_ID}/scenario.json")"
  set +e
  bash -lc "$TEST_CMD" >/tmp/scripted-suite.txt 2>&1
  local EC=$?
  set -e
  [[ "$EC" -eq 0 ]] || { echo "residual suite fail"; cat /tmp/scripted-suite.txt; return 2; }
  mkdir -p .improve-loop/artifacts
  cat >".improve-loop/artifacts/iter-${N}-test-diagnostic.md" <<EOF
SUITE: exit=0
SUITE_DELTA: NEW=[] FIXED=[] STILL=[]
CLASS: OK
honest-empty: residual survey — no non-weak open gaps
EOF
  python3 - "$N" "$streak" "$status" <<'PY'
import pathlib, re, sys
n, streak, status = sys.argv[1:4]
p = pathlib.Path('IMPROVE_LOOP.md')
t = p.read_text()
t = re.sub(r'\*\*Iteration counter:\*\*\s*\d+', f'**Iteration counter:** {n}', t)
t = re.sub(r'cycle_index:\s*\d+', f'cycle_index: {n}', t)
t = re.sub(r'\*\*Status:\*\*\s*\S+', f'**Status:** {status}', t)
t = re.sub(r'consecutive-non-material-cycles:\s*\d+', f'consecutive-non-material-cycles: {streak}', t)
t = re.sub(r'(## Backlog\n).*?(## Deferred)', r'\1_(open: empty)_\n\n\2', t, count=1, flags=re.S)
last = f'''## Last cycle
**N:** {n}
**Thesis:** Residual survey honest-empty
**Outcome:** partial
**Test result:** PASS
**Committed:** pending
**Error signature:** none
**CHANGED_PATHS:** (empty)
**Notes:**
SUITE: exit=0
SUITE_DELTA: NEW=[] FIXED=[] STILL=[]
CLASS: OK
ERROR_SIG: none
THESIS: re-verified
trace=.improve-loop/artifacts/iter-{n}-test-diagnostic.md
replan-seed: none
honest-empty: residual survey — no non-weak open gaps
'''
t = re.sub(r'## Last cycle\n.*', last, t, count=1, flags=re.S)
p.write_text(t)
PY
  git add -A
  git commit -m "$(cat <<EOF
improve-loop: iteration $N — residual survey (honest-empty)

CLASS: OK
ERROR_SIG: none
SUITE_DELTA: NEW=[] FIXED=[] STILL=[]
honest-empty: residual survey — no non-weak open gaps
consecutive-non-material-cycles: $streak
$([ "$status" = complete ] && echo 'Status: complete' || true)
EOF
)"
}

export SCENARIO_ID
if [[ "$ALL" -eq 1 ]]; then
  fail=0
  for id in greeter-bug boundary-age dual-defect; do
    SCENARIO_ID=$id
    run_one "$id" || fail=1
  done
  [[ "$fail" -eq 0 ]] || exit 2
  echo "scripted-all PASS"
  exit 0
fi

[[ -n "$SCENARIO_ID" ]] || { echo "need --scenario or --all" >&2; exit 1; }
run_one "$SCENARIO_ID"
