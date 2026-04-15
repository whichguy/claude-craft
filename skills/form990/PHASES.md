# Form 990 Skill — Phase Playbooks (P0–P9)

Each phase follows the same 7-section template:
**Goal · Inputs · Pre-check · Work · Outputs · Idempotency · Applicable Gates · Transition**

Pre-check failures HALT the phase — do NOT dispatch. Surface via UI banner and wait for
user resolution or explicit skip instruction.

Phase contract markers (`**Pre-check:**`, `**Outputs:**`) are parseable by Q-G9f
execution-graph analysis. Use them consistently on every phase.

---

## Cross-Cutting Pattern: Programmatic Analysis

Several phases involve processing enough data (50–500+ budget rows, 5-year support histories,
multi-column expense matrices) that an LLM working row-by-row in conversational turns risks
error accumulation, token burn, and non-reproducible arithmetic. For any phase marked
**[PROG]** in its header, apply this pattern instead of inline computation:

### When to apply

Apply when the phase processes data that meets ANY of:
- More than 20 rows/records to aggregate, classify, or transform
- Multi-dimensional arithmetic (e.g., Part IX: 25 rows × 4 functional columns = 100 cells)
- 5-year sliding window calculations (Schedule A public-support test)
- Needs to be reproducible and verifiable (sha256 output fingerprinting)

### The pattern (4 steps)

**Step 1 — Write the script.**
Write a self-contained Python 3 script to `artifacts/scripts/<phase>-<purpose>.py`.
The script must:
- Accept input paths as command-line arguments (no hardcoded paths)
- Print a JSON result to stdout on success (`{"status": "ok", "result": {...}}`)
- Print a JSON error to stdout on failure (`{"status": "error", "message": "..."}`)
- Be idempotent (re-running on the same input produces identical output)
- Log processing steps to stderr (not stdout) so stdout stays machine-parseable

**Step 2 — Sample run (validate logic before full dataset).**
Run the script on a small sample first:
- For tabular data: pass the first 5 rows as a fixture (either a sliced CSV or a tiny
  JSON fixture file written to `artifacts/scripts/fixtures/<phase>-sample.json`)
- For multi-year calculations: use 2 years of data instead of 5
- Inspect the output manually; verify the arithmetic matches hand-calculation on the sample
- If the output looks wrong: fix the script and re-run the sample before proceeding
- Write a breadcrumb: `"Script <name> — sample run PASS (N rows, result: <summary>)"`

**Step 3 — Full run.**
Once the sample validates:
- Run the script on the full dataset
- Capture stdout (JSON result) and sha256 the output for `input_fingerprint` tracking
- Write the result to the appropriate artifact file
- Write a breadcrumb: `"Script <name> — full run: <N> rows processed, <M> Open Questions created"`

**Step 4 — Human review of flags.**
The script output should include a `flags` array listing rows/items that need human review
(low-confidence mappings, ambiguous cases, Open Questions). Display these to the user in a
formatted table before closing the phase. The user resolves flags by answering inline or
by updating the source data and re-running.

### Script registration

Scripts are tracked in machine state under `programmatic_scripts[]`:
```json
"programmatic_scripts": [
  {
    "phase": "P2",
    "purpose": "coa-mapping",
    "script_path": "artifacts/scripts/p2-coa-mapping.py",
    "sample_fixture": "artifacts/scripts/fixtures/p2-sample.json",
    "last_run": "<iso>",
    "last_run_sha256_input": "<sha256-of-input-data>",
    "last_run_sha256_output": "<sha256-of-output-json>",
    "rows_processed": 47,
    "flags_count": 3
  }
]
```
Scripts are committed to git along with skill files (they are not PII). The script itself is
a first-class artifact: it documents *how* the data was processed, enables re-runs after
source corrections, and is reviewable by the CPA as part of the audit trail.

### Safety rules

- Scripts write output to stdout only — never modify source data (Drive sheets, prior 990s)
- Scripts never create Gmail drafts or call external APIs — data processing only
- Scripts are Python 3 standard library only (no `pip install` required): `csv`, `json`,
  `sys`, `math`, `collections`. If a third-party library would simplify logic, note it in
  a comment but implement without it so the script runs anywhere `python3` is available

### Invocation via run_script() (mandatory — do NOT use bare subprocess.run)

All script invocations go through `SKILL.md §run_script()`. Before invoking:
1. Add the script's absolute path to `SCRIPT_ALLOWLIST`.
2. Pass `phase_id=` so the correct deadline from `PHASE_DEADLINES_S` applies.

```python
# Example (P2 CoA mapping)
SCRIPT_ALLOWLIST.add(str(pathlib.Path("artifacts/scripts/p2-coa-mapping.py").resolve()))
result = run_script(
    "artifacts/scripts/p2-coa-mapping.py",
    args=["--sheet-csv", "artifacts/budget-export.csv"],
    phase_id="P2",
)
# result is parsed JSON dict; ScriptError raised on failure
```

On `ScriptError`: write breadcrumb via `scrub_pii()` (SKILL.md §scrub_pii), set
`phase_status = "failed"` + `last_error`, atomic commit, surface in UI.

---

## P0 — Intake & Variant Routing

**Goal.** Identify the organization, determine gross receipts / total assets, select the
correct 990 variant, and write all key facts into machine state.

**Inputs.** `--sheet` (Google Sheets ID or URL), `--tax-year` (YYYY), prior 990 if
available (prompt user), prior-1 and prior-2 year gross receipts (for 3-yr averaging with current year).

**Pre-check.**
- Verify `--sheet` ID/URL is accessible: call `mcp__claude_ai_Google_Drive__read_file_content`
  with the sheet ID; on permission/not-found error → halt with "verify sheet ID and sharing"
- Verify `--tax-year` is a 4-digit year ≤ current year
- Verify invocation cwd is writable (for plan file creation)
- Ask the user: is this organization a church, association of churches, or integrated auxiliary
  per IRC §6033(a)(3)(A)(i)? (yes/no)
- Ask the user: is this organization a private foundation? (yes/no — or check prior 990 Part I)

**Work.**
0. **Scope-exclusion banner (one-time, before intake questions).** Check breadcrumbs for
   `scope_exclusion_shown` before rendering; skip if already shown. Render the following banner
   and use `AskUserQuestion` to confirm the user's situation is in scope. Record
   `scope_exclusion_shown: true` in Decision Log after user acknowledges. If they stop, halt
   cleanly without writing machine state.
   ```
   ╔══════════════════════════════════════════════════════════════════╗
   ║  ℹ  What this skill handles — and what it does NOT              ║
   ╠══════════════════════════════════════════════════════════════════╣
   ║  ✔  Standard annual Form 990 / 990-EZ / 990-N filing            ║
   ║  ✔  501(c)(3) public charities (Schedules A, B, D, G, L, M, O)  ║
   ╠══════════════════════════════════════════════════════════════════╣
   ║  ✖  Short-period returns (first year or change of fiscal year)  ║
   ║  ✖  Initial returns (brand-new organization, first filing year) ║
   ║  ✖  Final returns (dissolving or merging organization)          ║
   ║  ✖  Amended returns (Form 990 with "Amended Return" checked)    ║
   ║  ✖  State filings (CA RRF-1, NY CHAR500, IL AG990-IL, etc.)     ║
   ║  ✖  Group returns (parent filing on behalf of subordinates)     ║
   ║  ✖  Private foundations (990-PF — halted at variant routing)    ║
   ║  ✖  Form 990-T (unrelated business income — may accompany 990)  ║
   ╠══════════════════════════════════════════════════════════════════╣
   ║  If any ✖ above describes your situation, stop here and         ║
   ║  consult a CPA before using this skill for that return.         ║
   ╚══════════════════════════════════════════════════════════════════╝
   ```
   Ask: "Does any of the ✖ items apply to this return? (yes → stop; no → proceed)"
   If no: continue to step 1.

**Preparer calibration (P0 only).** The preparer is the Executive Director — not an accountant.
They know: mission, programs, staff, budget categories. They don't know yet: the 990's 12-part
structure, functional expense buckets, why Schedule A matters, or that the PDF cannot be filed.
Frame intake questions in plain language; define IRS terms inline; offer "not sure" as an option.

1. Pull sheet tab list via Drive MCP (`read_file_content` → tab list); ask for: EIN, legal
   name, fiscal year start/end, accounting method, public charity basis
2. Capture gross-receipts history: current year + prior-1 + prior-2 (from prior 990 or user
   input). Compute `gross_receipts_3yr_average = (yr_current + yr_prior1 + yr_prior2) / 3`
2a. Prior year 990 check. Ask:
    "Do you have a filed prior year Form 990? If yes, what were the total net assets
    (End of Year) on that return? (You can find this on the prior 990 Part X Line 33,
    column B — End of Year.)"
    - If user provides: set `key_facts.prior_year_990_eoy_net_assets = <amount>`,
      set `key_facts.prior_year_990_eoy_net_assets_source = "operator_stated"`
    - If no prior filing: set `key_facts.prior_year_990_eoy_net_assets = null`,
      breadcrumb "no prior filing — Part X BOY will use Tiller opening balance"
    - If deferred: set to null, add `open_questions[]` entry
      `{id: "OQ-py990", type: "prior_990_eoy_net_assets", status: "pending"}`
3. Run variant decision tree (verbatim — do not paraphrase):
   ```
   IF is_private_foundation:
       variant = HALTED-PF
   ELIF is_church_or_6033a3_exempt:
       variant = HALTED-CHURCH
   ELIF gross_receipts_3yr_average <= 50000:
       variant = 990-N
       # 3-year averaging per Rev. Proc. 2011-15 §3.01
       # NEW ORGS (< 3 years): use available-years average
       #   1st year: current year only
       #   2nd year: (yr1 + yr2) / 2
       #   3rd+ year: standard 3-year average
       # If org was not in existence for all 3 years, document in Decision Log
   ELIF gross_receipts_current < 200000 AND total_assets_eoy < 500000:
       variant = 990-EZ           ← CONJUNCTIVE; both prongs required
       # 990-EZ gross receipts = gross receipts (NOT net of refunds or Line 12 total revenue)
       # Includes: contributions, program fees, investment income GROSS of expenses
       # Does NOT equal Part VIII Line 12 (which nets certain items)
   ELSE:
       variant = 990
   ```

   **Additional checks before finalizing variant:**
   - **509(a)(3) supporting organizations.** If `key_facts.public_charity_basis == "509(a)(3)"`,
     determine the support organization type (Type I, II, or III). Type III functional integral
     organizations have additional Schedule A requirements. Create an Open Question if the type
     is uncertain. Do NOT halt — 509(a)(3)s file 990 (or 990-EZ/N per size) just like other public charities.
   - **UBTI / 990-T detection.** If the budget sheet shows income from an activity that might be
     Unrelated Business Taxable Income (e.g., advertising revenue, certain rental income from
     debt-financed property, income unrelated to the exempt purpose), surface a non-blocking
     advisory: "UBTI may be present — a Form 990-T may also be required. Recommend review with
     a CPA." Do NOT halt; record in Decision Log with `severity: "advisory"`.
   - **§6033(a)(3)(B) mission societies.** If the user confirms the organization is a mission
     society of a church (IRC §6033(a)(3)(B)(i)) or certain educational organizations (§6033(a)(3)(B)(ii)),
     route to HALTED-CHURCH with a specific breadcrumb noting the §6033(a)(3)(B) sub-section.

4. Record the specific threshold comparison in the Decision Log (e.g.,
   `"GR $210k ≥ $200k → full 990"` or
   `"GR $180k < $200k AND TA $650k ≥ $500k → full 990 (total-assets prong failed)"`)
5. Write top-level machine state: `tax_year`, `fiscal_year_start`, `fiscal_year_end`,
   `form_variant`. Write `key_facts`: legal_name, ein, accounting_method,
   gross_receipts_current, gross_receipts_3yr_average, total_assets_eoy, public_charity_basis.
   (`form_variant` is a top-level field, NOT inside `key_facts`.)
6. If `variant == HALTED-PF`:
   - Write terminal breadcrumb: `"Halted: private foundation — file Form 990-PF (out of scope)"`
   - Render halt banner:
     ```
     ╔══════════════════════════════════════════════════════╗
     ║  ✖ HALTED — Private Foundation                        ║
     ║  Form 990-PF required. This skill covers only         ║
     ║  Form 990, 990-EZ, and 990-N.                         ║
     ║  Contact a CPA specializing in 990-PF returns.        ║
     ╠══════════════════════════════════════════════════════╣
     ║  ↩ If you answered "private foundation" by mistake:   ║
     ║  Use /form990 phase P0 <plan> to restart intake.      ║
     ╚══════════════════════════════════════════════════════╝
     ```
   - Stop; do not advance to P1
7. If `variant == HALTED-CHURCH`:
   - Write terminal breadcrumb: `"Halted: IRC §6033(a)(3) exempt — no 990 required"`
   - Render halt banner:
     ```
     ╔══════════════════════════════════════════════════════╗
     ║  ✖ HALTED — Church / §6033(a)(3) Exempt              ║
     ║  No Form 990-series filing required per IRC           ║
     ║  §6033(a)(3). Retain this determination in your       ║
     ║  records in case of IRS inquiry.                      ║
     ╠══════════════════════════════════════════════════════╣
     ║  ↩ If you answered "church" by mistake:               ║
     ║  Use /form990 phase P0 <plan> to restart intake.      ║
     ╚══════════════════════════════════════════════════════╝
     ```
   - Stop; do not advance to P1
8. Mirror key facts into the `## Key Facts` markdown table (human-readable section)

**Outputs.**
- Machine state JSON populated: tax_year, fiscal_year_*, form_variant, all key_facts fields
- `## Key Facts` table updated
- Decision Log entry records the variant comparison
- `phase_status.P0 = "done"`

**Idempotency.** Overwrite mode — re-running P0 rewrites all key_facts. If prior P0 data
exists, prompt user to confirm override (the EIN/name may have changed due to correction).

**Applicable Gates.** Q-F1 (correct variant; check both prongs), Q-F9 (EIN consistent),
Q-F13 (accounting method noted; comparison to prior year occurs in P8).

**Transition.** → P1 (unless HALTED-*).

---

## P1 — Source Discovery (Sheets / Drive / Gmail)

**Goal.** Find every source artifact needed for the return: prior 990, bank statements,
payroll reports, 1099 register, donor list, board roster, bylaws, COI policy, audit report.

**Inputs.** Drive access, Gmail access, budget sheet URL from P0.

**Pre-check.**
- Verify P0 machine state parses and `key_facts.legal_name` + `ein` + `fiscal_year_end`
  are present (non-null)
- Verify Drive MCP auth: call `mcp__claude_ai_Google_Drive__list_recent_files` (read-only
  smoke test); on auth error → halt with "re-auth Drive MCP"
- Verify Gmail MCP auth: call `mcp__claude_ai_Gmail__gmail_get_profile`; on auth error →
  halt with "re-auth Gmail MCP"

**Work.**
1. Run Drive search queries (each capped at 200 results; log truncation flag in breadcrumb
   if cap is hit). Curated query list:
   - `"990" type:pdf` — prior year returns
   - `"budget" OR "financials" type:spreadsheet` — budget sheets
   - `"payroll" OR "W-2" OR "wages"` — payroll exports
   - `"1099"` — contractor records
   - `"bank statement" OR "bank reconciliation"` — banking records
   - `"donor" OR "contributions" OR "donations"` — donor registers
   - `"board roster" OR "board members" OR "directors"` — governance
   - `"bylaws" OR "articles of incorporation"` — founding docs
   - `"conflict of interest" OR "COI policy"` — governance
   - `"audit" OR "review report" OR "compilation"` — financial review
2. For each budget sheet tab: read header row + 4 sample rows; record `{column_name: inferred_type}`
   into `key_facts.sheet_schema`
3. Register findings into `artifacts[]` with Drive file ID as path reference
4. For each missing artifact in the required checklist (below), create an Open Question:
   ```
   Required source checklist:
   ├─ prior_990         (prior year Form 990 — or note "first-year filer")
   ├─ budget_sheet      (already have from P0 --sheet flag) ✔
   ├─ bank_statements   (covering fiscal year)
   ├─ payroll_report    (W-2 register or payroll provider export)
   ├─ payroll_w2_annual (Gusto or payroll processor W-2 annual summary PDF — required
   │                     alongside bank statements. Tiller net pay is always wrong for
   │                     Part VII/IX. Request before P3. If not immediately available:
   │                     add open_questions entry and continue; P3 Pre-check will block.)
   ├─ 1099_register     (if contractors paid ≥ $600)
   ├─ donor_list        (if Schedule B may be triggered)
   ├─ board_roster      (for Part VI and Part VII)
   ├─ bylaws            (for Part VI governance questions)
   ├─ coi_policy        (conflict-of-interest, for Part VI Line 12a)
   └─ audit_report      (if required by state law, funder covenants, or bond agreements;
                         OR if federal award expenditures ≥ $750K per Uniform Guidance /
                         Single Audit Act — gross receipts alone do NOT trigger Single Audit)
   ```

**Prior year 990 TEOS check (P1):** Check apps.irs.gov/app/eos/ for the org's EIN.
If a prior filing exists:
1. Download the most recent year's 990 PDF
2. Extract and store as `prior_990_analysis` in machine state:
   - `eoy_net_assets` (Part X Line 33 col B)
   - `schedule_a_line15_pct` (Schedule A Part III Line 15)
   - `board_members` (Part VII Section A — name, title, hours)
   - `schedule_i_methodology` (did they use Part II or Part III for individual grants?)
If no TEOS record found: breadcrumb "no prior filing on TEOS — new filer or EIN lookup failed"
If TEOS is inaccessible: add `open_questions[]` entry requesting prior 990 PDF directly from
operator; continue without blocking.
When TEOS extraction succeeds:
- Set `prior_990_analysis.eoy_net_assets = <extracted value>`
- If `key_facts.prior_year_990_eoy_net_assets` is still null (user deferred at P0):
  populate it now from `prior_990_analysis.eoy_net_assets`
- Set `key_facts.prior_year_990_eoy_net_assets_source = "teos_extracted"`
This ensures Cluster C always reads a populated key_facts field when prior year data exists,
regardless of whether it came from P0 (operator-stated) or P1 (TEOS-extracted).
5. For each missing artifact: create an Open Question. If addressed to an external party,
   create a Gmail draft via `gmail_create_draft` using `{SKILL_ROOT}/templates/email-question.md`:
   - **Never auto-send** — draft only
   - Record `draft_id` in `open_questions[].draft_id`
   - Apply dedup rule (see SKILL.md §Email Workflow): check existing draft_id before creating

**Outputs.**
- `artifacts[]` entries populated for discovered sources (path = Drive file ID URL)
- `key_facts.sheet_schema` populated
- `open_questions[]` populated for any missing artifact with `status = "pending"`
- Gmail draft IDs recorded for externally-addressed questions
- `phase_status.P1 = "done"` (or `"paused"` if open questions block progress)

**Idempotency.** Overwrite mode for artifact registration (re-discovery finds same files).
Gmail draft dedup: check `draft_id` before creating — see SKILL.md §Email Workflow.

**Applicable Gates.** Q-F16 (source-discovery completeness — all checklist items either found
or queued as open question).

**Transition.** Allow user to answer pending questions or explicitly skip; then → P2.

---

## P2 — Chart-of-Accounts → 990 Line Mapping [PROG]

**Goal.** Every budget line gets mapped to a Part VIII (revenue) or Part IX (expense) 990
line plus a functional bucket (Program / M&G / Fundraising) with a documented allocation basis.

> **Programmatic analysis required** (see Cross-Cutting Pattern above). Budget sheets routinely
> have 30–300 rows. Apply the 4-step script pattern: write `artifacts/scripts/p2-coa-mapping.py`,
> validate on a 5-row sample fixture, run full dataset, review flags with user.

**Inputs.** Budget sheet tabs from P1 (`key_facts.sheet_schema`, budget tab content).

**Pre-check.**
- Verify `key_facts.sheet_schema` is populated (non-null) from P1
- Verify `artifacts` has non-null budget-sheet handle
- Verify total row count ≤ 500 (if > 500: halt and ask user to narrow scope or batch)
- If 100 < rows ≤ 500: read the Sheets tab in 100-row chunks (MCP calls only — the assembled
  CSV is passed whole to the script; chunking applies to the Drive MCP fetch, not script invocation)

**Work.**

**Script: `artifacts/scripts/p2-coa-mapping.py`**
- Input args: `--sheet-csv <path>` (normalized CSV dump of budget tab), `--tax-year <YYYY>`
- Output: JSON with `{mapped_rows: [...], flags: [...], summary: {revenue_total, expense_total, unmapped_count}}`
- Sample fixture: `artifacts/scripts/fixtures/p2-sample.json` (5 rows covering at least one
  revenue, one salary, and one ambiguous row)
- The script applies Steps 1–5 below algorithmically; human review happens on the `flags` output

For each budget row, apply the mapping methodology:

**Step 1: Classify sign/type.**
- Revenue if: account-type = income, or amount is a credit balance
- Expense if: account-type = expense, or amount is a debit balance

**Step 2: Map Revenue → Part VIII line by source taxonomy.**
| Revenue type | Part VIII line |
|---|---|
| Contributions / grants / gifts | Line 1 (a–h by source sub-type) |
| Program service fees | Line 2 |
| Membership dues | Line 3 |
| Investment income | Line 4 |
| Dividends / interest on investments | Line 4 |
| Real estate / rental income | Line 5 |
| Gain/loss on asset sales | Line 7 |
| Fundraising events (gross) | Line 8a |
| Gaming | Line 9a |
| Sales of inventory | Line 10a |
| Other revenue (unclassified) | Line 11 (a–e) |

**Step 3: Map Expense → Part IX line by nature.**
| Expense type | Part IX line |
|---|---|
| Grants to US orgs / governments | Line 1 |
| Grants to US individuals | Line 2 |
| Grants to foreign orgs / individuals | Line 3 |
| Officer / key-employee compensation | Line 5 |
| Compensation to disqualified persons (IRC §4958) | Line 6 |
| Other salaries / wages | Line 7 |
| Pension / retirement contributions | Line 8 |
| Other employee benefits | Line 9 |
| Payroll taxes | Line 10 |
| Legal fees | Line 11a |
| Accounting / auditing fees | Line 11b |
| Lobbying / government affairs | Line 11c |
| Professional fundraising services | Line 11d |
| Investment management fees | Line 11e |
| Management / IT consulting / other fees | Line 11f |
| Other fees for services | Line 11g |
| Advertising / promotion | Line 12 |
| Office expenses / supplies | Line 13 |
| Information technology | Line 14 |
| Royalties | Line 15 |
| Occupancy / rent | Line 16 |
| Travel | Line 17 |
| Travel / entertainment for federal/state/local public officials | Line 18 |
| Conferences / meetings | Line 19 |
| Interest expense | Line 20 |
| Depreciation / amortization | Line 22 |
| Insurance | Line 23 |
| All other expenses | Line 24 (a–e) |

**Payroll commingling check (P2 — run when any "Payroll Tax" or equivalent category is encountered):**

Prompt: "Does your bookkeeping show payroll taxes as a single combined deposit
(employer + employee withholdings together) or separately?"
- If combined: flag for Part IX Line 10 correction; set
  `payroll_tax_source = "combined_tiller"` in machine state; add open_questions
  entry requiring Gusto employer taxes summary before P5.
  If no Gusto column provided by P5 Pre-check → blocking halt per Q-F19.
- If separate: proceed normally.

Note: If Tiller uses non-standard or user-renamed categories that don't match "Payroll Tax"
literally, default to asking unconditionally: "Does your bookkeeping show payroll taxes as
combined or separate?"

**Step 4: Assign functional bucket.**
- Direct assignment: row label clearly names a program/M&G/fundraising activity
- FTE-weighted: salaries allocated by headcount fraction per function
- Square-footage: occupancy split by sq ft per function
- Time-study: salaries/benefits split by actual time-allocation study
- Combination: some direct + some time-study (document the basis)

**Step 5: Confidence scoring.**
- Compute `confidence` in [0, 1] based on label-keyword match quality
- If `confidence < 0.8` OR ≥ 2 candidate lines: create Open Question with suggested answer
  and rationale; do NOT auto-commit the mapping

**Worked examples** (required in output):

*Example 1 — Clear salary row:*
```
raw_label: "Executive Director Salary"
→ mapped_part: IX, mapped_line: 5 (Officer compensation)
  allocation: FTE-weighted (60% program / 30% M&G / 10% fundraising)
  confidence: 0.95
  rationale: "Title contains 'Director' — officer compensation; time-study allocation"
```

*Example 2 — Ambiguous "program supplies":*
```
raw_label: "Program Supplies & Printing"
→ candidate_lines: [IX.13 (office expenses), IX.24 (other)]
  If supplies are consumed in delivering programs → IX.13 Column B (Program)
  If supplies are for overhead admin → IX.13 Column C (M&G)
  confidence: 0.65 → Open Question OQ-N: "Are these supplies for program delivery
  or office overhead? (program delivery → IX.13 Program column)"
```

*Example 3 — Donated services (does NOT map to Part VIII):*
```
raw_label: "Donated Legal Services (in-kind)"
→ This is NOT reportable revenue unless the org has a policy to record and report
  in-kind contributions under GAAP. For cash-basis filers: skip (no line entry).
  For accrual filers with in-kind policy: revenue VIII.1g + equal expense IX.24.
  Open Question: "Does {{key_facts.legal_name}} have a policy to record donated services?
  If yes, what is the FMV?"
  confidence: 0.40 → always creates an Open Question; no auto-commit
```

**Outputs.**
- `artifacts/coa-mapping.csv` with columns:
  `sheet_row, sheet_tab, raw_label, raw_amount, mapped_part, mapped_line,
   functional_bucket, allocation_basis, confidence, rationale, open_question_id`
- Unresolved rows mirrored in `open_questions[]`
- Artifacts entry: `artifacts.coa_mapping.path`, `output_sha256`, `input_fingerprint`
  (input: budget-sheet head_revision_id or modified_time+tab_snapshot_sha256 per E2)

**Idempotency.** Overwrite mode — re-execution fully rewrites `coa-mapping.csv`.

**Applicable Gates.** Q-F3 (functional columns sum), Q-F10 (ED allocation documented),
Q-F17 (methodology narrated in Schedule O), Q-F18 (not yet — deferred to P5).

---

## P3 — Financial Statement Production [PROG]

**Goal.** Produce Statement of Activities, Balance Sheet (BOY + EOY), and Functional Expense
matrix from the CoA mapping.

> **Programmatic analysis required** (see Cross-Cutting Pattern above). P3 aggregates the
> CoA mapping into three financial statements — 25 Part IX rows × 4 columns = 100 cells that
> must be arithmetically exact. Apply the 4-step script pattern:
> write `artifacts/scripts/p3-financial-statements.py`, validate on a 5-row sample of the
> CoA mapping CSV, then run the full mapping.

**Inputs.** `artifacts/coa-mapping.csv` from P2; budget sheet tab values.

**Pre-check.**
- [→ verify_ancestors] `statement_of_activities`, `balance_sheet`, `functional_expense` —
  the Phase Entry Protocol (SKILL.md §Phase Entry Protocol) calls `verify_ancestors()` on
  each P3 output artifact before entering this phase, transitively re-hashing `coa_mapping`
  on disk. Any sha256 mismatch halts with an ancestor-regression banner before Pre-check runs.
- Verify `coa-mapping.csv` contains all required columns (existence already confirmed by verify_ancestors)
- Verify zero rows with empty `mapped_line` (Q-F18 proxy — all rows must be mapped)
- Verify at least one row per functional bucket or explicitly N/A

**Work.**

**Script: `artifacts/scripts/p3-financial-statements.py`**
- Input args: `--coa-csv artifacts/coa-mapping.csv`, `--balance-sheet-csv <path>` (if
  balance-sheet accounts are in a separate tab)
- Output: JSON with `{statement_of_activities: {...}, balance_sheet: {boy: {...}, eoy: {...}},
  functional_expense: {rows: [...], column_check_pass: true|false}, flags: [...]}`
- Sample fixture: `artifacts/scripts/fixtures/p3-sample.json` (10 mapped rows — larger than
  the canonical 5-row default because the script must exercise three output dimensions in one
  run: ≥3 Part IX expense lines with functional splits to validate Q-F3 column sums, ≥2 Part
  VIII revenue lines to validate Statement of Activities totals, and ≥1 balance-sheet account
  pair BOY/EOY to validate Part X anchors; fewer rows would leave one output dimension untested)
- The script performs Steps 1–4 below; `column_check_pass` is the Q-F3 inline check

1. Aggregate revenue rows by Part VIII line → compute line totals → write Statement of
   Activities (total revenue, total expenses, change in net assets, beginning/ending net assets)
2. Aggregate balance-sheet accounts → produce Part X: BOY + EOY columns (assets, liabilities,
   net assets/fund balances)
3. Aggregate expense rows by Part IX line AND functional bucket → write functional expense
   matrix (rows = Part IX lines; columns = Program / M&G / Fundraising / Total)
4. Verify: for each Part IX row, Column B + Column C + Column D = Column A (Q-F3 check inline)

**Outputs.**
- `artifacts/statement-of-activities.md`
- `artifacts/balance-sheet.md`
- `artifacts/functional-expense.csv` (Part IX rows × 4 columns)
- Each artifact registered in machine state with `output_sha256` and `input_fingerprint`
  referencing `coa_mapping.output_sha256`

**Idempotency.** Overwrite mode — all three files rewritten on re-run.

**Applicable Gates.** Q-F2 (big-square preview — not authoritative until P7 but flag early),
Q-F3 (functional columns sum per row), Q-F11 (prior-year comparatives — BOY from prior 990),
Q-F12 (fundraising expense non-zero if contributions > 0).

---

## P4 — Part IV Checklist → Schedule Trigger

**Goal.** Walk every Part IV yes/no question to determine which schedules attach.

**Inputs.** Financial statements from P3, key facts, governance docs from P1.

**Pre-check.**
- [→ verify_ancestors] `part_iv_checklist` — Phase Entry Protocol calls `verify_ancestors()`
  on P4's output artifact, which transitively verifies `statement_of_activities`, `balance_sheet`,
  `functional_expense`, and `coa_mapping`. Any hash mismatch or missing file halts before Pre-check.
- Verify governance docs (bylaws, coi_policy, board_roster) present in `artifacts[]` or
  flagged as pending open question

**Work.**
1. **Part IV question enumeration (B7 + Spike-S3).** The IRS revises Part IV between tax
   years; do not hard-code the count. Use the following approach in order of availability:
   - **Runtime enumeration (preferred):** if `artifacts/f990-blank-<tax_year>.pdf` is cached
     from P9's fetch or provided via `--local-pdf`, extract Part IV text via `pypdf`
     (`PdfReader.pages[3].extract_text()` — Part IV is typically on page 4 of the blank)
     and count yes/no items by scanning for "Yes" / "No" checkbox patterns.
   - **Pinned count (fallback):** use the pinned count from TOOL-SIGNATURES.md
     §Pre-build Experiments §S3. For tax year 2025: **38 yes/no items** (verified by
     Spike-S3, 2026-04-11). If tax_year ≠ 2025, surface an Open Question:
     "Part IV count has not been verified for tax year {N} — re-run Spike-S3 before P4."
   Record which path was used in the breadcrumb. If neither path succeeds, halt P4 and
   ask the user to provide the blank PDF via `--local-pdf`.
2. For each question: answer `yes | no | need-info` based on available data
3. `need-info` → create Open Question with the specific information needed
4. `yes` → add corresponding schedule letter to `required_schedules[]`
5. Schedule A is ALWAYS added for 501(c)(3) non-PF regardless of Part IV answers

**Schedule triggers (common, not exhaustive — runtime-enumerate from PDF):**
- Sch A: always (501(c)(3) public charity)
- Sch B: did org receive contributions from any single donor ≥ $5K? (or ≥ 2% rule)
- Sch D: did org maintain donor-advised funds? Endowment? Conservation easement?
- Sch G: fundraising activities > $15K or gaming?
- Sch L: transactions with interested persons?
- Sch M: non-cash contributions ≥ $25K?
- Sch O: always for Part VI "describe" prompts
- Sch R: related organizations?

**Outputs.**
- `artifacts/part-iv-checklist.md` (each question: answer + rationale + open-question ref)
- `required_schedules[]` in machine state (subset of {A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, R})
- Artifact registered in machine state: `artifacts.part_iv_checklist.path`, `output_sha256`,
  `input_fingerprint` = `{statement_of_activities: sha, balance_sheet: sha, functional_expense: sha}`

**Idempotency.** Overwrite mode — checklist rewritten on re-run; `required_schedules[]`
fully rebuilt from answers (no append).

**Applicable Gates.** Q-F4 (proxy check only at P4: verify Schedule A is in `required_schedules[]`;
full Q-F4 PASS requires P6 Schedule A generation — cannot fully pass at P4), Q-F8 (all Part IV
questions answered or queued as open question; all `yes` answers added to `required_schedules[]`).

---

## P5 — Core Parts (III, V, VI, VII, VIII, IX, X, XI, XII)

**Goal.** Fill every core-form line into `dataset_core.json`. Part I is declared as a
structural placeholder (null) — populated by P7.

**Inputs.** Statements from P3, Part IV answers from P4, governance docs from P1.

**Pre-check.**
- [→ verify_ancestors] `dataset_core` — Phase Entry Protocol calls `verify_ancestors()` on
  P5's output artifact, which transitively verifies `part_iv_checklist`, all three P3
  statements, and `coa_mapping`. Hash mismatches halt before Pre-check with a regression banner.
- Verify `required_schedules[]` populated (even if empty list = "none triggered")
- Verify `key_facts.accounting_method` set (influences Part XI and Schedule D)

**Work.**

Iterate the line catalog for each Part. Compute / copy / query user as needed.

**Part III — Statement of Program Service Accomplishments:**
- Line 1: mission statement (≤ 300 characters)
- Lines 4a–4c: three largest programs by expense (program name, expenses, grants, revenue,
  description of beneficiaries/outputs)
- Line 4d: other program services (aggregate)
- Line 4e: total program service expenses

**Part V — Statements Regarding Other IRS Filings and Tax Compliance:**
- Line 1a: number of W-2s filed (from payroll register if available; Open Question if not)
- Line 1b: number of employees receiving wages > $100K (from payroll register)
- Line 2a: number of independent contractors receiving > $100K (from 1099 register)
- Line 3a: YES if gross receipts ≥ $200,000 OR total assets ≥ $500,000
- **Line 3b (state return filed):** If Line 3a = YES, answer whether all required state
  returns were filed. See §State/Ancillary Filing Guidance below before answering.
- Lines 4–13: answer each governance/compliance question

**§ State/Ancillary Filing Guidance (Part V Line 3b)**

This skill produces only the federal Form 990. State companion filings are out of scope
for automated production, but must be identified and disclosed here so the preparers
can confirm they are current.

**California nonprofits (GR > $50,000)** must file ALL THREE annually:

| Form | Agency | Trigger | Notes |
|------|--------|---------|-------|
| CA Form 199 | Franchise Tax Board (FTB) | GR > $50,000 | CA exempt org annual return; NOT the same as federal 990; FTB does not accept 990 as substitute |
| RRF-1 | CA AG Registry of Charitable Trusts | Registration required | Annual Registration Renewal Fee Report; must file if registered (most 501(c)(3)s) |
| CT-TR-1 | CA AG Registry | GR < $2M AND no audit | Treasurer's Report; accompanies RRF-1 |

Common CA nonprofit filing triggers (use as checklist):
- `CA Form 199` due: 15th day of 5th month after fiscal year end (same as federal 990: May 15 for calendar-year org), or extended
- `RRF-1 + CT-TR-1` due: 15th day of 5th month after fiscal year end = May 15 for calendar-year org (same deadline as CA Form 199 and federal 990)
- Solicitation in California without RRF-1 registration is a violation of the Supervision of Trustees and Fundraisers for Charitable Purposes Act

**How to answer Part V Line 3b:**
- If all required state filings are current → answer YES (or "Yes, CA Form 199 + RRF-1 + CT-TR-1")
- If uncertain or filings are late → create an Open Question; answer "pending" in dataset; mention in Schedule O

**Other states:** If the organization solicits in other states, those states may have
their own charitable solicitation registration requirements. Common states with active
enforcement: NY (CHAR500 + EPTL-8.8), IL (AG990-IL), FL (FDACS), MA (PC), WA (Char).
The skill does not produce these filings; if present, surface as an Open Question.

**Part VI — Governance, Management, and Disclosure:**
- Lines 1–19: answer each governance question
- Lines marked "if Yes, describe in Schedule O": create Schedule O placeholder entries

**Part VII — Compensation of Officers, Directors, Trustees, Key Employees, and
Highest-Compensated Employees:**
- **Section A** must include ALL of the following:
  - All officers, directors, and trustees — regardless of compensation level (list even if $0)
  - Key employees: any employee (not an officer/director/trustee) who (1) received >$150K
    in reportable comp from org + related orgs AND (2) had substantial authority over org
    programs, finances, management, or compensation decisions (IRC §4958 definition)
  - Five highest-compensated employees not already listed above who received >$100K from
    org + related orgs; if fewer than 5 qualify, list all who qualify
  - For each person: name, title, average hours/week, comp from org (column D), comp from
    related orgs (column E), estimated other comp (column F)
- **Section B:** five highest-compensated independent contractors who received >$100K
- Reportable compensation values must tie to W-2 Box 1 or 1099-NEC Box 1 (Q-F6 proxy)

**Part VIII — Statement of Revenue:**
- Lines 1a–12: copy from Statement of Activities aggregated by P3
- Lines are prefilled from `coa-mapping.csv` revenue aggregations

**Part IX — Statement of Functional Expenses:**
- Lines 1–25: copy from `functional-expense.csv` (all four columns)
- Confirm Part IX Line 25 Column A = Statement of Activities total expenses (Q-F2 proxy)

**Part X — Balance Sheet:**
- Lines 1–33: copy from `balance-sheet.md` (BOY + EOY columns)

**BOY reconciliation check (after Tiller BOY is read from balance-sheet.md):**

If `key_facts.prior_year_990_eoy_net_assets` is not null AND differs from Tiller BOY:
```
filed_eoy = key_facts.prior_year_990_eoy_net_assets
tiller_boy = <Tiller opening balance from balance-sheet.md>

1. Accept filed_eoy as the authoritative Part X BOY (override Tiller)
2. Auto-compute Part XI Line 9 prior-period adjustment:
   Assumptions (verify against IRS Form 990 Part XI instructions before implementing):
   - EOY_actual = current-year Part X Line 33 col B (EOY net assets — from
     key_facts.total_assets_eoy minus liabilities, or from dataset_core.json Part X)
   - revenue = Part VIII Line 12 col A (total revenue)
   - expenses = Part IX Line 25 col A (total expenses)
   - Formula: xi_adj = EOY_actual − (filed_eoy + revenue − expenses)
   - Sign convention: verify against IRS Form 990 Part XI instructions; a wrong sign
     would silently produce an incorrect Schedule O narrative
3. Pre-populate Schedule O narrative template:
   "During FY[prior], our bookkeeping system recorded beginning net assets of
   $[tiller_boy], which differed from the filed Form 990 ending net assets of
   $[filed_eoy] (a difference of $[filed_eoy − tiller_boy]). We have adjusted
   beginning net assets to match the filed return."
4. Record in Decision Log: "Part X BOY adjusted from Tiller $[tiller_boy] to
   filed prior year $[filed_eoy] — prior period adj $[xi_adj] in Part XI Line 9
   (source: [key_facts.prior_year_990_eoy_net_assets_source])"
```

If `prior_year_990_eoy_net_assets` is null: proceed with Tiller BOY, no adjustment.

**Part XI — Reconciliation of Net Assets:**
- Line 1: total revenue (Part VIII Line 12)
- Line 2: total expenses (Part IX Line 25)
- Line 3: revenue less expenses (lines 1−2)
- Line 4: net assets or fund balances at beginning of year (Part X Line 32 column A / BOY)
- Lines 5–8: adjustments (unrealized gains on investments, donated services, prior period
  adjustments, other named changes — see current-year 990 instructions for exact labels)
- Line 9: other changes in net assets or fund balances (catch-all adjustment line)
- Line 10: net assets or fund balances at end of year (must equal Part X Line 32 column B / EOY)

**Part XII — Financial Statements and Reporting:**
- Line 1: accounting method (cash/accrual/other)
- Lines 2a–2c: was the return audited / reviewed / compiled? (from audit_report artifact)
- Lines 3a–3c: audit committee questions

**Outputs.**
- `artifacts/form990-dataset-core.json` with shape:
  ```json
  {
    "parts": {
      "I": null,
      "II": { ... },
      "III": { ... },
      "IV": null,
      "V": { ... },
      "VI": { ... },
      "VII": { ... },
      "VIII": { ... },
      "IX": { ... },
      "X": { ... },
      "XI": { ... },
      "XII": { ... }
    },
    "schedule_dependencies": [ {"line": "IV.29", "schedule_letter": "B", "required": true}, ... ],
    "signature": { "officer_name": null, "officer_title": null, "date": null }
  }
  ```
  Part I is `null` — structural placeholder; `dataset_rollup` owns Part I content.
  Part IV is `null` — structural placeholder; Part IV yes/no answers are stored in
  `artifacts/part-iv-checklist.md` and `required_schedules[]`, not in dataset_core.json.
- Artifact registered: `artifacts.dataset_core.path`, `output_sha256`,
  `input_fingerprint` = the four upstream `output_sha256` values: statement_of_activities,
  balance_sheet, functional_expense, part_iv_checklist

**Idempotency.** Overwrite mode — `dataset_core.json` fully rewritten on re-run.

**Applicable Gates.** Q-F5 (W-2/1099 count ties — Gate 2; Open Question if payroll register
missing), Q-F6 (Part VII compensation ties to source docs), Q-F18 (Part III program
accomplishments substantive).

---

## P6 — Schedule Generation [PROG: Schedule A]

**Goal.** Produce every triggered schedule. Schedule A always; Schedule O nearly always.
P6 writes only `dataset_schedules.json` plus per-schedule markdown — never touches `dataset_core.json`.

> **Programmatic analysis required for Schedule A** (see Cross-Cutting Pattern above). The
> 509(a)(1) public-support test involves 5 years × multiple donor/revenue columns × excess-
> contribution exclusion arithmetic across donors — error-prone to compute inline. Apply the
> 4-step script pattern for Schedule A: write `artifacts/scripts/p6-schedule-a.py`, validate
> on 2 years of data as a sample fixture, then run the full 5-year window.

**Inputs.** `required_schedules[]`, `artifacts/form990-dataset-core.json` (read-only),
financial data, prior-year support data.

**Pre-check.**
- [→ verify_ancestors] `dataset_schedules` — Phase Entry Protocol calls `verify_ancestors()`
  on P6's output artifact, which transitively verifies `dataset_core` and all its ancestors
  (full upstream chain). Hash mismatches halt with ancestor-regression banner before Pre-check.
- Verify `required_schedules[]` non-empty (Schedule A at minimum)
- Verify SCHEDULES.md is readable (Read the file; if it returns an error, halt with
  "SCHEDULES.md missing or unreadable — P6 cannot dispatch to schedule playbooks")
- Verify 5 years of prior public-support data available for Schedule A (from prior 990 or
  user-entered); if missing, create Open Question for years 1–4

**Work.**

**B4 guard — halt on unknown schedule letter.** Before dispatching to any playbook, assert
every letter in `required_schedules[]` has a corresponding playbook section in SCHEDULES.md
(known set: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, R). If an unknown letter is present:
```
halt with breadcrumb: "required schedule <L> has no playbook — manual preparation required"
create Open Question: "Schedule <L> was triggered but has no automated playbook.
  Please prepare it manually and attach it to the return before P7."
```
Do NOT skip unknown letters silently — they represent triggered legal obligations.

Dispatch to SCHEDULES.md playbooks for each known letter in `required_schedules[]`.

**Schedule A (always — 501(c)(3) public charity):**
See SCHEDULES.md §Schedule-A for the full 5-year public-support worksheet.

> **⚠ PST tab warning:** A "Public Support Test" or similarly named tab in the client's
> spreadsheet (e.g., Tiller, QuickBooks export) typically tracks **current-year data only**
> — NOT the 5-year window required by IRS Schedule A. Do NOT read the PST tab and assume
> it contains multi-year Schedule A data. Instead, read each prior-year P&L tab directly
> (e.g., P&L Report 2024, P&L Report 2023, etc.) using the section-tracking exec pattern
> to extract each year's fundraising and PSR totals separately. The PST tab may be useful
> as a sanity check for the current year but is insufficient for the 5-year computation.

**Script: `artifacts/scripts/p6-schedule-a.py`**
- Input args: `--support-json <path>` (a JSON file with 5-year support history per donor,
  shape: `{years: [T-4..T], donors: [{name, year, amount}], totals: {year: {contributions,
  investment_income, other_revenue, program_service_revenue}}}`)
- Output: JSON with `{public_support_pct: float, result: "PASS"|"BORDERLINE"|"FAIL",
  test_used: "509a1"|"509a2", five_year_detail: [...], excess_contributions_by_year: {...},
  facts_and_circumstances_needed: bool, flags: [...]}`
- Sample fixture: `artifacts/scripts/fixtures/p6-schedule-a-sample.json` — use 2-year window
  with 3 donors (one clearly below 2% threshold, one right at it, one above) to verify
  excess-contribution exclusion logic before running the full 5-year dataset
- On BORDERLINE (10%–33⅓%): set `facts_and_circumstances_needed: true` and add a flag
  prompting the user to provide the Schedule A facts-and-circumstances narrative inputs

Algorithm sketch (509(a)(1)/§170(b)(1)(A)(vi)):
```
# IMPORTANT: Pre-compute the 5-yr total ONCE from the input data before the loop.
# two_pct_threshold is the SAME dollar amount for every year in the window
# (it uses the 5-year total denominator, not the single-year denominator).
five_yr_total_support = sum(total_support[y] for y in [T-4..T])
two_pct_threshold = 0.02 × five_yr_total_support   # same for all years in window

public_support = 0
for each year y in [T-4..T]:
  excess = sum(max(0, d.amount[y] − two_pct_threshold) for d in donors_in_year[y])
  public_support += contributions[y] − excess

public_support_pct = public_support / five_yr_total_support × 100
PASS if ≥ 33⅓%; or ≥ 10% with facts-and-circumstances narrative
```

**Schedule O (always):**
- Collect every Part VI "describe in Schedule O" placeholder from P5
- For each: draft a narrative with the user or from governance documents
- Include: functional expense allocation methodology (Q-F17)

**Schedule B (if triggered):**
- Collect donor names, amounts, addresses from `donor_list` artifact
- Emit two files:
  - `artifacts/schedule-b-filing.md` — full names + addresses + amounts (IRS-only per IRC §6104(d)(3)(A))
  - `artifacts/schedule-b-public.md` — `"Anonymous"` for names, addresses stripped, amounts kept
- Both registered in machine state with appropriate `confidentiality` tags
- `.gitignore` entry verified for `schedule-b-filing.md`

**Other triggered schedules (D, G, L, M, R):** See SCHEDULES.md for per-schedule playbooks.

**Outputs.**
- `artifacts/schedule-<letter>.md` per required schedule
- `artifacts/schedule-o-narratives.md`
- `artifacts/form990-dataset-schedules.json` with shape:
  ```json
  { "schedules": { "A": {...}, "B": {...}, "O": {...}, ... } }
  ```
- All artifacts registered in machine state
- `artifacts.dataset_schedules.input_fingerprint` = `{dataset_core.output_sha256}`

**Idempotency.** Overwrite mode — `dataset_schedules.json` + all `schedule-<letter>.md`
files rewritten. Schedules removed from `required_schedules[]` between runs have their stale
artifacts explicitly deleted (tracked via manifest inside `dataset_schedules.json`).

**Applicable Gates.** Q-F4 (Schedule A computation), Q-F8 (all required schedules present),
Q-F14 (Schedule O covers all Part VI "describe" prompts).

---

## P7 — Part I Rollup & Reconciliation + Deterministic Merge

**Goal.** Compute Part I from Parts VIII/IX/X; verify the big square closes; run the
deterministic merger to produce the consumable `form990-dataset.json`.

**Inputs.** `dataset_core.json`, `dataset_schedules.json`.

**Pre-check.**
- [→ verify_ancestors] `dataset_rollup`, `dataset_merged` — Phase Entry Protocol calls
  `verify_ancestors()` on P7's output artifacts, transitively verifying `dataset_core`,
  `dataset_schedules`, and their full upstream chain. Hash mismatches halt before Pre-check.
- Verify Part VIII Line 12, Part IX Line 25, Part X Line 32 (EOY), Part X Line 32 (BOY)
  are all present and non-null in `dataset_core.json` (content check, not hash check)

**Work.**

**Step 1: Rollup.**
```
Part I Line 8  = dataset_core.parts.VIII["line_1h_total_contributions"]
Part I Line 12 = dataset_core.parts.VIII["line_12_total_revenue"]
Part I Line 18 = dataset_core.parts.IX["line_25_total_expenses"]
Part I Line 22 = dataset_core.parts.X["line_32_eoy_net_assets"]
```
Compute `reconciliation` using THREE SEPARATE CHECKS (not a single equality chain —
see Q-F2 for rationale). Revenue − Expenses ≠ EOY − BOY when adjustment lines are non-zero:
```
revenue_total    = Part I Line 12  (= dataset_core.parts.VIII["line_12_total_revenue"])
expense_total    = Part I Line 18  (= dataset_core.parts.IX["line_25_total_expenses"])
net_assets_boy   = dataset_core.parts.X["line_32_boy_net_assets"]
net_assets_eoy   = Part I Line 22  (= dataset_core.parts.X["line_32_eoy_net_assets"])
part_xi_line3    = dataset_core.parts.XI["line_3_excess_deficit"]
part_xi_line4    = dataset_core.parts.XI["line_4_net_assets_boy"]
part_xi_line10   = dataset_core.parts.XI["line_10_net_assets_eoy"]

line3_check  = abs(part_xi_line3 − (revenue_total − expense_total)) <= 1
boy_check    = abs(part_xi_line4 − net_assets_boy) <= 1
eoy_check    = abs(part_xi_line10 − net_assets_eoy) <= 1
delta_match  = line3_check and boy_check and eoy_check
```
Write `artifacts/form990-dataset-rollup.json`:
```json
{
  "parts": {"I": {"line_8": ..., "line_18": ..., "line_22": ...}},
  "reconciliation": {
    "revenue_total": ..., "expense_total": ...,
    "net_assets_boy": ..., "net_assets_eoy": ...,
    "line3_check": true|false, "boy_check": true|false, "eoy_check": true|false,
    "delta_match": true|false,
    "sources": {
      "part_xi_line3":  "dataset_core.parts.XI.line_3_excess_deficit",
      "part_xi_line4":  "dataset_core.parts.XI.line_4_net_assets_boy",
      "part_xi_line10": "dataset_core.parts.XI.line_10_net_assets_eoy"
    },
    "note": "delta_match=true requires all three sub-checks to pass. line3_check (Part XI Line 3 = Revenue − Expenses) is definitional and should always hold. If adjustment lines 5–9 are non-zero, EOY − BOY will not equal Revenue − Expenses — that is expected and correct, not a failure."
  }
}
```
Emit `artifacts/reconciliation-report.md` with each check shown step by step.
If any check fails by > $1: breadcrumb the discrepancy with the specific check name,
flag Q-F2 NEEDS_UPDATE inline, do NOT advance to merge sub-phase until resolved.

**Step 2: Deterministic merge (P7-merge sub-phase).**
Run `SKILL.md §merge_datasets()` with the three sibling paths:
```
merge_datasets(
  core_path      = artifacts/form990-dataset-core.json,
  schedules_path = artifacts/form990-dataset-schedules.json,
  rollup_path    = artifacts/form990-dataset-rollup.json,
  output_path    = artifacts/form990-dataset.json
)
```
On `merger_conflict` error: HALT, surface the contested key name, ask user to resolve.
On success: register `artifacts.dataset_merged` with `output_sha256` returned by `merge_datasets()`.

**Outputs.**
- `artifacts/form990-dataset-rollup.json`
- `artifacts/form990-dataset.json` (the merged union — sole downstream-readable dataset)
- `artifacts/reconciliation-report.md`
- All three registered in machine state with `output_sha256` + `input_fingerprint`:
  - `dataset_rollup.input_fingerprint` = `{dataset_core: <sha>}`
  - `reconciliation_report.input_fingerprint` = `{dataset_core: <sha>}`
  - `dataset_merged.input_fingerprint` = `{dataset_core: <sha>, dataset_schedules: <sha>, dataset_rollup: <sha>}`

**Idempotency.** Overwrite mode — all three fully rewritten. Merger is pure function;
same inputs → byte-identical output (E3 verified).

**Applicable Gates.** Q-F2 (big square closes — blocking; delta_match must be true), Q-F7
(Part I ties to downstream parts).

---

## P8 — CPA Quality Review Pass

**Goal.** Run the full Q-F1..Q-F18 catalog with the CPA Reviewer persona. Convergence loop
with max 5 passes. Gate-1 unresolved after 5 passes → halt + AskUserQuestion.

**Inputs.** Everything: all prior artifacts, key facts, all phase outputs.

**Pre-check.**
- [→ verify_ancestors] `cpa_review_report` — Phase Entry Protocol calls `verify_ancestors()`
  on P8's output artifact, which transitively verifies `dataset_merged`, `reconciliation_report`,
  and their full upstream chain (including `dataset_core`, `dataset_schedules`, `dataset_rollup`).
  Any hash mismatch (including a stale `reconciliation_report`) halts before Pre-check.
- Verify Part I is populated (not null) in `dataset_merged` (content check)
- Verify all `required_schedules[]` have corresponding schedule artifacts in `dataset_schedules`

**Work.**

```
pass = 0
memoized = {}

while pass < 5:
    evaluate Q-F1..Q-F18 applicable to current state (CPA Reviewer persona)
    update gate_results_latest_pass, increment gate_pass_count

    for each NEEDS_UPDATE:
        apply [EDIT: …] directive → route back to offending phase
        set phase_status[offending_phase] = "pending"
        re-run the offending phase (call PHASES.md §P<n>)
        re-verify its outputs

    gate1_unresolved = count of Gate-1 questions with NEEDS_UPDATE
    if gate1_unresolved == 0 and no changes this pass:
        break  # converged
    pass += 1

if pass == 5 and gate1_unresolved > 0:
    HALT
    print remaining Gate-1 issues
    AskUserQuestion to resolve or accept risk
```

Memoization: Gate-2/3 items stable across 2 consecutive passes → auto-memoize for pass 3+.
Gate-1 items never memoized.

Write `artifacts/cpa-review-report.md` with full Q-F results after each pass.

**Outputs.**
- `artifacts/cpa-review-report.md` (updated each pass)
- Machine state `gate_results_latest_pass` updated
- `gate_pass_count` incremented per pass

**Idempotency.** Overwrite mode for CPA report (each pass rewrites it).

**Applicable Gates.** N/A — P8 IS the gate pass.

**Transition.** All Gate-1 PASS → P9.

---

## P9 — Reference PDF Fill + E-file Handoff Packet

**Goal.** Fetch the current-year Form 990 PDF, fill it as a reference artifact, assemble
the e-file handoff packet.

**Inputs.** `form990-dataset.json` (merged), CPA review report, schedules, statements.

**Pre-check.**
- [→ verify_ancestors] `reference_pdf`, `efile_handoff` — Phase Entry Protocol calls
  `verify_ancestors()` on P9's output artifacts, transitively verifying `dataset_merged`,
  `cpa_review_report`, and their full upstream chain. Any hash mismatch halts before Pre-check.
- Verify `gate_results_latest_pass` shows zero Gate-1 NEEDS_UPDATE from P8
- Verify `pdftk-java` (preferred fallback) or `pypdf` available:
  - Primary: `python3 -c "import pypdf; print(pypdf.__version__)"` — must succeed
  - Fallback: `which pdftk-java && pdftk-java --version`
  - If neither: halt and instruct user to `pip install pypdf`
- **Coordinate table staleness check:** slice TOOL-SIGNATURES.md between `<!-- BEGIN COORDINATES <tax_year> -->` /
  `<!-- END COORDINATES <tax_year> -->` sentinels, sha256 the slice, compare to
  `artifacts.reference_pdf.input_fingerprint.coordinate_table` (if set from prior run).
  If absent: warn "coordinate table not yet captured — run Pre-build Verification step 3a" and halt.
  If mismatch: set `artifacts.reference_pdf.status = "absent"` and re-fill. Ensures the
  coordinate overlay always matches the current PDF coordinate spec.
- **Pre-flight network check (5s bound):** before the 30s fetch, run a tiny HEAD-equivalent
  fetch to irs.gov; if it fails, halt and offer `--local-pdf <path>`

**Work.**

**Step 1: Fetch or reuse cached blank PDF.**
- Check cache: `artifacts/f990-blank-<tax_year>.pdf`
- If present: verify embedded revision date matches `tax_year`; if mismatch → halt + ask user
- If absent: `WebFetch https://www.irs.gov/pub/irs-pdf/f990.pdf` with 30s deadline;
  on failure → retry once with 5s backoff → if still fails → halt with user-friendly banner (C3):
  ```
  Couldn't reach irs.gov to download the blank Form 990 PDF.
  Options:
    (1) Check your internet connection and try again
        → run: /form990 resume <plan-path>
    (2) Download the blank form yourself and provide it:
        → visit https://www.irs.gov/pub/irs-pdf/f990.pdf to download
        → then re-run with: /form990 resume <plan-path> --local-pdf <path-to-downloaded-file>
  ```
- Save to cache path on first fetch

**Step 1a: Enumerate AcroForm fields (capability probe).**
```python
import pypdf
reader = pypdf.PdfReader('artifacts/f990-blank-<tax_year>.pdf')
field_count = len(reader.get_fields() or {})
```
- `field_count == 0` (expected for recent flat PDFs) → proceed to Step 2 (coordinate overlay)
- `field_count > 0` (rare, older or special revision) → log breadcrumb, attempt Step 2a first

**Step 2: Primary fill path — coordinate overlay.**
Using `pypdf`, render a flat annotation layer over the blank PDF at line coordinates from
`TOOL-SIGNATURES.md §f990 Coordinate Table`. If the coordinate table is absent: halt.
Shell-safety: all values flow through the Python API — no shell concatenation.
UTF-8 preserved; control characters stripped; NUL bytes rejected.

**Step 2a: Fallback fill path — AcroForm name-based (only if field_count > 0).**
Use `pdftk-java` with an FDF intermediate file written through a library (not hand-concatenated).
On `pdftk-java` non-zero exit: capture stderr to breadcrumb, fall through to Step 2.

**Step 3: Assemble e-file handoff packet.**
Write `artifacts/efile-handoff-packet.md` with:
- "What to do with these files" instructions
- E-file provider list (fetch live from IRS page; fallback to template if fetch fails)
- Import guidance for each major provider
- Signature/date requirements (who signs, officer title, due date)
- Disambiguation: TaxBandits / Tax990 / ExpressTaxExempt are all SPAN Enterprises products
- Disclaimer: "Verify current IRS-authorized status at the official IRS provider page before use"
- Fill all template placeholders before writing:
  - `{{LEGAL_NAME}}`: `key_facts.legal_name`
  - `{{YYYY}}`: `key_facts.tax_year`
  - `{{DATE}}`: today's date (packet preparation date)
  - `{{FISCAL_YEAR_START}}`: `key_facts.fiscal_year_start`
  - `{{FISCAL_YEAR_END}}`: `key_facts.fiscal_year_end`
  - `{{ORIGINAL_DUE_DATE}}`: if `fiscal_year_end` is Dec 31 → May 15 of (`tax_year` + 1);
    else → 4.5 calendar months after `fiscal_year_end` (round to nearest day)
  - `{{EXTENDED_DUE_DATE}}`: `ORIGINAL_DUE_DATE` + 6 months (Form 8868 automatic extension)

**Step 4: Schedule B two-output contract (if Schedule B triggered).**
- `artifacts/schedule-b-filing.md` — full donor info (IRS-only, never public)
- `artifacts/schedule-b-public.md` — `"Anonymous"` names, addresses stripped
- Handoff packet names both files and specifies which audience each serves
- Verify `schedule-b-filing.md` is in `.gitignore`

**Outputs.**
- `artifacts/form990-reference-filled.pdf`
  - `reference_pdf.input_fingerprint` = `{dataset_merged: <sha>, blank_pdf: <sha-of-cached-blank>, coordinate_table: <sha-of-TOOL-SIGNATURES.md-coordinates-section>}`
  - `blank_pdf` sha: sha256 of `artifacts/f990-blank-<tax_year>.pdf`
  - `coordinate_table` sha: sha256 of TOOL-SIGNATURES.md bytes between `<!-- BEGIN COORDINATES <year> -->` / `<!-- END COORDINATES <year> -->` sentinels
- `artifacts/efile-handoff-packet.md`
- `artifacts/schedule-b-filing.md` + `artifacts/schedule-b-public.md` (if Schedule B triggered)

**Idempotency.**
- Blank PDF cache prevents redundant fetches
- Re-fill overwrites `form990-reference-filled.pdf`
- Handoff packet overwritten on re-run

**Applicable Gates.** Q-F15 (signature block populated in dataset before filling PDF).

**Transition.** Done. Print completion banner. See Post-Run Review section below; print the prompt box to the operator before closing the session.

---

## Completion Banner

```
╔══════════════════════════════════════════════════════════════════════╗
║  ★ Form 990 Preparation Complete — {{LEGAL_NAME}} — FY {{YYYY}}     ║
╚══════════════════════════════════════════════════════════════════════╝

  Artifacts produced:
  ├─ artifacts/form990-dataset.json          (line-keyed answers — e-file input)
  ├─ artifacts/form990-reference-filled.pdf  (reference PDF for board/CPA review)
  ├─ artifacts/schedule-o-narratives.md      (paste into e-file provider)
  ├─ artifacts/cpa-review-report.md          (pre-signature review)
  └─ artifacts/efile-handoff-packet.md       (hand to your e-file provider)

  ⚠ This return has NOT been filed. Next steps:
    1. Have the signing officer review the filled reference PDF
    2. Give the handoff packet to a Form 990-authorized e-file provider
    3. The officer signs and the provider transmits via IRS MeF

  Filing deadline for calendar-year returns: May 15 (+ 6-month extension via Form 8868)
```

---

## Post-Run Review (P9 closing step — operator performs before closing session)

After printing the Completion Banner, prompt the operator with:

```
╔══════════════════════════════════════════════════════════════╗
║  Post-Run Review — capture learnings before you close        ║
╠══════════════════════════════════════════════════════════════╣
║  1. Did this run reveal any skill gaps? If yes, add a task   ║
║     to form990-skill-todo.md under one of:                   ║
║       (a) new quality gate needed                            ║
║       (b) phase improvement (wrong prompt / missing check)   ║
║       (c) data-source handling (new source type encountered) ║
║       (d) error pattern (unexpected input or edge case)      ║
║                                                              ║
║  2. Were any unexpected org-specific decisions made that      ║
║     future runs should know about? If yes, append to         ║
║     LEARNINGS.md with date + phase + finding.               ║
║                                                              ║
║  3. Review NEEDS_UPDATE examples in QUESTIONS.md for         ║
║     org-specific details that crept in during this run       ║
║     (vendor names, donor names, real dollar amounts that      ║
║     could identify the org). Replace with generic stand-ins  ║
║     (e.g., "Acme Services LLC") before closing the run.      ║
╚══════════════════════════════════════════════════════════════╝
```

This is a **manual operator prompt** — not automated. The operator decides what to record.
No AskUserQuestion required. Print and continue to session close.

---

## TODO — Skill Improvements from FY2025 Live Run (2026-04-15)

The following improvements were identified during the first full FY2025 live run against Fortified Strength Inc. Each item is a concrete change to a specific phase or gate.

### P2 — Chart of Accounts Mapping

**TODO-P2-1:** Read the Tiller `Categories` tab explicitly in the P2 Work block. The `Group` field on that tab defines the Program/M&G/Fundraising allocation for each category. Do not infer functional allocation from P&L labels alone — the Group field is the authoritative allocation source.

**TODO-P2-2:** Add a special-case rule for Merchandise Revenue: even if Tiller places it in the Fundraising income group, it maps to Part VIII Line 10 (gross sales of inventory), not Line 1 (contributions). Prompt the user to confirm the COGS amount (from the `Merchandise Sales Inventory` expense line).

**TODO-P2-3:** When a negative income line is encountered (e.g., a reversal/refund in an income category), ask the user: "This appears to be a reversal of prior income. Which Part VIII line does this reduce? Options: (a) Line 1 contributions, (b) Line 2 PSR, (c) Line 11 other revenue." Do not auto-commit a classification.

### P3 — Financial Statement Production

**TODO-P3-1:** Add a blocking Pre-check flag: "Tiller captures net payroll (take-home amounts). Part IX Line 7 requires W-2 Box 1 gross wages. Please provide the Gusto Payroll Journal Report or equivalent before proceeding." Do not populate Part IX Line 7 from Tiller payroll lines.

**TODO-P3-2:** Add a blocking Pre-check flag: "Tiller captures combined payroll tax deposits (employer + employee). Part IX Line 10 requires employer-only FICA/FUTA. Please provide the Gusto employer taxes summary." Do not populate Part IX Line 10 from Tiller payroll tax lines.

**TODO-P3-3:** Document the merchandise COGS accounting rule explicitly: "Merchandise COGS shown in Tiller expense total must be EXCLUDED from Part IX and reported only in Part VIII Line 10b. Part VIII Line 12 (total revenue) ≠ Tiller total income by exactly the COGS amount."

### P5 — Core Parts

**TODO-P5-1:** Part X liability pre-check: Read the balance sheet's LIABILITY section from Tiller (or the net worth report) before setting Part X to $0 liabilities. Credit card balances on personal cards used for org expenses are real liabilities.

**TODO-P5-2:** Part III program accomplishments — add explicit prompts:
  1. "How many individual athletes/students were enrolled on average during the year?"
  2. "What is the weekly class schedule (days + hours)? How many weeks did you operate?"
  3. From those answers, compute: `hours = (weekly_hours × operating_weeks) − individual_holiday_hours`
  4. "Were any new program services launched this year (not offered in prior years)?"
  5. "Did any athletes achieve notable competitive accomplishments (national team selections, championship placements)?"

### P7 — Reconciliation

**TODO-P7-1:** After computing Part XI Line 9 (other changes), check: if `abs(Line 9) < $500`, log "Prior period adjustment is negligible ($X) — likely rounding. No Schedule O narrative required unless CPA requests it." Only generate a Schedule O narrative if `abs(Line 9) >= $500`.

**TODO-P7-2:** Add a re-check if the user updates the Tiller P&L mid-session: "P&L figures have been updated. Running structured diff of old vs new totals: Revenue Δ={}, Expenses Δ={}, Net Δ={}. Re-running Part VIII/IX/XI calculations."

### P8 — Quality Review

**TODO-P8-1:** Q-F18 (program accomplishments) — add explicit checklist:
  - [ ] Headcount (# of persons served) stated
  - [ ] Hours of service delivered stated or computable from schedule
  - [ ] Specific competitions/events named (not just "national competitions")
  - [ ] Any Team USA / national selection achievements included
  - [ ] New program services (Part III Line 2) flagged if applicable

**TODO-P8-2:** Add a new advisory check: if Part III Line 2 (new programs) = false but any V2MOM or board minutes mention "new for this year" or "launching" a program, flag for user confirmation.

### P9 — PDF Fill

**TODO-P9-1:** The 2025 f990.pdf is an XFA form with 1,307 AcroForm fields. The XFA template stream (array item 5 of the `/XFA` key) contains `<assist><speak>` labels for each field. Extract these via regex to build the `f990-field-map-YYYY.json` coordinate table. Cache this per tax year in `TOOL-SIGNATURES.md §form990_field_map`.

**TODO-P9-2:** Fill sequence: short field name `f1_28` maps to full XFA path ending in `.f1_28[0]`. Use `short_to_full[f"{short}[0]"]` lookup. Do not use `.endswith(f'.{short}')` — this fails for XFA nested paths.

**TODO-P9-3:** Add the `cpa-memo-fy2025.md` artifact to the P9 output list alongside `efile-handoff-packet.md`. The CPA memo is a distinct deliverable from the handoff packet (audience: CPA; handoff packet audience: e-file provider).

### General

**TODO-GEN-1:** When re-reading a Tiller PDF export mid-session, immediately compute and display the diff against the current dataset values before making any changes. Format: "Revenue: $X → $Y (+$Z), Expenses: $A → $B (ΔC), Net: ...". This prevents silent partial updates.

**TODO-GEN-2:** Net worth PDF and P&L are linked in Tiller. If user says "I updated the P&L," always ask: "Did the net worth/balance sheet also update? The EOY net assets figure may have changed." Re-read both before updating the dataset.

