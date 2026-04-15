#!/usr/bin/env python3
"""
verify_part_iii.py — Form 990 Part III (Program Service Accomplishments) verification.

Verifies (Q-F18 / Q-F3 derivative):
  1. 4a + 4b + 4c + 4d == 4e  (program expense sum)
  2. 4e == Part IX Line 25 col_b  (ties to Part IX program column)
  3. Each program with expenses > 0 has a non-empty description (Q-F18 minimum)

Usage:
  python3 verify_part_iii.py <path/to/form990-dataset.json>
  python3 verify_part_iii.py  # looks for form990-dataset.json in ./artifacts/

Output: verbose trace to stdout + JSON summary on last line.
Exit code: 0 = all PASS, 1 = any FAIL, 2 = error.
"""

import json
import sys
import os

TOLERANCE = 0.02  # $0.02 tolerance for floating-point rounding


def log(tag: str, msg: str):
    print(f"[{tag}] {msg}", flush=True)


def fmt(val) -> str:
    if val is None:
        return "None"
    v = float(val)
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def check(tag: str, label: str, expected, actual, checks: list) -> bool:
    diff = abs(float(expected) - float(actual))
    passed = diff <= TOLERANCE
    status = "✓ PASS" if passed else "✗ FAIL"
    log(tag, f"CHECK {label}: {fmt(expected)} == {fmt(actual)} | diff={fmt(diff)} | {status}")
    checks.append({"label": label, "expected": float(expected), "actual": float(actual),
                   "diff": diff, "passed": passed})
    return passed


def get_program_expenses(prog: dict) -> float:
    """Return expenses for a program block, treating None/missing as 0."""
    if prog is None:
        return 0.0
    return float(prog.get("expenses", 0) or 0)


def get_program_description(prog: dict) -> str:
    """Return description string for a program block."""
    if prog is None:
        return ""
    return str(prog.get("description", "") or "")


def main(dataset_path: str) -> int:
    tag = "verify_part_iii"

    log(tag, f"Reading dataset: {dataset_path}")
    with open(dataset_path) as f:
        d = json.load(f)

    p3 = d["parts"]["III"]
    p9 = d["parts"]["IX"]

    checks = []
    all_pass = True

    # ────────────────────────────────────────────────────────────
    # CHECK 1 — 4a + 4b + 4c + 4d == 4e (program expense sum)
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 1: Part III 4a+4b+4c+4d == 4e ===")

    exp_4a = get_program_expenses(p3.get("4a_program_1"))
    exp_4b = get_program_expenses(p3.get("4b_program_2"))
    exp_4c = get_program_expenses(p3.get("4c_program_3"))
    exp_4d = float(p3.get("4d_all_other_programs_total", 0) or 0)
    exp_4e = float(p3.get("4e_total_program_service_expenses", 0) or 0)
    computed_sum = exp_4a + exp_4b + exp_4c + exp_4d

    log(tag, f"  4a (Program 1 expenses):        {fmt(exp_4a)}")
    log(tag, f"  4b (Program 2 expenses):        {fmt(exp_4b)}")
    log(tag, f"  4c (Program 3 expenses):        {fmt(exp_4c)}")
    log(tag, f"  4d (All other programs total):  {fmt(exp_4d)}")
    log(tag, f"  = Computed sum:                 {fmt(computed_sum)}")
    log(tag, f"  4e (Declared total):            {fmt(exp_4e)}")

    ok = check(tag, "part_iii_4abcd_sum_eq_4e", exp_4e, computed_sum, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 2 — 4e == Part IX Line 25 col_b (program column)
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 2: Part III 4e == Part IX Line 25 col_b ===")

    p9_line25_colb = float(p9["25_total"]["col_b"])
    log(tag, f"  Part III Line 4e:            {fmt(exp_4e)}")
    log(tag, f"  Part IX Line 25 col_b:       {fmt(p9_line25_colb)}")

    ok = check(tag, "part_iii_4e_eq_part_ix_25_colb", exp_4e, p9_line25_colb, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 3 — Each program with expenses > 0 has a description
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 3: Each program with expenses > 0 has a non-empty description ===")

    program_slots = [
        ("4a_program_1", "Program 1"),
        ("4b_program_2", "Program 2"),
        ("4c_program_3", "Program 3"),
    ]

    for key, label in program_slots:
        prog = p3.get(key)
        exp = get_program_expenses(prog)
        desc = get_program_description(prog)
        if exp > 0:
            has_desc = len(desc.strip()) > 0
            status = "✓ PASS" if has_desc else "✗ FAIL"
            log(tag, f"  {label}: expenses={fmt(exp)}, description present={has_desc} | {status}")
            checks.append({
                "label": f"description_present_{key}",
                "expected": True,
                "actual": has_desc,
                "diff": 0 if has_desc else 1,
                "passed": has_desc,
            })
            if not has_desc:
                all_pass = False
        else:
            log(tag, f"  {label}: no expenses — description check skipped")

    # ────────────────────────────────────────────────────────────
    # Summary
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    passed_count = sum(1 for c in checks if c["passed"])
    failed = [c["label"] for c in checks if not c["passed"]]
    log(tag, f"=== SUMMARY: {passed_count}/{len(checks)} checks passed ===")
    if failed:
        log(tag, f"  FAILED: {failed}")
    else:
        log(tag, "  All checks PASS ✓")

    summary = {
        "script": "verify_part_iii",
        "passed": passed_count,
        "total": len(checks),
        "failed": failed,
        "all_pass": all_pass,
        "checks": checks,
    }
    print(json.dumps(summary))  # machine-readable last line
    return 0 if all_pass else 1


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "artifacts/form990-dataset.json"
    if not os.path.exists(path):
        print(json.dumps({"script": "verify_part_iii", "error": f"not found: {path}",
                          "all_pass": False}))
        sys.exit(2)
    sys.exit(main(path))
