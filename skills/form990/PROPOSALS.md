# form990 Skill — Design Proposals (Pending User Approval)

These are proposed changes to PHASES.md that require user review and explicit approval
before implementation. Do NOT apply these edits to PHASES.md without approval.

---

## Proposal #7 — Schedule B Donor Address Collection

**Source:** Task #7, form990-skill-todo.md (2026-04-15)
**Status:** PENDING USER APPROVAL

### Problem

FY2025 gap: donor addresses were never collected during the preparation process. Schedule B
(Statement of Contributors) requires full mailing addresses for donors above the applicable
threshold. The FY2025 return left these as `[[ADDR REQUIRED FROM USER]]` placeholders.

### Design Questions Resolved

**1. Phase:** Collect at P6 (schedule generation), not P1. Rationale: Schedule B is only
triggered if Part IV Line 2 = Yes (contributions > Schedule B threshold). Address collection
before P4 Part IV completion would be premature.

**2. Method:** AskUserQuestion inline at P6 when Schedule B is triggered. A Gmail draft to
the user (ED) is an alternative for async collection but adds complexity — inline is simpler
for a single-session workflow. If the user defers, open a pending `open_questions[]` entry
with `type: "donor_address"` and continue; P8 will surface it as NEEDS_UPDATE.

**3. Storage:** `artifacts/schedule-b-filing.md` only (not the plan file). Donor addresses
are PII — they must not appear in plan file breadcrumbs, Decision Log entries, or any artifact
that flows into the public 990 narrative sections. The `schedule-b-filing.md` artifact is
marked `confidential: true` in the artifact metadata.

**4. Officer-donors:** officer-donor address (and any other officer-donors) can come from
the Articles of Incorporation, CA SOS filing, or the prior-year return signature block.
Do NOT ask the user for their own address — extract it from source documents first.

**5. Trigger:** `Part IV Line 2 == "Yes"` → Schedule B required → donor addresses required.

### Proposed PHASES.md Edit — P6 Addition

Insert into the P6 (Schedule Generation) work block, after Part IV Line 2 is confirmed Yes:

```
### P6 — Schedule B Donor Address Collection (if triggered)

If Schedule B is triggered (Part IV Line 2 = Yes):

1. For each donor in schedule_b_donors[]:
   a. If donor is an officer or director listed in Part VII:
      - Extract address from prior-year 990, CA SOS filing, or Articles of Incorporation.
      - Log source document in Decision Log entry: {donor, source, address}.
   b. Otherwise:
      - AskUserQuestion: "Schedule B requires a full mailing address for [Donor Name] who
        contributed [amount]. Can you provide their current address?"
      - If user provides: store in artifacts/schedule-b-filing.md under confidential section.
      - If user defers: create open_questions[] entry:
          { type: "donor_address", donor: <name>, threshold: <amount>,
            status: "pending", message: "Address required for Schedule B" }

2. Mark Q-F8 re-evaluation pending if any donor address is still missing at P8.

IMPORTANT: Donor addresses are PII. Do NOT write them to plan file breadcrumbs,
Decision Log entries, or any artifact other than artifacts/schedule-b-filing.md.
```

---

## Proposal #8 — P1 Donor Name Pre-loading for scrub_pii()

**Source:** Task #8, form990-skill-todo.md (2026-04-15)
**Status:** PENDING USER APPROVAL — but library change is low-risk; see note below.

### Problem

FY2025 gap: `key_facts.donor_names` was not populated until P6 (when Schedule B was
generated). Any breadcrumbs written during P0–P5 that mentioned donor names would contain
unmasked PII. The `scrub_pii()` function cannot redact names it doesn't know yet.

### Proposed PHASES.md Edit — P1 Addition

Insert at the end of the P1 (Source Discovery) work block, after artifact listing:

```
### P1 — Donor Name Pre-population for PII Scrubbing

After document discovery, attempt to populate key_facts.donor_names:

1. Check prior 990 Schedule B (if available in artifacts[]) → extract donor names.
2. Check P&L / bank transactions for any entry labeled "donation" or similar ≥ $5,000.
3. If donors can be identified: set key_facts.donor_names = [<name>, ...].
4. If donors CANNOT be identified at P1:
   - Set key_facts.donor_names = [] (empty list — not null).
   - Write Decision Log entry: { severity: "elevated_pii_risk",
       note: "donor_names unknown at P1; scrub_pii() may not mask all donor references
              in P2–P5 breadcrumbs. Review at P6 when Schedule B is built." }

All subsequent breadcrumb writes (P1 onward) call scrub_pii(donor_names) before writing.
```

### Proposed lib/form990_lib.py Change

In `scrub_pii()`, verify that the function accepts an empty list gracefully (current behavior
is likely correct — an empty list produces no substitutions — but add a unit test for this
case to prevent regression).

Verify TC22 (pre-P6 empty donor_names) still passes after the PHASES.md change.

---

## Proposal #9 — 990-EZ → Full 990 Transition Year: Part I Prior Year Strategy

**Source:** Task #9, form990-skill-todo.md (2026-04-15)
**Status:** PENDING USER APPROVAL

### Problem

FY2025 issue: Fortified Strength filed Form 990-EZ for FY2024 and full Form 990 for FY2025.
Part I of the full Form 990 includes a "Prior Year" column. IRS instructions are silent on
exactly how to map 990-EZ lines to the full Form 990 Part I.

The FY2025 return left the Part I Prior Year column blank. This is defensible but suboptimal —
some lines DO map directly, and a CPA would populate them.

### IRS Guidance Analysis

IRS Form 990 instructions (2025) state: "For the return's first year, leave the 'Prior Year'
column blank." This applies to a first-year filer. For a transition from 990-EZ to full 990,
the org is NOT a first-year filer — they have a prior return. The instruction is ambiguous.

**Three options:**

| Option | Description | Risk |
|--------|-------------|------|
| A | Leave blank + Schedule O note: "Prior year filed on Form 990-EZ; column mapping not provided due to form structure differences" | Defensible; prior-year CPA may prefer this |
| B | Attempt line mapping: 990-EZ Part I Line 9 (total revenue) → 990 Part I Line 12; 990-EZ Part I Line 17 (total expenses) → 990 Part I Line 18; etc. | Moderate — some lines map cleanly, others don't |
| C | Ask user to provide prior-year figures or confirm Option A | Safest; defers to user/CPA judgment |

**Recommendation:** Option B with Schedule O documentation for unmapped lines.
Direct mapping for revenue and expense totals is well-supported; column-level functional
expense detail cannot be mapped from 990-EZ (990-EZ has no functional columns).

### Proposed PHASES.md Edits

**P0 addition — Scope-exclusion banner:**
```
If this is the first year filing full Form 990 (prior year was 990-EZ or 990-N):
  - Set key_facts.transition_from_ez = true
  - Log Decision Log entry: { event: "transition_year", prior_form: "990-EZ",
      note: "Part I Prior Year column will use direct-mapping approach per Proposal #9" }
  - Announce to user: "I see this is your first year filing the full Form 990.
    I'll use your prior 990-EZ to populate the comparison columns where possible."
```

**P5 Part I block — Transition year handling:**
```
If key_facts.transition_from_ez == true:
  Use the following mapping from prior-year 990-EZ to full Form 990 Part I:
    - 990-EZ Line 9 (total revenue)    → 990 Part I Line 12 (prior year)
    - 990-EZ Line 17 (total expenses)  → 990 Part I Line 18 (prior year)
    - 990-EZ Line 21 (net assets EOY)  → 990 Part I Line 22 (prior year)
    - 990-EZ Part I Line 1 (contributions) → 990 Part I Line 8 (prior year)
    Lines with no 990-EZ equivalent: leave blank with Schedule O note.
  Add Schedule O entry: "Prior Year column in Part I reflects figures from the
    organization's FY[prior year] Form 990-EZ. Functional expense columns are not
    available from the 990-EZ format and are left blank for the prior year."
```

**Q-F24 update** (already added to QUESTIONS.md per Task #4):
Q-F24 now requires either populated prior year columns OR a transition-year Schedule O note.

### Q-F24 Gate Tightening (Already Applied in Task #4)

The Q-F24 definition in QUESTIONS.md has been updated to require:
- Populated columns from filed prior return, OR
- Explicit Schedule O transition-year note with mapping methodology documented.

A fully blank Prior Year column with no explanation is NEEDS_UPDATE.
