# Email Question Template

Use this template when drafting a Gmail message to an external party (bookkeeper, prior CPA,
board member) to request information needed for the Form 990. Fill all `{{PLACEHOLDER}}`
values before calling `gmail_create_draft`. **Never auto-send** — draft only.

---

Subject: Form 990 Filing — {{TAX_YEAR}} — {{QUESTION_TOPIC}}

Hi {{RECIPIENT_NAME}},

I'm preparing {{LEGAL_NAME}}'s Form 990 for the {{TAX_YEAR}} tax year and need your
help with one item.

**What I need:** {{SPECIFIC_ASK}}

**Why it matters for the return:**
{{WHY_IT_MATTERS}}

**Deadline:** {{DEADLINE}} (our filing deadline is {{FILING_DEADLINE}})

**Easy answer option:** {{EASY_ANSWER_OPTION}}
*(For example: "If this doesn't apply, just reply 'not applicable' and I'll note it.")*

If you have a question or prefer to discuss by phone, please let me know.

Thank you,
{{PREPARER_NAME}}
Executive Director, {{LEGAL_NAME}}

---

*This question is part of our Form 990 preparation for the {{TAX_YEAR}} fiscal year.
The 990 is due {{FILING_DEADLINE}} (or {{EXTENSION_DEADLINE}} with a 6-month extension).*

---

## Draft Variables Checklist

Before calling `gmail_create_draft`, verify all placeholders are filled:

- [ ] `{{RECIPIENT_NAME}}` — first name or full name of the recipient
- [ ] `{{TAX_YEAR}}` — 4-digit tax year (e.g., 2025)
- [ ] `{{QUESTION_TOPIC}}` — 3–6 word topic for the subject line
- [ ] `{{SPECIFIC_ASK}}` — one-paragraph concrete description of what you need
- [ ] `{{WHY_IT_MATTERS}}` — filled automatically from the lookup table below (C3); do not ask the ED to write this
- [ ] `{{DEADLINE}}` — date by which you need the info (at least 2 weeks before filing)
- [ ] `{{FILING_DEADLINE}}` — Form 990 due date (May 15 for calendar-year orgs; + 6 months
  with Form 8868 extension)
- [ ] `{{EXTENSION_DEADLINE}}` — November 15 for calendar-year orgs
- [ ] `{{EASY_ANSWER_OPTION}}` — a simple "if X, just say so" fallback option
- [ ] `{{LEGAL_NAME}}` — the organization's IRS-registered legal name
- [ ] `{{PREPARER_NAME}}` — the ED's name

---

## WHY_IT_MATTERS Lookup Table (C3)

The skill fills `{{WHY_IT_MATTERS}}` automatically based on the question type.
The ED never writes this — it is looked up from the table below and passed through `scrub_pii()`.

| Question type (keyword match) | WHY_IT_MATTERS text |
|---|---|
| prior 990 / prior year return | "The IRS requires us to include prior-year figures alongside current-year numbers. Without the prior 990, we have to estimate those columns, which increases audit risk." |
| W-2 / payroll / officer salary | "The IRS cross-checks the compensation we report on the 990 against W-2s filed by the employer. A mismatch is one of the most common 990 audit triggers." |
| 1099 / contractor / independent | "The 990 asks us to count how many contractors we paid $100,000 or more and to list the top-paid ones. We need the 1099 register to get those numbers right." |
| bank statement / cash balance | "The IRS asks for beginning- and end-of-year cash and investment balances. We pull those from bank statements — it's one of the few places we can't estimate." |
| donor list / contributions | "We need to know if any single donor gave more than 2% of our total revenue over the past 5 years. This affects Schedule A, which determines our public charity status." |
| board roster / board member | "The 990 asks us to list all board members, their hours per week, and whether they received any compensation. We need the current board roster to do that." |
| bylaws / governing document | "The IRS asks several governance questions (Part VI) that require us to have reviewed our bylaws in the past year. We need a copy to confirm the review date." |
| conflict of interest / COI policy | "The 990 asks specifically whether we have a written conflict-of-interest policy and whether board members disclose conflicts annually. We need the policy document to confirm." |
| audit / review / financial statement | "If your organization had a financial audit or review done, we need to disclose it on the 990 and, in some states, file it alongside the return." |
| payroll tax / 941 / 940 | "The 990 asks whether we are current on payroll tax filings. We need confirmation from your payroll provider that all 941s were filed on time." |
| depreciation / fixed asset | "The balance sheet on the 990 needs to show net fixed assets (cost minus accumulated depreciation). We need the depreciation schedule to fill those lines." |

