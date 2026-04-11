#!/usr/bin/env python3
"""Fixture: emits non-JSON to stdout, exits 0 — triggers JSON parse failure in TC11."""
import sys

if __name__ == "__main__":
    print("not json — this is plain text output that will fail json.loads()")
    sys.exit(0)
