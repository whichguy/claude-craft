#!/usr/bin/env python3
"""PostToolUse ExitPlanMode: EXECUTE NOW nudge (payload-only plan path).

Opt out: CLAUDE_PLAN_AUTO_EXECUTE=0|off|false|no
Never uses mtime newest-plan guessing for EXECUTE NOW (wrong-plan risk).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path


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


def append_log(home: Path, src: str, plan_path: str | None, auto: bool) -> None:
    log_dir = home / ".claude" / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "planning-suite-hooks.log"
        stamp = datetime.now().astimezone().isoformat(timespec="seconds")
        line = (
            f"[schedule-nudge] {stamp} src={src} "
            f"plan={plan_path or '-'} auto={1 if auto else 0}"
        )
        prev: list[str] = []
        if log_path.is_file():
            prev = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        keep = prev[-199:] + [line]
        log_path.write_text("\n".join(keep) + "\n", encoding="utf-8")
    except OSError:
        pass


def build_output(plan_path: str | None, auto: bool) -> dict | None:
    if not auto:
        if not plan_path:
            return None
        ctx = (
            f"The plan at `{plan_path}` was approved via ExitPlanMode. "
            f"Auto-execute is off (CLAUDE_PLAN_AUTO_EXECUTE=0). "
            f"Invoke `/schedule-plan-tasks --plan '{plan_path}'` when ready."
        )
        return {
            "systemMessage": (
                "Plan approved — auto-execute off; /schedule-plan-tasks available."
            ),
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": ctx,
            },
        }

    if plan_path:
        inv = f"/schedule-plan-tasks --plan '{plan_path}'"
        bind = (
            f"Immediately invoke `{inv}` (Branch A, live) in this same turn. "
            f"Pass that exact --plan path so the skill does not re-discover a different plan. "
        )
        plan_ref = f"at `{plan_path}` "
        msg = f"Plan approved — immediately invoke {inv} (execute now)."
    else:
        inv = "/schedule-plan-tasks"
        bind = (
            "Immediately invoke `/schedule-plan-tasks` (Branch A, live) for the plan "
            "you just approved in this turn (no path was in the ExitPlanMode payload). "
            "If the skill is unavailable in this harness, begin implementing now — "
            "first tool call must be edit/bash/write, not a summary. "
        )
        plan_ref = ""
        msg = (
            "Plan approved — immediately execute "
            "(schedule-plan-tasks if available, else implement)."
        )

    ctx = (
        f"EXECUTE NOW: The plan {plan_ref}was just approved via ExitPlanMode. "
        f"User approval of ExitPlanMode is the execute signal — not a request to wait. "
        f"{bind}"
        f'Do NOT summarize the plan and stop. Do NOT ask the user to say "implement" '
        f'or "execute". Only skip if the user already said to wait / defer / don\'t '
        f"implement / not yet. If `/schedule-plan-tasks` is not available, begin "
        f"implementing inline (first tool = edit/bash)."
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
        append_log(home, src, plan_path, auto)
        out = build_output(plan_path, auto)
        if out:
            print(json.dumps(out, ensure_ascii=False))
    except Exception:
        # Fail-open: never block ExitPlanMode PostToolUse.
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
