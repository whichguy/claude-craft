# Form 990 Skill — Verification Plan

Human-readable spec for all 15 test cases. Each maps 1:1 to a test function in `tests/verify.py`.
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
TC1 ✔ | TC2 ✔ | TC3 ✔ | TC4 ✔ | TC5 - | TC6 - | TC7 - | TC8 ✔ | ...
{"passed": 8, "failed": [], "skipped": ["TC5","TC6","TC7"], "duration_s": 12.3}
```

(TC5, TC6, TC7 require MCP or human involvement — skipped in automated runs unless `--include-manual` flag is passed.)
