#!/usr/bin/env python3
"""Fixture: sleeps forever — used to trigger timeout in TC11."""
import time, sys

if __name__ == "__main__":
    time.sleep(999)
    sys.exit(0)
