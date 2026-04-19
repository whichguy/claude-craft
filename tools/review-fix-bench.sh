#!/usr/bin/env bash
set -eo pipefail

# review-fix-bench.sh — A/B benchmark harness for code-reviewer agent
#
# Modes:
#   --run [--label NAME] [--fixtures DIR] [--runs N]   Run benchmarks
#   --compare FILE_A FILE_B                             Compare two result files
#
# QI compliance:
#   QI-2: --model-pin VERSION enforced; run fails on mismatch
#   QI-3: raw per-run data stored unaggregated in results JSON
#   QI-4: --holdout-fixtures N reserves N fixtures for validation (E3/E4)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="${REPO_DIR}/test/fixtures/review-fix"
RESULTS_DIR="${REPO_DIR}/results"
RUNS_PER_FIXTURE=1
LABEL="run"
MODE=""
AGENT_FILE=""
JUDGE_FILE=""
MODEL_PIN=""          # --model-pin VERSION: fail if claude reports different model
PER_RUN_TIMEOUT=120   # --per-run-timeout N (seconds)
MAX_CONCURRENCY=4     # --max-concurrency N (rate-limit budget)
HOLDOUT_FIXTURES=0    # --holdout-fixtures N (train/test split for E3/E4; QI-4)

# ── Router-aware claude command resolution ────────────────────────────
# Prefer claude-router (enables --route flag); fall back to bare claude.
CLAUDE_CMD=""
if [[ -x "$HOME/.claude/tools/claude-router" ]]; then
  CLAUDE_CMD="$HOME/.claude/tools/claude-router"
elif [[ -x "$REPO_DIR/tools/claude-router" ]]; then
  CLAUDE_CMD="$REPO_DIR/tools/claude-router"
elif command -v claude-router >/dev/null 2>&1; then
  CLAUDE_CMD="claude-router"
else
  CLAUDE_CMD="claude"
fi

# --route default is only valid when claude-router is the runner; bare claude rejects it.
if [[ "$CLAUDE_CMD" != "claude" ]]; then
  BENCH_ROUTE_ARGS=(--route default)
else
  BENCH_ROUTE_ARGS=()
fi

# ── Argument parsing ──────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage:
  review-fix-bench.sh --run [OPTIONS]
  review-fix-bench.sh --compare FILE_A FILE_B

Options:
  --run              Run benchmark against fixtures
  --compare          Compare two result JSON files
  --label NAME       Label for this run (default: "run")
  --fixtures DIR     Fixtures directory (default: test/fixtures/review-fix/)
  --runs N           Runs per fixture for variance (default: 1, max: 10)
  --agent-file PATH  Inject reviewer agent instructions (prepended to prompt)
  --judge-file PATH  Use LLM judge for semantic matching (default: regex pipeline)
  --model-pin VER    Require exact model version string; fail if mismatch (QI-2)
  --per-run-timeout N  Timeout per reviewer invocation in seconds (default: 120)
  --max-concurrency N  Max parallel Claude calls (default: 4, rate-limit budget)
  --holdout-fixtures N Hold out N fixtures from training set for validation (QI-4)
  -h, --help         Show this help

Token telemetry (requires --output-format json with usage block):
  Captures input_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  output_tokens per run. Derives cost_usd via Anthropic rate card.
  Raw per-run data stored unaggregated in results JSON (QI-3).

Rate card (Sonnet 4.x, per 1M tokens):
  Input: $3.00  Cached read: $0.30  Output: $15.00
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run) MODE="run"; shift ;;
    --compare) MODE="compare"; shift ;;
    --label) LABEL="$2"; shift 2 ;;
    --fixtures) FIXTURES_DIR="$2"; shift 2 ;;
    --runs) RUNS_PER_FIXTURE="$2"; shift 2 ;;
    --agent-file) AGENT_FILE="$2"; shift 2 ;;
    --judge-file) JUDGE_FILE="$2"; shift 2 ;;
    --model-pin) MODEL_PIN="$2"; shift 2 ;;
    --per-run-timeout) PER_RUN_TIMEOUT="$2"; shift 2 ;;
    --max-concurrency) MAX_CONCURRENCY="$2"; shift 2 ;;
    --holdout-fixtures) HOLDOUT_FIXTURES="$2"; shift 2 ;;
    -h|--help) usage ;;
    *)
      if [[ "$MODE" == "compare" ]]; then
        if [[ -z "${COMPARE_A:-}" ]]; then
          COMPARE_A="$1"
        elif [[ -z "${COMPARE_B:-}" ]]; then
          COMPARE_B="$1"
        else
          echo "Error: unexpected argument: $1" >&2; exit 1
        fi
        shift
      else
        echo "Error: unknown option: $1" >&2; exit 1
      fi
      ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Error: specify --run or --compare" >&2
  usage
fi

# Cap runs at 10 (E0 requires 10 runs; prior cap of 3 was too restrictive)
if [[ "$RUNS_PER_FIXTURE" -gt 10 ]]; then
  echo "Warning: capping --runs to 10 (API quota protection)" >&2
  RUNS_PER_FIXTURE=10
fi

# ── Utility functions ─────────────────────────────────────────────────

json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()), end="")'
}

# Compute metric: precision = TP / (TP + FP)
calc_precision() {
  local tp=$1 fp=$2
  if [[ $((tp + fp)) -eq 0 ]]; then echo "0"; return; fi
  python3 -c "print(round($tp / ($tp + $fp), 4))"
}

# Compute metric: recall = TP / (TP + FN)
calc_recall() {
  local tp=$1 fn=$2
  if [[ $((tp + fn)) -eq 0 ]]; then echo "0"; return; fi
  python3 -c "print(round($tp / ($tp + $fn), 4))"
}

# Compute metric: F1 = 2 * P * R / (P + R)
calc_f1() {
  local p=$1 r=$2
  python3 -c "
p, r = $p, $r
print(round(2 * p * r / (p + r), 4) if (p + r) > 0 else 0)
"
}

# ── Model version check (QI-2) ────────────────────────────────────────
# Parses model string from --output-format json response.
# Returns empty string if not parseable.
extract_model_from_response() {
  local raw_json="$1"
  python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    # Claude CLI json output may include 'model' at top level
    if isinstance(data, dict):
        print(data.get('model', data.get('claude_model', '')))
    else:
        print('')
except:
    print('')
" <<< "$raw_json"
}

# Enforce model pin: compare actual vs expected, exit 1 on mismatch.
# Pass empty MODEL_PIN to skip check.
check_model_pin() {
  local actual="$1"
  local expected="$2"
  if [[ -z "$expected" ]]; then return 0; fi
  if [[ -z "$actual" ]]; then
    echo "Warning: model pin set to '$expected' but response included no model field — cannot verify" >&2
    return 0
  fi
  if [[ "$actual" != *"$expected"* ]]; then
    echo "FATAL: model pin mismatch — expected '$expected', got '$actual'" >&2
    echo "  All comparisons require the same model. Re-run after verifying claude version." >&2
    exit 1
  fi
}

# ── Token telemetry ───────────────────────────────────────────────────
# Parse usage block from claude CLI --output-format json response.
# Returns JSON object with token fields and derived cost_usd.
parse_token_usage() {
  local raw_json="$1"
  python3 -c "
import json, sys

# Anthropic rate card (Sonnet 4.x), per 1M tokens
INPUT_RATE   = 3.00
CACHED_RATE  = 0.30    # cache_read_input_tokens
CACHE_CREATE = 3.75    # cache_creation_input_tokens (slightly above input)
OUTPUT_RATE  = 15.00

try:
    data = json.loads(sys.stdin.read())
    usage = {}
    if isinstance(data, dict):
        usage = data.get('usage', {})
        # Some claude CLI versions nest usage differently
        if not usage and 'cost' in data:
            usage = data
except Exception:
    usage = {}

inp  = int(usage.get('input_tokens', 0))
cc   = int(usage.get('cache_creation_input_tokens', 0))
cr   = int(usage.get('cache_read_input_tokens', 0))
out  = int(usage.get('output_tokens', 0))

cost = (inp * INPUT_RATE + cc * CACHE_CREATE + cr * CACHED_RATE + out * OUTPUT_RATE) / 1_000_000

result = {
    'input_tokens': inp,
    'cache_creation_input_tokens': cc,
    'cache_read_input_tokens': cr,
    'output_tokens': out,
    'cost_usd': round(cost, 6)
}
print(json.dumps(result))
" <<< "$raw_json"
}

# ── Match findings against ground truth ───────────────────────────────
match_findings() {
  local findings_json="$1"
  local gt_json="$2"
  python3 -c "
import json, sys

findings = json.loads('''$findings_json''')
gt = json.loads(open('$gt_json').read())

matched_ids = set()
matched_findings = set()
scored = []

for fi, f in enumerate(findings):
    for issue in gt['issues']:
        if issue['id'] in matched_ids:
            continue
        score = 0
        f_line = f.get('line', -999)
        i_line = issue.get('line', -999)
        if f_line > 0 and i_line > 0 and abs(f_line - i_line) <= 3:
            score = 3
        elif f.get('category', '') == issue.get('category', ''):
            score = 2
        else:
            f_words = set(f.get('description', '').lower().split())
            i_words = issue.get('description', '').lower().split()
            if i_words and len([w for w in i_words if w in f_words]) / len(i_words) > 0.5:
                score = 1
        if score > 0:
            scored.append((score, fi, issue['id']))

scored.sort(key=lambda x: -x[0])
tp = []
for score, fi, iid in scored:
    if iid in matched_ids or fi in matched_findings:
        continue
    matched_ids.add(iid)
    matched_findings.add(fi)
    tp.append(iid)

fp = [i for i in range(len(findings)) if i not in matched_findings]
fn = [issue['id'] for issue in gt['issues'] if issue['id'] not in matched_ids]

print(json.dumps({'tp': tp, 'fp_count': len(fp), 'fn': fn}))
"
}

# Parse Claude CLI output to extract findings (regex path)
parse_findings() {
  local response="$1"
  printf '%s' "$response" | python3 -c "
import json, re, sys

response = sys.stdin.read()

findings = []
lines = response.split('\n')
current = {}
for line in lines:
    line = line.strip()
    q_match = re.match(r'^[*-]?\s*\*?\*?Q(\d+)\*?\*?[:\s]', line, re.IGNORECASE)
    if q_match:
        if current:
            findings.append(current)
        current = {'question': 'Q' + q_match.group(1), 'description': line}
        line_match = re.search(r'[Ll]ine\s+(\d+)', line)
        if line_match:
            current['line'] = int(line_match.group(1))
        cats = {'sql': 'security', 'injection': 'security', 'xss': 'security',
                'prototype': 'security', 'null': 'correctness', 'undefined': 'correctness',
                'off-by': 'correctness', 'boundary': 'correctness', 'type': 'correctness',
                'error': 'error-handling', 'catch': 'error-handling', 'promise': 'async',
                'await': 'async', 'intent': 'intent', 'name': 'intent',
                'unused': 'minimal-change', 'abstract': 'minimal-change',
                'hook': 'react', 'useEffect': 'react', 'deps': 'react',
                'stale': 'gas', 'quota': 'gas', 'loadNow': 'gas'}
        lower = line.lower()
        for keyword, cat in cats.items():
            if keyword in lower:
                current['category'] = cat
                break
        continue
    sev_match = re.match(r'^[*-]?\s*\*?\*?(Critical|Advisory)\*?\*?[:\s]', line, re.IGNORECASE)
    if sev_match:
        if current:
            findings.append(current)
        current = {'severity': sev_match.group(1), 'description': line}
        line_match = re.search(r'[Ll]ine\s+(\d+)', line)
        if line_match:
            current['line'] = int(line_match.group(1))
        continue
    if current and line and not line.startswith('#'):
        line_match = re.search(r'[Ll]ine\s+(\d+)', line)
        if line_match and 'line' not in current:
            current['line'] = int(line_match.group(1))
        current['description'] += ' ' + line

if current:
    findings.append(current)

print(json.dumps(findings))
"
}

# LLM judge: semantically evaluate review output against ground truth
judge_findings() {
  local fixture_path="$1"
  local gt_file="$2"
  local review_output="$3"

  local judge_prompt
  judge_prompt=$(GT_FILE="$gt_file" FIXTURE_PATH="$fixture_path" python3 -c "
import json, os, sys
gt = json.load(open(os.environ['GT_FILE']))
code = open(os.environ['FIXTURE_PATH']).read()
review = sys.stdin.read()
prompt = '''You are evaluating a code review against known ground truth issues.

## Ground Truth Issues
''' + json.dumps(gt['issues'], indent=2) + '''

## False Positive Traps (code that looks suspicious but is NOT an issue)
''' + json.dumps(gt.get('false_positive_traps', []), indent=2) + '''

## Original Code
\`\`\`
''' + code + '''
\`\`\`

## Code Review Output to Evaluate
''' + review + '''

For each ground truth issue, determine if the review identified it (true positive) or missed it (false negative).
Count reviewer findings that do not match any ground truth issue (false positives).
Apply semantic matching: equivalent descriptions or ±5 line proximity with same issue class count as a match.
Output ONLY valid JSON with no surrounding prose: {\"tp\": [\"ID1\"], \"fp_count\": N, \"fn\": [\"ID2\"], \"reasoning\": \"...\"}'''
print(prompt)
" <<< "$review_output")

  local JUDGE_MAX_CHARS=50000   # ~12k tokens; above this truncate to fit context window
  local JUDGE_TRUNCATE_LINES=200
  local prompt_len="${#judge_prompt}"
  if [[ "$prompt_len" -gt "$JUDGE_MAX_CHARS" ]]; then
    echo "Warning: judge_prompt for ${fixture_path##*/} is ${prompt_len} chars — truncating review output to last $JUDGE_TRUNCATE_LINES lines" >&2
    review_output=$(echo "$review_output" | tail -n "$JUDGE_TRUNCATE_LINES")
    judge_prompt=$(GT_FILE="$gt_file" FIXTURE_PATH="$fixture_path" python3 -c "
import json, os, sys
gt = json.load(open(os.environ['GT_FILE']))
code = open(os.environ['FIXTURE_PATH']).read()
review = sys.stdin.read()
prompt = '''You are evaluating a code review against known ground truth issues.

## Ground Truth Issues
''' + json.dumps(gt['issues'], indent=2) + '''

## False Positive Traps (code that looks suspicious but is NOT an issue)
''' + json.dumps(gt.get('false_positive_traps', []), indent=2) + '''

## Original Code
\`\`\`
''' + code + '''
\`\`\`

## Code Review Output to Evaluate (truncated to last 200 lines)
''' + review + '''

For each ground truth issue, determine if the review identified it (true positive) or missed it (false negative).
Count reviewer findings that do not match any ground truth issue (false positives).
Apply semantic matching: equivalent descriptions or ±5 line proximity with same issue class count as a match.
Output ONLY valid JSON with no surrounding prose: {\"tp\": [\"ID1\"], \"fp_count\": N, \"fn\": [\"ID2\"], \"reasoning\": \"...\"}'''
print(prompt)
" <<< "$review_output")
  fi

  if [[ -n "${JUDGE_FILE:-}" ]] && [[ -f "$JUDGE_FILE" ]]; then
    local judge_instr
    judge_instr=$(cat "$JUDGE_FILE")
    if [[ -z "$judge_instr" ]]; then
      echo "Error: judge-file read failed or empty: $JUDGE_FILE" >&2; exit 1
    fi
    judge_prompt="${judge_instr}

---

${judge_prompt}"
  fi

  if command -v "$CLAUDE_CMD" >/dev/null 2>&1 || [[ -x "$CLAUDE_CMD" ]]; then
    local raw
    raw=$(timeout 120 "$CLAUDE_CMD" --print "${BENCH_ROUTE_ARGS[@]}" -p "$judge_prompt" --output-format json 2>/dev/null \
          || echo '{"result":"{\"tp\":[],\"fp_count\":0,\"fn\":[],\"reasoning\":\"judge error\"}"}')
    python3 -c "
import json, re, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
    text = data.get('result', '') if isinstance(data, dict) else str(data)
except Exception:
    text = raw
m = re.search(r'\{[^{}]*\"tp\"[^{}]*\}', text, re.DOTALL)
if m:
    try:
        obj = json.loads(m.group(0))
        print(json.dumps(obj))
    except Exception:
        print(json.dumps({'tp': [], 'fp_count': 0, 'fn': [], 'reasoning': 'parse error'}))
else:
    print(json.dumps({'tp': [], 'fp_count': 0, 'fn': [], 'reasoning': 'no JSON found'}))
" <<< "$raw"
  else
    echo '{"tp":[],"fp_count":0,"fn":[],"reasoning":"dry-run: no claude CLI"}'
  fi
}

# ── Run mode ──────────────────────────────────────────────────────────

run_benchmarks() {
  echo "═══════════════════════════════════════════════"
  echo "  review-fix-bench: Running benchmarks"
  echo "  Label:    $LABEL"
  echo "  Fixtures: $FIXTURES_DIR"
  echo "  Runs:     $RUNS_PER_FIXTURE per fixture"
  [[ -n "$MODEL_PIN" ]] && echo "  Model pin: $MODEL_PIN"
  [[ -n "$AGENT_FILE" ]] && echo "  Agent:    $AGENT_FILE"
  echo "  Timeout:  ${PER_RUN_TIMEOUT}s per run"
  echo "  Max concurrency: $MAX_CONCURRENCY"
  [[ "$HOLDOUT_FIXTURES" -gt 0 ]] && echo "  Holdout:  $HOLDOUT_FIXTURES fixtures (validation split)"
  echo "═══════════════════════════════════════════════"
  echo

  if ! [[ -d "$FIXTURES_DIR" ]]; then
    echo "Error: fixtures directory not found: $FIXTURES_DIR" >&2
    exit 1
  fi

  local gt_files=()
  while IFS= read -r f; do
    gt_files+=("$f")
  done < <(find "$FIXTURES_DIR" -name '*.ground-truth.json' -type f | sort)

  if [[ ${#gt_files[@]} -lt 1 ]]; then
    echo "Error: no ground-truth files found in $FIXTURES_DIR" >&2
    exit 1
  fi

  # Train/test split (QI-4): hold out last N fixtures (alphabetical order is stable)
  local train_gt_files=("${gt_files[@]}")
  local holdout_gt_files=()
  if [[ "$HOLDOUT_FIXTURES" -gt 0 ]]; then
    local total_fixtures=${#gt_files[@]}
    local holdout_count=$HOLDOUT_FIXTURES
    if [[ "$holdout_count" -ge "$total_fixtures" ]]; then
      echo "Error: --holdout-fixtures $holdout_count >= total fixtures $total_fixtures" >&2
      exit 1
    fi
    local train_count=$((total_fixtures - holdout_count))
    train_gt_files=("${gt_files[@]:0:$train_count}")
    holdout_gt_files=("${gt_files[@]:$train_count}")
    echo "Train/test split: ${#train_gt_files[@]} training, ${#holdout_gt_files[@]} holdout (validation)"
    echo "Holdout fixtures (NOT used for parameter selection):"
    for f in "${holdout_gt_files[@]}"; do echo "  - $(basename "$f")"; done
    echo
  fi

  echo "Found ${#gt_files[@]} fixture(s) (${#train_gt_files[@]} training)"
  echo

  if [[ -n "${AGENT_FILE:-}" ]] && ! [[ -f "$AGENT_FILE" ]]; then
    echo "Error: agent-file not found: $AGENT_FILE" >&2; exit 1
  fi
  if [[ -n "${JUDGE_FILE:-}" ]] && ! [[ -f "$JUDGE_FILE" ]]; then
    echo "Error: judge-file not found: $JUDGE_FILE" >&2; exit 1
  fi

  local agent_label
  if [[ -n "${AGENT_FILE:-}" ]]; then
    agent_label="${AGENT_FILE}@$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  else
    agent_label="generic-prompt@$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  fi
  # Auto-detect dispatch mode from agent file loop markers (line-start anchored to avoid prose matches)
  local dispatch_mode="single"
  if [[ -n "${AGENT_FILE:-}" ]] && [[ -f "$AGENT_FILE" ]] && \
     grep -qE '^(LOOP_DIRECTIVE|max_rounds:|APPLY_AND_RECHECK)' "$AGENT_FILE"; then
    dispatch_mode="loop"
  fi
  if [[ "$dispatch_mode" = "loop" ]]; then
    agent_label="${agent_label}-loop"
  fi

  local prompt_version="$agent_label"
  local actual_model_seen=""
  local any_loop_run=false
  local sum_rounds=0
  local loop_converged_count=0

  # ── Per-fixture loop ───────────────────────────────────────────────

  # QI-3: raw_runs array accumulates every individual run (unaggregated)
  local raw_runs_json="["
  local per_fixture_json="["
  local first_run=true
  local first_fixture=true

  local total_wall=0
  local sum_precision=0
  local sum_recall=0
  local sum_f1=0
  local sum_completeness=0
  local sum_input_tokens=0
  local sum_cache_creation_tokens=0
  local sum_cache_read_tokens=0
  local sum_output_tokens=0
  local sum_cost_usd=0
  local fixture_count=0
  local run_count=0
  local retry_count=0

  # Dispatch fixtures in stable alphabetical order (control: seed fixture order)
  local dispatch_start
  dispatch_start=$(python3 -c 'import time; print(time.time())')
  echo "Dispatch start: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  for gt_file in "${train_gt_files[@]}"; do
    local fixture_name
    fixture_name=$(python3 -c "import json; print(json.load(open('$gt_file'))['fixture'])")
    local fixture_path="${FIXTURES_DIR}/${fixture_name}"

    if ! [[ -f "$fixture_path" ]]; then
      echo "Warning: fixture file not found: $fixture_path — skipping" >&2
      continue
    fi

    echo "──────────────────────────────────────"
    echo "  Fixture: $fixture_name  [$(date -u +"%H:%M:%SZ")]"

    local fixture_content
    fixture_content=$(cat "$fixture_path")

    # Per-fixture run accumulation for averaging
    local fixture_run_json="["
    local first_fixture_run=true

    for run_num in $(seq 1 "$RUNS_PER_FIXTURE"); do
      if [[ "$RUNS_PER_FIXTURE" -gt 1 ]]; then
        echo "  Run $run_num/$RUNS_PER_FIXTURE  [$(date -u +"%H:%M:%SZ")]"
      fi

      local base_prompt="Review this code for bugs, security vulnerabilities, logic errors, and code quality issues. For each issue found, specify: the line number, severity (Critical or Advisory), category, and a specific fix instruction.

Code to review (${fixture_name}):
\`\`\`
${fixture_content}
\`\`\`

List each finding with its line number, severity, and fix."

      local prompt="$base_prompt"
      if [[ -n "${AGENT_FILE:-}" ]] && [[ -f "$AGENT_FILE" ]]; then
        local agent_content
        agent_content=$(cat "$AGENT_FILE")
        if [[ -z "$agent_content" ]]; then
          echo "Error: agent-file read failed or empty: $AGENT_FILE" >&2; exit 1
        fi
        prompt="${agent_content}

---

${base_prompt}"
      fi

      local start_time
      start_time=$(python3 -c 'import time; print(time.time())')

      local response=""
      local raw_response=""
      local was_retry=false
      local run_loop_rounds=0
      local run_loop_converged=false
      local run_loop_findings_per_round="null"
      if command -v "$CLAUDE_CMD" >/dev/null 2>&1 || [[ -x "$CLAUDE_CMD" ]]; then
        if [[ "$dispatch_mode" = "loop" ]]; then
          # Loop-mode dispatch: inject max_rounds + read_only parameters, parse round telemetry
          local loop_prompt="${prompt}

--- BENCH LOOP PARAMETERS ---
max_rounds: 5
read_only: false

After completing all review-fix rounds, append a JSON summary block on its own line:
{\"bench_loop\": {\"rounds\": <N>, \"converged\": <true|false>, \"findings_per_round\": [{\"critical\": <N>, \"advisory\": <N>}, ...]}}"
          raw_response=$(timeout "$PER_RUN_TIMEOUT" "$CLAUDE_CMD" --print "${BENCH_ROUTE_ARGS[@]}" \
                           -p "$loop_prompt" --output-format json 2>/dev/null \
                         || echo '{"result":"error: loop reviewer timed out or failed"}')

          # Parse loop telemetry from response
          local loop_meta
          loop_meta=$(python3 -c "
import json, re, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
    text = data.get('result', '') if isinstance(data, dict) else str(data)
except Exception:
    text = raw
m = re.search(r'\{\"bench_loop\":\s*(\{[^{}]+\})', text, re.DOTALL)
if m:
    try:
        d = json.loads(m.group(1))
        print(json.dumps({'rounds': int(d.get('rounds', 1)),
                          'converged': bool(d.get('converged', False)),
                          'findings_per_round': d.get('findings_per_round', [])}))
    except Exception:
        print(json.dumps({'rounds': 1, 'converged': False, 'findings_per_round': []}))
else:
    print(json.dumps({'rounds': 1, 'converged': False, 'findings_per_round': []}))
" <<< "$raw_response" 2>/dev/null || echo '{"rounds":1,"converged":false,"findings_per_round":[]}')

          run_loop_rounds=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['rounds'])" <<< "$loop_meta" 2>/dev/null || echo 1)
          run_loop_converged=$(python3 -c "import json,sys; print('true' if json.loads(sys.stdin.read())['converged'] else 'false')" <<< "$loop_meta" 2>/dev/null || echo false)
          run_loop_findings_per_round=$(python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())['findings_per_round']))" <<< "$loop_meta" 2>/dev/null || echo '[]')
          any_loop_run=true
        else
          # Single-pass dispatch (default — preserves E0–E6 schema byte-for-byte)
          raw_response=$(timeout "$PER_RUN_TIMEOUT" "$CLAUDE_CMD" --print "${BENCH_ROUTE_ARGS[@]}" \
                           -p "$prompt" --output-format json 2>/dev/null \
                         || echo '{"result":"error: reviewer timed out or failed"}')

          # Detect 429 rate limit — log retry event, re-attempt once after back-off
          if echo "$raw_response" | grep -qi "rate.limit\|429\|too.many.requests"; then
            echo "  429 rate-limit detected — backing off 30s (retry 1 of 1)" >&2
            sleep 30
            was_retry=true
            retry_count=$((retry_count + 1))
            raw_response=$(timeout "$PER_RUN_TIMEOUT" "$CLAUDE_CMD" --print "${BENCH_ROUTE_ARGS[@]}" \
                             -p "$prompt" --output-format json 2>/dev/null \
                           || echo '{"result":"error: reviewer failed after retry"}')
          fi
        fi

        # QI-2: model pin check
        if [[ -n "$MODEL_PIN" ]]; then
          local actual_model
          actual_model=$(extract_model_from_response "$raw_response")
          if [[ -n "$actual_model" ]]; then
            actual_model_seen="$actual_model"
          fi
          check_model_pin "$actual_model" "$MODEL_PIN"
        fi

        # Extract text response
        local text_response
        text_response=$(printf '%s' "$raw_response" | python3 -c "
import json, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
    if isinstance(data, dict) and 'result' in data:
        print(data['result'])
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get('type') == 'text':
                print(item.get('text', ''))
    else:
        print(str(data))
except:
    print(raw)
" 2>/dev/null || echo "$raw_response")
        response="$text_response"
      else
        echo "  Warning: claude CLI / claude-router not found — using dry-run mode" >&2
        response="[Dry run — no Claude CLI available]"
        raw_response='{"result":"[Dry run]"}'
      fi

      local end_time
      end_time=$(python3 -c 'import time; print(time.time())')
      local wall_clock
      wall_clock=$(python3 -c "print(round($end_time - $start_time, 1))")

      # Token telemetry (QI-3: per-run, not averaged)
      local usage_json
      usage_json=$(parse_token_usage "$raw_response")
      local run_input_tokens run_cc_tokens run_cr_tokens run_output_tokens run_cost_usd
      run_input_tokens=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['input_tokens'])" <<< "$usage_json")
      run_cc_tokens=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['cache_creation_input_tokens'])" <<< "$usage_json")
      run_cr_tokens=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['cache_read_input_tokens'])" <<< "$usage_json")
      run_output_tokens=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['output_tokens'])" <<< "$usage_json")
      run_cost_usd=$(python3 -c "import json,sys; print(json.loads(sys.stdin.read())['cost_usd'])" <<< "$usage_json")

      # Legacy token estimate fallback (when usage block absent)
      local tokens_est
      if [[ "$run_input_tokens" -gt 0 || "$run_output_tokens" -gt 0 ]]; then
        tokens_est=$((run_input_tokens + run_output_tokens))
      else
        tokens_est=$(printf '%s' "$response" | python3 -c "import sys; print(len(sys.stdin.read().split()) * 2)")
      fi

      # Match findings against ground truth
      local match_result
      if [[ -n "${JUDGE_FILE:-}" ]]; then
        match_result=$(judge_findings "$fixture_path" "$gt_file" "$response")

        local judge_reasoning
        judge_reasoning=$(python3 -c "import json,sys; r=json.loads(sys.stdin.read()); print(r.get('reasoning',''))" \
          <<< "$match_result" 2>/dev/null || echo "judge error")
        if [[ "$judge_reasoning" == *"judge error"* ]] || [[ "$judge_reasoning" == *"parse error"* ]] \
           || [[ "$judge_reasoning" == *"no JSON found"* ]]; then
          echo "  WARNING: judge failed for $fixture_name — scored as all FN" >&2
          match_result=$(GT_FILE="$gt_file" python3 -c "
import json, os
gt = json.load(open(os.environ['GT_FILE']))
print(json.dumps({'tp': [], 'fp_count': 0, 'fn': [i['id'] for i in gt['issues']], 'reasoning': 'judge failure'}))
")
        fi
      else
        local findings_json
        findings_json=$(parse_findings "$response")
        match_result=$(match_findings "$findings_json" "$gt_file")
      fi

      local tp_list fp_count fn_list
      tp_list=$(printf '%s' "$match_result" | python3 -c "import json,sys; r=json.loads(sys.stdin.read()); print(json.dumps(r['tp']))")
      fp_count=$(printf '%s' "$match_result" | python3 -c "import json,sys; r=json.loads(sys.stdin.read()); print(r['fp_count'])")
      fn_list=$(printf '%s' "$match_result" | python3 -c "import json,sys; r=json.loads(sys.stdin.read()); print(json.dumps(r['fn']))")

      local tp_count fn_count
      tp_count=$(python3 -c "import json; print(len(json.loads('$tp_list')))")
      fn_count=$(python3 -c "import json; print(len(json.loads('$fn_list')))")

      local precision recall f1
      precision=$(calc_precision "$tp_count" "$fp_count")
      recall=$(calc_recall "$tp_count" "$fn_count")
      f1=$(calc_f1 "$precision" "$recall")

      local gt_categories
      gt_categories=$(python3 -c "import json; print(json.dumps(json.load(open('$gt_file'))['categories_present']))")
      local completeness

      if [[ -n "${JUDGE_FILE:-}" ]]; then
        completeness=$(GT_FILE="$gt_file" python3 -c "
import json, os, sys
gt = json.load(open(os.environ['GT_FILE']))
tp = json.loads(sys.argv[1])
gt_cats = json.loads(sys.argv[2])
id_to_cat = {i['id']: i.get('category', '') for i in gt['issues']}
found_cats = set(id_to_cat[t] for t in tp if t in id_to_cat)
present = set(gt_cats)
if not present: print(1.0)
else: print(round(len(found_cats & present) / len(present), 4))
" "$tp_list" "$gt_categories")
      else
        completeness=$(python3 -c "
import json
findings = json.loads('''$findings_json''')
cats = set(f.get('category', '') for f in findings if f.get('category'))
present = set(json.loads('''$gt_categories'''))
if not present: print(1.0)
else: print(round(len(cats & present) / len(present), 4))
")
      fi

      local actionable
      if [[ -n "${JUDGE_FILE:-}" ]]; then
        actionable="$tp_count"
      else
        actionable=$(python3 -c "
import json
findings = json.loads('''$findings_json''')
print(len([f for f in findings if f.get('description', '')]))
")
      fi

      echo "  Results: P=$precision R=$recall F1=$f1 C=$completeness  [${wall_clock}s, tokens=${tokens_est}, cost=\$${run_cost_usd}]"
      echo "    TP: $tp_list"
      if [[ "$fp_count" -gt 0 ]]; then echo "    FP: $fp_count false positive(s)"; fi
      if [[ "$fn_count" -gt 0 ]]; then echo "    FN: $fn_list"; fi
      if [[ "$was_retry" == "true" ]]; then echo "    [RETRY: excluded from primary analysis per rate-limit policy]"; fi

      # QI-3: accumulate raw run record (unaggregated — do NOT average before storing)
      local run_record
      run_record=$(python3 -c "
import json
rec = {
    'fixture': '$fixture_name',
    'run': $run_num,
    'was_retry': $([ "$was_retry" == "true" ] && echo 'true' || echo 'false'),
    'dispatch_ts': '$(date -u +"%Y-%m-%dT%H:%M:%SZ")',
    'precision': $precision,
    'recall': $recall,
    'f1': $f1,
    'completeness': $completeness,
    'wall_clock_s': $wall_clock,
    'true_positives': json.loads('$tp_list'),
    'fp_count': $fp_count,
    'false_negatives': json.loads('$fn_list'),
    'tokens_estimate': $tokens_est,
    'input_tokens': $run_input_tokens,
    'cache_creation_input_tokens': $run_cc_tokens,
    'cache_read_input_tokens': $run_cr_tokens,
    'output_tokens': $run_output_tokens,
    'cost_usd': $run_cost_usd
}
if '$dispatch_mode' == 'loop':
    rec['rounds'] = $run_loop_rounds
    rec['converged'] = $run_loop_converged
    rec['findings_per_round'] = json.loads('''$run_loop_findings_per_round''') if '$run_loop_findings_per_round' != 'null' else []
print(json.dumps(rec))
")
      if [[ "$first_run" == "true" ]]; then first_run=false; else raw_runs_json+=","; fi
      raw_runs_json+="$run_record"
      if [[ "$first_fixture_run" == "true" ]]; then first_fixture_run=false; else fixture_run_json+=","; fi
      fixture_run_json+="$run_record"
      run_count=$((run_count + 1))

      # Accumulate totals (only non-retry runs for primary analysis)
      if [[ "$was_retry" != "true" ]]; then
        total_wall=$(python3 -c "print(round($total_wall + $wall_clock, 1))")
        sum_precision=$(python3 -c "print($sum_precision + $precision)")
        sum_recall=$(python3 -c "print($sum_recall + $recall)")
        sum_f1=$(python3 -c "print($sum_f1 + $f1)")
        sum_completeness=$(python3 -c "print($sum_completeness + $completeness)")
        sum_input_tokens=$((sum_input_tokens + run_input_tokens))
        sum_cache_creation_tokens=$((sum_cache_creation_tokens + run_cc_tokens))
        sum_cache_read_tokens=$((sum_cache_read_tokens + run_cr_tokens))
        sum_output_tokens=$((sum_output_tokens + run_output_tokens))
        sum_cost_usd=$(python3 -c "print(round($sum_cost_usd + $run_cost_usd, 6))")
        fixture_count=$((fixture_count + 1))
        if [[ "$dispatch_mode" = "loop" ]]; then
          sum_rounds=$((sum_rounds + run_loop_rounds))
          if [[ "$run_loop_converged" = "true" ]]; then
            loop_converged_count=$((loop_converged_count + 1))
          fi
        fi
      fi

      # Rate limit spacing for multi-run (respects max-concurrency intent)
      if [[ "$RUNS_PER_FIXTURE" -gt 1 ]] && [[ "$run_num" -lt "$RUNS_PER_FIXTURE" ]]; then
        sleep 2
      fi
    done  # end run loop

    fixture_run_json+="]"

    # Per-fixture summary (mean across runs for this fixture — computed from fixture_run_json below)
    local fixture_summary
    fixture_summary=$(python3 -c "
import json
runs = json.loads('''$fixture_run_json''')
if not runs:
    print(json.dumps({'fixture': '$fixture_name', 'runs': []}))
else:
    print(json.dumps({
        'fixture': '$fixture_name',
        'runs_executed': len(runs),
        'mean_precision': round(sum(r['precision'] for r in runs) / len(runs), 4),
        'mean_recall': round(sum(r['recall'] for r in runs) / len(runs), 4),
        'mean_f1': round(sum(r['f1'] for r in runs) / len(runs), 4),
        'mean_completeness': round(sum(r['completeness'] for r in runs) / len(runs), 4),
        'mean_wall_clock_s': round(sum(r['wall_clock_s'] for r in runs) / len(runs), 1),
        'mean_input_tokens': round(sum(r['input_tokens'] for r in runs) / len(runs)),
        'mean_cache_read_tokens': round(sum(r['cache_read_input_tokens'] for r in runs) / len(runs)),
        'mean_cost_usd': round(sum(r['cost_usd'] for r in runs) / len(runs), 6),
        'runs': runs
    }, indent=2))
")

    if [[ "$first_fixture" == "true" ]]; then first_fixture=false; else per_fixture_json+=","; fi
    per_fixture_json+="$fixture_summary"

  done  # end fixture loop

  raw_runs_json+="]"
  per_fixture_json+="]"

  # ── Aggregate stats ────────────────────────────────────────────────
  local mean_precision mean_recall mean_f1 mean_completeness
  if [[ "$fixture_count" -gt 0 ]]; then
    mean_precision=$(python3 -c "print(round($sum_precision / $fixture_count, 4))")
    mean_recall=$(python3 -c "print(round($sum_recall / $fixture_count, 4))")
    mean_f1=$(python3 -c "print(round($sum_f1 / $fixture_count, 4))")
    mean_completeness=$(python3 -c "print(round($sum_completeness / $fixture_count, 4))")
  else
    mean_precision=0; mean_recall=0; mean_f1=0; mean_completeness=0
  fi

  # Loop-mode aggregates (only emitted when any run used loop dispatch)
  local loop_aggregate_json="null"
  if [[ "$any_loop_run" = "true" ]] && [[ "$fixture_count" -gt 0 ]]; then
    loop_aggregate_json=$(python3 -c "
import json
print(json.dumps({
    'mean_rounds': round($sum_rounds / $fixture_count, 2),
    'convergence_rate': round($loop_converged_count / $fixture_count, 4)
}))
")
  fi

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local results_json
  results_json=$(python3 -c "
import json
agg = {
    'mean_precision': $mean_precision,
    'mean_recall': $mean_recall,
    'mean_f1': $mean_f1,
    'mean_completeness': $mean_completeness,
    'total_wall_clock_s': $total_wall,
    'total_input_tokens': $sum_input_tokens,
    'total_cache_creation_tokens': $sum_cache_creation_tokens,
    'total_cache_read_tokens': $sum_cache_read_tokens,
    'total_output_tokens': $sum_output_tokens,
    'total_cost_usd': $sum_cost_usd
}
loop_agg = json.loads('$loop_aggregate_json') if '$loop_aggregate_json' != 'null' else None
if loop_agg:
    agg['mean_rounds'] = loop_agg['mean_rounds']
    agg['convergence_rate'] = loop_agg['convergence_rate']
results = {
    'label': '$LABEL',
    'timestamp': '$timestamp',
    'prompt_version': '$prompt_version',
    'model_pin': '$MODEL_PIN',
    'model_observed': '$actual_model_seen',
    'fixtures_run': $fixture_count,
    'runs_per_fixture': $RUNS_PER_FIXTURE,
    'retry_count': $retry_count,
    'holdout_fixtures': $HOLDOUT_FIXTURES,
    'per_fixture': json.loads('''$per_fixture_json'''),
    'raw_runs': json.loads('''$raw_runs_json'''),
    'aggregate': agg
}
print(json.dumps(results, indent=2))
")

  mkdir -p "$RESULTS_DIR"
  local date_stamp
  date_stamp=$(date -u +"%Y-%m-%d")
  local out_file="${RESULTS_DIR}/${LABEL}-${date_stamp}.json"

  if [[ -f "$out_file" ]]; then
    local counter=2
    while [[ -f "${RESULTS_DIR}/${LABEL}-${date_stamp}-${counter}.json" ]]; do
      counter=$((counter + 1))
    done
    out_file="${RESULTS_DIR}/${LABEL}-${date_stamp}-${counter}.json"
  fi

  local tmp_file
  tmp_file=$(mktemp "${RESULTS_DIR}/.bench-XXXXXX")
  echo "$results_json" > "$tmp_file"
  mv "$tmp_file" "$out_file"

  echo
  echo "═══════════════════════════════════════════════"
  echo "  Results written to: $out_file"
  echo "  Aggregate: F1=$mean_f1  P=$mean_precision  R=$mean_recall"
  echo "  Total: ${total_wall}s, cost=\$${sum_cost_usd}"
  echo "  Tokens: input=${sum_input_tokens} cached_read=${sum_cache_read_tokens} output=${sum_output_tokens}"
  [[ "$retry_count" -gt 0 ]] && echo "  Retries: $retry_count (excluded from primary analysis)"
  [[ -n "$MODEL_PIN" ]] && echo "  Model pin: $MODEL_PIN (observed: $actual_model_seen)"
  echo "═══════════════════════════════════════════════"
}

# ── Compare mode ──────────────────────────────────────────────────────

compare_results() {
  local file_a="$1"
  local file_b="$2"

  if ! [[ -f "$file_a" ]]; then
    echo "Error: file not found: $file_a" >&2; exit 1
  fi
  if ! [[ -f "$file_b" ]]; then
    echo "Error: file not found: $file_b" >&2; exit 1
  fi

  python3 -c "
import json, sys, math

a = json.load(open('$file_a'))
b = json.load(open('$file_b'))

label_a = a.get('label', 'A')
label_b = b.get('label', 'B')

aa = a['aggregate']
ba = b['aggregate']

def verdict(metric, delta, lower_is_better=False):
    if abs(delta) < 0.01:
        return '  0.00 -'
    if lower_is_better:
        return f'{delta:+.2f} OK' if delta < 0 else f'{delta:+.2f} BAD'
    return f'{delta:+.2f} OK' if delta > 0 else f'{delta:+.2f} BAD'

print()
print('Model pin A:', a.get('model_pin', 'none'), '| observed:', a.get('model_observed', '?'))
print('Model pin B:', b.get('model_pin', 'none'), '| observed:', b.get('model_observed', '?'))
print()
print('┌──────────────────────┬───────────┬───────────┬──────────┐')
print(f'│ Metric               │ {label_a:<9s} │ {label_b:<9s} │ Delta    │')
print('├──────────────────────┼───────────┼───────────┼──────────┤')

metrics = [
    ('Quality (F1)',     'mean_f1',                   False),
    ('Precision',        'mean_precision',             False),
    ('Recall',           'mean_recall',                False),
    ('Completeness',     'mean_completeness',          False),
    ('Speed (s)',        'total_wall_clock_s',         True),
    ('Cost USD',        'total_cost_usd',              True),
    ('Input tokens',    'total_input_tokens',          True),
    ('Cache read tok',  'total_cache_read_tokens',     False),
    ('Output tokens',   'total_output_tokens',         True),
]

for name, key, lower in metrics:
    va = aa.get(key, 0)
    vb = ba.get(key, 0)
    delta = vb - va
    v = verdict(key, delta, lower)
    if isinstance(va, float) or isinstance(vb, float):
        print(f'│ {name:<20s} │ {va:>9.4f} │ {vb:>9.4f} │ {v:<8s} │')
    else:
        print(f'│ {name:<20s} │ {va:>9} │ {vb:>9} │ {v:<8s} │')

print('└──────────────────────┴───────────┴───────────┴──────────┘')

# Cache efficiency (E1 specific)
cr_a = aa.get('total_cache_read_tokens', 0)
cr_b = ba.get('total_cache_read_tokens', 0)
inp_a = aa.get('total_input_tokens', 1)
inp_b = aa.get('total_input_tokens', 1)
if cr_b > 0:
    cache_rate = cr_b / max(1, cr_b + inp_b)
    effective_inp_b = inp_b + 0.1 * cr_b
    effective_inp_a = inp_a
    cost_ratio = effective_inp_b / max(1, effective_inp_a)
    print()
    print(f'Cache analysis (E1): cache_hit_rate={cache_rate:.1%}  effective_input_ratio={cost_ratio:.2f}')
    if cost_ratio <= 0.6:
        print('  => ADOPT gate (cost): PASS (ratio <= 0.60)')
    else:
        print(f'  => ADOPT gate (cost): FAIL (ratio {cost_ratio:.2f} > 0.60)')

# Paired Wilcoxon stub on F1 (requires scipy; graceful fallback)
raw_a = {r['fixture'] + str(r['run']): r['f1'] for r in a.get('raw_runs', [])}
raw_b = {r['fixture'] + str(r['run']): r['f1'] for r in b.get('raw_runs', [])}
pairs = [(raw_a[k], raw_b[k]) for k in raw_a if k in raw_b]
if pairs:
    try:
        from scipy.stats import wilcoxon
        diffs = [b - a for a, b in pairs]
        if len(set(diffs)) > 1:
            stat, pval = wilcoxon(diffs)
            print()
            print(f'Paired Wilcoxon (F1, N={len(pairs)} pairs): stat={stat:.2f}  p={pval:.4f}')
            if pval < 0.05:
                print('  => Statistically significant at alpha=0.05')
            else:
                print('  => Not significant at alpha=0.05')
        else:
            print()
            print('Paired Wilcoxon: all differences identical — cannot compute')
    except ImportError:
        print()
        print('Paired Wilcoxon: scipy not available — install with: pip install scipy')

# Per-fixture breakdown
print()
print('Per-fixture breakdown:')
a_fixtures = {f['fixture']: f for f in a.get('per_fixture', [])}
b_fixtures = {f['fixture']: f for f in b.get('per_fixture', [])}

all_names = sorted(set(list(a_fixtures.keys()) + list(b_fixtures.keys())))
for name in all_names:
    af = a_fixtures.get(name, {})
    bf = b_fixtures.get(name, {})
    f1a = af.get('mean_f1', af.get('f1', 0))
    f1b = bf.get('mean_f1', bf.get('f1', 0))
    ca = af.get('mean_cost_usd', 0)
    cb = bf.get('mean_cost_usd', 0)
    f1_sym = '=' if abs(f1b - f1a) < 0.01 else ('+' if f1b > f1a else '-')
    cost_pct = f'{round((cb - ca) / ca * 100)}%' if ca > 0 else 'N/A'
    print(f'  {name:<30s} F1: {f1a:.2f}->{f1b:.2f} ({f1_sym})  Cost: {cost_pct}')

# Overall verdict
f1_delta = ba.get('mean_f1', 0) - aa.get('mean_f1', 0)
cost_delta = ba.get('total_cost_usd', 0) - aa.get('total_cost_usd', 0)

parts = []
if abs(f1_delta) >= 0.01:
    parts.append(f'quality {f1_delta:+.0%}')
if abs(cost_delta) >= 0.001:
    sign = 'saved' if cost_delta < 0 else 'added'
    parts.append('cost $%.4f %s' % (abs(cost_delta), sign))

if not parts:
    verdict_str = 'NEUTRAL'
elif f1_delta >= 0.01:
    verdict_str = 'IMPROVED'
elif f1_delta <= -0.01:
    verdict_str = 'REGRESSED'
else:
    verdict_str = 'MIXED'

print()
sep = ', '
changes = sep.join(parts) if parts else 'no significant changes'
print(f'Verdict: {verdict_str} ({changes})')
"
}

# ── Main ──────────────────────────────────────────────────────────────

case "$MODE" in
  run)
    run_benchmarks
    ;;
  compare)
    if [[ -z "${COMPARE_A:-}" ]] || [[ -z "${COMPARE_B:-}" ]]; then
      echo "Error: --compare requires two file arguments" >&2
      exit 1
    fi
    compare_results "$COMPARE_A" "$COMPARE_B"
    ;;
esac
