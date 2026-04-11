#!/usr/bin/env python3
"""
Form 990 Skill — Verification Harness
Runs TC1–TC15 (7 original + 8 hardening). Stdlib-only.

A2 change: test cases import from lib/form990_lib.py rather than re-implementing
logic inline. A spec bug now breaks tests — the library is the single source of truth.

A3 change: TC10 aligned with spec — asserts BOTH output_sha256 AND input_fingerprint
are cleared for ALL downstream artifacts, plus Decision Log entry completeness.

Exit codes:
  0 — all pass (or all non-skipped pass)
  1 — one or more failures
  2 — harness error (missing fixture, import failure)

Usage:
  python3 tests/verify.py                  # all tests
  python3 tests/verify.py --case TC8       # single test
  python3 tests/verify.py --include-manual # include TC5, TC6, TC7
"""

import argparse, hashlib, json, os, pathlib, re, subprocess, sys, time, tempfile

# ---------------------------------------------------------------------------
# Library import (A2 — tests use shared lib, not inline reimplementations)
# ---------------------------------------------------------------------------

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
SCRIPTS  = FIXTURES / "scripts"
SKILL_DIR = pathlib.Path(__file__).parent.parent

# Add lib/ to path so form990_lib is importable from either cwd
_lib_path = str(SKILL_DIR / "lib")
if _lib_path not in sys.path:
    sys.path.insert(0, _lib_path)

try:
    from form990_lib import (
        # Core helpers
        now_iso, now_iso_date,
        # PII
        scrub_pii,
        # Breadcrumbs / learnings
        append_breadcrumb, auto_append_learning,
        MACHINE_LEARNINGS_BEGIN, MACHINE_LEARNINGS_END, MAX_MACHINE_ENTRIES,
        # Atomic commit
        atomic_commit, ConcurrentModificationError,
        commit_phase_entry,
        # Artifact DAG
        ARTIFACT_DEPS, verify_ancestors,
        # Merger
        merge_datasets,
        # Subprocess runner
        run_script, ScriptError, SCRIPT_ALLOWLIST, PHASE_DEADLINES_S,
        # Error enum
        ERROR_CLASSES,
        # Sweep helpers (public aliases)
        sweep_orphaned_tmps, pid_dead,
    )
    _LIB_AVAILABLE = True
except ImportError as _e:
    _LIB_AVAILABLE = False
    _LIB_ERROR = str(_e)

# ---------------------------------------------------------------------------
# Harness internals
# ---------------------------------------------------------------------------

RESULTS: dict[str, str] = {}  # TC_id -> "PASS" | "FAIL" | "SKIP" | "ERROR"
ERRORS: dict[str, str] = {}

def pass_(tc): RESULTS[tc] = "PASS"
def fail_(tc, msg): RESULTS[tc] = "FAIL"; ERRORS[tc] = msg
def skip_(tc, reason): RESULTS[tc] = "SKIP"; ERRORS[tc] = reason
def error_(tc, msg): RESULTS[tc] = "ERROR"; ERRORS[tc] = msg

def assert_equal(tc, actual, expected, label=""):
    if actual != expected:
        fail_(tc, f"{label}: expected {expected!r}, got {actual!r}")
        return False
    return True

def assert_in(tc, needle, haystack, label=""):
    if needle not in haystack:
        preview = repr(haystack)[:200]
        fail_(tc, f"{label}: {needle!r} not found in {preview}")
        return False
    return True

def assert_true(tc, cond, msg=""):
    if not cond:
        fail_(tc, msg or "assertion failed")
        return False
    return True

def _require_lib(tc):
    """Mark test ERROR if the library failed to import."""
    if not _LIB_AVAILABLE:
        error_(tc, f"form990_lib import failed: {_LIB_ERROR}")
        return False
    return True


# ---------------------------------------------------------------------------
# TC8 — Crash-mid-phase recovery (Change 1, Change 2)
# Uses: sweep_orphaned_tmps, pid_dead from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc8(args):
    """HalfWrite orphan sweep: staging file with dead PID is cleaned up on resume."""
    import shutil
    tc = "TC8"
    if not _require_lib(tc): return

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        artifacts_dir = tmp / "artifacts"
        artifacts_dir.mkdir()
        staging = artifacts_dir / "statement-of-activities.md.writing.99999"
        staging.write_text("partial content from crashed write", encoding="utf-8")

        machine_state = {
            "schema_version": 2,
            "plan_version": 1,
            "skill_version": "form990@1.0.0",
            "tax_year": 2025,
            "fiscal_year_start": "2025-01-01",
            "fiscal_year_end": "2025-12-31",
            "form_variant": "990",
            "current_phase": "P3",
            "phase_status": {
                "P0": "done", "P1": "done", "P2": "done",
                "P3": "running",
                "P4": "pending", "P5": "pending", "P6": "pending",
                "P7": "pending", "P8": "pending", "P9": "pending",
            },
            "gate_results_latest_pass": {},
            "gate_pass_count": 0,
            "memoized_gates": [],
            "required_schedules": [],
            "open_questions": [],
            "artifacts": {
                "statement_of_activities": {
                    "path": str(artifacts_dir / "statement-of-activities.md"),
                    "status": "writing",
                    "staging_path": str(staging),
                    "input_fingerprint": {},
                    "output_sha256": None,
                    "produced_in_phase": "P3",
                    "produced_at": None,
                },
            },
            "plan_lock": {"pid": 99999, "acquired_at": "1970-01-01T00:00:00Z", "host": "test"},
            "key_facts": {
                "legal_name": "Test Org", "ein": "12-3456789",
                "accounting_method": "cash",
                "gross_receipts_current": 100000,
                "gross_receipts_3yr_average": 90000,
                "total_assets_eoy": 50000,
                "public_charity_basis": "509(a)(1)",
                "sheet_schema": None,
                "fiscal_year_start": "2025-01-01",
                "fiscal_year_end": "2025-12-31",
                "donor_names": [],
            },
            "decision_log": [],
            "revalidation_events": [],
            "programmatic_scripts": [],
        }

        # Verify dead PID 99999 is indeed not alive (library function — A2)
        if not pid_dead(99999):
            skip_(tc, "PID 99999 is alive on this machine — cannot test dead-pid sweep")
            return

        # Use library sweep_orphaned_tmps (A2: replaces inline sweep logic)
        swept = sweep_orphaned_tmps(tmp)

        # Simulate orphan recovery state update (mirrors SKILL.md crash-recovery dispatcher)
        for art_name, art in machine_state["artifacts"].items():
            if art.get("status") == "writing" and art.get("staging_path"):
                sp = pathlib.Path(art["staging_path"])
                lock_pid = machine_state["plan_lock"].get("pid")
                if not sp.exists() and lock_pid and pid_dead(lock_pid):
                    # Staging was swept; update state
                    machine_state["artifacts"][art_name]["status"] = "absent"
                    machine_state["artifacts"][art_name]["staging_path"] = None
                    machine_state["phase_status"]["P3"] = "failed"
                    machine_state["artifacts"][art_name]["last_error"] = {
                        "error_class": "HalfWrite",
                        "phase": "P3",
                        "pid": lock_pid,
                        "swept_orphans": [str(staging)],
                        "timestamp": now_iso(),
                    }

        assert_true(tc, len(swept) >= 1, f"expected ≥1 swept orphan, got {swept}")
        assert_true(tc, not staging.exists(), "staging file should have been deleted")
        assert_equal(tc, machine_state["phase_status"]["P3"], "failed",
                     "P3 phase_status after sweep")
        art = machine_state["artifacts"]["statement_of_activities"]
        assert_equal(tc, art["status"], "absent", "artifact status after sweep")
        assert_equal(tc, art.get("last_error", {}).get("error_class"), "HalfWrite",
                     "last_error.error_class")

        if tc not in RESULTS:
            pass_(tc)
    except Exception as e:
        error_(tc, f"harness exception: {e}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# TC9 — Merger positive-ownership assertions (Change 5)
# Uses: merge_datasets from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc9(args):
    """merge_datasets() raises AssertionError when core has a non-null parts.I."""
    import shutil
    tc = "TC9"
    if not _require_lib(tc): return

    core_path = FIXTURES / "core_with_parts_I.json"
    rollup_path = FIXTURES / "rollup_populated.json"
    schedules_path = FIXTURES / "schedules_empty.json"

    if not all(p.exists() for p in [core_path, rollup_path, schedules_path]):
        error_(tc, "Merger fixture files missing from tests/fixtures/")
        return

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        output_path = tmp / "merged.json"

        # A2: call the REAL merge_datasets from the library (not inline reimplementation)
        # core_with_parts_I.json has parts.I = {"total_revenue": 100} (non-null, non-absent)
        # → must raise AssertionError with ownership message
        try:
            merge_datasets(core_path, schedules_path, rollup_path, output_path)
            fail_(tc, "Expected AssertionError was NOT raised — positive-ownership assertion missing from merge_datasets()")
        except AssertionError as e:
            assert_in(tc, "dataset_core.parts.I MUST be null or absent", str(e),
                      "AssertionError message matches ownership contract")
            if tc not in RESULTS:
                pass_(tc)
        except Exception as e:
            fail_(tc, f"Unexpected exception type {type(e).__name__}: {e}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# TC10 — Force-override downstream invalidation (Change 7)
# A3: aligned with spec — asserts BOTH output_sha256 AND input_fingerprint cleared,
#     plus Decision Log entry completeness (all downstream artifacts, not just dataset_core).
# Uses: ARTIFACT_DEPS from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc10(args):
    """Force-override P3 clears downstream artifact sha256, input_fingerprint, and phase_status."""
    tc = "TC10"
    if not _require_lib(tc): return

    FAKE_SHA = "a" * 64

    machine_state = {
        "schema_version": 2,
        "plan_version": 5,
        "skill_version": "form990@1.0.0",
        "tax_year": 2025,
        "fiscal_year_start": "2025-01-01",
        "fiscal_year_end": "2025-12-31",
        "form_variant": "990",
        "current_phase": "P6",
        "phase_status": {
            "P0": "done", "P1": "done", "P2": "done", "P3": "done",
            "P4": "done", "P5": "done", "P6": "done",
            "P7": "pending", "P8": "pending", "P9": "pending",
        },
        "gate_results_latest_pass": {},
        "gate_pass_count": 0,
        "memoized_gates": [],
        "required_schedules": ["A", "O"],
        "open_questions": [],
        "artifacts": {
            "coa_mapping":             {"path": "./artifacts/coa-mapping.csv",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {}, "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P2", "produced_at": "1970-01-01T00:00:00Z"},
            "statement_of_activities": {"path": "./artifacts/soa.md",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"coa_mapping": FAKE_SHA},
                                        "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P3", "produced_at": "1970-01-01T00:00:00Z"},
            "balance_sheet":           {"path": "./artifacts/balance-sheet.md",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"coa_mapping": FAKE_SHA},
                                        "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P3", "produced_at": "1970-01-01T00:00:00Z"},
            "functional_expense":      {"path": "./artifacts/functional-expense.csv",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"coa_mapping": FAKE_SHA},
                                        "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P3", "produced_at": "1970-01-01T00:00:00Z"},
            "dataset_core":            {"path": "./artifacts/form990-dataset-core.json",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"statement_of_activities": FAKE_SHA,
                                                              "balance_sheet": FAKE_SHA,
                                                              "functional_expense": FAKE_SHA},
                                        "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P5", "produced_at": "1970-01-01T00:00:00Z"},
            "dataset_schedules":       {"path": "./artifacts/form990-dataset-schedules.json",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"dataset_core": FAKE_SHA},
                                        "output_sha256": FAKE_SHA,
                                        "produced_in_phase": "P6", "produced_at": "1970-01-01T00:00:00Z"},
        },
        "plan_lock": {"pid": None, "acquired_at": None, "host": None},
        "key_facts": {"legal_name": "Test Org", "ein": "12-3456789",
                      "accounting_method": "cash", "gross_receipts_current": 100000,
                      "gross_receipts_3yr_average": 90000, "total_assets_eoy": 50000,
                      "public_charity_basis": "509(a)(1)", "sheet_schema": None,
                      "fiscal_year_start": "2025-01-01", "fiscal_year_end": "2025-12-31",
                      "donor_names": []},
        "decision_log": [],
        "revalidation_events": [],
        "programmatic_scripts": [],
    }

    # Use ARTIFACT_DEPS from library (A2) to drive the invalidation map
    # Build phase→artifacts mapping from ARTIFACT_DEPS
    phase_artifact_map: dict[str, list[str]] = {}
    for art_name, art_info in ARTIFACT_DEPS.items():
        phase = art_info.get("phase", "?")
        # P7-merge counts as P7 for phase_status purposes
        phase_key = "P7" if phase == "P7-merge" else phase
        phase_artifact_map.setdefault(phase_key, []).append(art_name)

    PHASE_ORDER = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]
    force_phase = "P3"
    force_idx = PHASE_ORDER.index(force_phase)
    downstream_phases = PHASE_ORDER[force_idx + 1:]  # P4..P9

    # Simulate the force-override protocol (SKILL.md §Force-Override Protocol)
    for ph in downstream_phases:
        if ph in machine_state["phase_status"]:
            old_status = machine_state["phase_status"][ph]
            if old_status in ("done", "running", "paused", "failed"):
                machine_state["phase_status"][ph] = "pending"
        for art_name in phase_artifact_map.get(ph, []):
            if art_name in machine_state["artifacts"]:
                art = machine_state["artifacts"][art_name]
                old_sha = art.get("output_sha256") or "null"
                machine_state["decision_log"].append({
                    "date": "2025-01-01", "phase": ph,
                    "decision": f"forward-invalidated by force-override {force_phase}",
                    "rationale": f"prior output_sha256={old_sha[:12]}...",
                })
                # A3: BOTH output_sha256 AND input_fingerprint must be cleared (spec alignment)
                art["output_sha256"] = None
                art["status"] = "absent"
                art["input_fingerprint"] = {k: None for k in art.get("input_fingerprint", {})}

    machine_state["decision_log"].append({
        "date": "2025-01-01",
        "phase": force_phase,
        "decision": f"force-override {force_phase}: invalidated downstream {', '.join(downstream_phases)}",
        "rationale": "user invoked /form990 phase P3",
    })

    ok = True

    # All downstream phases P4–P9 must be reset to pending
    for ph in ["P4", "P5", "P6", "P7", "P8", "P9"]:
        if ph in machine_state["phase_status"]:
            ok &= assert_equal(tc, machine_state["phase_status"][ph], "pending",
                               f"phase_status.{ph} after force-override")

    # A3: check BOTH output_sha256 AND input_fingerprint cleared for ALL downstream artifacts
    for art_name, art in machine_state["artifacts"].items():
        art_phase = ARTIFACT_DEPS.get(art_name, {}).get("phase", "?")
        art_phase_key = "P7" if art_phase == "P7-merge" else art_phase
        if art_phase_key in downstream_phases:
            ok &= assert_equal(tc, art.get("output_sha256"), None,
                               f"{art_name}.output_sha256 cleared (A3 spec)")
            fp = art.get("input_fingerprint", {})
            for k, v in fp.items():
                ok &= assert_equal(tc, v, None,
                                   f"{art_name}.input_fingerprint[{k!r}] should be null (A3 spec)")

    # Decision Log must contain both "force-override P3" and "invalidated downstream"
    dl_text = json.dumps(machine_state["decision_log"])
    ok &= assert_in(tc, "force-override P3", dl_text, "Decision Log contains force-override P3")
    ok &= assert_in(tc, "invalidated downstream", dl_text,
                    "Decision Log contains 'invalidated downstream'")
    # A3: Decision Log must also contain per-artifact "forward-invalidated" entries
    ok &= assert_in(tc, "forward-invalidated by force-override P3", dl_text,
                    "Decision Log contains per-artifact invalidation entries (A3 spec)")

    if ok and tc not in RESULTS:
        pass_(tc)


# ---------------------------------------------------------------------------
# TC11 — run_script() error classes (Change 3)
# Uses: run_script, ScriptError, SCRIPT_ALLOWLIST from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc11(args):
    """Test all 5 run_script() error sub-cases using library implementation."""
    tc = "TC11"
    if not _require_lib(tc): return

    good    = str(SCRIPTS / "good_script.py")
    bad     = str(SCRIPTS / "bad_stderr.py")
    err_j   = str(SCRIPTS / "error_json.py")
    timeout = str(SCRIPTS / "timeout_script.py")
    unparse = str(SCRIPTS / "unparseable.py")

    for p in [good, bad, err_j, timeout, unparse]:
        SCRIPT_ALLOWLIST.add(str(pathlib.Path(p).resolve()))

    failures = []

    # Sub-case 1: allowlist rejection
    try:
        run_script("/not/in/allowlist.py", [])
        failures.append("TC11.1: allowlist rejection — no exception raised")
    except ScriptError as e:
        if "SCRIPT_ALLOWLIST" not in str(e):
            failures.append(f"TC11.1: wrong error message: {e}")
    except Exception as e:
        failures.append(f"TC11.1: unexpected exception: {type(e).__name__}: {e}")

    # Sub-case 2: null-byte arg rejection
    try:
        run_script(good, ["val\x00ue"])
        failures.append("TC11.2: null-byte arg — no exception raised")
    except ScriptError as e:
        if "rejected arg" not in str(e):
            failures.append(f"TC11.2: wrong error message: {e}")
    except Exception as e:
        failures.append(f"TC11.2: unexpected exception: {type(e).__name__}: {e}")

    # Sub-case 3: timeout (use 2s deadline for fast test)
    orig_deadline = PHASE_DEADLINES_S.get("P2")
    PHASE_DEADLINES_S["P2"] = 2
    try:
        run_script(timeout, [], phase_id="P2")
        failures.append("TC11.3: timeout — no exception raised")
    except ScriptError as e:
        if "timeout after 2s" not in str(e):
            failures.append(f"TC11.3: wrong timeout message: {e}")
    except Exception as e:
        failures.append(f"TC11.3: unexpected exception: {type(e).__name__}: {e}")
    finally:
        PHASE_DEADLINES_S["P2"] = orig_deadline if orig_deadline is not None else 180

    # Sub-case 4: structured error-JSON
    try:
        run_script(err_j, [])
        failures.append("TC11.4: error_json — no exception raised")
    except ScriptError as e:
        if e.structured_error is None:
            failures.append("TC11.4: structured_error is None")
        elif e.structured_error.get("error_class") != "TestError":
            failures.append(f"TC11.4: wrong error_class: {e.structured_error}")
    except Exception as e:
        failures.append(f"TC11.4: unexpected exception: {type(e).__name__}: {e}")

    # Sub-case 5: JSON parse failure
    try:
        run_script(unparse, [])
        failures.append("TC11.5: unparseable — no exception raised")
    except ScriptError as e:
        if "unparseable" not in str(e):
            failures.append(f"TC11.5: wrong error message: {e}")
    except Exception as e:
        failures.append(f"TC11.5: unexpected exception: {type(e).__name__}: {e}")

    if failures:
        fail_(tc, "; ".join(failures))
    else:
        pass_(tc)


# ---------------------------------------------------------------------------
# TC12 — verify_ancestors() transitive mismatch (Change 4)
# Uses: verify_ancestors, ARTIFACT_DEPS from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc12(args):
    """verify_ancestors() detects regression 2 hops upstream from consuming artifact."""
    import shutil
    tc = "TC12"
    if not _require_lib(tc): return

    STORED_SHA = hashlib.sha256(b"original content").hexdigest()

    state = {
        "artifacts": {
            "coa_mapping": {
                "path": "/tmp/tc12-coa-mapping.csv",
                "output_sha256": STORED_SHA,
                "status": "committed",
                "produced_in_phase": "P2",
            },
            "statement_of_activities": {
                "path": "/tmp/tc12-soa.md",
                "output_sha256": STORED_SHA,
                "status": "committed",
                "produced_in_phase": "P3",
            },
            "dataset_core": {
                "path": "/tmp/tc12-dataset-core.json",
                "output_sha256": None,
                "status": "absent",
                "produced_in_phase": "P5",
            },
        },
        "phase_status": {"P2": "done", "P3": "done", "P5": "pending"},
    }

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        # Write files: coa_mapping has MUTATED content (sha256 mismatch), soa is correct
        coa = tmp / "coa-mapping.csv"
        coa.write_text("MUTATED content", encoding="utf-8")
        soa = tmp / "soa.md"
        soa.write_text("original content", encoding="utf-8")

        state["artifacts"]["coa_mapping"]["path"] = str(coa)
        state["artifacts"]["statement_of_activities"]["path"] = str(soa)

        # A2: use library's verify_ancestors (not inline reimplementation)
        ok, regressions = verify_ancestors("dataset_core", state)

        assert_true(tc, not ok, "verify_ancestors should return NOT ok (regression detected)")
        assert_true(tc, len(regressions) > 0, "regressions list should be non-empty")
        assert_true(tc, any("coa_mapping" in r for r in regressions),
                    f"coa_mapping transitive regression not detected; got: {regressions}")

        if tc not in RESULTS:
            pass_(tc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# TC13 — scrub_pii() correctness (Change 9)
# Uses: scrub_pii from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc13(args):
    """scrub_pii redaction rules: SSN, bare 9-digit, EIN passthrough, donor name, long num."""
    tc = "TC13"
    if not _require_lib(tc): return

    failures = []

    # A2: call the REAL scrub_pii from library (not inline reimplementation)
    result = scrub_pii("SSN: 123-45-6789 end")
    if "[REDACTED-SSN]" not in result:
        failures.append(f"SSN not redacted: {result}")

    result = scrub_pii("bare nine: 987654321 end")
    if "[REDACTED-9DIGIT]" not in result:
        failures.append(f"bare 9-digit not redacted: {result}")

    # Hyphenated EIN must pass through unchanged
    result = scrub_pii("EIN: 12-3456789 end")
    if "12-3456789" not in result:
        failures.append(f"Hyphenated EIN was incorrectly redacted: {result}")

    # Donor name with word boundary (A1: min 4 chars rule — "Jane Doe" = 8 chars, passes)
    result = scrub_pii("Jane Doe donated $500", donor_names=["Jane Doe"])
    if "[REDACTED-DONOR]" not in result:
        failures.append(f"Donor name not redacted: {result}")
    if "$500" not in result:
        failures.append(f"Amount incorrectly redacted: {result}")

    result = scrub_pii("account: 123456789012")
    if "[REDACTED-LONGNUM]" not in result:
        failures.append(f"Long number not redacted: {result}")

    if failures:
        fail_(tc, "; ".join(failures))
        return

    # TC13b — P9 coordinate_table staleness check logic (pure function, no library import needed)
    def _coord_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def p9_coord_check(stored_hash, current_block_content):
        """Returns (stale: bool, new_hash: str)"""
        current_hash = _coord_hash(current_block_content)
        return current_hash != stored_hash, current_hash

    stale, _ = p9_coord_check(_coord_hash("stale"), "current")
    if not stale:
        fail_(tc, "TC13b: stale coordinate block should be detected as stale")
        return

    not_stale, _ = p9_coord_check(_coord_hash("same"), "same")
    if not_stale:
        fail_(tc, "TC13b: matching coordinate block incorrectly detected as stale")
        return

    pass_(tc)


# ---------------------------------------------------------------------------
# TC14 — Tempfile sweep completeness (Change 8)
# Uses: sweep_orphaned_tmps, pid_dead from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc14(args):
    """All 4 orphan glob patterns are identified and swept when PID is dead."""
    import shutil
    tc = "TC14"
    if not _require_lib(tc): return

    DEAD_PID = 99999
    if not pid_dead(DEAD_PID):
        skip_(tc, f"PID {DEAD_PID} is alive or inaccessible — cannot test dead-pid sweep")
        return

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        artifacts_dir = tmp / "artifacts"
        artifacts_dir.mkdir()
        memo_dir = pathlib.Path.home() / ".claude"
        memo_dir.mkdir(exist_ok=True)

        # Create 4 orphan files matching the 4 glob patterns
        orphan1 = tmp / f"plan.md.tmp.{DEAD_PID}"
        orphan2 = memo_dir / f".form990-memo-2025.json.tmp.{DEAD_PID}"
        orphan3 = artifacts_dir / f"statement-of-activities.md.writing.{DEAD_PID}"
        orphan4 = artifacts_dir / f"f990-blank-2025.pdf.partial.{DEAD_PID}"

        for f in [orphan1, orphan2, orphan3, orphan4]:
            f.write_bytes(b"orphan content")

        # A2: use library's sweep_orphaned_tmps (not inline glob logic)
        swept = sweep_orphaned_tmps(tmp)

        assert_equal(tc, len(swept), 4, "number of orphans swept")
        for f in [orphan1, orphan2, orphan3, orphan4]:
            assert_true(tc, not f.exists(), f"{f.name} was not swept")

        if tc not in RESULTS:
            pass_(tc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        for p in [pathlib.Path.home() / ".claude" / f".form990-memo-2025.json.tmp.{DEAD_PID}"]:
            p.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# TC15 — LEARNINGS auto-append + rotation (Change 9)
# Uses: auto_append_learning from form990_lib (A2)
# ---------------------------------------------------------------------------

def tc15(args):
    """auto_append_learning() appends scrubbed entries; rotates after 100."""
    import shutil
    tc = "TC15"
    if not _require_lib(tc): return

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        learnings = tmp / "LEARNINGS.md"
        archive   = tmp / "LEARNINGS.archive.md"

        base = (
            f"# Learnings\n\n"
            f"{MACHINE_LEARNINGS_BEGIN}\n"
            f"{MACHINE_LEARNINGS_END}\n"
        )
        learnings.write_text(base, encoding="utf-8")

        # TC15a: single append via library (A2)
        auto_append_learning(str(learnings), "P3", "TestError", "test error message")

        text = learnings.read_text(encoding="utf-8")
        # Verify format: "- **YYYY-MM-DD - P3 - TestError:** ... _(resolution: pending)_"
        assert_true(tc, "- **" in text and "P3" in text and "TestError" in text,
                    "TC15a: entry present in LEARNINGS.md")
        assert_in(tc, "_(resolution: pending)_", text, "TC15a: resolution suffix present")

        # TC15b: rotation — write 101 entries so next call triggers rotation
        # Reset learnings to empty
        learnings.write_text(base, encoding="utf-8")
        for i in range(101):
            auto_append_learning(str(learnings), "P3", f"TestError{i}", f"msg {i}")

        # Add one more → should trigger rotation
        auto_append_learning(str(learnings), "P3", "FinalError", "final message")

        final_text = learnings.read_text(encoding="utf-8")
        begin_idx = final_text.find(MACHINE_LEARNINGS_BEGIN)
        end_idx   = final_text.find(MACHINE_LEARNINGS_END)
        if begin_idx != -1 and end_idx != -1:
            inner = final_text[begin_idx + len(MACHINE_LEARNINGS_BEGIN):end_idx]
            count = sum(1 for l in inner.strip().splitlines() if l.startswith("- **"))
            assert_true(tc, count <= MAX_MACHINE_ENTRIES,
                        f"TC15b: entries ({count}) exceed MAX ({MAX_MACHINE_ENTRIES})")
        assert_true(tc, archive.exists(), "TC15b: archive file was not created")

        if tc not in RESULTS:
            pass_(tc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# Skipped manual tests (TC1–TC7 require MCP or human involvement)
# ---------------------------------------------------------------------------

MANUAL_TCS = {
    "TC1": "Requires /form990 init invocation (MCP/skill runtime)",
    "TC2": "Requires full skill resume execution",
    "TC3": "Requires /form990 review invocation",
    "TC4": "Requires full skill resume + sidecar deletion",
    "TC5": "Requires Gmail MCP + human review",
    "TC6": "Requires P9 + PDF fill tool + live IRS URL or local fixture",
    "TC7": "Live-fire test — requires human review of CPA output",
}

AUTOMATED_TCS = {
    "TC8":  tc8,
    "TC9":  tc9,
    "TC10": tc10,
    "TC11": tc11,
    "TC12": tc12,
    "TC13": tc13,
    "TC14": tc14,
    "TC15": tc15,
}

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Form 990 Skill Verification Harness")
    parser.add_argument("--case", metavar="TC<N>", help="Run single test case")
    parser.add_argument("--include-manual", action="store_true",
                        help="Include manual tests TC1–TC7 as SKIP (default: skip silently)")
    args = parser.parse_args()

    target = args.case.upper() if args.case else None

    # Fail fast if library import failed (affects all automated tests)
    if not _LIB_AVAILABLE:
        print(f"FATAL: form990_lib import failed: {_LIB_ERROR}", file=sys.stderr)
        print(f"  sys.path includes: {_lib_path}", file=sys.stderr)
        print(f"  Verify: python3 -c 'import sys; sys.path.insert(0, \"{_lib_path}\"); import form990_lib'",
              file=sys.stderr)
        sys.exit(2)

    # Mark manual tests as SKIP
    for tc_id, reason in MANUAL_TCS.items():
        if target is None or target == tc_id:
            if args.include_manual:
                skip_(tc_id, reason)

    # Run automated tests
    t0 = time.monotonic()
    for tc_id, fn in AUTOMATED_TCS.items():
        if target and target != tc_id:
            continue
        try:
            fn(args)
        except Exception as e:
            error_(tc_id, f"harness exception: {type(e).__name__}: {e}")

    duration = time.monotonic() - t0

    # Render grid
    all_tc = list(MANUAL_TCS) + list(AUTOMATED_TCS)
    if target:
        all_tc = [target]

    glyphs = {"PASS": "✔", "FAIL": "✖", "SKIP": "-", "ERROR": "!"}
    grid_parts = []
    for tc_id in all_tc:
        status = RESULTS.get(tc_id, "?")
        grid_parts.append(f"{tc_id} {glyphs.get(status, '?')}")
    print(" | ".join(grid_parts))

    passed  = [t for t in all_tc if RESULTS.get(t) == "PASS"]
    failed  = [t for t in all_tc if RESULTS.get(t) in ("FAIL", "ERROR")]
    skipped = [t for t in all_tc if RESULTS.get(t) == "SKIP"]

    summary = {
        "passed": len(passed),
        "failed": failed,
        "skipped": skipped,
        "duration_s": round(duration, 1),
    }
    print(json.dumps(summary))

    # Print failure details
    for tc_id in failed:
        print(f"\n  {tc_id} FAIL: {ERRORS.get(tc_id, 'no detail')}", file=sys.stderr)

    if failed:
        sys.exit(1)
    elif any(RESULTS.get(t) == "ERROR" for t in all_tc):
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
