#!/usr/bin/env python3
"""Fixture: prints error to stderr, exits 1 (non-zero, non-JSON stdout)."""
import sys

if __name__ == "__main__":
    print("Traceback (most recent call last):", file=sys.stderr)
    print('  File "bad_stderr.py", line 10, in main', file=sys.stderr)
    print("RuntimeError: simulated script failure", file=sys.stderr)
    sys.exit(1)
