# Form 990 Plan — {{LEGAL_NAME}} — Tax Year {{YYYY}}

<!-- BEGIN MACHINE STATE (do not hand-edit; skill rewrites atomically) -->
```json
{
  "schema_version": 2,
  "plan_version": 0,
  "skill_version": "form990@1.0.0",
  "tax_year": null,
  "fiscal_year_start": null,
  "fiscal_year_end": null,
  "form_variant": null,
  "current_phase": "P0",
  "phase_status": {
    "P0": "pending",
    "P1": "pending",
    "P2": "pending",
    "P3": "pending",
    "P4": "pending",
    "P5": "pending",
    "P6": "pending",
    "P7": "pending",
    "P8": "pending",
    "P9": "pending"
  },
  "gate_results_latest_pass": {},
  "gate_pass_count": 0,
  "memoized_gates": [],
  "required_schedules": [],
  "open_questions": [],
  "artifacts": {
    "coa_mapping":         { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P2", "produced_at": null },
    "statement_of_activities": { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P3", "produced_at": null },
    "balance_sheet":       { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P3", "produced_at": null },
    "functional_expense":  { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P3", "produced_at": null },
    "part_iv_checklist":   { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P4", "produced_at": null },
    "dataset_core":        { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P5", "produced_at": null },
    "dataset_schedules":   { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P6", "produced_at": null },
    "dataset_rollup":         { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {"dataset_core": null}, "output_sha256": null, "produced_in_phase": "P7", "produced_at": null },
    "reconciliation_report":  { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {"dataset_core": null}, "output_sha256": null, "produced_in_phase": "P7", "produced_at": null },
    "dataset_merged":         { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {"dataset_core": null, "dataset_schedules": null, "dataset_rollup": null}, "output_sha256": null, "produced_in_phase": "P7-merge", "produced_at": null,
                             "notes": "disjoint-key composition product via pure-function merger; dataset_core owns parts.II-XII + schedule_dependencies, dataset_rollup owns parts.I + reconciliation, dataset_schedules owns schedules; never hand-authored; rebuildable; halts on key conflict" },
    "schedule_b_filing":   { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P6", "produced_at": null,
                             "confidentiality": "irs_only",
                             "notes": "full donor names + addresses + amounts; IRC §6104(d)(3)(A) — disclose to IRS, redact for public inspection. MUST be in .gitignore." },
    "schedule_b_public":   { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P6", "produced_at": null,
                             "confidentiality": "public",
                             "notes": "donor names replaced with 'Anonymous'; addresses stripped; amounts retained. Safe for VCS and public inspection copy." },
    "reference_pdf":       { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {"dataset_merged": null, "blank_pdf": null, "coordinate_table": null}, "output_sha256": null, "produced_in_phase": "P9", "produced_at": null },
    "schedule_o":          { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P6", "produced_at": null },
    "cpa_review_report":   { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P8", "produced_at": null },
    "efile_handoff":       { "path": null, "status": "absent", "staging_path": null, "input_fingerprint": {}, "output_sha256": null, "produced_in_phase": "P9", "produced_at": null }
  },
  "plan_lock": { "pid": null, "acquired_at": null, "host": null, "note": "informational only — authoritative concurrency is content-SHA256 CAS; see Resume Protocol" },
  "inputs": [],
  "key_facts": {
    "legal_name": null,
    "ein": null,
    "accounting_method": null,
    "gross_receipts_current": null,
    "gross_receipts_3yr_average": null,
    "total_assets_eoy": null,
    "public_charity_basis": null,
    "sheet_schema": null,
    "fiscal_year_start": null,
    "fiscal_year_end": null,
    "donor_names": [],
    "profile_path": null,
    "profile_sha256": null,
    "people": null,
    "auth_accounts": null,
    "known_resources": null,
    "registrations": null,
    "providers": null,
    "portal_credentials": null,
    "public_filing_history_ein": null,
    "prior_filed_eoy_net_assets": null,
    "prior_filed_gross_receipts_5y": []
  },
  "decision_log": [],
  "revalidation_events": [],
  "programmatic_scripts": []
}
```
<!-- END MACHINE STATE -->

## Resume Instructions (Read Me First)

You are Claude resuming this plan. Do not ask the user "where did we leave off" — this section tells you.

1. Read the MACHINE STATE block above. The `current_phase` is authoritative.
2. Adopt the CPA Reviewer persona (see `## Persona` below) for gate evaluation and the User Context persona for tone.
3. Read every `artifacts.*` path that is non-null into working memory.
4. Scan `open_questions[]` where `status == "pending"`. If any are answered (check Gmail via `gmail_search_messages` with the draft_id thread or ask the user), record the answer and mark `answered` before proceeding.
5. Dispatch to PHASES.md §`current_phase` for the playbook. Run it to completion or to the next natural pause.
6. After the phase completes, run applicable gates from QUESTIONS.md, update MACHINE STATE atomically, append a dated breadcrumb to "## Breadcrumbs," and render the status UI.
7. If any Gate-1 question is NEEDS_UPDATE, the current phase is NOT done — loop back in it until clean or until you need user input.

## Persona

### CPA Reviewer (used for Q-F evaluation)

You are a CPA with 15 years of nonprofit-sector specialization. You have reviewed hundreds of Form 990s for small 501(c)(3)s and have seen every common mistake. Your mental model: IRS instructions > GAAP > "what the client wants to say." You are skeptical but constructive. You never approve a return with a Gate-1 issue unresolved. Your primary loyalty is the integrity of the return.

### User Context (used for tone and explanation depth)

The human preparer is the Executive Director of {{LEGAL_NAME}}. They are not an accountant. When you explain CPA concepts, use plain language and always explain *why* the IRS asks — not just what they ask. If a concept is outside their expertise, offer to draft an email to their bookkeeper or accountant.

## Intent & Scope

<!-- Filled by P0 init — one-paragraph statement of why this return is being prepared -->
*Pending P0 intake.*

## Key Facts (mirrors machine state; human-readable)

| Fact | Value | Source | Discovered |
|---|---|---|---|
| Legal name | — | — | — |
| EIN | — | — | — |
| Fiscal year | — | — | — |
| Gross receipts (current) | — | — | — |
| Gross receipts (3-yr avg) | — | — | — |
| Total assets EOY | — | — | — |
| Public charity basis | — | — | — |
| Accounting method | — | — | — |

## Phase Status Grid

```
┌─────────────────────────────────────────────────────────────────────────┐
│  P0  Intake & Variant Routing                      [ ] pending          │
│  P1  Source Discovery (Sheets / Drive / Gmail)     [ ] pending          │
│  P2  Chart-of-Accounts → 990 Line Mapping          [ ] pending          │
│  P3  Financial Statement Production                [ ] pending          │
│  P4  Part IV Checklist → Schedule Trigger          [ ] pending          │
│  P5  Core Parts III/V/VI/VII/VIII/IX/X/XI/XII      [ ] pending          │
│  P6  Schedule Generation (A always; others on trig)[ ] pending          │
│  P7  Part I Rollup & Reconciliation                [ ] pending          │
│  P8  CPA Quality Review Pass                       [ ] pending          │
│  P9  Reference PDF Fill + E-file Handoff Packet    [ ] pending          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Gate Scorecard (latest pass)

```
╔══════════════════════════════════════════════════════════════════════╗
║  form990 CPA Review — not yet run                                    ║
╚══════════════════════════════════════════════════════════════════════╝
  Gate 1 Blocking   · 0/8 evaluated
  Gate 2 Important  · 0/8 evaluated
  Gate 3 Advisory   · 0/2 evaluated
  Health:  [░░░░░░░░░░░░░░░░░░░░]   awaiting P8
```

## Artifact Registry

| Kind | Path | Produced in | Status |
|---|---|---|---|
| CoA mapping | — | P2 | not yet |
| Statement of Activities | — | P3 | not yet |
| Balance Sheet | — | P3 | not yet |
| Functional Expense matrix | — | P3 | not yet |
| Part IV schedule-trigger checklist | — | P4 | not yet |
| Form 990 dataset — core (Parts II–XII) | — | P5 | not yet |
| Form 990 dataset — schedules | — | P6 | not yet |
| Form 990 dataset — rollup (Part I + reconciliation) | — | P7 | not yet |
| Reconciliation report | — | P7 | not yet |
| Form 990 dataset — merged (consumable union) | — | P7-merge | not yet |
| Schedule B — filing (IRS-only, PII) | — | P6 | not yet |
| Schedule B — public (redacted) | — | P6 | not yet |
| Reference PDF (filled) | — | P9 | not yet |
| Schedule O narratives | — | P6 | not yet |
| CPA review report | — | P8 | not yet |
| E-file handoff packet | — | P9 | not yet |

## Programmatic Scripts

*(Populated as each [PROG] phase runs — see PHASES.md §Cross-Cutting Pattern for entry schema.)*

| Script | Purpose | Phase | Status |
|---|---|---|---|

*(Scripts are committed to git — they document how data was processed and enable re-runs.)*

## Open Questions

*(empty — populated when skill pauses for human input or to draft Gmail)*

## Breadcrumbs (append-only, dated)

*(empty — each phase appends a dated entry here on completion)*

## Decision Log

| Date | Phase | Decision | Rationale |
|---|---|---|---|

## Next Action (written for cold-resume)

You are at **P0 — Intake**. Run `/form990 init --sheet <id> --tax-year <YYYY>` to begin,
or if already started, run P0 intake steps:
1. Ask the user for EIN, legal name, fiscal year, accounting method, public charity basis
2. Pull the Google Sheet's tab list
3. Capture 3-year gross-receipts history
4. Run the variant decision tree
5. Populate key_facts and write the Key Facts table
