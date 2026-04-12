#!/usr/bin/env bash
# l1-structural-spike.sh — Spike harness for l1-advisory-structural Sonnet vs Opus
# ONE-OFF — delete after spike completes (post Phase 5)
#
# Usage: ./tools/l1-structural-spike.sh [--phase 2.0|2.1|2.2|2.3] [--dry-run]
#
# This script documents the execution pattern for the spike. Actual runs are dispatched
# as Agent subagents (Claude Code Task tool) because bash cannot invoke Task() directly.
# Use this script to understand the run schedule and to replay individual cells.
#
# Pre-registration artifact: ~/.claude/plans/artifacts/l1-structural-spike-20260412.md
# SKILL.md SHA: 44780fbbb11797c5d34b9d2e488f91119cb2526d

set -eo pipefail

SKILL_MD="$HOME/.claude/skills/review-plan/SKILL.md"
QUESTIONS_MD="$HOME/.claude/skills/review-plan/QUESTIONS.md"
BENCH_DIR="$HOME/.claude/skills/review-plan/inputs/bench"
PROBES_DIR="$HOME/.claude/skills/review-plan/probes"
RESULTS_DIR="$HOME/.claude/plans/artifacts/spike-runs"
SKILL_SHA="44780fbbb11797c5d34b9d2e488f91119cb2526d"

# Verify SKILL.md is on the expected commit
verify_skill_sha() {
  local current_sha
  current_sha=$(git -C "$(dirname "$SKILL_MD")" log -1 --format="%H" -- skills/review-plan/SKILL.md 2>/dev/null || echo "unknown")
  # Note: SKILL.md is in ~/.claude/ (symlink from claude-craft), so check the symlink target
  if [[ "$current_sha" != "$SKILL_SHA" && "$current_sha" != "unknown" ]]; then
    echo "WARNING: SKILL.md SHA mismatch (expected $SKILL_SHA, got $current_sha)" >&2
    echo "All 19 fixtures must run on the same SKILL.md commit. Restart if SKILL.md changed." >&2
  fi
}

# Extract evaluator prompt from SKILL.md (lines 1282-1363)
extract_evaluator_prompt() {
  sed -n '1282,1363p' "$SKILL_MD"
}

# Corpus definition
declare -A FIXTURE_SLUGS

# Adversarial (5 non-Q-G21 + 1 Q-G21)
ADVERSARIAL_FIXTURES=(
  "bench-adversarial-bolt-on.md:adversarial-bolt-on"
  "bench-adversarial-contradictory.md:adversarial-contradictory"  # Q-G21 primary
  "bench-adversarial-large-migration.md:adversarial-large-migration"
  "bench-adversarial-overscope.md:adversarial-overscope"
  "bench-adversarial-vague-auth.md:adversarial-vague-auth"
  "bench-adversarial-wrong-context.md:adversarial-wrong-context"
)

# Neutral (12)
NEUTRAL_FIXTURES=(
  "bench-blue-green-deploy.md:blue-green-deploy"
  "bench-cache-aside-api.md:cache-aside-api"
  "bench-db-migration.md:db-migration"
  "bench-gas-sidebar.md:gas-sidebar"
  "bench-go-cli-tool.md:go-cli-tool"
  "bench-nextjs-feature.md:nextjs-feature"
  "bench-python-api-auth.md:python-api-auth"
  "bench-python-data-pipeline.md:python-data-pipeline"
  "bench-react-dashboard.md:react-dashboard"
  "bench-rust-library.md:rust-library"
  "bench-shared-auth-library.md:shared-auth-library"
  "bench-terraform-infra.md:terraform-infra"
)

# Q-G21 probe
Q21_PROBE="probes/probe-3-cross-phase-contradiction.md:probe-3-cross-phase-contradiction"

# Phase 2.0: Opus self-agreement baseline
# N=3 on bench-adversarial-contradictory + probe-3 with model=opus
phase_2_0() {
  echo "=== Phase 2.0: Opus self-agreement baseline ==="
  echo "Targets: adversarial-contradictory + probe-3-cross-phase-contradiction"
  echo "N=3 replicates each, model=opus"
  echo ""
  echo "Run schedule (6 Agent calls, dispatch in parallel):"
  for slug in "adversarial-contradictory" "probe-3-cross-phase-contradiction"; do
    for r in 1 2 3; do
      local out="$RESULTS_DIR/${slug}.opus.baseline.${r}.json"
      echo "  Agent(model=opus): $slug → $out"
    done
  done
}

# Phase 2.1: Neutral fixtures (N=1 each model)
phase_2_1() {
  echo "=== Phase 2.1: Neutral fixtures ==="
  echo "N=1 per model × 12 fixtures = 24 Agent calls"
  for entry in "${NEUTRAL_FIXTURES[@]}"; do
    local slug="${entry##*:}"
    for model in opus sonnet; do
      echo "  Agent(model=$model): $slug → $RESULTS_DIR/${slug}.${model}.1.json"
    done
  done
}

# Phase 2.2: Adversarial non-Q-G21 (N=1 each model)
phase_2_2() {
  echo "=== Phase 2.2: Adversarial non-Q-G21 fixtures ==="
  echo "N=1 per model × 5 fixtures = 10 Agent calls"
  for entry in "${ADVERSARIAL_FIXTURES[@]}"; do
    local slug="${entry##*:}"
    if [[ "$slug" != "adversarial-contradictory" ]]; then
      for model in opus sonnet; do
        echo "  Agent(model=$model): $slug → $RESULTS_DIR/${slug}.${model}.1.json"
      done
    fi
  done
}

# Phase 2.3: Q-G21 load-bearing fixtures (N=2 per model)
phase_2_3() {
  echo "=== Phase 2.3: Q-G21 load-bearing fixtures ==="
  echo "N=2 per model × 2 fixtures = 8 Agent calls"
  for slug in "adversarial-contradictory" "probe-3-cross-phase-contradiction"; do
    for model in opus sonnet; do
      for r in 1 2; do
        echo "  Agent(model=$model): $slug → $RESULTS_DIR/${slug}.${model}.${r}.json"
      done
    done
  done
}

main() {
  local phase="${1:-all}"
  local dry_run="${2:-}"

  verify_skill_sha

  echo "Spike harness — l1-advisory-structural Sonnet vs Opus"
  echo "SKILL.md SHA: $SKILL_SHA"
  echo "Evaluator prompt: sed -n '1282,1363p' $SKILL_MD"
  echo "Questions: $QUESTIONS_MD"
  echo "Results: $RESULTS_DIR"
  echo ""

  case "$phase" in
    "2.0") phase_2_0 ;;
    "2.1") phase_2_1 ;;
    "2.2") phase_2_2 ;;
    "2.3") phase_2_3 ;;
    "all")
      phase_2_0
      phase_2_1
      phase_2_2
      phase_2_3
      echo ""
      echo "Total scheduled: 6 + 24 + 10 + 8 = 48 Agent calls"
      echo "Run analysis: ./tools/l1-structural-spike-analyze.sh"
      ;;
  esac
}

main "$@"
