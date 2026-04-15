# Form 990 Skill — CPA Quality Gate Catalog

**Q-F1..Q-F18** in three tiers. Import this file into every Q-F evaluation pass;
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

**Purpose.** Verify that the three core accounting anchors all hold. These are three SEPARATE
checks — they are NOT a single equality chain. Revenue − Expenses ≠ EOY − BOY unless
adjustment lines (unrealized gains, prior period adjustments, donated services on balance sheet)
are all zero. Conflating them produces false failures for endowment orgs and investment holders.

```
Check 1 (operating): Part XI Line 3 = Part VIII Line 12 − Part IX Line 25
                     (operating excess/deficit = revenue − expenses — definitional)

Check 2 (BOY anchor): Part XI Line 4 = Part X Line 32 BOY column A
                      (beginning net assets agree between the two statements)

Check 3 (EOY anchor): Part XI Line 10 = Part X Line 32 EOY column B
                      (ending net assets agree — this is the primary anchor)
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

"Excess contributions" = amount any single donor gave above 2% of total 5-year support
(per Schedule A Part II instructions). The 2% threshold is computed ONCE over the full
5-year window — not applied annually per year.

**509(a)(2) test** (for fee-income charities) — see SCHEDULES.md §509(a)(2) Worksheet for
the full algorithm. Key structural rule that differs from 509(a)(1):
```
Schedule A Part III:
  Line 7a: FULL EXCLUSION of disqualified person contributions + PSR + UBI (no cap)
  Line 7b: Excess of any non-DQ person's PSR/UBI (Lines 2-3 only) over
           max($5,000, 1% × five_yr_total_support) — does NOT apply to contributions
  Public support = 5yr total − Line 7a − Line 7b
  Prong 1: public_support_pct ≥ 33⅓%
  Prong 2: investment_income_pct ≤ 33⅓%
  Both prongs required for 509(a)(2) PASS.
```
**Critical distinction from 509(a)(1):** 509(a)(1) uses a 2% per-donor cap on ALL
contributions from any single source. 509(a)(2) uses FULL EXCLUSION of disqualified
persons (Line 7a) — never a 1% or 2% cap on contributions. The 1%/$5,000 threshold
exists only for Line 7b (non-DQ PSR/UBI sources), not for contributions (Line 1).
For membership-based orgs where no single non-DQ member's PSR exceeds max($5,000,
1% of 5-yr support), Line 7b = $0.

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

**Purpose.** Part V Line 1a (number of W-2s filed) must tie to the payroll provider's W-2 count
for the tax year. Part V Line 2a (number of independent contractors paid >$100K) must tie to
the count of 1099-NEC recipients in the 1099 register whose compensation exceeds $100K — not
the total number of 1099s filed. These are distinct counts; conflating them overstates Line 2a
for organizations with many small contractors.

**Tier rationale (demoted G1→G2).** Tying these counts requires the payroll-provider export or
1099 register — primary sources that may not be available until P1 discovery is complete. The
skill drafts an email to the bookkeeper to request them (P1 open question). Once the source
lands, P8 re-evaluates. Failing to find these sources does NOT block P5 completion — it
creates an open question.

**Pass criteria:**
- W-2 count in Part V Line 1a matches payroll register W-2 row count for the tax year
- Contractor count in Part V Line 2a matches the number of 1099-NEC recipients whose
  compensation for the tax year exceeds $100K (NOT the total 1099 register row count)
- If either source is unavailable: open question status is `pending` with a Gmail draft; P8
  marks Q-F5 NEEDS_UPDATE until resolved

**Common mistake:** Counting all 1099 recipients for Part V 2a instead of the subset above $100K.

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

**Common mistakes:**
- Listing only compensated officers and omitting unpaid board members (all officers/directors
  must be listed regardless of whether they receive compensation)
- Omitting key employees because they are not officers
- Using last year's compensation without updating for bonuses, raises, or mid-year changes
- Listing fewer than 5 highest-compensated employees when more than 5 qualify

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
- EIN matches prior 990 (or IRS determination letter if no prior 990 available); cross-check
  against IRS Tax Exempt Organization Search (TEOS) at apps.irs.gov/app/eos/ — TEOS is the
  authoritative public IRS lookup for EIN, legal name, ruling date, and BMF status
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
  on comparability; note that a change in accounting method may also require IRS Form 3115
  (Application for Change in Accounting Method) and a §481(a) catch-up adjustment — flag
  for the organization's tax counsel, as this is beyond Form 990 scope
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
- Audit or review report (if required by state law, funder covenants, or bond agreements;
  OR if org receives federal awards ≥ $750K — the Single Audit Act / Uniform Guidance threshold
  applies to federal grantees only, NOT a general Form 990 requirement)

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
