# Form 990 Skill — Orchestrator

Invoke via: `/form990 <subcommand> [args]`

---

## Step 0 — Argument Parsing

Parse the invocation string to determine subcommand and arguments.

| Invocation | Behavior |
|---|---|
| `/form990 init --sheet <id-or-url> --tax-year <YYYY> [--plan-path <path>]` | Create plan file, run P0 intake |
| `/form990 resume <plan-path>` | Read plan, restore state, dispatch to current_phase |
| `/form990 phase <N> <plan-path>` | Force-run phase N — invalidates downstream via ARTIFACT_DEPS walk (see §Force-Override Protocol) |
| `/form990 review <plan-path>` | Run P8 CPA review pass only |
| `/form990 status <plan-path>` | Render status UI + Q-C31 orphan sweep; no phase work |
| `/form990 ask <plan-path> <question-id> <answer>` | Answer an open question and resume |
| `/form990 verify [--case TC<N>]` | Run test harness `tests/verify.py`; exit 0=all pass, 1=fail, 2=harness error |

**Global flags (accepted on every subcommand):**

| Flag | Behavior |
|---|---|
| `--ascii` | Disable box-drawing; status grid uses `[x] [>] [ ] [!] [.]`; bars use `[####----]` |
| `--trace` | Verbose phase tracing (print every Pre-check / Output emission) |
| `--no-sidecar` | Skip sidecar JSON writes; plan-file-only mode |

**Argument validation (run before any work):**
1. `--sheet`: verify the value is a non-empty string parseable as a Google Sheets ID or URL
2. `--tax-year`: verify 4-digit integer ≤ current year
3. `<plan-path>`: if required for the subcommand, verify the file exists (for resume/review/status/ask)
   or that the parent directory is writable (for init)
4. `--local-pdf <path>`: if provided, verify the file exists and is a PDF (magic-byte check: first 4 bytes == `%PDF`)
5. Do NOT execute any phase work before validation passes

**Defaults:**
- `--plan-path` defaults to `./form990-plan-<tax-year>.md` in the invocation cwd (for `init`)
- `--ascii` defaults OFF (fancy box-drawing on)
- `--no-sidecar` defaults OFF (sidecar writes on)

---

## Step 1 — Plan File Location

**For `init`:** Write the new plan file using `templates/PLAN-TEMPLATE.md` as the scaffold.
Fill `{{LEGAL_NAME}}` and `{{YYYY}}` placeholders. Write to `--plan-path` (default:
`./form990-plan-<tax-year>.md`). Record `plan_lock.pid` + `acquired_at` + `host`.

Git repo check: if the cwd is inside a git repo (check `git rev-parse --is-inside-work-tree`),
print a warning banner:
```
⚠ This plan file will be created inside a git repository.
  Form 990 plans contain PII (EIN, donor data, officer salaries).
  A .gitignore template will be generated alongside the plan file.
  Review before committing: .gitignore includes schedule-b-filing.md,
  all dataset JSONs, and the plan file itself.
```
Then write `.gitignore` to the plan file's directory with the template from
`§ Sensitive-data .gitignore template` below.

**For `resume`/`review`/`status`/`ask`:** Resolve the plan-path argument to an absolute
path. All relative artifact paths in MACHINE STATE are resolved relative to the **plan
file's directory** (not the invocation cwd).

---

## Step 2 — Machine State Parse

Parse the fenced JSON block between `<!-- BEGIN MACHINE STATE -->` and `<!-- END MACHINE STATE -->`.

**Primary path (JSON parses):** use the parsed object as working state.

**Degraded-mode fallback (JSON block absent or fails to parse):**
Print bold warning: `⚠ machine state unreadable — falling back to prose parse`
Then extract from markdown prose:
- `current_phase` ← scan `## Phase Status Grid` for first row with `[◉]`; if none, last `[✔]` + 1; if all empty → P0
- `phase_status{}` ← map `[✔]→done`, `[◉]→in_progress`, `[ ]→pending`, `[✖]→failed`, `[⏸]→paused`
- `key_facts{}` ← regex-parse `## Key Facts` table, col 2 as value
- `artifacts{}` ← regex-parse `## Artifact Registry` table, col 2 as path (skip rows where path == `—`)
- `open_questions[]` ← regex-parse `## Open Questions` section for `OQ-\d+` markers

Proceed with reduced confidence. Rebuild the machine state block on next atomic commit.

**Hostile-edit guards (checked after parse):**
1. Unknown `key_facts` keys → breadcrumb `"unrecognized key_facts.<key> — ignored"`, drop silently
2. `Phase Status Grid` absent in degraded mode → high-visibility halt banner + AskUserQuestion
3. Merge-conflict markers (`<<<<<<<` / `>>>>>>>`) in JSON block → halt immediately
4. Zero-byte plan file → route to `/form990 init` after AskUserQuestion confirmation

---

## Step 3 — Persona Re-Injection

Re-read `## Persona` section from the plan file (not from PERSONA.md — the plan's copy is
authoritative for this session). Bind both persona blocks into the system context for all
subsequent phase work and gate evaluations.

---

## Step 2b — Crash Recovery Sweep (runs after machine state parse, before persona re-injection)

Detect and remediate half-write artifacts and dead-PID running phases left by a crashed
prior session. Must run before dispatcher (Step 6) so dispatcher always sees a stable state.

```
# Step A: Orphan staging file sweep (HalfWrite path)
for artifact_name, entry in state["artifacts"].items():
    if entry.get("status") == "writing":
        pid = entry.get("plan_lock_pid") or state["plan_lock"].get("pid")
        if pid and not is_pid_alive(pid):  # os.kill(pid,0) raises OSError.ESRCH → dead
            staging_path = entry.get("staging_path")
            if staging_path and os.path.exists(staging_path):
                os.unlink(staging_path)
                breadcrumb(f"swept half-write orphan: {staging_path} (phase={entry['produced_in_phase']}, pid={pid})")
            entry["status"] = "absent"
            entry["staging_path"] = null
            producer = entry["produced_in_phase"]
            state["phase_status"][producer] = "failed"
            state["artifacts"][artifact_name]["last_error"] = {
                "error_class": "HalfWrite",
                "phase": producer, "pid": pid,
                "timestamp": now_iso(),
            }

# Step B: Dead-PID running phase sweep (RunningDeadPid — no orphan files)
if state["phase_status"].get(state["current_phase"]) == "running":
    pid = state["plan_lock"].get("pid")
    if pid and not is_pid_alive(pid):
        phase = state["current_phase"]
        state["phase_status"][phase] = "failed"
        state["artifacts_produced_by"] = [
            name for name, e in state["artifacts"].items()
            if e.get("produced_in_phase") == phase
        ]
        for name in state["artifacts_produced_by"]:
            if "last_error" not in state["artifacts"][name]:
                state["artifacts"][name]["last_error"] = {
                    "error_class": "RunningDeadPid",
                    "phase": phase, "pid": pid, "timestamp": now_iso(),
                }
        # Commit the failed state BEFORE dispatcher runs
        atomic_commit(state, plan_path, pre_image_sha256)
        breadcrumb(f"phase {phase} crashed (pid {pid} dead), status=failed+RunningDeadPid; resuming from Pre-check")

# Step C: Temp-file orphan sweep (all known tempfile patterns — Q-C31)
# Runs on every resume AND on /form990 status entry (not just crash recovery).
# Pattern set covers all transient files created by Steps 7a, 7c, P9 WebFetch.
orphan_globs = [
    plan_dir + "/*.tmp.*",                         # plan tmp: <plan>.tmp.<pid>
    "~/.claude/.form990-memo-*.tmp.*",             # sidecar tmp: .form990-memo-<fy>.json.tmp.<pid>
    artifacts_dir + "/**/*.writing.*",             # artifact staging: <name>.writing.<pid>
    artifacts_dir + "/f990-blank-*.pdf.partial.*", # P9 WebFetch partial download
]
for pattern in orphan_globs:
    for tmp in glob(pattern, recursive=True):
        try:
            pid = int(tmp.rsplit(".", 1)[-1])
        except ValueError:
            continue  # not a pid-suffixed tmp — skip
        if not is_pid_alive(pid):
            try:
                os.unlink(tmp)
                breadcrumb(f"swept orphaned temp {tmp} (pid {pid} not alive)")
            except FileNotFoundError:
                pass  # another sweep path already cleaned it
```

---

## Step 4 — Artifact Status Check

For every entry in `artifacts{}`, check `status` field (v2 schema):

| status | Meaning | Action |
|---|---|---|
| `"absent"` or missing | Not yet produced | Note for Phase Entry Protocol — will halt if needed |
| `"writing"` | Half-write (cleared by Step 2b if PID dead) | If PID still alive → concurrent session; halt |
| `"committed"` | Produced and sha256 recorded | Verify path exists on disk (stat); if missing, set `absent` |

For any artifact with `status == "absent"` or missing from disk:
- Convert to an open question `"artifact missing at <path> — re-produce in phase <produced_in_phase>?"`
- `phase_status[produced_in_phase] = "pending"` (if currently "done", revert to "pending")

---

## Step 5 — Re-Validation Sweep (on resume/review)

On every resume, re-validate key facts and open questions before dispatching. Skip on `init`.

**Budget:** 60s wall-clock total, max 15 MCP calls. If budget exhausted: mark remaining
facts `validation_deferred = true`, breadcrumb `"facts-sweep budget exhausted — N facts deferred to lazy verification"`, and continue.

**Facts sweep:**
For each row in `key_facts{}` where `source` is a derivable reference (Drive cell, prior 990 page):
1. Re-derive the value from `source`
2. Compare against stored value
3. Classify:
   - Unchanged → set `validated_at = now`, proceed
   - Improved → unblock any phase waiting on this fact; update machine state
   - Regressed → append to `revalidation_events[]`, roll back consuming phases per
     `§ Regression rollback protocol`

**Open-question sweep:**
For each `open_questions[]` entry:
- `status == "pending"` and has `draft_id` → `gmail_search_messages` (capped 50 per thread);
  if scan hits ceiling and finds nothing, breadcrumb `"reply-scan capped — user should escalate"`
  and surface `⚠ OQ-<id>: reply scan capped` in UI
- `status == "answered"` → re-confirm answer from recorded source

**Revalidation circuit breaker:**
Track `revalidation_events[]` per `fact_id`. If same `fact_id` appears as `"regression"` 3×
consecutively (no intervening stable resumes), HALT with:
```
⚠ revalidation circuit breaker tripped
  fact: <fact_id>
  regressed 3× consecutively
  likely cause: unstable source (file being edited?)
```
Then AskUserQuestion with options: `"Lock current value"` / `"Reset counter, retry once"` / `"Halt"`.
Record resolution in Decision Log.

**Progression decision:**
- `phases_to_repeat == []` → resume at `current_phase`
- Else → banner listing affected phases + triggering fact, set `current_phase = min(phases_to_repeat)`

---

## Step 6 — Phase Dispatch

`phase_status` is a 5-valued state machine. Before dispatching, read `phase_status[current_phase]`:

```
status = phase_status[current_phase]

if status == "pending" or status == "paused":
    → run Phase Entry Protocol (SKILL.md §Phase Entry Protocol)
    → if HALTED (ancestor regression): stop
    → else: run PHASES.md §<current_phase>

elif status == "running":
    pid = plan_lock.pid
    if pid is alive (os.kill(pid, 0) does NOT raise OSError.ESRCH):
        → halt: "concurrent session detected — PID <pid> on host <plan_lock.host> is still live"
        → AskUserQuestion: "Wait for other session | Take over (risky)" — user must choose
    else:
        → crash recovery: handled by Step 2 orphan sweep (sets status=failed+HalfWrite or RunningDeadPid)
        → after Step 2, re-read status (now "failed"); fall through to "failed" branch below

elif status == "failed":
    error_class = phase_status[current_phase].last_error.error_class
    if error_class in {"HalfWrite", "RunningDeadPid"}:
        → crash-recovery path: log breadcrumb "phase crashed, resuming from Pre-check"
        → run Phase Entry Protocol (with current_phase's output artifacts)
        → if HALTED: stop; else run PHASES.md §<current_phase> (Pre-check + Work)
    else:
        → surface last_error to user in halt banner
        → AskUserQuestion options:
            "Retry this phase" → reset status to pending, re-dispatch
            "Skip and advance" → set status=done manually, advance current_phase
            "Halt — I need to investigate" → stop
        → record resolution in Decision Log

elif status == "done":
    → advance: current_phase = next phase in sequence; repeat Step 6

elif current_phase == "done":
    → render completion banner; no work

else:
    → halt: "unknown phase_status value '<status>' — plan file may be corrupted"
```

**Phase sequence:** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → done

For `/form990 review`: skip dispatch, go directly to PHASES.md §P8.
For `/form990 status`: skip dispatch, go directly to `§ Status UI Renderer`.
For `/form990 phase <N> <plan>`: see `§ Force-Override Protocol`.

---

## commit_phase_entry() — Pre-Work Lifecycle Commit

Writes a CAS'd atomic commit that sets `phase_status[phase] = "running"` BEFORE the phase's
Work block executes. This ensures a SIGKILL during Work produces a `running` + dead-PID state
that Step 2 orphan sweep can detect and recover from.

```python
def commit_phase_entry(phase_id, state, plan_path, pre_image_sha256):
    """
    CAS-write status=running into machine state before phase work begins.
    Also sets plan_lock.pid = current process PID.
    Raises ConcurrentModificationError if another session has touched the plan.
    """
    import os, time
    state["phase_status"][phase_id] = "running"
    state["plan_lock"] = {
        "pid":         os.getpid(),
        "acquired_at": now_iso(),
        "host":        os.uname().nodename,
        "note":        "informational only — CAS is the concurrency primitive",
    }
    # Delegates to the Step 7 CAS write; raises on sha256 mismatch
    atomic_commit(state, plan_path, pre_image_sha256)
```

On successful commit: update `pre_image_sha256` to the new plan file sha256 so the
phase-exit commit in Step 7 has the correct pre-image.

---

## Force-Override Protocol — /form990 phase <N>

When the user invokes `/form990 phase <N> <plan>`:

1. Read the plan and parse machine state.
2. Walk ARTIFACT_DEPS forward from phase N: collect all phases N, N+1, …, P9 whose
   produced artifacts have N as a transitive upstream dependency.
3. For each downstream phase (including N itself):
   - Snapshot current `output_sha256` + `input_fingerprint` values into Decision Log:
     `"force-override P<N>: snapshotting prior output_sha256 for <artifact> before invalidation"`
   - Set `phase_status[phase] = "pending"`
   - Clear `artifacts[artifact].output_sha256 = null`
   - Clear `artifacts[artifact].input_fingerprint = {}`
4. Set `current_phase = P<N>`.
5. Write Decision Log entry: `"force-override P<N> on <iso>: invalidated downstream phases <list>; prior sha256 values snapshotted above"`.
6. Atomic commit.
7. Dispatch to Phase Entry Protocol for P<N>.

**Rationale:** clearing downstream sha256/fingerprints means `verify_ancestors()` will
correctly detect them as "not yet produced" on the next P<N+1> entry, preventing stale
artifacts from being silently re-consumed. The Decision Log snapshot preserves the prior
values for audit (they are not lost, only archived).

---

## Step 7 — Atomic State Commit (Content-SHA256 CAS)

Two sub-phases: **pre-write** (artifact staging → `status=writing`) and **post-write** (rename → `status=committed`).

### 7a — Pre-artifact commit (before writing artifact file)

For each artifact about to be written by the current phase:
```python
# Announce intent: status=writing + staging_path
staging = f"{artifact_final_path}.writing.{os.getpid()}"
state["artifacts"][name]["status"]       = "writing"
state["artifacts"][name]["staging_path"] = staging
state["artifacts"][name]["output_sha256"] = null  # not yet known
atomic_commit(state, plan_path, pre_image_sha256)
# Update pre_image_sha256 to the new plan sha256 after this write
pre_image_sha256 = sha256(open(plan_path, 'rb').read())

# Now write artifact bytes to staging path
try:
    with open(staging, 'w') as f:
        f.write(artifact_bytes)
        f.flush()
        os.fsync(f.fileno())
    actual_sha = sha256(open(staging, 'rb').read())
    os.replace(staging, artifact_final_path)  # atomic rename
    fsync_dir(os.path.dirname(artifact_final_path))  # flush directory entry
except Exception as e:
    # Cleanup: unlink staging if it exists
    try: os.unlink(staging)
    except FileNotFoundError: pass
    raise
```

### 7b — Post-artifact commit (after successful rename)

```python
# Announce completion: status=committed + output_sha256
state["artifacts"][name]["status"]        = "committed"
state["artifacts"][name]["staging_path"]  = null
state["artifacts"][name]["output_sha256"] = actual_sha
state["artifacts"][name]["produced_at"]   = now_iso()
state["artifacts"][name]["input_fingerprint"] = {
    upstream_name: state["artifacts"][upstream_name]["output_sha256"]
    for upstream_name in ARTIFACT_DEPS[name]["upstream"]
}
```

### 7c — Phase-exit commit (after all artifacts written)

```
a. pre_image_sha256 captured at Step 2 (updated after each interim commit)
b. Mutate machine state in memory:
     - phase_status[phase] = "done"
     - gate_results_latest_pass updated
     - plan_version += 1
     - plan_lock = {pid, acquired_at, host}
c. Re-read plan file; compute current_sha256 = sha256(current bytes)
   If current_sha256 != pre_image_sha256:
     ABORT with "concurrent modification detected — reload and retry"
     Do NOT write
d. Write mutated plan to <plan>.tmp.<pid>; os.replace → <plan>
   try/finally: on abort, unlink tmp (ignore ENOENT); breadcrumb "cleaned stale temp <path>"
e. fsync(<plan>.parent_dir) to flush directory entry
f. Sidecar: write ~/.claude/.form990-memo-<fy>.json.tmp.<pid>; rename
   On sidecar failure: breadcrumb warning, proceed (plan is authoritative)
g. Update plan_lock with current writer identity
```

**Sidecar format** (`~/.claude/.form990-memo-<fy>.json`):
```json
{
  "plan_path": "<absolute>",
  "tax_year": <YYYY>,
  "current_phase": "P<n>",
  "key_facts": {...},
  "artifacts": {...}
}
```

---

## Status UI Renderer

Called after every phase commit and on `/form990 status`.

**Banner:**
```
╔═══════════════════════════════════════════════════════════════════╗
║  form990  ·  {{LEGAL_NAME}}  ·  Tax Year {{YYYY}}                 ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Phase grid** (use `[✔]` / `[◉]` / `[ ]` / `[✖]` / `[⏸]`; `--ascii`: `[x]`/`[>]`/`[ ]`/`[!]`/`[.]`):
```
┌─────────────────────────────────────────────────────────────────────────┐
│  P0  Intake & Variant Routing                      [✔] done 2026-04-11  │
│  P1  Source Discovery (Sheets / Drive / Gmail)     [◉] in_progress      │
│  P2  Chart-of-Accounts → 990 Line Mapping          [ ] pending          │
│  P3  Financial Statement Production                [ ] pending          │
│  P4  Part IV Checklist → Schedule Trigger          [ ] pending          │
│  P5  Core Parts III/V/VI/VII/VIII/IX/X/XI/XII      [ ] pending          │
│  P6  Schedule Generation (A always; others on trig)[ ] pending          │
│  P7  Part I Rollup & Reconciliation                [ ] pending          │
│  P8  CPA Quality Review Pass                       [ ] pending          │
│  P9  Reference PDF Fill + E-file Handoff Packet    [ ] pending          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Gate health bar** (20-cell bar; fill = `(Gate1_pass + 0.5×Gate2_pass) / total_applicable`):
```
  Health:  [██████████░░░░░░░░░░]  6/18 gates evaluated
```

**Open questions summary** (only if any pending):
```
  ⚠ Open Questions: OQ-1 (missing prior 990), OQ-2 (payroll register)
```

**Progress bar** (phases completed / 10):
```
  [━━━━━━╌╌╌╌╌╌╌╌╌╌╌╌╌╌]  2/10 phases complete
```

**Phase closing block** (printed after each phase finishes):
```
━━━ P<n> complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ◆ <summary fact>
  ◆ <summary fact>
  ▸ Next: P<n+1> <phase name>
  [████████░░░░░░░░░░░░]  <n>/10 phases complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Halt banners** use the `╔══╗ ║ ║ ╚══╝` style with `⚠` or `✖` prefix.

**`--ascii` fallback:** replace all box-drawing and emoji with ASCII equivalents:
- `╔═╗ ║ ╚═╝` → `+--+ | +--+`
- `[✔]` → `[x]`, `[◉]` → `[>]`, `[✖]` → `[!]`, `[⏸]` → `[.]`
- `[██░░]` → `[####----]`

---

## merge_datasets() — Deterministic Disjoint-Key Merger (P7-merge)

```python
import json, hashlib, sys

def merge_datasets(core_path, schedules_path, rollup_path, output_path):
    """
    Pure function. Produces form990-dataset.json from three sibling files
    via disjoint-key composition. Halts on key conflict.

    Ownership contract:
      dataset_core    → parts.II..parts.XII + schedule_dependencies
      dataset_rollup  → parts.I + reconciliation
      dataset_schedules → schedules

    Part I special case: dataset_core declares "I": null as a structural
    placeholder. The merger treats null in core as "unowned" — takes
    dataset_rollup's parts.I value verbatim (compose, not override).
    """
    with open(core_path) as f:      core      = json.load(f)
    with open(schedules_path) as f: schedules = json.load(f)
    with open(rollup_path) as f:    rollup    = json.load(f)

    merged = {}

    # --- parts from core (II..XII) ---
    core_parts = core.get("parts", {})
    for k, v in core_parts.items():
        if k == "I" and v is None:
            continue  # structural placeholder; ownership belongs to rollup
        if k in merged.get("parts", {}):
            raise ValueError(f"merger_conflict: parts.{k} appears in both core and another input")
        merged.setdefault("parts", {})[k] = v

    # --- schedule_dependencies from core ---
    if "schedule_dependencies" in core:
        merged["schedule_dependencies"] = core["schedule_dependencies"]

    # --- parts.I + reconciliation from rollup ---
    rollup_parts = rollup.get("parts", {})
    if "I" in rollup_parts:
        if "I" in merged.get("parts", {}):
            raise ValueError("merger_conflict: parts.I appears in both rollup and core (expected null in core)")
        merged.setdefault("parts", {})["I"] = rollup_parts["I"]
    if "reconciliation" in rollup:
        merged["reconciliation"] = rollup["reconciliation"]

    # --- schedules from dataset_schedules ---
    if "schedules" in schedules:
        if "schedules" in merged:
            raise ValueError("merger_conflict: schedules key appears in two inputs")
        merged["schedules"] = schedules["schedules"]

    # --- Positive-ownership assertions (Change 5) ---
    core_I = core.get("parts", {}).get("I", "__ABSENT__")
    assert core_I in (None, "__ABSENT__"), (
        f"merger: dataset_core.parts.I MUST be null or absent (P5 ownership contract); "
        f"got type={type(core_I).__name__}"
    )
    rollup_I = rollup.get("parts", {}).get("I")
    assert rollup_I is not None, (
        "merger: dataset_rollup.parts.I must be populated (not null) — "
        "P7 partial-write detected; re-run P7 before merging"
    )
    rollup_part_keys = set(rollup.get("parts", {}).keys())
    assert rollup_part_keys <= {"I"}, (
        f"merger: dataset_rollup.parts may only contain 'I', got extras: "
        f"{sorted(rollup_part_keys - {'I'})}"
    )
    assert "schedule_dependencies" not in rollup, \
        "merger: schedule_dependencies owned by dataset_core only — found in rollup"
    assert "schedule_dependencies" not in schedules, \
        "merger: schedule_dependencies owned by dataset_core only — found in schedules"
    assert "reconciliation" not in core, \
        "merger: reconciliation owned by dataset_rollup only — found in core"
    assert "reconciliation" not in schedules, \
        "merger: reconciliation owned by dataset_rollup only — found in schedules"

    # Deterministic serialization (sort_keys ensures byte-stability across Python minors)
    serialized = json.dumps(merged, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(serialized)

    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()
```

**Python version drift guard:** Before running merger, check:
```python
import sys
if sys.version_info[:2] != PINNED_PYTHON_VERSION:  # from TOOL-SIGNATURES.md
    print(f"⚠ Python version drift: pinned {PINNED_PYTHON_VERSION}, running {sys.version_info[:2]}")
    print("  merger output_sha256 may churn — rerun E3 to revalidate byte-stability")
```

---

## ARTIFACT_DEPS — Dependency Graph

Structured declaration of artifact producing phases and their upstream dependencies.
Used by `verify_ancestors()` for transitive fingerprint verification before any phase runs.
External sources (Drive budget sheet, prior 990) are NOT registered as artifacts — they are
verified via `input_fingerprint` fields in producing artifact entries.

```python
ARTIFACT_DEPS = {
    # P2 outputs
    "coa_mapping": {
        "phase": "P2",
        "upstream": [],  # external: Drive budget sheet (verified via input_fingerprint)
    },
    # P3 outputs
    "statement_of_activities": {"phase": "P3", "upstream": ["coa_mapping"]},
    "balance_sheet":           {"phase": "P3", "upstream": ["coa_mapping"]},
    "functional_expense":      {"phase": "P3", "upstream": ["coa_mapping"]},
    # P4 output
    "part_iv_checklist": {
        "phase": "P4",
        "upstream": ["statement_of_activities", "balance_sheet", "functional_expense"],
    },
    # P5 output
    "dataset_core": {
        "phase": "P5",
        "upstream": [
            "coa_mapping", "statement_of_activities", "balance_sheet",
            "functional_expense", "part_iv_checklist",
        ],
    },
    # P6 outputs
    "dataset_schedules": {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_o":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_b_filing": {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_b_public": {"phase": "P6", "upstream": ["dataset_core"]},
    # P7 outputs
    "dataset_rollup":      {"phase": "P7",       "upstream": ["dataset_core"]},
    "reconciliation_report": {"phase": "P7",     "upstream": ["dataset_core"]},
    "dataset_merged":      {"phase": "P7-merge", "upstream": ["dataset_core", "dataset_schedules", "dataset_rollup"]},
    # P8 output
    "cpa_review_report": {
        "phase": "P8",
        "upstream": ["dataset_merged", "reconciliation_report"],
    },
    # P9 outputs
    "reference_pdf":   {"phase": "P9", "upstream": ["dataset_merged"]},
    "efile_handoff":   {"phase": "P9", "upstream": ["dataset_merged", "cpa_review_report"]},
}
```

---

## verify_ancestors() — Transitive Fingerprint Verification

Called by the Phase Entry Protocol before any phase runs its Work block. Walks ARTIFACT_DEPS
transitively, re-hashing each ancestor artifact on disk and comparing against the recorded
`output_sha256` in machine state. Returns the complete set of regressions found.

**Invocation:** called once per artifact this phase produces (memoized by name within one
phase entry — each artifact re-hashed at most once even if referenced by multiple downstream
artifacts).

```python
import hashlib, os, pathlib

def verify_ancestors(artifact_name, state, _visited=None):
    """
    Walk ARTIFACT_DEPS transitively from artifact_name.
    For each ancestor:
      - No output_sha256 in state → regression ("not yet produced")
      - File missing on disk → regression ("file deleted")
      - sha256(disk bytes) != recorded output_sha256 → regression ("hash mismatch")
    Returns: (ok: bool, regressions: list[str])
    Memoizes by artifact_name to avoid redundant disk reads within one phase entry.
    """
    if _visited is None:
        _visited = {}
    if artifact_name in _visited:
        return _visited[artifact_name]

    deps = ARTIFACT_DEPS.get(artifact_name, {})
    upstream = deps.get("upstream", [])
    regressions = []

    for parent in upstream:
        parent_entry = state.get("artifacts", {}).get(parent, {})
        recorded_sha = parent_entry.get("output_sha256")
        artifact_path = parent_entry.get("path")

        if not recorded_sha:
            regressions.append(
                f"{parent}: no output_sha256 recorded "
                f"(produced_in_phase={parent_entry.get('produced_in_phase','?')}; "
                f"re-run that phase first)"
            )
        elif artifact_path:
            abs_path = pathlib.Path(artifact_path)
            if not abs_path.exists():
                regressions.append(f"{parent}: file missing on disk at {artifact_path}")
            else:
                actual_sha = hashlib.sha256(abs_path.read_bytes()).hexdigest()
                if actual_sha != recorded_sha:
                    regressions.append(
                        f"{parent}: sha256 mismatch "
                        f"(recorded {recorded_sha[:12]}…, disk {actual_sha[:12]}…)"
                    )

        # Recurse into this parent's own ancestors
        ok, child_regressions = verify_ancestors(parent, state, _visited)
        regressions.extend(child_regressions)

    result = (len(regressions) == 0, regressions)
    _visited[artifact_name] = result
    return result
```

---

## Phase Entry Protocol

Called by the Phase Dispatcher (Step 6) at the start of every phase, before any Work block.
Applies Changes 4 (DAG walker) and 1 (lifecycle state machine) together.

```
function phase_entry(phase_id, output_artifacts, state):
    # Step 1: Transitive ancestor verification (Change 4)
    all_regressions = []
    for artifact in output_artifacts:
        ok, regressions = verify_ancestors(artifact, state)
        all_regressions.extend(regressions)

    if all_regressions:
        # Identify which producing phase owns each regressed artifact
        for regression_msg in all_regressions:
            parent_name = regression_msg.split(":")[0].strip()
            producer_phase = ARTIFACT_DEPS.get(parent_name, {}).get("phase", "?")
            state["phase_status"][producer_phase] = "failed"
            state["artifacts"][parent_name]["last_error"] = {
                "error_class": "ancestor_regression",
                "message": regression_msg,
                "detected_in_phase": phase_id,
                "timestamp": now_iso(),
            }
        atomic_commit(state)  # Commit failed status BEFORE any running write
        halt with banner:
            ╔══════════════════════════════════════════╗
            ║  ✖ Ancestor regression — cannot run P<n>  ║
            ╚══════════════════════════════════════════╝
              Regressed ancestors:
              <list regressions>
              Fix: re-run the producing phase(s) listed above, then resume.
        return HALTED

    # Step 2: Pre-entry lifecycle commit (Change 1)
    commit_phase_entry(phase_id, status="running", state)

    # Step 3: Phase-specific Pre-check (auth, tool availability — NOT hash re-verification)
    # (delegated to each phase's Pre-check block in PHASES.md)

    return OK
```

**Replaces:** the per-phase direct `output_sha256` hash checks in PHASES.md P3–P9 Pre-check
sections (those checks are now performed transitively by `verify_ancestors` above and are
marked `[→ verify_ancestors]` in PHASES.md).

---

## Regression Rollback Protocol

When a fact regression is detected (Resume Protocol step 5 or phase Pre-check):

1. Identify `fact_id` (key in `key_facts{}` or open-question id)
2. Find all phases whose `input_fingerprint` references the affected fact or an artifact
   produced by a phase that transitively consumed it
3. Set `phase_status[affected_phase] = "pending"` for each affected phase
4. Set `current_phase = min(affected_phases)`
5. Append to `revalidation_events[]`:
   ```json
   {
     "at": "<ISO>", "fact_id": "...", "classification": "regression",
     "old": "<prior>", "new": "<observed>",
     "phases_rolled_back": ["P3", "P4", ...]
   }
   ```
6. Append to Decision Log: date, phase, `"regressed: <fact_id> from <old> to <new>"`, rationale
7. Check circuit breaker (3-strike rule)

---

## Email Workflow

Three question classes:
1. **To the user:** AskUserQuestion or Open Question block in plan file; user answers via
   `/form990 ask <plan> <OQ-id> <answer>`
2. **To external party:** `gmail_create_draft` — **never auto-sends**. Draft ID recorded in
   `open_questions[].draft_id`. User reviews + sends manually from Gmail.
3. **Inbound replies:** On resume, `gmail_search_messages` with draft thread; found replies
   extracted into breadcrumb and `open_questions[].status = "answered"`.

Draft creation dedup rule (P1):
- Check `open_questions[oq_id].draft_id` first
- If set: probe via `gmail_list_drafts` or `gmail_read_message`
  - Exists in Drafts → reuse, do not recreate
  - Not found (404/empty) → user deleted or sent; if `status == "answered"` → keep; if
    still `"pending"` → create fresh draft, log breadcrumb
  - Transient error → surface + halt P1 (do not recreate)

---

## Sensitive-data .gitignore Template

```gitignore
# Form 990 plan files often contain PII — opt in explicitly to commit them
form990-plan-*.md

# Dataset JSONs contain financial detail
artifacts/form990-dataset.json
artifacts/form990-dataset-core.json
artifacts/form990-dataset-schedules.json
artifacts/form990-dataset-rollup.json

# Schedule B filing version contains donor PII (IRC §6104(d)(3)(A))
# schedule-b-public.md (redacted) is safe to commit
artifacts/schedule-b-filing.md

# Other artifacts with financial/PII data
artifacts/balance-sheet.md
artifacts/statement-of-activities.md
artifacts/functional-expense.csv
artifacts/coa-mapping.csv
artifacts/part-iv-checklist.md
artifacts/reconciliation-report.md
artifacts/form990-reference-filled.pdf
artifacts/efile-handoff-packet.md
artifacts/schedule-[abcdefghijklmnopqr].md

# NOTE: artifacts/scripts/ and artifacts/scripts/fixtures/ are NOT excluded —
# Python scripts are committed to git as a first-class audit trail artifact.
# They contain no PII (input paths are args; data stays in ignored files).

# Sidecar memo cache
.form990-memo-*.json
```

---

## key_facts Schema (Authoritative)

Valid keys in `key_facts{}`:

| Key | Type | Description |
|---|---|---|
| `legal_name` | string | IRS-registered legal name |
| `ein` | string | EIN in XX-XXXXXXX format |
| `accounting_method` | `"cash"` \| `"accrual"` | Filing-year accounting method |
| `gross_receipts_current` | number | Current-year gross receipts |
| `gross_receipts_3yr_average` | number | 3-year average for 990-N threshold |
| `total_assets_eoy` | number | Total assets at end of fiscal year |
| `public_charity_basis` | `"509(a)(1)"` \| `"509(a)(2)"` \| `"509(a)(3)"` | Public charity classification |
| `sheet_schema` | object | `{column_name: inferred_type}` from P1 header scan |
| `fiscal_year_start` | ISO date | Start of the fiscal year being filed |
| `fiscal_year_end` | ISO date | End of the fiscal year being filed |

Unknown keys are breadcrumbed and dropped. Typo'd keys are never merged into working state.

---

## run_script() — Canonical Subprocess Runner

All programmatic analysis scripts (P2 CoA mapping, P3 financial statements, P6 schedule
generation) MUST be invoked through this helper — never via bare `subprocess.run` or Bash.

```python
import subprocess, sys, json, pathlib

# Allowlist populated at phase-dispatch time from SKILL.md §programmatic_scripts table.
# Any path not in this set is rejected — prevents arbitrary-script execution (Q-C15).
SCRIPT_ALLOWLIST: set[str] = set()

# Per-phase deadlines (seconds). Tune here; all phases read from this dict.
PHASE_DEADLINES_S = {
    "P2": 180,   # CoA mapping over large budget sheets
    "P3": 120,   # Financial statement aggregation
    "P6": 300,   # Schedule generation (multiple schedules)
    "default": 60,
}

class ScriptError(Exception):
    """Raised when a programmatic script exits non-zero or emits non-JSON stdout."""
    def __init__(self, script, returncode, stderr_tail, stdout_tail=""):
        # NOTE: caller must pipe through scrub_pii() before logging to a breadcrumb.
        super().__init__(f"{script} exit {returncode}: {stderr_tail[-500:]}")
        self.returncode = returncode
        self.stderr_tail = _codepoint_safe_tail(stderr_tail, 2000)
        self.stdout_tail = _codepoint_safe_tail(stdout_tail, 2000)
        self.structured_error = None  # populated if stdout parses as error-JSON

def _codepoint_safe_tail(s: str, max_chars: int) -> str:
    """Truncate from the right without bisecting a UTF-8 codepoint (Q-C20 compliance)."""
    if len(s) <= max_chars:
        return s
    return s[-max_chars:]

def run_script(script_path, args, phase_id=None, cwd=None):
    """
    Invoke a Programmatic Analysis script with full safety and observability.

    Contract:
    - script_path MUST be in SCRIPT_ALLOWLIST (absolute path); rejected if not.
    - args reject items containing null bytes or '..' path-traversal tokens.
    - Passes '--json-only' as the first arg; script MUST emit pure JSON on stdout.
    - deadline from PHASE_DEADLINES_S[phase_id] or 'default'.
    - On non-zero exit: inspect stdout for {"status":"error",...} and attach as
      structured_error; always raise ScriptError.
    - On timeout: kills subprocess, raises ScriptError with "<timeout>" note.
    - On JSON parse failure: raises ScriptError with 'stdout unparseable'.
    """
    abs_path = str(pathlib.Path(script_path).resolve())
    if abs_path not in SCRIPT_ALLOWLIST:
        raise ScriptError(script_path, -1, f"script not in SCRIPT_ALLOWLIST: {abs_path}")
    for a in args:
        if "\x00" in str(a):
            raise ScriptError(script_path, -1, f"rejected arg (null byte): {a!r}")
        if ".." in pathlib.PurePosixPath(str(a)).parts:
            raise ScriptError(script_path, -1, f"rejected arg (path traversal): {a!r}")

    deadline_s = PHASE_DEADLINES_S.get(phase_id, PHASE_DEADLINES_S["default"])
    proc = subprocess.Popen(
        [sys.executable, abs_path, "--json-only", *[str(a) for a in args]],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=cwd,
    )
    try:
        stdout, stderr = proc.communicate(timeout=deadline_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            stdout, stderr = proc.communicate(timeout=5)
        except Exception:
            stdout, stderr = "", "<timeout: no output captured>"
        raise ScriptError(script_path, -2,
                          f"timeout after {deadline_s}s\nstderr: {stderr}", stdout)
    finally:
        if proc.poll() is None:
            proc.kill()

    if proc.returncode != 0:
        err = ScriptError(script_path, proc.returncode, stderr, stdout)
        try:
            parsed = json.loads(stdout)
            if isinstance(parsed, dict) and parsed.get("status") == "error":
                err.structured_error = parsed
        except (json.JSONDecodeError, ValueError):
            pass
        raise err

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as e:
        raise ScriptError(script_path, 0,
                          f"stdout unparseable: {e}\nstderr tail: {stderr[-500:]}", stdout)
```

### Script authoring contract (for every P2/P3/P6 script)

Scripts MUST:
1. Accept `--json-only` CLI flag; when set, all debug/progress output goes to **stderr** only.
2. On success: emit one JSON object to stdout and exit 0.
3. On error: emit `{"status":"error","error_class":"<class>","error_message":"<msg>","trace":"<tb>"}` to stdout, exit 1.
4. Never import third-party packages — stdlib only (`csv`, `json`, `sys`, `math`, `collections`).

### On ScriptError

```python
except ScriptError as e:
    breadcrumb = scrub_pii(
        f"### {now_iso()} — {phase_id} ERROR: script {script_path} exit {e.returncode}\n"
        f"  stderr: {e.stderr_tail}\n"
        f"  structured: {e.structured_error}"
    )
    append_breadcrumb(breadcrumb, plan_path)
    state["phase_status"][phase_id] = "failed"
    state["last_error"] = {
        "op": f"run_script({script_path})",
        "message": str(e)[-500:],
        "remediation": "Fix the script error and re-run this phase.",
    }
    atomic_commit(state, plan_path, pre_image_sha256)
    render_status_ui(state)
    raise  # surface to dispatcher
```

---

## read_pinned_python() — Python Interpreter Pin

Replaces the bare `PINNED_PYTHON_VERSION` symbol (which would `NameError` at runtime).
Reads the pinned Python minor version from `TOOL-SIGNATURES.md`.

```python
def read_pinned_python(tool_signatures_path="skills/form990/TOOL-SIGNATURES.md") -> tuple:
    """
    Parse 'python_pin: "3.X"' from TOOL-SIGNATURES.md.
    Returns a (major, minor) tuple, e.g. (3, 12).
    Falls back to (3, 11) if the file is missing or the line is absent,
    logging a breadcrumb warning — drift is visible but not fatal.
    """
    import re
    fallback = (3, 11)
    try:
        text = pathlib.Path(tool_signatures_path).read_text(encoding="utf-8")
        m = re.search(r'python_pin:\s*"(\d+)\.(\d+)"', text)
        if m:
            return (int(m.group(1)), int(m.group(2)))
        # Line absent — warn and fall back
        log_warning(f"python_pin not found in {tool_signatures_path} — falling back to {fallback}")
        return fallback
    except FileNotFoundError:
        log_warning(f"{tool_signatures_path} missing — falling back to {fallback}")
        return fallback
```

**Usage at runtime (e.g. P7 merge guard, P9 Pre-check):**
```python
pinned = read_pinned_python()
actual = sys.version_info[:2]
if actual != pinned:
    append_breadcrumb(scrub_pii(
        f"Python version drift: pinned {pinned}, running {actual} — "
        f"merger output_sha256 may churn; rerun E3 to revalidate byte-stability."
    ), plan_path)
    # Continue (warning only, not halt)
```

---

## form990_coordinates_{tax_year}

*This table is populated during Pre-build Verification step 3a (AcroForm probe + coordinate
sweep) and is specific to each tax-year's PDF revision. It is not pre-filled here — run
the probe script, record the table in TOOL-SIGNATURES.md, and reference it from P9.*

Format per entry:
```json
{
  "line_id": "I.1",
  "label": "Total contributions (add lines 1a-1f)",
  "page": 1,
  "x": 450.5,
  "y": 620.3,
  "width": 80,
  "height": 12,
  "font_size": 8
}
```

If the PDF is flat (no AcroForm fields), every fillable line must have an entry here. If the
coordinate table is absent or stale, P9 halts and requests the probe be re-run.
