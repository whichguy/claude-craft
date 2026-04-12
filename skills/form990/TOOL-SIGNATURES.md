# Form 990 Skill — Tool Signatures & Host Configuration

Populated during Pre-build Verification (run before build step 1). Records:
- MCP tool schemas + observed argument shapes and return types
- PDF backend availability
- Experiment results (E1–E3)
- Per-tax-year f990 coordinate table (added by step 3a, once per tax year)

---

## Pre-build Verification Status

| Step | Status | Date | Notes |
|---|---|---|---|
| 1. Sentinel re-pin | ⬜ pending | — | Re-pin review-plan/ideate/wiki-init line-number refs |
| 2a. Gmail MCP schema | ⬜ pending | — | gmail_create_draft, gmail_list_drafts, gmail_search_messages |
| 2b. Drive MCP schema | ⬜ pending | — | search_files, read_file_content, get_file_metadata |
| 3. pypdf availability | ⬜ pending | — | python3 -c "import pypdf; print(pypdf.__version__)" |
| 3a. f990 coordinate table | ⬜ pending | — | One-time per tax year; requires blank PDF + pypdf visual inspection |
| 4a. WebFetch f990.pdf | ⬜ pending | — | HEAD verify of https://www.irs.gov/pub/irs-pdf/f990.pdf |
| 4b. WebFetch provider list | ⬜ pending | — | https://www.irs.gov/e-file-providers/... |

---

## Gmail MCP Tool Signatures

*(Populated by Pre-build Verification step 2a)*

```
Tool: gmail_get_profile
  Input:  (none)
  Output: { emailAddress, messagesTotal, threadsTotal, historyId }

Tool: gmail_create_draft
  Input:  { to: string, subject: string, body: string, [cc: string] }
  Output: { id: string, threadId: string, labelIds: string[] }
  Note:   id is the draft_id; store in open_questions[].draft_id

Tool: gmail_list_drafts
  Input:  { [maxResults: number] }
  Output: { drafts: [{ id, threadId }], resultSizeEstimate: number }

Tool: gmail_search_messages
  Input:  { query: string, [maxResults: number default 50] }
  Output: { messages: [{ id, threadId }], resultSizeEstimate: number }
  Note:   cap at 50 per thread; if resultSizeEstimate > 50, log ceiling-hit breadcrumb

Tool: gmail_read_message
  Input:  { messageId: string }
  Output: { id, threadId, from, to, subject, date, body, ... }
```

---

## Google Drive MCP Tool Signatures

*(Populated by Pre-build Verification step 2b)*

```
Tool: list_recent_files
  Input:  { [pageSize: number] }
  Output: { files: [{ id, name, mimeType, modifiedTime }] }
  Note:   smoke-test for auth; do NOT use for P1 search

Tool: search_files
  Input:  { query: string, [pageSize: number], [pageToken: string] }
  Output: { files: [{ id, name, mimeType, modifiedTime, ... }],
            nextPageToken?: string }
  Note:   P1 caps at 200 results per query (4 pages × pageSize=50)
          nextPageToken is PRESENT in this API → pagination is supported

Tool: read_file_content
  Input:  { fileId: string }
  Output: { content: string, mimeType: string }
  Note:   For native Sheets: returns tab names + content as text/csv per tab

Tool: get_file_metadata
  Input:  { fileId: string }
  Output: { id, name, mimeType, modifiedTime, size, ... }
  Note:   headRevisionId availability: TBD (see E2 experiment)
```

---

## Python Environment

*(Populated by Pre-build Verification step 3)*

```
pypdf_version: null      ← fill in: e.g., "4.3.1"
pdftk_java_available: null  ← fill in: true/false
pdftk_java_version: null    ← fill in: e.g., "3.3.3"
```

**Note on Python version:** No version pin is enforced. E3 experiment verifies merger
byte-stability empirically across available Python minors. If hashes diverge, remediation
options: (a) vendor a JCS canonicalizer, (b) recompute sha256 only on input change.

---

## Pre-build Experiments

*(Populated when experiments are run)*

### E1 — AcroForm probe on live f990.pdf

```
date: 2026-04-11
f990_pdf_field_count: 1307
revision_date_embedded: 2025
fill_path: "acroform"
coordinate_overlay_feasible: n/a
notes: >
  Fetched https://www.irs.gov/pub/irs-pdf/f990.pdf on 2026-04-11 (pypdf 6.10.0,
  Python 3.12). AcroForm fields present: 1307. The 2025 f990.pdf ships with
  AcroForm — name-based fill via pdftk-java FDF intermediate is the primary path.
  Coordinate-overlay is the fallback only if pdftk-java is unavailable.
```

**Pass criteria:**
- Path A (AcroForm): `field_count > 0` AND names stable → AcroForm path primary ← **RESULT: PASS**
- Path B (flat, overlay OK): `field_count == 0` AND coordinate overlay works → overlay primary
- Fail: `field_count == 0` AND overlay infeasible → drop PDF artifact, produce markdown table

### E2 — Drive Revisions / modification-tracking probe

```
date: null
headRevisionId_available: null      ← true/false
modifiedTime_updates_on_cell_edit: null  ← true/false
fingerprint_strategy: null          ← "headRevisionId" | "modifiedTime+csv_sha256"
notes: null
```

**Pass criteria:**
- Path A: headRevisionId changes on cell edits → use head_revision_id in input_fingerprint
- Path B: modifiedTime updates + CSV dump feasible → use modifiedTime + tab_snapshot_sha256
- Fail: neither updates reliably → manual "re-sync sheet" prompt on every resume

### E3 — Deterministic JSON merger stability across Python versions

```
date: null
python_versions_tested: []          ← e.g., ["3.10", "3.11", "3.12"]
sha256_hash_per_version: {}         ← { "3.10": "abc...", "3.11": "abc...", ... }
hashes_match: null                  ← true/false
conflict_injection_halted: null     ← true/false (verified merger_conflict fires)
notes: null
```

**Pass criteria:** All hashes match AND conflict injection causes `merger_conflict` halt.
**Fail options:** (a) vendor JCS canonicalizer, (b) pin Python version in all phase dispatches,
(c) drop byte-identical idempotency claim (compute sha256 only when inputs change).


### S1 — PID reuse / os.kill ESRCH behavior (Change 1 spike)

```
date: null
false_positive_rate_pct: null       ← measured under fork-stress test
platform_tested: null               ← e.g., "macOS 15.3"
pass_criteria: "false_positive_rate < 1%"
result: null                        ← PASS | FAIL | PENDING
notes: null
```

### S2 — Existing stdout in P2/P3/P6 scripts (Change 3 spike)

```
date: null
scripts_audited: []                 ← list of script paths checked
scripts_with_stdout: []             ← scripts that print() to stdout
all_gatable_behind_json_only: null  ← true/false
result: null                        ← PASS | FAIL | PENDING
notes: null
```

### S3 — Part IV yes/no item count (B7 spike)

```
date: 2026-04-11
tax_year: 2025
method_used: "empirical + pinned-count"
part_iv_item_count: 38
extraction_method: "pypdf 6.10.0 text extraction from fetched f990.pdf (3 runs)"
deterministic_across_runs: true
notes: >
  pypdf extracted Part IV text from pages 3-4 of the live f990.pdf.
  3 independent runs: identical results each time (items 1-34, 36-38 captured
  by regex; item 35 is 35a/35b composite — regex misses it but it exists on page
  4 line 57). Total: 38 outer checklist items (items 1-38).
  AcroForm "PartIV" field prefix not found in IRS naming convention — runtime
  enumeration via AcroForm names not viable; pinned count of 38 is in effect.
  Re-run when tax_year changes to verify count.
result: PASS (pinned-count branch — 38 confirmed empirically, 3/3 runs)
```

---

## f990 Coordinate Table (tax_year: null)

*(One-time manual step per tax year — populate by running pypdf visual inspection on blank PDF)*

Format: `{ line_id: { page, x, y, width, height, font_size } }`

<!-- BEGIN COORDINATES null -->
```json
{
  "I.1":  { "page": 1, "x": null, "y": null, "width": null, "height": null, "font_size": null },
  "I.8":  { "page": 1, "x": null, "y": null, "width": null, "height": null, "font_size": null },
  "I.18": { "page": 1, "x": null, "y": null, "width": null, "height": null, "font_size": null },
  "I.22": { "page": 1, "x": null, "y": null, "width": null, "height": null, "font_size": null }
}
```
<!-- END COORDINATES null -->

*(Replace `null` in the sentinel comments above with the actual tax year once the coordinate sweep is run. Add all Part I, III, V, VI, VII, VIII, IX, X, XI, XII lines after coordinate sweep.)*
