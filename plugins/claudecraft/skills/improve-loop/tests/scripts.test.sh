#!/usr/bin/env bash
# API-free regression for improve-loop L3 scripts.
# Exit 0 = pass; nonzero = fail.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/improve-loop-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0
assert() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name" >&2
    fail=$((fail + 1))
  fi
}

# --- fixture repo ---
REPO="$TMP/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q -b main
git -C "$REPO" config user.email "test@example.com"
git -C "$REPO" config user.name "Test"
echo "hi" >"$REPO/README"
git -C "$REPO" add README
git -C "$REPO" commit -q -m "init"

# shell-probe
chmod +x "$SCRIPTS/shell-probe.sh"
assert "shell-probe ok" bash "$SCRIPTS/shell-probe.sh" --repo "$REPO"
assert "shell-probe missing repo fails" bash -c \
  "! bash \"$SCRIPTS/shell-probe.sh\" 2>/dev/null"

# worktree-enter cold-start
OUT="$TMP/enter.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO" --target "unit test target" \
  --test-command "true" >"$OUT"
assert "enter has mode cold-start" grep -q '"mode": "cold-start"' "$OUT"
WS="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT")"
assert "workspace exists" test -d "$WS"
assert "gitignore has .worktrees/" grep -qx '.worktrees/' "$REPO/.gitignore"
assert "pointer exists" test -f "$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).pointer)" "$OUT")"

# resume same worktree
OUT2="$TMP/enter2.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO" --target "unit test target" >"$OUT2"
assert "second enter is resume" grep -q '"mode": "resume"' "$OUT2"
WS2="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT2")"
assert "same workspace on resume" test "$WS" = "$WS2"

# ledger-status empty
LS="$TMP/ls.json"
node "$SCRIPTS/ledger-status.js" --workspace "$WS" >"$LS"
assert "ledger absent" grep -q '"ledger_present": false' "$LS"

# seed ledger and re-parse
cat >"$WS/IMPROVE_LOOP.md" <<'EOF'
# Improve Loop: unit test target

**Test command:** `true`
**Started:** 2026-07-17          **Status:** active
**Iteration counter:** 1

## Isolation
- **launch_root:** x
- **campaign_branch:** improve/x
- **worktree_path:** y

## Backlog
- [ ] do a thing — why
- [x] done thing — done 2026-07-17

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)

## Log
### Iteration 1 — 2026-07-17
**Thesis:** t
**Test result:** PASS
**Outcome:** partial
**Error signature:** none
**Committed:** pending
**Notes for next cycle:** n
EOF

node "$SCRIPTS/ledger-status.js" --workspace "$WS" >"$LS"
assert "status active" grep -q '"status": "active"' "$LS"
assert "open backlog 1" grep -q '"open_backlog": 1' "$LS"
assert "log iterations 1" grep -q '"log_iterations": 1' "$LS"
assert "not landed pending" grep -q '"landed": false' "$LS"

# pointer read/write via pointer.mjs
GCD="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || git -C "$REPO" rev-parse --git-common-dir)"
# if relative, resolve
case "$GCD" in
  /*) ;;
  *) GCD="$(cd "$REPO" && cd "$GCD" && pwd)" ;;
esac
node "$SCRIPTS/pointer.js" read --git-common-dir "$GCD" >"$TMP/ptr.json"
assert "pointer read ok" grep -q '"state": "active"' "$TMP/ptr.json"

# migrate path: fresh repo with untracked launch ledger, no pointer
REPO2="$TMP/repo2"
mkdir -p "$REPO2"
git -C "$REPO2" init -q -b main
git -C "$REPO2" config user.email "test@example.com"
git -C "$REPO2" config user.name "Test"
echo x >"$REPO2/README"
git -C "$REPO2" add README
git -C "$REPO2" commit -q -m "init"
cat >"$REPO2/IMPROVE_LOOP.md" <<'EOF'
# Improve Loop: legacy

**Test command:** `true`
**Started:** 2026-07-17          **Status:** active
**Iteration counter:** 1

## Backlog
- [ ] leftover — why

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)

## Log
### Iteration 1 — 2026-07-17
**Thesis:** old
**Test result:** PASS
**Outcome:** partial
**Error signature:** none
**Committed:** yes
**Notes for next cycle:** n
EOF
OUTM="$TMP/migrate.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO2" --target "legacy migrate" >"$OUTM"
assert "migrate mode" grep -q '"mode": "migrate"' "$OUTM"
WSM="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUTM")"
assert "migrated ledger in workspace" test -f "$WSM/IMPROVE_LOOP.md"
assert "launch ledger removed" test ! -f "$REPO2/IMPROVE_LOOP.md"
assert "isolation injected" grep -q '## Isolation' "$WSM/IMPROVE_LOOP.md"

# discard phrase
REPO3="$TMP/repo3"
mkdir -p "$REPO3"
git -C "$REPO3" init -q -b main
git -C "$REPO3" config user.email "test@example.com"
git -C "$REPO3" config user.name "Test"
echo x >"$REPO3/README"
git -C "$REPO3" add README
git -C "$REPO3" commit -q -m "init"
echo '# leftover' >"$REPO3/IMPROVE_LOOP.md"
OUTD="$TMP/discard.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO3" --target "disc" --discard-legacy >"$OUTD"
assert "discard-cold-start" grep -q '"mode": "discard-cold-start"' "$OUTD"
assert "discard removed launch ledger" test ! -f "$REPO3/IMPROVE_LOOP.md"

echo "---"
echo "passed=$pass failed=$fail"
[[ "$fail" -eq 0 ]]
