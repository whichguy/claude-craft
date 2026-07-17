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
# gitignore is on WORKSPACE (not LAUNCH) so launch is not merge-blocked by untracked .gitignore
assert "workspace gitignore has .worktrees/ (cold-start)" grep -qx '.worktrees/' "$WS/.gitignore"
assert "pointer exists" test -f "$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).pointer)" "$OUT")"
# suggested_cwd must be durable LAUNCH (not disposable worktree).
# Compare to JSON launch (same canonicalization as scripts) — not bare `pwd`,
# which on macOS can be /var/... while realpath is /private/var/...
assert "enter has suggested_cwd" grep -q '"suggested_cwd"' "$OUT"
SCWD="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).suggested_cwd)" "$OUT")"
LAUNCH_ABS="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).launch)" "$OUT")"
assert "enter suggested_cwd is launch" test "$SCWD" = "$LAUNCH_ABS"
assert "enter suggested_cwd is not workspace" test "$SCWD" != "$WS"

# default second enter: discard-stale + cold-start (new worktree), not resume
OUT2="$TMP/enter2.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO" --target "unit test target" >"$OUT2"
assert "second enter discards stale" grep -qE '"mode": "discard-stale-cold-start"|"mode": "cold-start"' "$OUT2"
assert "second enter notes discarded" grep -q 'discarded-stale-campaign' "$OUT2"
WS2="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT2")"
assert "second enter new workspace" test "$WS" != "$WS2"
assert "old workspace gone" test ! -d "$WS"

# --resume re-enters same worktree (opt-in)
# create fresh for resume test
OUTR="$TMP/enter-resume.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO" --target "resume target" --test-command "true" >"$OUTR"
WSR="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUTR")"
OUTR2="$TMP/enter-resume2.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO" --target "resume target" --resume >"$OUTR2"
assert "resume mode" grep -q '"mode": "resume"' "$OUTR2"
WSR2="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUTR2")"
assert "resume same workspace" test "$WSR" = "$WSR2"

# use WSR as active workspace for rest of suite (WS was discarded)
WS="$WSR"

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

# pointer read via pointer.js
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

# --- M1: launch must stay clean after cold-start (no merge-blocking .gitignore dirt) ---
REPO4="$TMP/repo4"
mkdir -p "$REPO4"
git -C "$REPO4" init -q -b main
git -C "$REPO4" config user.email "test@example.com"
git -C "$REPO4" config user.name "Test"
echo x >"$REPO4/README"
git -C "$REPO4" add README
git -C "$REPO4" commit -q -m "init"
OUT4="$TMP/enter4.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO4" --target "merge path" --test-command "true" >"$OUT4"
WS4="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT4")"
# Launch may show ?? .worktrees/ (isolation); must NOT show untracked .gitignore (would block FF)
LAUNCH_PORC="$(git -C "$REPO4" status --porcelain || true)"
assert "launch has no untracked .gitignore after cold-start" bash -c "! echo \"$LAUNCH_PORC\" | grep -q 'gitignore'"
assert "workspace gitignore ensured" test -f "$WS4/.gitignore"
assert "workspace gitignore has .worktrees/" grep -qx '.worktrees/' "$WS4/.gitignore"

# land a campaign commit including .gitignore, then merge-back
git -C "$WS4" add -- .gitignore
# optional tiny change so commit has substance if gitignore already tracked later
echo "line" >>"$WS4/README"
git -C "$WS4" add -- README .gitignore
git -C "$WS4" commit -q -m "improve-loop: iteration 1 — isolation gitignore + touch"
OUTMB="$TMP/mergeback.json"
set +e
node "$SCRIPTS/merge-back.js" --repo "$REPO4" >"$OUTMB" 2>"$TMP/mergeback.err"
MB_EC=$?
set -e
assert "merge-back exit 0" test "$MB_EC" -eq 0
assert "merge-back ok" grep -q '"merge_back": "ok"' "$OUTMB"
assert "merge-back ok flag" grep -q '"ok": true' "$OUTMB"
assert "merge-back has suggested_cwd" grep -q '"suggested_cwd"' "$OUTMB"
SCWD4="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).suggested_cwd)" "$OUTMB")"
LAUNCH4="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).launch||'')" "$OUTMB")"
# merge-back always sets suggested_cwd; launch key may be present — prefer launch, else not under .worktrees
if [[ -n "$LAUNCH4" ]]; then
  assert "merge-back suggested_cwd is launch" test "$SCWD4" = "$LAUNCH4"
else
  assert "merge-back suggested_cwd not worktree" bash -c "! [[ \"$SCWD4\" == *'/.worktrees/'* ]]"
fi
# pointer cleared
GCD4="$(git -C "$REPO4" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [[ -z "$GCD4" || "$GCD4" != /* ]]; then
  GCD4="$(cd "$REPO4" && cd "$(git -C "$REPO4" rev-parse --git-common-dir)" && pwd)"
fi
assert "pointer cleared after merge-back" test ! -f "$GCD4/improve-loop/active.json"
# campaign branch gone
set +e
git -C "$REPO4" rev-parse --verify "improve/" >/dev/null 2>&1
# check no improve/* branches
IMPROVE_LEFT="$(git -C "$REPO4" branch --list 'improve/*' | wc -l | tr -d ' ')"
set -e
assert "campaign branch deleted" test "$IMPROVE_LEFT" = "0"
# launch has the README change from FF
assert "launch has merged README" grep -q line "$REPO4/README"

# pointer write/clear roundtrip
node "$SCRIPTS/pointer.js" write --git-common-dir "$GCD4" --json '{"version":1,"state":"active","worktree_path":"/tmp/x"}' >/dev/null
assert "pointer write creates file" test -f "$GCD4/improve-loop/active.json"
node "$SCRIPTS/pointer.js" clear --git-common-dir "$GCD4" >/dev/null
assert "pointer clear removes file" test ! -f "$GCD4/improve-loop/active.json"

# usage strings must not advertise .mjs
assert "worktree-enter usage is .js" bash -c "node \"$SCRIPTS/worktree-enter.js\" 2>&1 | grep -q worktree-enter.js"
assert "no .mjs in worktree-enter usage" bash -c "! node \"$SCRIPTS/worktree-enter.js\" 2>&1 | grep -q worktree-enter.mjs"

# tracked launch ledger → exit 5
REPO5="$TMP/repo5"
mkdir -p "$REPO5"
git -C "$REPO5" init -q -b main
git -C "$REPO5" config user.email "test@example.com"
git -C "$REPO5" config user.name "Test"
echo x >"$REPO5/README"
git -C "$REPO5" add README && git -C "$REPO5" commit -q -m init
echo '# L' >"$REPO5/IMPROVE_LOOP.md"
git -C "$REPO5" add IMPROVE_LOOP.md && git -C "$REPO5" commit -q -m ledger
set +e
node "$SCRIPTS/worktree-enter.js" --repo "$REPO5" --target t >/dev/null 2>"$TMP/t5.err"
EC5=$?
set -e
assert "tracked ledger exit 5" test "$EC5" -eq 5
assert "tracked ledger message" grep -q 'tracked launch' "$TMP/t5.err"

# code-dirty launch with untracked legacy ledger → exit 4
REPO6="$TMP/repo6"
mkdir -p "$REPO6"
git -C "$REPO6" init -q -b main
git -C "$REPO6" config user.email "test@example.com"
git -C "$REPO6" config user.name "Test"
echo x >"$REPO6/README"
git -C "$REPO6" add README && git -C "$REPO6" commit -q -m init
echo '# L' >"$REPO6/IMPROVE_LOOP.md"
echo dirty >"$REPO6/extra.c"
set +e
node "$SCRIPTS/worktree-enter.js" --repo "$REPO6" --target t >/dev/null 2>"$TMP/t6.err"
EC6=$?
set -e
assert "dirty launch migrate exit 4" test "$EC6" -eq 4
assert "dirty launch message" grep -q 'code-dirty' "$TMP/t6.err"

# reintegrate_blocked → merge-back-only mode
REPO7="$TMP/repo7"
mkdir -p "$REPO7"
git -C "$REPO7" init -q -b main
git -C "$REPO7" config user.email "test@example.com"
git -C "$REPO7" config user.name "Test"
echo x >"$REPO7/README"
git -C "$REPO7" add README && git -C "$REPO7" commit -q -m init
node "$SCRIPTS/worktree-enter.js" --repo "$REPO7" --target p >/dev/null
GCD7="$(git -C "$REPO7" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
if [[ -z "$GCD7" || "$GCD7" != /* ]]; then
  GCD7="$(cd "$REPO7" && cd "$(git -C "$REPO7" rev-parse --git-common-dir)" && pwd)"
fi
node "$SCRIPTS/pointer.js" set-reintegrate-blocked --git-common-dir "$GCD7" --error "test" >/dev/null
OUT7="$TMP/enter7.json"
# merge-back-only only with --resume (default discards stale)
node "$SCRIPTS/worktree-enter.js" --repo "$REPO7" --target p --resume >"$OUT7"
assert "reintegrate → merge-back-only" grep -q '"mode": "merge-back-only"' "$OUT7"
# default enter discards reintegrate_blocked instead of resume
node "$SCRIPTS/pointer.js" set-reintegrate-blocked --git-common-dir "$GCD7" --error "test2" >/dev/null 2>/dev/null || true
# re-create pointer blocked state after resume path may still hold it
PTR7="$GCD7/improve-loop/active.json"
if [[ -f "$PTR7" ]]; then
  node "$SCRIPTS/pointer.js" set-reintegrate-blocked --git-common-dir "$GCD7" --error "test2" >/dev/null
  OUT7b="$TMP/enter7b.json"
  node "$SCRIPTS/worktree-enter.js" --repo "$REPO7" --target p >"$OUT7b"
  assert "default discards reintegrate" grep -qE 'discard-stale-cold-start|cold-start' "$OUT7b"
fi

echo "---"
echo "passed=$pass failed=$fail"
[[ "$fail" -eq 0 ]]
