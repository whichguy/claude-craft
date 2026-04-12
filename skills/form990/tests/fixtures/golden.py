"""
Pinned golden fixture constants for the form990 verify harness.
Imported by tests/verify.py — single source of truth for expected values.

Fixes fragile inline magic numbers: each constant is named, documented,
and tied to the fixture or computation that produces it.

A5 change (form990-hardening-2): extracted from plan §Post-Hardening
Senior-Engineer Review — Theme A "pinned golden fixture table".
"""

# ---------------------------------------------------------------------------
# TC24 — Q-F4 public support test (509(a)(1) 33⅓% floor)
# Fixture: tests/fixtures/schedule_a_support.json (TC24-specific)
# ---------------------------------------------------------------------------

# Sum of public support across 5 years from the TC24 fixture.
# Source: fixture budget rows tagged "rev.contributions.*" years 1–5.
SUPPORT_5YR_TOTAL = 300_000

# 1% of total support — computed cap before $5,000 floor is applied.
# Q-F4 uses max(1% × total_support, $5,000) per §509(a)(2) rules.
ONE_PCT_CAP_COMPUTED = int(SUPPORT_5YR_TOTAL * 0.01)  # 3000

# The actual per-donor cap after applying the $5,000 statutory floor.
# This is the value the Q-F4 evaluator must use — B2 fix asserts this.
ONE_PCT_FLOOR_APPLIED = max(ONE_PCT_CAP_COMPUTED, 5_000)  # 5000

# ---------------------------------------------------------------------------
# TC25 — Part I Line 8 big-square reconciliation
# Fixture: inline synthetic machine state in TC25
# ---------------------------------------------------------------------------

# Part VIII Line 1h (total contributions) — maps to Part I Line 8.
# The B1 fix corrects the prior typo that mapped total revenue to Line 8.
LINE_8_CONTRIBUTIONS = 425_000

# Part VIII Line 12 (total revenue) — maps to Part I Line 12.
LINE_12_TOTAL_REVENUE = 612_000

# ---------------------------------------------------------------------------
# TC20 — scrub_pii boundary tests (phone / email / DOB / address / SSN)
# Static strings verified once by hand; do not change without re-validating
# the scrub_pii() rules in lib/form990_lib.py.
# ---------------------------------------------------------------------------

PII_INPUT_SSN       = "SSN: 123-45-6789 from Alice"
PII_EXPECTED_SSN    = "SSN: [REDACTED-SSN] from Alice"

# Hyphenated EIN must pass through unchanged — it is not an SSN.
PII_INPUT_EIN       = "EIN 12-3456789"
PII_EXPECTED_EIN    = "EIN 12-3456789"

PII_INPUT_PHONE     = "call 555-123-4567"
PII_EXPECTED_PHONE  = "call [REDACTED-PHONE]"

PII_INPUT_EMAIL     = "to admin@example.org"
PII_EXPECTED_EMAIL  = "to [REDACTED-EMAIL]"

PII_INPUT_ADDR      = "123 Main St, Anytown"
PII_EXPECTED_ADDR   = "[REDACTED-ADDR], Anytown"

PII_INPUT_DOB       = "born 03/15/1980"
PII_EXPECTED_DOB    = "born [REDACTED-DOB]"

# ---------------------------------------------------------------------------
# TC21 / TC22 — donor name scrubbing
# ---------------------------------------------------------------------------

# Canonical donor name used across TC21 (word-boundary test) and TC22
# (pre-P6 empty donor_names scenario).
DONOR_NAME_JANE = "Jane Doe"

# TC21: "Jane Doe" with word boundaries — the name should be masked.
# "Alice" should NOT be masked (not in donor_names).
PII_INPUT_DONOR_WB      = "Donor Jane Doe gave $5000; Alice gave $100"
PII_EXPECTED_DONOR_WB   = "Donor [REDACTED-DONOR] gave $5000; Alice gave $100"

# TC22: pre-P6 scenario — donor_names list is empty, so Jane Doe is NOT masked.
# Verifies the "elevated PII risk" mode is documented, not silently broken.
PII_INPUT_DONOR_EMPTY   = "Donor Jane Doe gave $5000"
PII_EXPECTED_DONOR_EMPTY = "Donor Jane Doe gave $5000"  # unchanged — empty list
