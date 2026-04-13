#!/bin/bash
# test/install.test.sh — smoke-test the install.sh output section
# Stubs all side-effecting functions, sources the script, calls main,
# and asserts on key strings in the captured output.
set -eo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    echo "        expected: $needle"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (unexpected string found: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

# ── Build a stripped copy of install.sh without the `main` invocation ──
# Removes "# Run main installation" comment and the `main` call so we can
# source the file, stub side-effecting functions, then call main ourselves.
TMP_SCRIPT=$(mktemp /tmp/install-test-XXXXXX.sh)
trap 'rm -f "$TMP_SCRIPT"' EXIT
sed '/^# Run main installation/,$ d' "$REPO_DIR/install.sh" > "$TMP_SCRIPT"

# ── Create a temp CLAUDE_DIR so path expansion in echoes is testable ──
CLAUDE_DIR=$(mktemp -d /tmp/install-test-claude-XXXXXX)
trap 'rm -rf "$CLAUDE_DIR"; rm -f "$TMP_SCRIPT"' EXIT

# ── Source the stripped script, stub all side effects, call main ──
OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'

  # Stub every side-effecting function
  check_dependencies()       { :; }
  test_github_connectivity() { :; }
  verify_sync_script()       { :; }
  sync_extensions()          { :; }
  install_settings_hooks()   { :; }
  merge_plugin_hooks()       { :; }

  # Stub git operations used in the update-path branch
  git() { return 0; }

  # Wire in our temp dirs and strip ANSI color codes from output
  REPO_DIR='$REPO_DIR'
  CLAUDE_DIR='$CLAUDE_DIR'
  GREEN=''; YELLOW=''; RED=''; NC=''

  main
" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')

echo "install.sh output smoke tests:"
echo ""

# Core next-steps content
assert_contains \
  "Next steps header present" \
  "$OUTPUT" "Next steps:"

# New model routing block
assert_contains \
  "Model routing section header present" \
  "$OUTPUT" "Model routing (optional):"

assert_contains \
  "claude-router --list line present" \
  "$OUTPUT" "claude-router --list"

assert_contains \
  "claude-router path uses CLAUDE_DIR expansion" \
  "$OUTPUT" "$CLAUDE_DIR/tools/claude-router"

assert_contains \
  "/model-map skill mentioned" \
  "$OUTPUT" "/model-map"

# Sanity: existing steps still present
assert_contains \
  "Step 1 (Restart Claude Code) present" \
  "$OUTPUT" "Restart Claude Code"

assert_contains \
  "Uninstall hint present" \
  "$OUTPUT" "Uninstall anytime"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
