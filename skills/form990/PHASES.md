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
Write a self-contained Python 3 script to `{SKILL_ROOT}/scripts/<phase>-<purpose>.py`.
Scripts are skill-owned and reusable across runs — they are org-agnostic (all org-specific
data flows in via command-line args). Do NOT write scripts to `artifacts/scripts/`; that
directory is reserved for per-run fixtures only.
The script must:
- Accept input paths as command-line arguments (no hardcoded paths)
- Print a JSON result to stdout on success (`{"status": "ok", "result": {...}}`)
- Print a JSON error to stdout on failure (`{"status": "error", "message": "..."}`)
- Be idempotent (re-running on the same input produces identical output)
- Log processing steps to stderr (not stdout) so stdout stays machine-parseable

**Step 2 — Sample run (validate logic before full dataset).**
Run the script on a small sample first:
- For tabular data: pass the first 5 rows as a fixture (either a sliced CSV or a tiny
  JSON fixture file written to `artifacts/scripts/fixtures/<phase>-sample.json` — fixtures
  are per-run and stay in `artifacts/`, unlike the scripts themselves)
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
    "script_path": "{SKILL_ROOT}/scripts/p2-coa-mapping.py",
    "sample_fixture": "artifacts/scripts/fixtures/p2-sample.json",
    "last_run": "<iso>",
    "last_run_sha256_input": "<sha256-of-input-data>",
    "last_run_sha256_output": "<sha256-of-output-json>",
    "rows_processed": 47,
    "flags_count": 3
  }
]
```
Scripts live in `{SKILL_ROOT}/scripts/` and are committed to the skill repo (not PII).
The `script_path` stored in machine state is the absolute resolved path. Scripts document
*how* data was processed and enable re-runs after source corrections — reviewable by the CPA.

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
SCRIPT_ALLOWLIST.add(str(pathlib.Path(f"{SKILL_ROOT}/scripts/p2-coa-mapping.py").resolve()))
result = run_script(
    f"{SKILL_ROOT}/scripts/p2-coa-mapping.py",
    args=["--sheet-csv", "artifacts/budget-export.csv"],
    phase_id="P2",
)
# result is parsed JSON dict; ScriptError raised on failure
```

On `ScriptError`: write breadcrumb via `scrub_pii()` (SKILL.md §scrub_pii), set
`phase_status = "failed"` + `last_error`, atomic commit, surface in UI.

---

## Cross-Cutting Rule: Section-Tracking for Tiller P&L Reads

Applies to ALL P&L reads in P2, P3, P6, and P7 (any time a Tiller P&L export is parsed).

Tiller P&L exports contain an INCOME section and an EXPENSE section. Both sections
may have identically-labeled subtotals (e.g., "Total Fundraising" appears in INCOME as
gross fundraising revenue and in EXPENSE as fundraising costs; "Total Program Service
Revenue" appears in INCOME as earned PSR and in EXPENSE as PSR-related cost of goods).
A label-match loop that does not track section context will overwrite income subtotals
with expense subtotals (or vice versa), silently corrupting downstream computations.

**Rule:** When reading a Tiller P&L tab:
1. Track which section you are in (INCOME or EXPENSE) based on section headers
   (e.g., "INCOME", "EXPENSES", or equivalent markers in the export).
2. Only capture subtotals from the section you are currently in.
3. Never assume a row label is unique across sections — always verify section context
   before recording a value.
4. On any multi-section P&L read, log a breadcrumb: `"P&L read: <tab> — INCOME section
   <N> rows, EXPENSE section <M> rows, section-tracking active"`.

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
    (End of Year) on that return? (You can find this on the prior 990 Part X Line 32,
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

**Variant re-evaluation:** If `gross_receipts_current` or `total_assets_eoy` changes after P0
(e.g., user corrects a number at P2 or P5), re-run the variant decision tree. If the variant
changes (e.g., 990 → 990-EZ or 990-EZ → 990), update `form_variant` and `transition_from_ez`
in machine state, log the change in the Decision Log, and invalidate all downstream phases
per the Regression Rollback Protocol (SKILL.md §Regression Rollback Protocol). This is a
structural change — it affects which schedules are required and which form template to use at P9.

5. Write **top-level machine state** (siblings of `key_facts`, NOT inside it):
   `tax_year`, `form_variant`, `skill_root`.
   Write **`key_facts`** (inside the key_facts object):
   `fiscal_year_start`, `fiscal_year_end`, `legal_name`, `ein`, `accounting_method`,
   `gross_receipts_current`, `gross_receipts_3yr_average`, `total_assets_eoy`,
   `public_charity_basis`, `transition_from_ez`, `donor_names`.
   Set `transition_from_ez = true` if variant is `990` and prior year was filed as `990-EZ`
   or `990-N` (detected from `prior_990_analysis` or user input); otherwise `false`.
   Set `donor_names = []` (empty list — populated at P1 from prior 990 or P&L, and at P6
   from Schedule B donors). All subsequent breadcrumb writes call `scrub_pii(donor_names)`.
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
8b. **Artifact pre-scan (non-blocking — run after variant routing, before P1):**

Scan `artifacts/` for key source documents that Drive MCP cannot access (org-account Drive
files are invisible to personal-OAuth MCP). Record found paths in machine state under
`artifact_local_paths{}`. Queue an open question for each missing item.

> **Why at P0:** Drive MCP uses personal OAuth — any file stored in the org's Google Drive
> account is inaccessible. Operators must copy these files into `artifacts/` manually.
> Surfacing gaps at P0 gives the operator time to collect documents before P1–P3 need them.

**a. Federal and state blank forms (see SKILL.md §Form Discovery Directive for URLs and protocol):**
- Run the Form Discovery Directive now for `tax_year` — do not defer to P9.
- Minimum: fetch `f990-blank-<tax_year>.pdf` (or 990-EZ if variant = 990-EZ).
- Also fetch `f8868-<year>.pdf` (extension form) and CA companion forms if CA org.
- Verify revision date in each fetched PDF matches `tax_year` (see Directive for check).
- On any fetch failure: queue an open question with manual URL; do not block P0 completion.

**b. Prior year filed 990 PDF:**
- Check `artifacts/` for files matching (case-insensitive): `*990*<prior_year>*.pdf`,
  `*form*990*<prior_year>*.pdf`, `*<prior_year>*990*.pdf`
- Also check `artifacts/` for any file with both "990" and a 4-digit year in the name
- If found: set `artifact_local_paths.prior_990_pdf = <absolute_path>`; breadcrumb path
- If not found: add open question `OQ-prior-990-pdf` —
  "Copy the filed prior year Form 990 PDF into artifacts/. Filename can be anything
  containing '990' and '<prior_year>'. This is required for BOY reconciliation (Part X),
  Schedule A Line 16, and board-member comparison."
- Note: IRS TEOS check at P1 may also retrieve this — if P1 TEOS succeeds, close OQ-prior-990-pdf.

**c. Payroll / W-2 annual summary:** **[PAYROLL_GROSS directive]**
- Check `artifacts/` for files matching: `*payroll*<tax_year>*.pdf`, `*w-2*<tax_year>*.pdf`,
  `*w2*<tax_year>*.pdf`, `*gusto*<tax_year>*.pdf`, `*wages*<tax_year>*.pdf`
- If found: set `artifact_local_paths.payroll_w2_pdf = <absolute_path>`; breadcrumb path
- If not found: add open question `OQ-payroll-w2` —
  "Export the W-2 annual summary from Gusto (or your payroll processor) as a PDF and place
  it in artifacts/. Required for Part IX Line 7 (gross wages) and Part VII compensation.
  Tiller shows net pay — the 990 requires W-2 Box 1 gross wages."
- P3 Pre-check will block on this; better to surface at P0.

**d. CA Secretary of State filing (if CA org):**
- Only check if `key_facts.public_charity_basis` indicates CA registration (or state = CA
  from address)
- Check `artifacts/` for: `*sec*state*.pdf`, `*statement*information*.pdf`, `*si-100*.pdf`,
  `*ca*filing*.pdf`
- If found: set `artifact_local_paths.ca_sec_state_pdf = <absolute_path>`
- If not found: add advisory open question `OQ-ca-sec-state` (non-blocking) —
  "Copy the CA Secretary of State Statement of Information (SI-100) into artifacts/ if
  available. Used for Part VI governance questions and board-change detection."

**Output:** `artifact_local_paths{}` populated in machine state; open questions queued for
any missing item. This step never blocks P0 completion — all gaps become open questions.

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

## P1 — Source Discovery (Tiered Forensic Ladder)

**Goal.** Find every source artifact needed for the return — prior 990, bank statements,
payroll reports, 1099 register, donor list, board roster, bylaws, COI policy, audit report —
by exhausting public sources before asking the user for anything.

**Inputs.** `key_facts` from P0 (must have `legal_name`, `ein`, `fiscal_year_end`), profile
`auth_accounts` and `known_resources` if profile loaded, budget sheet URL from P0.

**Pre-check.**
- Verify P0 machine state parses and `key_facts.legal_name` + `ein` + `fiscal_year_end`
  are present (non-null)
- If `key_facts.public_filing_history_ein` is already populated (P0 ran public fetch):
  cache hit — skip Tier 0 for sources already fetched; reuse artifacts from
  `artifacts/p0-public-lookups/`. Still run Tier 1+.
- Verify Drive MCP auth: call `mcp__claude_ai_Google_Drive__list_recent_files` (read-only
  smoke test); on auth error → log breadcrumb "Drive MCP auth failed" and skip Tier 1
  Drive queries (do NOT halt — fall through to Tier 2).
- Verify Gmail MCP auth: call `mcp__claude_ai_Gmail__gmail_get_profile`; on auth error →
  log breadcrumb and skip Tier 1 Gmail queries.

**Work — 6-Tier Ladder (walk in order; each tier has exit criterion and fallback).**

---

### Tier 0 — No-auth public sources (parallel, idempotent)

All Tier 0 fetches fire **simultaneously** (ThreadPoolExecutor, max_workers=6); joined
with a 20s wall-clock cap before key_facts promotion. Per-source errors write
`{"error": ..., "source": ...}` to results and append a warning breadcrumb — they never
halt P1. Rate limits enforced per-source (see TOOL-SIGNATURES.md §Phase 2).

**Sources (priority order — IRS XML wins when same year returned by multiple sources):**

1. **IRS e-file XML** (`fetch_irs_xml(ein_nodash, filing_year)`)
   — downloads annual index CSVs for `(filing_year-1)..(filing_year+1)`, finds EIN,
   fetches ZIP batch via HTTP Range, parses XML. Most authoritative.
   Breadcrumb: `tier:0 source:irs_xml`.

2. **ProPublica Nonprofit Explorer API** (`fetch_propublica(ein_nodash)`)
   — JSON API, fast, returns 5 most recent years with `totrevenue`, `totfuncexpns`,
   `totnetassetend`, `pdf_url`. Used for years not yet in IRS XML (lag ~12–18 months).
   Breadcrumb: `tier:0 source:propublica`.

3. **Candid/GuideStar public profile** (chromedevtools, no auth required)
   — Search: `chrome-devtools__navigate_page` to
   `https://app.candid.org/search?keyword={legal_name_url_encoded}`, then
   `take_snapshot` → find result where EIN text matches → extract profile URL.
   Profile: `navigate_page` to `https://app.candid.org/profile/{id}/{slug}`,
   `take_snapshot` → extract total_revenue, total_assets, total_giving, seal_level,
   mission, address, website. No CAPTCHA on search/profile pages (confirmed 2026-04-19).
   Auth-gated login (Tier 3) = FAIL; public search = PASS → use this Tier-0 approach.
   Breadcrumb: `tier:0 source:candid_public`.

4. **CitizenAudit PDF repository** (`fetch_citizenaudit_pdfs(ein)`)
   — HTML page parse + PDF download; sequential at ≤0.5 QPS.
   Breadcrumb: `tier:0 source:citizenaudit`.

4. **IRS TEOS web UI** (`fetch_teos(ein)`)
   — exempt status + last return year + determination letter status only.
   Not used for financial line items (no structured data). If TEOS returns a prior-year
   990 PDF link: download and run **[PRIOR_990_EXTRACT directive]** (see below).
   Breadcrumb: `tier:0 source:teos`.

5. **CA AG charity registry** (`fetch_ca_rct(rct_number)`, CA orgs only)
   — registration status, last RRF-1 year.
   Only runs if `registrations.ca_rct_number` present in profile or `key_facts`.
   Breadcrumb: `tier:0 source:ca_ag`.

6. **Secretary of State / WebSearch** (CA orgs — officer roster)
   — WebSearch: `"[legal_name]" "California Secretary of State" officers directors`
   — If SI-100 PDF in `artifact_local_paths`: read directly.
   — Store result as `ca_sos_officers: [{name, title}, ...]` in machine state.
   Breadcrumb: `tier:0 source:ca_sos`.

   Also run: `site:usaspending.gov [ein]`, `site:grants.ca.gov [ein]` — federal/state grants.

**Merge results** (`_merge_prior_years(results, priority_order=["irs_xml","propublica","citizenaudit","teos"])`):
- Deduplicate by `(EIN, year)`; IRS XML wins per year when available.
- Populate `key_facts.prior_filed_eoy_net_assets` (most recent year's EOY net assets).
- Populate `key_facts.prior_filed_gross_receipts_5y[]` (last 5 years, newest first).
- Populate `key_facts.public_filing_history_ein` (full merged list).

**[PRIOR_990_EXTRACT directive]** (runs after Tier 0 if a prior-year PDF was found):
Extract from the most recent filed 990 PDF and store as `prior_990_analysis` in machine state:
- `eoy_net_assets` (Part X Line 32 col B)
- `schedule_a_line15_pct` (Schedule A Part III Line 15)
- `board_members` (Part VII Section A — name, title, hours)
- `schedule_i_methodology` (Part II or Part III for individual grants?)
- `contributions` (Part VIII Line 1h — total contributions; used by P7 Prior Year column)
- `program_service_rev` (Part VIII Line 2; used by P7 Prior Year column)
- `total_revenue` (Part VIII Line 12; used by P7 Prior Year column)
- `total_expenses` (Part IX Line 25; used by P7 Prior Year column)

If no prior filing found anywhere: breadcrumb `"no prior filing found — new filer or EIN not matched"`.
When extraction succeeds:
- If `key_facts.prior_year_990_eoy_net_assets` is still null: populate from `prior_990_analysis.eoy_net_assets`
- Set `key_facts.prior_year_990_eoy_net_assets_source = "teos_extracted"`

**Present-and-confirm table** (after Tier 0, before Tier 1):
Render a table of auto-discovered prior-year data and ask the user to confirm:
```
┌─ Prior-Year 990 Data (auto-discovered) ──────────────────────────────────┐
│ Year │ Form  │ Revenue     │ Expenses    │ EOY Net Assets │ Source        │
│ 2023 │ 990   │ $199,667    │ $180,523    │ $64,809        │ IRS XML       │
│ 2022 │ 990-EZ│ $163,718    │ $149,208    │ $48,399        │ IRS XML       │
│ 2024 │ —     │ not yet indexed                                           │
└──────────────────────────────────────────────────────────────────────────┘
Does this look right? Edit any cells that are wrong, or press Enter to accept.
```
User edits recorded as `fact_source: "user_confirmed"` (overrides auto-discovered values).

---

### Tier 1 — User-auth personal account (existing)

**Drive MCP searches** (each capped at 200 results; log truncation flag in breadcrumb
if cap hit). Curated query list — **kept verbatim**:
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
- `"1099-K" OR "payment processor"` — payment processor tax forms

**Budget sheet schema scan:**
For each budget sheet tab: read header row + 4 sample rows; record `{column_name: inferred_type}`
into `key_facts.sheet_schema`.

**Artifact registration:** Register all Drive findings into `artifacts[]` with Drive file ID
as path reference. Breadcrumb each hit with `tier:1 source:personal_drive`.

---

### Tier 2 — Org-account / Shared Drives (GAS bridge)

Only runs if BOTH of:
- `key_facts.auth_accounts.org_google` is present (org Google account configured)
- `key_facts.known_resources.budget_script_id` is present (GAS bridge script deployed)

If either is absent: skip Tier 2 silently (breadcrumb `tier:2 status:skipped org_boundary`).

**GAS bridge DriveApp search** (mirrors Tier 1 queries against org-account Drive):
```javascript
// mcp__gas__exec call pattern (Tier 2 GAS bridge)
// script_id = key_facts.known_resources.budget_script_id
function searchOrgDrive(query) {
  var files = DriveApp.searchFiles(query);
  var results = [];
  while (files.hasNext()) {
    var f = files.next();
    results.push({id: f.getId(), name: f.getName(), url: f.getUrl(), mimeType: f.getMimeType()});
  }
  return results;
}
```
Run the same 10 Drive queries above via this bridge. Append results to `artifacts[]` with
`tier:2, method:gas-bridge` in breadcrumb. On any error: log `error_class=OrgAccountBoundary`
and continue (do not halt).

---

### Tier 3 — Auth-gated web portals (chromedevtools) — FEATURE-FLAGGED

**Gate:** `FORM990_ENABLE_PORTAL_TIER` env var must be `"1"` AND individual portal flags
(`FORM990_ENABLE_PORTAL_CANDID` / `FORM990_ENABLE_PORTAL_BENEVITY`) must be `"1"`.
Default: disabled. When disabled: log `tier:3 status:disabled_by_flag` and fall through to Tier 4.

**GuideStar/Candid — RECLASSIFIED TO TIER 0 (2026-04-19).**
Login at `app.candid.org/login` blocked by Cloudflare Turnstile — Tier 3 auth path = FAIL.
However, Candid's **search and public profile pages require NO auth** — reclassified to Tier 0.
See Tier 0 Source #3 above. `FORM990_ENABLE_PORTAL_CANDID` stays `0` (Tier 3 never ships).
No Tier 3 action needed for Candid — all useful data is already in Tier 0.

**Benevity** (if `portal_credentials.benevity` in profile and portal flag `"1"`):
Spike S2 not yet tested for Benevity. Keep `FORM990_ENABLE_PORTAL_BENEVITY=0` until tested.
If/when testing passes: `chrome-devtools__navigate_page` → `fill_form` (creds via
`get_portal_creds("form990-benevity")`) → `take_snapshot`; extract:
`{corporate_donors: [{name, match_amount, date, campaign}]}`.
Lifecycle: wrapped in try/finally; finally calls `chrome-devtools__close_page` unconditionally.
Error classes: `PortalAuthFailed`, `PortalAntiBot`, `PortalSchemaDrift`, `PortalCleanup`.

Breadcrumb each portal attempt with `tier:3 portal:candid|benevity status:attempted|failed|skipped`.

---

### Tier 4 — Non-Google email (if Outlook MCP present)

Detect Outlook MCP at skill-load time (check tool list for `*outlook*` or `*microsoft_mail*`).
- If **present**: run the same 10 Drive query keywords against Outlook inbox/sent folders.
  Breadcrumb: `tier:4 source:outlook`.
- If **absent**: skip (breadcrumb `tier:4 status:mcp_absent`); no hard failure.

---

### Tier 5 — User prompt (last resort)

After all prior tiers: if any **required** `key_facts` field is still null, prompt the user
with a single focused `AskUserQuestion` that includes:
a. Exactly what field(s) are missing and why they're needed.
b. Which tiers were tried and why each failed (from breadcrumb trail).
c. 2–3 suggested locations the user could check manually.

Each user-provided answer recorded as `fact_source: "user_prompt"` with pointer to the tier
chain that failed. Enables retroactive profile enrichment at P9 cold-run promotion.

---

**Required source checklist** (checked after all tiers complete):
```
Required (✔ = already found at P0 pre-scan or Tier 0; check artifact_local_paths):
├─ prior_990         (prior year Form 990) ← may be found via IRS XML, ProPublica, CitizenAudit, TEOS
│                    NOTE: PDF presence ≠ data extracted. [PRIOR_990_EXTRACT directive]
│                    above still required to populate prior_990_analysis.
├─ budget_sheet      (already have from P0 --sheet flag) ✔
├─ bank_statements   (covering fiscal year)
├─ payroll_report    (W-2 register or payroll provider export)
├─ payroll_w2_annual (Gusto annual summary) ← ✔ if artifact_local_paths.payroll_w2_pdf set
│                    Tiller net pay is always wrong for Part VII/IX. P3 Pre-check will block.
├─ 1099_register     (if contractors paid ≥ $600)
├─ donor_list        (if Schedule B may be triggered)
├─ board_roster      (for Part VI and Part VII)
├─ bylaws            (for Part VI governance questions)
├─ coi_policy        (conflict-of-interest, for Part VI Line 12a)
└─ audit_report      (if required by state law, funder covenants, or bond ≥ $750K federal awards)

Optional (request if applicable — do not block on these):
├─ payment_processor_1099k  (Form 1099-K from Stripe/PushPress/Square for PSR verification)
```

For each missing required artifact after all tiers: create an Open Question. If addressed to
an external party, create a Gmail draft via `{SKILL_ROOT}/templates/email-question.md`:
- **Never auto-send** — draft only
- Record `draft_id` in `open_questions[].draft_id`
- Apply dedup rule (see SKILL.md §Email Workflow): check existing draft_id before creating

**Board change detector** (run after all tiers, non-blocking advisory):
Compare `prior_990_analysis.board_members` (from [PRIOR_990_EXTRACT]) and `ca_sos_officers`
(from Tier 0 CA SOS) against operator-provided current roster.
- For each person in prior 990 NOT in current roster: prompt for departure date + governing change.
- For each new person: prompt for start date.
- If any governing-document change: set Part IV Line 4 = Yes → Schedule O required.
- Record all transitions in Decision Log with dates.
- If `prior_990_analysis` is null: skip silently (breadcrumb "board-change check skipped — no prior 990 data").

**Outputs.**
- `artifacts[]` entries populated (path = Drive file ID URL or local artifact path)
- `key_facts.sheet_schema` populated from budget sheet tab scan
- `key_facts.prior_filed_eoy_net_assets` + `prior_filed_gross_receipts_5y[]` populated (Tier 0)
- `open_questions[]` populated for any missing artifact with `status = "pending"`
- `ca_sos_officers[]` populated (null if CA SOS unavailable)
- Gmail draft IDs recorded for externally-addressed questions
- `phase_status.P1 = "done"` (or `"paused"` if open questions block progress)

**Exit criterion.** P1 is `done` when every required `key_facts` field has `fact_source != null`
AND has either (i) a persisted artifact in `artifacts/p1-sources/` or (ii) an explicit
user_prompt answer. Q-F31 evaluator checks that Tier-0 was attempted for each fact before
Tier-5 (user_prompt) was used.

**Idempotency.** Overwrite mode for artifact registration. Gmail draft dedup via `draft_id`.
Tier 0 artifacts cached by `(EIN, year)` under `artifacts/p0-public-lookups/`.

**Applicable Gates.** Q-F16 (source-discovery completeness), Q-F31 (Tier-0 exhausted before
user_prompt), Q-F32 (profile SHA256 unchanged since P0 init).

**Transition.** Allow user to answer pending questions or explicitly skip; then → P2.

---

## P2 — Chart-of-Accounts → 990 Line Mapping [PROG]

**Goal.** Every budget line gets mapped to a Part VIII (revenue) or Part IX (expense) 990
line plus a functional bucket (Program / M&G / Fundraising) with a documented allocation basis.

> **Programmatic analysis required** (see Cross-Cutting Pattern above). Budget sheets routinely
> have 30–300 rows. Apply the 4-step script pattern: write `{SKILL_ROOT}/scripts/p2-coa-mapping.py`,
> validate on a 5-row sample fixture, run full dataset, review flags with user.

**Inputs.** Budget sheet tabs from P1 (`key_facts.sheet_schema`, budget tab content).

**Pre-check.**
- Verify `key_facts.sheet_schema` is populated (non-null) from P1
- Verify `artifacts` has non-null budget-sheet handle
- Verify total row count ≤ 500 (if > 500: halt and ask user to narrow scope or batch)
- If 100 < rows ≤ 500: read the Sheets tab in 100-row chunks (MCP calls only — the assembled
  CSV is passed whole to the script; chunking applies to the Drive MCP fetch, not script invocation)

**Work.**

**Categories tab (read before mapping).** Read the Tiller `Categories` tab (or equivalent
functional-allocation tab) at the start of P2. The `Group` field on that tab defines the
Program / M&G / Fundraising allocation for each budget category and is the authoritative
allocation source. Do NOT infer functional allocation from P&L row labels alone — the label
may say "Supplies" while the Group field says "Program." Record the `Group` → bucket mapping
before running Step 4 below.

**Script: `{SKILL_ROOT}/scripts/p2-coa-mapping.py`**
- Input args: `--sheet-csv <path>` (normalized CSV dump of budget tab), `--tax-year <YYYY>`
- Output: JSON with `{mapped_rows: [...], flags: [...], summary: {revenue_total, expense_total, unmapped_count}}`
- Sample fixture: `artifacts/scripts/fixtures/p2-sample.json` (5 rows covering at least one
  revenue, one salary, and one ambiguous row)
- The script applies Steps 1–5 below algorithmically; human review happens on the `flags` output

For each budget row, apply the mapping methodology:

**Step 1: Classify sign/type.**
- Revenue if: account-type = income, or amount is a credit balance
- Expense if: account-type = expense, or amount is a debit balance
- **Negative income line:** If a row has account-type = income but a negative amount
  (reversal/refund in an income category), do NOT auto-classify. Prompt:
  "This appears to be a reversal of prior income. Which Part VIII line does this reduce?
  Options: (a) Line 1 contributions, (b) Line 2 PSR, (c) Line 11 other revenue."
  Record the answer and offset against the indicated line. Never auto-commit.

**Step 2: Map Revenue → Part VIII line by source taxonomy.**
| Revenue type | Part VIII line |
|---|---|
| Contributions / grants / gifts | Line 1 (a–h by source sub-type) |
| Program service fees | Line 2 (a–g by program; Line 2g = total) |
| Membership dues | Line 1b (membership dues assessed, NOT Line 3) |
| Investment income (dividends, interest, other) | Line 3 (NOT Line 4) |
| Income from tax-exempt bond proceeds | Line 4 |
| Royalties | Line 5 |
| Gross rental income | Line 6a (with 6a(i) real, 6a(ii) personal) |
| Net rental income/loss | Line 6c (6a minus 6b) |
| Gain/loss on asset sales | Line 7 |
| Fundraising events (gross) | Line 8a |
| Gaming | Line 9a |
| Sales of inventory | Line 10a |
| Other revenue (unclassified) | Line 11 (a–e) |

> **Merchandise Revenue special case:** Even if Tiller places merchandise sales in the
> Fundraising income group, it maps to **Part VIII Line 10a** (gross sales of inventory),
> NOT Line 1 (contributions) or Line 8 (fundraising events). Prompt the user to confirm
> the COGS amount (from the `Merchandise Sales Inventory` expense line or equivalent).
> Record: `part_viii_line10a = gross_merchandise_sales`, `part_viii_line10b = COGS`,
> `part_viii_line10c = net = line10a − line10b`. Merchandise COGS must NOT appear in
> Part IX — it is reported only in Part VIII Line 10b.

**Step 3: Map Expense → Part IX line by nature.**
| Expense type | Part IX line |
|---|---|
| Grants to US orgs / governments | Line 1 |
| Grants to US individuals | Line 2 |
| Grants to foreign orgs / individuals | Line 3 |
| Benefits paid to or for members | Line 4 |
| Officer / key-employee compensation | Line 5 |
| Compensation to disqualified persons (IRC §4958) | Line 6 |
| Other salaries / wages | Line 7 |
| Pension / retirement contributions | Line 8 |
| Other employee benefits | Line 9 |
| Payroll taxes | Line 10 |
| Management fees | Line 11a |
| Legal fees | Line 11b |
| Accounting / auditing fees | Line 11c |
| Lobbying / government affairs | Line 11d |
| Professional fundraising services | Line 11e |
| Investment management fees | Line 11f |
| Other fees for services (nonemployees) | Line 11g |
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
- If separate (employer-only taxes confirmed available from Gusto/payroll provider): set
  `payroll_tax_source = "separate_employer"` in machine state; use the employer-only
  figure for Part IX Line 10. No halt needed.

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
- **Small unclassified Tiller entries:** Labels like "Owed by others recovery," "Bank credit,"
  "Reimbursement," or similar non-standard income entries typically represent inter-account
  transfers, returned checks, or prior-year A/R settlements. Prompt: "Was this a reimbursement
  from someone, a returned check, or a bank credit?" Default classification if unresolved:
  Part IX Line 24 (other expenses) or Part VIII Line 11 (other revenue) as appropriate.
  Do not leave in UNCATEGORED — every line must have a mapping before P3.

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

**Variant re-evaluation hook (P2).** After mapping is complete, if the total revenue or total
assets figure derived from the COA mapping differs from P0's `gross_receipts_current` or
`total_assets_eoy`, re-run the variant decision tree per the P0 variant re-evaluation procedure.

**Applicable Gates.** Q-F3 (functional columns sum), Q-F10 (ED allocation documented),
Q-F17 (methodology narrated in Schedule O), Q-F18 (not yet — deferred to P5), Q-F19 (payroll tax source — commingling flag set at P2 determines Q-F19 applicability), Q-F28 (no disallowed negatives — revenue classification step at P2 Step 2 determines sign correctness).

---

## P3 — Financial Statement Production [PROG]

**Scripts used:** `{SKILL_ROOT}/scripts/verify_part_ix_columns.py` (Q-F3 functional column arithmetic), `{SKILL_ROOT}/scripts/verify_all.py` (aggregate runner).

**Goal.** Produce Statement of Activities, Balance Sheet (BOY + EOY), and Functional Expense
matrix from the CoA mapping.

> **Programmatic analysis required** (see Cross-Cutting Pattern above). P3 aggregates the
> CoA mapping into three financial statements — 25 Part IX rows × 4 columns = 100 cells that
> must be arithmetically exact. Apply the 4-step script pattern:
> write `{SKILL_ROOT}/scripts/p3-financial-statements.py`, validate on a 5-row sample of the
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
- **Blocking: Gross wages source.** Tiller captures net payroll (take-home amounts). Part IX
  Line 7 requires W-2 Box 1 gross wages. If `open_questions[]` still has `payroll_w2_annual`
  pending: HALT with "Gusto (or payroll processor) W-2 annual summary required before P3 can
  compute Part IX Line 7. Provide the W-2 Box 1 total for all employees." Do NOT populate
  Part IX Line 7 from Tiller payroll lines.
- **Blocking: Payroll tax composition.** If `payroll_tax_source == "combined_tiller"` (set at P2)
  and no Gusto employer taxes summary is in `artifacts`: HALT with "Gusto employer taxes summary
  required before P3 can compute Part IX Line 10. Provide employer-only FICA/FUTA amounts." Do
  NOT populate Part IX Line 10 from combined Tiller payroll tax lines.

**Work.**

**Script: `{SKILL_ROOT}/scripts/p3-financial-statements.py`**
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

**Merchandise COGS accounting rule:** Merchandise COGS shown in Tiller's expense total MUST
be excluded from Part IX and reported ONLY in Part VIII Line 10b. As a result:
- Part VIII Line 12 (total revenue) ≠ Tiller total income by exactly the COGS amount
- Part IX Line 25 (total expenses) ≠ Tiller total expenses by exactly the COGS amount
If merchandise lines are present in the CoA mapping: verify COGS is flagged
`exclude_from_part_ix = true` before aggregating Part IX.

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
Q-F12 (fundraising expense non-zero if contributions > 0), Q-F19 (payroll tax Line 10/7 ratio — first computed at P3 from functional expense matrix).

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
6. **Insider vendor check [INSIDER_VENDOR_CHECK directive]:** For each vendor paid >$10,000
   in the year (from CoA mapping), explicitly ask: "Does any current or former officer,
   director, trustee, or key employee of [org] have a direct or indirect ownership interest
   ≥ 35% in [vendor name]?" Do not default to No. If YES → Part IV Line 28a = Yes;
   Schedule L Part IV required. Create Open Question if unknown.

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
questions answered or queued as open question; all `yes` answers added to `required_schedules[]`),
Q-F21 (vendor >$10K insider-ownership check — [INSIDER_VENDOR_CHECK] directive runs at P4).

---

## P5 — Core Parts (III, V, VI, VII, VIII, IX, X, XI, XII)

**Scripts used:** `{SKILL_ROOT}/scripts/verify_part_iii.py` (Q-F18/Q-F3: Part III program service accomplishments completeness).

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
  description of beneficiaries/outputs). Before drafting descriptions, prompt:
  1. "How many individual athletes/students were enrolled on average during the year?"
  2. "What is the weekly class schedule (days + hours)? How many weeks did you operate?"
     → Compute: `hours = (weekly_hours × operating_weeks) − individual_holiday_hours`
  3. "Were any new program services launched this year (not offered in prior years)?"
     → If yes: set Part III Line 2 = Yes; require a description of the new service.
  4. "Did any athletes achieve notable competitive accomplishments (national team selections,
     championship placements, state/regional rankings)?" → Include in description if yes.
  Include headcount and computed hours in the description (IRS expects quantified outputs). **[PROG_METRICS directive]**
- Line 4d: other program services (aggregate)
- Line 4e: total program service expenses

**Competition assistance / scholarship classification prompt (P5 — ask before filling Lines 4a–4c):**
If any grant, scholarship, or competition-assistance amount appears in the program expenses, ask:
"What form did competition assistance or scholarships take? Options:
  (a) Voucher / discount code — org reduces its own fee; NOT a grant; reports as reduced revenue
  (b) Direct cash payment to the athlete/student — Part IX Line 2 (grants to US individuals)
  (c) Payment to competition organizer on behalf of the athlete — Part IX Line 2 (grants to US individuals)"
- Path (a): no Schedule I triggered; adjust Part VIII revenue line; note in Part III description
- Paths (b) or (c): Part IV Line 22 = Yes → Schedule I triggered; record grant amounts in Schedule I
- Cross-check against prior year Schedule I (if `prior_990_analysis.schedule_i_methodology` is set):
  "Prior year used [methodology]. Use the same treatment unless org changed its policy."
- Do NOT auto-commit classification. Create Open Question if ambiguous.
- **For membership-based orgs:** Ask whether program services are open to non-members or
  exclusively for members. This distinction affects Schedule A public benefit narrative and
  the PSR vs. contributions classification. Record the answer for Schedule O.

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
- **Line 2 family/business relationship check:** Before answering Line 2, proactively ask:
  "Are any current officers, directors, or trustees related by blood, marriage, or adoption?
   Are any related through business relationships (employer/employee, business partners)?"
  If any pair is related (e.g., two married couples on the board): Line 2 = Yes, and document
  each pair in the Schedule O narrative. Common: spouses serving together on a small nonprofit
  board triggers Line 2 = Yes even if no financial transactions exist between them.
  No Schedule L is triggered unless there are actual financial transactions between the org
  and those individuals (beyond charitable donations to the org).

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

**Split-interest trust advisory:** If Part VIII revenue includes annuity distributions,
charitable remainder trust payments, or pooled income fund distributions (Line 6 or similar),
surface a non-blocking advisory: "Split-interest trust income detected — verify Schedule D
Part II (Charitable Remainder Trusts) and Schedule A Part II Line 5 (annuity trust distributions)
are correctly reported. Recommend CPA review." Record in Decision Log with `severity: "advisory"`.

**UBTI re-check (P5):** After Part VIII revenue mapping is complete, re-evaluate P0's UBTI
advisory against actual mapped amounts. If any revenue line suggests unrelated business activity
(e.g., advertising income, debt-finished rental income, commercial activity revenue), surface
advisory: "UBTI re-check: [line] shows $[amount] that may be Unrelated Business Taxable Income.
A Form 990-T may be required. Recommend CPA review." Record in Decision Log with
`severity: "advisory"`.

**Part VIII — Statement of Revenue:**
- Lines 1a–12: copy from Statement of Activities aggregated by P3
- Lines are prefilled from `coa-mapping.csv` revenue aggregations
- **Schedule M trigger:** If Line 1g (noncash contributions) ≥ $25,000, verify Schedule M is
  in `required_schedules[]`. If not, add an Open Question: "Noncash contributions ≥ $25K —
  should Schedule M (Noncash Contributions) be filed?"

**Part IX — Statement of Functional Expenses:**
- Lines 1–25: copy from `functional-expense.csv` (all four columns)
- Confirm Part IX Line 25 Column A = Statement of Activities total expenses (Q-F2 proxy)

**Part X — Balance Sheet:**
- **Liability pre-check (before copying from balance-sheet.md):** Read the balance sheet's
  LIABILITY section from Tiller (or the net worth report). Do NOT set Part X liabilities to $0
  without verifying. Credit card balances on personal cards used for org expenses are real
  liabilities even if not tracked in a dedicated Tiller liability account. Ask: "Does the org
  have any outstanding credit card balances, loans, or accrued payables at year-end — including
  on personal cards used for org expenses?" Record any confirmed liabilities in Part X before
  copying from balance-sheet.md.
- **Net asset classification pre-check:** Ask: "Does the organization have net assets with
  donor restrictions (e.g., endowment funds, donor-restricted gifts, board-designated
  funds with restrictions)?" If yes: require breakdown for both BOY and EOY columns.
  Each line has both columns:
  Line 27 = net assets without donor restrictions (col A = BOY, col B = EOY);
  Line 28 = net assets with donor restrictions (col A, col B);
  Line 32 = total net assets or fund balances (col A = sum of Lines 27–31 BOY,
  col B = sum of Lines 27–31 EOY). Line 33 = total liabilities and net assets/fund balances.
  **Note on form version:** Per the 2023+ Form 990 revision, Part X uses 2-class ASC 958:
  Line 26 = total liabilities; Line 27 = net assets without donor restrictions; Line 28 = net assets
  with donor restrictions; Lines 29–31 = capital stock / paid-in surplus / retained earnings
  (typically $0 for most 501(c)(3) orgs); Line 32 = total net assets; Line 33 = total liabilities
  and net assets. For pre-2023 forms using 3-class (unrestricted / temporarily restricted /
  permanently restricted), line numbers differ — resolve via the field map per
  SKILL.md §Form Year Dependency.
  If no restricted net assets: Line 28 = $0 for both columns; all net assets
  flow to Line 27 (net assets without donor restrictions).
  **Schedule D trigger:** If restricted net assets exist, verify Schedule D is in `required_schedules[]`
  (Part IV Line 8 or Line 9 should be "Yes"). If not, add an Open Question: "Restricted net assets
  identified — should Schedule D (Supplemental Financial Statements) be filed?"
- Lines 1–33: copy from `balance-sheet.md` (BOY + EOY columns)

**BOY reconciliation check [BOY_RECONCILE_GATE directive]:** After Tiller BOY is read from balance-sheet.md:

If `key_facts.prior_year_990_eoy_net_assets` is not null AND differs from Tiller BOY:
```
filed_eoy = key_facts.prior_year_990_eoy_net_assets
tiller_boy = <Tiller opening balance from balance-sheet.md>

1. Accept filed_eoy as the authoritative Part X BOY (override Tiller)
2. Auto-compute Part XI Line 9 prior-period adjustment:
   Assumptions (verify against IRS Form 990 Part XI instructions before implementing):
   - EOY_actual = current-year Part X Line 32 col B (EOY net assets — from
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

**Variant re-evaluation hook (P5).** After dataset_core is finalized, if the total revenue or
total assets in dataset_core differs from P0's `gross_receipts_current` or `total_assets_eoy`,
re-run the variant decision tree per the P0 variant re-evaluation procedure.

**Applicable Gates.** Q-F5 (W-2/1099 count ties — Gate 2; Open Question if payroll register
missing), Q-F6 (Part VII compensation ties to source docs), Q-F18 (Part III program
accomplishments substantive), Q-F19 (payroll tax Line 10/7 ratio), Q-F20 (BOY = prior EOY),
Q-F21 (vendor insider-ownership check), Q-F28 (no disallowed negative values),
Q-F29 (Part X balance sheet balances).

---

## P6 — Schedule Generation [PROG: Schedule A]

**Scripts used:** `{SKILL_ROOT}/scripts/verify_schedule_a.py` (Q-F4/Q-F11/Q-F23: 509(a)(2) public-support test arithmetic).

**Goal.** Produce every triggered schedule. Schedule A always; Schedule O nearly always.
P6 writes only `dataset_schedules.json` plus per-schedule markdown — never touches `dataset_core.json`.

> **Programmatic analysis required for Schedule A** (see Cross-Cutting Pattern above). The
> 509(a)(1) public-support test involves 5 years × multiple donor/revenue columns × excess-
> contribution exclusion arithmetic across donors — error-prone to compute inline. Apply the
> 4-step script pattern for Schedule A: write `{SKILL_ROOT}/scripts/p6-schedule-a.py`, validate
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

**Script: `{SKILL_ROOT}/scripts/p6-schedule-a.py`**
- Input args: `--support-json <path>` (a JSON file with 5-year support history per donor,
  shape: `{years: [T-4..T], donors: [{name, year, amount}], totals: {year: {contributions,
  investment_income, other_revenue, program_service_rev}}}`)
- Output: JSON with `{public_support_pct: float, result: "PASS"|"BORDERLINE"|"FAIL",
  test_used: "509a1"|"509a2", five_year_detail: [...], excess_contributions_by_year: {...},
  facts_and_circumstances_needed: bool, flags: [...]}`
- Sample fixture: `artifacts/scripts/fixtures/p6-schedule-a-sample.json` (per-run, stays in artifacts/) — use 2-year window
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

**Schedule A Line 16 — prior year percentage (always from filed return, never re-computed):**
Line 16 of Schedule A Part II asks for the "Public support percentage from 2023 Schedule A,
Part II, line 15" (the prior year's filed percentage). Always populate this from
`prior_990_analysis.schedule_a_line15_pct` — the verbatim percentage as reported on the
most recently filed Schedule A. Do NOT re-compute the prior year percentage from raw data.
The prior CPA's methodology may have differed (different donor classifications, rounding);
re-computing risks a mismatch with the filed return that triggers IRS scrutiny.
- If `prior_990_analysis.schedule_a_line15_pct` is null (no prior filing): Line 16 = N/A or 0.
- If TEOS extraction succeeded: use `prior_990_analysis.schedule_a_line15_pct` verbatim.
- If prior 990 not available from TEOS or operator: create Open Question; do not leave blank.

**Entity donor DQ ownership check [ENTITY_DONOR_CHECK directive]:**
For each non-individual donor (business entity, LLC, foundation, DAF) that contributed
more than $5,000 in ANY of the 5-year Schedule A window, ask:
"Does any current or former officer, director, trustee, or key employee of [org] have a
direct or indirect ownership interest ≥ 35% in [entity name]?"
- If YES → entity is a disqualified person; contributions excluded from Schedule A Line 7a
  (same as individual DQ contributors — full exclusion, no cap)
- If NO → entity is a public donor; include in public support
- If UNKNOWN → create Open Question: "Check business registration or ask CEO";
  mark Q-F26 NEEDS_UPDATE until resolved
This is distinct from the individual DQ check and the insider vendor check — it
specifically addresses corporate and entity donors.

**DQ persistence check [DQ_PERSISTENCE_CHECK directive]:** Before computing Line 7a, cross-check
departed board members. Any person who left the board during the current year but was a substantial
contributor (gave >$5,000 AND >2% of cumulative contributions in any of the 5-year window) must
remain on the DQ exclusion list. Leaving the board does NOT remove DQ status under IRC §4946.
Add Schedule O note for each such person: "[Name] left the board in [year] but remains a
disqualified person as a substantial contributor under IRC §4946."

**Schedule A DQ cross-check (run after computing Line 7a):**
After computing the DQ exclusion (Line 7a), verify: for every person listed in Part VII
Section A (officers, directors, trustees, key employees), were their donations classified
as disqualified contributions (full exclusion, Line 7a)?
Prompt: "The following Part VII persons also appear in the donor data:
  [list names]. Are all their donations classified as DQ contributions (IRC §4946)?
  If yes, they should be fully excluded in Line 7a — not capped at Line 7b.
  If any were NOT classified as DQ: confirm whether they are a 'substantial contributor'
  per IRC §507(d)(2); if yes, treat as DQ."
Flag any board member donation NOT in Line 7a as a potential DQ classification error.

**Schedule O (always):**
- Collect every Part VI "describe in Schedule O" placeholder from P5
- For each: draft a narrative with the user or from governance documents
- Include: functional expense allocation methodology (Q-F17)
- **Disclosure accuracy check [DISCLOSURE_ACCURACY directive]:** Part VI Line 18 — When populating the public availability
  statement, verify:
  (a) Any named third-party website is still active (GuideStar → Candid in 2022; use
      candid.org or apps.irs.gov as fallbacks)
  (b) Whether the org has its own website where the 990 can be posted — if yes, check
      "Own website" in Part VI Line 18
  (c) Default if no website: "Upon request" + "Another's website (www.candid.org or
      apps.irs.gov/app/eos/)" — do not name inactive or renamed sites

**Schedule B (if triggered):**
- Collect donor names, amounts, addresses from `donor_list` artifact
- **Populate `key_facts.donor_names`** from schedule B donor list: set
  `key_facts.donor_names = schedule_b_donors.map(d => d.name)`. This enables
  `scrub_pii()` to redact donor names in breadcrumbs written after P6.
- Emit two files:
  - `artifacts/schedule-b-filing.md` — full names + addresses + amounts (IRS-only per IRC §6104(d)(3)(A))
  - `artifacts/schedule-b-public.md` — `"Anonymous"` for names, addresses stripped, amounts kept
- Both registered in machine state with appropriate `confidentiality` tags
- `.gitignore` entry verified for `schedule-b-filing.md`

**Schedule B Donor Address Collection (if triggered — P6 sub-procedure):**
If Schedule B is triggered (Part IV Line 2 = Yes):

1. For each donor in `schedule_b_donors[]`:
   a. If donor is an officer or director listed in Part VII:
      - Extract address from prior-year 990, CA SOS filing, or Articles of Incorporation.
      - Do NOT ask the user for their own address — extract from source documents first.
      - Log source document in Decision Log entry: `{donor, source, address}`.
   b. Otherwise:
      - AskUserQuestion: "Schedule B requires a full mailing address for [Donor Name] who
        contributed [amount]. Can you provide their current address?"
      - If user provides: store in `artifacts/schedule-b-filing.md` under confidential section.
      - If user defers: create `open_questions[]` entry:
          `{ type: "donor_address", donor: <name>, threshold: <amount>,
            status: "pending", message: "Address required for Schedule B" }`

2. Mark Q-F8 re-evaluation pending if any donor address is still missing.

IMPORTANT: Donor addresses are PII. Do NOT write them to plan file breadcrumbs,
Decision Log entries, or any artifact other than `artifacts/schedule-b-filing.md`.

**1099-K Reconciliation (P6 — if card-based revenue present):** **[PAYMENT_PROCESSOR_1099K directive]**
If PSR (Part VIII Line 2) includes card-based membership fees or the `payment_processor_1099k` artifact exists:
1. Read the 1099-K from `artifacts/payment_processor_1099k` (if available from P1 discovery).
2. Reconcile 1099-K gross against PSR card-based revenue in Part VIII.
3. If 1099-K gross ≠ PSR card-based total: create Open Question with the delta and flag for Q-F27.
4. If 1099-K not available but card-based revenue is present: create Open Question requesting the form.

**Other triggered schedules (D, G, I, L, M, R):** See SCHEDULES.md for per-schedule playbooks.

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
Q-F14 (Schedule O covers all Part VI "describe" prompts), Q-F22 (departed board members DQ
status for Schedule A), Q-F23 (Schedule A Line 15 vs Line 16 divergence), Q-F26 (corporate donor board-ownership check for 509(a)(2) — [ENTITY_DONOR_CHECK] directive runs at P6), Q-F27 (payment processor 1099-K),
Q-F30 (Schedule B donor threshold completeness).

---

## P7 — Part I Rollup & Reconciliation + Deterministic Merge

**Scripts used:** `{SKILL_ROOT}/scripts/verify_big_square.py` (Q-F2: Part I big-square reconciliation).

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

**Part I Prior Year column [PART_I_PRIOR_YEAR directive]:** Populate immediately after current-year rollup:
If `prior_990_analysis` is populated in machine state, auto-fill the Prior Year column:
```
Part I Line 8  Prior Year = prior_990_analysis.contributions        (Part VIII Line 1h)
Part I Line 9  Prior Year = prior_990_analysis.program_service_rev  (Part VIII Line 2)
Part I Line 12 Prior Year = prior_990_analysis.total_revenue        (Part VIII Line 12)
Part I Line 18 Prior Year = prior_990_analysis.total_expenses       (Part IX Line 25)
Part I Line 19 Prior Year = total_revenue − total_expenses          (computed)
```
Store in `dataset_rollup.parts.I.prior_year`. If `prior_990_analysis` is absent: leave
Prior Year column null and flag Q-F24 NEEDS_UPDATE (non-blocking — Part I Prior Year is
not required for e-file transmission but is required on the public-facing reference PDF).
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

**Part XI Line 9 materiality check:** After computing Part XI Line 9 (other changes in net
assets), evaluate: if `abs(Part XI Line 9) < $500`, log "Prior period adjustment is negligible
($[amount]) — likely rounding. No Schedule O narrative required unless CPA requests it." Do
NOT auto-generate a Schedule O narrative for amounts < $500. Only generate Schedule O content
if `abs(Part XI Line 9) >= $500`.

**Mid-session P&L re-check:** If the user updates the Tiller P&L mid-session (or says "I
updated the P&L"), immediately re-read BOTH the P&L PDF and the net worth/balance sheet PDF
before making any changes. Compute and display a structured diff:
"Revenue: $[old] → $[new] (Δ$[diff]), Expenses: $[old] → $[new] (Δ$[diff]),
Net: $[old] → $[new] (Δ$[diff]). EOY net assets: $[old] → $[new] (Δ$[diff])."
Do NOT update dataset values silently — always show the diff and confirm before applying.

**Reconciliation gap diagnostic (runs when `delta_match = false`):**
Compute: `gap = abs((revenue_total − expense_total) − (net_assets_eoy − net_assets_boy))`
If `gap > 1000` AND Part XI Lines 5–9 are all zero (no recorded adjustments):
  Auto-prompt: "The math doesn't close by $[gap]. Likely causes:
    (1) Prior period adjustment needed — does the BOY ($[net_assets_boy]) match the
        filed prior year EOY ($[key_facts.prior_year_990_eoy_net_assets])?
    (2) Is there a Tiller UNCATEGORIZED line that represents a real expense not
        captured in Part IX?
    (3) Was any income or expense recorded in Tiller but excluded from the 990
        (e.g., pass-through funds, loan proceeds)?
  Please resolve before P7 can advance to merge."
If `gap > 1000` AND Part XI Lines 5–9 are non-zero: the gap is explained by adjustments;
  log "Gap of $[gap] accounted for by Part XI Lines 5–9 adjustments" and continue.

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
(Part I ties to downstream parts), Q-F24 (Part I Prior Year column sourced from filed prior
return), Q-F29 (Part X balance sheet balances).

---

## P8 — CPA Quality Review Pass

**Goal.** Run the full Q-F1..Q-F30 catalog with the CPA Reviewer persona. Convergence loop
with max 5 passes. Gate-1 unresolved after 5 passes → halt + AskUserQuestion.

**Inputs.** Everything: all prior artifacts, key facts, all phase outputs.

**Pre-check.**
- [→ verify_ancestors] `cpa_review_report` — Phase Entry Protocol calls `verify_ancestors()`
  on P8's output artifact, which transitively verifies `dataset_merged`, `reconciliation_report`,
  and their full upstream chain (including `dataset_core`, `dataset_schedules`, `dataset_rollup`).
  Any hash mismatch (including a stale `reconciliation_report`) halts before Pre-check.
- Verify Part I is populated (not null) in `dataset_merged` (content check)
- Verify all `required_schedules[]` have corresponding schedule artifacts in `dataset_schedules`
- **Context loading:** Do NOT load SCHEDULES.md at P8 entry. P8 Q-F gates evaluate values
  in `dataset_schedules.json` output artifacts — not SCHEDULES.md playbooks. Load SCHEDULES.md
  only if a NEEDS_UPDATE triggers a P6 re-run (dispatched via `call PHASES.md §P6`).
  This saves ~6,100 tokens per evaluation pass.

**Work.**

```
pass = 0
memoized = {}

while pass < 5:
    evaluate Q-F1..Q-F30 applicable to current state (CPA Reviewer persona)
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

**New-program advisory check (P8 — run once, before gate pass 1):**
If `dataset_core.parts.III.line_2_new_programs == false` (or null), scan available org context
(board minutes, mission documents, any P0 intake notes) for phrases like "new for this year,"
"launching," "piloting," or "first time." If found: flag advisory — "Part III Line 2 says no
new programs, but context mentions [quote]. Confirm whether a new program service was offered
this year." Do not auto-flip Line 2; wait for user confirmation before updating.

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

**Scripts used:** `{SKILL_ROOT}/scripts/verify_all.py` (aggregate runner — verifies all phase outputs before PDF fill).

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
- `field_count > 0` (XFA form — 2025 f990.pdf has 1,307 AcroForm fields) → proceed to Step 1b

**Step 1b: XFA field map extraction (runs when field_count > 0 and no cached map exists).**
The 2025 f990.pdf is an XFA form. The XFA template stream (array item 5 of the `/XFA` key
in the PDF trailer) contains `<assist><speak>` labels for every field. Extract them to build
the `f990-field-map-YYYY.json` coordinate table:
```python
import pypdf, re, json

reader = pypdf.PdfReader('artifacts/f990-blank-<tax_year>.pdf')
xfa = reader.trailer["/Root"]["/AcroForm"]["/XFA"]
# XFA is an array; item 5 (index 4 of stream objects) is the template
template_stream = xfa[4].get_object().get_data().decode("utf-8", errors="replace")

fields = {}
for m in re.finditer(
    r'<field name="([^"]+)".*?<assist><speak>([^<]+)</speak>',
    template_stream, re.DOTALL
):
    short_name, label = m.group(1), m.group(2).strip()
    full_path = f"form1[0].Page{page}[0].{short_name}[0]"  # adjust page from context
    fields[f"{short_name}[0]"] = {"label": label, "full_path": full_path}

json.dump(fields, open(f"{SKILL_ROOT}/templates/f990-field-map-{tax_year}.json", "w"), indent=2)
```
Cache the resulting map:
- Canonical location: `{SKILL_ROOT}/templates/f990-field-map-<tax_year>.json` (skill-owned, reusable across runs)
- Persistent: record the sha256 of the map in `TOOL-SIGNATURES.md §form990_field_map` under
  `<!-- BEGIN FIELD MAP <year> --> ... <!-- END FIELD MAP <year> -->` sentinels

On cache hit (same sha256 in TOOL-SIGNATURES.md): skip extraction, reuse `{SKILL_ROOT}/templates/f990-field-map-<tax_year>.json`.
Do NOT write a copy to `artifacts/` — the templates/ location is authoritative and shared across all runs for this tax year.

**XFA fill sequence (when using AcroForm name-based fill — Step 2a).**
Short field name `f1_28` maps to a full XFA path ending in `.f1_28[0]`. Use the extracted
`short_to_full` map from Step 1b:
```python
# CORRECT: exact key lookup
full_path = short_to_full[f"{short_name}[0]"]

# WRONG — fails for XFA nested paths:
# full_path = next(p for p in all_paths if p.endswith(f'.{short_name}'))
```
The `.endswith()` pattern silently fails when a short name appears as a suffix of a longer
path segment. Always use the pre-built `short_to_full` dict.

**Step 2: Primary fill path — coordinate overlay.**
Using `pypdf`, render a flat annotation layer over the blank PDF at line coordinates from
`TOOL-SIGNATURES.md §f990 Coordinate Table`. If the coordinate table is absent: halt.
Shell-safety: all values flow through the Python API — no shell concatenation.
UTF-8 preserved; control characters stripped; NUL bytes rejected.

**Step 2a: Fallback fill path — AcroForm name-based (only if field_count > 0).**
Use `pdftk-java` with an FDF intermediate file written through a library (not hand-concatenated).
XFA path resolution: use `short_to_full` lookup from Step 1b (see XFA fill sequence above).
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
  - `{{YYYY}}`: `tax_year` (top-level state field, not inside key_facts)
  - `{{DATE}}`: today's date (packet preparation date)
  - `{{FISCAL_YEAR_START}}`: `key_facts.fiscal_year_start`
  - `{{FISCAL_YEAR_END}}`: `key_facts.fiscal_year_end`
  - `{{ORIGINAL_DUE_DATE}}`: if `fiscal_year_end` is Dec 31 → May 15 of (`tax_year` + 1);
    else → 4.5 calendar months after `fiscal_year_end` (round to nearest day)
  - `{{EXTENDED_DUE_DATE}}`: `ORIGINAL_DUE_DATE` + 6 months (Form 8868 automatic extension)

**Step 3b: Assemble CPA memo.**
Write `artifacts/cpa-memo-fy<tax_year>.md` — a distinct deliverable from the handoff packet.
Audience: the signing CPA or financial reviewer (not the e-file provider).
Content:
- Summary of key figures (total revenue, total expenses, net assets BOY/EOY)
- Significant judgments made during preparation (functional allocation basis, competition
  assistance classification, prior period adjustment rationale if Line 9 non-zero)
- Open items or caveats requiring CPA sign-off before transmission
- Any Gate-2/3 items that resolved as acceptable risk (not Gate-1 PASS, but documented)
Fill template placeholder `{{LEGAL_NAME}}`, `{{YYYY}}`, `{{DATE}}` before writing.
Register in machine state as `artifacts.cpa_memo`.

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
- `artifacts/cpa-memo-fy<tax_year>.md`
- `artifacts/schedule-b-filing.md` + `artifacts/schedule-b-public.md` (if Schedule B triggered)

**Idempotency.**
- Blank PDF cache prevents redundant fetches
- Re-fill overwrites `form990-reference-filled.pdf`
- Handoff packet overwritten on re-run

**Applicable Gates.** Q-F15 (signature block populated in dataset before filling PDF).

**Transition.** Done. Print completion banner. See Post-Run Review section below; print the prompt box to the operator before closing the session.

**Cold-run profile promotion (P9 end-of-run, if no profile was loaded at init):**
If `key_facts.profile_path` is null (no profile was loaded), offer to write one from the
current run's resolved `key_facts` (minus tax-year-specific items).

**Slug derivation (before presenting the offer):**
Compute `proposed_slug` from `key_facts.legal_name`:
```python
import re
slug = re.sub(r'[^a-z0-9]+', '-', key_facts["legal_name"].lower()).strip('-')
slug = re.sub(r'-+', '-', slug)[:50]  # max 50 chars
```
Example: `"Fortified Strength"` → `"fortified-strength"`.
Present the proposed slug for confirmation — the operator can edit it.

```
┌─ Save Company Profile? ────────────────────────────────────────────────┐
│  This run resolved key company facts that can be reused next year:     │
│    EIN, officers, CA RCT number, auth boundaries, GAS script IDs, etc. │
│                                                                         │
│  Write to: ~/.claude/form990/<derived-slug>.md                         │
│  Org slug [<derived-slug>]: ____________ (edit or press Enter to accept)│
│                                                                         │
│  This file is outside the git repo and persists across tax years.      │
│  Exclude from profile: tax_year, gross_receipts_current, sheet IDs     │
│  (per-year — these will be re-discovered next year).                   │
│                                                                         │
│  [Y] Save profile  [n] Skip                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

If the operator accepts: validate the final slug with `_validate_slug()`, then write
`~/.claude/form990/<slug>.md` using `atomic_commit()` with scrubbed content
(run `scrub_pii()` before writing officer names and account hints).
The written file must pass `load_profile()` validation without errors. Log breadcrumb
`"cold-run-promotion: profile written to <path>"`.

**Artifact retention (P9 end-of-run):**
Prune `artifacts/p0-public-lookups/` to keep the latest 3 tax-years of data per EIN.
Delete older per-year cache entries. Log each pruned entry in a breadcrumb.

---

## Output Document Catalog

All documents produced by the skill, organized by audience and purpose.

### Tier 1 — Required for MeF E-File Submission
*Hand these to your e-file provider. These constitute the return.*

| Document | File | Notes |
|---|---|---|
| Return data (all parts + schedules) | `artifacts/form990-dataset.json` | Primary input for provider data entry or JSON import |
| Schedule O narratives | `artifacts/schedule-o-narratives.md` | Paste into provider UI for Part VI and other "describe" lines |
| Schedule B — IRS copy | `artifacts/schedule-b-filing.md` | Full donor names + addresses — IRS only; never post publicly (IRC §6104(d)(3)(A)) |
| Other triggered schedules | `artifacts/schedule-<letter>.md` | A, D, G, I, L, M, R — include all triggered letters |
| **Form 8453-EO** | *Generated by e-file provider* | Officer signature authorization; your provider creates this — officer signs it before transmission |

### Tier 2 — Required Before Officer Signs
*The signing officer (and CPA if involved) must review these before authorizing e-file.*

| Document | File | Notes |
|---|---|---|
| Reference filled PDF | `artifacts/form990-reference-filled.pdf` | Visual copy of the completed return; review every part |
| CPA quality review report | `artifacts/cpa-review-report.md` | All 30 Q-F gate results; all Gate-1 must show PASS |
| CPA preparation memo | `artifacts/cpa-memo-fy<tax_year>.md` | Explains methodology, non-obvious decisions, open items |
| E-file handoff packet | `artifacts/efile-handoff-packet.md` | Filing instructions, provider options, CA companion filings |

### Tier 3 — Supporting Workpapers (retain; not submitted to IRS)
*Keep these for audit trail and record retention (7-year minimum).*

| Document | File | Notes |
|---|---|---|
| Statement of activities | `artifacts/statement-of-activities.md` | Revenue/expense reconciliation |
| Balance sheet | `artifacts/balance-sheet.md` | BOY + EOY asset/liability detail |
| Functional expense matrix | `artifacts/functional-expense.csv` | Part IX source data (Program/M&G/Fundraising splits) |
| CoA mapping | `artifacts/coa-mapping.csv` | Every budget line mapped to a 990 line with confidence score |
| Reconciliation report | `artifacts/reconciliation-report.md` | Big-square closure verification (Q-F2) |
| Plan file | `form990-plan-<year>.md` | Full preparation journal — machine state, decisions, breadcrumbs |

### Tier 4 — California Companion Filings (separate from Form 990)
*These are NOT produced by this skill. File separately with the indicated agency.*

| Form | Agency | Trigger | Due date |
|---|---|---|---|
| **Form 199** | CA Franchise Tax Board | Gross receipts > $50,000 | May 15 (same as federal 990) |
| **RRF-1** | CA AG Registry of Charitable Trusts | Registered charity | May 15 |
| **CT-TR-1** | CA AG Registry | GR < $2M AND no audit | With RRF-1 |
| **SI-100** | CA Secretary of State | All CA nonprofit corps | Biennial; within 90 days of incorporation anniversary |

> CA 199 and RRF-1/CT-TR-1 are NOT substitutes for the federal 990. FTB does not accept
> the federal 990 in place of Form 199.

### Tier 5 — Public Inspection Requirements (IRC §6104)
*The organization must make these available for public inspection.*

| What | How long | Format |
|---|---|---|
| Most recent **3 years** of Form 990 | 3 years from due date | At principal office during business hours; copy within 30 days of written request |
| Form 1023 (exemption application) + IRS determination letter | Permanent | Same |
| **Not required publicly:** Schedule B donor names | — | Do not disclose; provide `schedule-b-public.md` (redacted) version only |
| Schedule B — public copy | `artifacts/schedule-b-public.md` | "Anonymous" names, addresses stripped — use for public inspection, website posting, Candid/GuideStar |

> Posting on GuideStar/Candid or the org's own website satisfies public inspection
> requirements without responding to individual requests. See Part VI Line 18.

### Tier 6 — Optional (Recommended for Well-Run Nonprofits)
*Not required, but common at organizations with active boards or CPA relationships.*

| Document | Purpose | Current skill support |
|---|---|---|
| Board presentation summary | High-level financial narrative for non-accountant board members | ✗ Not produced — draft manually from CPA memo |
| Internal control memo | CPA identifies risks, management letter items | ✗ Not produced — CPA prepares separately |
| 1099-NEC + Form 1096 confirmation | Evidence that contractor filings were made by Jan 31 | ✗ Not produced — confirm with payroll processor |
| CA Form 199 worksheet | Pre-fill for CA FTB filing | ✗ Not produced — use CA FTB form directly |

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
  ├─ artifacts/cpa-memo-fy<tax_year>.md      (summary memo for signing CPA)
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

