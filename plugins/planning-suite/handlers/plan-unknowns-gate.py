#!/usr/bin/env python3
"""PreToolUse gate on ExitPlanMode: every plan must end with an
'## Open Unknowns' section before it can be presented for approval.

First ExitPlanMode attempt (no such section): the plan is sent to the
OpenAI Codex CLI (read-only sandbox) for a cross-model unknowns review,
and the tool call is denied with Codex's findings. The point is to PLAN
the unknowns, not disclaim them: the deny instructs Claude to resolve
each one during planning where possible (or add a concrete resolution
step to the plan), and only then record what remains under an
'## Open Unknowns' heading and retry. If Codex is unavailable, the deny
tells Claude to run the same audit itself. A plan that already contains
an unknowns heading passes straight through.

Opt out per-invocation with CLAUDE_PLAN_UNKNOWNS_GATE=0.
Fails open on any parse/read error — never bricks planning.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

CODEX_TIMEOUT_S = 150  # keep below the hook timeout in settings.json (180)
MAX_SECTION_CHARS = 8000  # cap on Codex output embedded in the deny reason

# Markdown heading line: up to 3 spaces indent, 1-6 hashes, then a space.
HEADING_RE = re.compile(r"^[ \t]{0,3}(#{1,6})[ \t]+(.*)$")
# Codex output heading may omit the space after the hashes; be lenient here
# and normalize to the canonical form before it reaches the plan.
SECTION_HEAD_RE = re.compile(r"^[ \t]{0,3}#{1,6}[ \t]*open\s+unknowns\b", re.IGNORECASE | re.MULTILINE)
FENCE_RE = re.compile(r"^[ \t]{0,3}(```|~~~)")

CODEX_PROMPT = """You are reviewing an implementation plan written by another AI agent. \
Your job is to surface the unknowns the plan silently relies on: assumptions stated \
without evidence, APIs/schemas/behaviors referenced but never verified, unexplored \
failure modes, and decisions the plan never actually makes. Only list things that were \
NOT already investigated, discussed, or resolved in the plan text itself. You may \
briefly inspect the repository in your working directory (read-only) to check the \
plan's claims, but keep it quick.

Output ONLY a markdown section in exactly this shape, with no preamble, no code fences, \
and nothing after it:

## Open Unknowns

- **<the unknown>** — why it matters / what breaks if guessed wrong. *Resolve:* <the concrete step that closes it — what to inspect, verify, or decide, and where in the plan that step belongs (before implementation, during step N, as a verification gate, or as a question for the user)>.

One bullet per unknown, most important first, at most 6 bullets. Every bullet must be \
resolvable — name the action that would close it, not just the risk. If the plan genuinely \
resolved everything material, output the section with the single line: \
None — all material unknowns were investigated.

The plan to review follows:

"""

FALLBACK_REASON = """Before this plan can be presented, its unknowns must be planned, not \
just listed. Re-read the plan and identify the unknowns it relies on that were NOT \
actually investigated or discussed during planning (unverified assumptions, APIs/schemas \
never checked, unexplored failure modes, decisions never made). Then, for each one: \
(a) if you can resolve it NOW, do the investigation in plan mode — read the code, verify \
the API/schema, make the decision — and fold the answer into the plan body; \
(b) otherwise add a concrete resolution step at the right point in the plan (spike, \
default + verification gate, question for the user). Finally append a section titled \
exactly '## Open Unknowns' recording only what remains open and, for each item, how the \
plan now handles it. If there are genuinely none, write \
'None — all material unknowns were investigated.' under the heading. \
Then call ExitPlanMode again."""

CODEX_REASON_TEMPLATE = """Codex (cross-model reviewer) analyzed this plan and identified \
unknowns that were not resolved during planning. Do NOT just paste this list into the \
plan. For each item below: (a) if you can resolve it NOW, do the investigation in plan \
mode — read the code, verify the API/schema, make the decision — and fold the answer \
into the plan body; (b) otherwise add a concrete resolution step at the right point in \
the plan (spike, default + verification gate, question for the user). Then append a \
'## Open Unknowns' section (keep that exact heading) recording only what remains open \
and how the plan now handles each item — drop items you can show are already settled — \
and call ExitPlanMode again:

{section}"""


def allow():
    sys.exit(0)


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def has_unknowns_heading(text):
    """True if a real (non-fenced-code) markdown heading mentions 'unknowns'."""
    in_fence = False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = HEADING_RE.match(line)
        if m and re.search(r"\bunknowns\b", m.group(2), re.IGNORECASE):
            return True
    return False


def get_plan_text(tool_input):
    plan = tool_input.get("plan")
    if isinstance(plan, str) and plan.strip():
        return plan
    path = tool_input.get("planFilePath")
    if isinstance(path, str) and path:
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                return f.read()
        except (OSError, UnicodeError):
            pass
    return ""


def extract_section(text):
    """Pull the Open Unknowns section out of Codex output, normalizing its
    heading to the canonical '## Open Unknowns' so the appended plan always
    satisfies has_unknowns_heading(). Returns None if absent/empty."""
    m = SECTION_HEAD_RE.search(text)
    if not m:
        return None
    tail = text[m.end():]
    # Drop the rest of the matched heading line, keep everything after it.
    body = tail.split("\n", 1)[1] if "\n" in tail else ""
    section = "## Open Unknowns\n" + body.rstrip()
    if not body.strip():
        return None
    if len(section) > MAX_SECTION_CHARS:
        section = section[:MAX_SECTION_CHARS] + "\n- ... (truncated)"
    return section


def run_codex(plan, cwd):
    """Return Codex's '## Open Unknowns' section, or None on any failure."""
    codex = shutil.which("codex")
    if not codex:
        return None
    outfile = None
    try:
        fd, outfile = tempfile.mkstemp(prefix="plan-unknowns-", suffix=".md")
        os.close(fd)
        cmd = [
            codex, "exec",
            "--sandbox", "read-only",
            "--ephemeral",
            "--skip-git-repo-check",
            "-C", cwd,
            "-o", outfile,
            "--color", "never",
            "-",
        ]
        proc = subprocess.run(
            cmd,
            input=CODEX_PROMPT + plan,
            capture_output=True,
            text=True,
            timeout=CODEX_TIMEOUT_S,
        )
        if proc.returncode != 0:
            return None
        with open(outfile, encoding="utf-8", errors="replace") as f:
            return extract_section(f.read())
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return None
    finally:
        if outfile:
            try:
                os.unlink(outfile)
            except OSError:
                pass


def main():
    if os.environ.get("CLAUDE_PLAN_UNKNOWNS_GATE", "1") == "0":
        allow()
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict) or payload.get("tool_name") != "ExitPlanMode":
        allow()

    tool_input = payload.get("tool_input")
    plan = get_plan_text(tool_input if isinstance(tool_input, dict) else {})
    if not plan.strip():
        allow()  # nothing to audit — fail open
    if has_unknowns_heading(plan):
        allow()  # unknowns section already present

    cwd = payload.get("cwd")
    if not (isinstance(cwd, str) and os.path.isdir(cwd)):
        cwd = os.getcwd()
    section = run_codex(plan, cwd)
    if section:
        deny(CODEX_REASON_TEMPLATE.format(section=section))
    deny(FALLBACK_REASON)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        # Fail open: the gate must never brick planning.
        sys.exit(0)
