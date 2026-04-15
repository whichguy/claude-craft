# Form 990 Skill — Learnings

Append-only observations and recent-run notes. Each entry: date + phase + finding.
Populated after each substantive run. Analogous to the `learningsText` injection idiom
from `ideate-system-prompt/SKILL.md §learningsText`.

---

## 2026-04-11 — Initial skill build

- **E-filing pivot is the most important context to inject early.** Users who ask to "fill
  out the PDF" uniformly expect to file via the PDF. The P0 banner must be prominent: the
  PDF is a reference/review artifact only; MeF is the actual filing channel.

- **Part I null placeholder (structural, not a bug).** `dataset_core.json` declares
  `"I": null` intentionally — it is a structural placeholder so the P7 merger can
  take `dataset_rollup.parts.I` verbatim. Do not interpret null as "missing data."

- **Schedule B two-output contract is not optional.** Even for organizations that think
  "we have no large donors" — if Schedule B is triggered by Part IV, both the filing
  version and the public version must be produced. The public version's redaction is
  legally required (IRC §6104(d)(3)(A)), not optional privacy hygiene.

- **Content-SHA256 CAS beats flock on macOS.** macOS `flock(2)` is advisory; any
  text editor the user opens can overwrite the plan file mid-session. The CAS pre-image
  comparison is the only reliable lost-write backstop.

- **Circuit breaker is fact-centric.** Lazy-verification regressions detected inside
  a phase Pre-check still count toward the 3-strike rule — the breaker cannot be escaped
  by deferring a flapping fact past resume-time.

- **AcroForm (pdftk-java) is primary; pypdf coordinate-overlay is the fallback.**
  E1 (2026-04-11) confirmed the 2025 f990.pdf ships with 1307 AcroForm fields —
  name-based fill via pdftk-java FDF intermediate is the primary path. Coordinate-
  overlay applies only when pdftk-java is unavailable. Earlier guidance stating
  "coordinate-overlay is primary" was based on pre-E1 assumptions and is superseded
  by the E1 empirical result.

- **Drive headRevisionId may not be available.** If the Drive MCP doesn't expose
  Revisions API data, fall back to `{modifiedTime, tab_snapshot_sha256}`. E2 experiment
  documents which path applies to the current host.

---

---

## 2026-04-14 — FY2025 Fortified Strength P0–P8 live run

- **PST tab is current-year only.** The "Public Support Test" tab in Tiller tracks the
  current fiscal year only — not the 5-year history required by IRS Schedule A. Always
  read each prior-year P&L tab directly (P&L Report 2024, P&L Report 2023, etc.) using
  the section-tracking exec pattern. The PST tab is useful only as a current-year sanity
  check. (P6 Fortified Strength — confirmed via Logger read 2026-04-13.)

- **Section-tracking required for P&L reads.** Both the INCOME and EXPENSE sections of
  the Tiller P&L have rows labeled "Total Fundraising" and "Total Program Service
  Revenue." A simple label-match loop overwrites the income subtotals with expense
  subtotals. The fix: track whether you're in the INCOME or EXPENSE section and only
  grab the relevant total from each. (P6 Fortified Strength.)

- **509(a)(2) is FULL EXCLUSION of DQ persons — never a cap.** SCHEDULES.md previously
  documented a 1% per-donor cap on public contributions for 509(a)(2). This is wrong.
  The correct rule: disqualified persons are excluded entirely via Line 7a (no cap, no
  floor). The 1%/$5,000 threshold (Line 7b) applies only to non-DQ persons' PSR/UBI
  (Lines 2–3), never to contributions (Line 1). The 2% per-donor cap is the 509(a)(1)
  rule. (SCHEDULES.md corrected 2026-04-14.)

- **Line 7b threshold is based on the 5-year total, not annual.** The cap for Schedule A
  Part III Line 7b is `max($5,000, 1% × five_yr_total_support)` — computed once from the
  full 5-year support window. For small orgs with total 5-yr support < $500,000, the
  $5,000 floor dominates. For larger orgs (Fortified Strength: $998,718 5-yr total), the
  1% floor = $9,987. Members paying $2,000+/year for 5 years trigger it. Per-member data
  is required for a precise Line 7b; aggregate P&L reads are insufficient.

- **Part XI Line 5 placeholder not auto-resolved by P7.** `dataset_core.json` Part XI
  Line 5 retains its P5-era placeholder after P7 runs because P7 only writes to
  `dataset_rollup.json` (Parts I + reconciliation). The correct P7 value must be manually
  backfilled into `dataset_core.json` Part XI.5 after Q-F2 PASS is confirmed.
  (Caught in quality review 2026-04-14; fix: set to actual reconciled value -9284.37.)

- **BudgetTools container-bound copy is the correct exec path.** The org budget sheet
  lives in an org Google Drive account invisible to personal-account Drive MCP. The
  correct exec chain: mcp-gas-deploy exec → BudgetTools scriptId (1E8rYsyb...) →
  SpreadsheetApp.openById('1VbiVbBxjQUwMaN4...') [disposable copy]. getActiveSpreadsheet()
  returns null in programmatic exec context. (P2–P7 Fortified Strength.)

- **CA companion filings confirmed required for CA 501(c)(3)s.** CA Form 199 (FTB) +
  RRF-1 + CT-TR-1 (AG Registry) are required when GR > $50,000. All three are due the
  15th day of the 5th month after FY end (May 15 for calendar-year orgs) — same deadline
  as federal 990. CA Form 199 is NOT replaced by the federal 990; FTB requires its own
  filing. (Confirmed at P8 review; Part V Line 3b triggers this check.)

- **Part VII requires W-2 Box 1 gross wages — net pay is not acceptable.** Tiller records
  net payroll deposits (after employee withholding). Part VII Section A requires W-2 Box 1
  reportable compensation (gross wages minus pre-tax deductions). Never use Tiller net pay
  figures for Part VII; request the Gusto W-2 summary. (Q-F6 NEEDS_UPDATE P8 Pass 1.)

*[Append new entries below after each run — never delete existing entries]*

<!-- BEGIN MACHINE LEARNINGS (auto-appended; do not hand-edit) -->
<!-- END MACHINE LEARNINGS -->
