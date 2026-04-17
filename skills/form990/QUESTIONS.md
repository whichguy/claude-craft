# Form 990 Skill — CPA Quality Gate Catalog

**Q-F1..Q-F26** in three tiers. Import this file into every Q-F evaluation pass;
do not duplicate definitions in other files.

Gate output contract:
- `PASS` — criteria met, no edits required
- `NEEDS_UPDATE` — defect found; MUST include `[EDIT: <instruction> → <target-phase-or-file>]`
- `N/A` — question does not apply to this org/variant; brief reason required

**C3 — User-facing translation of `[EDIT: ...]` directives:**
Machine `[EDIT: ...]` directives are for skill routing — not for display to the user.
Every `NEEDS_UPDATE` output MUST also include a `[USER: ...]` companion line written
in plain language the Executive Director can understand. Example:

```
Q-F3: NEEDS_UPDATE
[EDIT: Adjust functional-expense.csv Line 7 allocation → P3]
[USER: The Program, Management, and Fundraising columns for "Staff salaries" don't add
up to the total. I'll go back and fix the expense breakdown — this is a required IRS check.]
```

The `[USER: ...]` line:
- Uses plain language (no IRS jargon unless explained in parentheses)
- Explains *what is wrong* and *what will happen next* — never just echoes the machine directive
- Is displayed in the status UI under "What I'm fixing" during the convergence loop

Memoization: Gate-2 and Gate-3 questions auto-memoize after 2 stable PASS results in P8's
convergence loop. Gate-1 questions are NEVER memoized — re-evaluate every pass.

---

## Tier / Gate Summary

| ID | Tier | Name | Applies When |
|---|---|---|---|
| Q-F1 | **G1** | Correct form variant | always |
| Q-F2 | **G1** | Big-square reconciliation | always |
| Q-F3 | **G1** | Functional columns sum | always |
| Q-F4 | **G1** | Schedule A public-support computation | 501(c)(3) non-PF |
| Q-F5 | G2 | Part V 1099/W-2 count ties to filings | always |
| Q-F6 | **G1** | Part VII officer comp ties to W-2/1099 | always |
| Q-F7 | **G1** | Part I totals tie to downstream parts | always |
| Q-F8 | **G1** | Part IV fully answered; all yes → schedule | always |
| Q-F9 | **G1** | EIN + legal name + address match prior year | always |
| Q-F10 | G2 | ED/shared-cost time allocation documented | always |
| Q-F11 | G2 | Prior-year comparatives populated | always |
| Q-F12 | G2 | Fundraising expense > 0 if contributions > 0 | contributions > 0 |
| Q-F13 | G2 | Accounting method consistent year-over-year | always |
| Q-F14 | G2 | Schedule O covers every Part VI "describe" | always |
| Q-F15 | G2 | Signature block populated | always |
| Q-F16 | G2 | Source-discovery completeness | always |
| Q-F17 | G3 | Functional allocation methodology narrated | always |
| Q-F18 | G3 | Part III program accomplishments well-written | always |
| Q-F19 | G2 | Payroll tax artifact: Part IX Line 10/Line 7 ratio check | Tiller-sourced payroll data |
| Q-F20 | **G1** | BOY equals filed prior-year EOY | always |
| Q-F21 | G2 | Vendor >$10K insider-ownership check before P9 | always |
| Q-F22 | G3 | Departed board members DQ status for Schedule A | Schedule A required |
| Q-F23 | G3 | Schedule A Line 15 vs Line 16 divergence narrative | Schedule A required |
| Q-F24 | G3 | Part I Prior Year column sourced from filed prior return | always |
| Q-F25 | G2 | Part V Line 2a entity-type filter (corps/LLCs excluded) | 1099-NEC filers present |
| Q-F26 | G2 | Corporate donor ≥$35K board-ownership check for 509(a)(2) | 509(a)(2), corporate donors |
| Q-F27 | G2 | PSR reconciles to payment processor 1099-K | card-based PSR present |
| Q-F28 | G2 | No disallowed negative values | always |

---

## Full Definitions

### Q-F1 — Correct Form Variant (Gate 1)

**Purpose.** Verify the form variant (990 / 990-EZ / 990-N / HALTED-PF / HALTED-CHURCH) was
selected correctly using the conjunctive decision tree.

**Decision tree (verbatim — do not paraphrase):**
```
IF is_private_foundation:
    variant = HALTED-PF
ELIF is_church_or_6033a3_exempt:
    variant = HALTED-CHURCH
ELIF gross_receipts_3yr_average <= 50000:
    variant = 990-N
ELIF gross_receipts_current < 200000 AND total_assets_eoy < 500000:
    variant = 990-EZ          ← CONJUNCTIVE test; both prongs required
ELSE:
    variant = 990
```

**Pass criteria:**
- The correct branch was taken
- For 990-EZ: the Decision Log records the comparison of BOTH prongs (GR < $200K AND
  TA < $500K); a false conjunctive selection (only one prong checked) is NEEDS_UPDATE
- For 990-N: the Decision Log shows the 3-year averaging calculation (Rev. Proc. 2011-15 §3.01)
- For HALTED-*: a terminal breadcrumb names the exemption basis

**Common mistakes:**
- Treating 990-EZ as a disjunctive test (only checking GR < $200K or only checking TA < $500K)
- Using current-year gross receipts for the 990-N "normally ≤ $50K" test (must be 3-yr average)
- Failing to check private-foundation or church status before gross receipts thresholds

**NEEDS_UPDATE example:**
```
Q-F1: NEEDS_UPDATE — 990-EZ selected: GR prong only ($180K < $200K); TA = $650K ≥ $500K → full Form 990 required.
[EDIT: Re-run P0 variant decision tree; record both GR ($180K < $200K) and TA ($650K ≥ $500K)
comparisons in Decision Log; update form_variant to "990" in machine state → P0]
[USER: The form type was chosen based on only one of the two required tests. Since your total
assets exceed $500K, you need to file the full Form 990, not the short form. I'll re-run the
variant check and update the form type.]
```

---

### Q-F2 — Big-Square Reconciliation (Gate 1)

**Purpose.** Verify that the three core accounting anchors all hold.

```
Check 1 (operating): Part XI Line 3 = Part VIII Line 12 − Part IX Line 25
                     (operating excess/deficit = revenue − expenses — definitional)

Check 2 (BOY anchor): Part XI Line 4 = Part X Line 32 BOY column A
                      (beginning net assets agree between the two statements)

Check 3 (EOY anchor): Part XI Line 10 = Part X Line 32 EOY column B
                      (ending net assets agree — this is the primary anchor)
# Check 1 ≠ EOY − BOY when adj lines 5–9 are non-zero (endowment, unrealized gains)
```

Each check independently ≤ $1 rounding tolerance. An unexplained delta > $1 on any
check is NEEDS_UPDATE. If adjustment lines 5–9 are non-zero (unrealized gains, prior period
items, donated services, etc.), Check 1 will not equal (EOY − BOY); that is expected and
correct — only Checks 2 and 3 must hold in those cases.

**Pass criteria:**
- `reconciliation.line3_check == true` in `dataset_rollup.json`
- `reconciliation.boy_check == true` in `dataset_rollup.json`
- `reconciliation.eoy_check == true` in `dataset_rollup.json`
- `artifacts/reconciliation-report.md` exists and shows all three checks with arithmetic
- If cash-basis, Part XI Line 1 and Part VIII Line 12 agree

**NEEDS_UPDATE example:**
```
Q-F2: NEEDS_UPDATE — Part I net revenue ($12,000) vs Part X net-assets change ($14,500): unexplained $2,500 delta.
[EDIT: Re-examine Part X EOY vs BOY delta; identify source of $2,500 discrepancy; add
explanatory note to reconciliation-report.md and resolve in dataset_rollup.json → P7]
[USER: The math doesn't close — your revenue minus expenses doesn't match the change in net
assets. There's a $2,500 gap. I need to find where the discrepancy comes from before the
return can be filed.]
```

---

### Q-F3 — Functional Columns Sum (Gate 1)

**Purpose.** On every Part IX row, the three functional columns (Program Services, Management &
General, Fundraising) must sum to the total (Column A).

**Pass criteria:**
- For every row in `artifacts/functional-expense.csv`: `Col_B + Col_C + Col_D == Col_A`
- Tolerance: $0 (no rounding tolerance — these are reported figures)
- Rows with all-zero entries are acceptable (means no expense in that line)

**NEEDS_UPDATE example:**
```
Q-F3: NEEDS_UPDATE — Part IX Line 7 Col A ($45,000) ≠ B+C+D ($43,200); gap $1,800.
[EDIT: Adjust functional-expense.csv Line 7 allocation: add $1,800 to the Program column
(Column B) to reconcile to Column A total → P3 / artifacts/functional-expense.csv]
[USER: The salary row in your expense breakdown doesn't add up — the three columns
(Program, Management, Fundraising) are $1,800 short of the total. I'll fix the allocation
so they match.]
```

---

### Q-F4 — Schedule A Public-Support Computation (Gate 1)

**Purpose.** Verify the 5-year public-support test is correctly computed and the organization
passes the threshold for its stated public-charity basis.

**Algorithm — 509(a)(1) / §170(b)(1)(A)(vi) test:**
```
public_support_pct =
  (total_public_support_5yr − excess_contributions_from_top_donors)
  / total_support_5yr × 100

Passes if: public_support_pct ≥ 33⅓%
   OR if:  public_support_pct ≥ 10% WITH an attached facts-and-circumstances narrative
```

"Excess contributions" = amount any single donor gave above 2% of total 5-year support
(per Schedule A Part II instructions). The 2% threshold is computed ONCE over the full
5-year window — not applied annually per year.

**509(a)(2) test** (for fee-income charities) — see SCHEDULES.md §509(a)(2) Worksheet for
the full algorithm. Key structural rule that differs from 509(a)(1):
```
Schedule A Part III:
  Line 7a: FULL EXCLUSION of disqualified person contributions + PSR + UBI (no cap)
  Line 7b: Excess of any non-DQ person's PSR/UBI (Lines 2-3 only) THAT YEAR over
           max($5,000, 1% × that_year_Line13) — cap is PER-YEAR per IRS instructions
           ("1% of the amount on line 13 for the applicable year" — not column (f) total)
           Does NOT apply to contributions (Line 1)
  Public support = 5yr total − Line 7a − Line 7b
  Prong 1: public_support_pct ≥ 33⅓%
  Prong 2: investment_income_pct ≤ 33⅓%
  Both prongs required for 509(a)(2) PASS.
```
**Critical distinction from 509(a)(1):** 509(a)(1) uses a 2% per-donor cap on ALL
contributions from any single source. 509(a)(2) uses FULL EXCLUSION of disqualified
persons (Line 7a) — never a 1% or 2% cap on contributions. The 1%/$5,000 threshold
exists only for Line 7b (non-DQ PSR/UBI sources), not for contributions (Line 1).
For membership-based orgs where no single non-DQ member's PSR in any single year
exceeds max($5,000, 1% of that year's total support), Line 7b = $0.

**Pass criteria:**
- The correct test (509(a)(1) vs 509(a)(2)) is applied per `key_facts.public_charity_basis`
- 5 years of prior gross-receipts data are present in Schedule A worksheet
- For 509(a)(1): excess-contribution exclusions applied (or marked zero if no donor exceeds 2% of 5-yr total)
- For 509(a)(2): Line 7a (DQ person full exclusion) and Line 7b (non-DQ PSR/UBI excess) both documented
- If borderline (10%–33%), a facts-and-circumstances narrative exists in Schedule O

**NEEDS_UPDATE example:**
```
Q-F4: NEEDS_UPDATE — Schedule A public support = 28% (below 33⅓%); no facts-and-circumstances narrative in Schedule O.
[EDIT: Draft facts-and-circumstances narrative for Schedule O: describe donor diversity,
public programs, community use, geographic reach; reference IRS Reg §1.170A-9(f)(3) factors
→ P6 / artifacts/schedule-o-narratives.md]
[USER: Your public support percentage is 28%, which is below the 33⅓% threshold. This doesn't
mean automatic failure — the IRS allows a facts-and-circumstances explanation. I'll draft a
Schedule O narrative describing why your organization still qualifies as publicly supported.]
```

---

### Q-F5 — Part V Count Ties to Filings (Gate 2)

**Purpose.** Part V Line 1a (number of W-2s filed) must tie to the payroll provider's W-2 count
for the tax year. Part V Line 2a (number of independent contractors paid >$100K) must tie to
the count of 1099-NEC recipients in the 1099 register whose compensation exceeds $100K — not
the total number of 1099s filed. These are distinct counts; conflating them overstates Line 2a
for organizations with many small contractors.

**Note on Form 1096:** Line 1a is W-2 count only — it does NOT include Form 1096. Form 1096
is a separate transmittal form filed with the IRS alongside 1099-NECs/1099-MISCs. It is not
reported on Part V at all, but must be filed by January 31 if any 1099s were issued.

**Tier rationale (demoted G1→G2).** Tying these counts requires the payroll-provider export or
1099 register — primary sources that may not be available until P1 discovery is complete. The
skill drafts an email to the bookkeeper to request them (P1 open question). Once the source
lands, P8 re-evaluates. Failing to find these sources does NOT block P5 completion — it
creates an open question.

**Pass criteria:**
- W-2 count in Part V Line 1a matches payroll register W-2 row count for the tax year
- Contractor count in Part V Line 2a matches the number of 1099-NEC recipients whose
  compensation for the tax year exceeds $100K (NOT the total 1099 register row count)
- **1099-NEC filing confirmation:** For any vendor identified as requiring a 1099-NEC
  (payments ≥ $600, non-corporate entity), explicitly confirm: "Did you file the 1099-NEC
  and Form 1096 by January 31?" If YES: PASS for this sub-check. If NO: NEEDS_UPDATE —
  late filing penalties apply ($60–$630 per form); advise immediate corrected/late filing.
- If either source is unavailable: open question status is `pending` with a Gmail draft; P8
  marks Q-F5 NEEDS_UPDATE until resolved

**NEEDS_UPDATE example:**
```
Q-F5: NEEDS_UPDATE — Part V Line 1a = 0 but payroll register shows 4 W-2s filed; 1099-NEC filing
status unconfirmed for 2 contractors.
[EDIT: Update Part V Line 1a to match W-2 count (4); confirm 1099-NEC + 1096 filing with
payroll processor → P5 / Part V]
[USER: The W-2 count on Part V is showing 0, but your payroll provider filed 4 W-2s.
I also need to confirm whether your 1099s were filed by the January deadline. I'll update
the count and flag the filing confirmation.]
```

---

### Q-F6 — Part VII Section A Comp Ties to W-2/1099 (Gate 1)

**Purpose.** Part VII Section A must list every person in the following categories, and each
listed person's reportable compensation must tie to their W-2 Box 1 (wages) or 1099-NEC Box 1
(nonemployee comp) within $1 rounding tolerance:

- **Officers, directors, and trustees** — all, regardless of compensation level
- **Key employees** — any employee (not an officer/director/trustee) who:
  (1) received more than $150,000 in reportable compensation from the org + related orgs,
  AND (2) had substantial authority over org programs, finances, management, or compensation
  decisions (IRC §4958 definition)
- **Five highest-compensated employees** — any employees not already listed above who received
  more than $100,000 in reportable compensation from the org + related orgs (pick the 5 with
  highest comp; if fewer than 5 qualify, list all who qualify)

Section B covers the five highest-compensated independent contractors (>$100K).

**Pass criteria:**
- Every person in the categories above is listed in Section A with name, title, hours/week,
  and compensation amounts (column D = reportable, column E = other, column F = estimated other)
- For each person with reportable comp > $0: amount matches the W-2/1099 source within $1
- Officers/directors/trustees with $0 reportable compensation are explicitly listed ($0 entry)
- Key employees and highest-compensated employees are not omitted to shorten the form
- **Part IX Line 7 tie:** total wages on Part IX Line 7 (Column A) must equal W-2 Box 1
  *gross wages* from the payroll register — not net pay, not take-home pay. Gross wages
  include pre-tax deductions (health insurance, 401k, FSA) that reduce Box 1 only if they
  are IRC §125 or §401(k) exclusions; verify gross-to-net reconciliation. If Tiller or
  bookkeeping data shows net payroll deposits, do not use deposits as Part IX Line 7.
- **Section B completeness:** Five highest-compensated independent contractors (>$100K) are listed
  in Part VII Section B with name, address, EIN/SSN, and compensation amount. Each contractor's
  compensation ties to the 1099-NEC source within $1. If fewer than 5 qualify, all who qualify
  are listed. No contractor earning >$100K is omitted.

**Common mistakes:**
- Listing only compensated officers and omitting unpaid board members (all officers/directors
  must be listed regardless of whether they receive compensation)
- Omitting key employees because they are not officers
- Using last year's compensation without updating for bonuses, raises, or mid-year changes
- Listing fewer than 5 highest-compensated employees when more than 5 qualify

**NEEDS_UPDATE example:**
```
Q-F6: NEEDS_UPDATE — Part VII Section A shows ED compensation $95,000; W-2 Box 1 = $112,000
($17,000 gap). Two board members with $0 compensation are missing from Section A.
[EDIT: Update ED reportable compensation to W-2 Box 1 amount ($112,000); add two unpaid
board members with $0 reportable / $0 other compensation → P5 / Part VII]
[USER: The Executive Director's compensation shown on the form ($95,000) doesn't match
their W-2 ($112,000). Also, two board members who serve without pay need to be listed.
I'll fix both.]
```

---

### Q-F7 — Part I Totals Tie to Downstream Parts (Gate 1)

**Purpose.** Part I is a summary page. Its totals must roll up from the authoritative Parts:

```
Part I Line 8  = Part VIII Line 1h (total contributions, gifts, grants — NOT Line 12)
Part I Line 12 = Part VIII Line 12 (total revenue)
Part I Line 18 = Part IX Line 25 (total expenses)
Part I Line 22 = Part X Line 32 EOY (net assets/fund balances)
```

**Pass criteria:**
- All four equalities hold to the dollar (no tolerance)
- Part VIII Line 1h = sum(Lines 1a + 1b + 1c + 1d + 1e + 1f) within $1 rounding
- Part VIII Line 12 = sum(Lines 1h + 2 + 3 + ... + 11e) within $1 rounding
- `dataset_rollup.json` `parts.I` values are sourced from `dataset_core.json` line references
  (not manually entered)
- `reconciliation.delta_match == true`

**NEEDS_UPDATE example:**
```
Q-F7: NEEDS_UPDATE — Part I Line 8 ($125,000) ≠ Part VIII Line 1h ($128,500); $3,500 mismatch.
[EDIT: Re-compute Part I Line 8 from Part VIII Line 1h; update dataset_rollup.json
parts.I.line_8 → P7]
[USER: The total contributions on the summary page ($125,000) doesn't match the contributions
detail ($128,500). I'll recompute and fix the summary to match.]
```

---

### Q-F8 — Part IV Checklist Fully Answered (Gate 1)

**Purpose.** Every question in Part IV must be answered Yes or No. Every Yes answer must have
the corresponding schedule attached to `required_schedules[]`.

**Pass criteria:**
- `artifacts/part-iv-checklist.md` has no `need-info` rows remaining (all resolved or open-
  questioned)
- Every `yes` answer maps to a schedule in `required_schedules[]`
- Every schedule in `required_schedules[]` has a corresponding artifact in `dataset_schedules`
- Schedule A is always present for 501(c)(3) organizations that are not private foundations

**Note on question count.** The count of Part IV questions varies by tax year as the IRS revises
the form. Do NOT hard-code a count. Enumerate from the current-year f990.pdf at runtime.

**NEEDS_UPDATE example:**
```
Q-F8: NEEDS_UPDATE — Part IV Line 3a = Yes but Schedule A not in required_schedules[];
Line 7 = blank (unanswered).
[EDIT: Add Schedule A to required_schedules[]; resolve Part IV Line 7 as Yes/No with
source verification → P5 / Part IV]
[USER: Part IV has a question marked "Yes" for Schedule A, but Schedule A isn't attached.
Also, one question is still blank. I'll add the missing schedule and resolve the blank.]
```

---

### Q-F9 — EIN + Legal Name + Address Match Prior Year (Gate 1)

**Purpose.** These three identifiers must be consistent with the organization's prior-year return
and the IRS Business Master File (BMF). Mismatches cause IRS processing errors.

**Pass criteria:**
- EIN matches prior 990 (or IRS determination letter if no prior 990 available); cross-check
  against IRS Tax Exempt Organization Search (TEOS) at apps.irs.gov/app/eos/ — TEOS is the
  authoritative public IRS lookup for EIN, legal name, ruling date, and BMF status
- Legal name matches IRS records exactly (including punctuation, capitalization, "Inc." vs
  "Incorporated")
- Principal office address is current (changes require explanation in Schedule O)

**NEEDS_UPDATE example:**
```
Q-F9: NEEDS_UPDATE — Legal name on return "Fortified Strength" ≠ IRS TEOS record
"Fortified Strength, Inc."; EIN matches.
[EDIT: Update legal name to match IRS records exactly ("Fortified Strength, Inc.");
add Schedule O note if abbreviation was previously used → P5 / Part I header]
[USER: The organization name on the return ("Fortified Strength") is missing the "Inc."
that IRS records show. Even small name differences can cause processing issues. I'll fix
it to match exactly.]
```

---

### Q-F10 — ED/Shared-Cost Allocation Documented (Gate 2)

**Purpose.** The Executive Director's time (and any other shared employee) must be allocated
across functional buckets (Program / M&G / Fundraising) with a documented, defensible basis.

**Pass criteria:**
- `coa-mapping.csv` shows a documented allocation basis for ED salary row (e.g., "time study:
  60% program, 30% M&G, 10% fundraising")
- The allocation basis is narrated in Schedule O or the plan's Decision Log
- The allocation is reasonable for the organization's program model (a pure fundraising org
  should not show 95% program allocation for the ED)

**NEEDS_UPDATE example:**
```
Q-F10: NEEDS_UPDATE — ED salary allocated 100% to Program; no allocation basis documented
in coa-mapping.csv or Schedule O.
[EDIT: Document ED time allocation basis (e.g., time study or estimated percentages);
split salary across Program/M&G/Fundraising per documented basis; add Schedule O narrative
→ P3 / artifacts/functional-expense.csv + P6 / schedule-o-narratives.md]
[USER: The Executive Director's salary is allocated entirely to Program with no explanation.
The IRS expects a documented basis for how the ED's time is split. I'll add an allocation
and explain the methodology in Schedule O.]
```

---

### Q-F11 — Prior-Year Comparatives Populated (Gate 2)

**Purpose.** Part X (Balance Sheet) requires BOY (beginning-of-year) figures, which are the
prior year's EOY figures. Schedule A requires 4 prior years of public-support data.

**Pass criteria:**
- Part X BOY column is populated (not zero/blank)
- Schedule A Part II shows 5 years of contributions data (current + 4 prior)
- Schedule A Line 16 (prior-year public support percentage) is populated from the *filed*
  prior-year Form 990 or 990-EZ — not estimated or back-computed. If the prior return is
  a 990-EZ, map the 990-EZ public support % directly to Line 16; document the source file
  in a Decision Log entry (e.g., "Paula Wallin CPA, FY2024 990-EZ, Part III Line 16 = 100%").
  A computed or assumed Line 16 value without a filed-return citation is NEEDS_UPDATE.
- If this is the first year of filing: BOY = 0 is acceptable with a Schedule O note;
  Schedule A Line 16 may be marked N/A with a transition-year note in Schedule O

**NEEDS_UPDATE example:**
```
Q-F11: NEEDS_UPDATE — Schedule A Line 16 shows 74% (back-computed from current-year data)
but prior year filed return shows 100%; Line 16 must cite the filed return, not our computation.
[EDIT: Replace Schedule A Line 16 with the prior year filed return's Part III Line 15 value
(100%); add Decision Log entry citing source document → P6 / Schedule A]
[USER: The prior-year public support percentage on Schedule A should come from your filed
prior-year return (100%), not recalculated from our data (74%). I'll update it to match what
the IRS already has on file.]
```

---

### Q-F12 — Fundraising Expense Non-Zero If Contributions > 0 (Gate 2)

**Purpose.** If the organization received contributions revenue (Part VIII lines 1a–1h > 0),
having zero fundraising expense is a red flag — it implies free money with no solicitation cost.

**Pass criteria:**
- If Part VIII contribution lines total > $0: Part IX Column D (Fundraising) total > $0
- OR: a Schedule O narrative explains why contributions required no fundraising expense
  (e.g., "All contributions were unsolicited gifts from board members; no fundraising activity
  was conducted in the tax year")

**NEEDS_UPDATE example:**
```
Q-F12: NEEDS_UPDATE — Part VIII contributions total $85,000; Part IX Fundraising column = $0
with no Schedule O explanation.
[EDIT: Add Schedule O narrative explaining why no fundraising expenses were incurred,
or verify Fundraising column for misclassified expenses → P6 / schedule-o-narratives.md]
[USER: You received $85,000 in contributions but show $0 in fundraising expenses. The IRS
may question this. I'll either add an explanation in Schedule O or check if fundraising
costs were misclassified elsewhere.]
```

---

### Q-F13 — Accounting Method Consistent Year-Over-Year (Gate 2)

**Purpose.** Changing from cash-basis to accrual (or vice versa) requires disclosure and may
require restatement of prior-year figures.

**Pass criteria:**
- `key_facts.accounting_method` matches the method shown on the prior-year 990 (Part XII)
- If changed: Schedule O contains a disclosure paragraph explaining the change and its effect
  on comparability; note that a change in accounting method may also require IRS Form 3115
  (Application for Change in Accounting Method) and a §481(a) catch-up adjustment — flag
  for the organization's tax counsel, as this is beyond Form 990 scope
- If first year: method is stated and no prior-year comparison is required

**NEEDS_UPDATE example:**
```
Q-F13: NEEDS_UPDATE — Current year accrual; prior year 990 Part XII shows cash basis.
No Schedule O disclosure or Form 3115 reference.
[EDIT: Add Schedule O disclosure of accounting method change; flag potential Form 3115
requirement for tax counsel review → P6 / schedule-o-narratives.md]
[USER: Your bookkeeping changed from cash basis to accrual basis this year. The IRS
requires a disclosure about this change. I'll add that explanation and flag whether
a separate IRS form (Form 3115) is needed — your tax advisor should confirm.]
```

---

### Q-F14 — Schedule O Covers All Part VI "Describe" Prompts (Gate 2)

**Purpose.** Part VI contains several questions that say "If Yes, describe in Schedule O."
Each such description must exist.

**Pass criteria:**
- Every Part VI question that received a "Yes" answer AND requires a Schedule O description
  has a corresponding narrative in `artifacts/schedule-o-narratives.md`
- Narratives are substantive (> 50 words for complex governance matters; concise but complete
  for straightforward matters)
- Line references are accurate (e.g., "Schedule O re: Part VI, Line 11b" not just "Governance")

**NEEDS_UPDATE example:**
```
Q-F14: NEEDS_UPDATE — Part VI Line 11a = Yes but no Schedule O narrative exists; Line 2 = Yes
but narrative references "Line 2" without specifying "Part VI Line 2."
[EDIT: Add Schedule O narrative for Part VI Line 11a; correct Line 2 narrative line reference
→ P6 / schedule-o-narratives.md]
[USER: Part VI has two "Yes" answers that require Schedule O explanations, but the
explanations are missing or don't cite the right line numbers. I'll add the missing narrative
and fix the references.]
```

---

### Q-F15 — Signature Block Populated (Gate 2)

**Purpose.** The return must be signed by an officer of the organization. The dataset must
capture the officer name, title, and date to be printed on the reference PDF and passed to
the e-file provider.

**Pass criteria:**
- `dataset_core.json` or `dataset_merged.json` contains `signature.officer_name`,
  `signature.officer_title`, `signature.date`
- The officer is listed in Part VII
- The date is within the filing year (or an extension year)

**NEEDS_UPDATE example:**
```
Q-F15: NEEDS_UPDATE — Signature block empty; no officer_name or officer_title populated.
[EDIT: Populate signature.officer_name and signature.officer_title from Part VII officer
list; set signature.date to filing date → P5 / dataset_core.json]
[USER: The return is missing the officer signature. I'll add the signing officer's name and
title from your board list and set the signing date.]
```

---

### Q-F16 — Source-Discovery Completeness (Gate 2)

**Purpose.** All inputs needed for a complete return must either be present in `artifacts[]`
or have an active open question documenting the gap.

**Required source checklist:**
- Prior 990 (or explanation of why unavailable — first-year filer)
- Budget sheet with tab structure mapped
- Bank statement(s) covering the fiscal year
- Payroll report / W-2 register
- 1099 register (if contractors paid ≥ $600)
- Donor list (if Schedule B is triggered)
- Board roster
- Bylaws
- Conflict-of-interest policy
- Audit or review report (if required by state law, funder covenants, or bond agreements;
  OR if org receives federal awards ≥ $750K — the Single Audit Act / Uniform Guidance threshold
  applies to federal grantees only, NOT a general Form 990 requirement)

**Pass criteria:**
- Each item above either has a non-null path in `artifacts[]` or has an `open_questions[]`
  entry with status `pending` or `answered`
- No item is silently absent

**NEEDS_UPDATE example:**
```
Q-F16: NEEDS_UPDATE — Payroll report / W-2 register: no artifact and no open question;
bylaws: artifact path null with no open question.
[EDIT: Create open questions for missing payroll report and bylaws; send Gmail drafts
to bookkeeper → P1 / open_questions[]]
[USER: Two required documents are missing with no follow-up in progress: your payroll
report and bylaws. I'll create reminders to request them.]
```

---

### Q-F17 — Functional Allocation Methodology Narrated (Gate 3)

**Purpose.** The IRS expects that functional allocations are not arbitrary. A Schedule O entry
narrating the methodology is best practice and supports the return in correspondence exams.

**Pass criteria:**
- `artifacts/schedule-o-narratives.md` contains a "Functional Expense Allocation Methodology"
  section describing the basis used (direct assignment / FTE-weighted / square-footage /
  time-study / combination)
- The narrative names the buckets and the basis for shared costs

**NEEDS_UPDATE example:**
```
Q-F17: NEEDS_UPDATE — No "Functional Expense Allocation Methodology" section in Schedule O;
Part IX shows shared costs (rent, utilities) split across columns without documented basis.
[EDIT: Add functional allocation methodology narrative to Schedule O describing how
shared costs (rent, insurance, utilities) are allocated and the basis (e.g., FTE-weighted,
square-footage) → P6 / schedule-o-narratives.md]
[USER: Your expense form shows costs split across Program, Management, and Fundraising
without explaining how the split was calculated. The IRS expects a description of your
allocation method. I'll add that to Schedule O.]
```

---

### Q-F18 — Part III Program Accomplishments Well-Written (Gate 3)

**Purpose.** Part III is the organization's narrative statement of mission and program
accomplishments. It is public-facing and should communicate program impact.

**Pass criteria:**
- Part III Line 1 (mission statement) is present and ≤ 300 characters (IRS field limit)
- At least 3 program service accomplishments are described (if the organization has ≥ 3)
- Each accomplishment lists: program name, expenses, grants (if any), revenue (if any),
  beneficiaries or output metric
- Language is specific ("served 1,200 youth in after-school programs") not vague ("supported
  the community")

**Explicit checklist (evaluate each — NEEDS_UPDATE if any item is absent):**
- [ ] Headcount (number of persons served) stated or computable from description
- [ ] Hours of service delivered stated or computable (hours = weekly_hours × operating_weeks)
- [ ] Specific competitions or events named (not just "national competitions")
- [ ] Team USA / national team selection achievements included (if any occurred)
- [ ] New program services (Part III Line 2 = Yes) flagged and described if applicable
- [ ] Expense total stated for each of the three largest programs (from Part IX)
- [ ] Grant amount stated for each program (or explicitly $0 if none)
- [ ] Revenue from each program stated (or explicitly $0 if none)

**NEEDS_UPDATE example:**
```
Q-F18: NEEDS_UPDATE — Part III largest program description has no headcount, no hours,
no competitions named; only states "provided athletic programs to youth."
[EDIT: Add headcount (e.g., "81 youth athletes"), annual hours, and named competitions
to Part III program description; add any new-program flag if applicable → P5 / Part III]
[USER: The program description is too vague — it doesn't mention how many youth you
served, how many hours of programming, or any specific events. The IRS wants concrete
numbers. I'll add headcount, hours, and competition details.]
```

**Note on evaluation:** "Well-written" means ALL explicit checklist items are satisfied.
PASS requires every checklist item (headcount, hours, named events, etc.) to be present.
The gate title is shorthand for completeness, not a subjective quality judgment.

---

### Q-F19 — Payroll Tax Artifact: Part IX Line 10 / Line 7 Ratio (Gate 2)

**Purpose.** Tiller-sourced payroll data may commingle employer payroll tax deposits with
employee wage deposits, inflating Part IX Line 10 (payroll taxes) relative to Line 7 (wages).
If the ratio of payroll taxes to wages exceeds 15%, it is likely a data artifact — not a
genuine expense — and must be reviewed before the return is filed.

**Trigger:** Applies when payroll data originates from Tiller, bookkeeping bank feeds, or
any source that records gross payroll deposits rather than net-wage deposits separately from
tax deposits. Not triggered if source is a payroll-provider W-2 register.

**Algorithm:**
```
ratio = Part IX Line 10 col_a / Part IX Line 7 col_a
if ratio > 0.15:  flag → NEEDS_UPDATE (expected FICA+FUTA ≈ 7.65% + state; > 15% → suspect)
```

**Pass criteria:**
- `ratio <= 0.15` (15% is a conservative upper bound; employer-side FICA is 7.65%, plus FUTA
  ~0.6%, plus CA UI/SDI ≈ 3–4% → expected combined ≈ 11–12%)
- OR: a Decision Log entry explains why the ratio exceeds 15% (e.g., mid-year retroactive
  tax deposit correction, state audit settlement payment)

**NEEDS_UPDATE example:**
```
Q-F19: NEEDS_UPDATE — Part IX Line 10 / Line 7 = $38,200 / $156,000 = 24.5% > 15% threshold.
[EDIT: Review payroll register to separate employer-side taxes (FICA 7.65%, FUTA, CA UI/SDI)
from employee withholding; remove employee FICA from Line 10; reconcile to W-2 Box 4/6 totals
→ P3 / artifacts/functional-expense.csv]
[USER: The payroll tax line looks too high — likely the bank feed is double-counting employee
tax withholding. I need to pull the payroll register to split out what the organization actually
owed vs. what was withheld from employees' paychecks.]
```

---

### Q-F20 — BOY Net Assets Equal Filed Prior-Year EOY (Gate 1)

**Purpose.** The beginning-of-year net assets on the current return (Part X Line 32 BOY,
Part XI Line 4) must equal the ending net assets on the filed prior-year return. A mismatch
indicates either a restatement, a prior-period adjustment, or a data error — all of which
require disclosure.

**Pass criteria:**
- Part XI Line 4 (BOY net assets) equals the prior-year filed return's Part X Line 32 EOY
  (or Part I Line 21 if prior year was 990-EZ) within $1 rounding tolerance
- If mismatch: Part XI Line 9 (prior-period adjustment) is non-zero AND a Schedule O entry
  explains the adjustment (nature, amount, corrected period)
- If this is the first year of filing: BOY = 0 is acceptable with a Schedule O note
- **Liability completeness advisory:** If Part X Line 17 (total liabilities) = $0 and the org
  has known credit card balances, loans, or accrued payables, verify all liabilities are captured.
  A $0 liabilities line on a non-trivial balance sheet is a red flag for missing obligations.

**NEEDS_UPDATE example:**
```
Q-F20: NEEDS_UPDATE — Part XI Line 4 ($42,180) vs prior-year 990-EZ EOY ($39,950): unexplained $2,230 gap, Part XI Line 9 = $0.
[EDIT: Identify source of $2,230 BOY discrepancy; if restatement, set Part XI Line 9 = $2,230
and add Schedule O prior-period adjustment narrative → P3 / dataset_core.json]
[USER: The starting net assets don't match last year's ending balance. We need to find out
if there was a correction made after the prior year was filed, and disclose it on the return.]
```

---

### Q-F21 — Vendor >$10K Insider-Ownership Check Before P9 (Gate 2)

**Purpose.** Any vendor paid more than $10,000 in the tax year should be screened for insider
(board member, officer, family member) ownership before the return is finalized. Payments to
insider-owned vendors are related-party transactions that must be disclosed in Part IV and
Schedule L, and may trigger excess-benefit concerns under IRC §4958.

**Pass criteria:**
- For each vendor with total payments > $10,000 in the tax year: confirm in the Decision Log
  that insider ownership was checked (either confirmed none, or disclosed per Schedule L)
- If insider ownership found: Part IV Line 28 = Yes, Schedule L entry present, and a
  Schedule O narrative explains the arm's-length nature of the transaction
- If vendor list is not available: open question status is `pending` with a note; P8 marks
  Q-F21 NEEDS_UPDATE until resolved

**NEEDS_UPDATE example:**
```
Q-F21: NEEDS_UPDATE — Vendor "Acme Services LLC" ($62,000 in 2025): no insider-ownership check in Decision Log.
[EDIT: Confirm or deny board/officer ownership of Acme Services; if insider-owned,
add Part IV Line 28 = Yes, Schedule L entry, and Schedule O narrative → P5 / plan Decision Log]
[USER: I need to verify whether any board members or family members own Acme Services
LLC before we finalize — payments over $10,000 to insider-owned companies must be disclosed.]
```

---

### Q-F22 — Departed Board Members DQ Status for Schedule A (Gate 3)

**Purpose.** A board member who departed during or before the filing year may still be a
"disqualified person" under IRC §4958 if they were a substantial contributor to the organization
(as defined in IRC §509(a)(3)(B)). If so, their contributions cannot count as public support
in Schedule A. Failure to check DQ status for departed board members overstates public support.

**Trigger:** Applies only when Schedule A is required (501(c)(3) non-private-foundation).

**Pass criteria:**
- For each board member who departed within the 5-year Schedule A window: a Decision Log
  entry records whether they are a disqualified person (by gift history, substantial contributor
  test, or otherwise)
- If DQ: their contributions are excluded from Schedule A Part III Line 1 or treated as Line 7a
  (509(a)(2)) / excess contributions (509(a)(1)) in the applicable year(s)

**NEEDS_UPDATE example:**
```
Q-F22: NEEDS_UPDATE — Former board member departed in 2023 with no DQ-status check recorded.
[EDIT: Review 5-year gift history for departed board member; if cumulative gifts > $5,000 and
> 2% of total support, classify as disqualified person; adjust Schedule A accordingly → P6]
[USER: A former board member's donations may need to be excluded from our public support
calculation — we need to check whether they qualify as a "substantial contributor" under IRS rules.]
```

---

### Q-F23 — Schedule A Line 15 vs Line 16 Divergence Narrative (Gate 3)

**Purpose.** If the current-year public support percentage (Schedule A Line 15) differs from
the prior-year percentage (Line 16) by more than 10 percentage points, Schedule O must explain
the methodology difference or one-time factor driving the swing. A large unexplained change
is a red flag in IRS correspondence exams.

**Trigger:** Applies only when Schedule A is required and Line 16 is populated.

**Pass criteria:**
- `abs(Line 15 − Line 16) <= 10pp` — no narrative required
- `abs(Line 15 − Line 16) > 10pp` — a Schedule O entry explains the variance (e.g., large
  one-time contribution in current year, departure of a major disqualified-person donor,
  change in program service revenue mix, transition from 990-EZ to full 990 methodology)

**NEEDS_UPDATE example:**
```
Q-F23: NEEDS_UPDATE — Line 15 = 74.4%, Line 16 = 100.0%; divergence 25.6pp > 10pp, no Schedule O explanation.
[EDIT: Add Schedule O narrative explaining the 25.6pp drop: prior year was 990-EZ with 100%
contribution-only revenue; current year includes $150K PSR that enters denominator but is
capped in numerator (non-DQ PSR ≤ $5,000/year threshold) → P6 / artifacts/schedule-o-narratives.md]
[USER: The public support percentage dropped significantly from last year — I'll add an
explanation to the return so the IRS can see this was expected given the change in revenue mix.]
```

---

### Q-F24 — Part I Prior Year Column Sourced from Filed Prior Return (Gate 3)

**Purpose.** Part I of Form 990 includes a "Prior Year" column alongside the current year.
These figures must come from the filed prior-year return — not re-computed or estimated.
For organizations transitioning from 990-EZ to full Form 990, a documented mapping is required.

**Pass criteria:**
- Each Part I Prior Year figure has a Decision Log citation of the source (e.g., "FY2024
  990-EZ Part I Line 9, $XX" or "transition year — see mapping in Schedule O")
- If prior year was 990-EZ: a Schedule O note documents the mapping methodology and any
  structural differences (e.g., 990-EZ does not have functional expense columns)
- If this is the first year of filing: Prior Year column blank is acceptable with Schedule O note
- A Prior Year column that is entirely blank without explanation is NEEDS_UPDATE even if
  the organization transitioned from 990-EZ (some Part I lines map directly)

**NEEDS_UPDATE example:**
```
Q-F24: NEEDS_UPDATE — Part I Prior Year column blank; prior year was 990-EZ (FY2024) — revenue-line mapping is possible.
[EDIT: Populate mappable Part I Prior Year fields from FY2024 990-EZ; add Schedule O note for
lines that cannot be mapped; cite source document → P3 / dataset_core.json]
[USER: The prior-year comparison column is blank — I'll fill in what I can from last year's
return and add a note explaining where the two forms don't line up.]
```

---

### Q-F25 — Part V Line 2a Entity-Type Filter for 1099-NEC Count (Gate 2)

**Purpose.** Part V Line 2a asks for the number of independent contractors receiving more than
$100,000 in compensation. The IRS instructions specify that corporations and LLCs taxed as
corporations are exempt from 1099-NEC filing — they should not be counted in Line 2a even if
paid >$100K. Counting all high-compensation vendors regardless of entity type overstates Line 2a.

**Trigger:** Applies when the 1099-NEC register contains entries >$100K.

**Pass criteria:**
- Part V Line 2a count includes only individuals, partnerships, and single-member LLCs (treated
  as disregarded entities) who received >$100K — not C-corps, S-corps, or LLCs filing as corps
- The 1099 register (or vendor entity-type check in the Decision Log) documents the entity-type
  verification for each vendor near the $100K threshold
- Contractors excluded due to entity type are noted in the Decision Log with their entity type

**NEEDS_UPDATE example:**
```
Q-F25: NEEDS_UPDATE — Part V Line 2a = 3; entity type not verified for any vendor.
[EDIT: Verify entity type for each contractor; if Acme Services files as a corp, confirm
exclusion from 1099-NEC requirement; re-count qualified individuals only for Line 2a → P5]
[USER: The contractor count needs to exclude any companies — the IRS only wants individuals and
certain pass-through businesses in that line. Let me check what type of entity each vendor is.]
```

---

### Q-F26 — Corporate Donor ≥$35K Board-Ownership Check for 509(a)(2) (Gate 2)

**Purpose.** Under 509(a)(2), a corporate contribution is excluded as a disqualified-person
contribution (Line 7a) if any board member or officer owns ≥35% of the corporation (IRC §4946
attribution rules). Failure to apply this exclusion overstates public support. The $35K
threshold here is heuristic — any corporate donor whose contribution is material to the
public-support percentage should be screened, but ≥$35K is a practical trigger.

**Trigger:** Applies when Schedule A Part III (509(a)(2) basis) is required AND a corporate
entity (not an individual) appears in the donor list with cumulative contributions ≥$35K in
the 5-year window.

**Pass criteria:**
- For each qualifying corporate donor: a Decision Log entry records the board-ownership check
  result (confirmed <35%, confirmed ≥35%, or unable to verify)
- If ≥35% board ownership found: the corporate donor's contributions are reclassified to Line 7a
  (disqualified person full exclusion) in the Schedule A Part III worksheet
- If ownership is unclear: open question status is `pending`; P8 marks Q-F26 NEEDS_UPDATE

**NEEDS_UPDATE example:**
```
Q-F26: NEEDS_UPDATE — Acme Services LLC ($62,000 / 5yr): no board-ownership check recorded.
[EDIT: Confirm % board/officer ownership of Acme Services; if any board member owns ≥35%,
move $62,000 to Schedule A Part III Line 7a (DQ exclusion) → P5 / Decision Log]
[USER: For a company that donated significant funds, I need to verify whether any board members
own 35% or more of it — if so, IRS rules require us to exclude those donations from our public
support calculation.]
```

---

### Q-F27 — PSR Reconciles to Payment Processor 1099-K (Gate 2)

**Purpose.** For organizations that receive card-based program service revenue (via Stripe,
PushPress, Square, or similar payment processors), the gross PSR reported on Part VIII Line 2
should reconcile to the payment processor's Form 1099-K gross transaction amount. Material
discrepancies may indicate unreported revenue, misclassified income, or year-cutoff timing
errors. This is the only third-party cross-check available for PSR — the largest single
revenue line for membership-based nonprofits.

**Trigger:** Applies when `payment_processor_1099k` artifact exists in machine state OR
when PSR (Part VIII Line 2) is classified as card-based membership fees (Stripe, PushPress,
Square, or similar). Not triggered if PSR is entirely non-card (checks, ACH, cash).

**Pass criteria:**
- PSR (Part VIII Line 2 col A) reconciles to 1099-K gross transaction amount within 5%
  tolerance (differences explainable by non-card revenue, adjustments, or year-cutoff timing)
- OR: a Decision Log entry explains the discrepancy (e.g., "1099-K includes Jan 1–Dec 31
  settled transactions; org fiscal year uses accrual basis with Dec 25 cut-off — $X in
  settled-but-unearned fees excluded")
- If 1099-K > reported PSR by more than 5%: investigate whether unreported revenue exists
- If 1099-K is not available: create open question; P8 marks Q-F27 NEEDS_UPDATE until resolved

**NEEDS_UPDATE example:**
```
Q-F27: NEEDS_UPDATE — PSR ($148,000) vs 1099-K gross ($162,000): $14,000 (8.6%) gap unexplained.
[EDIT: Investigate $14K gap between PSR and 1099-K; check for unrecorded card transactions,
timing differences, or misclassified revenue → P6 / Decision Log]
[USER: The program service revenue doesn't match what the payment processor reported — I need
to check whether some card transactions were recorded in a different category or period.]
```

---

### Q-F28 — No Disallowed Negative Values (Gate 2)

**Purpose.** Several Form 990 lines prohibit negative amounts. Entering a negative value on a
revenue line, compensation column, or other disallowed line will cause e-file rejection or
trigger IRS correspondence. This gate catches data-entry and classification errors that produce
impossible negative values.

**Trigger:** Always (all filers).

**Lines where negative values are disallowed:**
- Part VIII revenue sub-lines (1a–1f, 2, 3, 4, 5, 8a–8c, 9a–9c, 10a, 11e): negative amounts
  indicate a classification error (e.g., a refund that should reduce a different line)
- Part VII Section A columns D, E, F (reportable compensation, other compensation, estimated
  other compensation): negative compensation is impossible
- Part IX expense lines (1–25): negative expenses indicate a classification error
- Part X asset and liability lines: negative values indicate sign errors (except accumulated
  depreciation on Line 23, which is a contra-asset and should be positive)

**Lines where negative values ARE allowed:**
- Part VIII Line 7 (net gain/loss on sale of assets): losses are negative
- Part XI Lines 5–9 (adjustments): prior-period and other adjustments can be negative
- Part I Line 19 (revenue less expenses): negative indicates a deficit

**Pass criteria:**
- No disallowed negative values exist in the dataset
- Any negative value on a disallowed line has been flagged and corrected (reclassified or zeroed)
- Negative values on allowed lines are documented in a Decision Log entry

**NEEDS_UPDATE example:**
```
Q-F28: NEEDS_UPDATE — Part VIII Line 1a (individual contributions) shows -$1,580; negative
contributions are not allowed on sub-lines.
[EDIT: Reclassify -$1,580 as a donation reversal that reduces Line 1h total, not a negative
sub-line entry; update dataset_core.json → P5 / Part VIII]
[USER: Individual contributions shows a negative number (-$1,580). This is likely a donation
refund or reversal — I'll reclassify it as a reduction to total contributions rather than
a negative sub-line, which the IRS doesn't allow on this line.]
```

---

## Convergence Loop (P8 Evaluation Protocol)

```
pass = 0
memoized = {}  # gate_id → ["PASS", "PASS"]  — tracks stability

while pass < 5:
    results = {}
    for q in applicable_gates:
        if q in memoized and len(memoized[q]) >= 2 and q not in gate1_ids:
            results[q] = "PASS (memoized)"  # skip re-evaluation
            continue
        result = evaluate(q)  # CPA Reviewer persona
        results[q] = result
        if result == "PASS":
            memoized.setdefault(q, []).append("PASS")
        else:
            memoized.pop(q, None)  # reset stability on any failure

    gate1_open = [q for q in gate1_ids if results.get(q) == "NEEDS_UPDATE"]

    # Apply [EDIT: …] directives for all NEEDS_UPDATE
    for q, r in results.items():
        if r.startswith("NEEDS_UPDATE"):
            apply_edit_directive(r)  # routes back to offending phase

    if not gate1_open and all(r in ("PASS", "PASS (memoized)", "N/A") for r in results.values()):
        break  # converged
    pass += 1

if pass == 5 and gate1_open:
    HALT → AskUserQuestion; do not auto-advance to P9
```

Gate-1 IDs (never memoized): Q-F1, Q-F2, Q-F3, Q-F4, Q-F6, Q-F7, Q-F8, Q-F9, Q-F20
Gate-2 IDs (memoize after 2 stable PASS): Q-F5, Q-F10–Q-F16, Q-F19, Q-F21, Q-F25, Q-F26, Q-F27, Q-F28
Gate-3 IDs (memoize after 2 stable PASS): Q-F17, Q-F18, Q-F22, Q-F23, Q-F24

---

## Cross-Cutting Quality Gates

These questions apply at the skill infrastructure level (not phase-specific). Evaluated
automatically by the Phase Entry Protocol and resume sweep — not part of the P8 gate catalog.

**Note on inline Q-code annotations in SKILL.md:**
`Q-C20`, `Q-C34`, and `Q-G9f` appear as inline comments in SKILL.md and PHASES.md code
blocks. They are implementation-level annotations (not formal gate definitions) that indicate
which quality requirement a code construct satisfies. They are not evaluated in P8 or defined
here; treat them as internal traceability labels only.

### Q-C31 — Tempfile / Resource Lifecycle

**Tier:** Cross-cutting infrastructure (not a P8 CPA gate).

**Trigger:** Always active — evaluated on every resume and `/form990 status` invocation.

**Criteria:** All external resources acquired during phase execution (temporary files,
subprocess handles, staging artifacts) must be:
1. Released on phase abort via `try/finally` in the write path (Step 7a).
2. Orphan-swept on the next resume via the Step 2b dead-PID glob patterns:
   - `<plan-dir>/*.tmp.<pid>` — plan file atomic write temps
   - `~/.claude/.form990-memo-*.tmp.<pid>` — sidecar memo temps
   - `artifacts/**/*.writing.<pid>` — artifact staging files (Change 2)
   - `artifacts/f990-blank-*.pdf.partial.<pid>` — P9 WebFetch partial downloads
3. Per-orphan breadcrumb logged on unlink: `{path, phase, size_bytes, age_s}`.

**Pass criteria:** No `.writing.<pid>`, `.tmp.<pid>`, or `.partial.<pid>` files remain in
the plan directory or `artifacts/` after a successful resume sweep.

**Fail signal:** A `status=writing` artifact whose `plan_lock.pid` is no longer alive, or
a `.tmp.*` file whose PID suffix is a dead process — indicates a prior crash left
unreleased resources.