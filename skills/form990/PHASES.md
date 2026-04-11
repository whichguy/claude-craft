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
- Scripts run via Bash tool: `python3 artifacts/scripts/<script>.py <args>`

---

## P0 — Intake & Variant Routing

**Goal.** Identify the organization, determine gross receipts / total assets, select the
correct 990 variant, and write all key facts into machine state.

**Inputs.** `--sheet` (Google Sheets ID or URL), `--tax-year` (YYYY), prior 990 if
available (prompt user), prior-2 and prior-3 year gross receipts (for 3-yr averaging).

**Pre-check.**
- Verify `--sheet` ID/URL is accessible: call `mcp__claude_ai_Google_Drive__read_file_content`
  with the sheet ID; on permission/not-found error → halt with "verify sheet ID and sharing"
- Verify `--tax-year` is a 4-digit year ≤ current year
- Verify invocation cwd is writable (for plan file creation)
- Ask the user: is this organization a church, association of churches, or integrated auxiliary
  per IRC §6033(a)(3)(A)(i)? (yes/no)
- Ask the user: is this organization a private foundation? (yes/no — or check prior 990 Part I)

**Work.**
1. Pull sheet tab list via Drive MCP (`read_file_content` → tab list); ask for: EIN, legal
   name, fiscal year start/end, accounting method, public charity basis
2. Capture gross-receipts history: current year + prior-1 + prior-2 (from prior 990 or user
   input). Compute `gross_receipts_3yr_average = (yr_current + yr_prior1 + yr_prior2) / 3`
3. Run variant decision tree (verbatim — do not paraphrase):
   ```
   IF is_private_foundation:
       variant = HALTED-PF
   ELIF is_church_or_6033a3_exempt:
       variant = HALTED-CHURCH
   ELIF gross_receipts_3yr_average <= 50000:
       variant = 990-N
   ELIF gross_receipts_current < 200000 AND total_assets_eoy < 500000:
       variant = 990-EZ           ← CONJUNCTIVE; both prongs required
   ELSE:
       variant = 990
   ```
4. Record the specific threshold comparison in the Decision Log (e.g.,
   `"GR $210k ≥ $200k → full 990"` or
   `"GR $180k < $200k AND TA $650k ≥ $500k → full 990 (total-assets prong failed)"`)
5. Write `key_facts`: legal_name, ein, fiscal_year_start/end, accounting_method,
   gross_receipts_current, gross_receipts_3yr_average, total_assets_eoy, public_charity_basis,
   form_variant
6. If `variant == HALTED-PF`:
   - Write terminal breadcrumb: `"Halted: private foundation — file Form 990-PF (out of scope)"`
   - Render halt banner:
     ```
     ╔══════════════════════════════════════════════════╗
     ║  ✖ HALTED — Private Foundation                   ║
     ║  Form 990-PF required. This skill covers only    ║
     ║  Form 990, 990-EZ, and 990-N.                    ║
     ║  Contact a CPA specializing in 990-PF returns.   ║
     ╚══════════════════════════════════════════════════╝
     ```
   - Stop; do not advance to P1
7. If `variant == HALTED-CHURCH`:
   - Write terminal breadcrumb: `"Halted: IRC §6033(a)(3)(A)(i) exempt — no 990 required"`
   - Render halt banner with appropriate message
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
   ├─ 1099_register     (if contractors paid ≥ $600)
   ├─ donor_list        (if Schedule B may be triggered)
   ├─ board_roster      (for Part VI and Part VII)
   ├─ bylaws            (for Part VI governance questions)
   ├─ coi_policy        (conflict-of-interest, for Part VI Line 12a)
   └─ audit_report      (if GR ≥ $750K or required by major funder)
   ```
5. For each missing artifact: create an Open Question. If addressed to an external party,
   create a Gmail draft via `gmail_create_draft` using `templates/email-question.md`:
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
- If 100 < rows ≤ 500: plan batch reads in chunks of 100 with progress breadcrumbs

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
| Other salaries / wages | Line 7 |
| Pension / retirement contributions | Line 8 |
| Other employee benefits | Line 9 |
| Payroll taxes | Line 10 |
| Legal fees | Line 11a |
| Accounting / auditing fees | Line 11b |
| Lobbying fees | Line 11c |
| Professional fundraising | Line 11d |
| Management / IT consulting | Line 11f |
| Other fees for services | Line 11g |
| Advertising / promotion | Line 12 |
| Office expenses / supplies | Line 13 |
| Information technology | Line 14 |
| Royalties | Line 15 |
| Occupancy / rent | Line 16 |
| Travel | Line 17 |
| Conferences / meetings | Line 19 |
| Interest expense | Line 20 |
| Depreciation / amortization | Line 22 |
| Insurance | Line 23 |
| All other expenses | Line 24 (a–e) |

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
  Open Question: "Does Fortified Strength have a policy to record donated services?
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

**Transition.** → P3.

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
- Verify `artifacts.coa_mapping.output_sha256` matches fresh sha256 of on-disk file
  (mismatch → regression per Resume Protocol step 5; roll back P2 and re-execute)
- Verify `coa-mapping.csv` exists and contains all required columns
- Verify zero rows with empty `mapped_line` (Q-F18 proxy — all rows must be mapped)
- Verify at least one row per functional bucket or explicitly N/A

**Work.**

**Script: `artifacts/scripts/p3-financial-statements.py`**
- Input args: `--coa-csv artifacts/coa-mapping.csv`, `--balance-sheet-csv <path>` (if
  balance-sheet accounts are in a separate tab)
- Output: JSON with `{statement_of_activities: {...}, balance_sheet: {boy: {...}, eoy: {...}},
  functional_expense: {rows: [...], column_check_pass: true|false}, flags: [...]}`
- Sample fixture: `artifacts/scripts/fixtures/p3-sample.json` (10 mapped rows: at least 3
  Part IX expense lines with functional splits, 2 Part VIII revenue lines, and 1 balance-sheet
  account pair BOY/EOY)
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

**Transition.** → P4.

---

## P4 — Part IV Checklist → Schedule Trigger

**Goal.** Walk every Part IV yes/no question to determine which schedules attach.

**Inputs.** Financial statements from P3, key facts, governance docs from P1.

**Pre-check.**
- Verify P3 three statements exist and `output_sha256` for each matches fresh hash
- Verify `artifacts.statement_of_activities.output_sha256`, `artifacts.balance_sheet.output_sha256`,
  `artifacts.functional_expense.output_sha256` all match fresh hashes of on-disk files
- Verify governance docs (bylaws, coi_policy, board_roster) present in `artifacts[]` or
  flagged as pending open question

**Work.**
1. Read the current-year f990.pdf Part IV section (runtime enumeration — do NOT hard-code
   question count; IRS revises it across years). Enumerate all yes/no questions.
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

**Applicable Gates.** Q-F4 (Schedule A always present for 501(c)(3)), Q-F8 (all questions
answered, all yes → schedule present).

**Transition.** → P5.

---

## P5 — Core Parts (III, V, VI, VII, VIII, IX, X, XI, XII)

**Goal.** Fill every core-form line into `dataset_core.json`. Part I is declared as a
structural placeholder (null) — populated by P7.

**Inputs.** Statements from P3, Part IV answers from P4, governance docs from P1.

**Pre-check.**
- Verify `artifacts.statement_of_activities.output_sha256` matches fresh hash
- Verify `artifacts.balance_sheet.output_sha256` matches fresh hash
- Verify `artifacts.functional_expense.output_sha256` matches fresh hash
- Verify `artifacts.part_iv_checklist.output_sha256` matches fresh hash
- Any mismatch → regression per Resume Protocol step 5 → roll back producing phase
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
- Lines 3–13: answer each governance/compliance question

**Part VI — Governance, Management, and Disclosure:**
- Lines 1–19: answer each governance question
- Lines marked "if Yes, describe in Schedule O": create Schedule O placeholder entries

**Part VII — Compensation of Officers, Directors, Trustees, Key Employees:**
- Section A: list every officer, director, trustee by name + title + hours/week + compensation
- Section B: five highest-compensated independent contractors (if applicable)
- Compensation values must tie to W-2 Box 1 or 1099-NEC Box 1 (Q-F6 proxy)

**Part VIII — Statement of Revenue:**
- Lines 1a–12: copy from Statement of Activities aggregated by P3
- Lines are prefilled from `coa-mapping.csv` revenue aggregations

**Part IX — Statement of Functional Expenses:**
- Lines 1–25: copy from `functional-expense.csv` (all four columns)
- Confirm Part IX Line 25 Column A = Statement of Activities total expenses (Q-F2 proxy)

**Part X — Balance Sheet:**
- Lines 1–33: copy from `balance-sheet.md` (BOY + EOY columns)

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
- Artifact registered: `artifacts.dataset_core.path`, `output_sha256`,
  `input_fingerprint` = all four upstream `output_sha256` values + `part_iv_checklist` sha

**Idempotency.** Overwrite mode — `dataset_core.json` fully rewritten on re-run.

**Applicable Gates.** Q-F5 (W-2/1099 count ties — Gate 2; Open Question if payroll register
missing), Q-F6 (Part VII compensation ties to source docs), Q-F18 (Part III program
accomplishments substantive).

**Transition.** → P6.

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
- Verify `required_schedules[]` non-empty (Schedule A at minimum)
- Verify `artifacts.dataset_core.output_sha256` matches fresh hash of `dataset_core.json`
  (mismatch → regression → roll back P5)
- Verify 5 years of prior public-support data available for Schedule A (from prior 990 or
  user-entered); if missing, create Open Question for years 1–4

**Work.**

Dispatch to SCHEDULES.md playbooks for each schedule in `required_schedules[]`.

**Schedule A (always — 501(c)(3) public charity):**
See SCHEDULES.md §Schedule-A for the full 5-year public-support worksheet.

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
For each year in 5-yr window:
  two_pct_threshold = 0.02 × sum(total_support[T-4..T])   # 2% of 5-yr total support
  public_support += contributions − sum(max(0, d.amount − two_pct_threshold) for d in donors)
  total_support  += contributions + investment_income + other_revenue

public_support_pct = public_support / total_support × 100
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

**Transition.** → P7.

---

## P7 — Part I Rollup & Reconciliation + Deterministic Merge

**Goal.** Compute Part I from Parts VIII/IX/X; verify the big square closes; run the
deterministic merger to produce the consumable `form990-dataset.json`.

**Inputs.** `dataset_core.json`, `dataset_schedules.json`.

**Pre-check.**
- Verify `artifacts.dataset_core.output_sha256` matches fresh hash
- Verify `artifacts.dataset_schedules.output_sha256` matches fresh hash
- Any mismatch → regression → roll back the producing phase (P5 or P6)
- Verify Part VIII Line 12, Part IX Line 25, Part X Line 32 (EOY), Part X Line 32 (BOY)
  are all present and non-null in `dataset_core.json`

**Work.**

**Step 1: Rollup.**
```
Part I Line 8  = dataset_core.parts.VIII["line_12_total_revenue"]
Part I Line 18 = dataset_core.parts.IX["line_25_total_expenses"]
Part I Line 22 = dataset_core.parts.X["line_32_eoy_net_assets"]
```
Compute `reconciliation`:
```
revenue_total  = Part I Line 8
expense_total  = Part I Line 18
net_assets_boy = dataset_core.parts.X["line_32_boy_net_assets"]
net_assets_eoy = Part I Line 22
delta_match    = (revenue_total − expense_total) == (net_assets_eoy − net_assets_boy)
```
Write `artifacts/form990-dataset-rollup.json`:
```json
{
  "parts": {"I": {"line_8": ..., "line_18": ..., "line_22": ...}},
  "reconciliation": {"revenue_total": ..., "expense_total": ...,
                     "net_assets_boy": ..., "net_assets_eoy": ...,
                     "delta_match": true|false}
}
```
Emit `artifacts/reconciliation-report.md` with the arithmetic shown step by step.
If `delta_match == false`: breadcrumb the discrepancy, flag Q-F2 NEEDS_UPDATE inline,
do NOT advance to merge sub-phase until resolved.

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
- All three registered in machine state with `output_sha256` + `input_fingerprint`

**Idempotency.** Overwrite mode — all three fully rewritten. Merger is pure function;
same inputs → byte-identical output (E3 verified).

**Applicable Gates.** Q-F2 (big square closes — blocking; delta_match must be true), Q-F7
(Part I ties to downstream parts).

**Transition.** → P8.

---

## P8 — CPA Quality Review Pass

**Goal.** Run the full Q-F1..Q-F18 catalog with the CPA Reviewer persona. Convergence loop
with max 5 passes. Gate-1 unresolved after 5 passes → halt + AskUserQuestion.

**Inputs.** Everything: all prior artifacts, key facts, all phase outputs.

**Pre-check.**
- Verify `artifacts.dataset_merged.output_sha256` matches fresh hash of `form990-dataset.json`
- Verify Part I is populated (not null) in `dataset_merged`
- Verify `artifacts/reconciliation-report.md` present
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
- Verify `gate_results_latest_pass` shows zero Gate-1 NEEDS_UPDATE from P8
- Verify `artifacts.dataset_merged.output_sha256` matches fresh hash of `form990-dataset.json`
- Verify `pdftk-java` (preferred fallback) or `pypdf` available:
  - Primary: `python3 -c "import pypdf; print(pypdf.__version__)"` — must succeed
  - Fallback: `which pdftk-java && pdftk-java --version`
  - If neither: halt and instruct user to `pip install pypdf`
- Verify Python interpreter version matches TOOL-SIGNATURES.md pin:
  ```python
  import sys
  if sys.version_info[:2] != PINNED_PYTHON_VERSION:
      print(f"⚠ Python drift: pinned {PINNED_PYTHON_VERSION}, running {sys.version_info[:2]}")
  ```
- **Pre-flight network check (5s bound):** before the 30s fetch, run a tiny HEAD-equivalent
  fetch to irs.gov; if it fails, halt and offer `--local-pdf <path>`

**Work.**

**Step 1: Fetch or reuse cached blank PDF.**
- Check cache: `artifacts/f990-blank-<tax_year>.pdf`
- If present: verify embedded revision date matches `tax_year`; if mismatch → halt + ask user
- If absent: `WebFetch https://www.irs.gov/pub/irs-pdf/f990.pdf` with 30s deadline;
  on failure → retry once with 5s backoff → if still fails → halt and request `--local-pdf`
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
`SKILL.md §form990_coordinates_<tax_year>`. If the coordinate table is absent: halt.
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

**Step 4: Schedule B two-output contract (if Schedule B triggered).**
- `artifacts/schedule-b-filing.md` — full donor info (IRS-only, never public)
- `artifacts/schedule-b-public.md` — `"Anonymous"` names, addresses stripped
- Handoff packet names both files and specifies which audience each serves
- Verify `schedule-b-filing.md` is in `.gitignore`

**Outputs.**
- `artifacts/form990-reference-filled.pdf`
- `artifacts/efile-handoff-packet.md`
- `artifacts/schedule-b-filing.md` + `artifacts/schedule-b-public.md` (if Schedule B triggered)

**Idempotency.**
- Blank PDF cache prevents redundant fetches
- Re-fill overwrites `form990-reference-filled.pdf`
- Handoff packet overwritten on re-run

**Applicable Gates.** Q-F15 (signature block populated in dataset before filling PDF).

**Transition.** Done. Print completion banner.

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
