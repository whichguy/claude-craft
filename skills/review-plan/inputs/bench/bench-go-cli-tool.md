# Plan: Go CLI Log Analyzer

## Context

Build a CLI tool in Go for analyzing JSON-structured log files (newline-delimited JSON). The tool replaces ad-hoc `jq` and `grep` pipelines with a purpose-built analyzer that supports filtering, statistics computation, and dual output formats (table/JSON). Must handle 2GB+ files efficiently via streaming — no loading entire files into memory.

Log format (one JSON object per line):
```json
{"timestamp":"2024-01-15T10:30:00Z","level":"error","message":"connection timeout","duration_ms":5200,"service":"api","trace_id":"abc123"}
```

**Project:** New repo at `~/src/loganalyzer`, module `github.com/company/loganalyzer`
**CLI framework:** cobra (team standard)

## Git Setup

- `git init && git commit --allow-empty -m "initial commit"`
- Work on `main` branch (new project)

## Project Structure

```
loganalyzer/
├── main.go                          # Entry point: cmd.Execute()
├── go.mod / go.sum
├── cmd/
│   ├── root.go                      # Root command, global flags
│   ├── filter.go                    # filter subcommand
│   └── stats.go                     # stats subcommand
├── internal/
│   ├── parser/
│   │   ├── parser.go                # Streaming JSON line parser
│   │   └── parser_test.go
│   ├── filter/
│   │   ├── filter.go                # Filter predicate logic
│   │   └── filter_test.go
│   ├── stats/
│   │   ├── collector.go             # Streaming stats accumulator
│   │   └── collector_test.go
│   └── output/
│       ├── table.go                 # tabwriter-based table formatter
│       ├── json.go                  # JSON output formatter
│       ├── table_test.go
│       └── json_test.go
├── testdata/
│   ├── sample.log                   # ~50 entries, all levels/services
│   ├── malformed.log                # Mix of valid + garbage lines
│   └── large_gen.go                 # Generator script for perf testing
└── Makefile
```

## Implementation Steps

### Phase 1: Project Skeleton, Parser, and Filter Command

> Intent: Establish the streaming parser foundation and the most-used subcommand (`filter`). Everything else builds on the parser's streaming interface, so getting this right — especially memory efficiency — is the critical path.

**Pre-check:** Go 1.21+ installed (`go version`)
**Outputs:** Working `filter` subcommand with streaming parser, table + JSON output, unit tests

1. **Initialize project and dependencies:**
   ```bash
   mkdir -p ~/src/loganalyzer && cd ~/src/loganalyzer
   go mod init github.com/company/loganalyzer
   go get github.com/spf13/cobra@latest
   ```

2. **Create `internal/parser/parser.go` — streaming line parser:**
   - `LogEntry` struct: `Timestamp time.Time`, `Level string`, `Message string`, `DurationMs float64`, `Service string`, `TraceID string`, `Raw json.RawMessage` (preserve original bytes), `Fields map[string]any` (all fields for arbitrary field access)
   - `Parse(line []byte) (*LogEntry, error)` — unmarshal single JSON line. First unmarshal into `map[string]any` for `Fields`, then extract known fields into typed struct fields. This supports both typed access for known fields and dynamic access for `--field` filtering.
   - `Scanner` struct wrapping `bufio.Scanner` with a 1MB buffer (`scanner.Buffer(buf, 1<<20)`). Provides `Next() (*LogEntry, error)` and `Err() error`. On malformed lines: increment a counter, log warning to stderr if `--verbose`, continue to next line. Do not use channels — the caller controls iteration, which is simpler and avoids goroutine leak risks.
   - **Why no channels:** A channel-based `StreamEntries` forces a goroutine lifecycle that the caller must manage. A `Scanner`-style pull iterator is idiomatic Go, composes better with early exit (e.g., `--limit`), and avoids the need for context cancellation plumbing.

3. **Create `internal/filter/filter.go` — predicate logic:**
   - `Criteria` struct:
     - `Levels []string` — match any (e.g., `--level error,warn`)
     - `Since time.Time` — entries at or after this timestamp
     - `Until time.Time` — entries before this timestamp
     - `FieldFilters map[string]string` — arbitrary `field=value` equality checks (e.g., `--field service=api`)
     - `MessagePattern *regexp.Regexp` — regex on message field (e.g., `--grep "timeout|refused"`)
   - `Match(entry *LogEntry) bool` — AND-combine all non-zero filter fields. For `Levels`, check membership via a pre-built `map[string]bool` (built once in a `Compile()` method, not on every call). For `FieldFilters`, look up in `entry.Fields`.
   - `Compile() error` — validate and pre-compile: parse time strings, compile regex, build level set. Called once at startup; returns user-friendly errors.

4. **Create `internal/output/table.go` — table formatter:**
   - `TableWriter` struct wrapping `tabwriter.Writer`
   - `WriteHeader()` — prints `TIMESTAMP  LEVEL  SERVICE  MESSAGE`
   - `WriteEntry(entry *LogEntry)` — one row per entry, streaming (flush after each write)
   - Colorize level column: red for `error`/`fatal`, yellow for `warn`, default for others. Use ANSI codes only when stdout is a terminal (`term.IsTerminal(int(os.Stdout.Fd()))` from `golang.org/x/term`, or check `NO_COLOR` env var per https://no-color.org/).
   - Truncate message to fit terminal width minus other columns. Get width from `term.GetSize()` with fallback to 120.

5. **Create `internal/output/json.go` — JSON formatter:**
   - `JSONWriter` struct wrapping `json.Encoder` on an `io.Writer`
   - `WriteEntry(entry *LogEntry)` — write `entry.Raw` (original JSON) as one line, preserving the source format exactly. This avoids re-serialization artifacts.
   - No wrapping array — output is newline-delimited JSON (same format as input, composable with `jq`).

6. **Create `cmd/root.go` — cobra root command:**
   - Global persistent flags:
     - `--input, -i <path>` (default: stdin) — open file with `os.Open`, defer close
     - `--output-format, -o <table|json>` (default: `table`)
     - `--verbose, -v` — debug/warning output to stderr
   - `PersistentPreRunE`: resolve input source (file vs stdin), store in command context via `context.WithValue` or a shared config struct passed through cobra's `SetContext`.

7. **Create `cmd/filter.go` — `filter` subcommand:**
   - Flags: `--level <levels>` (comma-separated), `--since <RFC3339|duration>`, `--until <RFC3339>`, `--field <key=value>` (repeatable via `StringSliceVar`), `--grep <pattern>`, `--limit <N>` (stop after N matches, default unlimited)
   - `--since` accepts either RFC3339 (`2024-01-15T00:00:00Z`) or a Go duration relative to now (`24h`, `30m`) — parse with `time.Parse` first, fall back to `time.ParseDuration` and subtract from `time.Now()`
   - RunE: build `Criteria` from flags, call `Compile()`, create `Scanner` from input, create output writer based on format flag, iterate entries, apply filter, write matches, respect `--limit`
   - Exit code 0 even if no matches (matching `grep -q` would be exit 1, but for a log tool, no matches is a normal result)

8. **Create `main.go`:** Call `cmd.Execute()`, `os.Exit(1)` on error.

9. **Write unit tests:**
   - `internal/parser/parser_test.go`:
     - Valid JSON line with all fields
     - Missing optional fields (e.g., no `duration_ms`) — zero values, no error
     - Extra unknown fields land in `Fields` map
     - Malformed JSON — returns error, caller decides what to do
     - Scanner integration: multi-line input, malformed lines skipped with count
     - Empty input — zero entries, no error
   - `internal/filter/filter_test.go`:
     - Single criterion: level match, level mismatch, time range, field filter, grep pattern
     - Combined criteria (AND logic): level + time + field
     - Edge cases: empty criteria matches everything, regex compile error from `Compile()`
   - `internal/output/table_test.go`: verify tab-separated columns, message truncation at boundary
   - `internal/output/json_test.go`: verify output is valid NDJSON, preserves original `Raw` bytes

10. **Run tests:** `go test ./... -v -race`

11. **Create `testdata/sample.log`:** ~50 entries spanning 2 hours, mix of `debug`/`info`/`warn`/`error` levels, 3 services (`api`, `worker`, `scheduler`), varying `duration_ms` (1–5000), several shared `trace_id` values.

12. **Manual smoke test:**
    ```bash
    go run . filter -i testdata/sample.log --level error
    go run . filter -i testdata/sample.log --level error,warn --grep "timeout"
    go run . filter -i testdata/sample.log --field service=api --since 2024-01-15T10:00:00Z -o json | jq .
    cat testdata/sample.log | go run . filter --level info --limit 5
    ```

**Phase 1 commit:** `git add -A && git commit -m "feat: streaming log parser, filter command with table/JSON output"`

---

### Phase 2: Stats Command

> Intent: Add the analytical subcommand that computes aggregate statistics over the log stream. Uses the same streaming parser — stats are accumulated in constant memory regardless of file size. This is the primary value-add over raw `jq`.

**Pre-check:** `go test ./...` passes, `filter` command works
**Outputs:** `stats` subcommand, streaming stats collector, tests

13. **Create `internal/stats/collector.go` — streaming statistics accumulator:**
    - `Collector` struct, updated entry-by-entry (no slice of all entries):
      - `TotalEntries int64`
      - `LevelCounts map[string]int64` — count per level
      - `FirstTimestamp, LastTimestamp time.Time` — for time span and RPM
      - `DurationDigest` — for percentile computation (see below)
      - `ServiceCounts map[string]int64` — count per service
    - `Add(entry *LogEntry)` — update all accumulators. O(1) per entry.
    - `Results() *StatsResult` — compute final stats from accumulators.
    - **Percentile computation:** Use a t-digest algorithm (e.g., `github.com/caio/go-tdigest`) for approximate p50/p95/p99 of `duration_ms`. T-digest uses bounded memory (~few KB) regardless of input size, with <1% error at extreme quantiles. If the team prefers zero dependencies beyond cobra, implement a simpler approach: maintain a sorted slice of up to 10,000 sampled values using reservoir sampling — but t-digest is strictly better and the dependency is tiny.
    - `StatsResult` struct:
      - `TotalEntries int64`
      - `TimeSpan time.Duration`
      - `RequestsPerMinute float64` — `TotalEntries / TimeSpan.Minutes()`
      - `ErrorRate float64` — `(LevelCounts["error"] + LevelCounts["fatal"]) / TotalEntries`
      - `LatencyP50, LatencyP95, LatencyP99 float64` — in milliseconds
      - `LevelBreakdown map[string]int64`
      - `ServiceBreakdown map[string]int64`
      - `EntriesWithDuration int64` — how many entries had a `duration_ms` field (for transparency: "p95 computed from N entries")

14. **Create `cmd/stats.go` — `stats` subcommand:**
    - Reuses the same filter flags as `filter` (extract shared flag registration into a helper function in `cmd/flags.go` — both `filter` and `stats` call `registerFilterFlags(cmd)`)
    - RunE: build `Criteria`, create `Scanner`, iterate entries, apply filter, feed matching entries to `Collector.Add()`, then output `Results()`
    - Table output format:
      ```
      Log Statistics
      ══════════════════════════════════
      Total entries:      148,293
      Time span:          2h 15m 30s
      Requests/min:       1,097.3
      Error rate:         3.2%

      Latency (from 142,108 entries with duration_ms)
        p50:              12.0 ms
        p95:              145.0 ms
        p99:              892.0 ms

      Level Breakdown
        info              128,401  (86.6%)
        warn               14,892  (10.0%)
        error               4,750  ( 3.2%)
        debug                 250  ( 0.2%)

      Service Breakdown
        api                89,102  (60.1%)
        worker             42,300  (28.5%)
        scheduler          16,891  (11.4%)
      ```
    - JSON output: serialize `StatsResult` struct directly

15. **Create `cmd/flags.go` — shared filter flag registration:**
    - `RegisterFilterFlags(cmd *cobra.Command) *filter.Criteria` — registers all filter flags on the command and returns a `Criteria` struct whose fields are bound to the flags. Both `filter` and `stats` call this.
    - Refactor `cmd/filter.go` to use `RegisterFilterFlags`.

16. **Write tests:**
    - `internal/stats/collector_test.go`:
      - Empty input: zero values, no panic, RPM is 0 (guard against division by zero on zero time span)
      - Known input: 10 entries with specific `duration_ms` values, verify exact p50/p95/p99
      - No duration fields: percentiles reported as 0 or N/A, `EntriesWithDuration` is 0
      - Single entry: RPM edge case (time span is 0)
      - Error rate: mix of levels, verify `(error+fatal)/total`
    - `cmd/stats_test.go`: end-to-end test feeding `testdata/sample.log`, verify output contains expected sections

17. **Run tests:** `go test ./... -v -race`

18. **Manual smoke test:**
    ```bash
    go run . stats -i testdata/sample.log
    go run . stats -i testdata/sample.log --level error --field service=api
    go run . stats -i testdata/sample.log -o json | jq '.error_rate'
    ```

**Phase 2 commit:** `git add cmd/stats.go cmd/flags.go internal/stats/ && git commit -m "feat: add stats command with error rate, latency percentiles, and RPM"`

---

### Phase 3: Performance, Build, and Polish

> Intent: Validate that the tool handles 2GB+ files within acceptable time and memory, add build infrastructure, and polish rough edges. This is where the "large file" requirement gets explicitly tested and any bottlenecks get addressed.

**Pre-check:** All tests pass, both subcommands work
**Outputs:** Performance-tested tool, Makefile, CI-ready linting, documented usage

19. **Create `testdata/large_gen.go` — test data generator:**
    - Standalone `go run` script (build tag `ignore` so it's excluded from normal builds)
    - Generates configurable number of log lines (default 5 million, ~1.5GB)
    - Realistic distribution: 85% info, 10% warn, 4% error, 1% debug
    - `duration_ms` follows a log-normal distribution (median ~15ms, p99 ~800ms)
    - Timestamps span 2 hours with realistic clustering

20. **Performance benchmarks and validation:**
    - Generate 2GB test file: `go run testdata/large_gen.go -lines 7000000 -out /tmp/large.log`
    - Benchmark `filter`: `time go run . filter -i /tmp/large.log --level error > /dev/null` — target: <30s for 2GB
    - Benchmark `stats`: `time go run . stats -i /tmp/large.log` — target: <45s for 2GB
    - Monitor memory: `go build -o /tmp/la . && /usr/bin/time -l /tmp/la stats -i /tmp/large.log` — RSS should stay under 50MB regardless of file size
    - If too slow: profile with `go tool pprof` and address. Likely bottleneck is JSON unmarshaling — consider `json.NewDecoder` with pre-allocated structs, or `jsoniter` as a drop-in replacement if stdlib is the bottleneck. Also ensure `bufio.Scanner` buffer is large enough (1MB) to avoid excessive syscalls.
    - Add `go test -bench=. -benchmem` benchmarks in `internal/parser/parser_test.go`:
      - `BenchmarkParseLine` — single line parse
      - `BenchmarkScannerThroughput` — measure MB/s through full pipeline

21. **Create `Makefile`:**
    ```makefile
    .PHONY: build test lint clean bench

    VERSION ?= $(shell git describe --tags --always --dirty)
    LDFLAGS := -ldflags "-X main.version=$(VERSION)"

    build:
    	go build $(LDFLAGS) -o bin/loganalyzer .

    test:
    	go test ./... -v -race

    bench:
    	go test ./internal/parser/ -bench=. -benchmem
    	go test ./internal/stats/ -bench=. -benchmem

    lint:
    	golangci-lint run

    clean:
    	rm -rf bin/

    install:
    	go install $(LDFLAGS) .
    ```

22. **Add `--version` flag to root command** using the `VERSION` ldflags variable.

23. **Run `golangci-lint run`** — fix all findings. Common ones: unchecked error returns (especially on `fmt.Fprintf` to tabwriter), unused variables, `time.Time` zero value checks.

24. **Add a `--count` flag to `filter` command** — output only the count of matching entries instead of the entries themselves. Useful for quick checks: `loganalyzer filter -i app.log --level error --count` prints `47`.

25. **Run full validation:**
    ```bash
    make test && make lint && make build
    ./bin/loganalyzer filter -i testdata/sample.log --level error
    ./bin/loganalyzer stats -i testdata/sample.log
    ./bin/loganalyzer filter -i testdata/malformed.log --level info -v 2>/tmp/warnings.txt
    # Verify warnings were emitted for malformed lines, valid lines processed
    ```

**Phase 3 commit:** `git add Makefile testdata/large_gen.go cmd/ internal/ && git commit -m "perf: add benchmarks, build pipeline, and polish"`

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parser style | Pull iterator (`Scanner.Next()`) | Simpler lifecycle than channel+goroutine, composes with early exit (`--limit`), no leak risk |
| Percentile algorithm | T-digest | Bounded memory for arbitrary input sizes, <1% error, single small dependency |
| JSON output format | NDJSON (one object per line) | Same format as input, composable with `jq` and other tools, streamable |
| Preserve `Raw` bytes | `json.RawMessage` on `LogEntry` | Avoids re-serialization artifacts in JSON output mode |
| Filter combination | AND logic | Matches user mental model of narrowing results; OR can be achieved by running multiple commands |
| `--field` filter | Equality on `map[string]any` | Supports any field without schema changes; more complex operators (>, <, regex) deferred to v0.2 |
| Color output | Conditional on `isatty` + `NO_COLOR` | Respects standard conventions, no broken output when piped |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON parsing is too slow for 2GB files | Tool unusable for primary use case | Phase 3 benchmarks catch this early; `jsoniter` is a drop-in replacement; can also add `--fast` mode that regex-filters lines before JSON parsing |
| T-digest dependency adds complexity | Harder to audit/maintain | Library is small, well-tested, widely used; fallback is reservoir sampling with fixed 10K buffer |
| Log format varies across services | Parser silently produces zero values | `Fields map[string]any` captures everything; `--verbose` warns on missing expected fields; struct fields are optional by design |
| Scanner buffer too small for long lines | Lines silently truncated | 1MB buffer handles realistic lines; `Scanner.Err()` checked and reported |

## Verification

After all phases, these end-to-end checks confirm the tool works:

1. `./bin/loganalyzer filter -i testdata/sample.log --level error` — only error entries
2. `./bin/loganalyzer filter -i testdata/sample.log --level warn,error --since 2024-01-15T10:00:00Z --field service=api -o json | jq length` — count matches jq baseline
3. `./bin/loganalyzer stats -i testdata/sample.log` — all stat sections present, percentages sum to ~100%
4. `./bin/loganalyzer stats -i testdata/sample.log -o json | jq .` — valid JSON, contains `error_rate`, `latency_p99`, etc.
5. `./bin/loganalyzer filter -i testdata/malformed.log --level info -v` — warnings on stderr for bad lines, valid lines output, exit 0
6. `./bin/loganalyzer filter -i testdata/sample.log --level error --count` — prints integer count
7. 2GB file: `./bin/loganalyzer stats -i /tmp/large.log` completes in <45s with <50MB RSS
8. `make test && make lint` — exit 0
