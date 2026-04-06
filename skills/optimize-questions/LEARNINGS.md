# optimize-questions Learnings

## Principles
<!-- Graduated from observations when pattern recurs 3+ times across runs. -->

- [P1] Consequence-only clauses ("Consequence: X breaks Y") are safe to remove — 5-10% savings, 0 quality loss. (12 observations)
- [P2] Verb simplification ("does the plan verify" → "verified?") yields 10-15% with no quality loss. (8 observations)
- [P3] Removing purpose/WHY statements causes judge correctness regression — never safe. (5 observations)
- [P4] Removing elaboration while keeping core calibration examples saves 15-25%. (9 observations)
- [P5] Consolidating flag criteria via semicolons saves 10-20% vs numbered lists. (7 observations)

## Compression Guidance
<!-- Updated by Step 4 each run. Read by Step 1 compression agents. -->

Target questions with >3 consequence clauses (safe ~40% savings). Avoid touching calibration
examples that define PASS/NEEDS_UPDATE boundaries — attempts that removed them lost on
correctness in 3 of 4 trials. Questions under 50 tokens rarely compress meaningfully.

## Recent Observations
<!-- Rolling window: last 50. Oldest pruned each run. Format: [O] Q-ID: ... -->

(No observations yet — will be populated after first run with learnings extraction.)
