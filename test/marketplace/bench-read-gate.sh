#!/bin/bash
# bench-read-gate.sh — measure p50/p99 latency of wiki-read-gate.sh against a
# warm file-refs cache. Plan target: p50 < 15ms, p99 < 40ms.
#
# Runs N iterations of the handler with the same hook input and a seeded cache,
# measures wall-clock duration per call, reports percentiles.
#
# Usage:  ./test/bench-read-gate.sh [N=100]
# Env:    WIKI_READ_GATE=0 to confirm the kill-switch short-circuits (sanity check).

set -euo pipefail

N="${1:-100}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HANDLER="$REPO_ROOT/plugins/wiki-hooks/handlers/wiki-read-gate.sh"

if [ ! -x "$HANDLER" ]; then
  echo "bench: handler not executable: $HANDLER" >&2
  exit 1
fi

# --- Build an isolated bench repo with a seeded file-refs.tsv ---
BENCH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/bench-read-gate.XXXXXX")
trap 'rm -rf "$BENCH_DIR"' EXIT

mkdir -p "$BENCH_DIR/repo/wiki/entities" "$BENCH_DIR/repo/wiki/.cache" "$BENCH_DIR/repo/src"
echo "# log" > "$BENCH_DIR/repo/wiki/log.md"
echo "# idx" > "$BENCH_DIR/repo/wiki/index.md"
echo "# schema" > "$BENCH_DIR/repo/wiki/SCHEMA.md"
echo "#!/bin/bash" > "$BENCH_DIR/repo/src/target.sh"

# git init so wiki_find_root's git-anchor path succeeds
(cd "$BENCH_DIR/repo" && git init -q && git add -A && git -c user.email=b@b -c user.name=b commit -q -m b)

# Seed cache with a cache-hit row
printf '%s\t%s\n' "src/target.sh" "bench-alpha,bench-bravo,bench-charlie" > "$BENCH_DIR/repo/wiki/.cache/file-refs.tsv"

INPUT_JSON=$(cat <<EOF
{"session_id":"bench-1234-5678","agent_id":"","cwd":"$BENCH_DIR/repo","tool_name":"Read","tool_input":{"file_path":"$BENCH_DIR/repo/src/target.sh"}}
EOF
)

# Sanity check: handler produces expected output before we start timing
SANITY=$(printf '%s' "$INPUT_JSON" | "$HANDLER" 2>/dev/null || true)
if ! echo "$SANITY" | grep -q 'wiki hint'; then
  echo "bench: sanity check failed — handler did not emit expected hint. Output was:" >&2
  echo "$SANITY" >&2
  exit 1
fi

# --- Measure N iterations ---
# bash 5+ EPOCHREALTIME gives microsecond resolution; required for sub-ms precision.
if [ -z "${EPOCHREALTIME:-}" ]; then
  echo "bench: EPOCHREALTIME unavailable (need bash 5+). Results will be inaccurate." >&2
fi

TIMES_FILE=$(mktemp)
for ((i=0; i<N; i++)); do
  T0="${EPOCHREALTIME:-0}"
  printf '%s' "$INPUT_JSON" | "$HANDLER" >/dev/null 2>&1 || true
  T1="${EPOCHREALTIME:-0}"
  # Compute ms with awk (handles decimal subtraction portably)
  awk "BEGIN{printf \"%.3f\n\", ($T1 - $T0) * 1000}" >> "$TIMES_FILE"
done

# --- Compute percentiles ---
SORTED=$(sort -n "$TIMES_FILE")
TOTAL=$(echo "$SORTED" | wc -l | tr -d ' ')
P50_LINE=$(( (TOTAL * 50 + 99) / 100 ))
P99_LINE=$(( (TOTAL * 99 + 99) / 100 ))
[ "$P50_LINE" -lt 1 ] && P50_LINE=1
[ "$P99_LINE" -gt "$TOTAL" ] && P99_LINE="$TOTAL"

P50=$(echo "$SORTED" | sed -n "${P50_LINE}p")
P99=$(echo "$SORTED" | sed -n "${P99_LINE}p")
MAX=$(echo "$SORTED" | tail -1)
MIN=$(echo "$SORTED" | head -1)
MEAN=$(awk '{s+=$1} END{printf "%.3f", s/NR}' "$TIMES_FILE")

echo "bench-read-gate: N=$TOTAL iterations"
echo "  min  = ${MIN}ms"
echo "  p50  = ${P50}ms   (target < 15ms)"
echo "  mean = ${MEAN}ms"
echo "  p99  = ${P99}ms   (target < 40ms)"
echo "  max  = ${MAX}ms"

rm -f "$TIMES_FILE"

# --- Pass/fail against plan targets ---
P50_INT=$(awk "BEGIN{printf \"%d\", $P50}")
P99_INT=$(awk "BEGIN{printf \"%d\", $P99}")

PASS=1
if [ "$P50_INT" -ge 15 ]; then
  echo "FAIL: p50 ${P50}ms >= 15ms target" >&2
  PASS=0
fi
if [ "$P99_INT" -ge 40 ]; then
  echo "FAIL: p99 ${P99}ms >= 40ms target" >&2
  PASS=0
fi
[ "$PASS" = "1" ] && echo "PASS: p50 < 15ms, p99 < 40ms" || exit 1
