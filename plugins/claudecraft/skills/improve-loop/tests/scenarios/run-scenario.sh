#!/usr/bin/env bash
# run-scenario.sh — prepare isolated testee from fixture; smokes; oracle
#
# Usage:
#   bash run-scenario.sh --scenario <id> --prepare
#   bash run-scenario.sh --scenario <id> --smoke-seed
#   bash run-scenario.sh --scenario <id> --smoke-fixed
#   bash run-scenario.sh --scenario <id> --validate --workspace <path>
#   bash run-scenario.sh --list
#   bash run-scenario.sh --smoke-all
#   bash run-scenario.sh --scenario <id> --agent-runbook
#
# Exit: 0 ok · 1 usage · 2 smoke/oracle fail
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SCENARIO_ID=""
MODE=""
WORKSPACE=""
KEEP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) SCENARIO_ID="$2"; shift 2 ;;
    --prepare) MODE=prepare; shift ;;
    --smoke-seed) MODE=smoke-seed; shift ;;
    --smoke-fixed) MODE=smoke-fixed; shift ;;
    --validate) MODE=validate; shift ;;
    --agent-runbook) MODE=runbook; shift ;;
    --list) MODE=list; shift ;;
    --smoke-all) MODE=smoke-all; shift ;;
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

json_field() {
  # json_field <file> <js-expr returning value>
  node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const v=($2); console.log(v==null?'':v)" "$1"
}

list_scenarios() {
  for d in "$ROOT"/fixtures/*/; do
    local base
    base="$(basename "$d")"
    [[ "$base" == _* ]] && continue
    [[ -f "${d}scenario.json" ]] || continue
    echo "$base"
  done | sort
}

if [[ "$MODE" == "list" ]]; then
  list_scenarios
  exit 0
fi

if [[ "$MODE" == "smoke-all" ]]; then
  fail=0
  while IFS= read -r id; do
    echo "=== smoke $id ==="
    if ! bash "$0" --scenario "$id" --smoke-seed; then fail=1; fi
    if ! bash "$0" --scenario "$id" --smoke-fixed; then fail=1; fi
  done < <(list_scenarios)
  [[ "$fail" -eq 0 ]] || exit 2
  echo "smoke-all PASS"
  exit 0
fi

[[ -n "$SCENARIO_ID" ]] || { echo "need --scenario <id> (or --list / --smoke-all)" >&2; exit 1; }

FIX="$ROOT/fixtures/$SCENARIO_ID"
SCENARIO_JSON="$FIX/scenario.json"
SEED="$FIX/seed"
[[ -d "$SEED" && -f "$SCENARIO_JSON" ]] || { echo "fixture missing: $FIX" >&2; exit 1; }

TEST_CMD="$(json_field "$SCENARIO_JSON" 's.test_command')"
SEED_SUITE_EXIT="$(json_field "$SCENARIO_JSON" 's.seed_suite_exit!=null?s.seed_suite_exit:1')"
SEED_PROBE="$(json_field "$SCENARIO_JSON" 's.seed_probe||""')"
SEED_PROBE_EXIT="$(json_field "$SCENARIO_JSON" 's.seed_probe_exit!=null?s.seed_probe_exit:1')"

prepare_workspace() {
  local dest="${1:-}"
  if [[ -z "$dest" ]]; then
    dest="$(mktemp -d "${TMPDIR:-/tmp}/improve-scenario-${SCENARIO_ID}.XXXXXX")"
  fi
  mkdir -p "$dest"
  cp -R "$SEED"/. "$dest"/
  git -C "$dest" init -q -b main
  git -C "$dest" config user.email "scenario@example.com"
  git -C "$dest" config user.name "Scenario"
  git -C "$dest" add -A
  git -C "$dest" commit -q -m "seed: $SCENARIO_ID fixture"
  echo "$dest"
}

apply_golden_fix() {
  local dest="$1"
  if [[ -d "$FIX/golden" ]]; then
    cp -R "$FIX/golden"/. "$dest"/
    return 0
  fi
  # legacy greeter-bug only
  if [[ "$SCENARIO_ID" == "greeter-bug" ]]; then
    cat >"$dest/src/greeter.js" <<'JS'
'use strict';
function greet(name) { return `Hello, ${name}!`; }
module.exports = { greet };
JS
    return 0
  fi
  echo "no golden/ for $SCENARIO_ID" >&2
  return 1
}

write_seed_ledger() {
  local dest="$1"
  local max_cycles done_when
  max_cycles="$(json_field "$SCENARIO_JSON" 's.max_cycles||4')"
  done_when="$(json_field "$SCENARIO_JSON" 's.description||"scenario complete"')"
  cat >"$dest/IMPROVE_LOOP.md" <<EOF
# Improve Loop: scenario $SCENARIO_ID

**Test command:** \`$TEST_CMD\`
**Started:** $(date -u +%Y-%m-%d)          **Status:** active
**Iteration counter:** 0
**Until:** no material P0/P1 for 2 consecutive cycles (green tests)
**Max cycles:** $max_cycles
**Seed mode:** defect
**Product residual survey:** n/a (defect)
**Plan tier:** 0
**Spec validation:** n/a
**Habitat claimed:** no
**Habitat probe:** n/a
**Habitat probe result:** n/a
**Habitat probe evidence:** none
**Operator done-when:** $done_when
**Install mechanism:** n/a
**Operator card:** docs/improve-loop-testee-operator-card.md (claude-craft)

## Driver
- mode: continuous
- until: no material P0/P1 for 2 consecutive cycles (green tests)
- max_cycles: $max_cycles
- cycle_index: 0
- slug: scenario-$SCENARIO_ID
- test_command: $TEST_CMD
- next_auto: cycle

## Brief
Scenario **$SCENARIO_ID**. Follow operator card (Expected effects, CLASS Notes, durable carriers, honest-empty residual×2).

## Backlog
- [ ] P0: Resolve $SCENARIO_ID seed defect(s)
  - kind: defect
  - Evidence: seed fixture
  - Decision: land minimal fix (+ test debt if false-green)
  - Preserve: existing green suite cases
  - Unknown: none
  - Acceptance: $TEST_CMD exits 0; probes pass if any
  - Expected effects: see fixtures/$SCENARIO_ID/scenario.json

## Deferred (P2)
- [ ] P2: Extra scenarios polish — weak:yagni — out of this run

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0
- consecutive-non-material-cycles: 0
- error_signature: none

## Last cycle
_(none yet)_
EOF
}

case "$MODE" in
  prepare)
    WS="$(prepare_workspace "${WORKSPACE:-}")"
    write_seed_ledger "$WS"
    echo "workspace=$WS"
    echo "scenario=$SCENARIO_ID"
    echo "test_command=$TEST_CMD"
    echo "next=run improve continuous then --validate --workspace $WS"
    ;;
  smoke-seed)
    WS="$(prepare_workspace)"
    set +e
    (cd "$WS" && bash -lc "$TEST_CMD") >/tmp/scenario-seed-suite.txt 2>&1
    EC=$?
    set -e
    if [[ "$EC" -ne "$SEED_SUITE_EXIT" ]]; then
      echo "FAIL: seed suite exit=$EC want=$SEED_SUITE_EXIT ($SCENARIO_ID)" >&2
      tail -20 /tmp/scenario-seed-suite.txt >&2
      [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
      exit 2
    fi
    echo "PASS: seed suite exit=$EC (want $SEED_SUITE_EXIT)"
    if [[ -n "$SEED_PROBE" ]]; then
      set +e
      (cd "$WS" && bash -lc "$SEED_PROBE") >/tmp/scenario-seed-probe.txt 2>&1
      PEC=$?
      set -e
      if [[ "$PEC" -ne "$SEED_PROBE_EXIT" ]]; then
        echo "FAIL: seed probe exit=$PEC want=$SEED_PROBE_EXIT" >&2
        cat /tmp/scenario-seed-probe.txt >&2
        [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
        exit 2
      fi
      echo "PASS: seed probe exit=$PEC (want $SEED_PROBE_EXIT) — false-green signal OK"
    fi
    [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
    ;;
  smoke-fixed)
    WS="$(prepare_workspace)"
    apply_golden_fix "$WS"
    set +e
    (cd "$WS" && bash -lc "$TEST_CMD") >/tmp/scenario-fixed-suite.txt 2>&1
    EC=$?
    set -e
    if [[ "$EC" -ne 0 ]]; then
      echo "FAIL: golden suite exit=$EC" >&2
      cat /tmp/scenario-fixed-suite.txt >&2
      [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
      exit 2
    fi
    echo "PASS: golden suite green"
    PROBE="$(json_field "$SCENARIO_JSON" 's.oracle&&s.oracle.probe_command||s.seed_probe||""')"
    if [[ -n "$PROBE" ]]; then
      set +e
      (cd "$WS" && bash -lc "$PROBE") >/tmp/scenario-fixed-probe.txt 2>&1
      PEC=$?
      set -e
      if [[ "$PEC" -ne 0 ]]; then
        echo "FAIL: golden probe exit=$PEC" >&2
        cat /tmp/scenario-fixed-probe.txt >&2
        [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
        exit 2
      fi
      echo "PASS: golden probe green"
    fi
    [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
    ;;
  validate)
    [[ -n "$WORKSPACE" ]] || { echo "need --workspace" >&2; exit 1; }
    node "$ROOT/validate-outcome.js" --workspace "$WORKSPACE" --scenario "$SCENARIO_JSON"
    ;;
  runbook)
    cat <<EOF
# Agent runbook — $SCENARIO_ID

\`\`\`bash
bash $ROOT/run-scenario.sh --scenario $SCENARIO_ID --prepare
# improve continuous in workspace (max_cycles from scenario.json)
bash $ROOT/run-scenario.sh --scenario $SCENARIO_ID --validate --workspace <path>
\`\`\`

Seed suite exit want: $SEED_SUITE_EXIT
Seed probe: ${SEED_PROBE:-'(none)'}
Test: $TEST_CMD
EOF
    ;;
  *)
    echo "need a mode: --prepare --smoke-seed --smoke-fixed --validate --agent-runbook --list --smoke-all" >&2
    exit 1
    ;;
esac
