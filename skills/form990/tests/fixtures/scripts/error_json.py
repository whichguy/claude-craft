#!/usr/bin/env python3
"""Fixture: emits structured error-JSON on stdout, exits 1."""
import json, sys

if __name__ == "__main__":
    print(json.dumps({
        "status": "error",
        "error_class": "TestError",
        "error_message": "simulated structured error for TC11",
        "trace": "n/a",
    }))
    sys.exit(1)
