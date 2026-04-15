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
