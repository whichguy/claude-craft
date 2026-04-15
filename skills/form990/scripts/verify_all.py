#!/usr/bin/env python3
"""
verify_all.py — Run all Form 990 verification scripts and aggregate results.

Invokes each verify_*.py script in this directory, collects results,
and prints a consolidated pass/fail report.

Usage:
  python3 verify_all.py <path/to/form990-dataset.json>
  python3 verify_all.py  # defaults to ./artifacts/form990-dataset.json

Exit code: 0 = all PASS, 1 = any FAIL, 2 = error.
"""

import json
import sys
import os
import subprocess
import pathlib

SCRIPTS = [
    "verify_big_square.py",
    "verify_part_ix_columns.py",
]

TAG = "verify_all"


def log(msg: str):
    print(f"[{TAG}] {msg}", flush=True)


def main(dataset_path: str) -> int:
    scripts_dir = pathlib.Path(__file__).parent

    log(f"Dataset: {dataset_path}")
    log(f"Running {len(SCRIPTS)} verification scripts...")
    log("")

    results = []
    any_fail = False

    for script_name in SCRIPTS:
        script_path = scripts_dir / script_name
        if not script_path.exists():
            log(f"  ✗ MISSING: {script_name}")
            results.append({"script": script_name, "all_pass": False, "error": "script not found"})
            any_fail = True
            continue

        log(f"── {script_name} ──────────────────────────────────────")
        try:
            result = subprocess.run(
                [sys.executable, str(script_path), dataset_path],
                capture_output=False,  # let output stream to stdout
                text=True,
                timeout=30,
            )
            # The last line of stdout is JSON summary
            output = subprocess.run(
                [sys.executable, str(script_path), dataset_path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            lines = output.stdout.strip().splitlines()
            summary_line = lines[-1] if lines else "{}"
            try:
                summary = json.loads(summary_line)
            except json.JSONDecodeError:
                summary = {"script": script_name, "all_pass": False,
                           "error": "could not parse summary JSON"}

            results.append(summary)
            if not summary.get("all_pass", False):
                any_fail = True

        except subprocess.TimeoutExpired:
            log(f"  ✗ TIMEOUT: {script_name}")
            results.append({"script": script_name, "all_pass": False, "error": "timeout"})
            any_fail = True
        except Exception as e:
            log(f"  ✗ ERROR: {script_name}: {e}")
            results.append({"script": script_name, "all_pass": False, "error": str(e)})
            any_fail = True

    log("")
    log("═══════════════════════════════════════════════")
    log("  CONSOLIDATED RESULTS")
    log("═══════════════════════════════════════════════")

    for r in results:
        name = r.get("script", "?")
        ok = r.get("all_pass", False)
        passed = r.get("passed", "?")
        total = r.get("total", "?")
        failed = r.get("failed", [])
        status = "✓ PASS" if ok else "✗ FAIL"
        log(f"  {status}  {name}  ({passed}/{total} checks)")
        if failed:
            for f in failed:
                log(f"         → FAILED: {f}")

    log("")
    overall = "✓ ALL PASS" if not any_fail else "✗ SOME CHECKS FAILED"
    log(f"  Overall: {overall}")

    aggregate = {
        "script": "verify_all",
        "all_pass": not any_fail,
        "results": results,
    }
    print(json.dumps(aggregate))
    return 0 if not any_fail else 1


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "artifacts/form990-dataset.json"
    if not os.path.exists(path):
        print(json.dumps({"script": "verify_all", "error": f"not found: {path}",
                          "all_pass": False}))
        sys.exit(2)
    sys.exit(main(path))
