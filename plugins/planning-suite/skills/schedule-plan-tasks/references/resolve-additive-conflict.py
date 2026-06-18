#!/usr/bin/env python3
"""Resolve a purely-additive git merge conflict by concatenating both sides.

Usage: python3 resolve-additive-conflict.py <path/to/conflict-file>

Operates on a file containing standard git conflict markers:
    <<<<<<< HEAD
    <head lines>
    =======
    <incoming lines>
    >>>>>>> <ref>

Each conflict block is replaced with: HEAD lines followed by incoming lines,
both verbatim. This is the K-Option-2 manual-resolve algorithm for the
Case A.1 (Shared-registration + line-adjacent appends) path. The orchestrator
guarantees additive-only eligibility BEFORE invoking this resolver — this
script does not re-verify that contract; it only mechanically combines.

Determinism: HEAD always comes first, then incoming. Re-running on a clean
merge state produces identical output.

Exit: 0 on success, nonzero on read/write or pattern errors.
"""
import re
import sys

CONFLICT_PATTERN = re.compile(
    r"<<<<<<<[^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]*\n",
    re.S,
)


def resolve(path: str) -> int:
    with open(path) as fh:
        src = fh.read()
    if not CONFLICT_PATTERN.search(src):
        print(f"error: no conflict markers found in {path}", file=sys.stderr)
        return 1

    def keep_both(m: "re.Match[str]") -> str:
        return m.group(1) + "\n" + m.group(2) + "\n"

    with open(path, "w") as fh:
        fh.write(CONFLICT_PATTERN.sub(keep_both, src))
    return 0


if __name__ == "__main__":
    sys.exit(resolve(sys.argv[1]))
