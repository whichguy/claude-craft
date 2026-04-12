#!/usr/bin/env bash
# l1-structural-spike-analyze.sh — Analysis script for spike results
# ONE-OFF — delete after spike completes (post Phase 5)
#
# Usage: ./tools/l1-structural-spike-analyze.sh
# Reads: ~/.claude/plans/artifacts/spike-runs/*.json
# Writes: ~/.claude/plans/artifacts/l1-structural-spike-20260412-matrix.md

set -eo pipefail

RESULTS_DIR="$HOME/.claude/plans/artifacts/spike-runs"
MATRIX_OUT="$HOME/.claude/plans/artifacts/l1-structural-spike-20260412-matrix.md"
ARTIFACT="$HOME/.claude/plans/artifacts/l1-structural-spike-20260412.md"

Q_IDS=(Q-G20 Q-G21 Q-G22 Q-G23 Q-G24 Q-G25)

NEUTRAL_SLUGS=(
  blue-green-deploy cache-aside-api db-migration gas-sidebar go-cli-tool
  nextjs-feature python-api-auth python-data-pipeline react-dashboard
  rust-library shared-auth-library terraform-infra
)

ADVERSARIAL_NON_Q21_SLUGS=(
  adversarial-bolt-on adversarial-large-migration adversarial-overscope
  adversarial-vague-auth adversarial-wrong-context
)

Q21_SLUGS=(
  adversarial-contradictory
  probe-3-cross-phase-contradiction
)

# Extract a verdict for a specific Q-ID from a JSON file
get_verdict() {
  local json_file="$1"
  local q_id="$2"
  if [[ ! -f "$json_file" ]]; then
    echo "MISSING"
    return
  fi
  # Use python for reliable JSON parsing; normalize case and NA/N/A variants
  python3 -c "
import json, sys
with open('$json_file') as f:
  d = json.load(f)
findings = d.get('findings', {})
q = findings.get('$q_id', {})
s = q.get('status', 'MISSING').upper().strip()
# Normalize NA -> N/A
if s == 'NA':
    s = 'N/A'
print(s)
" 2>/dev/null || echo "PARSE_ERROR"
}

# Phase 2.0: Compute Opus self-agreement floor
compute_opus_baseline() {
  echo "## Phase 2.0: Opus Self-Agreement Baseline"
  echo ""
  echo "| Fixture | Q-G20 | Q-G21 | Q-G22 | Q-G23 | Q-G24 | Q-G25 | Agreement |"
  echo "|---------|-------|-------|-------|-------|-------|-------|-----------|"

  local total_agreements=0
  local total_comparisons=0

  for slug in "${Q21_SLUGS[@]}"; do
    # Collect N=3 replicates
    local verdicts=()
    for q in "${Q_IDS[@]}"; do
      local v1 v2 v3
      v1=$(get_verdict "$RESULTS_DIR/${slug}.opus.baseline.1.json" "$q")
      v2=$(get_verdict "$RESULTS_DIR/${slug}.opus.baseline.2.json" "$q")
      v3=$(get_verdict "$RESULTS_DIR/${slug}.opus.baseline.3.json" "$q")
      verdicts+=("$v1/$v2/$v3")
      # Agreement: all 3 match
      if [[ "$v1" == "$v2" && "$v2" == "$v3" && "$v1" != "MISSING" ]]; then
        ((total_agreements++)) || true
      fi
      ((total_comparisons++)) || true
    done
    local agree_pct=0
    [[ $total_comparisons -gt 0 ]] && agree_pct=$((total_agreements * 100 / total_comparisons))
    echo "| $slug | ${verdicts[0]} | ${verdicts[1]} | ${verdicts[2]} | ${verdicts[3]} | ${verdicts[4]} | ${verdicts[5]} | ${agree_pct}% |"
  done

  echo ""
  local floor_pct=0
  [[ $total_comparisons -gt 0 ]] && floor_pct=$((total_agreements * 100 / total_comparisons))
  echo "**Opus_self_agreement: ${total_agreements}/${total_comparisons} = ${floor_pct}%**"
  echo ""
  # Return computed floor to caller via global
  OPUS_FLOOR_COMPUTED=$floor_pct
}

# Phase 3: Main verdict comparison matrix
compute_verdict_matrix() {
  local opus_self_agreement="$1"  # e.g., 95 (integer %)

  echo "## Phase 3: Sonnet vs Opus Verdict Matrix"
  echo ""
  echo "Legend: ✓ = agree, ✗! = Sonnet false negative (critical), ✗? = Sonnet false positive, — = both N/A"
  echo ""
  echo "| Fixture | Type | Q-G20 | Q-G21 | Q-G22 | Q-G23 | Q-G24 | Q-G25 |"
  echo "|---------|------|-------|-------|-------|-------|-------|-------|"

  local total_agree=0
  local total_q21_agree=0
  local total_q21_cells=0
  local non_q21_agree=0
  local non_q21_total=0
  local false_negatives=0
  local adversarial_regressions=0

  # Process all fixture groups
  process_fixtures() {
    local type="$1"
    shift
    local slugs=("$@")

    for slug in "${slugs[@]}"; do
      local row="| $slug | $type"
      local row_agree=0
      local row_total=0

      for q in "${Q_IDS[@]}"; do
        # Use replicate 1 for N=1 fixtures, average for Q-G21 N=2 fixtures
        local opus_v sonnet_v

        if [[ "$q" == "Q-G21" ]] && [[ " ${Q21_SLUGS[*]} " == *" $slug "* ]]; then
          # N=2: use replicate 1 for comparison (flag if replicates disagree)
          local o1 o2 s1 s2
          o1=$(get_verdict "$RESULTS_DIR/${slug}.opus.1.json" "$q")
          o2=$(get_verdict "$RESULTS_DIR/${slug}.opus.2.json" "$q")
          s1=$(get_verdict "$RESULTS_DIR/${slug}.sonnet.1.json" "$q")
          s2=$(get_verdict "$RESULTS_DIR/${slug}.sonnet.2.json" "$q")
          opus_v="$o1"
          sonnet_v="$s1"
          # Warn if replicates disagree within model
          if [[ "$o1" != "$o2" ]]; then
            echo "  NOTE: Opus replicates disagree on $slug Q-G21: $o1 vs $o2" >&2
          fi
          if [[ "$s1" != "$s2" ]]; then
            echo "  NOTE: Sonnet replicates disagree on $slug Q-G21: $s1 vs $s2" >&2
          fi
        else
          opus_v=$(get_verdict "$RESULTS_DIR/${slug}.opus.1.json" "$q")
          sonnet_v=$(get_verdict "$RESULTS_DIR/${slug}.sonnet.1.json" "$q")
        fi

        # Compute cell symbol
        local cell
        if [[ "$opus_v" == "MISSING" || "$sonnet_v" == "MISSING" ]]; then
          cell="?"
        elif [[ "$opus_v" == "N/A" && "$sonnet_v" == "N/A" ]]; then
          cell="—"
          ((row_agree++)) || true
        elif [[ "$opus_v" == "$sonnet_v" ]]; then
          cell="✓"
          ((row_agree++)) || true
          if [[ "$q" == "Q-G21" ]]; then ((total_q21_agree++)) || true; fi
        elif [[ "$opus_v" == "NEEDS_UPDATE" && "$sonnet_v" == "PASS" ]]; then
          cell="✗!"  # false negative — most critical
          ((false_negatives++)) || true
          if [[ "$type" == "ADV" ]] && [[ "$q" != "Q-G21" ]]; then
            ((adversarial_regressions++)) || true
          fi
        else
          cell="✗?"  # false positive (less critical)
        fi

        row+=" | $cell"
        ((row_total++)) || true
        if [[ "$q" == "Q-G21" ]]; then ((total_q21_cells++)) || true; fi
      done

      echo "$row |"
      ((total_agree += row_agree)) || true
      ((non_q21_agree += row_agree)) || true
      ((non_q21_total += row_total)) || true
    done
  }

  process_fixtures "ADV" "${Q21_SLUGS[@]}"
  process_fixtures "ADV" "${ADVERSARIAL_NON_Q21_SLUGS[@]}"
  process_fixtures "NEU" "${NEUTRAL_SLUGS[@]}"

  local overall_total=$((${#NEUTRAL_SLUGS[@]} + ${#ADVERSARIAL_NON_Q21_SLUGS[@]} + ${#Q21_SLUGS[@]}))
  overall_total=$((overall_total * ${#Q_IDS[@]}))

  echo ""
  echo "## Aggregate Metrics"
  echo ""
  echo "- **Opus_self_agreement (baseline floor):** ${opus_self_agreement}%"
  local overall_pct=0
  [[ $overall_total -gt 0 ]] && overall_pct=$((total_agree * 100 / overall_total))
  echo "- **Overall Sonnet-vs-Opus agreement:** ${total_agree}/${overall_total} = ${overall_pct}%"
  echo "- **Threshold (Tier 1/2):** $((opus_self_agreement - 3))%"
  echo "- **Q-G21 load-bearing gate:** ${total_q21_agree}/${total_q21_cells} (binary: both must PASS)"
  echo "- **False negatives (✗!):** $false_negatives"
  echo "- **Adversarial regressions (non-Q-G21):** $adversarial_regressions"
  echo ""
}

# Phase 3.1: Check expected files
check_expected_files() {
  echo "## File Inventory Check"
  echo ""
  local missing=0

  # Phase 2.0 baseline files (6)
  for slug in "${Q21_SLUGS[@]}"; do
    for r in 1 2 3; do
      local f="$RESULTS_DIR/${slug}.opus.baseline.${r}.json"
      if [[ ! -f "$f" ]]; then
        echo "MISSING: $f" >&2
        ((missing++)) || true
      fi
    done
  done

  # Phase 2.1 neutral (24)
  for slug in "${NEUTRAL_SLUGS[@]}"; do
    for model in opus sonnet; do
      local f="$RESULTS_DIR/${slug}.${model}.1.json"
      if [[ ! -f "$f" ]]; then
        echo "MISSING: $f" >&2
        ((missing++)) || true
      fi
    done
  done

  # Phase 2.2 adversarial non-Q-G21 (10)
  for slug in "${ADVERSARIAL_NON_Q21_SLUGS[@]}"; do
    for model in opus sonnet; do
      local f="$RESULTS_DIR/${slug}.${model}.1.json"
      if [[ ! -f "$f" ]]; then
        echo "MISSING: $f" >&2
        ((missing++)) || true
      fi
    done
  done

  # Phase 2.3 Q-G21 (8)
  for slug in "${Q21_SLUGS[@]}"; do
    for model in opus sonnet; do
      for r in 1 2; do
        local f="$RESULTS_DIR/${slug}.${model}.${r}.json"
        if [[ ! -f "$f" ]]; then
          echo "MISSING: $f" >&2
          ((missing++)) || true
        fi
      done
    done
  done

  if [[ $missing -eq 0 ]]; then
    echo "All expected files present (48 + any escalations)."
  else
    echo "$missing files missing. Re-run before proceeding to Phase 3."
    exit 1
  fi
  echo ""
}

# Apply decision gate
apply_gate() {
  local overall_pct="$1"
  local opus_floor="$2"
  local q21_gate="$3"    # "PASS" or "FAIL"
  local adversarial_regressions="$4"
  local quality_gate="$5"  # "PASS" or "FAIL"

  local tier1_threshold=$(( opus_floor - 3 ))
  local null_threshold=$(( opus_floor - 5 ))

  echo "## Decision Gate"
  echo ""
  echo "| Gate | Threshold | Actual | Result |"
  echo "|------|-----------|--------|--------|"
  echo "| Overall agreement | ≥${tier1_threshold}% | ${overall_pct}% | $([[ $overall_pct -ge $tier1_threshold ]] && echo PASS || echo FAIL) |"
  echo "| Q-G21 binary gate | PASS on both fixtures | $q21_gate | $q21_gate |"
  echo "| Adversarial regressions | 0 | $adversarial_regressions | $([[ $adversarial_regressions -eq 0 ]] && echo PASS || echo FAIL) |"
  echo "| Finding quality | ≥2/3 fixtures | $quality_gate | $quality_gate |"
  echo ""

  if [[ $overall_pct -ge $tier1_threshold && "$q21_gate" == "PASS" && $adversarial_regressions -eq 0 && "$quality_gate" == "PASS" ]]; then
    echo "**DECISION: Tier 1 — Full downgrade to Sonnet**"
    echo "Action: Edit SKILL.md:1280 — change model=\"opus\" to model=\"sonnet\""
  elif [[ $overall_pct -ge $tier1_threshold && $adversarial_regressions -eq 0 && "$quality_gate" == "PASS" ]]; then
    echo "**DECISION: Tier 2 — Split downgrade**"
    echo "Action: Split l1_advisory_structural into:"
    echo "  - l1_advisory_structural_opus (Q-G21 only, model=opus)"
    echo "  - l1_advisory_structural_sonnet (Q-G20/G22/G23/G24/G25, model=sonnet)"
  else
    echo "**DECISION: Null — Retain model=opus**"
    echo "Action: No SKILL.md change. Write null-result to wiki/entities/review-plan-model-tiering.md"
  fi
  echo ""
}

main() {
  echo "# L1-Advisory-Structural Spike Analysis"
  echo "**Date:** $(date +%Y-%m-%d)"
  echo ""

  check_expected_files

  # Phase 2.0
  OPUS_FLOOR_COMPUTED=0
  compute_opus_baseline
  local opus_floor=$OPUS_FLOOR_COMPUTED

  # Phase 3
  compute_verdict_matrix "$opus_floor"

  echo ""
  echo "---"
  echo "_Run with: ./tools/l1-structural-spike-analyze.sh_"
  echo "_Results in: $RESULTS_DIR_"
}

# Write to both stdout and the matrix file
main "$@" | tee "$MATRIX_OUT"
echo "Matrix written to: $MATRIX_OUT"
