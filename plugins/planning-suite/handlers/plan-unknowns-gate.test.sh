#!/usr/bin/env bash
# Regression suite for plan-unknowns-gate.py. Run: ./plan-unknowns-gate.test.sh
# All cases avoid live codex calls (PATH-stripped where a deny is expected).
set -u
G="$(cd "$(dirname "$0")" && pwd)/plan-unknowns-gate.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
py() { python3 -c "import json,sys; print(json.dumps($1))"; }
check() { [ "$3" = "$2" ] && echo "PASS $1" || { echo "FAIL $1 (want $2, got $3)"; fails=$((fails+1)); }; }
decision() { python3 -c "import json;print(json.load(open('$1'))['hookSpecificOutput']['permissionDecision'])" 2>/dev/null; }
outcome() { [ -s "$1" ] && echo deny || echo allow; }

py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"# P\n\nstuff\n\n## Open Unknowns\n\n- none"}}' | "$G" > "$T/o"; check marker-present allow "$(outcome $T/o)"
py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"# P\nno section"}}' | CLAUDE_PLAN_UNKNOWNS_GATE=0 "$G" > "$T/o"; check opt-out allow "$(outcome $T/o)"
echo 'not json' | "$G" > "$T/o"; check malformed-stdin "allow rc0" "$(outcome $T/o) rc$?"
py '{"tool_name":"Bash","tool_input":{}}' | "$G" > "$T/o"; check wrong-tool allow "$(outcome $T/o)"
py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"# P\n\nsteps only"},"cwd":"/tmp"}' | PATH=/usr/bin:/bin "$G" > "$T/o"; check no-codex-fallback deny "$(decision $T/o)"

for p in 'null' '[1,2]' '{"tool_name":"ExitPlanMode","tool_input":null}' '{"tool_name":"ExitPlanMode","tool_input":{"plan":123}}' '{"tool_name":"ExitPlanMode","tool_input":{"plan":null,"planFilePath":42}}'; do
  echo "$p" | "$G" > "$T/o"; rc=$?
  check "shape:$p" "allow rc0" "$(outcome $T/o) rc$rc"
done

printf '# Plan\n\xff\xfe broken bytes, no audit\n' > "$T/bad.md"
py "{\"tool_name\":\"ExitPlanMode\",\"tool_input\":{\"plan\":\"\",\"planFilePath\":\"$T/bad.md\"},\"cwd\":\"/tmp\"}" | PATH=/usr/bin:/bin "$G" > "$T/o"; rc=$?
check bad-utf8 "deny rc0" "$(decision $T/o) rc$rc"

py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"# P\n\n```\n## Open Unknowns\n```\nsteps"},"cwd":"/tmp"}' | PATH=/usr/bin:/bin "$G" > "$T/o"; check fenced-heading-ignored deny "$(decision $T/o)"
py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"#\nthese unknowns are prose\nsteps"},"cwd":"/tmp"}' | PATH=/usr/bin:/bin "$G" > "$T/o"; check newline-cross-ignored deny "$(decision $T/o)"
py '{"tool_name":"ExitPlanMode","tool_input":{"plan":"# P\n\n  ## Open Unknowns\n- x"}}' | "$G" > "$T/o"; check indented-heading allow "$(outcome $T/o)"

python3 - "$G" <<'EOF' || fails=$((fails+1))
import importlib.util, sys
spec = importlib.util.spec_from_file_location("g", sys.argv[1])
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
sec = g.extract_section("Sure! Here it is:\n##Open Unknowns\n- **thing** — matters. *Suggestion:* do X.\n")
assert sec is not None and sec.startswith("## Open Unknowns\n"), sec
assert g.has_unknowns_heading("# P\n\n" + sec)
big = "## Open Unknowns\n" + ("- bullet\n" * 3000)
assert g.extract_section(big).endswith("(truncated)")
assert g.extract_section("## Open Unknowns\n\n\n") is None
print("PASS normalize/truncate/empty-section")
EOF

echo; [ "$fails" -eq 0 ] && echo "ALL PASS" || echo "$fails FAILURE(S)"; exit "$fails"
