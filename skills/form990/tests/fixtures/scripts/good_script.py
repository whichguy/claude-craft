#!/usr/bin/env python3
"""Fixture: emits {"ok": true} on stdout, exit 0."""
import json, sys

if __name__ == "__main__":
    # Accept --json-only flag (ignored; this script always emits pure JSON)
    print(json.dumps({"ok": True}))
    sys.exit(0)
