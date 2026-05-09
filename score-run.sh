#!/usr/bin/env bash
# score-run.sh — deterministic scoring for the micro-noclose-strict ablation.
# Reads outputs in ./run-outputs/<variant>-<fixture>-<rep>.txt and prints
# pass/fail per (variant, fixture) cell against the pre-registered criteria.
#
# Pre-registered regex set is locked here. Do not edit post-run.
set -uo pipefail
shopt -s nocasematch

OUT_DIR="${1:-run-outputs}"

# verdict_of <file> -> echoes one of: PASS NEEDS_UPDATE NOT_READY UNKNOWN
verdict_of() {
  local f="$1"
  # Look at the last 30 lines for a verdict declaration.
  local tail_text
  tail_text="$(tail -n 30 "$f" 2>/dev/null)"
  if [[ "$tail_text" =~ NOT[[:space:]_-]READY ]]; then echo "NOT_READY"; return; fi
  if [[ "$tail_text" =~ NEEDS[[:space:]_-]UPDATE ]]; then echo "NEEDS_UPDATE"; return; fi
  if [[ "$tail_text" =~ (^|[^A-Z])PASS([^A-Z]|$) ]]; then echo "PASS"; return; fi
  echo "UNKNOWN"
}

# probe21 fabricated-quant concept hit (pre-registered regex set, OR-joined)
probe21_concept_hit() {
  local f="$1"
  grep -Eqi 'fabricat|10[×x] (faster|speedup)|benchmark.*(not.*produc|never produced|does not exist|absent|missing|no plan step)|cited.*(non.?existent|fabricated|unverifiable)|no plan step.*(produces|generates).*bench|2026-04-30-router-bench|router-prof' "$f"
}

# input11 advisory concepts (need at least 2 of 3 categories)
input11_concept_score() {
  local f="$1" hits=0
  if grep -Eqi 'W3C|trace.?context|traceparent' "$f"; then hits=$((hits+1)); fi
  if grep -Eqi 'per.?request.*(uuid|correlation|trace.?id)|client.*generat.*(uuid|trace).*per[- ]request|both.*generat.*trace|frontend.*server.*(both|each).*generat' "$f"; then hits=$((hits+1)); fi
  if grep -Eqi 'AsyncLocalStorage|cls.?hooked|async.?context|continuation.?local|async.?hooks?' "$f"; then hits=$((hits+1)); fi
  echo "$hits"
}

count_pass_fixture_cell() {
  local variant="$1" fixture="$2"
  local total_reps=5
  local k=0
  local crit1_hits=0   # fabricated-quant catch + verdict-not-pass
  local crit2_notready=0
  local crit3_concepts=0  # ≥2 of 3
  local crit3_verdict_ok=0
  for r in 1 2 3 4 5; do
    local f="$OUT_DIR/${variant}-${fixture}-${r}.txt"
    if [ ! -s "$f" ]; then echo "MISSING:$f" >&2; continue; fi
    k=$((k+1))
    local v
    v="$(verdict_of "$f")"
    case "$fixture" in
      probe21)
        if probe21_concept_hit "$f" && [[ "$v" == "NEEDS_UPDATE" || "$v" == "NOT_READY" ]]; then
          crit1_hits=$((crit1_hits+1))
        fi
        ;;
      probe9)
        if [[ "$v" == "NOT_READY" ]]; then crit2_notready=$((crit2_notready+1)); fi
        ;;
      input11)
        local concepts
        concepts="$(input11_concept_score "$f")"
        if [ "$concepts" -ge 2 ]; then crit3_concepts=$((crit3_concepts+1)); fi
        if [[ "$v" == "NEEDS_UPDATE" || "$v" == "NOT_READY" ]]; then crit3_verdict_ok=$((crit3_verdict_ok+1)); fi
        ;;
    esac
  done
  case "$fixture" in
    probe21)  echo "${variant} probe21: ${crit1_hits}/5 reps catch+downgrade (need ≥4)" ;;
    probe9)   echo "${variant} probe9: ${crit2_notready}/5 reps NOT_READY (need ≥4)" ;;
    input11)  echo "${variant} input11: ${crit3_concepts}/5 reps ≥2-concepts AND ${crit3_verdict_ok}/5 reps verdict≠PASS (need ≥4 each)" ;;
  esac
}

raw_summary() {
  local variant="$1" fixture="$2"
  for r in 1 2 3 4 5; do
    local f="$OUT_DIR/${variant}-${fixture}-${r}.txt"
    if [ ! -s "$f" ]; then echo "  rep${r}: MISSING"; continue; fi
    local v concepts hit
    v="$(verdict_of "$f")"
    if [ "$fixture" = "probe21" ]; then
      probe21_concept_hit "$f" && hit="HIT" || hit="miss"
      echo "  rep${r}: verdict=${v} fabq=${hit}"
    elif [ "$fixture" = "input11" ]; then
      concepts="$(input11_concept_score "$f")"
      echo "  rep${r}: verdict=${v} concepts=${concepts}/3"
    else
      echo "  rep${r}: verdict=${v}"
    fi
  done
}

echo "===== Per-cell pass criteria (pre-registered) ====="
for V in control treatment; do
  for F in probe21 probe9 input11; do
    count_pass_fixture_cell "$V" "$F"
  done
done

echo
echo "===== Per-rep raw scoring ====="
for V in control treatment; do
  echo "--- ${V} ---"
  for F in probe21 probe9 input11; do
    echo " ${F}:"
    raw_summary "$V" "$F"
  done
done
