#!/usr/bin/env python3
"""Render the 'Sandboxes provisioned' markdown block for the PR body.

Usage: python3 render-pr-body.py <path/to/.sandbox-refs.json>

Reads the JSON refs file written by Phase 0 (sandbox-provisioner) and emits a
markdown bullet list to stdout. The PR-body step appends the output under a
'## Sandboxes provisioned' heading.

cleanup_hint -> rendered inside backticks (copyable command)
cleanup_note -> rendered as plain prose (manual/no-delete systems)
"""
import json
import sys


def main(path: str) -> int:
    with open(path) as fh:
        data = json.load(fh)
    out = []
    for s in data.get("sandboxes", []):
        line = f"- **{s['type']}** sandbox `{s['sandbox_ref']}`"
        if s.get("sandbox_url"):
            line += f" — {s['sandbox_url']}"
        out.append(line)
        if s.get("cleanup_hint"):
            out.append(f"  - Cleanup: `{s['cleanup_hint']}`")
        elif s.get("cleanup_note"):
            out.append(f"  - Cleanup: {s['cleanup_note']}")
        if s.get("notes"):
            out.append(f"  - Note: {s['notes']}")
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
