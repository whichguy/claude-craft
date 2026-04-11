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

- **pypdf coordinate-overlay is primary; pdftk-java AcroForm is fallback.** Recent
  f990.pdf revisions (2024, 2025) are flat PDFs with zero AcroForm fields. Plan for
  the coordinate-overlay path being the only viable route.

- **Drive headRevisionId may not be available.** If the Drive MCP doesn't expose
  Revisions API data, fall back to `{modifiedTime, tab_snapshot_sha256}`. E2 experiment
  documents which path applies to the current host.

---

*[Append new entries below after each run — never delete existing entries]*
