#!/usr/bin/env python3
"""
verify_big_square.py — Form 990 Big Square (Q-F2) verification script.

Verifies:
  1. Part XI reconciliation: BOY + Revenue - Expenses + Other = EOY net assets
  2. Part X internal: Total assets - Total liabilities = Net assets (BOY and EOY)
  3. Part I cross-ties: Line 12 == Part VIII Line 12, Line 18 == Part IX Line 25

Usage:
  python3 verify_big_square.py <path/to/form990-dataset.json>
  python3 verify_big_square.py  # looks for form990-dataset.json in ./artifacts/

Output: verbose trace to stdout + JSON summary on last line.
Exit code: 0 = all PASS, 1 = any FAIL.
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


def main(dataset_path: str) -> int:
    tag = "verify_big_square"

    log(tag, f"Reading dataset: {dataset_path}")
    with open(dataset_path) as f:
        d = json.load(f)

    p1 = d["parts"]["I"]
    p8 = d["parts"]["VIII"]
    p9 = d["parts"]["IX"]
    p10 = d["parts"]["X"]
    p11 = d["parts"]["XI"]
    recon = d.get("reconciliation", {})

    checks = []
    all_pass = True

    # ────────────────────────────────────────────────────────────
    # CHECK 1 — Part XI big square
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 1: Part XI Reconciliation (Big Square) ===")

    boy = float(p11["4_net_assets_boy"])
    revenue = float(p11["1_total_revenue"])
    expenses = float(p11["2_total_expenses"])
    other = float(p11["5_other_changes"])
    eoy_declared = float(p11["9_net_assets_eoy"])
    eoy_computed = boy + revenue - expenses + other

    log(tag, f"  BOY net assets (Part XI Line 4):        {fmt(boy)}")
    log(tag, f"  + Total revenue (Part VIII Line 12):    {fmt(revenue)}")
    log(tag, f"  - Total expenses (Part IX Line 25):     {fmt(expenses)}")
    log(tag, f"  + Other changes (Part XI Line 5):       {fmt(other)}")
    log(tag, f"  = Computed EOY:                         {fmt(eoy_computed)}")
    log(tag, f"  Part X EOY net assets (declared):       {fmt(eoy_declared)}")

    ok = check(tag, "big_square", eoy_declared, eoy_computed, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 2 — Part X internal consistency (EOY)
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 2: Part X EOY — Assets - Liabilities = Net Assets ===")

    eoy_assets = float(p10["assets"]["16_total_assets"]["eoy"])
    eoy_liab = float(p10["liabilities"]["26_total_liabilities"]["eoy"])
    eoy_net = float(p10["net_assets"]["30_total_net_assets"]["eoy"])
    eoy_implied = eoy_assets - eoy_liab

    log(tag, f"  EOY total assets (Line 16):    {fmt(eoy_assets)}")
    log(tag, f"  EOY total liabilities (Line 26): {fmt(eoy_liab)}")
    log(tag, f"  = Implied net assets:            {fmt(eoy_implied)}")
    log(tag, f"  Declared net assets (Line 30):   {fmt(eoy_net)}")

    ok = check(tag, "part_x_eoy_balance", eoy_net, eoy_implied, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 3 — Part X internal consistency (BOY)
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 3: Part X BOY — Assets - Liabilities = Net Assets ===")

    boy_assets = float(p10["assets"]["16_total_assets"]["boy"])
    boy_liab = float(p10["liabilities"]["26_total_liabilities"]["boy"])
    boy_net = float(p10["net_assets"]["30_total_net_assets"]["boy"])
    boy_implied = boy_assets - boy_liab

    log(tag, f"  BOY total assets (Line 16):      {fmt(boy_assets)}")
    log(tag, f"  BOY total liabilities (Line 26): {fmt(boy_liab)}")
    log(tag, f"  = Implied net assets:            {fmt(boy_implied)}")
    log(tag, f"  Declared net assets (Line 30):   {fmt(boy_net)}")

    ok = check(tag, "part_x_boy_balance", boy_net, boy_implied, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 4 — Part I Line 12 == Part VIII Line 12
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 4: Part I Line 12 cross-tie to Part VIII Line 12 ===")

    p1_line12 = float(p1["12_total_revenue"])
    p8_line12 = float(p8["12_total_revenue"])
    log(tag, f"  Part I Line 12:   {fmt(p1_line12)}")
    log(tag, f"  Part VIII Line 12: {fmt(p8_line12)}")

    ok = check(tag, "part_i_12_eq_part_viii_12", p1_line12, p8_line12, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 5 — Part I Line 18 == Part IX Line 25
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 5: Part I Line 18 cross-tie to Part IX Line 25 ===")

    p1_line18 = float(p1["18_total_expenses"])
    p9_line25 = float(p9["25_total"]["col_a"])
    log(tag, f"  Part I Line 18:   {fmt(p1_line18)}")
    log(tag, f"  Part IX Line 25:  {fmt(p9_line25)}")

    ok = check(tag, "part_i_18_eq_part_ix_25", p1_line18, p9_line25, checks)
    all_pass = all_pass and ok

    # ────────────────────────────────────────────────────────────
    # CHECK 6 — Part VIII Line 12 = sum of all revenue lines
    # ────────────────────────────────────────────────────────────
    log(tag, "")
    log(tag, "=== CHECK 6: Part VIII Line 12 = sum of all revenue lines ===")

    line_keys = [
        "1h_total_contributions_column_a",
        "2f_total_program_service_revenue",
        "3_investment_income",
        "4_income_from_investment_securities",
        "5_real_estate",
        "6a_gross_rents",
        "7a_gross_amount_from_assets",
        "8a_gross_fundraising_events",
        "9a_gross_gaming",
        "10c_net_income_from_sales",
        "11e_total_other_revenue",
    ]
    components = {}
    for k in line_keys:
        val = float(p8.get(k, 0) or 0)
        if val != 0:
            components[k] = val
    p8_computed = sum(components.values())

    for k, v in components.items():
        label = k.split("_", 1)[1] if "_" in k else k
        log(tag, f"  {label}: {fmt(v)}")
    log(tag, f"  = Computed Line 12:       {fmt(p8_computed)}")
    log(tag, f"  Declared Line 12:         {fmt(p8_line12)}")

    ok = check(tag, "part_viii_12_internal", p8_line12, p8_computed, checks)
    all_pass = all_pass and ok

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
        "script": "verify_big_square",
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
        print(json.dumps({"script": "verify_big_square", "error": f"not found: {path}",
                          "all_pass": False}))
        sys.exit(2)
    sys.exit(main(path))
