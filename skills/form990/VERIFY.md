# Form 990 Skill — Verification Plan

Human-readable spec for all 28 test cases:
- **TC1–TC7**: manual tests (require live MCP/network/user interaction, marked `?` in harness)
- **TC8–TC28**: automated tests (21 cases, all runnable with `python3 tests/verify.py`)

Each maps 1:1 to a test function in `tests/verify.py`.
Run with `/form990 verify` or directly via `python3 tests/verify.py`.

---

## TC1 — Cold init (golden path)

**Covers:** P0 invocation, plan file creation, machine state initialization.

**Setup:** Fixture CSV at `tests/fixtures/budget-30rows.csv` simulating ~30 budget lines
(salaries, rent, program supplies, contributions revenue, program fees).

**Steps:**
1. Run `/form990 init --sheet <fixture-id> --tax-year 2025 --plan-path /tmp/tc1-plan.md`
2. Check plan file was created at specified path.
3. Parse the fenced JSON machine state block.
4. Verify P0 = done, P1 = pending in `phase_status`.
5. Verify `key_facts.legal_name`, `key_facts.ein`, `key_facts.tax_year` are non-null.
6. Verify Phase Status Grid shows `[✔] P0` and `[ ] P1`.

**Assertions:**
- Plan file exists, machine state JSON parses without error.
- `phase_status.P0 == "done"` and `phase_status.P1 == "pending"`.
- Key facts table is populated in markdown.

---

## TC2 — Stateless resume

**Covers:** Cold-resume protocol, persona re-adoption, state re-hydration from plan file alone.

**Setup:** Uses TC1's plan file (requires TC1 to have passed).

**Steps:**
1. Delete the sidecar memo file (`~/.claude/.form990-memo-2025.json`) if present.
2. Run `/form990 resume /tmp/tc1-plan.md`.
3. Observe output — must NOT contain "where did we leave off" or equivalent.
4. Verify status UI renders showing correct current phase.

**Assertions:**
- Skill emits phase grid, artifact registry, and open questions sections.
- No "where did we leave off" question to user.
- `current_phase` in output matches the plan file's JSON block.

---

## TC3 — Gate failure loop (Q-F3)

**Covers:** Gate-1 NEEDS_UPDATE routing, `[EDIT: ...]` directive extraction, phase rollback.

**Setup:** Manually corrupt the functional expense matrix so columns don't sum correctly.

**Steps:**
1. Create a plan file with P3 = done and a corrupt `functional-expense.csv` artifact.
2. Run `/form990 review /tmp/tc3-plan.md`.
3. Verify Q-F3 returns NEEDS_UPDATE with an `[EDIT: ...]` directive.
4. Verify CPA review report is written.
5. Verify machine state shows P2 or P3 rolled back to pending.

**Assertions:**
- `gate_results_latest_pass.Q-F3 == "NEEDS_UPDATE"`.
- CPA review report exists.
- Affected phase `phase_status` = "pending" after rollback.

---

## TC4 — Sidecar delete (degraded resume)

**Covers:** Plan-file-only resume when sidecar is missing; Q-C4 sidecar-independence invariant.

**Setup:** Uses TC1's plan file.

**Steps:**
1. Delete `~/.claude/.form990-memo-2025.json`.
2. Run `/form990 resume /tmp/tc1-plan.md`.
3. Verify skill resumes without error.
4. Verify a "sidecar not found" or equivalent notice is emitted (breadcrumb or UI note).

**Assertions:**
- No exception or crash; skill dispatches to correct phase.
- Status UI renders.

---

## TC5 — Email workflow

**Covers:** Gmail draft creation, draft_id recording, reply detection on resume.

**Steps:**
1. Force a P1 open question (missing prior 990) by creating a fixture plan with P1 in-progress.
2. Run `/form990 resume` and observe that a Gmail draft is created (not auto-sent).
3. Verify `open_questions[0].draft_id` is set in the plan file.
4. Simulate a reply by injecting an answered state into the fixture.
5. Re-resume; verify the question flips to `answered`.

**Assertions:**
- Gmail draft created; NOT sent automatically.
- `open_questions[0].draft_id` is non-null.
- Re-resume marks question as answered when reply is detected.

---

## TC6 — PDF fill (P9 smoke test)

**Covers:** P9 execution, blank PDF fetch, coordinate-overlay fill, handoff packet assembly.

**Setup:** Synthetic fully-populated `form990-dataset.json` fixture.

**Steps:**
1. Run P9 against the fixture dataset with `--local-pdf tests/fixtures/f990-blank-2025.pdf`.
2. Verify `form990-reference-filled.pdf` is created.
3. Verify `efile-handoff-packet.md` lists at least 3 e-file providers.
4. Verify `efile-handoff-packet.md` contains officer name and signature instruction.

**Assertions:**
- Filled PDF exists and is non-empty.
- Handoff packet contains provider list and signature block.

---

## TC7 — Live fire (gated — human review required)

**Covers:** End-to-end against real Fortified Strength Google Sheet.

**Gate:** Only run after TC1–TC6 all pass. Requires human review of CPA report before any
filing action.

**Steps:**
1. Run against a **disposable copy** of Fortified Strength's real sheet.
2. Complete all phases P0–P8.
3. Provide CPA review report to user for manual inspection.
4. Do NOT submit anything to an e-file provider without explicit user approval.

**Assertions (manual):**
- No Gate-1 NEEDS_UPDATE items remaining after P8 convergence.
- CPA review report contains plausible values for all Q-F items.

---

## TC8 — Crash-mid-phase recovery (Change 1, Change 2)

**Covers:** Writing-status orphan sweep, HalfWrite crash recovery, phase re-entry from Pre-check.

**Fault-injection:** `FORM990_TEST_CRASH_AFTER=<N>` / `os._exit(137)` is a full-runtime
fault-inject mechanism used by the live skill harness. The unit test in `tests/verify.py`
simulates the post-crash state directly (constructing a `status=writing` artifact with dead
PID 99999) — no real crash is triggered. This is intentional for deterministic stdlib-only testing.

**Steps:**
1. Construct a synthetic "P3 running" machine state with a staging file at
   `artifacts/statement-of-activities.md.writing.99999`.
2. Write ~100 bytes to the staging file (simulating partial write).
3. Set `plan_lock.pid = 99999` (not alive).
4. Simulate the orphan sweep logic inline (no full skill invocation).

**Assertions (unit-test verifiable — `tests/verify.py`):**
- Staging file is unlinked by the orphan sweep.
- `phase_status.P3 == "failed"` with `last_error.error_class == "HalfWrite"`.

**Assertions (full-runtime only — requires `/form990 resume`):**
- A per-orphan breadcrumb is appended mentioning `HalfWrite` and the path.
- On dispatch, P3 routes to Pre-check directly (not AskUserQuestion).
- Breadcrumb contains: `"phase P3 crashed"`, `"HalfWrite"`, and `"resuming from Pre-check"`.

---

## TC9 — Merger positive-ownership assertions (Change 5)

**Covers:** `merge_datasets()` halts on violation of disjoint ownership contract.

**Setup:** Pure-function test with fixed JSON fixtures (no filesystem side-effects).

**Fixtures:**
- `core_with_parts_I.json` = `{"parts":{"I":{"total_revenue":100},"II":{"line_1":100}},"schedule_dependencies":[]}`
  (violates ownership: core must NOT have a non-null parts.I)
- `rollup_populated.json` = `{"parts":{"I":{"total_revenue":200}},"reconciliation":{"delta_match":true}}`
- `schedules_empty.json` = `{"schedules":{}}`

**Steps:**
1. Call `merge_datasets(core_with_parts_I.json, schedules_empty.json, rollup_populated.json, /tmp/tc9-out.json)`.
2. Expect an `AssertionError` or `ValueError` with a message containing
   `"dataset_core.parts.I MUST be null or absent"`.

**Assertions:**
- Exception raised, no output file created.
- Exception message names the ownership violation.

---

## TC10 — Force-override downstream invalidation (Change 7)

**Covers:** `/form990 phase <N>` clears downstream artifact sha256/fingerprints.

**Setup:** Inline synthetic "P5 committed" machine state — built as a Python string literal
in the test (deterministic timestamps, fake sha256 `"a" * 64`, relative artifact paths).

**Steps:**
1. Write the synthetic plan to `/tmp/tc10-plan.md`.
2. Run `/form990 phase P3 /tmp/tc10-plan.md`.
3. Re-parse machine state from plan.

**Assertions:**
- `phase_status.P4`, `.P5`, `.P6`, `.P7`, `.P8`, `.P9` all reset to "pending".
- `artifacts.dataset_core.output_sha256 == null`.
- `artifacts.dataset_core.input_fingerprint` cleared (keys present, values null).
- Decision Log gains an entry containing "force-override P3" and "invalidated downstream".

---

## TC11 — run_script() error classes (Change 3)

**Covers:** `SCRIPT_ALLOWLIST`, null-byte/path-traversal arg rejection, timeout kill+wait,
non-zero exit with structured error-JSON, JSON parse failure.

**Fixtures (in `tests/fixtures/scripts/`):**
- `good_script.py` — emits `{"ok": true}` on stdout, exit 0.
- `bad_stderr.py` — prints traceback-like text to stderr, exits 1.
- `error_json.py` — emits `{"status":"error","error_class":"TestError","error_message":"x"}`, exits 1.
- `timeout_script.py` — `import time; time.sleep(999)`.
- `unparseable.py` — prints `not json` to stdout, exits 0.

**Sub-cases (5):**
1. **Allowlist rejection:** Call `run_script("evil.py", [])` where path not in SCRIPT_ALLOWLIST.
   Expect `ScriptError` with "not in SCRIPT_ALLOWLIST".
2. **Null-byte arg rejection:** Call `run_script("good_script.py", ["val\x00ue"])`.
   Expect `ScriptError` with "rejected arg".
3. **Timeout:** Call `run_script("timeout_script.py", [], phase_id="default")` with deadline=2s.
   Expect `ScriptError` with "timeout after 2s". Verify subprocess is dead after call.
4. **Structured error-JSON:** Call `run_script("error_json.py", [])`.
   Expect `ScriptError` with `err.structured_error["error_class"] == "TestError"`.
5. **JSON parse failure:** Call `run_script("unparseable.py", [])`.
   Expect `ScriptError` with "stdout unparseable".

**Assertions:** Each sub-case raises `ScriptError` with the expected message fragment.

---

## TC12 — verify_ancestors() transitive mismatch (Change 4)

**Covers:** Transitive ancestor walk detects regression in upstream artifact, not just
direct input.

**Setup:**
1. Create a plan with P2 = done (`coa_mapping.output_sha256` = `sha256("original")`),
   P3 = done (`statement_of_activities`, `balance_sheet`, `functional_expense`
   referencing coa_mapping sha), P5 about to run.
2. Write a mutated `coa-mapping.csv` to disk (content doesn't match recorded sha256).

**Steps:**
1. Enter P5 phase entry protocol.
2. `verify_ancestors("dataset_core", state)` is called.
3. Observe that the regression is detected at `coa_mapping` (2 hops from dataset_core).

**Assertions (unit-test verifiable — `tests/verify.py`):**
- `verify_ancestors` returns `(False, [regressions])` listing `coa_mapping`.

**Assertions (full-runtime only — requires full skill invocation):**
- `phase_status.P2 == "failed"` with `last_error.error_class == "ancestor_regression"`.
- Phase halts before the Work block.

---

## TC13 — scrub_pii() correctness (Change 9)

**Covers:** All 4 scrub_pii rules; hyphenated EIN passes through unchanged.

**Sub-cases (2):**

**13a — Redaction rules:**
Input text containing:
- SSN: `123-45-6789` → must become `[REDACTED-SSN]`
- Bare 9-digit: `987654321` → must become `[REDACTED-9DIGIT]`
- Hyphenated EIN: `12-3456789` → must pass through unchanged
- Donor name (key_facts.donor_names = ["Jane Doe"]): `Jane Doe donated $500` → `[REDACTED-DONOR] donated $500`
- 12-digit bank account: `123456789012` → must become `[REDACTED-LONGNUM]`

**Assertions:** Each substitution produces the expected token.

**13b — P9 coordinate_table staleness (Change 6):**

Tested as a pure-function unit test via `p9_coord_check(stored_hash, current_block_content)`:

1. Call `p9_coord_check(sha256("stale"), "current")` → expect `stale == True`.
2. Call `p9_coord_check(sha256("same"), "same")` → expect `stale == False`.

Full-runtime behaviour (verified by TC6 / live fire only): when `stored_hash != hash(current
coordinate block)`, P9 Pre-check resets `reference_pdf.status` to `"absent"` and halts with
a staleness warning before producing the filled PDF.

---

## TC14 — Tempfile sweep completeness (Change 8)

**Covers:** All 4 orphan glob patterns are swept on resume; per-orphan breadcrumbs logged.

**Setup:** Create fixture orphan files with dead PID `99999`:
- `<plan>.tmp.99999`
- `~/.claude/.form990-memo-2025.json.tmp.99999`
- `artifacts/statement-of-activities.md.writing.99999`
- `artifacts/f990-blank-2025.pdf.partial.99999`

**Steps:**
1. Write all 4 orphan files to disk.
2. Run `/form990 resume <plan>`.

**Assertions (unit-test verifiable — `tests/verify.py`):**
- All 4 files are deleted by the orphan sweep.

**Assertions (full-runtime only — requires `/form990 resume`):**
- 4 breadcrumbs are appended, each containing "swept orphaned temp" and the file path.

---

## TC15 — LEARNINGS auto-append + rotation (Change 9)

**Covers:** `auto_append_learning()` on failure; 100-entry rotation to LEARNINGS.archive.md.

**Sub-cases (2):**

**15a — Single failure append:**
1. Trigger a `phase_status.P3 = "failed"` commit.
2. Open `LEARNINGS.md`; parse the machine section.
3. Verify a new entry appears with `phase == "P3"`, `resolution == "pending"`,
   message scrubbed of any PII.

**15b — Rotation:**
1. Inject 101 failure entries into the machine section (programmatically, without
   going through the full skill invocation).
2. Trigger one more failure.
3. Verify oldest entries moved to `LEARNINGS.archive.md`.
4. Verify machine section in `LEARNINGS.md` has ≤ 100 entries.
5. Verify a rotation breadcrumb was appended to the plan.

---

## TC16 — Library importability

**Covers:** A1 (`lib/form990_lib.py` extraction — all helpers in one importable module)

**Setup:** `form990_lib.py` present in `lib/` and on `sys.path`.

**Steps:**
1. `python3 tests/verify.py --case TC16`

**Assertions:**
- All 14 required symbols importable from `form990_lib`:
  `atomic_commit`, `ConcurrentModificationError`, `commit_phase_entry`,
  `verify_ancestors`, `ARTIFACT_DEPS`, `merge_datasets`, `run_script`,
  `ScriptError`, `ERROR_CLASSES`, `scrub_pii`, `append_breadcrumb`,
  `auto_append_learning`, `sweep_orphaned_tmps`, `pid_dead`
- TC16 grid cell: `✔`

---

## TC17 — `pre_image_sha256` threading

**Covers:** A4 (`pre_image_sha256` threaded through all `atomic_commit` call sites)

**Setup:** Temp plan file in `/tmp/` with a well-formed machine state JSON block.

**Steps:**
1. `python3 tests/verify.py --case TC17`

**Assertions (two sub-cases):**
- 17a: `atomic_commit(state_v2, plan_path, correct_pre_image)` succeeds; plan file on disk
  contains updated `plan_version: 2`
- 17b: `atomic_commit(state_v3, plan_path, "0"*64, max_retries=1)` with a stale
  pre-image raises `ConcurrentModificationError`; plan file unchanged
- TC17 grid cell: `✔`

---

## TC18 — `ScriptError._raw_stderr` PII boundary

**Covers:** C2 (`scrub_pii` applied at logging boundary — raw stderr stored privately,
scrubbed content exposed via `str(e)` and `stderr_tail`)

**Setup:** SSN string `"123-45-6789"` injected into synthetic stderr when constructing
a `ScriptError`.

**Steps:**
1. `python3 tests/verify.py --case TC18`

**Assertions:**
- `err._raw_stderr` contains the raw SSN (pre-scrub)
- `str(err)` does NOT contain `"123-45-6789"` but DOES contain `"[REDACTED-SSN]"`
- `err.stderr_tail` does NOT contain the raw SSN
- TC18 grid cell: `✔`

---

## TC19 — `auto_append_learning` scrubs before truncating

**Covers:** A1/A5 (truncate-after-scrub ordering fix — scrub fires on the full message,
not on the already-truncated tail)

**Setup:** Synthetic message: 190 `x` chars + `" SSN: 123-45-6789 end"` = 211 chars total.
The SSN straddles the logical 200-char region.

**Steps:**
1. `python3 tests/verify.py --case TC19`

**Assertions:**
- The appended LEARNINGS entry contains `"[REDACTED-SSN]"` — scrub fired on the full
  message before truncation
- The appended LEARNINGS entry does NOT contain raw `"123-45-6789"`
- TC19 grid cell: `✔`

---

## TC20 — Phone / email / DOB / address scrub rules

**Covers:** C2 (extended `scrub_pii` rules: phone, email, DOB, street address)

**Setup:** `tests/fixtures/golden.py` constants `PII_INPUT_*` / `PII_EXPECTED_*`.
Requires C2 phone rules to be present (capability-probed at runtime).

**Steps:**
1. `python3 tests/verify.py --case TC20`

**Assertions (per golden constant pair):**
- `scrub_pii(PII_INPUT_SSN)` == `PII_EXPECTED_SSN` (`[REDACTED-SSN]`)
- `scrub_pii(PII_INPUT_EIN)` == `PII_EXPECTED_EIN` (hyphenated EIN passes through unchanged)
- `scrub_pii(PII_INPUT_PHONE)` == `PII_EXPECTED_PHONE` (`[REDACTED-PHONE]`)
- `scrub_pii(PII_INPUT_EMAIL)` == `PII_EXPECTED_EMAIL` (`[REDACTED-EMAIL]`)
- `scrub_pii(PII_INPUT_ADDR)` == `PII_EXPECTED_ADDR` (`[REDACTED-ADDR]`)
- `scrub_pii(PII_INPUT_DOB)` == `PII_EXPECTED_DOB` (`[REDACTED-DOB]`)
- TC20 grid cell: `✔` (or `SKIP` if C2 phone rules absent in `scrub_pii`)

---

## TC21 — `scrub_pii` masks donor names with word boundaries

**Covers:** A1/A5 (donor-name word-boundary fix; minimum name length 4 chars)

**Setup:** `tests/fixtures/golden.py` constants `DONOR_NAME_JANE`, `PII_INPUT_DONOR_WB`,
`PII_EXPECTED_DONOR_WB`.
Input text contains both "Jane Doe" (in `donor_names`) and "Alice" (not in list).

**Steps:**
1. `python3 tests/verify.py --case TC21`

**Assertions:**
- `scrub_pii(PII_INPUT_DONOR_WB, donor_names=[DONOR_NAME_JANE])` ==
  `PII_EXPECTED_DONOR_WB`
  (i.e. "Jane Doe" → `[REDACTED-DONOR]`; "Alice" passes through unchanged)
- TC21 grid cell: `✔`

---

## TC22 — Pre-P6 empty `donor_names` scrub (elevated-risk mode)

**Covers:** A1/A5 (`donor_names` not loaded until P1; scrubber in empty-list mode
before then; donor-name-shaped strings should pass through unchanged)

**Setup:** `tests/fixtures/golden.py` constants `PII_INPUT_DONOR_EMPTY`,
`PII_EXPECTED_DONOR_EMPTY`. Donor name list is `[]`.

**Steps:**
1. `python3 tests/verify.py --case TC22`

**Assertions:**
- `scrub_pii(PII_INPUT_DONOR_EMPTY, donor_names=[])` == `PII_EXPECTED_DONOR_EMPTY`
  (i.e. "Jane Doe" passes through unchanged — name scrub requires a populated list)
- TC22 grid cell: `✔`

---

## TC23 — `ARTIFACT_DEPS` cycle detection

**Covers:** A1/A5 (DAG walker raises on circular dependency)

**Setup:** Inject a synthetic cycle `X → Y → X` into a local copy of `ARTIFACT_DEPS`
(saved and restored after the test).

**Steps:**
1. `python3 tests/verify.py --case TC23`

**Assertions:**
- Calling `verify_ancestors("X", {"artifacts": {}})` raises `RuntimeError`
  with `"cycle"` (case-insensitive) in the message
- `ARTIFACT_DEPS` is restored to its original state after the test
- TC23 grid cell: `✔`

---

## TC24 — Q-F4 509(a)(2) 1% / $5,000 floor

**Covers:** B2 (Q-F4 criteria fix: per-donor cap = `max(1% × total_5yr_support, $5,000)`)

**Setup:** `tests/fixtures/golden.py` constants:
- `SUPPORT_5YR_TOTAL = 300_000`
- `ONE_PCT_CAP_COMPUTED = 3_000` (1% of 300K)
- `ONE_PCT_FLOOR_APPLIED = 5_000` (max(3K, 5K))

**Steps:**
1. `python3 tests/verify.py --case TC24`

**Assertions:**
- `ONE_PCT_CAP_COMPUTED == int(SUPPORT_5YR_TOTAL * 0.01)` (i.e. 3,000)
- `ONE_PCT_FLOOR_APPLIED == max(ONE_PCT_CAP_COMPUTED, 5_000)` (i.e. 5,000)
- `ONE_PCT_FLOOR_APPLIED == 5_000` — floor applied; raw 1% cap (3,000) < statutory minimum
- TC24 grid cell: `✔`

---

## TC25 — Part I Line 8 = contributions; Line 12 = total revenue

**Covers:** B1 (PHASES.md P7 typo fix: Part I Line 8 maps to `parts.VIII["1h"]`, not Line 12)

**Setup:** `tests/fixtures/golden.py` constants:
- `LINE_8_CONTRIBUTIONS = 425_000`
- `LINE_12_TOTAL_REVENUE = 612_000`

**Steps:**
1. `python3 tests/verify.py --case TC25`

**Assertions:**
- `LINE_8_CONTRIBUTIONS != LINE_12_TOTAL_REVENUE` (values are distinct — no aliasing)
- `LINE_8_CONTRIBUTIONS == 425_000` (Part VIII Line 1h — total contributions)
- `LINE_12_TOTAL_REVENUE == 612_000` (Part VIII Line 12 — total revenue)
- TC25 grid cell: `✔`

---

## TC26 — CAS normal commit succeeds

**Covers:** C1 (`atomic_commit` with correct `pre_image_sha256` completes round-trip)

**Setup:** Temp plan file with well-formed machine state JSON block.

**Steps:**
1. `python3 tests/verify.py --case TC26`

**Assertions:**
- `atomic_commit(state_v2, plan_path, correct_pre_image)` completes without error
- Plan file on disk contains `"plan_version"` key after commit
- TC26 grid cell: `✔`

---

## TC27 — `is_plan_lock_stale()` host-check staleness

**Covers:** C1 (host mismatch + 24h staleness bound defeats PID-reuse false positives)

**Setup:** Five synthetic `plan_lock` dicts covering all branches.

**Steps:**
1. `python3 tests/verify.py --case TC27`

**Assertions (five sub-cases):**
- `plan_lock = None` → `is_plan_lock_stale()` returns `True`
- `plan_lock = {"acquired_at": ..., "host": "x"}` (missing `pid`) → `True`
- `plan_lock` with `acquired_at = "1970-01-01T00:00:00Z"` (>24h old) → `True` regardless
  of pid/host
- `plan_lock` with dead pid `99999` and recent `acquired_at` → `True` (if `pid_dead(99999)`)
- `plan_lock` with `pid = os.getpid()` (live process) and recent `acquired_at` → `False`
- TC27 grid cell: `✔`

---

## TC28 — `fsync` call ordering in `atomic_commit`

**Covers:** C1 (`fsync(fd)` before `os.replace`; `fsync(parent_dir_fd)` after)

**Setup:** `unittest.mock.patch` on `os.fsync` and `os.replace` inside `form990_lib`
to record call order.

**Steps:**
1. `python3 tests/verify.py --case TC28`

**Assertions:**
- `os.fsync` is called at least once before `os.replace`
- `os.replace` is called exactly once
- `os.fsync` is called at least once after `os.replace`
- Observed call order satisfies: `[..., fsync, ..., replace, ..., fsync, ...]`
- TC28 grid cell: `✔`

---

## Running the Harness

```bash
# All tests
python3 skills/form990/tests/verify.py

# Single test
python3 skills/form990/tests/verify.py --case TC8

# Via skill (if SKILL.md is loaded)
/form990 verify
/form990 verify --case TC12
```

**Exit codes:**
- `0` — all pass
- `1` — one or more failures (see grid + JSON summary)
- `2` — harness error (missing fixture, import failure, etc.)

**Output:**
```
TC1 - | TC2 - | TC3 - | TC4 - | TC5 - | TC6 - | TC7 - | TC8 ✔ | TC9 ✔ | TC10 ✔ | TC11 ✔ | TC12 ✔ | TC13 ✔ | TC14 ✔ | TC15 ✔ | TC16 ✔ | TC17 ✔ | TC18 ✔ | TC19 ✔ | TC20 ✔ | TC21 ✔ | TC22 ✔ | TC23 ✔ | TC24 ✔ | TC25 ✔ | TC26 ✔ | TC27 ✔ | TC28 ✔
{"passed": 21, "failed": [], "skipped": ["TC1","TC2","TC3","TC4","TC5","TC6","TC7"], "duration_s": 3.5}
```

(TC1–TC7 require MCP or human involvement — skipped in automated runs unless `--include-manual` flag is passed.)
