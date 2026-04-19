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
pypdf_version: "6.10.0"     ← confirmed by E1 (2026-04-11, Python 3.12)
pdftk_java_available: null  ← fill in: true/false (not yet tested)
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

---

## f990 AcroForm Field Map — Tax Year 2025

**File:** `templates/f990-field-map-2025.json`

| Property | Value |
|---|---|
| Source PDF | `https://www.irs.gov/pub/irs-pdf/f990.pdf` |
| IRS Revision Date | 2025-12-12 |
| AcroForm field count | 1,307 |
| Labeled entries in map | 923 |
| Extraction method | XFA template stream (array item 5, ~1.5MB); `<assist><speak>` elements via regex |
| XFA tool | Adobe Designer 6.5 (embedded in PDF) |
| Fill method | `pypdf PdfWriter.update_page_form_field_values()` with full XFA path keys |
| pypdf version | 6.10.0 (confirmed E1, 2026-04-11) |
| Page 1 fields filled FY2025 | 35 |

**Path format:** Short field key format is `short[0]` → full XFA path is
`topmostSubform[0].PageN[0]...<group>[0].short[0]`

**Usage:**
```python
import json
with open("templates/f990-field-map-2025.json") as f:
    field_map = json.load(f)  # { "short[0]": "Human-readable label", ... }
```

**Critical note:** Re-run E1 probe each tax year — IRS renumbers XFA fields when the form
is revised. The 2025 field map must not be used for tax year 2026+ without re-extraction.
The 384 unlabeled fields (1,307 − 923) are checkboxes and calculated-total cells that carry
no `<assist><speak>` element; they can be identified by inspecting the XFA template directly.


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

## Phase 2 — Public Lookup URL Templates (Change 5)

*Verified by runtime web research 2026-04-19.*
*Spike S0 (IRS XML schema) completed 2026-04-19 — PASS on element names, URL pattern corrected (see below).*
*Spike S1 must confirm ProPublica field mapping before fetch_propublica() ships.*

### IRS e-file XML (Bulk Batch — Spike S0 VERIFIED)

```
Spike S0 result (2026-04-19):
  - Element names CONFIRMED correct from official IRS MeF schema docs
  - Old S3 URL (s3.amazonaws.com/irs-form-990/{object_id}_public.xml) → 404, DEAD
  - New location: apps.irs.gov/pub/epostcard/990/xml/{YEAR}/

Index CSV (10-50MB per year):
  https://apps.irs.gov/pub/epostcard/990/xml/{YEAR}/index_{YEAR}.csv
  Columns include: EIN, ObjectId, TaxPeriod, FormType, batch filename

Batch ZIP files (monthly, ~50-200MB each):
  https://apps.irs.gov/pub/epostcard/990/xml/{YEAR}/{YEAR}_TEOS_XML_{MM}A.zip
  (some months have multiple parts: B, C, D)

fetch_irs_xml() implementation — HTTP Range approach (fast, avoids full ZIP download):
  1. Download index CSV via urllib.request.urlopen() — stream into memory, parse CSV
  2. Filter for EIN match → get ObjectId + batch filename
  3. HEAD request on batch ZIP URL → get Content-Length
  4. Range request for last 65KB of ZIP → parse ZIP central directory (EOCD + CDR)
  5. Find target file entry in central directory → get local file header offset + compressed size
  6. Range request for just that byte range → decompress with zipfile.ZipFile(BytesIO(...))
  7. Parse resulting XML with xml.etree.ElementTree

Timeout budget: 60s for index CSV + 30s per batch ZIP (Range requests only)
  → Update PHASE_DEADLINES_S["p0_irs_xml_s"] = 90  (replaces p0_public_lookup_s: 15)

Confirmed XPath element names (IRS990, from MeF schema):
  Revenue:       Return/ReturnData/IRS990/CYTotalRevenueAmt
  Contributions: Return/ReturnData/IRS990/CYContributionsGrantsAmt
  EOY assets:    Return/ReturnData/IRS990/NetAssetOrFundBalancesEOYAmt
  BOY assets:    Return/ReturnData/IRS990/NetAssetOrFundBalancesBOYAmt
  Expenses:      Return/ReturnData/IRS990/TotalFunctionalExpensesAmt

For 990-EZ: parent element is IRS990EZ, field names differ (use concordance file)
  https://nonprofit-open-data-collective.github.io/irs-efile-master-concordance-file/

ProPublica XML download-xml endpoint (object_id format):
  https://projects.propublica.org/nonprofits/download-xml?object_id={object_id}
  (Fortified Strength FY2024 object_id: 202531349349309248 — confirmed accessible via org page)
  Note: WebFetch returns 403; use urllib with User-Agent header for direct Python access.
```

### IRS TEOS (Tax Exempt Organization Search)

```
Web UI:   https://apps.irs.gov/app/eos/
Bulk CSV: https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads
          (monthly ZIP downloads, pipe-delimited, state-partitioned)

IMPORTANT: TEOS has NO JSON API endpoint. Programmatic access options:
  Option A: WebFetch on the web UI URL + HTML parse (fragile, may break on IRS redesign)
  Option B: Download EO BMF bulk CSV and parse locally (preferred for repeated queries)
  Option C: Use ProPublica as proxy — ProPublica data is derived from IRS filings

For fetch_teos(), recommend Option A as a lightweight smoke-check; fall back to
user-prompt if HTML parsing fails (log error_class=TEOSUnavailable).

Key fields extractable from TEOS UI HTML:
  determination_letter_status, exempt_status, last_return_year, last_return_form
```

### ProPublica Nonprofit Explorer API

```
URL template: https://projects.propublica.org/nonprofits/api/v2/organizations/{ein_nodash}.json
  Note: EIN must be WITHOUT hyphens (e.g., "853576252" not "85-3576252")

Auth: None required.
Rate limit: Not documented; reasonable rate < 1 req/sec recommended.

Response schema (top-level):
  {
    "organization": { "name": str, "ein": int, "ntee_code": str, ... },
    "filings_with_data": [
      {
        "tax_prd_yr": int,     ← fiscal year end year
        "totrevenue": float,   ← TOTAL REVENUE (NOT gross_receipts — see Spike S1)
        "totfuncexpns": float, ← total functional expenses
        "totassetsend": float, ← end-of-year total assets
        "totliabend": float,   ← end-of-year total liabilities (net assets = assets - liab)
        "totrcptperbks": float,← gross receipts per books
        "pdf_url": str,        ← URL to publicly available 990 PDF
        ...40+ additional fields
      }
    ],
    "filings_without_data": [...]  ← filings where parsed data not available
  }

SPIKE S1 COMPLETE (2026-04-19 PASS):
  totrevenue = correct gross_receipts proxy (totrcptperbks absent from API)
  totnetassetend = direct EOY net assets field (no subtraction needed)
  totfuncexpns = total functional expenses — all confirmed matching filed returns
  FY2024 not yet indexed (lag); FY2021-FY2023 confirmed within $1 of filed PDFs
  
Field mapping (pending S1 confirmation):
  plan field                    → ProPublica field
  gross_receipts                → totrcptperbks  (UNVERIFIED — may be totrevenue)
  total_expenses                → totfuncexpns   (UNVERIFIED)
  eoy_net_assets                → totassetsend - totliabend  (UNVERIFIED)
  pdf_url                       → pdf_url        (verified pattern exists)
```

### California AG Charity Registry

```
Web UI: https://oag.ca.gov/charities
  Search form: POST to https://rct.doj.ca.gov/Verification/Web/Search.aspx
  or: https://oag.ca.gov/charities/search?name=&id=CT0272348&type=charity

JSON API: No official CA AG JSON API.
Candid API: https://api.candid.org/charitycheck/v1/CA?ag_state_charity_reg_num=CT{number}
  Requires Candid subscription (not available without auth).

Recommendation for fetch_ca_rct():
  Use WebFetch on CA DOJ RCT verification URL + HTML parse.
  Key fields: registration_status, last_rrf1_year.
  On parse failure: log error_class=StateAGUnavailable, fall through to user_prompt.
```

### Candid/GuideStar — Public Access (No Auth Required, Spike S2 2026-04-19)

```
Login path: FAIL (Cloudflare Turnstile CAPTCHA on app.candid.org/login)
Public path: PASS — reclassified to Tier 0 (no-auth public source)

Search URL (no auth):
  https://app.candid.org/search?keyword={legal_name_url_encoded}
  Returns: list of orgs with EIN, seal, revenue, assets — find by EIN match
  Access: chrome-devtools__navigate_page + take_snapshot (JS-rendered, WebFetch gets shell only)

Direct profile URL (no auth):
  https://app.candid.org/profile/{candid_profile_id}/{org-slug}
  Example: https://app.candid.org/profile/9918853/fortified-strength-inc-85-3576252
  Profile ID found in search result href (second path segment)

Data available on summary page (confirmed for Fortified Strength, 2026-04-19):
  - Organization name, EIN, tax status
  - Seal level (Silver/Gold/Platinum)
  - Total revenue, total assets, total giving (most recent year)
  - Mission statement (full text)
  - Full address
  - Website URL

Data NOT available without login:
  - Sub-tabs (/financials, /forms-990, /people, /grants) require JS tab navigation
    and may require login for detailed history

fetch_candid_public() implementation pattern:
  1. navigate_page to search URL with legal_name keyword
  2. take_snapshot → parse a11y tree → find result where EIN text matches
  3. Extract profile href from matching result
  4. navigate_page to profile URL
  5. take_snapshot → extract revenue/assets/giving/mission/address/website
  Breadcrumb: tier:0 source:candid_public
```

### Keychain Helper Contract

```
Function: get_portal_creds(service: str) -> Secret
  Service allowlist (hardcoded): {"form990-candid", "form990-benevity"}
  Darwin: subprocess.run(["security", "find-generic-password", "-s", service, "-w"],
          shell=False, timeout=10)
  Non-Darwin fallback: os.environ.get(f"FORM990_{service_upper}_PW")
  Error classes: KeychainLocked (exit 36), KeychainPermissionDenied (exit 44),
                 KeychainMissingEntry (all other non-zero or binary-not-found)
  Secret.__repr__ / __str__ → "***" (never logged)
```

### Outlook MCP Detection

```
At skill-load time, detect Outlook MCP availability:
  if any MCP tool named *outlook* or *microsoft_mail* is in the tool list → present
  else → absent (Tier 4 skipped, no hard failure)

If present, mirror Gmail's 10-query pattern:
  Subject:"990" → prior returns
  Subject:"budget" OR Subject:"financials" → financial statements
  ... (same 10 query categories as Gmail Tier 1)
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
