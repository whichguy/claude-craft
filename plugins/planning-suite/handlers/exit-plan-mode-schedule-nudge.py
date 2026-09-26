#!/usr/bin/env python3
"""PostToolUse ExitPlanMode: EXECUTE NOW nudge (payload-only plan path).

Opt out: CLAUDE_PLAN_AUTO_EXECUTE=0|off|false|no
Never uses mtime newest-plan guessing for EXECUTE NOW (wrong-plan risk).

Execute routing (plan front-matter `Execute:` within the first 30 lines):
  inline   — implement in-session now (the default when `Execute:` is absent)
  schedule — run /skill-craft:backchain on the approved plan to produce a
             dependency graph, then /skill-craft:plan-dispatcher to execute
             that graph (skill-craft@whichguy plugin)
  ask      — wait for explicit user go-ahead (rare)

The former /schedule-plan-tasks target was removed from planning-suite
(0.3.0); skill-craft is the single source of truth for plan scheduling.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

_EXECUTE_RE = re.compile(r"(?im)^\s*Execute:\s*(schedule|inline|ask)\s*$")

BACKCHAIN = "/skill-craft:backchain"
DISPATCHER = "/skill-craft:plan-dispatcher"


def _auto_execute_enabled() -> bool:
    value = os.environ.get("CLAUDE_PLAN_AUTO_EXECUTE", "1").strip().lower()
    return value not in ("0", "off", "false", "no")


def _tool_input(payload: dict) -> dict:
    ti = payload.get("tool_input") or payload.get("toolInput") or {}
    return ti if isinstance(ti, dict) else {}


def resolve_plan_path(payload: dict, home: Path) -> tuple[str | None, str]:
    """Return (absolute_path_or_None, src) where src is payload|hash|none."""
    ti = _tool_input(payload)
    for key in ("planFilePath", "plan_file_path", "plan_path", "planPath"):
        value = ti.get(key)
        if isinstance(value, str) and value.strip():
            path = Path(value).expanduser()
            if path.is_file():
                return str(path.resolve()), "payload"

    inline = ti.get("plan") or ti.get("plan_content") or ti.get("planContent")
    if isinstance(inline, str) and inline.strip():
        digest = hashlib.sha256(
            inline.encode("utf-8", errors="replace")
        ).hexdigest()
        plans_dir = home / ".claude" / "plans"
        matches: list[str] = []
        if plans_dir.is_dir():
            for plan_file in plans_dir.glob("*.md"):
                try:
                    body = plan_file.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                if (
                    hashlib.sha256(body.encode("utf-8", errors="replace")).hexdigest()
                    == digest
                ):
                    matches.append(str(plan_file.resolve()))
        if len(matches) == 1:
            return matches[0], "hash"

    return None, "none"


def load_plan_text(payload: dict, plan_path: str | None) -> str:
    ti = _tool_input(payload)
    inline = ti.get("plan") or ti.get("plan_content") or ti.get("planContent")
    if isinstance(inline, str) and inline.strip():
        return inline
    if plan_path:
        try:
            return Path(plan_path).read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
    return ""


def resolve_execute_mode(plan_text: str) -> tuple[str, str]:
    """Return (mode, reason) with mode in {schedule, inline, ask}.

    Only an explicit `Execute:` line in the first 30 lines changes the mode;
    everything else implements inline in the current session.
    """
    if not plan_text.strip():
        return "inline", "default-no-body"

    head = "\n".join(plan_text.splitlines()[:30])
    m = _EXECUTE_RE.search(head)
    if m:
        return m.group(1).lower(), "front-matter"
    return "inline", "default"


def schedule_steps(plan_path: str | None) -> str:
    """The two-step skill-craft route for `Execute: schedule`."""
    target = f"the approved plan at `{plan_path}`" if plan_path else "the plan you just approved"
    return (
        f"Run `{BACKCHAIN}` on {target} to produce a dependency graph, then run "
        f"`{DISPATCHER}` to execute that graph. "
    )


def append_log(
    home: Path,
    src: str,
    plan_path: str | None,
    auto: bool,
    execute: str,
    execute_src: str,
) -> None:
    log_dir = home / ".claude" / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "planning-suite-hooks.log"
        stamp = datetime.now().astimezone().isoformat(timespec="seconds")
        line = (
            f"[schedule-nudge] {stamp} src={src} "
            f"plan={plan_path or '-'} auto={1 if auto else 0} "
            f"execute={execute} execute_src={execute_src}"
        )
        prev: list[str] = []
        if log_path.is_file():
            prev = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        keep = prev[-199:] + [line]
        log_path.write_text("\n".join(keep) + "\n", encoding="utf-8")
    except OSError:
        pass


def build_output(
    plan_path: str | None,
    auto: bool,
    execute: str,
) -> dict | None:
    if not auto or execute == "ask":
        if not plan_path and execute != "ask":
            return None
        if execute == "ask":
            plan_ref = f"at `{plan_path}` " if plan_path else ""
            ctx = (
                f"The plan {plan_ref}was approved via ExitPlanMode with "
                f"`Execute: ask`. Wait for an explicit user go-ahead "
                f'("implement" / "execute the plan") before starting work. '
                f"Do not auto-start."
            )
            msg = "Plan approved — Execute: ask (wait for explicit go-ahead)."
        else:
            ctx = (
                f"The plan at `{plan_path}` was approved via ExitPlanMode. "
                f"Auto-execute is off (CLAUDE_PLAN_AUTO_EXECUTE=0). "
                + (
                    schedule_steps(plan_path) + "Do this when the user is ready."
                    if execute == "schedule"
                    else "Implement it inline in this session when the user is ready."
                )
            )
            msg = "Plan approved — auto-execute off; start when ready."
        return {
            "systemMessage": msg,
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": ctx,
            },
        }

    plan_ref = f"at `{plan_path}` " if plan_path else ""

    if execute == "inline":
        ctx = (
            f"EXECUTE NOW (inline): The plan {plan_ref}was just approved via "
            f"ExitPlanMode. User approval is the execute signal. Begin implementing "
            f"**in this session now** — first tool call must be edit/bash/write. "
            f"Do **not** hand it to a scheduler or worker fan-out (this plan is inline). "
            f'Do NOT summarize and stop. Do NOT ask the user to say "implement". '
            f"Only skip if the user already said to wait / defer / don't implement."
        )
        msg = "Plan approved — implement inline now."
        return {
            "systemMessage": msg,
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": ctx,
            },
        }

    # schedule (explicit `Execute: schedule` only)
    msg = (
        f"Plan approved — Execute: schedule: run {BACKCHAIN}, then {DISPATCHER} "
        "(execute now)."
    )
    ctx = (
        f"EXECUTE NOW (schedule): The plan {plan_ref}was just approved via ExitPlanMode "
        f"with `Execute: schedule`. User approval of ExitPlanMode is the execute signal — "
        f"not a request to wait. In this same turn: {schedule_steps(plan_path)}"
        + (
            "Pass that exact plan path so neither skill re-discovers a different plan. "
            if plan_path
            else ""
        )
        + f'Do NOT summarize the plan and stop. Do NOT ask the user to say "implement" '
        f'or "execute". Only skip if the user already said to wait / defer / don\'t '
        f"implement / not yet. If the skill-craft plugin (skill-craft@whichguy) is not "
        f"installed, begin implementing inline (first tool = edit/bash)."
    )
    return {
        "systemMessage": msg,
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": ctx,
        },
    }


def main() -> int:
    try:
        raw = sys.stdin.read() if not sys.stdin.isatty() else ""
        payload: dict = {}
        if raw.strip():
            try:
                loaded = json.loads(raw)
                if isinstance(loaded, dict):
                    payload = loaded
            except json.JSONDecodeError:
                payload = {}

        home = Path(os.environ.get("HOME") or Path.home())
        auto = _auto_execute_enabled()
        plan_path, src = resolve_plan_path(payload, home)
        plan_text = load_plan_text(payload, plan_path)
        execute, execute_src = resolve_execute_mode(plan_text)
        append_log(home, src, plan_path, auto, execute, execute_src)
        out = build_output(plan_path, auto, execute)
        if out:
            print(json.dumps(out, ensure_ascii=False))
    except Exception:
        # Fail-open: never block ExitPlanMode PostToolUse.
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
