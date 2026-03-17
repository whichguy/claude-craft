# Position-Blind LLM Judge Pattern

Canonical reference for the position-blind LLM judge pattern used in benchmarking skills
(`/improve-system-prompt`, `/ideate-system-prompt`, etc.).

---

## The Core Constraint

**The judge must never see internal identifiers.** The judge only sees randomized labels
(A, B, C, …). The skill owns the mapping from label → internal ID and performs the remap
after parsing the judge's response.

Violating this constraint by including `ideaId`, variant names, or placement labels in the
judge prompt introduces position bias and defeats blind evaluation.

---

## Pattern (per scenario)

### Step 1 — Build label map (before spawning judge)

```
labelMap = {}         // label → internal config key
reverseMap = {}       // internal config key → label

configs = [all configs for this scenario, in any order]
shuffle(configs)      // randomize order to remove position bias

labels = ['A', 'B', 'C', 'D', ...]   // extend as needed: configs.length labels
for i, config in enumerate(configs):
  label = labels[i]
  internalKey = config.ideaId  // or (contentVariant + '/' + placement), etc.
  labelMap[label] = internalKey
  reverseMap[internalKey] = label
```

**Label cardinality**: `labels.length` must equal `configs.length`. If there are N ideas + 1
baseline, use N+1 labels. Never hardcode A/B/C/D — derive from actual config count.

### Step 2 — Build judge prompt (using labels only)

The judge prompt must contain:
- The test message and `validates` criterion
- Each config shown under its label only — no ideaId, no variant name in the prompt
- A scoring rubric
- A JSON response format that returns labels, not IDs

```
Configurations:
[A]
Heuristic composite: 7.4/10
Response:
---
<response text>
---

[B]
...

Score each configuration on 5 dimensions (1-5):
...

Return ONLY valid JSON:
{
  "judgments": {
    "A": {"accuracy": X, "helpfulness": X, "safety": X, "toolUse": X, "conciseness": X},
    "B": {...},
    ...
  },
  "winner": "A",
  "reasoning": "1-2 sentence explanation"
}
```

### Step 3 — Remap after parsing

```
judgeResult = parse(judgeResponse)

// Remap winner label → internal key
judgeResult.winner_key = labelMap[judgeResult.winner]

// Remap all judgment scores → internal keys
judgeResult.judgments_by_key = {}
for label, scores in judgeResult.judgments:
  internalKey = labelMap[label]
  judgeResult.judgments_by_key[internalKey] = scores
```

Store `judgments_by_key` keyed by internal ID for aggregation. Never aggregate by label —
label assignment is randomized per scenario.

---

## Score Normalization

Judge dimensions are typically 1–5 scale. Normalize to 0–10 for compatibility with
heuristic composite scores:

```
raw_avg = mean(accuracy, helpfulness, safety, toolUse, conciseness)  // 1.0–5.0
judge_score_0_10 = (raw_avg - 1) / 4 * 10                           // 0.0–10.0
```

Do NOT use `raw_avg * 2` — that maps [1, 5] → [2, 10], making the minimum non-zero
and inflating low-quality scores.

---

## Error Handling

- **JSON parse failure**: retry once with "return ONLY the JSON object, no prose, no markdown fence"
- **Second parse failure or timeout (30s)**: skip this scenario from judge aggregation; note the gap in the final output
- **Partial judge coverage**: acceptable — aggregate over successfully judged scenarios only; note coverage % in output
- **Missing label in judgments**: treat as failed judge for that config in this scenario

---

## Aggregation Formula

```
// Per config, across all judged scenarios:
judge_avg = mean(judge_score_0_10)  for scenarios where judge succeeded

// Unified score:
unified = 0.6 × heuristic_avg + 0.4 × judge_avg

// If judge entirely unavailable for a config:
unified = heuristic_avg   // note [judge N/A] in output table
```

---

## Usage in Skills

| Skill | Configs judged | Scenarios judged |
|-------|---------------|-----------------|
| `/improve-system-prompt` | variant × placement tuples | all --scenarios |
| `/ideate-system-prompt` | ideas + baseline | standard scenarios only (targeted tests are heuristic-only) |

When adding a new skill that uses this pattern, reference this file in the skill's Step 4
rather than re-deriving the pattern inline.
