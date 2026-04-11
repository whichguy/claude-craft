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
- [ ] `{{WHY_IT_MATTERS}}` — one sentence on which form line this feeds and why the IRS asks
- [ ] `{{DEADLINE}}` — date by which you need the info (at least 2 weeks before filing)
- [ ] `{{FILING_DEADLINE}}` — Form 990 due date (May 15 for calendar-year orgs; + 6 months
  with Form 8868 extension)
- [ ] `{{EXTENSION_DEADLINE}}` — November 15 for calendar-year orgs
- [ ] `{{EASY_ANSWER_OPTION}}` — a simple "if X, just say so" fallback option
- [ ] `{{PREPARER_NAME}}` — the ED's name
