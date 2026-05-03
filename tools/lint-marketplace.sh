#!/usr/bin/env bash
# tools/lint-marketplace.sh — pre-commit/CI gate for marketplace consistency.
# Run from repo root. Exits non-zero on any failure.
set -o pipefail  # not -e: grep returning 1 on no-match is expected
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
err() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }
ok()  { printf 'ok:   %s\n' "$1"; }

# 1) marketplace.json present + parses
[ -f .claude-plugin/marketplace.json ] || { err ".claude-plugin/marketplace.json missing"; exit 1; }
python3 -c "import json,sys; json.load(open('.claude-plugin/marketplace.json'))" \
  2>/dev/null && ok "marketplace.json parses" \
              || { err "marketplace.json does not parse"; exit 1; }

# 2) every plugin in marketplace.json has a manifest at .source/.claude-plugin/plugin.json
declared_names=$(python3 -c "
import json
m = json.load(open('.claude-plugin/marketplace.json'))
for p in m['plugins']:
    print(p['name'], p['source'])
")

while IFS=$' ' read -r name src; do
  [ -z "$name" ] && continue
  manifest="$src/.claude-plugin/plugin.json"
  if [ ! -f "$manifest" ]; then
    err "plugin '$name' source '$src' has no .claude-plugin/plugin.json"
    continue
  fi
  if ! python3 -c "import json,sys; d=json.load(open('$manifest'));
assert d.get('name')=='$name', 'name mismatch: %r vs %r' % (d.get('name'), '$name');
assert d.get('version'), 'missing version';
assert d.get('description'), 'missing description'
" 2>&1; then
    err "$manifest invalid"
  else
    ok "$name manifest valid"
  fi
done <<< "$declared_names"

# 3) every plugin's `dependencies` resolves to a plugin in marketplace.json
declared_set=$(python3 -c "
import json
m = json.load(open('.claude-plugin/marketplace.json'))
print(' '.join(p['name'] for p in m['plugins']))
")
for manifest in plugins/*/.claude-plugin/plugin.json; do
  python3 -c "
import json
d = json.load(open('$manifest'))
declared = '$declared_set'.split()
deps = d.get('dependencies') or []
for dep in deps:
    name = dep.get('name') if isinstance(dep, dict) else dep
    if name not in declared:
        print('FAIL: $manifest depends on %r but no such plugin in marketplace.json' % name); raise SystemExit(1)
" || fail=1
done
[ "$fail" = 0 ] && ok "dependencies resolve"

# 4) every hooks/hooks.json command path that uses \${CLAUDE_PLUGIN_ROOT}
#    points to an existing handler file
for hooks in plugins/*/hooks/hooks.json; do
  [ -f "$hooks" ] || continue
  plugin_dir="$(dirname "$(dirname "$hooks")")"
  python3 - "$hooks" "$plugin_dir" <<'PY' || fail=1
import json, os, re, sys
hooks_path, plugin_dir = sys.argv[1], sys.argv[2]
data = json.load(open(hooks_path))
def walk(node):
    if isinstance(node, dict):
        cmd = node.get('command')
        if isinstance(cmd, str) and '${CLAUDE_PLUGIN_ROOT}' in cmd:
            # extract path after ${CLAUDE_PLUGIN_ROOT}
            m = re.search(r'\$\{CLAUDE_PLUGIN_ROOT\}(/[^\s"\']+)', cmd)
            if m:
                rel = m.group(1).lstrip('/')
                target = os.path.join(plugin_dir, rel)
                if not os.path.exists(target):
                    print(f'FAIL: {hooks_path}: handler missing: {target}')
                    raise SystemExit(1)
        for v in node.values():
            walk(v)
    elif isinstance(node, list):
        for v in node: walk(v)
walk(data)
PY
done
[ "$fail" = 0 ] && ok "hook handlers exist"

# 5) no agent declares hooks/mcpServers/permissionMode (Constraint 5)
viol=$(LC_ALL=C grep -rlnE "^(hooks|mcpServers|permissionMode):" \
       --include='*.md' plugins/*/agents/ 2>/dev/null | head)
if [ -n "$viol" ]; then
  err "agents declare forbidden frontmatter (hooks/mcpServers/permissionMode):"
  echo "$viol" | sed 's/^/  /'
fi
[ -z "$viol" ] && ok "no forbidden agent frontmatter"

# 6) extension frontmatter schema (skills + agents + commands)
viol=0
check_frontmatter() {
  local f="$1" kind="$2"   # kind: skill | agent | command
  python3 - "$f" "$kind" <<'PY'
import sys, re
path, kind = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8').read()
m = re.match(r'^---\n(.*?)\n---\n', text, re.DOTALL)
if not m:
    print(f'FAIL: {path}: missing or malformed frontmatter')
    sys.exit(1)
fm = m.group(1)
def has(k): return re.search(rf'^{k}\s*:', fm, re.MULTILINE) is not None
errors = []
if not has('name'): errors.append('missing required field: name')
if not has('description'): errors.append('missing required field: description')
# Constraint 5: agents may not declare these
if kind == 'agent':
    for forbidden in ('hooks', 'mcpServers', 'permissionMode'):
        if has(forbidden):
            errors.append(f'forbidden field for plugin agent: {forbidden}')
# legacy/non-standard
if has('alwaysApply'):
    errors.append('non-standard field: alwaysApply (drop it)')
if errors:
    for e in errors: print(f'FAIL: {path}: {e}')
    sys.exit(1)
PY
}
for f in plugins/*/skills/*/SKILL.md;     do [ -f "$f" ] && { check_frontmatter "$f" skill   || viol=1; }; done
for f in plugins/*/agents/*.md;            do [ -f "$f" ] && { check_frontmatter "$f" agent   || viol=1; }; done
for f in plugins/*/commands/*.md;          do [ -f "$f" ] && { check_frontmatter "$f" command || viol=1; }; done
if [ "$viol" = 0 ]; then
  ok "extension frontmatter schema"
else
  fail=1
fi

# 7) bundled-tool drift check
if [ -x tools/sync-bundled-tools.sh ]; then
  if tools/sync-bundled-tools.sh --check >/dev/null 2>&1; then
    ok "bundled tools in sync"
  else
    err "bundled tools drifted from tools/ source — run tools/sync-bundled-tools.sh"
  fi
fi

# 8) placeholder-token guard for fenced bash blocks
# Prevents fail-unsafe template tokens like `[PHASE_5_VERIFY_CMD]` from
# silently executing as `command not found` if the agent forgets to
# substitute (root cause of delivery-agent.md PR #221, fixed in PR #224).
viol=0
while IFS= read -r f; do
  python3 - "$f" <<'PY' || viol=1
import re, sys
path = sys.argv[1]
with open(path) as fh:
    text = fh.read()
fences = re.findall(r'^```(?:bash|sh|shell)\s*\n(.*?)^```', text, re.M | re.S)
hits = []
# Flag bracketed all-caps tokens that would *execute* as a command:
#   - first word on a line (most common case)
#   - after `&&`/`||`/`|`/`;` (chained commands)
#   - inside `$(...)` substitution (the gap reviewer flagged: `VAR=$([TOKEN])`)
PLACEHOLDER_AS_CMD = re.compile(
    r'(?:^|[\s|;]|&&|\|\||\$\()\s*(\[[A-Z][A-Z0-9_]{2,}\])\s*(?:$|[\s|;<>)])'
)
HEREDOC_OPEN = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?")
for body in fences:
    in_heredoc = None  # closing word, or None
    for line in body.splitlines():
        # Track heredoc state — body lines are string content, not commands
        if in_heredoc is not None:
            if line.strip() == in_heredoc:
                in_heredoc = None
            continue
        m_hd = HEREDOC_OPEN.search(line)
        if m_hd:
            in_heredoc = m_hd.group(1)
            # the opening line itself may still be a command — fall through
        # Skip whole-line comments
        if re.match(r'^\s*#', line):
            continue
        # Allow `[ ... ]` test syntax (`[ -z "$X" ]`, `[ "$A" = "$B" ]`)
        if re.search(r'^\s*\[\s', line):
            continue
        for m in PLACEHOLDER_AS_CMD.finditer(line):
            hits.append((m.group(1), line.strip()))
if hits:
    for tok, line in hits:
        print(f'FAIL: {path}: placeholder token {tok} as command in fenced bash block: {line!r}')
    sys.exit(1)
PY
done < <(find plugins docs -name '*.md' -type f 2>/dev/null; ls *.md 2>/dev/null | sed 's|^|./|')
if [ "$viol" = 0 ]; then
  ok "no fail-unsafe placeholder tokens in bash blocks"
else
  fail=1
fi

[ "$fail" -eq 0 ] && { echo; ok "lint-marketplace PASSED"; exit 0; }
echo
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
red "lint-marketplace FAILED"
exit 1
