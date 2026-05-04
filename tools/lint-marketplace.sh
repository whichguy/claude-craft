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

# 2) every local plugin in marketplace.json has a manifest at .source/.claude-plugin/plugin.json
#    (git-subdir / external sources are skipped — can't validate remote repos locally)
declared_names=$(python3 -c "
import json
m = json.load(open('.claude-plugin/marketplace.json'))
for p in m['plugins']:
    src = p['source']
    if isinstance(src, dict):
        print(p['name'], '__REMOTE__')
    else:
        print(p['name'], src)
")

while IFS=$' ' read -r name src; do
  [ -z "$name" ] && continue
  if [ "$src" = "__REMOTE__" ]; then
    ok "$name manifest valid (remote git-subdir — skipping local check)"
    continue
  fi
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

# 9) Transitive / circular dependency check
python3 - <<'PY' || fail=1
import json, sys

marketplace = json.load(open('.claude-plugin/marketplace.json'))
plugin_names = {p['name'] for p in marketplace['plugins']}
plugin_sources = {p['name']: p['source'] for p in marketplace['plugins']}

# Build adjacency map
adj = {}
for name, src in plugin_sources.items():
    manifest_path = f"{src}/.claude-plugin/plugin.json"
    try:
        d = json.load(open(manifest_path))
    except Exception:
        continue
    deps = d.get('dependencies') or []
    adj[name] = []
    for dep in deps:
        dep_name = dep.get('name') if isinstance(dep, dict) else dep
        adj[name].append(dep_name)

# DFS cycle detection
def has_cycle(node, visited, stack, path):
    visited.add(node)
    stack.add(node)
    for neighbor in adj.get(node, []):
        if neighbor not in visited:
            result = has_cycle(neighbor, visited, stack, path + [neighbor])
            if result:
                return result
        elif neighbor in stack:
            return path + [neighbor]
    stack.discard(node)
    return None

errors = []
visited = set()
for name in adj:
    if name not in visited:
        cycle = has_cycle(name, visited, set(), [name])
        if cycle:
            errors.append('circular dependency: ' + ' -> '.join(cycle))

if errors:
    for e in errors:
        print(f'FAIL: {e}')
    sys.exit(1)
PY
[ "$fail" = 0 ] && ok "no circular dependencies"

# 10) Cross-plugin Skill_call resolution — /<plugin>:<skill> refs must exist
python3 - <<'PY' || fail=1
import os, re, sys

REPO = os.getcwd()
errors = []
REF_PAT = re.compile(r'/([a-z][a-z0-9_-]+):([a-z][a-z0-9_-]+)')

def candidates(plugin, skill):
    base = os.path.join(REPO, 'plugins', plugin)
    return [
        os.path.join(base, 'skills', skill, 'SKILL.md'),
        os.path.join(base, 'commands', f'{skill}.md'),
        os.path.join(base, 'agents', f'{skill}.md'),
    ]

scanned = []
for root, dirs, files in os.walk(os.path.join(REPO, 'plugins')):
    # only skill files and agent files
    for fname in files:
        if fname in ('SKILL.md',) or (fname.endswith('.md') and
               any(seg in root for seg in ['/agents', '/skills', '/commands'])):
            scanned.append(os.path.join(root, fname))

known_plugins = {
    d for d in os.listdir(os.path.join(REPO, 'plugins'))
    if os.path.isdir(os.path.join(REPO, 'plugins', d))
}

for fpath in scanned:
    try:
        text = open(fpath).read()
    except Exception:
        continue
    for m in REF_PAT.finditer(text):
        plugin, skill = m.group(1), m.group(2)
        if plugin not in known_plugins:
            continue  # not a cross-plugin ref pattern we can validate
        # skip self-refs (same plugin)
        rel = os.path.relpath(fpath, REPO)
        own_plugin = rel.split('/')[1] if rel.startswith('plugins/') else None
        if plugin == own_plugin:
            continue
        if not any(os.path.exists(c) for c in candidates(plugin, skill)):
            errors.append(f'{fpath}: broken cross-plugin ref /{plugin}:{skill}')

if errors:
    for e in sorted(set(errors)):
        print(f'FAIL: {e}')
    sys.exit(1)
PY
[ "$fail" = 0 ] && ok "cross-plugin skill refs resolve"

[ "$fail" -eq 0 ] && { echo; ok "lint-marketplace PASSED"; exit 0; }
echo
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
red "lint-marketplace FAILED"
exit 1
