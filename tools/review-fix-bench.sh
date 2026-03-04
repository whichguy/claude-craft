#!/usr/bin/env bash
set -eo pipefail

# review-fix-bench.sh — A/B benchmark harness for code-reviewer agent
#
# Modes:
#   --run [--label NAME] [--fixtures DIR] [--runs N]   Run benchmarks
#   --compare FILE_A FILE_B                             Compare two result files

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="${REPO_DIR}/test/fixtures/review-fix"
RESULTS_DIR="${REPO_DIR}/results"
RUNS_PER_FIXTURE=1
LABEL="run"
MODE=""

# ── Argument parsing ──────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Usage:
  review-fix-bench.sh --run [--label NAME] [--fixtures DIR] [--runs N]
  review-fix-bench.sh --compare FILE_A FILE_B

Options:
  --run           Run benchmark against fixtures
  --compare       Compare two result JSON files
  --label NAME    Label for this run (default: "run")
  --fixtures DIR  Fixtures directory (default: test/fixtures/review-fix/)
  --runs N        Runs per fixture for variance (default: 1, max: 3)
  -h, --help      Show this help
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

# Cap runs to avoid API quota exhaustion
if [[ "$RUNS_PER_FIXTURE" -gt 3 ]]; then
  echo "Warning: capping --runs to 3 (API quota protection)" >&2
  RUNS_PER_FIXTURE=3
fi

# ── Utility functions ─────────────────────────────────────────────────

json_escape() {
  # Escape a string for safe JSON embedding
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

# Match findings against ground truth, output JSON with TP/FP/FN
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

# Parse Claude CLI output to extract findings
parse_findings() {
  local response="$1"
  printf '%s' "$response" | python3 -c "
import json, re, sys

response = sys.stdin.read()

findings = []
# Match patterns like: Q1: ... line N ... or **Line N** ...
# Look for structured findings with line references
lines = response.split('\n')
current = {}
for line in lines:
    line = line.strip()
    # Match Q-ID patterns (e.g., 'Q1:', 'Q2:', etc.)
    q_match = re.match(r'^[*-]?\s*\*?\*?Q(\d+)\*?\*?[:\s]', line, re.IGNORECASE)
    if q_match:
        if current:
            findings.append(current)
        current = {'question': 'Q' + q_match.group(1), 'description': line}
        # Try to extract line number
        line_match = re.search(r'[Ll]ine\s+(\d+)', line)
        if line_match:
            current['line'] = int(line_match.group(1))
        # Try to extract category
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
    # Also match severity patterns
    sev_match = re.match(r'^[*-]?\s*\*?\*?(Critical|Advisory)\*?\*?[:\s]', line, re.IGNORECASE)
    if sev_match:
        if current:
            findings.append(current)
        current = {'severity': sev_match.group(1), 'description': line}
        line_match = re.search(r'[Ll]ine\s+(\d+)', line)
        if line_match:
            current['line'] = int(line_match.group(1))
        continue
    # Accumulate description lines
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

# ── Run mode ──────────────────────────────────────────────────────────

run_benchmarks() {
  echo "═══════════════════════════════════════════════"
  echo "  review-fix-bench: Running benchmarks"
  echo "  Label:    $LABEL"
  echo "  Fixtures: $FIXTURES_DIR"
  echo "  Runs:     $RUNS_PER_FIXTURE per fixture"
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

  echo "Found ${#gt_files[@]} fixture(s)"
  echo

  # Get prompt version from git
  local prompt_version
  prompt_version="agents/review-fix.md@$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

  # Accumulate per-fixture results
  local per_fixture_json="["
  local first=true
  local total_wall=0
  local total_tokens=0
  local sum_precision=0
  local sum_recall=0
  local sum_f1=0
  local sum_completeness=0
  local fixture_count=0

  for gt_file in "${gt_files[@]}"; do
    local fixture_name
    fixture_name=$(python3 -c "import json; print(json.load(open('$gt_file'))['fixture'])")
    local fixture_path="${FIXTURES_DIR}/${fixture_name}"

    if ! [[ -f "$fixture_path" ]]; then
      echo "Warning: fixture file not found: $fixture_path — skipping" >&2
      continue
    fi

    echo "──────────────────────────────────────"
    echo "  Fixture: $fixture_name"

    local fixture_content
    fixture_content=$(cat "$fixture_path")

    for run_num in $(seq 1 "$RUNS_PER_FIXTURE"); do
      if [[ "$RUNS_PER_FIXTURE" -gt 1 ]]; then
        echo "  Run $run_num/$RUNS_PER_FIXTURE"
      fi

      # Build prompt
      local prompt="Review this code for bugs, security vulnerabilities, logic errors, and code quality issues. For each issue found, specify: the line number, severity (Critical or Advisory), category, and a specific fix instruction.

Code to review (${fixture_name}):
\`\`\`
${fixture_content}
\`\`\`

List each finding with its line number, severity, and fix."

      # Execute via Claude CLI
      local start_time
      start_time=$(python3 -c 'import time; print(time.time())')

      local response=""
      local tokens_est=0
      if command -v claude >/dev/null 2>&1; then
        response=$(claude --print -p "$prompt" --output-format json 2>/dev/null || echo '{"result":"error"}')
        # Extract text from JSON response
        local text_response
        text_response=$(printf '%s' "$response" | python3 -c "
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
" 2>/dev/null || echo "$response")
        response="$text_response"
        tokens_est=$(printf '%s' "$response" | python3 -c "import sys; print(len(sys.stdin.read().split()) * 2)")
      else
        echo "  Warning: claude CLI not found — using dry-run mode" >&2
        response="[Dry run — no Claude CLI available]"
        tokens_est=0
      fi

      local end_time
      end_time=$(python3 -c 'import time; print(time.time())')
      local wall_clock
      wall_clock=$(python3 -c "print(round($end_time - $start_time, 1))")

      # Parse findings from response
      local findings_json
      findings_json=$(parse_findings "$response")

      # Match against ground truth
      local match_result
      match_result=$(match_findings "$findings_json" "$gt_file")

      local tp_list fp_count fn_list
      tp_list=$(python3 -c "import json; print(json.dumps(json.loads('$match_result')['tp']))")
      fp_count=$(python3 -c "import json; print(json.loads('$match_result')['fp_count'])")
      fn_list=$(python3 -c "import json; print(json.dumps(json.loads('$match_result')['fn']))")

      local tp_count fn_count
      tp_count=$(python3 -c "import json; print(len(json.loads('$tp_list')))")
      fn_count=$(python3 -c "import json; print(len(json.loads('$fn_list')))")

      # Compute metrics
      local precision recall f1
      precision=$(calc_precision "$tp_count" "$fp_count")
      recall=$(calc_recall "$tp_count" "$fn_count")
      f1=$(calc_f1 "$precision" "$recall")

      # Compute completeness
      local categories_found
      categories_found=$(python3 -c "
import json
findings = json.loads('''$findings_json''')
cats = set(f.get('category', '') for f in findings if f.get('category'))
print(json.dumps(list(cats)))
")
      local gt_categories
      gt_categories=$(python3 -c "import json; print(json.dumps(json.load(open('$gt_file'))['categories_present']))")
      local completeness
      completeness=$(python3 -c "
import json
found = set(json.loads('''$categories_found'''))
present = set(json.loads('''$gt_categories'''))
if not present: print(1.0)
else: print(round(len(found & present) / len(present), 4))
")

      local actionable
      actionable=$(python3 -c "
import json
findings = json.loads('''$findings_json''')
print(len([f for f in findings if f.get('description', '')]))
")

      echo "  Results: P=$precision R=$recall F1=$f1 C=$completeness  [${wall_clock}s, ~${tokens_est} tokens]"
      echo "    TP: $tp_list"
      if [[ "$fp_count" -gt 0 ]]; then echo "    FP: $fp_count false positive(s)"; fi
      if [[ "$fn_count" -gt 0 ]]; then echo "    FN: $fn_list"; fi

      # Accumulate
      if [[ "$first" == "true" ]]; then first=false; else per_fixture_json+=","; fi
      per_fixture_json+=$(python3 -c "
import json
print(json.dumps({
    'fixture': '$fixture_name',
    'precision': $precision,
    'recall': $recall,
    'f1': $f1,
    'completeness': $completeness,
    'wall_clock_s': $wall_clock,
    'tokens_estimate': $tokens_est,
    'rounds': 1,
    'actionable_fixes': $actionable,
    'true_positives': json.loads('$tp_list'),
    'false_positives': [],
    'false_negatives': json.loads('$fn_list')
}, indent=2))
")

      total_wall=$(python3 -c "print(round($total_wall + $wall_clock, 1))")
      total_tokens=$((total_tokens + tokens_est))
      sum_precision=$(python3 -c "print($sum_precision + $precision)")
      sum_recall=$(python3 -c "print($sum_recall + $recall)")
      sum_f1=$(python3 -c "print($sum_f1 + $f1)")
      sum_completeness=$(python3 -c "print($sum_completeness + $completeness)")
      fixture_count=$((fixture_count + 1))

      # Rate limit spacing for multi-run
      if [[ "$RUNS_PER_FIXTURE" -gt 1 ]] && [[ "$run_num" -lt "$RUNS_PER_FIXTURE" ]]; then
        sleep 2
      fi
    done
  done

  per_fixture_json+="]"

  # Compute aggregates
  local mean_precision mean_recall mean_f1 mean_completeness mean_tokens
  if [[ "$fixture_count" -gt 0 ]]; then
    mean_precision=$(python3 -c "print(round($sum_precision / $fixture_count, 4))")
    mean_recall=$(python3 -c "print(round($sum_recall / $fixture_count, 4))")
    mean_f1=$(python3 -c "print(round($sum_f1 / $fixture_count, 4))")
    mean_completeness=$(python3 -c "print(round($sum_completeness / $fixture_count, 4))")
    mean_tokens=$(python3 -c "print(round($total_tokens / $fixture_count))")
  else
    mean_precision=0; mean_recall=0; mean_f1=0; mean_completeness=0; mean_tokens=0
  fi

  # Build results JSON
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local results_json
  results_json=$(python3 -c "
import json
results = {
    'label': '$LABEL',
    'timestamp': '$timestamp',
    'prompt_version': '$prompt_version',
    'fixtures_run': $fixture_count,
    'runs_per_fixture': $RUNS_PER_FIXTURE,
    'per_fixture': json.loads('''$per_fixture_json'''),
    'aggregate': {
        'mean_precision': $mean_precision,
        'mean_recall': $mean_recall,
        'mean_f1': $mean_f1,
        'mean_completeness': $mean_completeness,
        'total_wall_clock_s': $total_wall,
        'total_tokens': $total_tokens,
        'mean_tokens_per_fixture': $mean_tokens
    }
}
print(json.dumps(results, indent=2))
")

  # Write results atomically
  mkdir -p "$RESULTS_DIR"
  local date_stamp
  date_stamp=$(date -u +"%Y-%m-%d")
  local out_file="${RESULTS_DIR}/${LABEL}-${date_stamp}.json"

  # Prevent silent overwrite — append counter if file exists
  if [[ -f "$out_file" ]]; then
    local counter=2
    while [[ -f "${RESULTS_DIR}/${LABEL}-${date_stamp}-${counter}.json" ]]; do
      counter=$((counter + 1))
    done
    out_file="${RESULTS_DIR}/${LABEL}-${date_stamp}-${counter}.json"
  fi

  # Atomic write via temp file
  local tmp_file
  tmp_file=$(mktemp "${RESULTS_DIR}/.bench-XXXXXX")
  echo "$results_json" > "$tmp_file"
  mv "$tmp_file" "$out_file"

  echo
  echo "═══════════════════════════════════════════════"
  echo "  Results written to: $out_file"
  echo "  Aggregate: F1=$mean_f1  P=$mean_precision  R=$mean_recall"
  echo "  Total: ${total_wall}s, ${total_tokens} tokens"
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
import json, sys

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
        return f'{delta:+.2f} ✅' if delta < 0 else f'{delta:+.2f} ❌'
    return f'{delta:+.2f} ✅' if delta > 0 else f'{delta:+.2f} ❌'

print()
print('┌──────────────────┬───────────┬───────────┬──────────┐')
print(f'│ Metric           │ {label_a:<9s} │ {label_b:<9s} │ Δ        │')
print('├──────────────────┼───────────┼───────────┼──────────┤')

metrics = [
    ('Quality (F1)',     'mean_f1',          False),
    ('Precision',        'mean_precision',   False),
    ('Recall',           'mean_recall',      False),
    ('Completeness',     'mean_completeness',False),
    ('Speed (s)',        'total_wall_clock_s',True),
    ('Tokens',           'total_tokens',     True),
]

for name, key, lower in metrics:
    va = aa.get(key, 0)
    vb = ba.get(key, 0)
    delta = vb - va
    v = verdict(key, delta, lower)
    if isinstance(va, float):
        print(f'│ {name:<16s} │ {va:>9.4f} │ {vb:>9.4f} │ {v:<8s} │')
    else:
        print(f'│ {name:<16s} │ {va:>9} │ {vb:>9} │ {v:<8s} │')

print('└──────────────────┴───────────┴───────────┴──────────┘')

# Per-fixture breakdown
print()
print('Per-fixture breakdown:')
a_fixtures = {f['fixture']: f for f in a.get('per_fixture', [])}
b_fixtures = {f['fixture']: f for f in b.get('per_fixture', [])}

all_names = sorted(set(list(a_fixtures.keys()) + list(b_fixtures.keys())))
for name in all_names:
    af = a_fixtures.get(name, {})
    bf = b_fixtures.get(name, {})
    f1a = af.get('f1', 0)
    f1b = bf.get('f1', 0)
    ta = af.get('tokens_estimate', 0)
    tb = bf.get('tokens_estimate', 0)
    f1_sym = '=' if abs(f1b - f1a) < 0.01 else ('+' if f1b > f1a else '-')
    tok_pct = f'{round((tb - ta) / ta * 100)}%' if ta > 0 else 'N/A'
    print(f'  {name:<25s} F1: {f1a:.2f}→{f1b:.2f} ({f1_sym})  Tokens: {ta}→{tb} ({tok_pct})')

# Overall verdict
f1_delta = ba.get('mean_f1', 0) - aa.get('mean_f1', 0)
speed_delta = ba.get('total_wall_clock_s', 0) - aa.get('total_wall_clock_s', 0)
token_delta = ba.get('total_tokens', 0) - aa.get('total_tokens', 0)

parts = []
if abs(f1_delta) >= 0.01:
    parts.append(f'quality {f1_delta:+.0%}')
if abs(speed_delta) >= 1:
    parts.append(f'speed {speed_delta:+.0f}s')
if abs(token_delta) >= 100:
    parts.append(f'tokens {token_delta:+d}')

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
