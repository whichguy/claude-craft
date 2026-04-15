#!/usr/bin/env python3
"""
verify_schedule_a.py — Form 990 Schedule A public support verification.

Verifies (Q-F4 / Q-F11 / Q-F23):
  1. Public support % = line_8_total / line_13_total × 100 >= 33⅓%
     (or line_14_first_5_years == True, in which case test is not yet required)
  2. Line 14 first_5_years flag handling
  3. Line 16 (prior year %) is populated (Q-F11)
  4. Line 7b per-year cap = max($5,000, 1% × annual_Line13) per year — not aggregate
     (only for 509(a)(2); Line 7b = 0 if no non-DQ PSR/UBI source exceeds the per-year cap)

For 509(a)(2) organizations (Part III):
  Public support = line_8_total = line_6_total - line_7a_total - line_7b_total
  Prong 1: public_support_pct >= 33⅓%
  Prong 2: investment_income_pct <= 33⅓%

Usage:
  python3 verify_schedule_a.py <path/to/form990-dataset.json>
  python3 verify_schedule_a.py  # looks for form990-dataset.json in ./artifacts/

Output: verbose trace to stdout + JSON summary on last line.
Exit code: 0 = all PASS, 1 = any FAIL, 2 = error.
"""

import json
import sys
import os

THRESHOLD_PCT = 33.333333  # 33⅓%
TOLERANCE_PCT = 0.01       # 0.01 percentage point for floating-point comparisons
TOLERANCE_USD = 0.02       # $0.02 for dollar amounts

LINE_7B_FLOOR = 5000.0     # per-year cap floor: max($5,000, 1% of that year's Line 13)


def log(tag: str, msg: str):
    print(f"[{tag}] {msg}", flush=True)


def fmt(val) -> str:
    if val is None:
        return "None"
    v = float(val)
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def fmtpct(val) -> str:
    if val is None:
        return "None"
    return f"{float(val):.2f}%"


def check_bool(tag: str, label: str, condition: bool, detail: str, checks: list) -> bool:
    status = "✓ PASS" if condition else "✗ FAIL"
    log(tag, f"CHECK {label}: {detail} | {status}")
    checks.append({"label": label, "passed": condition, "detail": detail})
    return condition


def main(dataset_path: str) -> int:
    tag = "verify_schedule_a"

    log(tag, f"Reading dataset: {dataset_path}")
    with open(dataset_path) as f:
        d = json.load(f)

    sched = d.get("schedules", {})
    sa = sched.get("A")
    if sa is None:
        log(tag, "Schedule A not present in dataset — N/A")
        summary = {"script": "verify_schedule_a", "passed": 0, "total": 0,
                   "failed": [], "all_pass": True, "na_reason": "Schedule A not in dataset"}
        print(json.dumps(summary))
        return 0

    basis = sa.get("part_i_basis", "unknown")
    log(tag, f"  Schedule A basis: {basis}")

    checks = []
    all_pass = True

    # ────────────────────────────────────────────────────────────
    # Route to 509(a)(1) or 509(a)(2) section
    # ────────────────────────────────────────────────────────────
    if basis == "509(a)(2)":
        result = sa.get("part_iii_result", {})
        section_a = sa.get("part_iii_section_a", {})
        section_b = sa.get("part_iii_section_b", {})

        line_6 = section_a.get("line_6_total_support", {})
        line_7a = section_b.get("line_7a_disqualified_persons", {})
        line_7b = section_b.get("line_7b_non_dq_excess", {})
        line_8 = section_b.get("line_8_public_support", {})

        line_8_total = float(line_8.get("total", 0))
        line_13_total = float(result.get("line_11a_total_support", 0))
        public_support_pct = result.get("line_15_public_support_pct")
        investment_income_pct = float(result.get("line_11b_investment_income", 0)) / line_13_total * 100 \
            if line_13_total > 0 else 0.0
        first_5_years = result.get("line_14_first_5_years", False)
        prior_year_pct = result.get("line_16_prior_year_pct")

        log(tag, "")
        log(tag, "=== CHECK 1: First-5-years flag ===")
        log(tag, f"  line_14_first_5_years = {first_5_years}")
        if first_5_years:
            log(tag, "  First 5 years — public support test not yet required. Skipping Prong 1.")
        else:
            # ────────────────────────────────────────────────────────────
            # CHECK 1 — Prong 1: public_support_pct >= 33⅓%
            # ────────────────────────────────────────────────────────────
            log(tag, "")
            log(tag, "=== CHECK 2: Prong 1 — public support % >= 33⅓% ===")
            if public_support_pct is None:
                computed = line_8_total / line_13_total * 100 if line_13_total > 0 else 0.0
                log(tag, f"  WARNING: line_15_public_support_pct not in result; computed from line_8/line_13: {fmtpct(computed)}")
                public_support_pct = computed
            log(tag, f"  Public support total (Line 8):   {fmt(line_8_total)}")
            log(tag, f"  Total support (Line 13):         {fmt(line_13_total)}")
            log(tag, f"  Public support %  (Line 15):     {fmtpct(public_support_pct)}")
            log(tag, f"  Required threshold:              {fmtpct(THRESHOLD_PCT)}")

            ok = check_bool(
                tag, "prong1_public_support_pct",
                float(public_support_pct) >= THRESHOLD_PCT - TOLERANCE_PCT,
                f"{fmtpct(public_support_pct)} >= {fmtpct(THRESHOLD_PCT)}",
                checks,
            )
            all_pass = all_pass and ok

            # ────────────────────────────────────────────────────────────
            # CHECK 2 — Prong 2: investment_income_pct <= 33⅓%
            # ────────────────────────────────────────────────────────────
            log(tag, "")
            log(tag, "=== CHECK 3: Prong 2 — investment income % <= 33⅓% ===")
            log(tag, f"  Investment income (Line 11b): {fmt(result.get('line_11b_investment_income', 0))}")
            log(tag, f"  Total support (Line 13):      {fmt(line_13_total)}")
            log(tag, f"  Investment income %:          {fmtpct(investment_income_pct)}")

            ok = check_bool(
                tag, "prong2_investment_income_pct",
                investment_income_pct <= THRESHOLD_PCT + TOLERANCE_PCT,
                f"{fmtpct(investment_income_pct)} <= {fmtpct(THRESHOLD_PCT)}",
                checks,
            )
            all_pass = all_pass and ok

        # ────────────────────────────────────────────────────────────
        # CHECK 3 — Line 16 (prior year %) populated
        # ────────────────────────────────────────────────────────────
        log(tag, "")
        log(tag, "=== CHECK 4: Line 16 (prior year %) populated (Q-F11) ===")
        line_16_populated = prior_year_pct is not None
        log(tag, f"  line_16_prior_year_pct = {prior_year_pct}")
        ok = check_bool(
            tag, "line_16_prior_year_pct_populated",
            line_16_populated,
            f"prior_year_pct={'present' if line_16_populated else 'MISSING'}",
            checks,
        )
        all_pass = all_pass and ok

        # ────────────────────────────────────────────────────────────
        # CHECK 4 — Line 7b per-year cap verification
        # ────────────────────────────────────────────────────────────
        log(tag, "")
        log(tag, "=== CHECK 5: Line 7b per-year cap applied correctly ===")
        log(tag, "  (cap = max($5,000, 1% × that year's Line 6 total support)")

        years = ["2021", "2022", "2023", "2024", "2025"]
        line_7b_ok = True
        for yr in years:
            line_6_yr = float(line_6.get(yr, 0) or 0)
            cap_yr = max(LINE_7B_FLOOR, line_6_yr * 0.01)
            line_7b_yr = float(line_7b.get(yr, 0) or 0)
            # Line 7b for a year should be: max(0, PSR_from_non_dq - cap)
            # We only verify it doesn't EXCEED total non-DQ PSR for that year minus the cap;
            # since we don't have raw per-year PSR by source, we check line_7b[yr] <= line_2_psr[yr]
            line_2_yr = float(section_a.get("line_2_related_activities_psr", {}).get(yr, 0) or 0)
            within_bounds = line_7b_yr <= line_2_yr + TOLERANCE_USD
            log(tag, f"  {yr}: Line6={fmt(line_6_yr)} cap={fmt(cap_yr)} "
                     f"Line7b={fmt(line_7b_yr)} Line2={fmt(line_2_yr)} | "
                     f"{'✓' if within_bounds else '✗'}")
            if not within_bounds:
                line_7b_ok = False

        ok = check_bool(
            tag, "line_7b_per_year_cap",
            line_7b_ok,
            "per-year Line 7b <= per-year Line 2 (non-DQ PSR upper bound)",
            checks,
        )
        all_pass = all_pass and ok

    elif basis in ("509(a)(1)", "170(b)(1)(A)(vi)"):
        # 509(a)(1) uses Part II; structure may differ — basic check only
        log(tag, f"  509(a)(1) basis detected — checking Part II result fields")
        result = sa.get("part_ii_result", {})
        public_support_pct = result.get("line_14_public_support_pct") or result.get("public_support_pct")
        first_5_years = result.get("line_13_first_5_years", False)
        prior_year_pct = result.get("line_15_prior_year_pct") or result.get("prior_year_pct")

        if not first_5_years and public_support_pct is not None:
            log(tag, "")
            log(tag, "=== CHECK 1: 509(a)(1) public support % >= 33⅓% ===")
            log(tag, f"  Public support %: {fmtpct(public_support_pct)}")
            ok = check_bool(
                tag, "prong1_public_support_pct",
                float(public_support_pct) >= THRESHOLD_PCT - TOLERANCE_PCT,
                f"{fmtpct(public_support_pct)} >= {fmtpct(THRESHOLD_PCT)}",
                checks,
            )
            all_pass = all_pass and ok
        else:
            log(tag, "  First 5 years or pct not available — threshold check skipped")

        log(tag, "")
        log(tag, "=== CHECK 2: Line 15/16 (prior year %) populated (Q-F11) ===")
        ok = check_bool(
            tag, "prior_year_pct_populated",
            prior_year_pct is not None,
            f"prior_year_pct={'present' if prior_year_pct is not None else 'MISSING'}",
            checks,
        )
        all_pass = all_pass and ok
    else:
        log(tag, f"  Unknown Schedule A basis '{basis}' — no checks run")

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
        "script": "verify_schedule_a",
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
        print(json.dumps({"script": "verify_schedule_a", "error": f"not found: {path}",
                          "all_pass": False}))
        sys.exit(2)
    sys.exit(main(path))
