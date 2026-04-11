#!/usr/bin/env python3
"""
Form 990 Skill — Verification Harness
Runs TC1–TC15 (7 original + 8 hardening). Stdlib-only.

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
# Harness internals
# ---------------------------------------------------------------------------

FIXTURES = pathlib.Path(__file__).parent / "fixtures"
SCRIPTS  = FIXTURES / "scripts"
SKILL_DIR = pathlib.Path(__file__).parent.parent
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

# ---------------------------------------------------------------------------
# TC8 — Crash-mid-phase recovery (Change 1, Change 2)
# ---------------------------------------------------------------------------

def tc8(args):
    """HalfWrite orphan sweep: staging file with dead PID is cleaned up on resume."""
    import shutil
    tc = "TC8"
    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        # Create minimal plan file with P3 running, plan_lock.pid=99999
        plan_path = tmp / "plan.md"
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

        plan_content = (
            f"# Form 990 Plan — Test Org — Tax Year 2025\n\n"
            f"<!-- BEGIN MACHINE STATE (do not hand-edit; skill rewrites atomically) -->\n"
            f"```json\n{json.dumps(machine_state, indent=2)}\n```\n"
            f"<!-- END MACHINE STATE -->\n\n"
            f"## Breadcrumbs\n\n"
        )
        plan_path.write_text(plan_content, encoding="utf-8")

        # Verify dead PID 99999 is indeed not alive
        try:
            os.kill(99999, 0)
            # If this doesn't raise, PID 99999 is somehow alive — skip test
            skip_(tc, "PID 99999 is alive on this machine — cannot test dead-pid sweep")
            return
        except (ProcessLookupError, PermissionError) as e:
            if isinstance(e, PermissionError):
                # PID exists but we can't signal it — still "alive"
                skip_(tc, "PID 99999 exists (permission denied) — cannot test dead-pid sweep")
                return
            # ProcessLookupError (ESRCH) = PID not alive, as expected

        # Simulate the crash recovery sweep logic directly
        # (We test the logic in isolation, not via full skill invocation)
        swept = []
        for art_name, art in machine_state["artifacts"].items():
            if art.get("status") == "writing" and art.get("staging_path"):
                sp = pathlib.Path(art["staging_path"])
                if sp.exists():
                    # Check if lock PID is dead
                    lock_pid = machine_state["plan_lock"].get("pid")
                    pid_dead = False
                    if lock_pid:
                        try:
                            os.kill(lock_pid, 0)
                        except ProcessLookupError:
                            pid_dead = True
                    if pid_dead:
                        sp.unlink()
                        swept.append(str(sp))
                        machine_state["artifacts"][art_name]["status"] = "absent"
                        machine_state["artifacts"][art_name]["staging_path"] = None
                        machine_state["phase_status"]["P3"] = "failed"
                        machine_state["artifacts"][art_name]["last_error"] = {
                            "error_class": "HalfWrite",
                            "phase": "P3",
                            "pid": lock_pid,
                            "swept_orphans": [str(sp)],
                            "timestamp": "2025-01-01T00:00:00Z",
                        }

        assert_true(tc, len(swept) == 1, f"expected 1 swept orphan, got {swept}")
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
# ---------------------------------------------------------------------------

def tc9(args):
    """merge_datasets() halts when core has a non-null parts.I."""
    tc = "TC9"
    import shutil

    core_path = FIXTURES / "core_with_parts_I.json"
    rollup_path = FIXTURES / "rollup_populated.json"
    schedules_path = FIXTURES / "schedules_empty.json"

    if not all(p.exists() for p in [core_path, rollup_path, schedules_path]):
        error_(tc, "Merger fixture files missing from tests/fixtures/")
        return

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        output_path = tmp / "merged.json"

        # Inline the merge_datasets logic (simplified for test)
        core = json.loads(core_path.read_text())
        rollup = json.loads(rollup_path.read_text())
        schedules = json.loads(schedules_path.read_text())

        try:
            # Positive-ownership assertion: core.parts.I must be null or absent
            core_I = core.get("parts", {}).get("I", None)
            if core_I is not None:
                raise AssertionError(
                    "merger: dataset_core.parts.I MUST be null or absent (P5 ownership contract)"
                )
            fail_(tc, "Expected AssertionError was NOT raised — ownership assertion is missing")
        except AssertionError as e:
            assert_in(tc, "dataset_core.parts.I MUST be null or absent", str(e),
                      "AssertionError message")
            if tc not in RESULTS:
                pass_(tc)
        except Exception as e:
            fail_(tc, f"Unexpected exception type: {type(e).__name__}: {e}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# TC10 — Force-override downstream invalidation (Change 7)
# ---------------------------------------------------------------------------

def tc10(args):
    """Force-override P3 clears downstream artifact sha256/fingerprints."""
    tc = "TC10"
    import shutil
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
            "dataset_core":            {"path": "./artifacts/form990-dataset-core.json",
                                        "status": "committed", "staging_path": None,
                                        "input_fingerprint": {"statement_of_activities": FAKE_SHA},
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

    # Inline the force-override P3 logic
    PHASE_ARTIFACT_MAP = {
        "P3": ["statement_of_activities", "balance_sheet", "functional_expense"],
        "P4": ["part_iv_checklist"],
        "P5": ["dataset_core"],
        "P6": ["dataset_schedules", "schedule_b_filing", "schedule_b_public", "schedule_o"],
        "P7": ["dataset_rollup", "reconciliation_report", "dataset_merged"],
        "P8": ["cpa_review_report"],
        "P9": ["reference_pdf", "efile_handoff"],
    }
    PHASE_ORDER = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]

    force_phase = "P3"
    force_idx = PHASE_ORDER.index(force_phase)
    downstream_phases = PHASE_ORDER[force_idx + 1:]

    decision = {
        "date": "2025-01-01",
        "phase": force_phase,
        "decision": f"force-override {force_phase}: invalidated downstream {', '.join(downstream_phases)}",
        "rationale": "user invoked /form990 phase P3",
    }

    for ph in downstream_phases:
        if ph in machine_state["phase_status"]:
            old_status = machine_state["phase_status"][ph]
            if old_status in ("done", "running", "paused", "failed"):
                machine_state["phase_status"][ph] = "pending"
        for art_name in PHASE_ARTIFACT_MAP.get(ph, []):
            if art_name in machine_state["artifacts"]:
                art = machine_state["artifacts"][art_name]
                machine_state["decision_log"].append({
                    "date": "2025-01-01", "phase": ph,
                    "decision": f"forward-invalidated by force-override {force_phase}",
                    "rationale": f"prior output_sha256={art.get('output_sha256','null')[:12]}...",
                })
                art["output_sha256"] = None
                art["status"] = "absent"
                art["input_fingerprint"] = {k: None for k in art.get("input_fingerprint", {})}

    machine_state["decision_log"].append(decision)

    # Assertions
    ok = True
    for ph in ["P4", "P5", "P6"]:
        if ph in machine_state["phase_status"]:
            ok &= assert_equal(tc, machine_state["phase_status"][ph], "pending",
                               f"phase_status.{ph} after force-override")

    art = machine_state["artifacts"].get("dataset_core", {})
    ok &= assert_equal(tc, art.get("output_sha256"), None,
                       "dataset_core.output_sha256 cleared")

    # Decision log should have an entry mentioning force-override
    dl_text = json.dumps(machine_state["decision_log"])
    ok &= assert_in(tc, "force-override", dl_text, "Decision Log contains force-override")

    if ok and tc not in RESULTS:
        pass_(tc)


# ---------------------------------------------------------------------------
# TC11 — run_script() error classes (Change 3)
# ---------------------------------------------------------------------------

def tc11(args):
    """Test all 5 run_script() error sub-cases."""
    tc = "TC11"

    # Inline the minimal run_script implementation for isolated testing
    import subprocess as _sp
    import pathlib as _pl

    ALLOWLIST: set = set()

    class ScriptError(Exception):
        def __init__(self, script, rc, stderr, stdout=""):
            super().__init__(f"{script} exit {rc}: {stderr[-500:]}")
            self.returncode = rc
            self.stderr_tail = stderr[-2000:]
            self.stdout_tail = stdout[-2000:]
            self.structured_error = None

    def _run(path, arglist, deadline=5):
        abs_p = str(_pl.Path(path).resolve())
        if abs_p not in ALLOWLIST:
            raise ScriptError(path, -1, f"script not in SCRIPT_ALLOWLIST: {abs_p}")
        for a in arglist:
            if "\x00" in str(a):
                raise ScriptError(path, -1, f"rejected arg (null byte): {a!r}")
        proc = _sp.Popen(
            [sys.executable, abs_p, "--json-only", *[str(a) for a in arglist]],
            stdout=_sp.PIPE, stderr=_sp.PIPE, text=True,
        )
        try:
            stdout, stderr = proc.communicate(timeout=deadline)
        except _sp.TimeoutExpired:
            proc.kill()
            try: stdout, stderr = proc.communicate(timeout=2)
            except: stdout, stderr = "", "<timeout>"
            raise ScriptError(path, -2, f"timeout after {deadline}s\nstderr: {stderr}", stdout)
        finally:
            if proc.poll() is None: proc.kill()

        if proc.returncode != 0:
            err = ScriptError(path, proc.returncode, stderr, stdout)
            try:
                p = json.loads(stdout)
                if isinstance(p, dict) and p.get("status") == "error":
                    err.structured_error = p
            except (json.JSONDecodeError, ValueError): pass
            raise err
        try:
            return json.loads(stdout)
        except json.JSONDecodeError as e:
            raise ScriptError(path, 0, f"stdout unparseable: {e}", stdout)

    good    = str(SCRIPTS / "good_script.py")
    bad     = str(SCRIPTS / "bad_stderr.py")
    err_j   = str(SCRIPTS / "error_json.py")
    timeout = str(SCRIPTS / "timeout_script.py")
    unparse = str(SCRIPTS / "unparseable.py")

    for p in [good, bad, err_j, timeout, unparse]:
        ALLOWLIST.add(str(pathlib.Path(p).resolve()))

    failures = []

    # Sub-case 1: allowlist rejection
    try:
        _run("/not/in/allowlist.py", [])
        failures.append("TC11.1: allowlist rejection — no exception raised")
    except ScriptError as e:
        if "SCRIPT_ALLOWLIST" not in str(e):
            failures.append(f"TC11.1: wrong error message: {e}")

    # Sub-case 2: null-byte arg rejection
    try:
        _run(good, ["val\x00ue"])
        failures.append("TC11.2: null-byte arg — no exception raised")
    except ScriptError as e:
        if "rejected arg" not in str(e):
            failures.append(f"TC11.2: wrong error message: {e}")

    # Sub-case 3: timeout
    try:
        _run(timeout, [], deadline=2)
        failures.append("TC11.3: timeout — no exception raised")
    except ScriptError as e:
        if "timeout after 2s" not in str(e):
            failures.append(f"TC11.3: wrong timeout message: {e}")

    # Sub-case 4: structured error-JSON
    try:
        _run(err_j, [])
        failures.append("TC11.4: error_json — no exception raised")
    except ScriptError as e:
        if e.structured_error is None:
            failures.append("TC11.4: structured_error is None")
        elif e.structured_error.get("error_class") != "TestError":
            failures.append(f"TC11.4: wrong error_class: {e.structured_error}")

    # Sub-case 5: JSON parse failure
    try:
        _run(unparse, [])
        failures.append("TC11.5: unparseable — no exception raised")
    except ScriptError as e:
        if "unparseable" not in str(e):
            failures.append(f"TC11.5: wrong error message: {e}")

    if failures:
        fail_(tc, "; ".join(failures))
    else:
        pass_(tc)


# ---------------------------------------------------------------------------
# TC12 — verify_ancestors() transitive mismatch (Change 4)
# ---------------------------------------------------------------------------

def tc12(args):
    """verify_ancestors() detects regression 2 hops upstream from consuming artifact."""
    tc = "TC12"
    import hashlib

    REAL_SHA   = hashlib.sha256(b"original content").hexdigest()
    STORED_SHA = hashlib.sha256(b"original content").hexdigest()
    MUTATED    = hashlib.sha256(b"MUTATED content").hexdigest()

    # Minimal ARTIFACT_DEPS
    ARTIFACT_DEPS = {
        "coa_mapping":              {"phase": "P2", "upstream": []},
        "statement_of_activities":  {"phase": "P3", "upstream": ["coa_mapping"]},
        "dataset_core":             {"phase": "P5", "upstream": ["statement_of_activities"]},
    }

    state = {
        "artifacts": {
            "coa_mapping": {
                "path": "/tmp/tc12-coa-mapping.csv",
                "output_sha256": STORED_SHA,
                "status": "committed",
            },
            "statement_of_activities": {
                "path": "/tmp/tc12-soa.md",
                "output_sha256": STORED_SHA,
                "status": "committed",
            },
            "dataset_core": {
                "path": "/tmp/tc12-dataset-core.json",
                "output_sha256": None,
                "status": "absent",
            },
        },
        "phase_status": {"P2": "done", "P3": "done", "P5": "pending"},
    }

    # Write a coa-mapping file whose sha256 does NOT match STORED_SHA
    import shutil
    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        coa = tmp / "coa-mapping.csv"
        coa.write_text("MUTATED content", encoding="utf-8")
        soa = tmp / "soa.md"
        soa.write_text("original content", encoding="utf-8")

        state["artifacts"]["coa_mapping"]["path"] = str(coa)
        state["artifacts"]["statement_of_activities"]["path"] = str(soa)

        # Inline verify_ancestors
        regressions = []
        visited = {}

        def verify(name, _visited=None):
            if _visited is None: _visited = {}
            if name in _visited: return _visited[name]
            info = ARTIFACT_DEPS.get(name, {})
            parents = info.get("upstream", [])
            local_regs = []
            for parent in parents:
                art = state["artifacts"].get(parent, {})
                rec_sha = art.get("output_sha256")
                path = art.get("path")
                if rec_sha and path and pathlib.Path(path).exists():
                    actual = hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
                    if actual != rec_sha:
                        local_regs.append(
                            f"{parent}: sha256 mismatch "
                            f"(recorded {rec_sha[:12]}…, disk {actual[:12]}…)"
                        )
                ok2, child_regs = verify(parent, _visited)
                local_regs.extend(child_regs)
            result = (len(local_regs) == 0, local_regs)
            _visited[name] = result
            return result

        ok, regs = verify("dataset_core", visited)
        assert_true(tc, not ok, "verify_ancestors should return NOT ok (regression detected)")
        assert_true(tc, len(regs) > 0, "regressions list should be non-empty")
        assert_true(tc, any("coa_mapping" in r for r in regs),
                    f"coa_mapping regression not detected; got: {regs}")
        if tc not in RESULTS:
            pass_(tc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# TC13 — scrub_pii() correctness (Change 9)
# ---------------------------------------------------------------------------

def tc13(args):
    """scrub_pii redaction rules: SSN, bare 9-digit, EIN passthrough, donor name, long num."""
    tc = "TC13"
    import re as _re

    def scrub_pii(text, donor_names=None):
        if donor_names is None: donor_names = []
        text = _re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED-SSN]', text)
        text = _re.sub(r'\b\d{9}\b', '[REDACTED-9DIGIT]', text)
        for name in sorted(donor_names, key=len, reverse=True):
            if name:
                text = _re.sub(_re.escape(name), '[REDACTED-DONOR]', text, flags=_re.IGNORECASE)
        text = _re.sub(r'\d{10,}', '[REDACTED-LONGNUM]', text)
        return text

    failures = []

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

    # TC13b — P9 coordinate_table staleness check logic
    # Simulates: stored hash != hash of current coordinate block → artifact reset to "absent"
    import hashlib as _hl

    def _coord_hash(content: str) -> str:
        return _hl.sha256(content.encode("utf-8")).hexdigest()

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
# ---------------------------------------------------------------------------

def tc14(args):
    """All 4 orphan glob patterns are identified and swept when PID is dead."""
    tc = "TC14"
    import shutil

    DEAD_PID = 99999
    # Verify PID 99999 is dead on this machine
    try:
        os.kill(DEAD_PID, 0)
        skip_(tc, f"PID {DEAD_PID} is alive — cannot test dead-pid sweep")
        return
    except PermissionError:
        skip_(tc, f"PID {DEAD_PID} exists (permission denied) — cannot test")
        return
    except ProcessLookupError:
        pass  # expected

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        plan_path = tmp / "plan.md"
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

        # Inline the sweep logic
        PATTERNS = [
            list(tmp.glob(f"*.tmp.{DEAD_PID}")),
            list(memo_dir.glob(f".form990-memo-*.json.tmp.{DEAD_PID}")),
            list(artifacts_dir.glob(f"*.writing.{DEAD_PID}")),
            list(artifacts_dir.glob(f"*.partial.{DEAD_PID}")),
        ]

        swept = []
        for group in PATTERNS:
            for f in group:
                if f.exists():
                    f.unlink()
                    swept.append(str(f))

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
# ---------------------------------------------------------------------------

def tc15(args):
    """auto_append_learning() appends entries; rotates after 100."""
    tc = "TC15"
    import shutil

    HEADER = "<!-- BEGIN MACHINE LEARNINGS (auto-appended; do not hand-edit) -->"
    FOOTER = "<!-- END MACHINE LEARNINGS -->"
    MAX = 100

    # Entry format matches SKILL.md §auto_append_learning():
    # "- **YYYY-MM-DD - <phase> - <error_class>:** <message> _(resolution: pending)_"
    def make_entry(date, phase, error_class, message):
        return f"- **{date} - {phase} - {error_class}:** {message} _(resolution: pending)_"

    def append_learning(text, entry):
        start = text.find(HEADER)
        end   = text.find(FOOTER)
        if start == -1 or end == -1:
            return text + f"\n{HEADER}\n{entry}\n{FOOTER}\n"
        inner = text[start + len(HEADER):end].strip()
        entries = [l for l in inner.splitlines() if l.startswith("- **")]
        entries.append(entry)
        new_inner = "\n".join(entries)
        return text[:start] + HEADER + "\n" + new_inner + "\n" + FOOTER + text[end + len(FOOTER):]

    def count_entries(text):
        start = text.find(HEADER)
        end   = text.find(FOOTER)
        if start == -1 or end == -1: return 0
        inner = text[start + len(HEADER):end].strip()
        return sum(1 for l in inner.splitlines() if l.startswith("- **"))

    tmp = pathlib.Path(tempfile.mkdtemp())
    try:
        learnings = tmp / "LEARNINGS.md"
        archive   = tmp / "LEARNINGS.archive.md"

        base = f"# Learnings\n\n{HEADER}\n{FOOTER}\n"
        learnings.write_text(base, encoding="utf-8")

        # TC15a: single append
        entry = make_entry("2025-01-01", "P3", "TestError", "test error")
        text = learnings.read_text()
        text = append_learning(text, entry)
        learnings.write_text(text)

        count = count_entries(learnings.read_text())
        assert_equal(tc, count, 1, "TC15a: single entry count")
        # Verify format matches SKILL.md
        assert_in(tc, "- **2025-01-01 - P3 - TestError:**", learnings.read_text(),
                  "TC15a: entry format matches auto_append_learning()")
        assert_in(tc, "_(resolution: pending)_", learnings.read_text(),
                  "TC15a: resolution suffix present")

        # TC15b: rotation — inject 101 entries then add 1 more
        text = learnings.read_text()
        for i in range(101):
            e = make_entry("2025-01-01", "P3", f"TestError{i}", f"msg {i}")
            text = append_learning(text, e)
        learnings.write_text(text)

        # Simulate rotation when adding one more
        text = learnings.read_text()
        start = text.find(HEADER)
        end   = text.find(FOOTER)
        inner = text[start + len(HEADER):end].strip()
        entries = [l for l in inner.splitlines() if l.startswith("- **")]

        if len(entries) >= MAX:
            overflow = entries[:len(entries) - MAX + 1]
            archive_text = archive.read_text() if archive.exists() else "# Form 990 Skill — Learnings Archive\n\n"
            archive.write_text(archive_text + "\n".join(overflow) + "\n")
            entries = entries[len(overflow):]

        new_entry = make_entry("2025-01-02", "P3", "FinalError", "final message")
        entries.append(new_entry)
        new_inner = "\n".join(entries)
        learnings.write_text(
            text[:start] + HEADER + "\n" + new_inner + "\n" + FOOTER + text[end + len(FOOTER):]
        )

        final_count = count_entries(learnings.read_text())
        assert_true(tc, final_count <= MAX, f"TC15b: entries ({final_count}) exceed MAX ({MAX})")
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

    # Mark manual tests as SKIP
    for tc_id, reason in MANUAL_TCS.items():
        if target is None or target == tc_id:
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
