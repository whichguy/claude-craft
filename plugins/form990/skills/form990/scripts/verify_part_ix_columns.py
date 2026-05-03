#!/usr/bin/env python3
"""
verify_part_ix_columns.py — Form 990 Part IX functional column verification (Q-F3).

Verifies for each Part IX line:
  col_b (Program) + col_c (M&G) + col_d (Fundraising) == col_a (Total)

Also verifies:
  Line 25 column totals match sum of all other lines per column
  Part III Line 4e == Line 25 col_b (program column)

Usage:
  python3 verify_part_ix_columns.py <path/to/form990-dataset.json>

Exit code: 0 = all PASS, 1 = any FAIL.
"""

import json
import sys
import os

TOLERANCE = 1.00  # $1.00 rounding tolerance for column checks


def log(tag: str, msg: str):
    print(f"[{tag}] {msg}", flush=True)


def fmt(val) -> str:
    if val is None:
        return "None"
    v = float(val)
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def main(dataset_path: str) -> int:
    tag = "verify_part_ix_columns"

    log(tag, f"Reading dataset: {dataset_path}")
    with open(dataset_path) as f:
        d = json.load(f)

    p9 = d["parts"]["IX"]
    p3 = d["parts"]["III"]
    checks = []
    all_pass = True

    # ────────────────────────────────────────────────────────────
    # CHECK 1 — Per-line column balance
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 1: Per-line col_b + col_c + col_d == col_a ===")
    log(tag, f"  {'Line':<25} {'col_a':>12} {'col_b':>12} {'col_c':>10} {'col_d':>10} {'diff':>10} {'status'}")
    log(tag, "  " + "-" * 85)

    line_failures = []
    for key, val in sorted(p9.items()):
        if not isinstance(val, dict) or key == "25_total":
            continue
        a = float(val.get("col_a") or 0)
        b = float(val.get("col_b") or 0)
        c = float(val.get("col_c") or 0)
        dd = float(val.get("col_d") or 0)
        if a == 0 and b == 0 and c == 0 and dd == 0:
            continue  # skip zero lines

        diff = abs(a - (b + c + dd))
        ok = diff <= TOLERANCE
        status = "✓" if ok else "✗ FAIL"
        log(tag, f"  {key:<25} {fmt(a):>12} {fmt(b):>12} {fmt(c):>10} {fmt(dd):>10} {fmt(diff):>10}  {status}")

        checks.append({"label": f"col_balance_{key}", "passed": ok,
                       "col_a": a, "col_b": b, "col_c": c, "col_d": dd, "diff": diff})
        if not ok:
            line_failures.append(key)
            all_pass = False

    if line_failures:
        log(tag, f"\n  FAILING LINES: {line_failures}")
    else:
        log(tag, "\n  All individual line column balances PASS ✓")

    # ────────────────────────────────────────────────────────────
    # CHECK 2 — Column totals vs Line 25
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 2: Column sums vs Line 25 totals ===")

    sum_a = sum_b = sum_c = sum_d = 0.0
    for key, val in p9.items():
        if not isinstance(val, dict) or key == "25_total":
            continue
        sum_a += float(val.get("col_a") or 0)
        sum_b += float(val.get("col_b") or 0)
        sum_c += float(val.get("col_c") or 0)
        sum_d += float(val.get("col_d") or 0)

    ln25 = p9.get("25_total", {})
    l25_a = float(ln25.get("col_a") or 0)
    l25_b = float(ln25.get("col_b") or 0)
    l25_c = float(ln25.get("col_c") or 0)
    l25_d = float(ln25.get("col_d") or 0)

    log(tag, f"  Computed sum col_a: {fmt(sum_a)}  Line 25 col_a: {fmt(l25_a)}")
    log(tag, f"  Computed sum col_b: {fmt(sum_b)}  Line 25 col_b: {fmt(l25_b)}")
    log(tag, f"  Computed sum col_c: {fmt(sum_c)}  Line 25 col_c: {fmt(l25_c)}")
    log(tag, f"  Computed sum col_d: {fmt(sum_d)}  Line 25 col_d: {fmt(l25_d)}")

    for col, computed, declared in [("a", sum_a, l25_a), ("b", sum_b, l25_b),
                                     ("c", sum_c, l25_c), ("d", sum_d, l25_d)]:
        diff = abs(computed - declared)
        ok = diff <= TOLERANCE
        status = "✓ PASS" if ok else "✗ FAIL"
        log(tag, f"  col_{col} diff: {fmt(diff)}  {status}")
        checks.append({"label": f"line25_col_{col}_sum", "passed": ok,
                       "computed": computed, "declared": declared, "diff": diff})
        if not ok:
            all_pass = False

    # ────────────────────────────────────────────────────────────
    # CHECK 3 — Part III 4e == Part IX col_b
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 3: Part III Line 4e == Part IX col_b (program expenses) ===")

    p3_4e = float(p3.get("4e_total_program_service_expenses") or 0)
    p9_colb = l25_b if l25_b else sum_b
    diff = abs(p3_4e - p9_colb)
    ok = diff <= TOLERANCE

    log(tag, f"  Part III Line 4e (total program expenses): {fmt(p3_4e)}")
    log(tag, f"  Part IX Line 25 col_b (program total):     {fmt(p9_colb)}")
    log(tag, f"  diff: {fmt(diff)}  {'✓ PASS' if ok else '✗ FAIL'}")

    checks.append({"label": "part_iii_4e_eq_part_ix_colb", "passed": ok,
                   "part_iii_4e": p3_4e, "part_ix_colb": p9_colb, "diff": diff})
    if not ok:
        all_pass = False

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
        "script": "verify_part_ix_columns",
        "passed": passed_count,
        "total": len(checks),
        "failed": failed,
        "all_pass": all_pass,
        "checks": checks,
    }
    print(json.dumps(summary))
    return 0 if all_pass else 1


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "artifacts/form990-dataset.json"
    if not os.path.exists(path):
        print(json.dumps({"script": "verify_part_ix_columns", "error": f"not found: {path}",
                          "all_pass": False}))
        sys.exit(2)
    sys.exit(main(path))
