# Output Format Specification

Canonical reference for rich dashboard output across all agents and directives.

## Character Vocabulary

```
BANNER:     ╔ ═ ╗ ║ ╚ ╝         (double-line box — opening/closing banners)
TREE:       ├─ │ └─              (file/item tree diagrams)
SEPARATOR:  ━━━                  (heavy rule — major section breaks)
DIVIDER:    ──                   (light rule — minor section breaks)
STATUS:     ✓ ✗ ⚠ ▸ ◉           (pass, fail, warn, active, pending)
PHASE:      [IN PROGRESS] [DONE] [PENDING] [SKIPPED]
PROGRESS:   [▓░░░░] [▓▓░░░]     (round/step progress)
```

## Implementation Banner

Emit once at implementation start, before Phase 1.

```
╔═══════════════════════════════════════╗
║  Implementation: {plan_slug}          ║
║  Phases: {N} | Files: {M}            ║
╚═══════════════════════════════════════╝
```

- `plan_slug` = plan file name (slug form). Box inner width 39, right-pad with spaces before `║`.
- `Files` = total unique files across all phases.

## Phase Block

Emit after completing each phase.

```
▸ Phase {i}/{N} — {PhaseName} [{STATUS}]
  ├─ {filepath}
  │  ✓ {change_description}    (+{lines} lines)
  │  ✓ {change_description}    (+{lines} lines)
  ├─ {filepath2}
  │  ✓ {change_description}
  └─ {summary_metric} | {error_count} errors

📖 **Phase {i} — {PhaseName}:** {3-5 sentence narrative, blog-post voice}
```

- `✓` completed, `✗` failed, `⚠` partial. Tree: `├─` non-terminal, `└─` terminal.
- Line counts approximate from actual edits. Narrative immediately follows tree.
- Pending phases (not yet started): show only `▸ Phase {i}/{N} — {Name} [PENDING]`.

## POST_IMPLEMENT Dashboard

Emit after the POST_IMPLEMENT pipeline completes (or on fallback).

```
━━━ POST_IMPLEMENT ━━━━━━━━━━━━━━━━━━━
  {badge} review-fix  {summary}
  {badge} build       {summary}
  {badge} tests       {summary}
  {badge} push → PR #{N} → merged
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: {files} files | +{lines} lines
```

- `review-fix`: `R{N} clean ({C}c/{A}a)`. `build`: tool + status. `tests`: `{count} passing (+{delta})`.
- If step fails: `✗`. Blocked steps: `◉ {step}  [blocked]`.
- If no remote/auth: `✓ committed locally` (no PR line).

## Agent Report Banner

For any agent producing a user-facing report.

```
╔════════════════════════════════════════╗
║  {agent-name} — {context}              ║
╚════════════════════════════════════════╝
```

Inner width 40, right-pad with spaces before `║`.

## Fallback

If `output-format.md` not found: use `──── SECTION ────────────` separators + emoji badges inline. Readable but loses dashboard aesthetic.
