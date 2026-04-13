#!/bin/bash
# test/claude-shim.test.sh — behavioural tests for the claude PATH shim.
# Controls proxy reachability via a curl stub; stubs node to avoid real spawns.
# System utilities (sleep, readlink, etc.) are inherited so the shim can run.
set -eo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SHIM="$REPO_DIR/tools/claude-shim"
PASS=0
FAIL=0
TMPFILES=()

cleanup() {
  for d in "${TMPFILES[@]}"; do
    rm -rf "$d" 2>/dev/null || true
  done
}
trap cleanup EXIT

assert_eq() {
  local label="$1" got="$2" want="$3"
  if [[ "$got" == "$want" ]]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    echo "        want: $want"
    echo "        got:  $got"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    echo "        expected string: $needle"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (unexpected string found)"
    FAIL=$((FAIL + 1))
  fi
}

# make_env_dir PROXY_STATE HAS_CLAUDE
#   PROXY_STATE: running|dead — controls curl stub exit code for /ping
#   HAS_CLAUDE:  yes|no      — whether a real claude stub is put in real_bin
# Outputs: tmpdir fake_home stub_bin real_bin
make_env_dir() {
  local proxy_state="${1:-running}" has_claude="${2:-yes}"
  local tmpdir
  tmpdir="$(mktemp -d /tmp/shim-test-XXXXXX)"
  TMPFILES+=("$tmpdir")

  # Fake HOME
  local fake_home="$tmpdir/home"
  mkdir -p "$fake_home/.claude/tools"

  # Stubs bin — contains curl + node overrides; system utils inherited via PATH
  local stub_bin="$tmpdir/stubs"
  mkdir -p "$stub_bin"

  # curl stub: exit 0 if URL contains /ping (proxy "running"), else exit 1
  if [[ "$proxy_state" == "running" ]]; then
    printf '#!/bin/bash\n[[ "$*" == */ping* ]] && exit 0\nexit 1\n' > "$stub_bin/curl"
  else
    printf '#!/bin/bash\nexit 1\n' > "$stub_bin/curl"
  fi
  chmod +x "$stub_bin/curl"

  # node stub: immediately exit 0 (simulates successful proxy spawn with no wait)
  printf '#!/bin/bash\nexit 0\n' > "$stub_bin/node"
  chmod +x "$stub_bin/node"

  # Real claude stub (in a separate dir so the shim walks past stubs first)
  local real_bin="$tmpdir/real-bin"
  mkdir -p "$real_bin"
  if [[ "$has_claude" == "yes" ]]; then
    cat > "$real_bin/claude" <<'STUB'
#!/bin/bash
echo "claude-invoked"
echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"
echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
for a in "$@"; do echo "arg:$a"; done
STUB
    chmod +x "$real_bin/claude"
  fi

  echo "$tmpdir $fake_home $stub_bin $real_bin"
}

# run_shim FAKE_HOME STUB_BIN REAL_BIN [EXTRA_ENV...]
# Prints stdout; stderr silenced. Returns exit code via SHIM_EXIT.
run_shim() {
  local fake_home="$1" stub_bin="$2" real_bin="$3"
  shift 3
  # PATH: stubs override curl/node; real_bin has claude; system dirs for sleep/readlink/etc.
  local test_path="$stub_bin:$real_bin:/usr/bin:/bin"
  SHIM_EXIT=0
  SHIM_OUT=$(env \
    HOME="$fake_home" \
    PATH="$test_path" \
    CLAUDE_PROXY_PORT="19996" \
    "$@" \
    bash "$SHIM" --model test -p hello 2>/dev/null) || SHIM_EXIT=$?
}

echo "claude-shim tests:"
echo ""

# ── Test 1: proxy already running → shim routes through proxy ─────────
echo "Proxy already running:"
{
  read -r tmpdir fake_home stub_bin real_bin <<<"$(make_env_dir running yes)"
  run_shim "$fake_home" "$stub_bin" "$real_bin"

  assert_contains "shim invokes real claude"        "$SHIM_OUT" "claude-invoked"
  assert_contains "ANTHROPIC_BASE_URL set to proxy" "$SHIM_OUT" "ANTHROPIC_BASE_URL=http://127.0.0.1:19996"
  assert_eq       "shim exits 0"                   "$SHIM_EXIT" "0"
}

# ── Test 2: proxy dead → shim attempts spawn, still routes ────────────
echo ""
echo "Proxy dead (shim attempts spawn):"
{
  read -r tmpdir fake_home stub_bin real_bin <<<"$(make_env_dir dead yes)"
  run_shim "$fake_home" "$stub_bin" "$real_bin"

  # Even if proxy never responds, shim must still exec real claude
  assert_contains "shim still invokes claude after dead proxy" "$SHIM_OUT" "claude-invoked"
}

# ── Test 3: real claude missing → exit 127 with message ──────────────
echo ""
echo "Real claude missing from PATH:"
{
  read -r tmpdir fake_home stub_bin real_bin <<<"$(make_env_dir running no)"
  SHIM_EXIT=0
  SHIM_ERR=$(env \
    HOME="$fake_home" \
    PATH="$stub_bin:/usr/bin:/bin" \
    CLAUDE_PROXY_PORT="19996" \
    bash "$SHIM" --model test -p hello 2>&1 >/dev/null) || SHIM_EXIT=$?

  assert_eq      "exits 127 when claude not found"  "$SHIM_EXIT" "127"
  assert_contains "prints helpful error message"    "$SHIM_ERR"  "real claude binary not found"
}

# ── Test 4: CLAUDE_PROXY_BYPASS=1 → no ANTHROPIC_BASE_URL ────────────
echo ""
echo "CLAUDE_PROXY_BYPASS=1:"
{
  read -r tmpdir fake_home stub_bin real_bin <<<"$(make_env_dir running yes)"
  run_shim "$fake_home" "$stub_bin" "$real_bin" CLAUDE_PROXY_BYPASS=1

  assert_contains     "claude is still invoked with bypass" "$SHIM_OUT" "claude-invoked"
  assert_not_contains "ANTHROPIC_BASE_URL absent (bypassed)" "$SHIM_OUT" "ANTHROPIC_BASE_URL=http"
}

# ── Test 5: shim in PATH skips itself, finds real claude ─────────────
echo ""
echo "PATH ordering (shim copy skipped, real claude found):"
{
  read -r tmpdir fake_home stub_bin real_bin <<<"$(make_env_dir running yes)"

  # Copy the shim to a dir that comes before real_bin in PATH
  shim_copy_dir="$tmpdir/shim-copy-bin"
  mkdir -p "$shim_copy_dir"
  cp "$SHIM" "$shim_copy_dir/claude"
  chmod +x "$shim_copy_dir/claude"

  # PATH: stubs → shim copy (named "claude") → real claude → system
  SHIM_EXIT=0
  SHIM_OUT=$(env \
    HOME="$fake_home" \
    PATH="$stub_bin:$shim_copy_dir:$real_bin:/usr/bin:/bin" \
    CLAUDE_PROXY_PORT="19996" \
    bash "$SHIM" --model test -p hello 2>/dev/null) || SHIM_EXIT=$?

  assert_contains "finds real claude past the shim copy in PATH" "$SHIM_OUT" "claude-invoked"
}

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
