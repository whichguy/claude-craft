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
TEST_HOME=$(mktemp -d /tmp/install-test-home-XXXXXX)
TEST_REPO=$(mktemp -d /tmp/install-test-repo-XXXXXX)
REAL_TEST_REPO=$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$TEST_REPO")
trap 'rm -rf "$CLAUDE_DIR" "$TEST_HOME" "$TEST_REPO"; rm -f "$TMP_SCRIPT"' EXIT
touch "$TEST_HOME/.zshenv" "$TEST_HOME/.bashrc"
mkdir -p "$TEST_REPO/tools"
touch "$TEST_REPO/tools/llm-capabilities-mcp.js"

# ── Source the stripped script, stub all side effects, call main ──
OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'

  # Stub every side-effecting function
  check_dependencies()       { :; }
  test_github_connectivity() { :; }
  verify_sync_script()       { :; }
  sync_extensions()          { :; }
  install_settings_hooks()   { :; }
  merge_plugin_hooks()       { echo '__MERGE_PLUGIN_HOOKS_CALLED__'; }

  # Stub git operations used in the update-path branch
  git() { return 0; }

  # Wire in our temp dirs and strip ANSI color codes from output
  REPO_DIR='$REPO_DIR'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''

  main
" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')

echo "install.sh output smoke tests:"
echo ""

# Core next-steps content
assert_contains \
  "Next steps header present" \
  "$OUTPUT" "Next steps:"

# Model routing block (transparent proxy)
assert_contains \
  "Model routing section header present" \
  "$OUTPUT" "Model routing (transparent proxy):"

assert_contains \
  "/model-map skill mentioned" \
  "$OUTPUT" "/model-map"

assert_contains \
  "proxy.log troubleshooting hint present" \
  "$OUTPUT" "proxy.*.log"

assert_contains \
  "CLAUDE_PROXY_BYPASS escape hatch mentioned" \
  "$OUTPUT" "CLAUDE_PROXY_BYPASS=1"

assert_contains \
  "plugin hook merge step runs during install" \
  "$OUTPUT" "__MERGE_PLUGIN_HOOKS_CALLED__"

assert_contains \
  "vendor claude remains on PATH" \
  "$OUTPUT" "uses the vendor Claude binary already on your PATH"

assert_contains \
  "optional router path still mentioned" \
  "$OUTPUT" "~/.claude/tools/claude-router --list"

assert_contains \
  "local MCP config now mentioned" \
  "$OUTPUT" "~/.claude.json is managed in local MCP scope"

assert_contains \
  "profile hooks location now mentioned" \
  "$OUTPUT" "hooks/plugins live in ~/.claude"

assert_contains \
  "model-map validator tool mentioned" \
  "$OUTPUT" "~/.claude/tools/model-map-validate"

assert_contains \
  "verifier tool mentioned" \
  "$OUTPUT" "~/.claude/tools/verify-llm-capabilities-mcp"

assert_contains \
  "project .mcp.json is framed as optional sharing path" \
  "$OUTPUT" "use project .mcp.json only if you want to share this MCP server"

assert_contains \
  "reload messaging present" \
  "$OUTPUT" "reload MCP/plugins"

assert_contains \
  "verifier usage mentioned" \
  "$OUTPUT" "verify-llm-capabilities-mcp --call"

# Sanity: existing steps still present
assert_contains \
  "Step 1 (Restart Claude Code) present" \
  "$OUTPUT" "Restart Claude Code"

assert_contains \
  "Uninstall hint present" \
  "$OUTPUT" "Uninstall anytime"

MCP_OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'
  REPO_DIR='$TEST_REPO'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''
  mkdir -p '$CLAUDE_DIR/tools'
  touch '$CLAUDE_DIR/tools/llm-capabilities-mcp'
  printf '%s\n' '{\"projects\":{\"/tmp/existing-project\":{\"mcpServers\":{\"other\":{\"type\":\"stdio\",\"command\":\"/bin/true\",\"args\":[],\"env\":{}}},\"allowedTools\":[]}}}' > '$TEST_HOME/.claude.json'
  install_local_mcp_config
" 2>/dev/null)

assert_contains \
  "local MCP config helper reports success" \
  "$MCP_OUTPUT" "Local MCP config converged"

MCP_FILE="$TEST_HOME/.claude.json"
assert_contains \
  "local MCP config file created" \
  "$(cat "$MCP_FILE")" "\"llm-capabilities\""

assert_contains \
  "local MCP config preserves other projects" \
  "$(cat "$MCP_FILE")" "\"/tmp/existing-project\""

assert_contains \
  "local MCP config includes project dir env" \
  "$(cat "$MCP_FILE")" "\"CLAUDE_PROJECT_DIR\": \"$REAL_TEST_REPO\""

assert_contains \
  "local MCP config uses stdio type" \
  "$(cat "$MCP_FILE")" "\"type\": \"stdio\""

NODE_BIN="$(python3 - <<'PY'
import os, shutil
print(os.path.realpath(shutil.which('node')))
PY
)"
assert_contains \
  "local MCP config uses absolute node binary" \
  "$(cat "$MCP_FILE")" "\"command\": \"$NODE_BIN\""

assert_contains \
  "local MCP config passes repo MCP script as arg" \
  "$(cat "$MCP_FILE")" "\"$REAL_TEST_REPO/tools/llm-capabilities-mcp.js\""

MODEL_MAP_FILE="$CLAUDE_DIR/model-map.json"
MODEL_MAP_OVERRIDES_FILE="$CLAUDE_DIR/model-map.overrides.json"
assert_contains \
  "created model-map marks ollama_cloud as skip-prep" \
  "$(cat "$MODEL_MAP_FILE")" "\"prep_policy\": \"skip\""

if [ -f "$MODEL_MAP_OVERRIDES_FILE" ]; then
  echo "  PASS: created model-map overrides file"
  PASS=$((PASS + 1))
else
  echo "  FAIL: created model-map overrides file"
  FAIL=$((FAIL + 1))
fi

assert_contains \
  "created model-map overrides default to empty object" \
  "$(cat "$MODEL_MAP_OVERRIDES_FILE")" "{}"

LEGACY_OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'
  REPO_DIR='$TEST_REPO'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''
  mkdir -p '$CLAUDE_DIR/tools'
  touch '$CLAUDE_DIR/tools/llm-capabilities-mcp'
  printf '%s\n' '{\"mcpServers\":{\"llm-capabilities\":{\"type\":\"stdio\",\"command\":\"/tmp/llm-capabilities-mcp-stale\",\"args\":[],\"env\":{}}}}' > '$TEST_REPO/.mcp.json'
  cleanup_legacy_mcp_config
" 2>/dev/null)

assert_contains \
  "legacy repo .mcp cleanup reports removal" \
  "$LEGACY_OUTPUT" "removed_repo_mcp="

if [ ! -f "$TEST_REPO/.mcp.json" ]; then
  echo "  PASS: legacy repo .mcp.json removed safely"
  PASS=$((PASS + 1))
else
  echo "  FAIL: legacy repo .mcp.json removed safely"
  FAIL=$((FAIL + 1))
fi

CUSTOM_OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'
  REPO_DIR='$TEST_REPO'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''
  mkdir -p '$CLAUDE_DIR/tools'
  touch '$CLAUDE_DIR/tools/llm-capabilities-mcp'
  python3 - <<'PY'
import json, os
repo = os.path.realpath('$TEST_REPO')
path = os.path.expanduser('$TEST_HOME/.claude.json')
data = {
  'projects': {
    repo: {
      'mcpServers': {
        'llm-capabilities': {
          'type': 'stdio',
          'command': '/custom/llm-capabilities',
          'args': [],
          'env': {
            'CLAUDE_PROJECT_DIR': repo,
            'CLAUDE_MODEL_MAP_LAUNCH_CWD': repo,
          },
        }
      }
    }
  }
}
with open(path, 'w', encoding='utf-8') as fh:
  json.dump(data, fh)
PY
  install_local_mcp_config
" 2>/dev/null)

assert_contains \
  "custom local MCP entry is preserved" \
  "$CUSTOM_OUTPUT" "Preserved existing custom llm-capabilities entry"

assert_contains \
  "custom local MCP command remains unchanged" \
  "$(cat "$TEST_HOME/.claude.json")" "\"command\": \"/custom/llm-capabilities\""

SHARED_REPO_MCP_OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'
  REPO_DIR='$TEST_REPO'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''
  mkdir -p '$CLAUDE_DIR/tools'
  touch '$CLAUDE_DIR/tools/llm-capabilities-mcp'
  python3 - <<'PY'
import json, os
repo = os.path.realpath('$TEST_REPO')
command = os.path.realpath('$TEST_REPO/tools/llm-capabilities-mcp.js')
data = {
  'mcpServers': {
    'llm-capabilities': {
      'type': 'stdio',
      'command': command,
      'args': [],
      'env': {
        'CLAUDE_PROJECT_DIR': repo,
        'CLAUDE_MODEL_MAP_LAUNCH_CWD': repo,
      },
    }
  }
}
with open(os.path.join(repo, '.mcp.json'), 'w', encoding='utf-8') as fh:
    json.dump(data, fh)
PY
  cleanup_legacy_mcp_config
" 2>/dev/null)

assert_not_contains \
  "shared project .mcp.json is not removed" \
  "$SHARED_REPO_MCP_OUTPUT" "removed_repo_mcp="

if [ -f "$TEST_REPO/.mcp.json" ]; then
  echo "  PASS: shared project .mcp.json preserved"
  PASS=$((PASS + 1))
else
  echo "  FAIL: shared project .mcp.json preserved"
  FAIL=$((FAIL + 1))
fi

MODEL_MAP_CONVERGE_OUTPUT=$(bash -c "
  source '$TMP_SCRIPT'
  REPO_DIR='$TEST_REPO'
  CLAUDE_DIR='$CLAUDE_DIR'
  HOME='$TEST_HOME'
  GREEN=''; YELLOW=''; RED=''; NC=''
  cat > '$CLAUDE_DIR/model-map.json' <<'JSON'
{
  \"backends\": {
    \"ollama_cloud\": {
      \"kind\": \"ollama\",
      \"url\": \"http://localhost:11434\"
    }
  },
  \"model_routes\": {},
  \"routes\": {}
}
JSON
  converge_model_map_defaults '$CLAUDE_DIR/model-map.json'
" 2>/dev/null)

assert_contains \
  "model-map converge helper reports skip-prep update" \
  "$MODEL_MAP_CONVERGE_OUTPUT" "marked ollama_cloud as skip-prep"

assert_contains \
  "model-map converge helper writes prep_policy skip" \
  "$(cat "$CLAUDE_DIR/model-map.json")" "\"prep_policy\": \"skip\""

VERIFY_HOME=$(mktemp -d /tmp/install-test-verify-home-XXXXXX)
trap 'rm -rf "$CLAUDE_DIR" "$TEST_HOME" "$TEST_REPO" "$VERIFY_HOME"; rm -f "$TMP_SCRIPT"' EXIT
mkdir -p "$VERIFY_HOME/.claude/tools"
ln -sfn "$REPO_DIR/tools/llm-capabilities-mcp.js" "$VERIFY_HOME/.claude/tools/llm-capabilities-mcp"
VERIFY_NODE_BIN="$(python3 - <<'PY'
import os, shutil
print(os.path.realpath(shutil.which('node')))
PY
)"
python3 - <<PY
import json, os
repo = os.path.realpath("$REPO_DIR")
tool = os.path.realpath("$VERIFY_HOME/.claude/tools/llm-capabilities-mcp")
node_bin = os.path.realpath("$VERIFY_NODE_BIN")
data = {
  "projects": {
    repo: {
      "mcpServers": {
        "llm-capabilities": {
          "type": "stdio",
          "command": node_bin,
          "args": [tool],
          "env": {
            "CLAUDE_PROJECT_DIR": repo,
            "CLAUDE_MODEL_MAP_LAUNCH_CWD": repo,
          },
        }
      }
    }
  }
}
with open(os.path.join("$VERIFY_HOME", ".claude.json"), "w", encoding="utf-8") as fh:
    json.dump(data, fh)
PY
VERIFY_OUTPUT=$(HOME="$VERIFY_HOME" "$REPO_DIR/tools/verify-llm-capabilities-mcp.sh" 2>/dev/null)

assert_contains \
  "verifier confirms local MCP registration" \
  "$VERIFY_OUTPUT" "verified local MCP registration"

assert_contains \
  "verifier lists the direct MCP tools" \
  "$VERIFY_OUTPUT" "tools (12): ask_model,"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
