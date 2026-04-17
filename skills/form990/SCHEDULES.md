# Form 990 Skill — Schedule Playbooks

Dispatched from PHASES.md §P6. Each schedule generates:
1. A human-readable `artifacts/schedule-<letter>.md` narrative + worksheet
2. Entries in `artifacts/form990-dataset-schedules.json` under `schedules.<letter>`

---

## Schedule A — Public Support Test (always for 501(c)(3) non-PF)

**Purpose.** Document the organization's public charity status by proving it passes the
5-year public support test (or explaining how it qualifies under a different basis).

**When triggered.** Always for 501(c)(3) organizations that are not private foundations.

### Sub-phase: Gather 5-Year Support Data

Collect support history for years T, T-1, T-2, T-3, T-4 (where T = current tax year):
- Public contributions (Part VIII Line 1 total) for each year
- Government grants (Part VIII Line 1e) for each year
- Program service revenue for each year
- Investment income for each year
- Total support for each year

If prior-year 990s are available in `artifacts`: read directly.
If not: create Open Questions for years T-1 through T-4 (ask bookkeeper/prior CPA).

### Schedule A Part I — Organization Type Checkbox

Before computing public support, verify the organization's public charity basis:

1. Review the IRS determination letter or prior-year Schedule A Part I.
2. Check the appropriate box in Part I:
   - 509(a)(1) — churches, educational orgs, hospitals, etc.
   - 509(a)(2) — orgs receiving >33⅓% public support from gifts/grants/fees
   - 509(a)(3) — supporting organizations (Type I, II, or III)
   - Other §170(b)(1)(A) bases (hospital, school, etc.)
3. The checkbox determines which worksheet (Part II or Part III) to complete.
4. **Do not switch basis based on test results.** The IRS determination letter sets the basis.

### Schedule A Part IV — Supporting Organizations (509(a)(3))

If `public_charity_basis == "509(a)(3)"`:

1. Determine the supporting organization type (Type I, II, or III).
2. Type I: operated, supervised, or controlled by a supported organization.
3. Type II: supervised or controlled in connection with a supported organization.
4. Type III: operated in connection with a supported organization.
   - Type III functional-integrated orgs have additional Schedule A requirements.
5. Complete Part IV with: supported organization name, EIN, relationship type.
6. If type is uncertain: create Open Question for user clarification.

### 509(a)(1) / §170(b)(1)(A)(vi) Public Support Worksheet

```
For each year y in [T-4, T-3, T-2, T-1, T]:
  total_line1h[y]         = Part VIII Line 1h for year y (total contributions, includes Line 1e govt grants)
  govt_grants[y]          = Part VIII Line 1e for year y
  exempt_function_income[y] = Part VIII Line 2g for year y (program service revenue)
  total_support[y]        = all revenue for year y (contributions + program fees +
                             investment income + other)
  # two_pct_threshold is computed ONCE from the 5-year total — same dollar for all donors
  two_pct_threshold       = 0.02 × sum(total_support[T-4..T])   ← 2% of 5-yr total support

  # EXCESS CONTRIBUTIONS USE 5-YEAR AGGREGATE, NOT PER-YEAR
  # Per IRS Schedule A Part II instructions: compare each donor's 5-year cumulative
  # contributions against the 2% threshold. The excess is the amount by which a single
  # donor's 5-year total exceeds the threshold.
  for each donor d:
    # Exclude government-entity donors from the 2% cap entirely
    # (IRS Schedule A Part II Line 5b: government grants are not subject to excess computation)
    if donor_type[d] == "government_entity": skip this donor entirely
    donor_5yr_total[d] = sum(donor_contributions[d][y] for y in [T-4..T])
    donor_excess[d]    = max(0, donor_5yr_total[d] − two_pct_threshold)

  total_excess = sum(donor_excess[d] for all donors d)

  # Government grants are NOT subject to the 2% cap — they are public support by definition
  # (IRS Schedule A Part II Line 5b excludes government grants from excess computation)

5yr_public_support = sum(total_line1h[y] for y in window) + sum(exempt_function_income[y] for y in window) − total_excess
  # NOTE: total_line1h = Part VIII Line 1h total contributions (which INCLUDES Line 1e
  # government grants). Government grants are NOT subject to the 2% cap — they count
  # as public support in full per IRS Schedule A Part II Line 5b.
5yr_total_support  = sum(total_support[y] for y in window)

public_support_pct = 5yr_public_support / 5yr_total_support × 100
```

**Thresholds:**
- `≥ 33⅓%` → PASS bright-line test → check box Line 5 of Schedule A Part II
- `≥ 10% AND < 33⅓%` → may still pass if facts-and-circumstances narrative is attached
  (community support, board diversity, etc.)  → check box Line 6 of Schedule A Part II
- `< 10%` → FAILS 509(a)(1) test → this does NOT automatically qualify the org for 509(a)(2).
  An organization's public charity basis is determined by its IRS determination letter and
  exempt-purpose activities, not by test results. Failing 509(a)(1) may trigger private
  foundation reclassification. Surface advisory: "Public support below 10% — recommend
  CPA review of private foundation reclassification risk." If Q-F4 flags, NEEDS_UPDATE.

### 509(a)(2) Worksheet (if public_charity_basis == "509(a)(2)")

**⚠ FORMULA WARNING — read before computing:**
509(a)(2) does NOT use a per-donor cap on contributions. Disqualified person contributions
are **excluded in their entirety** (Line 7a). The 1%/$5,000 threshold (Line 7b) applies
**only to PSR/UBI from non-disqualified persons** — not to contributions at all.
This is distinct from 509(a)(1), which uses a 2% per-donor cap on all contributions.

**Schedule A Part III structure (for 509(a)(2)):**

```
Line 1: Gifts, grants, contributions, membership fees (all sources)
Line 2: Gross receipts from related activities / PSR (all sources)
Line 3: Gross receipts from unrelated trade or business (all sources)
Line 4–5: Tax revenues, govt services furnished (if any)
Line 6 = Lines 1–5  (5-yr total support for EACH year)

Line 7a: Subtract FULL amounts from disqualified persons (IRC §4946)
         in Lines 1–3 — no cap, no floor, full exclusion
Line 7b: For non-disqualified persons only, subtract excess of any single
         person's Lines 2–3 amounts THAT YEAR over max($5,000, 1% × that_year_Line13)
         where "that_year_Line13" = total support for the applicable year column
         (IRS Sched A Part III instructions: "1% of the amount on line 13 for the
         applicable year" — per-year column total, NOT the 5-year column (f) total)
         (This cap does NOT apply to Line 1 contributions)
Line 8 = Line 6 − Line 7a − Line 7b  (public support for each year)
```

**Algorithm — Prong 1 (public support ≥ 33⅓%):**

```python
# Step 1: compute 5-yr total once
five_yr_total = sum(total_support[y] for y in [T-4..T])

# Step 2: Line 7b threshold — PER-YEAR cap from each year's own Line 13
# IRS Schedule A Part III instructions (primary source confirmed 2026-04-14):
# "the greater of $5,000 or 1% of the amount on line 13 FOR THE APPLICABLE YEAR"
# "applicable year" = each year's own annual column total, NOT the 5-year column (f).
# Cap is recomputed for every year column (a)–(e); it changes year by year.
cap_7b = {y: max(5000, 0.01 * total_support[y]) for y in [T-4..T]}

# Step 3: Line 7a — disqualified person exclusion (FULL AMOUNT — no cap)
line_7a = sum(dq_contributions[y] + dq_psr[y] + dq_ubi[y]
              for y in [T-4..T])

# Step 4: Line 7b — per-year per-person excess (NOT aggregate across years)
# For each year, for each non-DQ person, is that year's PSR/UBI > cap?
# The excess in each year is entered in the corresponding column (a)-(e).
line_7b = 0
for y in [T-4..T]:
    for each non_dq_person d:
        line_7b += max(0, d.psr_ubi[y] - cap_7b[y])  # year-specific cap

# Step 5: public support percentage
public_support_5yr = five_yr_total - line_7a - line_7b
public_support_pct = public_support_5yr / five_yr_total * 100
```

> **Line 7b critical note — PER-YEAR comparison AND per-year cap.**
> Both the comparison AND the cap threshold are per-year:
> `cap[y] = max($5,000, 0.01 × total_support[y])` where `total_support[y]` is that year's
> Line 13 column value. A non-DQ person paying $6,000/year against a $7,000 per-year cap
> (total support = $700K/yr) has ZERO Line 7b excess — each year's $6,000 < $7,000.
> The wrong aggregate approach (sum 5 years of PSR, subtract cap once) dramatically
> over-deducts. The IRS form has per-year columns (a)–(e) for Line 7b entries.
>
> **Primary source (IRS Schedule A Part III instructions):** "the greater of $5,000 or
> 1% of the amount on line 13 **for the applicable year**" — not column (f) 5-year total.
>
> **In practice:** Line 7b = $0 whenever every non-DQ person's SINGLE-YEAR PSR/UBI
> is below `max($5,000, 1% × that_year_total_support)`. For most membership-based orgs
> with annual total support below $500K, the $5,000 floor always applies (1% < $5,000),
> making Line 7b = $0.

**Public benefit narrative for membership-based orgs:** For organizations where membership
fees constitute a significant portion of public support (PSR in Line 2), document whether
program services are open to the broader community (not just members). This distinction
affects both the 509(a)(2) public support calculation and any facts-and-circumstances narrative.
Programs restricted to members only may weaken the public benefit argument; programs open
to the community strengthen it. Ask: "Are your programs open to non-members, or exclusively
for members?" Record the answer in the Schedule O narrative.

**Prong 2 — Investment/unrelated income ≤ 33⅓%:**
```
5yr_investment_pct = sum(investment_income[T-4..T] + UBTI[T-4..T]) / five_yr_total × 100
```

**PASS if:** `public_support_pct ≥ 33⅓%` **AND** `5yr_investment_pct ≤ 33⅓%`

**Merchandise revenue treatment in Schedule A Part III:**
Merchandise sales (Part VIII Lines 10a–10c in the core dataset) are included in
Schedule A Part III as **Line 2 (gross receipts from related activities)** using the
**gross revenue** (Line 10a), not the net amount (Line 10c). Merchandise is a related
activity for most program-selling nonprofits (e.g., T-shirts, branded equipment).
Exception: if merchandise was sold to a disqualified person at above-FMV prices, that
specific transaction's proceeds are DQ'd. A general "merchandise" tag in an internal
budget system (e.g., a PST tab flag) does NOT make it disqualified under Schedule A.

**⚠ PST tab warning — current-year only:**
A "Public Support Test" or similar named tab in client spreadsheets (e.g., Tiller) often
tracks **current-year data only** — not the 5-year historical window required by IRS
Schedule A. Always verify by reading each prior-year P&L tab directly. Never assume the
PST tab contains multi-year accumulated Schedule A data.

### Facts-and-Circumstances Narrative (if 10%–33⅓%)

Draft a Schedule O narrative covering (per Reg. §1.170A-9(f)(3)):
1. Organization's relationship to governmental units or to the general public
2. Nature of the governing body (community board?)
3. Programs' accessibility to and for the general public
4. Resources solicited from the general public, government, or broad public appeal
5. Community use of facilities or services on a non-discriminatory basis

**509(a)(2) facts-and-circumstances (10%–33⅓% range):** If a 509(a)(2) org falls in this range,
a similar narrative is required. Emphasize:
1. Breadth of public support from non-disqualified persons
2. Public nature of program services (open to community beyond membership)
3. Whether programs are available to the general public or restricted to members
4. Evidence of community reliance on the org's services
5. For membership-based orgs: explicitly state whether programs are open to non-members

---

## Schedule B — Schedule of Contributors

**Purpose.** List contributors who gave ≥ $5,000 (or ≥ 2% of total contributions, whichever
is greater) during the tax year. Confidential — not for public inspection.

**When triggered.** Required for 501(c)(3) orgs filing Schedule A when contributions from any
single contributor exceed the applicable threshold ($5,000 or 2% of total contributions,
whichever is greater). Part IV Line 2 = "Yes" confirms Schedule B is required.

### Two-Output Contract (IRC §6104(d)(3)(A))

**Filing version** (`artifacts/schedule-b-filing.md`):
- Full legal name of each contributor
- Address
- Amount contributed
- Type (individual / payroll deduction / noncash)
- Submitted to IRS via e-file provider; NEVER published

**Public inspection version** (`artifacts/schedule-b-public.md`):
- Contributor names → `"Anonymous"`
- Addresses → stripped entirely
- Amounts → retained
- Type → retained
- Safe for public inspection copy, website, VCS

**Security check:** verify `artifacts/schedule-b-filing.md` path is in `.gitignore` before
writing. If not found in `.gitignore`: add it and breadcrumb the addition.

### Threshold Calculation

```
total_contributions = Part VIII Line 1 sum
# Note: this 2% test uses total_contributions (Part VIII Line 1h), NOT 5-year total support.
# The Schedule A 509(a)(1) excess-contribution exclusion uses a *separate* 2% — computed as
# 2% of 5-year total support (a much larger denominator). The two thresholds look similar
# but serve different purposes and produce different dollar amounts.
threshold = max(5000, 0.02 × total_contributions)

reportable_contributors = [d for d in donor_list if d.amount >= threshold]
```

For each reportable contributor: list Part I (name, address, total contribution, type).

---

## Schedule D — Supplemental Financial Statements

**Purpose.** Supplemental detail for donor-advised funds, conservation easements, art
collections, endowments, investments, program-related investments, escrow accounts.

**When triggered.** Part IV questions about these asset types.

### Relevant Parts of Schedule D

**Part I — Donor-advised funds:** number, value BOY, contributions, grants out, value EOY.

**Part II — Conservation easements:** number, acres restricted, easement purposes, changes.

**Part III — Organizations maintaining collections:** collection description, acquisition
policy, public access, deaccession policy.

**Part IV — Escrow and custodial arrangements:** balances beginning/end of year.

**Part V — Endowment funds:** BOY balance, contributions, investment earnings, grants
authorized, other expenditures, EOY balance; donor restrictions.

**Parts VI–XI:** Additional financial detail as applicable.

---

## Schedule G — Supplemental Information Regarding Fundraising or Gaming Activities

**Purpose.** Detail professional fundraising services paid >$15,000 (Part I) and fundraising
events where the combined gross income + contributions across ALL events exceeds $15,000 (Part II).

**When triggered.**
- Part IV Line 17: org paid a professional fundraiser > $15,000 → Schedule G Part I
- Part IV Line 18: gross income + contributions from ALL fundraising events > $15,000 aggregate → Schedule G Part II
- Part IV Line 19: gaming activities → Schedule G Part III

### Part I — Professional Fundraising Activities

List each external professional fundraiser engaged during the year (contracted organization,
not in-house staff):
- Fundraiser name and address
- Activity type
- Gross receipts, retained by org, retained by fundraiser
- Whether org retains custody of contributions

### Part II — Fundraising Events

Schedule G Part II attaches when combined gross income and contributions from ALL fundraising
events for the year exceeds $15,000 (Form 990 Part IV Line 18). Within Part II, report each
event separately:
- Event name, type, date
- Gross receipts
- Event name, date, gross receipts, contributions received, gross income
- Direct expenses (prizes, food/bev, entertainment, rent, other)
- Net income (or loss)

### Part III — Gaming

Gaming types: bingo, pull tabs, charitable gaming tickets, raffles, etc.
- Gross revenue per type
- Prizes / direct expenses
- Net gaming income
- Percentage of gaming activities in each state

---

## Schedule L — Transactions with Interested Persons

**Purpose.** Disclose loans, grants, business transactions with officers, directors,
trustees, key employees, highest-compensated employees, and disqualified persons.

**When triggered.** Part IV Lines 25, 26, 27, or 28.

**Parts:**
- Part I: Excess benefit transactions (for 501(c)(3)/(4))
- Part II: Loans to/from interested persons (name, purpose, balance, interest rate, secured?)
- Part III: Grants or assistance to interested persons
- Part IV: Business transactions with interested persons (description, amount, relationship)

---

## Schedule M — Noncash Contributions

**Purpose.** Detail noncash contributions exceeding $25,000 in the aggregate.

**When triggered.** Part IV Line 29.

For each noncash contribution category: number of contributions, revenues per book,
method of determining revenues (FMV / appraisal / other). Key categories:
- Art, books, clothing
- Collectibles, food inventory
- Investments (stocks, bonds, real estate)
- Intellectual property, royalties
- Vehicles (must attach Form 1098-C for >$500)

---

## Schedule O — Supplemental Information

**Purpose.** Provide narratives required by Part VI governance questions and any other
supplemental explanations the return references.

**When generated.** Always (almost every return has at least one Part VI describe prompt).

### Additional Schedule O Triggers (Beyond Part VI)

Schedule O is also triggered by conditions in other Parts:

| Source | Condition | Schedule O Content |
|--------|-----------|-------------------|
| Part III | Program description exceeds Part III space | Continue narrative in Schedule O |
| Part V Line 3a | 501(h) lobbying election | Explain lobbying dollar amounts and activities |
| Part V Line 7a | Foreign bank accounts | Explain countries and amounts |
| Part IX Line 11g | Fees for services > 10% of Line 25 col A | List each fee type and amount |
| Part IX Line 24e | Other expenses > 10% of Line 25 col A | List each other expense category and amount |
| Part IX Line 26 | Joint costs reported | Describe SOP 98-2 allocation methodology |
| Part X | Changes in net asset classification between BOY and EOY | Explain reclassifications |
| Part XI | Reconciliation amounts differ from audited financials | Line-by-line explanation |
| Part IV | Any "Yes" answer requiring Schedule O explanation | Varies per question |

### Required Narrative Sections

For each Part VI question that says "If Yes, describe in Schedule O":
- Reference the specific Part + Line (e.g., "Schedule O re: Part VI, Line 6 — How are
  voting members of the governing body elected or selected?")
- Provide a substantive narrative (not just a sentence)

### Common Part VI "Describe in Schedule O" Triggers (per 2025 form instructions)

| Line | If "Yes" | If "No" |
|------|----------|----------|
| 1a | Explain material differences in voting rights or broad authority delegated to executive committee | — |
| 2 | Describe any changes to governing documents (bylaws, articles) | — |
| 3 | Describe organization's process for reviewing CEO/ED compensation | — |
| 4 | Describe organization's process for reviewing officer/key employee compensation | — |
| 5 | Describe organization's process for reviewing board member compensation | — |
| 6 | Describe how voting members are elected/selected | — |
| 7a | Describe relationship and transactions with related organizations | — |
| 7b | Describe relationship and transactions with unrelated organizations with common board member | — |
| 8a | — | Explain absence of audit/review committee |
| 8b | — | Explain absence of audit/review |
| 10b | — | Explain failure to make Form 990 available for public inspection |
| 11a | Describe process used to review Form 990 before filing | — |
| 12a | Describe conflict-of-interest policy | — |
| 12b | Describe how COI policy is monitored | — |
| 12c | Describe how COI policy is enforced | — |
| 13 | Describe whistleblower policy (or explain absence) | Explain why no whistleblower policy |
| 14 | Describe document retention/destruction policy (or explain absence) | Explain why no document retention policy |
| 15a | Describe compensation review process for CEO and key employees | — |
| 15b | Describe compensation review process for other officers | — |
| 18 | Describe how governing documents and Form 990 are made available to the public | — |

### Standard Sections (always include for most organizations):

**Functional Expense Allocation Methodology** (Q-F17):
```
Part VI, Line 6 — [Board election process]
Part VI, Line 11a — [Review process for Form 990 prior to filing]
Part VI, Line 12a — [Conflict-of-interest policy description]
Part VI, Line 12b — [How COI policy is monitored]
Part VI, Line 12c — [How COI policy is enforced]
Part VI, Line 15a/b — [Compensation review process for CEO and key employees]
Part VI, Line 18 — [How governing documents and Form 990 are made available]

Functional Expense Allocation Methodology:
  The organization allocates expenses to functional categories using the following methods:
  - Direct assignment: expenses clearly identified with a single function are assigned directly
  - Time-study allocation: shared employee costs (including ED salary) are allocated based on
    [quarterly/annual] time studies showing time devoted to each function
  - Square-footage: occupancy costs are allocated based on [X]% program / [Y]% M&G usage
  All allocations are reviewed by the Board's Finance Committee annually.
```

**Schedule O Output Shape** (in dataset_schedules.json):
```json
"O": {
  "narratives": [
    {
      "reference": "Part VI, Line 11b",
      "question": "Describe the process, if any, used by the organization to review this Form 990",
      "narrative": "..."
    }
  ]
}
```

---

## Schedule C — Political Campaign and Lobbying Activities (STUB)

**Purpose.** Report political campaign or lobbying activities.

**Triggered by.** Part IV Lines 3 (political activities) or 4 (lobbying activities).

**Primary-source requirements:**
- Documentation of any political campaign expenditures
- If electing §501(h) expenditure test: lobbying and grassroots expenditure totals
- If not electing: substantial part test facts
- C3 organizations: verify no candidate campaign activity (disqualifying)

**Playbook (stub — P6 halts with Open Question per B4):**
1. Confirm Part IV Line 3/4 answers with governance docs
2. Identify lobbying election status (h-election vs substantial-part test)
3. Surface Open Question: "Provide total lobbying expenditures and description of activities"
4. Record in `dataset_schedules.json` under `"C": {...}`

> **Note:** Full playbook deferred to a later pass. P6 will halt with an Open Question
> directing the preparer to complete Schedule C manually before proceeding.

---

## Schedule E — Schools (STUB)

**Purpose.** Certify that the organization, as a school, has a racially nondiscriminatory policy.

**Triggered by.** Part IV Line 13 (school per IRC §170(b)(1)(A)(ii)).

**Primary-source requirements:**
- Governing documents establishing nondiscrimination policy
- Documentation that policy has been publicized (annual notice, scholarship info, etc.)
- Student statistics or enrollment records if requested

**Playbook (stub):**
1. Confirm organization operates a school per §170(b)(1)(A)(ii) definition
2. Verify nondiscrimination policy is documented and publicized
3. Surface Open Question: "Provide copy of nondiscrimination policy and most recent public notice"
4. Record in `dataset_schedules.json` under `"E": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question.

---

## Schedule F — Statement of Activities Outside the United States (STUB)

**Purpose.** Report activities conducted outside the US through grants, programs, or offices.

**Triggered by.** Part IV Lines 14b, 15, or 16 (foreign activities, offices, grants).

**Primary-source requirements:**
- List of foreign grantees/sub-recipients with country and amount
- Description of programs conducted outside the US
- Any foreign office or employee count

**Playbook (stub):**
1. Identify all foreign grants from COA mapping (any payee in a non-US country)
2. Surface Open Question: "Provide a list of foreign grants, recipients, and countries"
3. Record in `dataset_schedules.json` under `"F": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question.

---

## Schedule H — Hospitals (STUB)

**Purpose.** Report community benefit activities and financial assistance for hospital organizations.

**Triggered by.** Part IV Line 20a (hospital facility).

**Primary-source requirements:**
- Community benefit cost accounting
- Financial assistance policy documentation
- Charges and collection policy

**Playbook (stub):**
1. Confirm hospital facility status via IRS determination or governing docs
2. Surface Open Question: "Provide community benefit cost data and financial assistance policy"
3. Record in `dataset_schedules.json` under `"H": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question. Schedule H is highly
> specialized — most 501(c)(3) community benefit orgs will NOT trigger this schedule.

---

## Schedule I — Grants and Other Assistance to Organizations, Governments, and Individuals (STUB)

**Purpose.** Report grants and assistance to domestic organizations, governments, and individuals.

**Triggered by.** Part IV Line 21 or 22 (grants to US orgs/govts or to individuals).

**Primary-source requirements:**
- Complete list of grantees with EIN, name, address, purpose, amount
- For individual grants: aggregate amounts by purpose (individual names not required in public filing)
- Grant selection criteria documentation

**Playbook:**
1. Pull grant expense rows from COA mapping (Part IX Line 1-3 mapped rows)
2. Identify domestic vs foreign split (foreign → Schedule F)
3. Determine format: Part II (organizations/governments) or Part III (individuals)

**Part III — Grants to US Individuals (aggregate format):**
For individual grants, scholarships, or similar assistance,
Schedule I Part III uses an aggregate table — individual recipient names are NOT required
in the public filing (and should NOT be included to protect privacy).

Aggregate template:
```
| Type of grant or assistance | Number of recipients | Amount of cash grant | Amount of non-cash assistance | Method of valuation | Description |
|---|---|---|---|---|---|
| [Type of grant, e.g., "Tuition assistance"] | [N] | $[total] | $0 | N/A | [Description of purpose and eligibility criteria] |
| [Type of grant, e.g., "Emergency financial aid"] | [N] | $[total] | $0 | N/A | [Description of program and selection criteria] |
```
- Use generic descriptions (no individual names, no org-identifying details that would reveal
  the specific organization's mission beyond what the IRS requires)
- "Number of recipients" = headcount of individuals who received assistance during the year
- Method of valuation: "N/A" for cash grants; "FMV" for non-cash goods
- Grant selection criteria: document in Schedule O (written criteria required for Part I Line 1 = Yes)

4. For Part II (grants to domestic organizations): individual EIN + name + address + amount
   required; surface Open Question for full grantee list.
5. Record in `dataset_schedules.json` under `"I": {...}`

---

## Schedule J — Compensation Information (STUB — higher fidelity)

**Purpose.** Report compensation details for officers, directors, key employees, and highest-paid employees.

**Triggered by.** Part IV Line 23 (compensation > $150,000 to any individual listed in Part VII).
Also triggered when total compensation to any single listed individual exceeds $150,000
from the organization AND related organizations combined.

**Primary-source requirements (critical — Schedule J is the most IRS-examined schedule):**
- W-2 Box 1 (wages) for each officer/key employee
- W-2 Box 5 (Medicare wages) — used to verify reasonable compensation claims
- 1099-NEC if any are independent contractors
- Board-approved compensation study or comparability data (required for rebuttable presumption)
- Deferred compensation amounts (403(b), 457(b), 457(f)) per plan documents
- Expense account / car allowance / housing detail
- Severance amounts if any

**Playbook (higher fidelity):**
1. **Identify triggered individuals.** Pull Part VII Column D (total compensation) for each
   officer/KE/HCE listed. Trigger if any single individual's total (from org + related) > $150,000.
2. **Collect W-2 / 1099-NEC detail per individual.** Create Open Question to bookkeeper:
   - W-2 Box 1, Box 5, Box 12 (deferred comp codes D/E/F/G), Box 14 (other)
   - Any expense reimbursement or car allowance not in W-2 Box 1
   - Paid severance or deferred compensation vested during the year
3. **Comparability data.** Ask whether the board has a compensation study or used Form 990
   compensation data from peer organizations. If not, surface advisory: "IRS rebuttable
   presumption of reasonableness requires contemporaneous documentation of comparability data."
4. **Complete Part I, II, III columns** for each triggered individual per W-2/1099 detail.
5. **Q-F6 cross-check.** Part VII reported compensation must equal the sum of Part I
   columns (B) through (F) for each individual. Mismatch → NEEDS_UPDATE.
6. Record in `dataset_schedules.json` under `"J": {...}`

**Common errors (high IRS scrutiny):**
- Omitting compensation from related organizations (column C must include related-org amounts)
- Reporting W-2 Box 1 only and forgetting Box 12 deferred comp
- No contemporaneous comparability data → exposes officer to intermediate sanctions (IRC §4958)

> **Note:** J is the single schedule most likely to trigger an IRS correspondence exam.
> Do NOT stub with zero values — always surface the Open Question to the bookkeeper.

---

## Schedule K — Tax-Exempt Bond Obligations (STUB)

**Purpose.** Report tax-exempt bonds issued by the organization.

**Triggered by.** Part IV Line 24a (tax-exempt bonds outstanding).

**Primary-source requirements:**
- Bond documents and original issue amount
- Outstanding principal balance at year-end
- Arbitrage compliance documentation

**Playbook (stub):**
1. Confirm tax-exempt bonds via prior Schedule K or bond documents
2. Surface Open Question: "Provide bond documents, outstanding balance, and arbitrage compliance records"
3. Record in `dataset_schedules.json` under `"K": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question. Most small 501(c)(3)s
> will NOT trigger Schedule K.

---

## Schedule N — Liquidation, Termination, Dissolution, or Significant Disposition of Assets (STUB)

**Purpose.** Report significant asset dispositions or organizational restructuring.

**Triggered by.** Part IV Lines 31 or 32 (liquidation, dissolution, or significant disposition).

**Primary-source requirements:**
- Board resolution authorizing the transaction
- Documentation of assets disposed: description, date, amount, recipient
- State dissolution filing (if applicable)

**Playbook (stub):**
1. Confirm trigger from Part IV Lines 31/32
2. Surface Open Question: "Provide board resolution and documentation of the asset disposition or dissolution"
3. Record in `dataset_schedules.json` under `"N": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question.

---

## Schedule R — Related Organizations and Unrelated Partnerships (STUB)

**Purpose.** Report related organizations and certain partnership transactions.

**Triggered by.** Part IV Lines 33–37 (related organizations, unrelated business income from
partnerships, real estate partnerships).

**Primary-source requirements:**
- List of related organizations with EIN, type, and relationship description
- Partnership K-1s if applicable
- Any transactions between related organizations and the filer

**Playbook (stub):**
1. Identify any related organizations from intake (parent, subsidiaries, common control)
2. Surface Open Question: "Provide a list of related organizations with EIN and relationship description"
3. Record in `dataset_schedules.json` under `"R": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question.
