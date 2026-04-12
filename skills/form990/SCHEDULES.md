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

### 509(a)(1) / §170(b)(1)(A)(vi) Public Support Worksheet

```
For each year y in [T-4, T-3, T-2, T-1, T]:
  total_contributions[y]  = Part VIII Line 1 for year y
  govt_grants[y]          = Part VIII Line 1e for year y
  total_support[y]        = all revenue for year y (contributions + program fees +
                             investment income + other)
  # two_pct_threshold is computed ONCE from the 5-year total — same dollar for all years
  two_pct_threshold       = 0.02 × sum(total_support[T-4..T])   ← 2% of 5-yr total support
  
  excess_contributions[y] = sum over all donors d:
                              max(0, donor_contributions[d][y] − two_pct_threshold)

5yr_public_support = sum([total_contributions[y] − excess_contributions[y] for y in window])
5yr_total_support  = sum([total_support[y] for y in window])

public_support_pct = 5yr_public_support / 5yr_total_support × 100
```

**Thresholds:**
- `≥ 33⅓%` → PASS bright-line test → check box Line 5 of Schedule A Part II
- `≥ 10% AND < 33⅓%` → may still pass if facts-and-circumstances narrative is attached
  (community support, board diversity, etc.)  → check box Line 6 of Schedule A Part II
- `< 10%` → FAILS 509(a)(1) test → check if 509(a)(2) applies instead; if not, flag Q-F4
  NEEDS_UPDATE

### 509(a)(2) Worksheet (if public_charity_basis == "509(a)(2)")

The 509(a)(2) test has two prongs and a more complex numerator than 509(a)(1).
The 1% per-donor cap used here differs from 509(a)(1)'s 2% cap — don't conflate them.

**Prong 1 — Public/government support ≥ 33⅓%:**

The numerator is NOT just program service revenue. Per IRC §509(a)(2)(A):
```
permitted_support_numerator =
  government_grants           # no per-donor cap
  + public_contributions      # capped per donor at max(1% of total_support_yr, $5,000)
                              # Note: this is a 1% cap, NOT the 2% cap used in 509(a)(1)
  + program_service_revenue   # fees from exempt-function activities

one_pct_threshold = 0.01 × total_support_yr  # per-year, per-donor cap for Prong 1

permitted_support_5yr = sum over [T-4..T] of:
  government_grants[y]
  + sum(min(d.amount[y], max(one_pct_threshold[y], 5000)) for d in public_donors[y])
  + program_service_revenue[y]

5yr_public_support_pct = permitted_support_5yr / 5yr_total_support × 100
```

**Prong 2 — Investment/unrelated income ≤ 33⅓%:**
```
5yr_investment_pct = sum(investment_income[T-4..T] + UBTI[T-4..T]) / 5yr_total_support × 100
```

**PASS if:** `5yr_public_support_pct ≥ 33⅓%` **AND** `5yr_investment_pct ≤ 33⅓%`

### Facts-and-Circumstances Narrative (if 10%–33⅓%)

Draft a Schedule O narrative covering (per Reg. §1.170A-9(f)(3)):
1. Organization's relationship to governmental units or to the general public
2. Nature of the governing body (community board?)
3. Programs' accessibility to and for the general public
4. Resources solicited from the general public, government, or broad public appeal
5. Community use of facilities or services on a non-discriminatory basis

---

## Schedule B — Schedule of Contributors

**Purpose.** List contributors who gave ≥ $5,000 (or ≥ 2% of total contributions, whichever
is greater) during the tax year. Confidential — not for public inspection.

**When triggered.** Part IV question about large contributions (typically Part IV Line 2).

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

### Required Narrative Sections

For each Part VI question that says "If Yes, describe in Schedule O":
- Reference the specific Part + Line (e.g., "Schedule O re: Part VI, Line 6 — How are
  voting members of the governing body elected or selected?")
- Provide a substantive narrative (not just a sentence)

### Standard Sections (always include for most organizations):

**Functional Expense Allocation Methodology** (Q-F17):
```
Part VI, Line 6 — [Board election process]
Part VI, Line 11b — [Review process for Form 990 prior to filing]
Part VI, Line 12a — [Conflict-of-interest policy description]
Part VI, Line 12b — [How COI policy is monitored]
Part VI, Line 12c — [How COI policy is enforced]
Part VI, Line 15a/b — [Compensation review process for CEO and key employees]
Part VI, Line 19 — [How governing documents are made available]

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

**Playbook (stub):**
1. Pull grant expense rows from COA mapping (Part IX Line 1-3 mapped rows)
2. Identify domestic vs foreign split (foreign → Schedule F)
3. Surface Open Question: "Provide grantee list with EIN, purpose, and amounts for domestic grants"
4. Record in `dataset_schedules.json` under `"I": {...}`

> **Note:** Full playbook deferred. P6 halts with Open Question.

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
