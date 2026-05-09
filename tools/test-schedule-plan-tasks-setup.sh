#!/usr/bin/env bash
# test-schedule-plan-tasks-setup.sh — bootstrap a scratch repo for the
# /schedule-plan-tasks integration cascade audit (consumed by the
# test-schedule-plan-tasks skill).
#
# Prepares:
#   $SCRATCH    — fresh git repo with plan.md
#   $AUDIT      — sibling dir for audit artifacts (pre/post state, EXPECTED.md)
#
# Does NOT invoke the skill (skills are not shell-callable) and does NOT collect
# post-run audit data (those require Claude Code session-scoped tools).

set -o pipefail
shopt -s nullglob

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
FIXTURE="$REPO_ROOT/plugins/planning-suite/skills/schedule-plan-tasks/fixtures/plan8-cascade-fan-in.md"

if [[ ! -f "$FIXTURE" ]]; then
  echo "FATAL: fixture missing: $FIXTURE" >&2
  exit 2
fi

TS="$(date +%s)"
SCRATCH="/tmp/spt-test-${TS}-$$"
AUDIT="/tmp/spt-test-${TS}-$$-audit"

cleanup_on_err() {
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "setup failed (rc=$rc); leaving $SCRATCH and $AUDIT for inspection" >&2
  fi
}
trap cleanup_on_err EXIT

mkdir -p "$SCRATCH" "$AUDIT"

git -C "$SCRATCH" init -q
git -C "$SCRATCH" config user.email "spt-test@example.invalid"
git -C "$SCRATCH" config user.name "spt-test"
git -C "$SCRATCH" commit --allow-empty -qm "init"

cp "$FIXTURE" "$SCRATCH/plan.md"

git -C "$SCRATCH" log --oneline --all > "$AUDIT/pre-state.log"
git -C "$SCRATCH" worktree list > "$AUDIT/pre-worktrees.log"
git -C "$SCRATCH" branch --show-current > "$AUDIT/pre-branch.log"

# Machine-derive expected chains from the lib if call shape matches; fall back
# to the hand-written template otherwise. Stderr is captured so that fallback
# cause is diagnosable (require failure vs empty output vs exit-2).
EXPECTED_NODE_OUT="$AUDIT/EXPECTED.md"
CHAIN_DETECT_ERR="$AUDIT/chain-detect-err.log"
if SPT_LIB_DIR="$REPO_ROOT/lib" node -e '
  const path = require("path");
  const cd = require(path.join(process.env.SPT_LIB_DIR, "chain-detect"));
  const fn = cd.detectChains || cd;
  if (typeof fn !== "function") process.exit(2);
  // Cascade edges: A->B, B->C, B->D, C->E, D->E, E->F
  const edges = [["A","B"],["B","C"],["B","D"],["C","E"],["D","E"],["E","F"]];
  const out = fn(edges);
  console.log("# EXPECTED — derived from lib/chain-detect");
  console.log("");
  console.log("Edges: A->B, B->C, B->D, C->E, D->E, E->F");
  console.log("");
  console.log("## chains");
  for (const c of (out.chains || [])) console.log("- [" + c.join(", ") + "]");
  console.log("");
  console.log("## standalones");
  console.log((out.standalones || []).map(s => "- " + s).join("\n") || "- (none)");
  console.log("");
  console.log("## roles");
  for (const k of Object.keys(out.roles || {})) console.log("- " + k + ": " + out.roles[k]);
' --no-warnings 2>"$CHAIN_DETECT_ERR" > "$EXPECTED_NODE_OUT.tmp" \
   && [[ -s "$EXPECTED_NODE_OUT.tmp" ]]; then
  mv "$EXPECTED_NODE_OUT.tmp" "$EXPECTED_NODE_OUT"
  EXPECTED_SOURCE="lib/chain-detect"
  # Successful path: drop the empty error log to avoid confusion.
  [[ -s "$CHAIN_DETECT_ERR" ]] || rm -f "$CHAIN_DETECT_ERR"
else
  rm -f "$EXPECTED_NODE_OUT.tmp"
  cat > "$EXPECTED_NODE_OUT" <<'EOF'
# EXPECTED — hand-written fallback (lib/chain-detect call shape did not match)

Edges: A->B, B->C, B->D, C->E, D->E, E->F

## chains
- [A, B]   (chain-1: A=head, B=tail)
- [E, F]   (chain-2: E=head, F=tail)

## standalones
- C        (chain_role: none)
- D        (chain_role: none)

## task counts (per SKILL.md:213-235)
- git-prep: 3
- create-wt: 4 (chain-1, C, D, chain-2)
- delivery-agent: 6 (A, B, C, D, E, F)
- regression: 1 (if present)
- TOTAL: 14 (or 13 if regression absent)

## fan-in
- chain-2 create-wt blocked by: B (chain-1 tail), C, D
- E delivery-agent blocked by: C and D delivery-agents
EOF
  EXPECTED_SOURCE="hand-written fallback (see $CHAIN_DETECT_ERR for cause)"
fi

cat <<EOF
SCRATCH=$SCRATCH
AUDIT=$AUDIT
EXPECTED_SOURCE=$EXPECTED_SOURCE

Next (run inside the same Claude Code session). The skill auto-discovers the
target branch from cwd via 'git branch --show-current', so cd first:
  cd "$SCRATCH"
  /schedule-plan-tasks --plan ./plan.md
Then: run the post-run audit checklist in the plan
      (Section "Audit capture" — TaskList/TaskGet, transcripts, decomposition,
       worktrees, REPORT.md → all written to \$AUDIT/).
EOF
