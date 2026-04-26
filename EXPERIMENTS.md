# Experiments — active register

Tracks every formal experiment, spike, and ablation in this repo so artifacts don't go stale and orphaned variants get cleaned up when an experiment concludes.

## Why this file exists

Experiments produce **artifacts** (variant prompts, scaffolded fixtures, A/B markers) that look like first-class code if their parent experiment isn't recorded somewhere. When the experiment concludes — or stalls — the artifacts decay into dead weight that confuses future readers.

This register answers:
- What experiments are open?
- What artifacts belong to each?
- When does each artifact become safe to delete?

## Convention

Each experiment has:
- A short ID (`E1`, `Spike2`, etc.) referenced in commits, comments, and artifact frontmatter
- A writeup at `docs/experiments/<topic>-<id>-<YYYY-MM-DD>.md`
- One row in this file
- A status that progresses **Pre-registered → In-progress → Concluded → Cleaned**

When an experiment is **Concluded**, decide one of:
- **Apply**: winning variant becomes baseline; losing variants and scaffolding are deleted
- **Reject**: hypothesis disproven; all variants and scaffolding are deleted, writeup retained
- **Park**: keep variants for follow-up but rename status to **Parked** with a target date

When **Cleaned**, all artifacts are gone and only the writeup remains.

## Active register

| ID | Title | Date | Status | Writeup | Live artifacts | Notes |
|----|-------|------|--------|---------|----------------|-------|
| E0 | Noise Baseline | 2026-04-12 | Pre-registered | `docs/experiments/review-fix-e0-noise-baseline-2026-04-12.md` | (none) | Establishes variance floor before E1-E6 measurements |
| E1 | Prompt Caching | 2026-04-12 | **Cleaned** (cached variant deleted 2026-04-25 in `6bfc423`) | `docs/experiments/review-fix-e1-prompt-caching-2026-04-12.md` | (none — `agents/variants/code-reviewer-cached.md` removed; cached variant's "sole diff = cache markers" invariant broke when code-reviewer.md was slimmed to G16) | Re-run on G16 baseline if caching still relevant |
| E2 | Haiku vs Sonnet Rechecks | 2026-04-12 | Pre-registered | `docs/experiments/review-fix-e2-haiku-rechecks-2026-04-12.md` | (none) | |
| E3 | Confidence Threshold Sweep | 2026-04-12 | **Cleaned** (variants deleted 2026-04-25 in `6f823f1`) | `docs/experiments/review-fix-e3-confidence-threshold-2026-04-12.md` | (none — `agents/variants/code-reviewer-t{70,75,80,85}.md` removed; variants drifted ~205 lines from G16 baseline, violating the "1-2 line diff" test invariant) | Re-scaffold from G16 if threshold sweep is rerun |
| E4 | Round Count Ablation | 2026-04-12 | Pre-registered | `docs/experiments/review-fix-e4-round-ablation-2026-04-12.md` | (none) | |
| E5 | GAS Dual-Reviewer ROI | 2026-04-12 | Pre-registered | `docs/experiments/review-fix-e5-gas-dual-reviewer-2026-04-12.md` | (none) | |
| E6 | Fixture Expansion | 2026-04-12 | In-progress | `docs/experiments/review-fix-e6-fixture-expansion-2026-04-12.md` | `test/fixtures/review-fix/` additions, `skills/review-plan/inputs/bench/*.md` (74 calibration fixtures) | The 74 bench fixtures are load-bearing for E6 prompt-variation experiments — do not delete |
| Spike0 | Wiki Read-Gate Output Shape Pin | 2026-04-19 | Concluded (canonical shape pinned in code) | (referenced in `plugins/wiki-hooks/handlers/wiki-read-gate.sh:9-14`) | `wiki-read-gate.sh` (production) | — |
| Spike2 | Haiku Freeform Pre-Pass Round-Reduction | 2026-04-21 | Pre-registered | `docs/experiments/review-fix-spike2-2026-04-21.md` | `test/fixtures/review-fix/spike2-multi-round.ground-truth.json` | Fixture description still references "Q1-Q37 rounds" — pre-G16 terminology; safe to leave as historical artifact |
| Memoized-delta | Convergence Pass 2+ Narrowing | 2026-04-20 | In-progress | `docs/experiments/memoized-delta-pass2.md` | `skills/review-plan/SKILL.md` (delta-filter logic) | Logic active in production, experiment status pending writeup conclusion |

## Cleanup checklist when concluding an experiment

1. Update this file: status → **Concluded** with one-line outcome (Applied / Rejected / Parked)
2. If **Applied**: merge winning variant into baseline, delete losing variants, delete scaffolded test fixtures unless they're calibration corpus (call out which is which in writeup)
3. If **Rejected**: delete all variants and scaffolding; retain the writeup as historical record
4. After artifact removal, update status to **Cleaned**
5. Reference the cleanup commit SHA in the writeup so the trail is recoverable

## Open questions

- **Spike2 fixture description**: Mentions "Q1-Q37 rounds" — pre-G16 terminology. Leave as historical or rewrite for G16? Currently leaving (no test depends on the prose).
- **Memoized-delta**: In-progress logic shipped to production; needs a writeup conclusion + status update to either In-progress (still measuring) or Concluded (kept).
- **Pre-registered E0/E2/E4/E5**: Were these experiments ever run? If a year passes without status change, propose archiving the writeup and closing the row.
