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
- [ ] P1: do a thing — why
- [x] P1: done thing — done 2026-07-17

## Deferred (P2)
- [ ] P2: later polish — not material this campaign
- [x] P2: dropped idea — done 2026-07-17 — obsolete

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)
- consecutive-non-material-cycles: 0

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
assert "open deferred 1" grep -q '"open_deferred": 1' "$LS"
assert "checked deferred 1" grep -q '"checked_deferred": 1' "$LS"
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

# product dirt + untracked legacy ledger → carry WIP + migrate/discard (no longer exit 4)
REPO6="$TMP/repo6"
mkdir -p "$REPO6"
git -C "$REPO6" init -q -b main
git -C "$REPO6" config user.email "test@example.com"
git -C "$REPO6" config user.name "Test"
echo x >"$REPO6/README"
git -C "$REPO6" add README && git -C "$REPO6" commit -q -m init
echo '# L' >"$REPO6/IMPROVE_LOOP.md"
echo dirty >"$REPO6/extra.c"
OUT6="$TMP/enter6.json"
set +e
node "$SCRIPTS/worktree-enter.js" --repo "$REPO6" --target t >"$OUT6" 2>"$TMP/t6.err"
EC6=$?
set -e
assert "dirty launch with untracked ledger exit 0" test "$EC6" -eq 0
assert "dirty launch notes carry" grep -qE 'carried-launch-wip:|carried-paths:extra.c' "$OUT6"
WS6="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT6")"
assert "extra.c carried into workspace" test -f "$WS6/extra.c"
assert "extra.c content in workspace" grep -q dirty "$WS6/extra.c"
assert "extra.c cleaned from launch" test ! -f "$REPO6/extra.c"

# After carry: second default enter must FAIL CLOSED (exit 10) — do not destroy WIP
OUT6b="$TMP/enter6b.json"
set +e
node "$SCRIPTS/worktree-enter.js" --repo "$REPO6" --target t >"$OUT6b" 2>"$TMP/t6b.err"
EC6b=$?
set -e
assert "second enter after carry exit 10" test "$EC6b" -eq 10
assert "second enter after carry stderr blocked" grep -q 'carried-wip-discard-blocked' "$TMP/t6b.err"
assert "second enter after carry worktree kept" test -d "$WS6"
assert "second enter after carry WIP still in worktree" test -f "$WS6/extra.c"
# --resume still works after carry
OUT6r="$TMP/enter6-resume.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO6" --target t --resume >"$OUT6r"
assert "resume after carry mode resume" grep -q '"mode": "resume"' "$OUT6r"
WS6r="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT6r")"
assert "resume after carry same workspace" test "$WS6" = "$WS6r"
assert "resume after carry WIP intact" test -f "$WS6r/extra.c"

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

# --- resolve-target-repo.js ---
RESOLVE="$SCRIPTS/resolve-target-repo.js"
assert "resolve-target-repo exists" test -f "$RESOLVE"

# Fake product git repo + claude-home install symlink
PROD="$TMP/prod-repo"
mkdir -p "$PROD/skills/widget"
git -C "$PROD" init -q -b main
git -C "$PROD" config user.email "test@example.com"
git -C "$PROD" config user.name "Test"
echo 'skill' >"$PROD/skills/widget/SKILL.md"
git -C "$PROD" add skills/widget/SKILL.md && git -C "$PROD" commit -q -m init

FAKE_HOME="$TMP/fake-claude"
mkdir -p "$FAKE_HOME/skills"
ln -s "$PROD/skills/widget" "$FAKE_HOME/skills/widget"

OUT_R="$TMP/resolve-symlink.json"
set +e
node "$RESOLVE" --target-path "$FAKE_HOME/skills/widget" --claude-home "$FAKE_HOME" >"$OUT_R" 2>"$TMP/resolve.err"
EC_R=$?
set -e
assert "symlink under claude-home exit 0" test "$EC_R" -eq 0
assert "symlink_followed true" grep -q '"symlink_followed": true' "$OUT_R"
assert "notes left-home" grep -q 'symlink-followed-left-home' "$OUT_R"
PROD_REAL="$(cd "$PROD" && pwd -P)"
assert "target_repo is product" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_R" "$PROD_REAL"

# File symlink under claude-home
ln -sf "$PROD/skills/widget/SKILL.md" "$FAKE_HOME/skills/widget-skill.md"
OUT_RF="$TMP/resolve-file-symlink.json"
node "$RESOLVE" --target-path "$FAKE_HOME/skills/widget-skill.md" --claude-home "$FAKE_HOME" >"$OUT_RF"
assert "file symlink followed" grep -q '"symlink_followed": true' "$OUT_RF"
assert "file symlink target_repo product" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_RF" "$PROD_REAL"

# Path *inside* package-dir install symlink (leaf not a symlink; common agent CAND=SKILL.md)
OUT_IN="$TMP/resolve-inside-pkg.json"
node "$RESOLVE" --target-path "$FAKE_HOME/skills/widget/SKILL.md" --claude-home "$FAKE_HOME" >"$OUT_IN"
assert "inside pkg is_symlink false" grep -q '"is_symlink": false' "$OUT_IN"
assert "inside pkg symlink_followed true" grep -q '"symlink_followed": true' "$OUT_IN"
assert "inside pkg notes left-home" grep -q 'symlink-followed-left-home' "$OUT_IN"
assert "inside pkg target_repo product" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_IN" "$PROD_REAL"

# Real directory under claude-home (not a symlink) → that tree's git root, not invent another
REAL_DIR="$FAKE_HOME/skills/real-skill"
mkdir -p "$REAL_DIR"
# make fake-claude itself a git repo so non-symlink under home has a root
git -C "$FAKE_HOME" init -q -b main 2>/dev/null || true
git -C "$FAKE_HOME" config user.email "test@example.com"
git -C "$FAKE_HOME" config user.name "Test"
echo x >"$FAKE_HOME/README"
git -C "$FAKE_HOME" add README 2>/dev/null || true
git -C "$FAKE_HOME" commit -q -m init-home 2>/dev/null || true
echo 'real' >"$REAL_DIR/SKILL.md"
OUT_REAL="$TMP/resolve-real.json"
node "$RESOLVE" --target-path "$REAL_DIR" --claude-home "$FAKE_HOME" >"$OUT_REAL"
assert "real dir not symlink_followed" grep -q '"symlink_followed": false' "$OUT_REAL"
assert "real dir stayed-home note" grep -q 'under-claude-home-realpath-stayed' "$OUT_REAL"
HOME_REAL="$(cd "$FAKE_HOME" && pwd -P)"
assert "real dir target is fake home git" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_REAL" "$HOME_REAL"

# Leaf symlink under home that stays under home (alias → real sibling)
mkdir -p "$FAKE_HOME/skills/real-sibling"
echo 'sib' >"$FAKE_HOME/skills/real-sibling/SKILL.md"
ln -sfn "$FAKE_HOME/skills/real-sibling" "$FAKE_HOME/skills/alias-skill"
OUT_ALIAS="$TMP/resolve-internal-alias.json"
node "$RESOLVE" --target-path "$FAKE_HOME/skills/alias-skill" --claude-home "$FAKE_HOME" >"$OUT_ALIAS"
assert "internal alias followed" grep -q '"symlink_followed": true' "$OUT_ALIAS"
assert "internal alias within-home note" grep -q 'symlink-followed-within-home' "$OUT_ALIAS"
assert "internal alias target home git" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_ALIAS" "$HOME_REAL"

# Broken symlink → exit 3
ln -sf "$TMP/does-not-exist-xyz" "$FAKE_HOME/skills/broken"
set +e
node "$RESOLVE" --target-path "$FAKE_HOME/skills/broken" --claude-home "$FAKE_HOME" >"$TMP/resolve-broken.out" 2>"$TMP/resolve-broken.err"
EC_B=$?
set -e
assert "broken symlink exit 3" test "$EC_B" -eq 3
assert "broken symlink message" grep -qi 'broken' "$TMP/resolve-broken.err"

# Missing path → exit 2
set +e
node "$RESOLVE" --target-path "$TMP/no-such-path" --claude-home "$FAKE_HOME" >/dev/null 2>"$TMP/resolve-miss.err"
EC_M=$?
set -e
assert "missing path exit 2" test "$EC_M" -eq 2

# Outside claude-home normal repo (no forced symlink rule)
OUT_OUT="$TMP/resolve-outside.json"
node "$RESOLVE" --target-path "$PROD" --claude-home "$FAKE_HOME" >"$OUT_OUT"
assert "outside path exit ok" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_OUT" "$PROD_REAL"
assert "outside not symlink_followed" grep -q '"symlink_followed": false' "$OUT_OUT"

# Symlink outside claude-home: still resolves git root; not install-follow
OUT_LINK="$TMP/outlink"
ln -sfn "$PROD" "$OUT_LINK"
OUT_OS="$TMP/resolve-outside-symlink.json"
node "$RESOLVE" --target-path "$OUT_LINK" --claude-home "$FAKE_HOME" >"$OUT_OS"
assert "outside symlink target product" node -e "
const fs=require('fs'); const path=require('path');
const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
process.exit(path.resolve(j.target_repo)===path.resolve(process.argv[2])?0:1)
" "$OUT_OS" "$PROD_REAL"
assert "outside symlink not install-followed" grep -q '"symlink_followed": false' "$OUT_OS"
assert "outside symlink note" grep -q 'symlink-outside-claude-home' "$OUT_OS"

# Usage missing --target-path → exit 1
set +e
node "$RESOLVE" >/dev/null 2>&1
EC_U=$?
set -e
assert "usage exit 1" test "$EC_U" -eq 1

# Path with no git root → exit 4
NOGIT="$TMP/nogit-dir"
mkdir -p "$NOGIT"
OUT_NG="$TMP/resolve-nogit.json"
set +e
node "$RESOLVE" --target-path "$NOGIT" --claude-home "$FAKE_HOME" >"$OUT_NG" 2>/dev/null
EC_NG=$?
set -e
assert "no git root exit 4" test "$EC_NG" -eq 4
assert "no git target_repo null" grep -q '"target_repo": null' "$OUT_NG"

# porcelainPath: standard XY + tolerant single-status (observed with multi-worktree)
assert "porcelainPath standard" node -e "
const {porcelainPath}=require('$SCRIPTS/lib-paths.js');
process.exit(porcelainPath(' M cron/jobs.json')==='cron/jobs.json'?0:1)
"
assert "porcelainPath single-status tolerant" node -e "
const {porcelainPath}=require('$SCRIPTS/lib-paths.js');
process.exit(porcelainPath('M cron/jobs.json')==='cron/jobs.json'?0:1)
"
assert "porcelainPath untracked" node -e "
const {porcelainPath}=require('$SCRIPTS/lib-paths.js');
process.exit(porcelainPath('?? .worktrees/')==='.worktrees/'?0:1)
"

# --- Ambient launch dirt: carried into worktree then cleaned on launch ---
# Default ambient prefixes still matter for merge-back mid-campaign; enter carries all non-ignored WIP.
REPO_AMB="$TMP/repo-ambient"
mkdir -p "$REPO_AMB/cron" "$REPO_AMB/wiki"
git -C "$REPO_AMB" init -q -b main
git -C "$REPO_AMB" config user.email "test@example.com"
git -C "$REPO_AMB" config user.name "Test"
echo x >"$REPO_AMB/README"
echo '{}' >"$REPO_AMB/cron/jobs.json"
echo 'log' >"$REPO_AMB/wiki/log.md"
git -C "$REPO_AMB" add README cron/jobs.json wiki/log.md
git -C "$REPO_AMB" commit -q -m init
# dirty ambient only
echo changed >"$REPO_AMB/cron/jobs.json"
echo more >>"$REPO_AMB/wiki/log.md"
OUT_AMB="$TMP/enter-ambient.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO_AMB" --target "ambient dirty" --test-command "true" >"$OUT_AMB"
assert "ambient dirty still cold-starts" grep -qE '"mode": "cold-start"|"mode": "discard-stale-cold-start"' "$OUT_AMB"
assert "ambient dirty carried note" grep -q 'carried-launch-wip:' "$OUT_AMB"
WS_AMB="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT_AMB")"
assert "ambient carried into workspace" grep -q changed "$WS_AMB/cron/jobs.json"
assert "ambient cleaned from launch after enter" bash -c "! grep -q changed \"$REPO_AMB/cron/jobs.json\""
echo y >>"$WS_AMB/README"
# commit ambient + README so merge-back keeps carried work
git -C "$WS_AMB" add README cron/jobs.json wiki/log.md
[[ -f "$WS_AMB/.gitignore" ]] && git -C "$WS_AMB" add .gitignore || true
git -C "$WS_AMB" commit -q -m "improve-loop: iteration 1 — ambient merge path"
OUT_MB_AMB="$TMP/mergeback-ambient.json"
set +e
node "$SCRIPTS/merge-back.js" --repo "$REPO_AMB" >"$OUT_MB_AMB" 2>"$TMP/mergeback-ambient.err"
MB_AMB_EC=$?
set -e
assert "merge-back clean launch exit 0" test "$MB_AMB_EC" -eq 0
assert "merge-back ok after carry" grep -q '"merge_back": "ok"' "$OUT_MB_AMB"
assert "merge-back worktree_removed true" grep -q '"worktree_removed": true' "$OUT_MB_AMB"
assert "merge-back pointer_cleared true" grep -q '"pointer_cleared": true' "$OUT_MB_AMB"
assert "ambient landed on launch after FF" grep -q changed "$REPO_AMB/cron/jobs.json"

# Ambient + real code dirt → still block merge-back
REPO_MIX="$TMP/repo-mix"
mkdir -p "$REPO_MIX/cron"
git -C "$REPO_MIX" init -q -b main
git -C "$REPO_MIX" config user.email "test@example.com"
git -C "$REPO_MIX" config user.name "Test"
echo x >"$REPO_MIX/README"
echo '{}' >"$REPO_MIX/cron/jobs.json"
git -C "$REPO_MIX" add README cron/jobs.json
git -C "$REPO_MIX" commit -q -m init
node "$SCRIPTS/worktree-enter.js" --repo "$REPO_MIX" --target "mix dirt" --test-command "true" >/dev/null
WS_MIX="$(node -e "
const fs=require('fs'); const p=require('path');
const gcd=require('child_process').execFileSync('git',['-C',process.argv[1],'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim();
const ptr=JSON.parse(fs.readFileSync(p.join(gcd,'improve-loop','active.json'),'utf8'));
console.log(ptr.worktree_path);
" "$REPO_MIX")"
echo y >>"$WS_MIX/README"
git -C "$WS_MIX" add README
[[ -f "$WS_MIX/.gitignore" ]] && git -C "$WS_MIX" add .gitignore || true
git -C "$WS_MIX" commit -q -m "improve-loop: iteration 1 — mix"
echo ambient >"$REPO_MIX/cron/jobs.json"
echo code >"$REPO_MIX/extra.c"
OUT_MB_MIX="$TMP/mergeback-mix.json"
set +e
node "$SCRIPTS/merge-back.js" --repo "$REPO_MIX" >"$OUT_MB_MIX" 2>"$TMP/mergeback-mix.err"
MB_MIX_EC=$?
set -e
assert "merge-back blocks code dirt exit 3" test "$MB_MIX_EC" -eq 3
assert "merge-back blocked mode" grep -q '"merge_back": "blocked"' "$OUT_MB_MIX"
assert "merge-back error lists extra.c" grep -q 'extra.c' "$OUT_MB_MIX"

# Empty ambient prefixes → cron dirt blocks (strict)
REPO_STRICT="$TMP/repo-strict"
mkdir -p "$REPO_STRICT/cron"
git -C "$REPO_STRICT" init -q -b main
git -C "$REPO_STRICT" config user.email "test@example.com"
git -C "$REPO_STRICT" config user.name "Test"
echo x >"$REPO_STRICT/README"
echo '{}' >"$REPO_STRICT/cron/jobs.json"
git -C "$REPO_STRICT" add README cron/jobs.json
git -C "$REPO_STRICT" commit -q -m init
node "$SCRIPTS/worktree-enter.js" --repo "$REPO_STRICT" --target "strict" --test-command "true" >/dev/null
WS_ST="$(node -e "
const fs=require('fs'); const p=require('path');
const gcd=require('child_process').execFileSync('git',['-C',process.argv[1],'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim();
const ptr=JSON.parse(fs.readFileSync(p.join(gcd,'improve-loop','active.json'),'utf8'));
console.log(ptr.worktree_path);
" "$REPO_STRICT")"
echo y >>"$WS_ST/README"
git -C "$WS_ST" add README
[[ -f "$WS_ST/.gitignore" ]] && git -C "$WS_ST" add .gitignore || true
git -C "$WS_ST" commit -q -m "improve-loop: iteration 1 — strict"
echo amb >"$REPO_STRICT/cron/jobs.json"
OUT_MB_ST="$TMP/mergeback-strict.json"
set +e
IMPROVE_LOOP_AMBIENT_PREFIXES=- node "$SCRIPTS/merge-back.js" --repo "$REPO_STRICT" >"$OUT_MB_ST" 2>/dev/null
MB_ST_EC=$?
set -e
assert "strict ambient empty blocks cron exit 3" test "$MB_ST_EC" -eq 3
assert "strict blocked" grep -q '"merge_back": "blocked"' "$OUT_MB_ST"

# --- Carry launch WIP into worktree (diff/apply + untracked copy + clean launch) ---
CARRY_JS="$SCRIPTS/carry-launch-wip.js"
assert "carry-launch-wip.js exists" test -f "$CARRY_JS"
set +e
node "$CARRY_JS" --self-test >"$TMP/carry-self.out" 2>"$TMP/carry-self.err"
CARRY_EC=$?
set -e
assert "carry-launch-wip self-test exit 0" test "$CARRY_EC" -eq 0

REPO_CARRY="$TMP/repo-carry"
mkdir -p "$REPO_CARRY"
git -C "$REPO_CARRY" init -q -b main
git -C "$REPO_CARRY" config user.email "test@example.com"
git -C "$REPO_CARRY" config user.name "Test"
echo base >"$REPO_CARRY/README"
echo keep >"$REPO_CARRY/keep.txt"
git -C "$REPO_CARRY" add README keep.txt
git -C "$REPO_CARRY" commit -q -m init
# tracked edit, tracked delete, untracked new
echo modified >"$REPO_CARRY/README"
rm -f "$REPO_CARRY/keep.txt"
echo brand >"$REPO_CARRY/new-untracked.txt"
OUT_CARRY="$TMP/enter-carry.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO_CARRY" --target "carry wip" --test-command "true" >"$OUT_CARRY"
assert "carry enter notes wip" grep -q 'carried-launch-wip:' "$OUT_CARRY"
WS_CARRY="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT_CARRY")"
assert "carry: README modified in workspace" grep -q modified "$WS_CARRY/README"
assert "carry: keep.txt deleted in workspace" test ! -f "$WS_CARRY/keep.txt"
assert "carry: untracked in workspace" test -f "$WS_CARRY/new-untracked.txt"
assert "carry: untracked content" grep -q brand "$WS_CARRY/new-untracked.txt"
assert "carry: launch README restored" grep -q base "$REPO_CARRY/README"
assert "carry: launch keep restored" test -f "$REPO_CARRY/keep.txt"
assert "carry: launch untracked removed" test ! -f "$REPO_CARRY/new-untracked.txt"
assert "carry: launch porcelain clean of product" bash -c \
  'n=$(git -C "'"$REPO_CARRY"'" status --porcelain | grep -v "\.worktrees" | grep -v "IMPROVE_LOOP" | grep -c . || true); test "$n" -eq 0'

# isolation not carried as freehand WIP (IMPROVE_LOOP.md untracked still migrates separately)
assert "listCarryCandidates filters isolation" node -e "
const {listCarryCandidates}=require('$CARRY_JS');
const {isIsolationDirt}=require('$SCRIPTS/lib-paths.js');
process.exit(isIsolationDirt('IMPROVE_LOOP.md')&&isIsolationDirt('.worktrees/x')?0:1)
"
assert "pathsFromPorcelainLine rename both sides" node -e "
const {pathsFromPorcelainLine}=require('$CARRY_JS');
const p=pathsFromPorcelainLine('R  oldname.txt -> newname.txt');
process.exit(p.length===2&&p[0]==='oldname.txt'&&p[1]==='newname.txt'?0:1)
"

# rename carry: both sides in diff; old gone in ws; launch restored
REPO_REN="$TMP/repo-rename"
mkdir -p "$REPO_REN"
git -C "$REPO_REN" init -q -b main
git -C "$REPO_REN" config user.email "test@example.com"
git -C "$REPO_REN" config user.name "Test"
echo x >"$REPO_REN/README"
echo body >"$REPO_REN/oldname.txt"
git -C "$REPO_REN" add README oldname.txt
git -C "$REPO_REN" commit -q -m init
git -C "$REPO_REN" mv oldname.txt newname.txt
echo extra >>"$REPO_REN/newname.txt"
OUT_REN="$TMP/enter-ren.json"
node "$SCRIPTS/worktree-enter.js" --repo "$REPO_REN" --target "rename carry" --test-command "true" >"$OUT_REN"
WS_REN="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).workspace)" "$OUT_REN")"
assert "rename: newname in workspace" test -f "$WS_REN/newname.txt"
assert "rename: oldname gone in workspace" test ! -f "$WS_REN/oldname.txt"
assert "rename: content in workspace" grep -q extra "$WS_REN/newname.txt"
assert "rename: oldname restored on launch" test -f "$REPO_REN/oldname.txt"
assert "rename: newname gone on launch" test ! -f "$REPO_REN/newname.txt"
assert "rename: launch no staged delete" bash -c \
  '! git -C "'"$REPO_REN"'" status --porcelain | grep -q "oldname\|newname"'

# --- Carry failure semantics (real worktree-enter entry point) ---
# APPLY_FAILED: leave launch dirty, tear down new worktree (no pointer).
REPO_AF="$TMP/repo-apply-fail"
mkdir -p "$REPO_AF"
git -C "$REPO_AF" init -q -b main
git -C "$REPO_AF" config user.email "test@example.com"
git -C "$REPO_AF" config user.name "Test"
echo base >"$REPO_AF/README"
git -C "$REPO_AF" add README && git -C "$REPO_AF" commit -q -m init
echo dirty >"$REPO_AF/README"
set +e
IMPROVE_LOOP_CARRY_FORCE_FAIL=apply \
  node "$SCRIPTS/worktree-enter.js" --repo "$REPO_AF" --target "apply fail" \
  >"$TMP/enter-af.out" 2>"$TMP/enter-af.err"
EC_AF=$?
set -e
assert "apply-fail enter exit 9" test "$EC_AF" -eq 9
assert "apply-fail launch still dirty" grep -q dirty "$REPO_AF/README"
assert "apply-fail no pointer" test ! -f "$(git -C "$REPO_AF" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)/improve-loop/active.json" \
  || test ! -f "$REPO_AF/.git/improve-loop/active.json"
# worktree dir should not remain under .worktrees (teardown)
WT_LEFT=$(find "$REPO_AF/.worktrees" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
assert "apply-fail worktree torn down" test "${WT_LEFT:-0}" -eq 0

# LAUNCH_CLEAN_FAILED: keep worktree (only WIP copy), leave launch dirty, no pointer.
REPO_CF="$TMP/repo-clean-fail"
mkdir -p "$REPO_CF"
git -C "$REPO_CF" init -q -b main
git -C "$REPO_CF" config user.email "test@example.com"
git -C "$REPO_CF" config user.name "Test"
echo base >"$REPO_CF/README"
git -C "$REPO_CF" add README && git -C "$REPO_CF" commit -q -m init
echo dirty >"$REPO_CF/README"
set +e
IMPROVE_LOOP_CARRY_FORCE_FAIL=clean \
  node "$SCRIPTS/worktree-enter.js" --repo "$REPO_CF" --target "clean fail" \
  >"$TMP/enter-cf.out" 2>"$TMP/enter-cf.err"
EC_CF=$?
set -e
assert "clean-fail enter exit 9" test "$EC_CF" -eq 9
assert "clean-fail launch still dirty" grep -q dirty "$REPO_CF/README"
assert "clean-fail stderr keeps workspace" grep -q 'workspace kept at' "$TMP/enter-cf.err"
# Extract kept path from stderr and assert WIP present there
KEPT_WS=$(sed -n 's/^worktree-enter: workspace kept at //p' "$TMP/enter-cf.err" | head -1 | tr -d '\r')
assert "clean-fail kept path exists" test -n "$KEPT_WS" -a -d "$KEPT_WS"
assert "clean-fail WIP in kept workspace" grep -q dirty "$KEPT_WS/README"
# campaign branch should still exist (not deleted on clean-fail keep path)
BR_CF=$(git -C "$REPO_CF" branch --list 'improve/clean-fail-*' | head -1 | tr -d ' *')
assert "clean-fail campaign branch kept" test -n "$BR_CF"

# Real APPLY_FAILED without force env (filesystem conflict): README dir blocks apply
assert "carry APPLY_FAILED real path" node -e "
const fs=require('fs'); const path=require('path'); const {execFileSync}=require('child_process');
const {carryLaunchWip}=require('$CARRY_JS');
const r=process.argv[1]; const ws=process.argv[2];
fs.mkdirSync(r,{recursive:true});
execFileSync('git',['-C',r,'init','-q','-b','main']);
execFileSync('git',['-C',r,'config','user.email','t@e.com']);
execFileSync('git',['-C',r,'config','user.name','T']);
fs.writeFileSync(path.join(r,'README'),'base\\n');
execFileSync('git',['-C',r,'add','README']);
execFileSync('git',['-C',r,'commit','-q','-m','init']);
fs.writeFileSync(path.join(r,'README'),'dirty\\n');
fs.mkdirSync(ws,{recursive:true});
fs.mkdirSync(path.join(ws,'README')); // wrong type → apply fails
try {
  carryLaunchWip(r, ws, {notes:[]});
  process.exit(2);
} catch(e) {
  if (e.code !== 'APPLY_FAILED') process.exit(3);
  if (!fs.readFileSync(path.join(r,'README'),'utf8').includes('dirty')) process.exit(4);
  process.exit(0);
}
" "$TMP/real-apply-fail-repo" "$TMP/real-apply-fail-ws"

# Untracked clean failure after successful apply → LAUNCH_CLEAN_FAILED + keep worktree.
# Repro: tracked dirty + untracked uchg (immutable) so rm fails after apply.
REPO_UF="$TMP/repo-untracked-clean-fail"
mkdir -p "$REPO_UF"
git -C "$REPO_UF" init -q -b main
git -C "$REPO_UF" config user.email "test@example.com"
git -C "$REPO_UF" config user.name "Test"
echo base >"$REPO_UF/README"
git -C "$REPO_UF" add README && git -C "$REPO_UF" commit -q -m init
echo dirty >"$REPO_UF/README"
echo sticky >"$REPO_UF/sticky-untracked.txt"
# macOS: uchg makes unlink fail with EPERM; Linux: chattr +i if available
UCHG_OK=0
if chflags uchg "$REPO_UF/sticky-untracked.txt" 2>/dev/null; then
  UCHG_OK=1
elif command -v chattr >/dev/null 2>&1 && chattr +i "$REPO_UF/sticky-untracked.txt" 2>/dev/null; then
  UCHG_OK=1
fi
if [[ "$UCHG_OK" -eq 1 ]]; then
  set +e
  node "$SCRIPTS/worktree-enter.js" --repo "$REPO_UF" --target "untracked clean fail" \
    >"$TMP/enter-uf.out" 2>"$TMP/enter-uf.err"
  EC_UF=$?
  set -e
  # always drop immutability so tmp cleanup works
  chflags nouchg "$REPO_UF/sticky-untracked.txt" 2>/dev/null || chattr -i "$REPO_UF/sticky-untracked.txt" 2>/dev/null || true
  if find "$REPO_UF/.worktrees" -name 'sticky-untracked.txt' 2>/dev/null | head -1 | grep -q .; then
    while IFS= read -r f; do chflags nouchg "$f" 2>/dev/null || chattr -i "$f" 2>/dev/null || true; done \
      < <(find "$REPO_UF/.worktrees" -name 'sticky-untracked.txt' 2>/dev/null)
  fi
  assert "untracked-clean-fail enter exit 9" test "$EC_UF" -eq 9
  assert "untracked-clean-fail stderr keeps workspace" grep -q 'workspace kept at' "$TMP/enter-uf.err"
  KEPT_UF=$(sed -n 's/^worktree-enter: workspace kept at //p' "$TMP/enter-uf.err" | head -1 | tr -d '\r')
  assert "untracked-clean-fail kept path exists" test -n "$KEPT_UF" -a -d "$KEPT_UF"
  # Tracked WIP must still be in kept workspace (not destroyed by teardown)
  assert "untracked-clean-fail tracked WIP in kept ws" grep -q dirty "$KEPT_UF/README"
  assert "untracked-clean-fail untracked WIP in kept ws" test -f "$KEPT_UF/sticky-untracked.txt"
  # Must NOT have torn down all worktrees
  WT_UF=$(find "$REPO_UF/.worktrees" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  assert "untracked-clean-fail worktree not torn down" test "${WT_UF:-0}" -ge 1
else
  echo "PASS: untracked-clean-fail skipped (no uchg/chattr on this host)"
  pass=$((pass + 1))
fi

# --- review-converge / model-agnostic composition (contract pins + path preference) ---
# These are isolated hermetic checks so rename fatals (migrate order, dual marker, hard
# grok-cc require, stale template) cannot silently regress without the L3 suite noticing.
CONTRACT="$SCRIPTS/contract-check.js"
LEDGER_RESOLVE="$SCRIPTS/converge-ledger-resolve.js"
CONVERGE_SKILL="${HOME}/.claude/skills/review-converge/SKILL.md"
LEGACY_SKILL="${HOME}/.claude/skills/grok-review-converge/SKILL.md"
CONVERGE_TMPL="${HOME}/.claude/skills/review-converge/completion-report.template.html"

# Pure unit tests: ledger resolve decision table (executable, not prose-only)
assert "converge-ledger-resolve.js exists" test -f "$LEDGER_RESOLVE"
set +e
node "$LEDGER_RESOLVE" --self-test >"$TMP/ledger-resolve-out.txt" 2>"$TMP/ledger-resolve-err.txt"
LR_EC=$?
set -e
assert "ledger-resolve self-test exit 0" test "$LR_EC" -eq 0
assert "ledger-resolve PASS banner" grep -q '^PASS:' "$TMP/ledger-resolve-out.txt"

# Node require unit asserts (same matrix, independent of CLI)
assert "ledger-resolve migrate when only grok" node -e "
const r=require('$LEDGER_RESOLVE');
process.exit(r.resolveLedgerAction({reviewExists:false,grokExists:true})==='migrate'?0:1)
"
assert "ledger-resolve create when neither" node -e "
const r=require('$LEDGER_RESOLVE');
process.exit(r.resolveLedgerAction({reviewExists:false,grokExists:false})==='create'?0:1)
"
assert "ledger-resolve recover-half-migrate" node -e "
const r=require('$LEDGER_RESOLVE');
const a=r.resolveLedgerAction({reviewExists:true,grokExists:true,reviewRoundCount:0,grokRoundCount:2});
process.exit(a==='recover-half-migrate'?0:1)
"
assert "ledger-resolve both-conflict" node -e "
const r=require('$LEDGER_RESOLVE');
const a=r.resolveLedgerAction({reviewExists:true,grokExists:true,reviewRoundCount:1,grokRoundCount:1});
process.exit(a==='both-conflict'?0:1)
"
assert "ledger-resolve legacy landed" node -e "
const r=require('$LEDGER_RESOLVE');
process.exit(r.isLandedForRound(['x grok-review-converge: round 2 — y'],2)?0:1)
"
assert "ledger-resolve no round-1/10 prefix" node -e "
const r=require('$LEDGER_RESOLVE');
process.exit(r.isLandedForRound(['x review-converge: round 10 — y'],1)?1:0)
"
assert "ledger-resolve countRoundHeadings" node -e "
const r=require('$LEDGER_RESOLVE');
process.exit(r.countRoundHeadings('### Round 1 — a\n### Round 2 — b')===2?0:1)
"

assert "contract-check.js exists" test -f "$CONTRACT"
set +e
node "$CONTRACT" --skill-dir "$ROOT" \
  --mirror "$ROOT/SKILL.md" \
  --converge "$CONVERGE_SKILL" \
  >"$TMP/contract-out.txt" 2>"$TMP/contract-err.txt"
CC_EC=$?
set -e
assert "contract-check exit 0" test "$CC_EC" -eq 0
assert "contract-check PASS banner" grep -q '^PASS:' "$TMP/contract-out.txt"

if [[ -f "$CONVERGE_SKILL" ]]; then
  assert "converge product name" grep -qE 'name:[[:space:]]*review-converge' "$CONVERGE_SKILL"
  assert "converge REVIEW_CONVERGE ledger" grep -q 'REVIEW_CONVERGE.md' "$CONVERGE_SKILL"
  assert "converge commit marker" grep -q 'review-converge: round' "$CONVERGE_SKILL"
  assert "converge migrate-before-create" grep -qiE 'migrate-before-create|Migrate first' "$CONVERGE_SKILL"
  assert "converge recover-half-migrate" grep -qi 'recover-half-migrate' "$CONVERGE_SKILL"
  assert "converge both-conflict" grep -qi 'both-conflict' "$CONVERGE_SKILL"
  assert "converge dual-marker landed grep" grep -q 'grok-review-converge: round' "$CONVERGE_SKILL"
  assert "converge native-first" grep -qiE 'Native first|native first' "$CONVERGE_SKILL"
  assert "converge no hard grok-cc require" bash -c \
    "! grep -qiE 'grok-cc:grok-rescue\` must be available|must be available \\(the \`grok-cc\` plugin' \"$CONVERGE_SKILL\""
  # Fatal: create-while-legacy-exists must be forbidden in prose
  assert "converge forbids create-over-legacy" \
    grep -qiE 'never create a fresh|parallel empty ledger|while a legacy ledger still exists' \
    "$CONVERGE_SKILL"
fi

if [[ -f "$LEGACY_SKILL" ]]; then
  assert "legacy alias is deprecation stub" grep -qiE 'DEPRECATED alias|Superseded by' "$LEGACY_SKILL"
  LEGACY_BYTES="$(wc -c <"$LEGACY_SKILL" | tr -d ' ')"
  assert "legacy alias thin (<2500 bytes)" test "$LEGACY_BYTES" -lt 2500
fi

if [[ -f "$CONVERGE_TMPL" ]]; then
  assert "template REVIEW_CONVERGE primary" grep -q 'REVIEW_CONVERGE.md' "$CONVERGE_TMPL"
  assert "template no old promise name" bash -c \
    "! grep -q 'GROK_REVIEW_CONVERGE_DONE' \"$CONVERGE_TMPL\""
fi

# defaultConvergePath: preferred path wins when both exist (isolated HOME fixture)
FAKE_CC_HOME="$TMP/cc-home"
mkdir -p "$FAKE_CC_HOME/.claude/skills/review-converge" \
  "$FAKE_CC_HOME/.claude/skills/grok-review-converge" \
  "$FAKE_CC_HOME/.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop"
# minimal skill package so contract-check can read layout (reuse real package via skill-dir)
printf '%s\n' '---' 'name: review-converge' '---' '# Review converge' \
  'Preferred multi-round outer driver: `/goal`' \
  'Optional legacy outer driver: `ralph-loop`' \
  '## Running it multi-round' \
  '### Preferred: `/goal`' \
  'Consecutive clean rounds >= 2' \
  'material vs minor' \
  'git history aware' \
  'Improvement loop family with improve-loop' \
  'P0 P1 tags' \
  'Post-PASS hygiene' \
  'HYGIENE_PATHS product land kept' \
  'CONTAMINATED left unstaged' \
  'HYGIENE_SNAPSHOTS pre-hygiene content snapshot' \
  'untracked junk never `git rm` clean tracked' \
  'Native first preferred default' \
  'REVIEW_CONVERGE.md' \
  'review-converge: round' \
  'GROK_CONVERGE.md migrate rename legacy' \
  'migrate-before-create Migrate first' \
  'recover-half-migrate both-conflict' \
  'landed-commit grep either marker grok-review-converge: round' \
  >"$FAKE_CC_HOME/.claude/skills/review-converge/SKILL.md"
printf '%s\n' '---' 'name: grok-review-converge' '---' \
  'DEPRECATED alias. Superseded by review-converge.' \
  >"$FAKE_CC_HOME/.claude/skills/grok-review-converge/SKILL.md"
# stub mirror so missing-mirror does not fail hard beyond the read fail list
cp "$ROOT/SKILL.md" \
  "$FAKE_CC_HOME/.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop/SKILL.md"
set +e
HOME="$FAKE_CC_HOME" node "$CONTRACT" --skill-dir "$ROOT" \
  >"$TMP/cc-prefer-out.txt" 2>"$TMP/cc-prefer-err.txt"
CC_PREF_EC=$?
set -e
assert "contract-check prefers review-converge path" test "$CC_PREF_EC" -eq 0
assert "contract-check converge line is preferred" \
  grep -q 'converge:.*review-converge' "$TMP/cc-prefer-out.txt"

# When preferred missing, fall back to legacy (still a stub — contract skips product pins)
rm -rf "$FAKE_CC_HOME/.claude/skills/review-converge"
set +e
HOME="$FAKE_CC_HOME" node "$CONTRACT" --skill-dir "$ROOT" \
  >"$TMP/cc-legacy-out.txt" 2>"$TMP/cc-legacy-err.txt"
CC_LEG_EC=$?
set -e
assert "contract-check falls back to legacy path" test "$CC_LEG_EC" -eq 0
assert "contract-check converge line is legacy" \
  grep -q 'converge:.*grok-review-converge' "$TMP/cc-legacy-out.txt"

# improve-loop family cross-ref still names review-converge
assert "improve-loop SKILL names review-converge sibling" \
  grep -q 'review-converge' "$ROOT/SKILL.md"
assert "improve-loop advisors optional native-first" \
  grep -qiE 'Advisors are optional|native-replanner|optional advisor' "$ROOT/SKILL.md"

echo "---"
echo "passed=$pass failed=$fail"
[[ "$fail" -eq 0 ]]
