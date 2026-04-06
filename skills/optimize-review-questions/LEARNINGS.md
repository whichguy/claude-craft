# optimize-review-questions Learnings

## Principles
<!-- Graduated from observations when pattern recurs 3+ times across runs. -->

**P1**: Consequence clauses, interrogative framing, and filler adjectives are safe to remove — they explain rationale but do not drive detection. Cut "because X matters" tails and "Are there...that" wrappers. (evidence: 3)

**P2**: Established domain jargon (untrusted input, sensitive sink) can replace multi-word descriptive phrases without detection loss and may reduce false positives by increasing precision of the prompt. (evidence: 2)

**P3**: Calibration anchors — concrete API names, specific identifiers, domain-specific terms — must be preserved through compression. They are the tokens that drive detection; surrounding prose is expendable. (evidence: 1)

**P4**: Questions under ~28 tokens with temporal/async semantics are near their compression floor. Temporal ordering words (before, after, await, concurrent) carry detection weight disproportionate to their token cost. (evidence: 4 — Q3, Q4, Q6, Q7 confirmed)

**P5**: Sentence merging and compound predicates are reliable structural wins (18-21% savings). When two criteria share scope, merge them — the sentence boundary tokens are pure overhead. (evidence: 3)

## Compression Guidance
<!-- Updated by Step 4 each run. Read by Step 1 compression agents. -->

Prioritize removing consequence tails, interrogative framing, and filler adjectives first (safest wins). Then attempt sentence merging and domain jargon substitution. Always preserve concrete API names and domain identifiers as calibration anchors. Avoid compressing questions already under 28 tokens, especially those with temporal/async semantics — they are likely at their floor.

## Recent Observations
<!-- Rolling window: last 50. Oldest pruned each run. Format: [O] Q-ID: ... -->

[O] Q3-r2: win 23.1% — "swallowed, losing...or silencing" shorter than "swallowed in ways that lose...or convert...into silent ones". Pattern: PARTICIPLE_REWRITE. Detection: 3tp→3tp across 2 fixtures (previously failed in pass 1 with different compression).

[O] Q8-r2: QUALITY IMPROVEMENT 9.5% — "Stale state migration handled?" caught GAS-STALE-1 that "Schema migration handled for stale persisted state?" missed. Pattern: SHORTER_PHRASING_BETTER_DETECTION (rare). Hypothesis: terser phrasing focused reviewer on "stale state" broadly rather than narrowly on "schema migration".

[O] Q1-r2: loss — optimized missed MIXED-ADV-2 (inconsistent return types). Reviewer found range validation instead. Pattern: SEMANTIC_DRIFT at 12.8% compression. The change from "Are there code paths that produce" to "Any paths with" may have subtly shifted reviewer focus.

[O] Q5-r2: loss — judge ruled OVER-1 missed due to line proximity despite correct semantic match. Pattern: JUDGE_NOISE at marginal compression levels.

[O] Q4-r2: AT_FLOOR at 25 tokens. Q6-r2: AT_FLOOR at 15 tokens. Q7-r2: AT_FLOOR at 15 tokens.

[O] Q1: STRUCTURAL win 23.2% — removed generic consequence phrase "bugs concentrate in the inputs developers don't test". Pattern: TRIM_CONSEQUENCE. Detection: 4tp→4tp, 0 regression.

[O] Q2: STRUCTURAL win 21.4% — replaced "user-controlled data"→"untrusted input", "sensitive operation"→"sensitive sink", removed "adequate". Pattern: DOMAIN_JARGON_SUB. Detection: 2tp→2tp, opt had fewer fp.

[O] Q3: loss 0% — attempt 1 regressed on ASYNC-1 per judge; attempt 2 all variants longer. Pattern: FLOOR_RESISTANCE at 27 tokens with async semantics.

[O] Q4: RADICAL win 18.5% — removed "Are there...that" framing, converted relative clause to noun phrase. Pattern: STRIP_INTERROGATIVE. Detection: 3tp→3tp, 0 regression.

[O] Q5: STRUCTURAL win 20.4% — collapsed two sentences into one unified criterion. Pattern: SENTENCE_MERGE. Detection: 3tp→3tp, both missed MIXED-ADV-1 (pre-existing gap).

[O] Q6: STRUCTURAL win 20.3% — merged two yes/no questions into single compound predicate. Pattern: COMPOUND_PREDICATE. Detection: 3tp→3tp, 0 regression.

[O] Q7: RADICAL win 32.6% — simplified to two terse questions, highest savings in batch. Pattern: TERSE_ENUMERATION. Detection: 1tp→1tp, 0 regression.

[O] Q8: SEMANTIC win 24.0% — compressed to terse GAS idioms while preserving API name anchors. Pattern: PRESERVE_CALIBRATION_ANCHORS. Detection: 1tp→1tp, opt had fewer fp.
