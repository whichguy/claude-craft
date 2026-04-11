# Form 990 Skill — Orchestrator

Invoke via: `/form990 <subcommand> [args]`

---

## Step 0 — Argument Parsing

Parse the invocation string to determine subcommand and arguments.

| Invocation | Behavior |
|---|---|
| `/form990 init --sheet <id-or-url> --tax-year <YYYY> [--plan-path <path>]` | Create plan file, run P0 intake |
| `/form990 resume <plan-path>` | Read plan, restore state, dispatch to current_phase |
| `/form990 phase <N> <plan-path>` | Force-run phase N (override current_phase) |
| `/form990 review <plan-path>` | Run P8 CPA review pass only |
| `/form990 status <plan-path>` | Render status UI; no work |
| `/form990 ask <plan-path> <question-id> <answer>` | Answer an open question and resume |

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

## Step 4 — Artifact Existence Check

For every non-null path in `artifacts{}`:
- Check existence via `stat` (not a full Read — existence check only)
- If the file is missing: convert to an open question `"artifact missing at <path> — re-produce in phase <produced_in_phase>?"`
- Set `phase_status[produced_in_phase] = "pending"` if the artifact is missing

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

```
switch current_phase:
  "P0" → run PHASES.md §P0
  "P1" → run PHASES.md §P1
  "P2" → run PHASES.md §P2
  "P3" → run PHASES.md §P3
  "P4" → run PHASES.md §P4
  "P5" → run PHASES.md §P5
  "P6" → run PHASES.md §P6
  "P7" → run PHASES.md §P7
  "P8" → run PHASES.md §P8
  "P9" → run PHASES.md §P9
  "done" → render completion banner; no work
```

For `/form990 review`: skip dispatch, go directly to PHASES.md §P8.
For `/form990 status`: skip dispatch, go directly to `§ Status UI Renderer`.

---

## Step 7 — Atomic State Commit (Content-SHA256 CAS)

After every phase work block completes:

```
a. pre_image_sha256 = sha256(plan file bytes as read in Step 2)
b. Mutate machine state in memory:
     - phase_status[phase] = "done"
     - artifacts[...].output_sha256 = sha256(artifact bytes)
     - artifacts[...].input_fingerprint = {upstream output_sha256 values}
     - artifacts[...].produced_at = ISO timestamp
     - gate_results_latest_pass = {Q-Fid: "PASS"|"NEEDS_UPDATE"|"N/A"}
     - plan_version += 1
     - plan_lock = {pid, acquired_at, host}
c. Re-read plan file; compute current_sha256 = sha256(current bytes)
   If current_sha256 != pre_image_sha256:
     ABORT with "concurrent modification detected — reload and retry"
     Do NOT write
d. Write mutated plan to <plan>.tmp.<pid> in same directory; os.replace to <plan>
e. If --no-sidecar not set: write ~/.claude/.form990-memo-<fy>.json.tmp.<pid>; rename
   On sidecar failure: breadcrumb warning, proceed (plan file is authoritative)
f. Update plan_lock with current writer identity
g. Temp-file hygiene (Q-C31):
   try/finally around d+e: on any abort, unlink both tmp paths (ignore ENOENT)
   breadcrumb "cleaned stale temp <path>"
   On Step 2 (read), also scan plan dir + ~/.claude/ for *.tmp.<N> files whose PID is
   not alive (os.kill(pid,0) POSIX; psutil.pid_exists fallback); unlink + breadcrumb each
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
