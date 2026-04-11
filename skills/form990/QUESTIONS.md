# Form 990 Skill — CPA Quality Gate Catalog

**Q-F1..Q-F18** in three tiers. Import this file into every Q-F evaluation pass;
do not duplicate definitions in other files.

Gate output contract:
- `PASS` — criteria met, no edits required
- `NEEDS_UPDATE` — defect found; MUST include `[EDIT: <instruction> → <target-phase-or-file>]`
- `N/A` — question does not apply to this org/variant; brief reason required

Memoization: Gate-2 and Gate-3 questions auto-memoize after 2 stable PASS results in P8's
convergence loop. Gate-1 questions are NEVER memoized — re-evaluate every pass.

---

## Tier / Gate Summary

| ID | Tier | Name | Triggered In | Applies When |
|---|---|---|---|---|
| Q-F1 | **G1** | Correct form variant | P0, P8 | always |
| Q-F2 | **G1** | Big-square reconciliation | P7, P8 | always |
| Q-F3 | **G1** | Functional columns sum | P2, P3, P8 | always |
| Q-F4 | **G1** | Schedule A public-support computation | P6, P8 | 501(c)(3) non-PF |
| Q-F5 | G2 | Part V 1099/W-2 count ties to filings | P5, P8 | always |
| Q-F6 | **G1** | Part VII officer comp ties to W-2/1099 | P5, P8 | always |
| Q-F7 | **G1** | Part I totals tie to downstream parts | P7, P8 | always |
| Q-F8 | **G1** | Part IV fully answered; all yes → schedule | P4, P6, P8 | always |
| Q-F9 | **G1** | EIN + legal name + address match prior year | P0, P8 | always |
| Q-F10 | G2 | ED/shared-cost time allocation documented | P2, P8 | always |
| Q-F11 | G2 | Prior-year comparatives populated | P3, P6, P8 | always |
| Q-F12 | G2 | Fundraising expense > 0 if contributions > 0 | P3, P8 | contributions > 0 |
| Q-F13 | G2 | Accounting method consistent year-over-year | P0, P8 | always |
| Q-F14 | G2 | Schedule O covers every Part VI "describe" | P6, P8 | always |
| Q-F15 | G2 | Signature block populated | P9, P8 | always |
| Q-F16 | G2 | Source-discovery completeness | P1, P8 | always |
| Q-F17 | G3 | Functional allocation methodology narrated | P2, P8 | always |
| Q-F18 | G3 | Part III program accomplishments well-written | P5, P8 | always |

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
Q-F1: NEEDS_UPDATE — 990-EZ was selected using only the gross-receipts prong ($180K < $200K)
without verifying the total-assets prong. Total assets are $650K which fails the < $500K
threshold, making the correct variant full Form 990.
[EDIT: Re-run P0 variant decision tree; record both GR ($180K < $200K) and TA ($650K ≥ $500K)
comparisons in Decision Log; update form_variant to "990" in machine state → P0]
```

---

### Q-F2 — Big-Square Reconciliation (Gate 1)

**Purpose.** Verify that the core accounting identity holds:

```
Part VIII Line 12 (total revenue)
− Part IX Line 25 (total expenses)
= Part XI Line 9 (change in net assets)
= Part X Line 32 EOY − Part X Line 32 BOY (change per balance sheet)
```

All four values must be consistent (a rounding difference of ≤ $1 in absolute value is
acceptable with a note explaining the source; any unexplained delta > $1 is NEEDS_UPDATE).

**Pass criteria:**
- `reconciliation.delta_match == true` in `dataset_rollup.json`
- `artifacts/reconciliation-report.md` exists and shows the arithmetic
- If cash-basis, Part XI line 1 and Part VIII line 12 agree

**NEEDS_UPDATE example:**
```
Q-F2: NEEDS_UPDATE — Part I shows net revenue of $12,000 but Part X shows net-assets change
of $14,500. Unexplained $2,500 delta. Likely a balance-sheet-only entry (depreciation or
unrealized gain) not flowing through Part VIII.
[EDIT: Re-examine Part X EOY vs BOY delta; identify source of $2,500 discrepancy; add
explanatory note to reconciliation-report.md and resolve in dataset_rollup.json → P7]
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
Q-F3: NEEDS_UPDATE — Part IX Line 7 (Other Salaries): Col A = $45,000 but B+C+D = $43,200.
Gap of $1,800. Likely a rounding artifact in the 60/30/10 allocation split.
[EDIT: Adjust functional-expense.csv Line 7 allocation: add $1,800 to the Program column
(Column B) to reconcile to Column A total → P3 / artifacts/functional-expense.csv]
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

"Excess contributions" = amount any single donor gave above 2% of total support in the 5-yr
window (per Schedule A Part II instructions).

**509(a)(2) test** (for fee-income charities):
```
public_support_pct =
  (program service revenue + small public contributions)
  / total_support × 100
Passes if ≥ 33⅓%, AND investment/unrelated income ≤ 33⅓%
```

**Pass criteria:**
- The correct test (509(a)(1) vs 509(a)(2)) is applied per `key_facts.public_charity_basis`
- 5 years of prior gross-receipts data are present in Schedule A worksheet
- Excess-contribution exclusions are applied (or explicitly marked zero if no donor exceeds 2%)
- If borderline (10%–33%), a facts-and-circumstances narrative exists in Schedule O

**NEEDS_UPDATE example:**
```
Q-F4: NEEDS_UPDATE — Schedule A computes public support percentage at 28%, which is below
the 33⅓% bright-line threshold. No facts-and-circumstances narrative exists in Schedule O.
Without the narrative, the organization may not pass the 509(a)(1) test.
[EDIT: Draft facts-and-circumstances narrative for Schedule O: describe donor diversity,
public programs, community use, geographic reach; reference IRS Reg §1.170A-9(f)(3) factors
→ P6 / artifacts/schedule-o-narratives.md]
```

---

### Q-F5 — Part V Count Ties to Filings (Gate 2)

**Purpose.** Part V lines 1a (number of W-2s filed) and 2a (number of 1099-MISC/NECs filed)
must tie to the payroll provider export or the 1099 register.

**Tier rationale (demoted G1→G2).** Tying these counts requires the payroll-provider export or
1099 register — primary sources that may not be available until P1 discovery is complete. The
skill drafts an email to the bookkeeper to request them (P1 open question). Once the source
lands, P8 re-evaluates. Failing to find these sources does NOT block P5 completion — it
creates an open question.

**Pass criteria:**
- W-2 count in Part V 1a matches payroll register row count for the tax year
- 1099 count in Part V 2a matches 1099-MISC/NEC register row count
- If either source is unavailable: open question status is `pending` with a Gmail draft; P8
  marks Q-F5 NEEDS_UPDATE until resolved

---

### Q-F6 — Part VII Officer Comp Ties to W-2/1099 (Gate 1)

**Purpose.** Each officer listed in Part VII must have compensation amounts that tie to their
W-2 Box 1 (wages) or 1099-NEC Box 1 (nonemployee comp), within the IRS-specified tolerance.

**Pass criteria:**
- For each officer with reportable compensation > $0: the amount matches the W-2/1099
  source document within $1 (rounding)
- Officers with $0 reportable compensation are explicitly listed with a $0 entry
- If no officers are compensated: Part VII reflects the correct zero-compensation disclosure

**Common mistake:** Copying last year's compensation without updating for bonuses, raises, or
mid-year employment changes.

---

### Q-F7 — Part I Totals Tie to Downstream Parts (Gate 1)

**Purpose.** Part I is a summary page. Its totals must roll up from the authoritative Parts:

```
Part I Line 8  = Part VIII Line 12 (total revenue)
Part I Line 18 = Part IX Line 25 (total expenses)
Part I Line 22 = Part X Line 32 EOY (net assets/fund balances)
```

**Pass criteria:**
- All three equalities hold to the dollar (no tolerance)
- `dataset_rollup.json` `parts.I` values are sourced from `dataset_core.json` line references
  (not manually entered)
- `reconciliation.delta_match == true`

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

---

### Q-F9 — EIN + Legal Name + Address Match Prior Year (Gate 1)

**Purpose.** These three identifiers must be consistent with the organization's prior-year return
and the IRS Business Master File (BMF). Mismatches cause IRS processing errors.

**Pass criteria:**
- EIN matches prior 990 (or IRS determination letter if no prior 990 available)
- Legal name matches IRS records exactly (including punctuation, capitalization, "Inc." vs
  "Incorporated")
- Principal office address is current (changes require explanation in Schedule O)

**Common mistake:** Using a DBA name instead of the legal name on the determination letter.

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

---

### Q-F11 — Prior-Year Comparatives Populated (Gate 2)

**Purpose.** Part X (Balance Sheet) requires BOY (beginning-of-year) figures, which are the
prior year's EOY figures. Schedule A requires 4 prior years of public-support data.

**Pass criteria:**
- Part X BOY column is populated (not zero/blank)
- Schedule A Part II shows 5 years of contributions data (current + 4 prior)
- If this is the first year of filing: BOY = 0 is acceptable with a Schedule O note

---

### Q-F12 — Fundraising Expense Non-Zero If Contributions > 0 (Gate 2)

**Purpose.** If the organization received contributions revenue (Part VIII lines 1a–1h > 0),
having zero fundraising expense is a red flag — it implies free money with no solicitation cost.

**Pass criteria:**
- If Part VIII contribution lines total > $0: Part IX Column D (Fundraising) total > $0
- OR: a Schedule O narrative explains why contributions required no fundraising expense
  (e.g., "All contributions were unsolicited gifts from board members; no fundraising activity
  was conducted in the tax year")

---

### Q-F13 — Accounting Method Consistent Year-Over-Year (Gate 2)

**Purpose.** Changing from cash-basis to accrual (or vice versa) requires disclosure and may
require restatement of prior-year figures.

**Pass criteria:**
- `key_facts.accounting_method` matches the method shown on the prior-year 990 (Part XII)
- If changed: Schedule O contains a disclosure paragraph explaining the change and its effect
  on comparability
- If first year: method is stated and no prior-year comparison is required

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
- Audit or review report (if gross receipts ≥ $750K or required by funder)

**Pass criteria:**
- Each item above either has a non-null path in `artifacts[]` or has an `open_questions[]`
  entry with status `pending` or `answered`
- No item is silently absent

---

### Q-F17 — Functional Allocation Methodology Narrated (Gate 3)

**Purpose.** The IRS expects that functional allocations are not arbitrary. A Schedule O entry
narrating the methodology is best practice and supports the return in correspondence exams.

**Pass criteria:**
- `artifacts/schedule-o-narratives.md` contains a "Functional Expense Allocation Methodology"
  section describing the basis used (direct assignment / FTE-weighted / square-footage /
  time-study / combination)
- The narrative names the buckets and the basis for shared costs

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

Gate-1 IDs (never memoized): Q-F1, Q-F2, Q-F3, Q-F4, Q-F6, Q-F7, Q-F8, Q-F9
Gate-2 IDs (memoize after 2 stable PASS): Q-F5, Q-F10–Q-F16
Gate-3 IDs (memoize after 2 stable PASS): Q-F17, Q-F18
