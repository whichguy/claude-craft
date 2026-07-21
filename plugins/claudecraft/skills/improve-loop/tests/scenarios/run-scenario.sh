#!/usr/bin/env bash
# run-scenario.sh — prepare isolated testee from fixture; optional smoke; oracle
#
# Usage:
#   bash run-scenario.sh --scenario greeter-bug --prepare
#   bash run-scenario.sh --scenario greeter-bug --smoke-seed   # seed suite must FAIL
#   bash run-scenario.sh --scenario greeter-bug --smoke-fixed  # apply golden fix + suite PASS
#   bash run-scenario.sh --scenario greeter-bug --validate --workspace <path>
#   bash run-scenario.sh --scenario greeter-bug --agent-runbook
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
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$SCENARIO_ID" ]] || { echo "need --scenario <id>" >&2; exit 1; }

FIX="$ROOT/fixtures/$SCENARIO_ID"
SCENARIO_JSON="$FIX/scenario.json"
SEED="$FIX/seed"
[[ -d "$SEED" && -f "$SCENARIO_JSON" ]] || { echo "fixture missing: $FIX" >&2; exit 1; }

TEST_CMD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).test_command)" "$SCENARIO_JSON")"

prepare_workspace() {
  local dest="${1:-}"
  if [[ -z "$dest" ]]; then
    dest="$(mktemp -d "${TMPDIR:-/tmp}/improve-scenario-${SCENARIO_ID}.XXXXXX")"
  fi
  mkdir -p "$dest"
  # copy seed
  cp -R "$SEED"/. "$dest"/
  git -C "$dest" init -q -b main
  git -C "$dest" config user.email "scenario@example.com"
  git -C "$dest" config user.name "Scenario"
  git -C "$dest" add -A
  git -C "$dest" commit -q -m "seed: broken greeter ($SCENARIO_ID)"
  echo "$dest"
}

apply_golden_fix() {
  local dest="$1"
  # Known-good one-line fix for greeter-bug
  cat >"$dest/src/greeter.js" <<'JS'
'use strict';

function greet(name) {
  return `Hello, ${name}!`;
}

module.exports = { greet };
JS
}

write_seed_ledger() {
  local dest="$1"
  local max_cycles
  max_cycles="$(node -e "const s=require(process.argv[1]); console.log(s.max_cycles||4)" "$SCENARIO_JSON")"
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
**Operator done-when:** Suite green for greet-by-name; residual×2 with honest-empty
**Install mechanism:** n/a
**Operator card:** paste from claude-craft docs/improve-loop-testee-operator-card.md

## Driver
- mode: continuous
- until: no material P0/P1 for 2 consecutive cycles (green tests)
- max_cycles: $max_cycles
- cycle_index: 0
- slug: scenario-$SCENARIO_ID
- test_command: $TEST_CMD
- next_auto: cycle

## Brief
Scenario fixture **$SCENARIO_ID**: fix intentional greeter bug. Follow operator card:
Expected effects, acceptance + preservation probes, greppable CLASS Notes, durable carriers.

## Backlog
- [ ] P0: Fix greet(name) to return Hello, <name>!
  - kind: defect
  - Evidence: seed suite fails greets by name
  - Decision: interpolate name in src/greeter.js
  - Preserve: greets with non-empty name still runs
  - Unknown: none
  - Acceptance: node --test test/greeter.test.js exits 0
  - Expected effects:
    - Must now pass: greets by name
    - Must stay true: greets with non-empty name still runs
    - Must not change: no new deps
    - Evidence commands: $TEST_CMD

## Deferred (P2)
- [ ] P2: Extra locale greetings — weak:yagni — out of scenario

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
    echo "next=run improve-loop continuous in workspace (max_cycles from scenario.json)"
    echo "then: bash $0 --scenario $SCENARIO_ID --validate --workspace $WS"
    ;;
  smoke-seed)
    WS="$(prepare_workspace)"
    set +e
    (cd "$WS" && bash -lc "$TEST_CMD") >/tmp/scenario-seed-suite.txt 2>&1
    EC=$?
    set -e
    if [[ "$EC" -eq 0 ]]; then
      echo "FAIL: seed suite unexpectedly green" >&2
      cat /tmp/scenario-seed-suite.txt >&2
      [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
      exit 2
    fi
    echo "PASS: seed suite fails (exit=$EC) as required"
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
      echo "FAIL: golden fix suite not green" >&2
      cat /tmp/scenario-fixed-suite.txt >&2
      [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
      exit 2
    fi
    echo "PASS: golden fix suite green"
    [[ "$KEEP" -eq 1 ]] || rm -rf "$WS"
    ;;
  validate)
    [[ -n "$WORKSPACE" ]] || { echo "need --workspace" >&2; exit 1; }
    node "$ROOT/validate-outcome.js" --workspace "$WORKSPACE" --scenario "$SCENARIO_JSON"
    ;;
  runbook)
    cat <<EOF
# Agent runbook — scenario $SCENARIO_ID

1. Prepare:
   bash $ROOT/run-scenario.sh --scenario $SCENARIO_ID --prepare
   # note workspace= path

2. In that workspace (cwd), run improve-loop continuous:
   - max_cycles from scenario.json
   - until: residual×2 (default)
   - Follow docs/improve-loop-testee-operator-card.md habits
   - Material cycle: fix src/greeter.js; suite green; CLASS: OK in Notes + commit body
   - Two residual cycles with: honest-empty: residual survey — no non-weak open gaps
   - Status: complete when streak >= 2 and open P0/P1 = 0

3. Validate:
   bash $ROOT/run-scenario.sh --scenario $SCENARIO_ID --validate --workspace <path>

4. Expect oracle PASS (suite green, status complete, streak>=2, 2× honest-empty, src fixed).
EOF
    ;;
  *)
    echo "need --prepare | --smoke-seed | --smoke-fixed | --validate | --agent-runbook" >&2
    exit 1
    ;;
esac
