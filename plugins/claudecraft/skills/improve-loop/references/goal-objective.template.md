# Improve-loop optional host `/goal` body

**Primary multi-cycle is the skill’s L1 campaign driver** (default `/improve` loops L2 until
terminal/cap/block and emits a Campaign report). Host `/goal` is **optional** — for session
visibility, pause/Esc, or outer max-turns/budget. Do not treat host re-drive as required.

Fill placeholders only if you open a host goal alongside `/improve`:

```
Improve-loop campaign for target: <TARGET>
Repo: <TARGET_REPO_ABS>
Test command: <CMD>
Mode: autonomous (default) | once

The agent runs the improve-loop skill. Default: L1 loops L2 cycles in-session until
Status is terminal (complete OR stopped(...)) AND the iteration commit has landed
(merge-back best-effort), or until MAX_CYCLES / blocked. Default complete requires
P0/P1 planning from git history and **two consecutive** cycles with no open material
P0/P1 (plus green suite). Stale pointer is discarded; each invoke cold-starts unless
--resume.

Done when Phase 5 / L1 reports terminal+landed (Campaign report). On active mid-campaign:
progress only — do not complete the host goal.
```

## Placeholder rules

| Token | Meaning |
|---|---|
| `<TARGET>` | Plain-language improvement target from the user |
| `<TARGET_REPO_ABS>` | Absolute path to the target git repo root |
| `<CMD>` | Recorded test command (must be non-empty for unattended) |
