---
name: review-fix-bench
description: A/B benchmarking skill for code reviewer agent prompts. Runs two versions of a reviewer agent against fixture ground truth using an LLM judge for semantic evaluation, then compares precision/recall/F1 metrics side-by-side. Defaults to comparing current agent vs git HEAD~1. Reports IMPROVED / REGRESSED / NEUTRAL verdict on F1.
argument-hint: "[--candidate <path>] [--agent <name>] [--judge <path>] [--fixtures <dir>] [--runs N] [--label-a NAME] [--label-b NAME]"
allowed-tools: Bash, Read, Glob, Grep, TaskCreate, TaskGet, TaskOutput, TaskStop
---

## Step 0 — Parse Arguments

Parse the user's invocation:

```
/review-fix-bench                               # current vs git HEAD~1, code-reviewer agent
/review-fix-bench --candidate path/to/new.md   # current vs explicit candidate file
/review-fix-bench --agent review-fix            # benchmark review-fix instead of code-reviewer
/review-fix-bench --judge path/to/judge.md     # custom judge agent
/review-fix-bench --fixtures path/to/dir/      # custom fixtures directory
/review-fix-bench --runs N                      # N runs per fixture (max 3)
/review-fix-bench --label-a NAME --label-b NAME # custom labels for reports
```

Set defaults:
- `agent` = `code-reviewer`
- `fixtures_dir` = `test/fixtures/review-fix/`
- `runs` = `1`
- `judge_file` = `agents/review-fix-judge.md` (can be overridden with `--judge`)
- `label_a` = `current`
- `label_b` = `candidate` (or `prev` if using git HEAD~1)

## Step 1 — Resolve File Paths and Pre-flight Checks

**Resolve repo root:**
```bash
REPO_DIR=$(git -C "$(pwd)" rev-parse --show-toplevel)
```

**Pre-flight checks — verify these exist before proceeding:**

1. Judge agent: `$REPO_DIR/agents/review-fix-judge.md` (or `--judge` override)
   - Must exist and contain `"tp"`, `"fn"`, `"fp_count"` — grep to verify
   - If missing: error with "Judge agent not found — run: ln -sfn \$(pwd)/agents ~/.claude/agents or check CLAUDE.md"

2. Bench harness: `${CLAUDE_PLUGIN_ROOT}/tools/review-fix-bench.sh`
   - Must exist and contain `JUDGE_FILE` — grep to verify
   - If missing `JUDGE_FILE`: error with "Harness missing --judge-file support — ensure Phase 2 was applied"

3. Fixtures directory: `$REPO_DIR/$fixtures_dir`
   - Must contain at least one `*.ground-truth.json` file

**Resolve Version A** (always the current agent file):
```
version_a_path = "$REPO_DIR/agents/${agent}.md"
```
- Validate it exists; error if not

**Resolve Version B** (candidate or git HEAD~1):

If `--candidate <path>` was provided:
- `version_b_path = <path>` (resolve relative to cwd if not absolute)
- Validate the file exists; if not, error: "Candidate file not found: <path>"
- `version_b_source = "candidate: <path>"`
- Set `label_b = "candidate"` if not overridden

Otherwise, extract from git:
```bash
tmp_b=$(mktemp /tmp/bench-agent-b.XXXXXX)
git -C "$REPO_DIR" show HEAD~1:agents/${agent}.md > "$tmp_b" 2>/dev/null
```
- If this fails (exit non-zero or empty file): error with clear message:
  "Cannot extract HEAD~1 version of agents/${agent}.md — file may be new or only one commit exists.
   Use --candidate <path> to specify version B explicitly."
- `version_b_path = "$tmp_b"` (will be cleaned up after bench completes)
- `version_b_source = "git HEAD~1: agents/${agent}.md"`
- Set `label_b = "prev"` if not overridden

**Git hash for version A:**
```bash
git_hash_a=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
```

## Step 2 — Run Bench A and Bench B in Parallel

Spawn two Task agents **in a single parallel message** (`run_in_background: true`) to execute:

**Task A** — benchmark current agent:
```bash
"${CLAUDE_PLUGIN_ROOT}/tools/review-fix-bench.sh" \
  --run \
  --label "${label_a}" \
  --fixtures "${fixtures_dir}" \
  --runs "${runs}" \
  --agent-file "${version_a_path}" \
  --judge-file "${judge_file}"
```

**Task B** — benchmark candidate agent:
```bash
"${CLAUDE_PLUGIN_ROOT}/tools/review-fix-bench.sh" \
  --run \
  --label "${label_b}" \
  --fixtures "${fixtures_dir}" \
  --runs "${runs}" \
  --agent-file "${version_b_path}" \
  --judge-file "${judge_file}"
```

Both tasks capture stdout. The harness prints `Results written to: <path>` — parse this line to get the result JSON path for each run.

**On failure:** If either task exits non-zero, print the captured stderr and abort. Clean up `$tmp_b` if set.

**After both complete:** Extract result paths:
```
result_a = line matching "Results written to:" from Task A stdout
result_b = line matching "Results written to:" from Task B stdout
```

If either path is missing or the file doesn't exist, error: "Bench run failed to produce results file — check stderr above."

## Step 3 — Compare in a Task Agent

Spawn a third Task agent to run:
```bash
"${CLAUDE_PLUGIN_ROOT}/tools/review-fix-bench.sh" --compare "${result_a}" "${result_b}"
```

Capture the full output (delta table + per-fixture breakdown + verdict line).

**On failure:** If the compare exits non-zero or produces no output, print error and exit cleanly.

## Step 4 — Summary Output

After the compare Task completes, print inline:

```
## Review-Fix Bench Results

**Version A** (baseline): agents/${agent}.md @ ${git_hash_a}
**Version B** (candidate): ${version_b_source}
**Judge**: ${judge_file}
**Fixtures**: ${fixtures_dir} | Runs per fixture: ${runs}

--- Delta Table ---
[compare output here]

--- Verdict ---
Overall: IMPROVED / REGRESSED / NEUTRAL (on F1)
[If IMPROVED]: Recommendation: adopt candidate — F1 improved without precision regression
[If REGRESSED]: Recommendation: revert or revise candidate — F1 declined
[If NEUTRAL]: No significant difference detected (|ΔF1| < 0.01)
```

Parse the `Verdict: ...` line from the compare output to determine IMPROVED / REGRESSED / NEUTRAL.

## Step 5 — Cleanup and Symlink Verification

Clean up temp file if created: `rm -f "$tmp_b"`

Verify the skill symlink exists:
```bash
ls -la ~/.claude/skills/review-fix-bench
```
If it doesn't exist, create it:
```bash
ln -sfn "${REPO_DIR}/skills/review-fix-bench" ~/.claude/skills/review-fix-bench
```
