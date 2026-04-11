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
  donor_threshold[y]      = 0.02 × sum(total_support[T-4..T])   ← 2% of 5-yr total support
  
  excess_contributions[y] = sum over all donors d:
                              max(0, donor_contributions[d][y] − donor_threshold[y])

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

```
5yr_program_service_pct = sum(program_service_revenue[T-4..T]) / 5yr_total_support × 100
5yr_investment_pct      = sum(investment_income[T-4..T]) / 5yr_total_support × 100

PASS if: 5yr_program_service_pct ≥ 33⅓%
  AND:   5yr_investment_pct       ≤ 33⅓%
```

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

**Purpose.** Detail fundraising activities exceeding $15,000 or gaming activities.

**When triggered.** Part IV Lines 17 or 19.

### Part I — Fundraising Activities

List events where gross income + contributions > $15,000:
- Event name, date, gross receipts, contributions received, gross income
- Direct expenses (prizes, food/bev, entertainment, rent, other)
- Net income (or loss)

### Part II — Fundraising Events

For each event type (dinners, auctions, etc.):
- Gross receipts
- Charitable contribution portion
- Direct expenses
- Net income

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
