---
name: form990
description: |
  Form 990 Skill — Orchestrator for end-to-end IRS Form 990 preparation.

  Guides a nonprofit Executive Director through all 10 phases (P0–P9):
  intake, source discovery, chart-of-accounts mapping, financial statements,
  Part IV checklist, core parts, schedule generation, Part I rollup,
  CPA quality review (26 gates, 3 tiers), and reference PDF fill + e-file
  handoff packet. Stateful plan-file journal enables cold-resume across sessions.

  Invoke as: /form990 init | resume | phase | review | status | ask | verify
---

# Form 990 Skill — Orchestrator

> **Form Year Dependency:** Line number references throughout this skill target the IRS Form 990
> revision in effect for the filing year. The 2023 revision (used for tax years beginning after
> 2022) restructured Part VIII (revenue lines shifted), Part IX (Line 11 sub-lines reordered:
> 11a = Management, 11b = Legal, etc.), and Part X (net assets moved from 3-class to 2-class
> ASC 958 format for most orgs). When `tax_year` changes, the Form Discovery Directive fetches
> the correct year's form and field map; all P2–P9 line references must align to that revision's
> field map. If field map line numbers conflict with PHASES.md, the field map takes precedence.

Invoke via: `/form990 <subcommand> [args]`

---

## Step 0 — Argument Parsing

**Step 0.0 — Skill Root Resolution (runs before any argument parsing)**

Locate the skill's own directory and bind `SKILL_ROOT`. This must run once at P0/resume time
and the resolved value stored in machine state as `skill_root` (non-nullable after P0).

Resolution order:
1. Check `~/claude-craft/skills/form990/` — verify `SKILL.md` exists there
2. Check `~/.claude/skills/form990/` — verify `SKILL.md` exists there
3. If none found: halt with "Cannot locate skill root. Install to
   ~/claude-craft/skills/form990/ or ~/.claude/skills/form990/"

Set `SKILL_ROOT = <resolved absolute path>`. All subsequent file references use this variable.

Convention:
- `{SKILL_ROOT}/templates/...` — skill-owned templates (PLAN-TEMPLATE.md, email-question.md, etc.)
- `{SKILL_ROOT}/scripts/...` — skill-owned scripts (p2-coa-mapping.py, etc.)
- `{SKILL_ROOT}/lib/...` — skill-owned library modules (form990_lib.py, etc.)
- `{plan_dir}/artifacts/...` — per-run output artifacts (relative to plan file, NOT SKILL_ROOT)

**Step 0.0 output:** Store `skill_root` in machine state JSON so resume paths don't need to
re-detect. On resume, if `skill_root` is absent from an existing state JSON (pre-change
in-flight run), re-run Step 0.0 resolution rather than halting (backward-compatible default).

---

Parse the invocation string to determine subcommand and arguments.

| Invocation | Behavior |
|---|---|
| `/form990 init --sheet <id-or-url> --tax-year <YYYY> [--plan-path <path>]` | Create plan file, run P0 intake |
| `/form990 resume <plan-path>` | Read plan, restore state, dispatch to current_phase |
| `/form990 phase <N> <plan-path> [--dry-run]` | Force-run phase N (override current_phase); `--dry-run` shows what would be invalidated without writing |
| `/form990 review <plan-path>` | Run P8 CPA review pass only |
| `/form990 status <plan-path>` | Render status UI; no work |
| `/form990 ask <plan-path> [<question-id> <answer>]` | Answer an open question and resume; if question-id omitted, lists pending questions interactively |
| `/form990 verify [--case TC<N>]` | Run the verification harness (`tests/verify.py`); exit 0 = all pass |

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

**Proposals check (for `init` and `resume` at P0):** Read `{SKILL_ROOT}/PROPOSALS.md` and
surface any item marked `PENDING USER APPROVAL` before beginning intake. If no pending items,
skip silently. This ensures design decisions don't silently drift.

---

## Step 1 — Plan File Location

**For `init`:** Write the new plan file using `{SKILL_ROOT}/templates/PLAN-TEMPLATE.md` as the scaffold.
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
`§ Sensitive-data .gitignore Template` below.

**For `resume`/`review`/`status`/`ask`:** If `<plan-path>` is omitted, auto-discover:
1. Glob `./form990-plan-*.md` in the invocation cwd
2. If exactly one match: use it silently (print `"Resuming form990-plan-<year>.md"`)
3. If multiple matches: list them and ask which to resume (never auto-pick when ambiguous)
4. If zero matches: halt with `"No form990-plan-*.md found in current directory. Pass --plan-path <path> explicitly."`

Resolve the plan-path to an absolute path. All relative artifact paths in MACHINE STATE
are resolved relative to the **plan file's directory** (not the invocation cwd).

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
     `§ Regression Rollback Protocol`

**Open-question sweep:**
For each `open_questions[]` entry:
- `status == "pending"` and has `draft_id` → `gmail_search_messages` (capped 50 per thread);
  if scan hits ceiling and finds nothing, breadcrumb `"reply-scan capped — user should escalate"`
  and surface `⚠ OQ-<id>: reply scan capped` in UI
- `status == "answered"` → re-confirm answer from recorded source

**Revalidation circuit breaker:**
Track `revalidation_events[]` per `fact_id`. If same `fact_id` appears as `"regression"` 3×
consecutively (no intervening stable resumes), HALT with a user-friendly banner (C3):
```
⚠ Heads up — the same number has changed 3 times in a row
  What changed: <fact_id> (e.g. "Total revenue from your spreadsheet")
  This can happen if someone is editing the budget sheet at the same time,
  or if there's a formula recalculating. It's not an error — I just want
  to make sure I'm using the right number before continuing.
```
Then AskUserQuestion with humanized options (C3):
  - `"Use what we've got right now and keep going (you can fix it later)"`
  - `"Try one more time — I think the source just settled"`
  - `"Stop here so I can check the source data myself"`
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
        → halt with humanized banner (C3):
          "Someone (or another terminal) was editing this plan <N> seconds ago on <host>.
           If that was you in another window, you can keep going. If someone else is helping
           you right now, wait for them to finish before resuming here."
        → AskUserQuestion: "That was me — continue anyway (I closed the other window)" / "Someone else is using this — I'll wait" — user must choose
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

## Context Loading Directives

Load only what the current phase needs. Files not listed for a phase must NOT be loaded.

| File | Load when |
|------|-----------|
| `PHASES.md` | Always — every phase invocation |
| `SKILL.md` | Always — dispatch, helpers, schemas |
| `PERSONA.md` | Always — injected on every phase and gate evaluation |
| `QUESTIONS.md` | **P8 only** (CPA review pass). Do not load at P0–P7. Gates are evaluated only during the CPA review pass; loading them earlier wastes ~10K tokens per phase with no benefit. Also load if `/form990 review` subcommand is used. |
| `SCHEDULES.md` | **P6 only** (schedule generation). Do not load at P8 entry — P8 evaluates `dataset_schedules.json` output, not playbooks. Load at P8 only if a NEEDS_UPDATE triggers a P6 re-run. |
| `LEARNINGS.md` | **Do not load at phase entry.** Load only: (a) when `auto_append_learning()` is triggered on phase failure, or (b) during the Post-Run Review prompt at P9 close when the operator is explicitly reviewing learnings. |
| `TOOL-SIGNATURES.md` | **P4** (pinned Part IV question count fallback) and **P9** (coordinate table for PDF fill). Do not load at P0–P3 or P5–P7. |
| `VERIFY.md` | **`/form990 verify` subcommand only.** Do not load during normal phase execution. |
| `PROPOSALS.md` | Load at P0 start (or when `/form990 proposals` is invoked) to surface pending design decisions requiring approval. Do not load at other phases. |

**Why this matters:** Loading all files globally costs ~72K tokens per invocation. With these directives, a typical P0–P7 phase invocation uses ~34K tokens (PHASES.md + SKILL.md + PERSONA.md only), saving ~21K tokens per phase entry.

---

## Form Discovery Directive

**Trigger:** Runs at P0 step 8b (artifact pre-scan) for every new `tax_year`. If a required
form is not cached locally in `{SKILL_ROOT}/templates/` or `artifacts/`, fetch it now.

**Do not assume prior-year forms are valid for the current tax year.** The IRS revises
Form 990 and its schedules annually. A 2024 blank PDF will have wrong field names and
coordinates for a 2025 return. Always verify the revision date embedded in the PDF
(look for "Rev. <year>" in the footer) matches `tax_year`.

### Federal Forms (irs.gov)

| Form | URL | Cache path | Required when |
|---|---|---|---|
| Form 990 (blank) | `https://www.irs.gov/pub/irs-pdf/f990.pdf` | `artifacts/f990-blank-<year>.pdf` | Always (P9 fill) |
| Form 990-EZ (blank) | `https://www.irs.gov/pub/irs-pdf/f990ez.pdf` | `artifacts/f990ez-blank-<year>.pdf` | If variant = 990-EZ |
| Form 8868 (extension) | `https://www.irs.gov/pub/irs-pdf/f8868.pdf` | `artifacts/f8868-<year>.pdf` | Always (deadline info) |
| Form 990 instructions | `https://www.irs.gov/pub/irs-pdf/i990.pdf` | `artifacts/i990-<year>.pdf` | On demand (CPA review) |

**Fetch protocol:**
1. Check cache path — if exists and revision date matches `tax_year`: skip.
2. WebFetch with 30s timeout, 1 retry on failure.
3. On success: save to cache path; breadcrumb "fetched <form> rev <date>".
4. On failure: add `open_questions[]` entry with manual download URL and target path.
   Never block P0 completion on a failed form fetch — queue and continue.

**Revision date check:** After fetching, extract the revision date from the PDF footer
(pattern: `Rev. <month>-<year>` or `<year>` in filename). If revision year < `tax_year`,
warn: "Form revision date [rev] may not match tax year [year] — verify with IRS before P9."

### California State Forms

Fetch only if org is CA-registered (inferred from address or confirmed at intake).

| Form | Agency | URL | Cache path | Required when |
|---|---|---|---|---|
| Form 199 | CA FTB | `https://www.ftb.ca.gov/forms/2024/2024-199.pdf` *(update year)* | `artifacts/ca-199-<year>.pdf` | GR > $50K |
| RRF-1 | CA AG Registry | `https://oag.ca.gov/sites/all/files/agweb/pdfs/charities/charitable/rrf1_form.pdf` | `artifacts/ca-rrf1-<year>.pdf` | Registered charity |
| CT-TR-1 | CA AG Registry | `https://oag.ca.gov/sites/all/files/agweb/pdfs/charities/charitable/ct-tr-1.pdf` | `artifacts/ca-cttr1-<year>.pdf` | GR < $2M, no audit |

> **CA form URLs change annually.** Before fetching, do a WebSearch for
> "California Form 199 <tax_year> FTB" and "CA RRF-1 <tax_year> Attorney General"
> to confirm current URLs. The AG Registry PDF link in particular is not year-versioned
> on the URL — verify the revision date in the downloaded PDF.

### Form Discovery Failure Handling

If any fetch fails and the form is needed for a current phase:
- **Form 990 blank (P9):** Halt P9 with offer to use `--local-pdf <path>`
- **CA companion forms:** Non-blocking advisory; note in Output Document Catalog that
  operator must download manually before filing
- **Form 8868 (extension):** Advisory only; not needed unless org files for an extension

---

## now_iso() / now_iso_date() — Timestamp Helpers

Utility functions used by `commit_phase_entry()`, `Phase Entry Protocol`, `append_breadcrumb()`,
and `auto_append_learning()`. Defined here before first use.

```python
def now_iso() -> str:
    """Return current UTC timestamp as ISO 8601 string."""
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def now_iso_date() -> str:
    """Return current UTC date as YYYY-MM-DD."""
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
```

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

When the user invokes `/form990 phase <N> <plan>` (with optional `--dry-run`):

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

**`--dry-run` behavior (C3):** If `--dry-run` is passed, perform steps 1–2 only (read plan +
compute downstream set), then print the preview and STOP — do not write anything:
```
⚠ Dry run — no changes will be written
  Force-running P<N> would invalidate:
    P<N+1>  →  <artifact list>
    P<N+2>  →  <artifact list>
    ...
  Total: <K> phase(s), <M> artifact(s) cleared
  Run without --dry-run to proceed.
```
Without `--dry-run`: after computing the downstream set (step 2), print the confirmation prompt:
```
This will re-run P<N> and invalidate P<N+1>..P<last_affected_phase>
(<K> committed artifact hashes will be cleared). Continue? [y/N]
```
If the user answers N → stop without writing. If Y → proceed with steps 3–7.

**Rationale:** clearing downstream sha256/fingerprints means `verify_ancestors()` will
correctly detect them as "not yet produced" on the next P<N+1> entry, preventing stale
artifacts from being silently re-consumed. The Decision Log snapshot preserves the prior
values for audit (they are not lost, only archived).

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
     - (C3) Recompute "## Next Action" block: second-person imperative describing the exact
       next step for a cold resume. If open_questions[] has pending items, list the first 2.
       Otherwise describe the first sub-step of the next phase. Written as plain prose the
       ED can understand (no skill-internal jargon).
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
   not alive (os.kill(pid,0) catching OSError.errno==ESRCH — stdlib, no third-party deps); unlink + breadcrumb each
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

    # --- Positive-ownership assertions before composition ---
    core_I = core.get("parts", {}).get("I", "__ABSENT__")
    assert core_I in (None, "__ABSENT__"), \
        "merger: dataset_core.parts.I MUST be null or absent (P5 ownership contract)"
    rollup_I = rollup.get("parts", {}).get("I")
    assert rollup_I is not None, \
        "merger: dataset_rollup.parts.I must be populated (not null) — P7 partial-write detected"
    assert set(rollup.get("parts", {}).keys()) <= {"I"}, \
        f"merger: dataset_rollup.parts MAY only contain 'I', got {sorted(rollup.get('parts', {}).keys())}"
    assert "schedule_dependencies" not in rollup and "schedule_dependencies" not in schedules, \
        "merger: schedule_dependencies is owned by dataset_core only"
    assert "reconciliation" not in core and "reconciliation" not in schedules, \
        "merger: reconciliation is owned by dataset_rollup only"

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

---

## ARTIFACT_DEPS — Dependency Graph

Structured declaration of artifact producing phases and their upstream dependencies.
Used by `verify_ancestors()` for transitive fingerprint verification before any phase runs.
External sources (Drive budget sheet, prior 990) are NOT registered as artifacts — they are
verified via `input_fingerprint` fields in producing artifact entries.

**Downstream consumer note:** `artifacts/form990-dataset.json` (produced by P7 merge) is the
sole artifact downstream phases and external tools should read. The three siblings
(`dataset-core.json`, `dataset-schedules.json`, `dataset-rollup.json`) are intermediate
producer outputs — do not read them directly outside their producing phase.

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
    "schedule_a":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_d":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_g":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_i":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_l":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_m":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_r":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_c":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_e":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_f":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_h":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_j":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_k":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_n":        {"phase": "P6", "upstream": ["dataset_core"]},
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
    "cpa_memo":        {"phase": "P9", "upstream": ["dataset_merged", "cpa_review_report"]},
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
            # P7-merge is a sub-phase, not in phase_status — map to P7 for status tracking
            status_phase = "P7" if producer_phase == "P7-merge" else producer_phase
            state["phase_status"][status_phase] = "failed"
            state["artifacts"][parent_name]["last_error"] = {
                "error_class": "ancestor_regression",
                "message": regression_msg,
                "detected_in_phase": phase_id,
                "timestamp": now_iso(),
            }
        atomic_commit(state, plan_path, pre_image_sha256)  # Commit failed status BEFORE any running write
        halt with banner:
            ╔══════════════════════════════════════════╗
            ║  ✖ Ancestor regression — cannot run P<n>  ║
            ╚══════════════════════════════════════════╝
              Regressed ancestors:
              <list regressions>
              Fix: re-run the producing phase(s) listed above, then resume.
        return HALTED

    # Step 2: Pre-entry lifecycle commit (Change 1)
    commit_phase_entry(phase_id, state, plan_path, pre_image_sha256)

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

## run_script() — Canonical Subprocess Runner

All programmatic analysis scripts (P2 CoA mapping, P3 financials, P6 schedule computations)
MUST be invoked via this helper. Direct `subprocess` calls are prohibited — they bypass
SCRIPT_ALLOWLIST enforcement, arg sanitization, and structured error surfacing.

```python
import subprocess, sys, json, os, pathlib

# Allowlist of scripts run_script will invoke (absolute paths, populated at dispatch time).
SCRIPT_ALLOWLIST: set[str] = set()

# Per-phase wall-clock deadlines (Q-C34).
PHASE_DEADLINES_S = {"P2": 180, "P3": 120, "P6": 300, "default": 60}

class ScriptError(Exception):
    def __init__(self, script, rc, stderr, stdout=""):
        super().__init__(f"{script} exit {rc}: {stderr[-500:]}")
        self.returncode = rc
        self.stderr_tail = _codepoint_safe_tail(stderr, 2000)
        self.stdout_tail = _codepoint_safe_tail(stdout, 2000)
        self.structured_error = None  # populated if stdout is error-JSON

def _codepoint_safe_tail(s: str, max_chars: int) -> str:
    """Truncate from the right without bisecting a UTF-8 codepoint (Q-C20)."""
    if len(s) <= max_chars:
        return s
    return s[-max_chars:]

def run_script(script_path, args, phase_id=None, cwd=None):
    """
    Canonical runner. Contract:
    - argv-only (no shell=True); stdout MUST be pure JSON.
    - script_path MUST be in SCRIPT_ALLOWLIST (absolute path).
    - args reject null bytes and '..' path-traversal tokens.
    - Deadline from PHASE_DEADLINES_S[phase_id] or 'default'.
    - On non-zero exit, inspect stdout for error-JSON; attach as structured_error.
    - On timeout: kill + wait in finally, raise ScriptError.
    Scripts MUST accept --json-only flag and redirect all debug prints to stderr when set.
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
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=cwd,
    )
    try:
        stdout, stderr = proc.communicate(timeout=deadline_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            stdout, stderr = proc.communicate(timeout=5)
        except Exception:
            stdout, stderr = "", "<timeout: no output captured>"
        raise ScriptError(script_path, -2, f"timeout after {deadline_s}s\nstderr: {stderr}", stdout)
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

On `ScriptError`: call `append_breadcrumb(state, phase_id, str(err), error_class="ScriptNonZero")`,
set `phase_status=failed`, atomic commit, surface in status UI.
(`ScriptError.__init__` already scrubs the message internally — no additional `scrub_pii()` wrapper needed.)

---

## scrub_pii() — PII Redaction Helper

All breadcrumb writes, LEARNINGS auto-appends, and ScriptError messages MUST flow through
`scrub_pii()` before being written to the plan file or LEARNINGS.md.

```python
import re

def scrub_pii(text: str, donor_names: list[str] = None) -> str:
    """
    Redact PII before writing to plan file breadcrumbs or LEARNINGS.
    Rules applied in order (A1 base rules + C2 extensions):
    1. SSN/ITIN: ddd-dd-dddd → [REDACTED-SSN]
    2. Bare 9-digit run (not hyphen-adjacent): ddddddddd → [REDACTED-9DIGIT]
       (EINs are XX-XXXXXXX — hyphenated form is public IRS BMF data, never matched)
    3. Donor names from key_facts.donor_names (longest first; word-boundary + min 4 chars)
    4. Long numeric run >= 10 digits → [REDACTED-LONGNUM]  (bank accounts, routing)
    5. [C2] Phone numbers: 555-123-4567 / 555.123.4567 / 555 123 4567 → [REDACTED-PHONE]
    6. [C2] Email addresses → [REDACTED-EMAIL]
    7. [C2] Dates of birth (MM/DD/YYYY) → [REDACTED-DOB]
    8. [C2] US street addresses (number + street name + type) → [REDACTED-ADDR]
    Canonical implementation lives in {SKILL_ROOT}/lib/form990_lib.py. This prose is illustrative.
    """
    if donor_names is None:
        donor_names = []
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED-SSN]', text)
    text = re.sub(r'(?<![-\d])\b\d{9}\b(?![-\d])', '[REDACTED-9DIGIT]', text)
    for name in sorted(donor_names, key=len, reverse=True):
        if name and len(name) >= 4:
            text = re.sub(r'\b' + re.escape(name) + r'\b', '[REDACTED-DONOR]',
                          text, flags=re.IGNORECASE)
    text = re.sub(r'\d{10,}', '[REDACTED-LONGNUM]', text)
    text = re.sub(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', '[REDACTED-PHONE]', text)
    text = re.sub(r'\b[\w.+\-]+@[\w\-]+\.[\w.\-]+\b', '[REDACTED-EMAIL]', text)
    text = re.sub(r'\b\d{1,2}/\d{1,2}/(19|20)\d{2}\b', '[REDACTED-DOB]', text)
    text = re.sub(r'\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+'
                  r'(?:St|Ave|Rd|Blvd|Ln|Way|Dr|Ct|Pl)\b',
                  '[REDACTED-ADDR]', text)
    return text
```

Note: hyphenated EINs (`XX-XXXXXXX`) are NOT redacted — they are public (IRS BMF).
The bare-9-digit rule uses a negative-lookbehind/lookahead for hyphens and adjacent digits
so that the `XX-XXXXXXX` format is never accidentally caught.

---

## append_breadcrumb() — Scrubbed Breadcrumb Writer

```python
def append_breadcrumb(
    state: dict,
    phase: str,
    msg: str,
    error_class: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """
    Write a scrubbed breadcrumb into state["breadcrumbs"].

    A6: structured error_class (must be in ERROR_CLASSES) and optional
    duration_ms for phase timing. Call sites: append_breadcrumb(state, phase_id, "msg").
    """
    assert error_class is None or error_class in ERROR_CLASSES
    donor_names = state.get("key_facts", {}).get("donor_names", [])
    safe_msg = scrub_pii(msg, donor_names)
    entry = {"at": now_iso(), "phase": phase, "msg": safe_msg}
    if error_class is not None:
        entry["error_class"] = error_class
    if duration_ms is not None:
        entry["duration_ms"] = duration_ms
    state.setdefault("breadcrumbs", []).append(entry)
```

---

## auto_append_learning() — LEARNINGS.md Auto-Append on Failure

When `phase_status[P] = "failed"` is committed, auto-append to `LEARNINGS.md`:

```python
import pathlib

MACHINE_LEARNINGS_BEGIN = "<!-- BEGIN MACHINE LEARNINGS (auto-appended; do not hand-edit) -->"
MACHINE_LEARNINGS_END   = "<!-- END MACHINE LEARNINGS -->"
MAX_MACHINE_ENTRIES = 100

def _rotate_learnings(learnings_path: str, entries: list, text: str,
                      begin_idx: int, end_idx: int) -> None:
    """
    Move oldest entries to LEARNINGS.archive.md when count >= MAX_MACHINE_ENTRIES.
    Keeps the most recent (MAX_MACHINE_ENTRIES - 1) entries in LEARNINGS.md.
    """
    archive_path = pathlib.Path(learnings_path).with_name("LEARNINGS.archive.md")
    overflow = entries[:len(entries) - MAX_MACHINE_ENTRIES + 1]
    kept = entries[len(overflow):]
    archive_header = "# Form 990 Skill — Learnings Archive\n\n"
    archive_text = archive_path.read_text(encoding="utf-8") if archive_path.exists() else archive_header
    archive_path.write_text(archive_text + "\n".join(overflow) + "\n", encoding="utf-8")
    new_inner = "\n".join(kept)
    new_text = (
        text[:begin_idx + len(MACHINE_LEARNINGS_BEGIN)]
        + "\n" + new_inner + "\n"
        + text[end_idx:]
    )
    pathlib.Path(learnings_path).write_text(new_text, encoding="utf-8")

def auto_append_learning(learnings_path: str, phase_id: str,
                         error_class: str, message: str,
                         donor_names: list[str] = None) -> None:
    """
    Append a scrubbed failure entry to the MACHINE LEARNINGS section of LEARNINGS.md.
    Rotates to LEARNINGS.archive.md if count exceeds MAX_MACHINE_ENTRIES.
    """
    # C2: scrub THEN truncate — prevents SSN near the 200-char boundary from escaping redaction
    scrubbed = scrub_pii(message, donor_names or [])
    safe_msg = scrubbed[:200]
    entry = (
        f"- **{now_iso_date()} - {phase_id} - {error_class}:** "
        f"{safe_msg} _(resolution: pending)_\n"
    )
    text = pathlib.Path(learnings_path).read_text(encoding="utf-8")
    begin_idx = text.find(MACHINE_LEARNINGS_BEGIN)
    end_idx   = text.find(MACHINE_LEARNINGS_END)
    if begin_idx == -1 or end_idx == -1:
        return  # Guard: delimiters missing — do not corrupt file
    inner = text[begin_idx + len(MACHINE_LEARNINGS_BEGIN):end_idx]
    entries = [e for e in inner.strip().splitlines(keepends=True) if e.strip()]
    if len(entries) >= MAX_MACHINE_ENTRIES:
        _rotate_learnings(learnings_path, entries, text, begin_idx, end_idx)
        text = pathlib.Path(learnings_path).read_text(encoding="utf-8")
        begin_idx = text.find(MACHINE_LEARNINGS_BEGIN)
        end_idx   = text.find(MACHINE_LEARNINGS_END)
    new_text = (
        text[:begin_idx + len(MACHINE_LEARNINGS_BEGIN)]
        + "\n" + entry
        + text[end_idx:]
    )
    pathlib.Path(learnings_path).write_text(new_text, encoding="utf-8")
```

---

## Mid-Session Data Refresh Rules

**Rule GEN-1 — Tiller PDF re-read diff (applies any time a Tiller export is re-read mid-session):**
When reading a Tiller P&L, net worth, or balance sheet PDF that was already read earlier in
the session, immediately compute and display a structured diff against current dataset values
before making any changes:
```
Revenue:  $[old] → $[new]  (Δ $[diff])
Expenses: $[old] → $[new]  (Δ $[diff])
Net:      $[old] → $[new]  (Δ $[diff])
```
Do NOT silently update dataset values. Show the diff and confirm before applying. If the diff
is zero (no change), breadcrumb "re-read confirms no change" and continue.

**Rule GEN-2 — Net worth / P&L linkage (applies when user reports a Tiller update):**
If the user says "I updated the P&L" (or similar), always ask:
"Did the net worth/balance sheet also update? The EOY net assets figure may have changed."
Re-read BOTH the P&L PDF and the net worth PDF before updating any dataset value. The two
documents are linked in Tiller — a P&L change nearly always affects the balance sheet.

---

## Email Workflow

Three question classes:
1. **To the user:** AskUserQuestion or Open Question block in plan file; user answers via
   `/form990 ask <plan> <OQ-id> <answer>` (explicit) or `/form990 ask <plan>` (interactive).

   **Interactive mode (C3):** When invoked without a question-id, list all pending open questions
   in a numbered menu and ask the user to pick one:
   ```
   ┌─ Open Questions ─────────────────────────────────────────────────────┐
   │  1. OQ-1  (P1)  What is the prior-year gross receipts total?         │
   │  2. OQ-2  (P1)  Is there a payroll register from the fiscal year?    │
   │  3. OQ-3  (P2)  "Office supplies" — Program or Management & General? │
   └───────────────────────────────────────────────────────────────────────┘
   Pick a number to answer, or press Enter to skip: _
   ```
   After the user picks and answers, record the answer and offer to continue answering
   remaining questions. Mark each answered question in machine state and breadcrumb.
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

**`{{WHY_IT_MATTERS}}` lookup table (C3).**
When drafting an email via `gmail_create_draft`, fill `{{WHY_IT_MATTERS}}` from
this lookup instead of asking the ED to write it. Use the most specific match;
fall back to the generic entry if no specific match applies.

| Open Question type (topic keyword) | `{{WHY_IT_MATTERS}}` value |
|---|---|
| Prior-year 990 / gross receipts history | "The IRS uses 3-year average gross receipts to determine which 990 form the org must file, and prior-year Schedule A data is required for the 5-year public support test." |
| Payroll register / W-2 counts | "Part V of Form 990 asks how many W-2s and 1099s you issued; the number must match your actual filings or the IRS will flag a discrepancy." |
| 1099-MISC / NEC register | "Part V Line 2 asks for the number of 1099s issued; mismatches with IRS third-party data are a common audit trigger." |
| Officer or director compensation | "Part VII requires each officer, director, and key employee's compensation reported separately; the figures must tie to W-2 Box 1 or 1099-NEC to avoid Schedule J scrutiny." |
| Donor list / contribution breakdown | "Schedule B requires a list of contributors who gave more than $5,000 (or more than 2% of total contributions); this schedule is filed with the IRS but not disclosed publicly." |
| Board roster / board minutes | "Part VI asks whether the board reviewed the 990 before filing, lists independent directors, and confirms whether meeting minutes are documented." |
| Conflict-of-interest policy | "Part VI Line 12 asks whether the org has a written conflict-of-interest policy; answering yes without attaching the actual policy can invite follow-up." |
| Bylaws / articles of incorporation | "Part VI governance questions (lines 6, 7, 19) reference the org's governing documents; the preparer must confirm the documents are current and on file." |
| Audit / review report (financial) | "Part XII asks whether the org had an independent financial audit or review; if yes, the auditor's name and hours must be disclosed." |
| Bank statements / cash balance | "The Part X balance sheet (beginning and end of year) must reconcile to bank statement ending balances; unexplained differences are a red flag." |
| Schedule A public-support data (prior years) | "Schedule A requires 5 years of public support data; without prior-year numbers the public support percentage cannot be computed and the 509(a)(1) test cannot be confirmed." |
| Generic / other | "The IRS requires this information to complete a specific line of the Form 990; without it the return will be incomplete and may be rejected." |

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

# NOTE: artifacts/scripts/fixtures/ is NOT excluded — per-run sample fixtures
# are committed as audit trail. Scripts themselves live in {SKILL_ROOT}/scripts/
# (skill-owned, org-agnostic) and are committed to the skill repo, not here.

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
| `donor_names` | string[] | Names of large donors (used by `scrub_pii()`); default `[]` |
| `prior_year_990_eoy_net_assets` | number \| null | EOY net assets from the most recently filed prior year 990. null = no prior filing or user-deferred. |
| `prior_year_990_eoy_net_assets_source` | `"operator_stated"` \| `"teos_extracted"` \| null | Source of the EOY net assets value — tracks which upstream branch populated it for Decision Log attribution. |
| `transition_from_ez` | boolean \| null | `true` if prior year was filed on Form 990-EZ (first year on full 990). null = not yet evaluated. Set at P0 variant routing. |

Unknown keys are breadcrumbed and dropped. Typo'd keys are never merged into working state.

---

## Top-Level Machine State Fields (non-key_facts)

Fields stored at the top level of machine state (siblings of `key_facts`, not inside it):

| Field | Type | Description |
|---|---|---|
| `tax_year` | string | 4-digit filing year |
| `form_variant` | `"990"` \| `"990-EZ"` \| `"990-N"` \| `"HALTED-PF"` \| `"HALTED-CHURCH"` | Determined at P0 variant routing |
| `payroll_tax_source` | `"combined_tiller"` \| `"separate_employer"` \| null | Set at P2 payroll commingling check. `"combined_tiller"` = employer + employee taxes commingled in single Tiller line, triggers P3 Pre-check halt until Gusto employer taxes provided. `"separate_employer"` = Gusto employer-only taxes confirmed available separately. null = not yet evaluated (no payroll lines encountered, or P2 not yet run). |
| `skill_root` | string | Absolute path to skill install directory. Set by Step 0.0; non-nullable after P0. |
| `prior_990_analysis` | object \| null | Extracted from TEOS or operator-provided prior year 990 PDF at P1. Schema: `{eoy_net_assets: number\|null, schedule_a_line15_pct: number\|null, board_members: [{name, title, hours}], schedule_i_methodology: "part_ii"\|"part_iii"\|null, contributions: number\|null, program_service_rev: number\|null, total_revenue: number\|null, total_expenses: number\|null}`. null = no prior filing available or TEOS inaccessible. |
| `artifact_local_paths` | object | Absolute paths to locally-copied source documents found in `artifacts/` at P0 pre-scan. Keys: `prior_990_pdf` (string\|null), `payroll_w2_pdf` (string\|null), `ca_sec_state_pdf` (string\|null). Populated at P0 step 8b; consumed by P1 (skip Drive searches for already-found docs), P3 (payroll source), P6 (CA governance). |
| `ca_sos_officers` | `[{name: string, title: string}]` \| null | Current officers/directors from CA Secretary of State discovery at P1 (WebSearch or local SI-100 PDF parse). null = CA org but discovery failed or not CA org. Consumed by board-change detector (P1) and Part VII Section A (P5). |

---

## form990_coordinates_{tax_year}

*This table is populated during Pre-build Verification step 3a (AcroForm probe + coordinate
sweep) and is specific to each tax-year's PDF revision. It is not pre-filled here — run
the probe script, then record the table in `TOOL-SIGNATURES.md §f990 Coordinate Table`
wrapped in `<!-- BEGIN COORDINATES <year> -->` / `<!-- END COORDINATES <year> -->` sentinels.
P9 reads coordinates from TOOL-SIGNATURES.md (not this file) and hashes that sentinel block
for change detection.*

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