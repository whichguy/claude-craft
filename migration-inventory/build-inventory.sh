#!/usr/bin/env bash
# Step 0 — Pre-flight inventory for marketplace migration.
# Produces three CSVs in /tmp/claude-craft-migration/ that drive bundle layout
# validation (Step 0 exit criteria) before any git mv occurs.
set -o pipefail  # don't -e: greps return 1 on no match, which is fine here
shopt -s nullglob

ROOT="${ROOT:-/Users/dadleet/claude-craft}"
OUT="/tmp/claude-craft-migration"
mkdir -p "$OUT"
cd "$ROOT"

# ----------------------------------------------------------------------------
# Bundle assignment lookup. The plan's hypothesized layout encoded as a function
# mapping skill/command/agent name -> destination plugin. Anything unmatched is
# flagged so we can decide explicitly rather than silently misroute.
# ----------------------------------------------------------------------------
bundle_for() {
  local name="$1"
  case "$name" in
    # gas-suite
    gas-review|gas-code-review|gas-ui-review|gas-plan|gas-debug|gas-ui-debug|\
    gas-sidebar|gas-gmail-cards|gas-commercial|gas-undocumented|\
    gas-debug-html|gas-debug-team-lead|gas-debug-spreadsheet|gas-debug-commonjs|\
    gas-debug-hypothesis-tester|gas-cross-file-validator|gas-review-team-lead|\
    gas-ui-code-review|gas-ui-plan-review)
      echo "gas-suite" ;;
    # wiki-suite (absorbs proactive-research + deprecated /reflect /consolidate redirects)
    wiki-init|wiki-ingest|wiki-query|wiki-load|wiki-process|wiki-lint|\
    proactive-research|reflect|consolidate)
      echo "wiki-suite" ;;
    # review-suite (user-facing: review-plan, review-fix, code-reviewer + dispatch-only agents)
    review-plan|review-fix|code-reviewer|review-fix-judge|prompt-reviewer|\
    trap-generator)
      echo "review-suite" ;;
    # review-bench (research/A-B tooling, depends on review-suite)
    question-bench|question-bench-judge|validate-questions|optimize-questions|\
    ablate-review-plan|review-plan-ablation-judge|derive-questions|\
    compare-prompts|compare-prompts-judge|compare-questions|compare-questions-judge|\
    improve-prompt|prompt-research-cycle|autonomous-prompt-research|\
    prompt-comparator|review-fix-bench|optimize-system-prompt|improve-system-prompt)
      echo "review-bench" ;;
    # planning-suite (develop/tasks/expand DEFERRED to superpowers; their agents removed)
    architect|refactor|test|schedule-plan-tasks|test-schedule-plan-tasks|\
    node-plan|system-architect|requirements-generator|qa-analyst|\
    code-refactor|recommend-tech|tech-research-analyst|environment-analyst|\
    deployment-orchestrator|synthesis-coordinator|knowledge-aggregator|\
    create-worktree|merge-worktree|verify-transformation|ui-designer|\
    delivery-agent|test-delivery-agent|file-output-executor|run-agent|\
    test-run-agent)
      echo "planning-suite" ;;
    # async-suite (absorbs async-workflow commands: bg, todo, todo-cleanup)
    task-persist|process-feedback|async-workflow|feedback-collector|\
    bg|todo|todo-cleanup)
      echo "async-suite" ;;
    # slides-suite
    slides|make-slides|test-slides)
      echo "slides-suite" ;;
    # system-prompts
    optimize-system-prompt|improve-system-prompt)
      echo "system-prompts" ;;
    # core-tools (enable-abilities REMOVED — superseded by first-party update-config)
    agent-sync|sync-status|craft-update|memory-audit|memory-security|\
    knowledge|prompt|prompter|performance|c-thru-status|cplan|\
    alias|unalias|craft|code-security|red-team)
      echo "core-tools" ;;
    # comms
    slack-tag) echo "comms" ;;
    # form990
    form990) echo "form990" ;;
    # plan-red-team / local-classifier (existing plugins)
    plan-red-team) echo "plan-red-team" ;;
    local-classifier) echo "local-classifier" ;;
    *) echo "UNASSIGNED" ;;
  esac
}

# ----------------------------------------------------------------------------
# 1) skills.csv — every SKILL.md (top-level + plugin-shaped)
# ----------------------------------------------------------------------------
{
  echo "name,path,plugin_destination"
  while IFS= read -r p; do
    # name = parent dir basename
    name="$(basename "$(dirname "$p")")"
    dest="$(bundle_for "$name")"
    echo "$name,$p,$dest"
  done < <(find skills plugins -name SKILL.md 2>/dev/null | sort)
} > "$OUT/skills.csv"

# ----------------------------------------------------------------------------
# 2) refs.csv — cross-file references that the namespacing rewrite must touch
#    Three call-site kinds:
#      Skill_call            : Skill({ skill: "name" }) literal
#      slash_text            : /skill-name in prose (word-boundary anchored)
#      frontmatter_allowed   : agent/skill frontmatter allowed-tools naming a skill
# ----------------------------------------------------------------------------
SKILL_NAMES_FILE="$OUT/.skill-names.txt"
awk -F, 'NR>1 {print $1}' "$OUT/skills.csv" | sort -u > "$SKILL_NAMES_FILE"
# also include command basenames since /<cmd> is in the same syntactic slot
COMMAND_NAMES_FILE="$OUT/.command-names.txt"
{
  for f in commands/*.md plugins/*/commands/*.md; do
    [ -e "$f" ] || continue
    basename "$f" .md
  done
} | sort -u > "$COMMAND_NAMES_FILE"

# Determine plugin destination of an arbitrary file path by walking up to the
# nearest plugins/<x>/ ancestor; otherwise use the bundle of the skill/agent/command name.
plugin_of_path() {
  local path="$1"
  case "$path" in
    plugins/async-workflow*) echo "async-suite"; return ;;
    plugins/wiki-hooks*|plugins/craft-hooks*) echo "wiki-suite"; return ;;
    plugins/task-persist*|plugins/feedback-collector*) echo "async-suite"; return ;;
    plugins/*) echo "$path" | awk -F/ '{print $2}'; return ;;
    # files under skills/<name>/... — bundle is bundle_for(<name>)
    skills/*) bundle_for "$(echo "$path" | awk -F/ '{print $2}')"; return ;;
    # files under agents/<file>.md or commands/<file>.md — use stem
    agents/*|commands/*)
      local stem
      stem="$(basename "$path" .md)"
      bundle_for "$stem"
      return ;;
  esac
  echo "UNASSIGNED"
}

{
  echo "caller_path,caller_plugin,callee_name,callee_plugin,call_site_kind,line"

  # 2a) Skill({ skill: "<name>" }) — also Skill tool with skill: <name>
  grep -rnE "Skill\(\s*\{?\s*skill\s*[:=]\s*['\"][a-z][a-z0-9-]*['\"]" \
       agents/ skills/ commands/ plugins/ 2>/dev/null \
    | while IFS=: read -r file line rest; do
        callee=$(echo "$rest" | grep -oE "skill\s*[:=]\s*['\"][a-z][a-z0-9-]*['\"]" \
                | head -1 | grep -oE "['\"][a-z][a-z0-9-]*['\"]" | tr -d '"'\')
        [ -z "$callee" ] && continue
        cp="$(plugin_of_path "$file")"
        kp="$(bundle_for "$callee")"
        echo "$file,$cp,$callee,$kp,Skill_call,$line"
      done

  # 2b) /<skill-or-command-name> slash refs in prose. Single-pass grep with
  #     alternation across all known names, then post-filter to drop noise:
  #       - paths: anything before the slash that looks like a path component
  #         ending in `>`, `]`, `)`, alphanumeric (e.g. `<WT>/test`, `foo/test`)
  #       - case patterns: `/name*|` or `/name)`
  #       - code-block context: line is inside ``` fences (heuristic)
  ALT="$(cat "$SKILL_NAMES_FILE" "$COMMAND_NAMES_FILE" | sort -u | paste -sd'|' -)"
  grep -rnE "(^|[[:space:]]|[(\"'\`])/(${ALT})\b" \
       --include='*.md' \
       agents/ skills/ commands/ plugins/ 2>/dev/null \
    | awk -F: -v OFS=, '
        {
          file=$1; line=$2; rest=$0
          sub("^"$1":"$2":","",rest)
          # find each /<name> occurrence on the line and validate context
          while (match(rest, /(^|[[:space:](\"\x27`])\/[A-Za-z0-9_-]+/)) {
            tok = substr(rest, RSTART, RLENGTH)
            sub(/^[^\/]*\//, "", tok)  # strip leading boundary chars + slash
            name = tok
            # skip case-pattern style (followed by * or ) in trailing context)
            tail = substr(rest, RSTART+RLENGTH, 2)
            if (tail !~ /^[*)]/ ) {
              # skip self-defining file
              if (!(file ~ ("/" name "/SKILL\\.md$")) && !(file ~ ("/" name "\\.md$"))) {
                print file, "?", name, "?", "slash_text", line
              }
            }
            rest = substr(rest, RSTART+RLENGTH)
          }
        }' \
    | sort -u \
    | while IFS=, read -r file _ name _ kind line; do
        # validate name is in known set (alternation may catch substrings)
        if grep -qFx "$name" "$SKILL_NAMES_FILE" "$COMMAND_NAMES_FILE" 2>/dev/null; then
          cp="$(plugin_of_path "$file")"
          kp="$(bundle_for "$name")"
          echo "$file,$cp,$name,$kp,$kind,$line"
        fi
      done

  # 2c) frontmatter allowed-tools containing Skill names
  grep -rn "allowed-tools:" agents/ skills/ plugins/ 2>/dev/null \
    | while IFS=: read -r file line rest; do
        cp="$(plugin_of_path "$file")"
        # heuristic: emit one row per known skill name appearing on the line
        while IFS= read -r name; do
          [ -z "$name" ] && continue
          case "$rest" in
            *"$name"*)
              kp="$(bundle_for "$name")"
              echo "$file,$cp,$name,$kp,frontmatter_allowed,$line"
              ;;
          esac
        done < "$SKILL_NAMES_FILE"
      done
} > "$OUT/refs.csv"

# ----------------------------------------------------------------------------
# 3) agent-restrictions.csv — agents declaring hooks/mcpServers/permissionMode
#    in frontmatter (forbidden in plugin-shipped agents per spec).
# ----------------------------------------------------------------------------
{
  echo "agent_path,field,line"
  while IFS= read -r f; do
    # extract frontmatter (between first two --- lines)
    awk '
      /^---[[:space:]]*$/ { c++; next }
      c==1 { print NR-1 ":" $0 }
      c>=2 { exit }
    ' "$f" 2>/dev/null \
      | grep -E "^[0-9]+:(hooks|mcpServers|permissionMode)[[:space:]]*:" \
      | while IFS=: read -r ln content; do
          field=$(echo "$content" | awk -F: '{print $1}' | tr -d ' ')
          echo "$f,$field,$ln"
        done
  done < <(find agents plugins -path '*/agents/*.md' -o -name '*.md' \
              -path 'agents/*' 2>/dev/null | sort -u)
} > "$OUT/agent-restrictions.csv"

# ----------------------------------------------------------------------------
# Summary report
# ----------------------------------------------------------------------------
echo "=== skills.csv ($(($(wc -l <"$OUT/skills.csv")-1)) skills) ==="
echo "Per-bundle counts:"
awk -F, 'NR>1 {print $3}' "$OUT/skills.csv" | sort | uniq -c | sort -rn
echo
echo "UNASSIGNED skills (need explicit decision):"
awk -F, 'NR>1 && $3=="UNASSIGNED" {print "  "$1" ("$2")"}' "$OUT/skills.csv"
echo
echo "=== refs.csv ($(($(wc -l <"$OUT/refs.csv")-1)) refs) ==="
echo "Cross-bundle edges (caller_plugin != callee_plugin, both known):"
awk -F, 'NR>1 && $2!=$4 && $2!="UNASSIGNED" && $4!="UNASSIGNED" && $2!="" && $4!="" {print $2" -> "$4}' \
  "$OUT/refs.csv" | sort | uniq -c | sort -rn
echo
echo "Refs with UNASSIGNED endpoint (must resolve):"
awk -F, 'NR>1 && ($2=="UNASSIGNED" || $4=="UNASSIGNED") {print $0}' "$OUT/refs.csv" | head -20
echo
echo "=== agent-restrictions.csv ($(($(wc -l <"$OUT/agent-restrictions.csv")-1)) violations) ==="
cat "$OUT/agent-restrictions.csv"
echo
echo "Artifacts written to $OUT/"
ls -la "$OUT/"
