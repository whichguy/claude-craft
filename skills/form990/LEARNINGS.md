# Form 990 Skill — Learnings

Append-only observations and recent-run notes. Each entry: date + phase + finding.
Populated after each substantive run. Analogous to the `learningsText` injection idiom
from `ideate-system-prompt/SKILL.md §learningsText`.

---

## 2026-04-11 — Initial skill build

- **E-filing pivot is the most important context to inject early.** Users who ask to "fill
  out the PDF" uniformly expect to file via the PDF. The P0 banner must be prominent: the
  PDF is a reference/review artifact only; MeF is the actual filing channel.

- **Part I null placeholder (structural, not a bug).** `dataset_core.json` declares
  `"I": null` intentionally — it is a structural placeholder so the P7 merger can
  take `dataset_rollup.parts.I` verbatim. Do not interpret null as "missing data."

- **Schedule B two-output contract is not optional.** Even for organizations that think
  "we have no large donors" — if Schedule B is triggered by Part IV, both the filing
  version and the public version must be produced. The public version's redaction is
  legally required (IRC §6104(d)(3)(A)), not optional privacy hygiene.

- **Content-SHA256 CAS beats flock on macOS.** macOS `flock(2)` is advisory; any
  text editor the user opens can overwrite the plan file mid-session. The CAS pre-image
  comparison is the only reliable lost-write backstop.

- **Circuit breaker is fact-centric.** Lazy-verification regressions detected inside
  a phase Pre-check still count toward the 3-strike rule — the breaker cannot be escaped
  by deferring a flapping fact past resume-time.

- **AcroForm (pdftk-java) is primary; pypdf coordinate-overlay is the fallback.**
  E1 (2026-04-11) confirmed the 2025 f990.pdf ships with 1307 AcroForm fields —
  name-based fill via pdftk-java FDF intermediate is the primary path. Coordinate-
  overlay applies only when pdftk-java is unavailable. Earlier guidance stating
  "coordinate-overlay is primary" was based on pre-E1 assumptions and is superseded
  by the E1 empirical result.

- **Drive headRevisionId may not be available.** If the Drive MCP doesn't expose
  Revisions API data, fall back to `{modifiedTime, tab_snapshot_sha256}`. E2 experiment
  documents which path applies to the current host.

---

---

## 2026-04-14 — FY2025 Fortified Strength P0–P8 live run

- **PST tab is current-year only.** The "Public Support Test" tab in Tiller tracks the
  current fiscal year only — not the 5-year history required by IRS Schedule A. Always
  read each prior-year P&L tab directly (P&L Report 2024, P&L Report 2023, etc.) using
  the section-tracking exec pattern. The PST tab is useful only as a current-year sanity
  check. (P6 Fortified Strength — confirmed via Logger read 2026-04-13.)

- **Section-tracking required for P&L reads.** Both the INCOME and EXPENSE sections of
  the Tiller P&L have rows labeled "Total Fundraising" and "Total Program Service
  Revenue." A simple label-match loop overwrites the income subtotals with expense
  subtotals. The fix: track whether you're in the INCOME or EXPENSE section and only
  grab the relevant total from each. (P6 Fortified Strength.)

- **509(a)(2) is FULL EXCLUSION of DQ persons — never a cap.** SCHEDULES.md previously
  documented a 1% per-donor cap on public contributions for 509(a)(2). This is wrong.
  The correct rule: disqualified persons are excluded entirely via Line 7a (no cap, no
  floor). The 1%/$5,000 threshold (Line 7b) applies only to non-DQ persons' PSR/UBI
  (Lines 2–3), never to contributions (Line 1). The 2% per-donor cap is the 509(a)(1)
  rule. (SCHEDULES.md corrected 2026-04-14.)

- **Line 7b is per-year per-person, not 5-year aggregate.** The cap is
  `max($5,000, 1% × five_yr_total_support)` (derived from the 5-yr total, same for all
  years), but the comparison is made **independently for each year**: if a single non-DQ
  person's PSR/UBI in year Y exceeds the cap, only year Y's excess is excluded. A member
  paying $8,000/year for 5 years has $0 Line 7b impact if $8,000 < cap each year — the
  5-year aggregate ($40,000) is never compared to the cap. The IRS form has per-year
  columns (a)–(e) for Line 7b entries. Aggregating first then comparing over-deducts.
  For orgs where every member's annual payment is below max($5,000, 1% of 5-yr support),
  Line 7b = $0 definitively without per-member data.

- **Part XI Line 5 placeholder not auto-resolved by P7.** `dataset_core.json` Part XI
  Line 5 retains its P5-era placeholder after P7 runs because P7 only writes to
  `dataset_rollup.json` (Parts I + reconciliation). The correct P7 value must be manually
  backfilled into `dataset_core.json` Part XI.5 after Q-F2 PASS is confirmed.
  (Caught in quality review 2026-04-14; fix: set to actual reconciled value -9284.37.)

- **BudgetTools container-bound copy is the correct exec path.** The org budget sheet
  lives in an org Google Drive account invisible to personal-account Drive MCP. The
  correct exec chain: mcp-gas-deploy exec → BudgetTools scriptId (1E8rYsyb...) →
  SpreadsheetApp.openById('1VbiVbBxjQUwMaN4...') [disposable copy]. getActiveSpreadsheet()
  returns null in programmatic exec context. (P2–P7 Fortified Strength.)

- **CA companion filings confirmed required for CA 501(c)(3)s.** CA Form 199 (FTB) +
  RRF-1 + CT-TR-1 (AG Registry) are required when GR > $50,000. All three are due the
  15th day of the 5th month after FY end (May 15 for calendar-year orgs) — same deadline
  as federal 990. CA Form 199 is NOT replaced by the federal 990; FTB requires its own
  filing. (Confirmed at P8 review; Part V Line 3b triggers this check.)

- **Part VII requires W-2 Box 1 gross wages — net pay is not acceptable.** Tiller records
  net payroll deposits (after employee withholding). Part VII Section A requires W-2 Box 1
  reportable compensation (gross wages minus pre-tax deductions). Never use Tiller net pay
  figures for Part VII; request the Gusto W-2 summary. (Q-F6 NEEDS_UPDATE P8 Pass 1.)

- **Line 7b cap is PER-YEAR not 5-year (IRS primary source confirmed 2026-04-14).** Schedule A
  Part III Line 7b instructions say "1% of the amount on line 13 **for the applicable year**" —
  "applicable year" = each year's annual column total (columns a–e), NOT the 5-year column (f)
  total. The cap formula is `cap[y] = max($5,000, 0.01 × total_support[y])` with a different
  value for each year column. SCHEDULES.md corrected accordingly. For orgs with annual support
  below $500K, the $5,000 floor always applies (1% < $5K), making Line 7b = $0 regardless of
  interpretation. (IRS Schedule A Part III instructions fetched via WebFetch 2026-04-14.)

- **Part IX Line 10 = EMPLOYER taxes only — never commingled employee taxes.** Tiller captures
  combined payroll tax deposits (both employer and employee shares) as a single bank debit.
  Part IX Line 10 must reflect ONLY the employer's share (employer FICA, FUTA, state SUI/ETT).
  Employee withholdings are included in gross wages (Line 7), not Line 10. Always use the
  payroll processor's "Employer Taxes" column (e.g., Gusto column 3). (Tiller had $34,088
  vs correct Gusto employer-only $10,625 — $23K discrepancy caught at P8 Pass 1.)

- **Get gross W-2 wages from payroll processor, not Tiller.** Tiller records NET paychecks
  (after employee withholding). Part IX Line 7 and Part VII require W-2 Box 1 gross wages.
  Request the Gusto Payroll Journal Report (or equivalent) at P1 or P5. The gross/net
  difference can be large: in FY2025, Tiller showed $100,948 vs Gusto gross $129,011 (+$28K).

- **Prior year 990 EOY ≠ Tiller BOY is common.** CPA preparers often use main checking
  account only; Tiller captures all accounts including PayPal and CC liabilities. When they
  diverge, accept the FILED prior year number as Part X BOY and enter a prior period
  adjustment in Part XI Line 9. Compute: `xi_adj = EOY_actual - (BOY_filed + revenue - expenses)`.
  Document in Schedule O. (FY2025: filed 2024 EOY $35,901 vs Tiller BOY $40,991 → $5,090 adj.)

- **Schedule I Part III = aggregate reporting only.** For grants to domestic individuals,
  Schedule I Part III requires: (a) type of grant, (b) number of recipients, (c) total
  cash grant — NOT individual names/addresses. Individual PII is NOT required in Part III.
  (Confirmed by FY2024 CPA precedent: "Scholarship to attend competitions, 23 recipients,
  $7,350" without any individual names.) Only Part II (grants to domestic organizations) lists
  specific grantees.

- **Competition assistance classification: Schedule I > Part IX Line 24 for consistency.**
  Voucher discount codes for competition attendance — even if available to all geographic
  region members without individual selection — should be treated as Schedule I grants (not
  program expense) when the prior year CPA used Schedule I for similar items. Economic
  benefit flows to individuals (reducing their out-of-pocket cost), which supports grants
  treatment. Changing treatment mid-stream creates audit risk. (FY2025 Fortified Strength:
  $21,980 to 102 athletes.)

- **Do Family leaves board but remains DQ.** Substantial contributors (IRC §4946) remain
  disqualified persons even after leaving the governing board. Their contributions in all
  years must still be excluded from Schedule A Line 7a (DQ person exclusion) for the entire
  5-year window. Also verify: board composition changes trigger Part VI Line 2 updates and
  may change the count of independent members (Line 1b).

- **Prior year Schedule A % must come from filed prior year return, not re-computation.**
  If the prior year CPA used a different Schedule A methodology (e.g., reporting all revenue
  as Line 1 contributions instead of separating PSR into Line 2), the Schedule A % they
  computed is what appears in the filed return. Our Line 16 "prior year %" must reference
  THEIR result, even if our methodology would produce a different number. Always read the
  prior year Schedule A Part III Line 15 directly from the filed return.

- **Board family relationships: two married couples on the board = Part VI Line 2 YES.**
  When two or more board members are spouses, Part VI Line 2 = YES. Document each pair
  in Schedule O narrative. No Schedule L is triggered unless there are actual financial
  transactions between the org and those individuals (beyond charitable donations to the org).

- **OQ-12 pattern: small unclassified Tiller entries.** "Owed by others recovery" ($528.26)
  is a typical Tiller artifact — a prior-year A/R or inter-account transfer that shows up
  as income. Classify at P5 or include in Part IX M&G. Don't leave in UNCATEGORIZED.
  Ask the user: "Was this a reimbursement from someone, a returned check, or a bank credit?"

*[Append new entries below after each run — never delete existing entries]*

<!-- BEGIN MACHINE LEARNINGS (auto-appended; do not hand-edit) -->
<!-- END MACHINE LEARNINGS -->

- **PERSONA.md and PLAN-TEMPLATE.md §Persona are separate copies.** When either changes,
  update the other. Drift was detected 2026-04-15 (PLAN-TEMPLATE.md was more condensed
  without tracking).

---

## TODO — Skill Improvements from FY2025 Live Run (2026-04-14)

Identified gaps in the skill based on real-world execution. Add to the next hardening pass.

**P1 (Source Discovery):**
- TODO-1: At P1, explicitly prompt for the Gusto (or payroll processor) W-2 annual summary
  PDF. Do not defer to P5. Tiller net pay is always wrong for Part VII/IX. Add to P1 discovery
  checklist alongside bank statements and donor list.
- TODO-2: At P1, check if the org has filed 990s in prior years via IRS TEOS
  (apps.irs.gov/app/eos/) and download the most recent filed 990 PDF. Extract: (a) EOY net
  assets (becomes our BOY), (b) Schedule A Part III Line 15 (prior year %), (c) board composition,
  (d) Schedule I methodology. Store in plan file as `prior_990_analysis`.

**P2 (CoA Mapping):**
- TODO-3: When mapping payroll lines, always check for commingled employer/employee taxes in
  Tiller "Payroll Taxes" category. Prompt: "Does your bookkeeping system show payroll taxes
  as a single lump (employer + employee deposits) or separately? If combined, request the
  Gusto Employer Taxes column." Flag for Part IX Line 10 correction.

**P5 (Core Parts):**
- TODO-4: At P5 Part X, compare BOY from Tiller against the prior year 990 EOY (if filed).
  If they differ, auto-compute the prior period adjustment amount and pre-populate Part XI
  Line 9 + Schedule O narrative. Do not silently accept Tiller BOY if a filed prior year
  exists with a different number.
- TODO-5: Explicitly ask: "What did competition assistance or scholarships look like? Were
  they: (a) voucher/discount codes, (b) direct cash payments to athletes, or (c) payments
  to competition organizers on behalf of athletes?" Each path has a different classification.
  Cross-check against prior year Schedule I. Default to prior year treatment for consistency.

**P6 (Schedule Generation):**
- TODO-6: For Schedule A Line 16, always fetch the prior year's Schedule A Part III Line 15
  from the prior year filed 990, not from re-computation. The prior year CPA's methodology
  may differ from ours — use their reported % verbatim in Line 16.
- TODO-7: After computing Schedule A 5-year %, cross-check the Part III PSR amounts against
  what was included vs. excluded (DQ person entries). Verify: are all board member donations
  properly classified as DQ contributions (full exclusion, Line 7a)?

**P7 (Rollup):**
- TODO-8: During P7 reconciliation, detect when `revenue - expenses ≠ EOY - BOY` by more
  than $1,000 and automatically prompt the user: "The math doesn't close. Likely causes:
  (1) prior period adjustment needed — does the BOY match the filed prior year EOY? (2) Is
  there a Tiller UNCATEGORIZED line that represents a real expense?"

**Schedule I:**
- TODO-9: Add a Schedule I aggregate-format template to SCHEDULES.md that generates the
  Part III table without individual PII: type of grant, recipient count, total. Note that
  this is always appropriate for competition-related youth assistance.

**General:**
- TODO-10: Add `prior_year_990_eoy_net_assets` as a required key_facts field at P0. At P0
  Transition, prompt: "Do you have a filed prior year 990? If yes, what were the reported
  EOY net assets on that return?" This prevents the BOY discrepancy from surfacing at P8.
- TODO-11: Add a "board change detector" at P0: compare current CA Sec of State filing
  (if available) against Part VII from prior year 990. If different directors, prompt for
  transition date, departing/joining members, and whether Part IV Line 4 (significant changes
  to governing documents) was triggered.

---

## Quality Gate Improvements (2026-04-14) — from FY2025 live-fire run

New Q-F gates and SKILL directives identified as missing. Each maps to a concrete gap
caught during the live-fire execution. Add to QUESTIONS.md + SKILL.md in next hardening pass.

---

### New Quality Gates

**Q-F19 (Gate-2) — Payroll Tax Composition: Part IX Line 10 = Employer Share Only**

Proposed definition:
```
Trigger: Part IX Line 7 (salaries) > 0
Check: Line 10 / Line 7 ≤ 15%
  - Employer FICA (7.65% up to SS wage base) + FUTA (0.6% on first $7K/employee) +
    state SUI/ETT ≈ 9–13% of gross wages total.
  - If Line 10 / Line 7 > 15%, the bookkeeping system likely commingled employee
    withholdings (income tax, employee FICA) into the payroll tax deposit bucket.
  - FAIL pattern: Tiller captures combined employer+employee payroll deposits as a
    single cash transaction; Line 10 shows as ~30%+ of Line 7.
Remediation: obtain Gusto (or payroll processor) "Employer Taxes" column; replace Line 10
with employer-only amount.
```
Gap exposed: FY2025 Tiller had $34,088 vs correct Gusto employer-only $10,625 (24%
vs 8.2% of gross wages). A >15% ratio would have flagged this immediately.

---

**Q-F20 (Gate-1) — Part X BOY = Filed Prior Year 990 EOY**

Proposed definition:
```
Trigger: A prior year Form 990 was filed with the IRS
Check: Part X Line 32 BOY == prior_990_analysis.eoy_net_assets
  - If equal: PASS
  - If different AND Part XI Line 9 contains a prior period adjustment that exactly
    reconciles the difference: PASS (with Schedule O explanation required)
  - If different AND no prior period adjustment: FAIL
Pass criteria:
  - Tolerance $0 (exact match or prior period adj must account for every dollar)
Remediation: compute `prior_period_adj = tiller_boy - filed_prior_eoy`; enter in
Part XI Line 9; document in Schedule O describing what accounts the CPA excluded.
```
Gap exposed: FY2025 filed 2024 EOY = $35,901; Tiller BOY = $40,991; $5,090 difference
required prior period adjustment. No gate caught this until manual comparison at P8.
**Gate-1** because IRS e-file systems reject returns where BOY ≠ prior EOY without explanation.

---

**Q-F21 (Gate-2) — Insider Transaction Investigation: Facility and Vendor Ownership**

Proposed definition:
```
Trigger: Any vendor paid >$10,000 during the year (especially occupancy/facility lease)
Check: For each such vendor, the skill must explicitly verify: "Does any current or former
  officer, director, trustee, or key employee (or their family member) have an ownership
  interest ≥ 35% in this vendor?"
  - If NO for all vendors: Part IV Lines 28a/28b = No → PASS
  - If YES for any vendor: Part IV Line 28a = Yes; Schedule L Part IV required → NEEDS_UPDATE
Pass criteria: the question was actively asked and answered for every vendor >$10K, not
just defaulted to No.
```
Gap exposed: FY2025 CrossFit San Ramon ($47K lease) was flagged in CPA delta analysis but
not proactively asked until P8 quality review. A gate would surface this at P4 (Part IV
checklist phase) instead.

---

**Q-F22 (Gate-3, Advisory) — Schedule A DQ List Reflects Current Board + Prior Contributors**

Proposed definition:
```
Trigger: Board composition changed between prior year and current year
Check: Any person who left the board during the current year but was a substantial
  contributor (gave >$5,000 AND >2% of cumulative contributions) must remain on the
  DQ exclusion list for Schedule A Line 7a. Leaving the board does NOT remove DQ status
  under IRC §4946 for substantial contributors.
Pass criteria: DQ list includes all current board members with past contributions AND
  all prior board members who were substantial contributors within the 5-year window.
```
Gap exposed: Christine Do and Quoc Do left the board in 2025 but their prior contributions
(2021–2024, ~$10K/yr) still required full DQ exclusion in the 2025 Schedule A.

---

**Q-F23 (Gate-3, Advisory) — Schedule A Methodology Consistency with Prior Year**

Proposed definition:
```
Trigger: A prior year Schedule A Part III is available
Check: Our Schedule A methodology (Line 1 vs Line 2 classification, DQ person identification)
  is consistent with the prior year CPA's approach. Key tests:
  (a) Did prior year include PSR in Line 2? If yes, we must include it.
  (b) Did prior year include or exclude Wiese/Do family in Line 7a? If excluded (zero Line 7a),
      document the methodology difference in Schedule O.
  (c) If prior year result was 100% and ours is materially different, explain the difference.
Pass criteria: consistent with prior year OR methodology difference documented in Schedule O.
```
Gap exposed: FY2024 CPA Schedule A showed 100% (PSR not in Line 2; no DQ exclusions);
our FY2025 Schedule A shows 74.41% (PSR in Line 2; full DQ exclusions). Line 16 shows 100%
(prior year), which will prompt CPA questions about the methodology difference.

---

### Q-F6 Extension (Gate-1) — Add Part IX Line 7 Source Verification

Current Q-F6 verifies Part VII Section A compensation ties to W-2/1099. Extension needed:

```
ALSO CHECK: Part IX Line 7 (other salaries and wages)
  - Line 7 must equal the sum of W-2 Box 1 gross wages for all non-officer employees
  - Not net pay (Tiller), not gross wages minus any benefits
  - Cross-check: sum(gusto_total_earnings_for_non_officers) == Line 7 col_a
  - Red flag: if Line 7 matches Tiller net payroll deposits exactly (implying net pay used)
```
Gap exposed: FY2025 had $100,948 (net pay) in Line 7; correct was $129,011 (gross wages).
A $28K understatement of compensation expense that Q-F6 didn't catch.

---

### Q-F11 Extension (Gate-2) — Source Requirement for Schedule A Line 16

Current Q-F11 checks that prior-year comparatives are present. Extension needed:

```
ALSO CHECK: Schedule A Part III Line 16 source
  - Line 16 must reference the FILED prior year return's Part III Line 15
  - Must NOT be re-computed from our own data using a different methodology
  - Acceptable: "% from prior year filed return" even if methodology differs
  - Not acceptable: silently using our own re-computed value if a filed return exists
```
Gap exposed: FY2025 prior year CPA computed 100%; our re-computation would give ~74%.
These are methodologically different; Line 16 must show 100% from the filed return.

---

### New SKILL.md Directives

**PAYROLL_GROSS**: At P1 discovery, add "payroll provider annual summary" to the required
source artifact list. Template prompt: "Please provide the Gusto Payroll Journal Report
(or equivalent W-2/annual payroll summary) for the calendar year. This is required for
Part VII and Part IX Lines 5–10 — Tiller net pay cannot be used." Stage as `artifacts/
payroll_summary_<year>.pdf`. If absent by end of P1, create OQ with due date.

**PRIOR_990_EXTRACT**: At P1, after the general Drive/Gmail search, run a targeted search
for the prior year's filed Form 990. Read it and extract into `prior_990_analysis` in the
plan machine state: `{eoy_net_assets, schedule_a_pct, board_members, schedule_i_treatment,
w2_employee_count, part_ix_line7_amount, part_ix_line10_amount, efile_accepted: bool}`.
Gate P2 on this extraction — do not proceed without either the data or a documented reason
why the prior year is not available.

**BOY_RECONCILE_GATE**: At P7 Pre-check (or P5 if balance sheet is produced in P3), compare
`prior_990_analysis.eoy_net_assets` with `artifacts.balance_sheet BOY net assets`. If diff
> $500: (a) prompt user "Which is authoritative — the filed return or Tiller?", (b) if filed
return is authoritative, auto-compute the prior period adjustment and pre-populate Part XI
Line 9 + Schedule O narrative, (c) update Part X BOY to the filed return's EOY. This should
be a deterministic computation, not a discovery at P8.

**INSIDER_VENDOR_CHECK**: At P4 (Part IV checklist), for each vendor paid >$10,000 in the
year (read from CoA mapping), explicitly ask: "Does any current or former officer, director,
trustee, or key employee have an ownership interest ≥ 35% in [vendor name]?" Do not default
to No. Require an explicit yes/no from the user. The most common insider vendor for small
nonprofits: their training facility, shared office, or member vendor.

**DQ_PERSISTENCE_CHECK**: At P6 before computing Schedule A, after building the DQ persons
list from the current year: (a) load the prior year's board composition from `prior_990_
analysis.board_members`, (b) identify any person who appears in the prior year board but NOT
in the current year board, (c) for each departed board member, check if they were a substantial
contributor (gave >$5,000 AND >2% of cumulative contributions in any of the 5-year window
years). If yes, KEEP them on the DQ exclusion list and add a Schedule O note: "[Name] left
the board in [year] but remains a disqualified person as a substantial contributor under IRC
§4946."

**PAYMENT_PROCESSOR_1099K**: At P6 or P8, if PSR includes card-based membership fees
(common for Stripe/PushPress/Square integrations): (a) search Drive for the prior year 1099-K
from the payment processor, (b) verify that PSR reconciles to the 1099-K gross transaction
amount (differences should be explainable by non-card revenue, adjustments, or year-cutoff
timing), (c) if 1099-K > reported PSR, investigate whether unreported revenue exists.

---

### Summary Table

| ID | Tier | New/Extend | Description |
|---|---|---|---|
| Q-F19 | G2 | **NEW** | Part IX Line 10 / Line 7 ratio < 15% (employer taxes only) |
| Q-F20 | G1 | **NEW** | Part X BOY = filed prior year EOY (or prior period adj documented) |
| Q-F21 | G2 | **NEW** | Insider vendor investigation for transactions >$10K |
| Q-F22 | G3 | **NEW** | DQ list includes departed board substantial contributors |
| Q-F23 | G3 | **NEW** | Schedule A methodology consistent with prior year or documented |
| Q-F6 | G1 | **EXTEND** | Also check Part IX Line 7 = gross W-2 wages (not net pay) |
| Q-F11 | G2 | **EXTEND** | Schedule A Line 16 sourced from filed prior year return |
| PAYROLL_GROSS | Directive | **NEW** | P1: require payroll provider annual summary as source artifact |
| PRIOR_990_EXTRACT | Directive | **NEW** | P1: extract prior_990_analysis from filed return |
| BOY_RECONCILE_GATE | Directive | **NEW** | P7: auto-detect and compute BOY/prior-EOY discrepancy |
| INSIDER_VENDOR_CHECK | Directive | **NEW** | P4: explicit yes/no for each vendor >$10K re: insider ownership |
| DQ_PERSISTENCE_CHECK | Directive | **NEW** | P6: cross-check departed board members for DQ persistence |
| PAYMENT_PROCESSOR_1099K | Directive | **NEW** | P6/P8: reconcile PSR against 1099-K from payment processor |

---

## Quality Gate Improvements — Second Pass (2026-04-14)

Subtler patterns from the FY2025 live run not captured in the first TODO batch above.
All 7 items are distinct from TODO-1 through TODO-11 and Q-F19 through Q-F23.

---

### New Quality Gates (Second Pass)

**Q-F24 (Gate-3, Advisory) — Part I Prior Year Column Populated and Consistent**

Proposed definition:
```
Trigger: prior_990_analysis exists in plan machine state
Check: Part I "Prior Year" columns (Lines 8-19) must be populated with data from the
  filed prior year 990 Part I, not left blank.
  - Line 8 prior year = prior_990_analysis.contributions
  - Line 9 prior year = prior_990_analysis.program_service_revenue
  - Line 12 prior year = prior_990_analysis.total_revenue
  - Line 18 prior year = prior_990_analysis.total_expenses
  - Line 19 prior year = revenue - expenses from prior year
Pass criteria: prior year column populated; values match filed prior year Part I within $1
  (rounding); if discrepancy, documented in plan.
```
Gap exposed: FY2025 dataset included `prior_year_comparison` block but the Part I
"Prior Year" columns in the 990 form template were never explicitly wired to it.
This leaves the prior year comparison columns blank on the printed reference PDF.

---

**Q-F25 (Gate-2) — Form 1096 Count Ties to Part V Line 1a**

Proposed definition:
```
Trigger: Part V Line 2a (1099-NEC/MISC count) > 0
Check: Part V Line 1a = the number on Box 3 of the corresponding Form 1096
  - If the org filed 1099-NECs for N recipients, a Form 1096 was required; Box 3 = N
  - Line 1a must equal N (or 0 if no 1099-MISC/NEC were filed)
  - Due date: 1099-NEC and 1096 must be filed by January 31
Pass criteria: Line 1a matches; user confirms 1099s and 1096 were actually filed (not
  just identified as required).
NEEDS_UPDATE pattern: "Part V Line 1a shows [N] but we cannot confirm Form 1096 was
  filed by January 31. Advise: contact your payroll processor or accountant to confirm
  filing. If not filed, penalties apply ($60-$630 per form)."
```
Gap exposed: FY2025 Redwood + Socal Coaching identified as 1099-NEC recipients; Part V
Line 2a set to 2 and Line 2b = Yes — but no gate confirmed the 1099s/1096 were actually
filed. Line 1a = 0 (per Part V in dataset) vs 2 expected is a discrepancy.

---

**Q-F26 (Gate-2) — Entity-Donor DQ Ownership Check**

Proposed definition:
```
Trigger: Any non-individual donor (company, LLC, foundation) contributed > $5,000 in ANY
  of the 5-year Schedule A window
Check: For each such entity, verify whether any officer, director, trustee, or key employee
  of the filing organization has a direct or indirect ownership interest ≥ 35% in the donor entity.
  - If YES → entity is a disqualified person; contributions excluded from Schedule A Line 7a
  - If NO → entity is a public donor; contributions included in Schedule A public support
  - If UNKNOWN → create OQ with "check business registration or ask CEO"
Pass criteria: all donor entities with >$5K contributions are either confirmed non-DQ or
  confirmed DQ with exclusion already applied.
```
Gap exposed: Garrison Engineering Inc. donated $22,825 (2021) + $13,300 (2022) = $36,125.
If any board member has ≥35% ownership in Garrison, these are DQ and must be excluded.
Sensitivity analysis showed public support remains >33⅓% either way — but the classification
is legally required regardless of materiality. This check was surfaced in wiki but never
executed as a formal gate step.

---

### Q-F18 Extension (Gate-3) — Part III Must Include Quantified Metrics

Current Q-F18 advises "Part III well-written (mission, 3 largest programs)." Extension needed:

```
ALSO REQUIRE (from 990 instructions for Part III):
  - For each of the 3 largest programs (by expense), include:
    (a) Number of individuals/beneficiaries served (e.g., "81 youth athletes")
    (b) At least one specific measurable outcome (e.g., "16 youth competed at nationals")
    (c) Expense total and grant amount (from Part IX)
    (d) Revenue from that program (if any)
  - First-year full 990 filers (transitioning from 990-EZ) commonly omit metrics
    because 990-EZ required only a brief description
Red flag: Part III description that is entirely narrative without any numbers
```
Gap exposed: The FY2025 delta analysis doc explicitly called out this requirement as
"EXPANDED: Part III - Program Service Accomplishments." Our P5 dataset has program
accomplishments marked "See Schedule O" but the Schedule O narrative may lack specific
counts and metrics.

---

### Q-F5 Extension (Gate-2) — 1099-NEC Filing Confirmation (Not Just Count)

Current Q-F5 checks that W-2/1099 counts tie to filings. Extension needed:

```
ALSO CHECK: 1099-NEC and Form 1096 ACTUAL filing
  - Q-F5 currently verifies that Part V Lines 2a (W-2 count) and 2b tie to payroll records
  - Extension: for any vendor identified as needing a 1099-NEC (payments ≥ $600,
    non-corporate), explicitly ask: "Did you file the 1099-NEC and Form 1096 by January 31?"
  - If YES: mark Q-F5 PASS for this sub-check
  - If NO: NEEDS_UPDATE — late filing penalties may apply; advise to file immediately
    (corrected/late filing is still better than non-filing)
```

---

### New SKILL.md Directives (Second Pass)

**PROG_METRICS**: At P5 (Part III program accomplishments), for each of the three largest
programs by expense, collect at minimum: (a) number of individuals served, (b) one
quantified outcome (competitions, awards, training hours, etc.). Pre-populate from
plan file's prior year accomplishments data if available. The delta analysis doc
identified this as the most commonly underspecified section for 990-EZ-to-990 transitions.

**ENTITY_DONOR_CHECK**: At P6 (Schedule A preparation), for each non-individual donor
(business entity, LLC, foundation, DAF) that contributed more than $5,000 in ANY of the
5-year Schedule A window: ask "Does any current or former officer, director, trustee, or
key employee of [org] have a direct or indirect ownership interest ≥ 35% in [entity]?"
Create an OQ if unknown. This is distinct from the individual DQ check and the insider
vendor check — it specifically addresses corporate donors.

**PART_I_PRIOR_YEAR**: At P7 (Part I rollup), after computing current-year Part I values,
auto-populate the Prior Year column from `prior_990_analysis` if available. Specifically:
contributions, PSR, investment income, other revenue, total revenue, grants, benefits,
salaries, other expenses, total expenses, and revenue-less-expenses. Store in
`dataset_rollup.parts.I.prior_year`. If prior_990_analysis is absent, leave as null but
flag as Q-F24 NEEDS_UPDATE.

**DISCLOSURE_ACCURACY**: At P6 (Schedule O finalization), when populating the Part VI
Line 18 public availability statement: (a) verify that any named third-party site is still
active (GuideStar → Candid, etc.), (b) check whether the org has a website where the 990
can be posted (Part VI Line 18 "Own website" checkbox), (c) if no website, default to
"Upon request" + "Another's website (www.candid.org or apps.irs.gov)."

---

### Summary Table (Second Pass)

| ID | Tier | New/Extend | Description |
|---|---|---|---|
| Q-F24 | G3 | **NEW** | Part I Prior Year column populated from filed prior year return |
| Q-F25 | G2 | **NEW** | Form 1096 count = Part V Line 1a; 1099s confirmed actually filed |
| Q-F26 | G2 | **NEW** | Entity donors >$5K checked for ≥35% board member ownership (DQ) |
| Q-F18 | G3 | **EXTEND** | Part III must include quantified metrics (people served, outcomes) |
| Q-F5 | G2 | **EXTEND** | 1099-NEC filing confirmation, not just count identification |
| PROG_METRICS | Directive | **NEW** | P5: collect quantified program metrics for Part III |
| ENTITY_DONOR_CHECK | Directive | **NEW** | P6: check corporate donors for ≥35% board ownership |
| PART_I_PRIOR_YEAR | Directive | **NEW** | P7: auto-populate Part I Prior Year column from prior_990_analysis |
| DISCLOSURE_ACCURACY | Directive | **NEW** | P6: verify public availability site is still active and accurate |

---

### Complete Gate Catalog After Both Passes

Original (Q-F1..Q-F18) + First pass (Q-F19..Q-F23) + Second pass (Q-F24..Q-F26):

| ID | Tier | Status |
|---|---|---|
| Q-F1..Q-F9 | G1 | Existing |
| Q-F10..Q-F18 | G2/G3 | Existing |
| Q-F19 | G2 | NEW — employer payroll tax ratio |
| Q-F20 | **G1** | NEW — BOY = filed prior year EOY |
| Q-F21 | G2 | NEW — insider vendor ownership |
| Q-F22 | G3 | NEW — DQ persistence after board departure |
| Q-F23 | G3 | NEW — Schedule A methodology consistency |
| Q-F24 | G3 | NEW — Part I prior year column |
| Q-F25 | G2 | NEW — Form 1096 and 1099-NEC filing confirmation |
| Q-F26 | G2 | NEW — entity-donor DQ ownership check |
| Q-F6 | G1 | EXTEND — add Part IX Line 7 gross wages check |
| Q-F11 | G2 | EXTEND — Schedule A Line 16 from filed return |
| Q-F18 | G3 | EXTEND — require quantified metrics in Part III |
| Q-F5 | G2 | EXTEND — add 1099-NEC filing confirmation |

## FY2025 Live Run — Session e8817f27 (2026-04-15)

### Learnings applied to task backlog (see TODO items in form990 skill)

**P2 / CoA Mapping:**
- Tiller Categories tab `Group` field defines Program/M&G/Fundraising — P2 must read this tab directly, not infer from P&L category labels alone
- Merchandise Revenue ($1,528) is inside the "Fundraising" group in Tiller but maps to Part VIII Line 10 (sales of inventory), not contributions — P2 must handle this split
- Scholarship Donations negative income ($-1,580) = donation reversal → reduce Line 1 contributions, not Line 2 PSR

**P3 / Financial Statements:**
- Tiller net payroll ≠ 990 gross wages: ALWAYS flag "payroll lines require Gusto/payroll-provider reconciliation — do not use Tiller net paychecks as Part IX Line 7"
- Tiller combined payroll tax deposits ≠ employer-only: ALWAYS flag Part IX Line 10 requires employer-only FICA/FUTA from Gusto

**Part VIII / Revenue:**
- Merchandise COGS appear in Tiller expense total — must be EXCLUDED from Part IX and shown only in Part VIII Line 10b
- Part VIII Line 12 ≠ Tiller total income (because COGS nets in Part VIII, not Part IX); typical difference ≈ COGS amount

**Part X / Balance Sheet:**
- Credit card balances (personal cards used for org expenses) show as liabilities in Tiller — Part X Line 17 must capture these, not assume $0 liabilities

**Part XI / Reconciliation:**
- If Part XI Line 9 < $500 after computing from actual balance sheet, treat as rounding — no Schedule O narrative required
- Prior period adjustment can collapse to near-$0 if user corrects Tiller BOY data between sessions

**Part III / Program Accomplishments:**
- IRS expects: (1) headcount, (2) hours of service, (3) named events/competitions, (4) notable achievements (Team USA selections etc.)
- Hours formula: (weekly_schedule_hours × operating_weeks) − individual_holiday_hours
- Voucher/grant programs: explicitly state whether open to community beyond org membership (important for Schedule A public benefit narrative)

**P9 / PDF Fill:**
- 2025 f990.pdf has 1,307 AcroForm fields (XFA form, Designer 6.5, mod date 2025-12-12)
- XFA template stream (Item 5 of XFA array) contains `<assist><speak>` labels for each field — extract via regex to build field→label mapping
- pypdf `update_page_form_field_values()` works for AcroForm layer; XFA layer may override in Adobe Reader
- Short field names end with `[0]` (e.g. `f1_28[0]`) — must use full XFA path for fill dict keys
- Field map saved to `f990-field-map-2025.json` for reuse in future tax years
