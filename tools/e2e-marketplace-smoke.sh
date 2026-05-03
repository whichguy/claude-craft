#!/usr/bin/env bash
# tools/e2e-marketplace-smoke.sh — manual smoke test for Step 12.
#
# Validates the marketplace structure end-to-end without requiring a Claude
# Code session. Performs checks the `claude /plugin marketplace add` flow
# would do at install time:
#   - marketplace.json + every plugin.json parses
#   - every declared `source` directory exists
#   - every plugin's hooks.json command paths resolve (via lint-marketplace)
#   - every Skill_call namespacing matches a real plugin (via lint-namespacing)
#   - bundled tools have not drifted from source (via sync-bundled-tools --check)
#
# For the live Claude Code path, run manually after this passes:
#   claude /plugin marketplace add file://$(pwd)
#   claude /plugin install gas-suite@claude-craft
#   /gas-suite:gas-review <fixture>
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

step() { printf '\n→ %s\n' "$1"; }
fail() { printf '\033[0;31m✗ %s\033[0m\n' "$1"; exit 1; }
pass() { printf '\033[0;32m✓ %s\033[0m\n' "$1"; }

step "1) lint-marketplace"
./tools/lint-marketplace.sh >/dev/null 2>&1 && pass "ok" || fail "lint-marketplace failed (run it directly for output)"

step "2) lint-namespacing"
./tools/lint-namespacing.sh >/dev/null 2>&1 && pass "ok" || fail "lint-namespacing failed (run it directly for output)"

step "3) bundled-tools drift"
./tools/sync-bundled-tools.sh --check >/dev/null 2>&1 && pass "ok" || fail "bundled tools drifted"

step "4) every marketplace.json plugin source resolves"
python3 - <<'PY' || fail "missing source dir"
import json, os, sys
m = json.load(open('.claude-plugin/marketplace.json'))
bad = []
for p in m['plugins']:
    src = p['source'].lstrip('./')
    if not os.path.isdir(src):
        bad.append((p['name'], src))
    elif not os.path.isfile(os.path.join(src, '.claude-plugin', 'plugin.json')):
        bad.append((p['name'], src + '/.claude-plugin/plugin.json'))
if bad:
    for n, s in bad: print(f'MISSING: {n} -> {s}')
    sys.exit(1)
PY
pass "ok"

step "5) per-plugin shape (skills/agents/commands counts)"
for p in plugins/*/; do
  name=$(basename "$p")
  s=$(find "${p}skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  a=$(find "${p}agents" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  c=$(find "${p}commands" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  printf '  %-18s skills=%s agents=%s commands=%s\n' "$name" "$s" "$a" "$c"
done
pass "ok"

step "6) cross-plugin Skill_call samples"
LC_ALL=C grep -rnE 'Skill\(\s*[^)]*"[a-z][a-z0-9-]+:[a-z][a-z0-9-]+"' --include='*.md' plugins/ | head -5 || true
pass "ok"

step "7) plan-mode hook handlers executable + syntax-clean"
for h in plugins/planning-suite/hooks/handlers/*.sh; do
  [ -x "$h" ] || fail "$h not executable"
  bash -n "$h" || fail "$h syntax error"
done
pass "ok"

echo
pass "ALL SMOKE CHECKS PASSED — ready for live /plugin marketplace add"
