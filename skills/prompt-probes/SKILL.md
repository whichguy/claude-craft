---
name: prompt-probes
description: |
  Generate boundary-testing inputs for any prompt using two-pass diagnostic analysis.
  Pass 1 (P1-P4) comprehends intent and contracts. Pass 2 (P5-P7) maps decision
  boundaries in depth. Then generates probes that sit on those boundaries — designed
  to discriminate between prompt versions when used with /improve-prompt.
  Iterative: subsequent runs detect prompt changes, read existing probes, evaluate
  coverage, and offer add/modify/delete operations.

  AUTOMATICALLY INVOKE when:
  - "generate probes", "create probes", "prompt probes"
  - "test inputs for improve-prompt", "boundary test inputs"
  - "stress test this prompt", "probe this prompt"

  NOT for: Running improve-prompt itself (use /improve-prompt)
argument-hint: "<prompt-file> [output-dir] [--count N] [--feedback-dir PATH]"
allowed-tools: Agent, Bash, Read, Glob, Write
---

# prompt-probes Skill

Two-pass diagnostic analysis of any prompt, then generation of boundary-testing inputs ("probes")
that maximally discriminate between prompt versions when used with `/improve-prompt`.

Pass 1 (P1-P4): foundational comprehension — task, input/output contracts, success criteria.
Pass 2 (P5-P7): deep decision boundary mapping — the core analytical work.
Failure modes (P8-P11) and coverage (P12) derive from the boundary map.
Subsequent runs are iterative with staleness detection and optional discrimination feedback.

---

## Step 0 — Parse Arguments

Extract from `$ARGUMENTS` (free-form text):

| Parameter | Required | Default | Notes |
|-----------|----------|---------|-------|
| `prompt_path` | yes | — | Target prompt file to analyze |
| `output_dir` | no | `skills/<name>/probes/` if target is a SKILL.md; else `<prompt-dir>/probes/` | Where to write probes and analysis |
| `count` | no | 5 | Number of probes to generate (range 1-10) |
| `feedback_dir` | no | — | Path to improve-prompt results for discrimination feedback |

**Validation:**
- `prompt_path` must exist (Read it to verify)
- Clamp `count` to range [1, 10]
- Create `output_dir` if it does not exist: `mkdir -p {output_dir}` — if this fails, stop and report: `"Cannot create output directory: {output_dir}"`

**Staleness detection:**
If `{output_dir}/analysis.md` exists:
1. Read its YAML frontmatter and extract `prompt_hash`
2. Compute current hash: `md5 -q {prompt_path} 2>/dev/null || md5sum {prompt_path} 2>/dev/null | awk '{print $1}'`
3. If hashes differ → print `"Prompt changed since last analysis — re-running diagnostic."` and treat as first run for analysis (but preserve existing probes for inventory in Step 3)
4. If hashes match → read the full `{output_dir}/analysis.md` content into context as `p1_p12_cached` (the P1-P12 findings section after the frontmatter), then skip Steps 1-2 and jump to Step 3 (inventory mode). Step 3's P8-P12 synthesis must use `p1_p12_cached` as source data.

If `{output_dir}/analysis.md` does not exist → first run, proceed to Step 1.

---

## Step 1 — Pass 1: Prompt Comprehension (P1-P4)

Spawn a **general-purpose** agent. Give it the target prompt content and instruct it to also read
the prompt's primary referenced files (cap at 5 supporting files — look for file paths, includes,
imports, or references in the prompt text).

The agent must answer these four foundational questions:

### P1 — Primary Task

- What is the core task this prompt performs? Classify as one of: classify, evaluate, generate, transform, route, orchestrate, or hybrid.
- What category of prompt is this? One of: skill definition, agent definition, system prompt, task prompt, evaluator, or other (specify).

### P2 — Input Contract

- What input does the prompt expect? Describe: format, structure, domain, size range, required fields.
- What does a **minimal valid input** look like? (Sketch the smallest input that should work.)
- What does a **maximal valid input** look like? (Sketch the largest/most complex realistic input.)

### P3 — Output Contract

- What does the prompt produce? Describe: format, possible values, rating scales, categories, action items.
- What does "good output" look like? (Concrete example characteristics.)
- What does "bad output" look like? (Concrete failure characteristics.)

### P4 — Success Criteria

Define correctness along four axes:
- **Accuracy**: Did it reach the right conclusion?
- **Completeness**: Did it cover everything it should?
- **Calibration**: Did it apply the right severity/rating/weight?
- **Specificity**: Did it give actionable, concrete output (not vague)?

**Agent instructions:**
```
Read the target prompt at {prompt_path}. Also read up to 5 files it references (look for
file paths, includes, imports, skill references in the prompt text). Then answer P1-P4
as defined above. Be concrete and specific — cite prompt text where possible.

Return your findings in this exact structure:

## P1 — Primary Task
[findings]

## P2 — Input Contract
[findings]

## P3 — Output Contract
[findings]

## P4 — Success Criteria
[findings]

## Referenced Files Read
[list of files you read beyond the target prompt]
```

**Output:** structured P1-P4 findings (save in a local variable for Step 2).

---

## Step 2 — Pass 2: Decision Boundary Mapping (P5-P7)

This is the core analytical work. Spawn a **separate** general-purpose agent with the P1-P4
findings as context. This agent gets full attention on the three hardest questions — no dilution
from other concerns.

Instruct the agent to read the target prompt again AND all files it references (up to 5).
For each question, produce exhaustive, concrete output.

### P5 — Decision Points

Enumerate **every** place the prompt makes a judgment call. For each decision point:

- **Name** the decision (e.g., "IS_GAS classification", "severity rating", "route to agent vs inline")
- **Outcomes**: list all possible outcomes (e.g., "true / false", "READY / REWORK / REJECT")
- **Prompt basis**: quote the specific prompt text that defines this decision
- **Difficulty**: how hard is this decision for an LLM to get right? (easy / moderate / hard)

### P6 — Decision Signals

For each P5 decision point:
- What **input features** drive the decision toward each outcome?
- What is the **minimum set of signals** needed to trigger each outcome?
- What signals are **ambiguous** (could drive toward multiple outcomes)?

### P7 — Boundary Zones

For each P5 decision point, describe the **exact boundary** between adjacent outcomes:
- What would an input look like that sits **exactly on the border**?
- What **single feature**, if added or removed, would **flip the decision**?
- Write a 1-2 sentence **boundary scenario** — a challenging test case
- Rate how likely the prompt is to get this boundary wrong: low / medium / high

**Agent instructions:**
```
You are performing deep decision boundary analysis of a prompt.

Context from Pass 1 (P1-P4):
{p1_p4_findings}

Read the target prompt at {prompt_path} and up to 5 files it references.
Then answer P5, P6, and P7 as defined above. Be exhaustive — enumerate EVERY
decision point, not just the obvious ones.

Return findings using this exact format per decision point:

### Decision: [name]
Outcomes: [list]
Prompt basis: "[quoted text from prompt]"
Difficulty: [easy/moderate/hard]

Signals → [outcome A]: [feature list]
Signals → [outcome B]: [feature list]
Ambiguous signals: [features that could go either way]

Boundary scenario: [1-2 sentence description of a borderline input]
Flip feature: [the single element that would change the outcome]
Error likelihood: [low/medium/high]
```

**Output:** structured P5-P7 findings (save for Step 3).

---

## Step 3 — Derive Failure Modes & Probe Plan (P8-P12)

This step runs **inline** (not a separate agent) — it is synthesis of the P5-P7 analysis.

### P8 — False Positive Traps

For each **high/medium** error-likelihood boundary from P7: describe an input that **looks
problematic but is actually correct**. Derived from P7 boundary scenarios + P6 ambiguous signals.

### P9 — False Negative Traps

For each **high/medium** error-likelihood boundary from P7: describe an input that **looks fine
but has real issues**. Derived from P7 flip features.

### P10 — Calibration Traps

Where might the prompt **over-react or under-react**? Derived from P5 difficulty ratings + P4
success criteria axes. Focus on severity/rating mismatches.

### P11 — Adversarial Inputs

What inputs **exploit the prompt's wording or assumptions**? Derived from P6 ambiguous signals
+ P7 high error-likelihood boundaries. Think: edge cases the prompt author didn't anticipate.

### P12 — Output Path Coverage

List every distinct **output path** from P5. Which paths are **hard to trigger**? Which paths
have **no existing probe** coverage? Derived directly from P5 decision points.

### Build Probe Plan

Prioritize by P7 error likelihood:
1. **High** error-likelihood boundaries → boundary probes (first priority)
2. **Medium** error-likelihood boundaries → boundary probes (second priority)
3. **Uncovered output paths** → baseline probes
4. **P11 adversarial scenarios** → adversarial probes

Assign each planned probe:
- **Target boundary**: which P7 boundary scenario it tests
- **Difficulty**: baseline / boundary / adversarial
- **Generation guidance**: what features to include/exclude, what subtlety to aim for, what the "flip feature" is

### Probe Inventory (subsequent runs only)

If existing probes are found in `output_dir`:
1. Read existing probes (cap at 20 most-recent by filename sort)
2. For each, classify which P5 decision points and P7 boundaries it exercises
3. Compare against probe plan to find gaps

### Discrimination Feedback (when `feedback_dir` provided)

If improve-prompt results are available at `feedback_dir`:
1. Read result files to identify per-probe discrimination scores
2. Classify each existing probe:
   - **Non-discriminating**: all prompt variants scored the same → recommend replacing with sharper boundary probes
   - **Highly discriminating**: variants scored very differently → keep, these are valuable
   - **No feedback**: probe not yet tested → neutral
3. Print per-probe assessment

### Present Inventory & Recommendations

Display to the user:
```
Existing probes (N found):
  probe-1-slug.md     → [boundary tags]  [difficulty]  {✓ discriminating | ✗ non-discriminating | — no feedback}
  ...

Gaps (from P7 high/medium error-likelihood):
  - [boundary name]  [difficulty, error-likelihood]
  ...

Recommendations:
  ADD: N probes (list with slugs and target boundaries)
  MODIFY: N probes (list with reasons)
  DELETE: N probes (list with reasons)
```

**Ask user to confirm or adjust before proceeding to Step 4.**

---

## Step 4 — Generate Probes

After user confirmation, dispatch a **general-purpose** agent with:
- Full target prompt content + referenced supporting files (up to 5)
- P1-P4 comprehension + P5-P7 boundary map (the structured analysis)
- Probe plan with per-probe generation guidance from Step 3
- Existing probe contents for style matching (limit to 10 most-recent files)

### Per-Probe Generation Template

The agent receives one of these per probe to generate:
```
Probe N: [slug]
  Target boundary: [P7 boundary scenario name]
  Difficulty: [baseline/boundary/adversarial]
  Flip feature: [the element that makes this borderline]
  Include: [features that push toward outcome A]
  Exclude: [features that would make it obviously outcome B]
  Subtlety goal: [what makes this probe hard to judge correctly]
  Style reference: [existing probe filename to match tone/structure, if available]
```

### Constraints

- **Raw content only** — each probe must look like a realistic input a user would actually provide to the target prompt. No meta-commentary, no "this tests X" headers, no test labels.
- **Single-file probes**: `probe-{N}-{slug}.md` naming convention. N continues from highest existing probe number (leave gaps from deletions).
- **Multi-file probes**: `probe-{N}-{slug}/` directory. Use only when the target prompt expects multiple input files. This is rare.
- **Size**: 20-80 lines per file, max 50KB.
- **Boundary probes must be subtle** — the difficulty comes from nuance, not from being obviously broken or obviously perfect. A good boundary probe makes a skilled human hesitate before deciding.

- **Single-deficiency rule**: Each probe must embed exactly ONE primary deficiency.
  Multiple deficiency types in one probe make attribution impossible when a prompt
  change improves one but not the other. If a plan naturally has two issues, choose
  the more load-bearing one and neutralize the other.

- **Discrimination criterion**: Each probe must have a stated criterion for success:
  "probe worked = target question NEEDS_UPDATE, all Gate 1 questions PASS". Include
  this as a comment in the probe plan output (Step 3 Build Probe Plan).

- **Gate 1 calibration probes**: For Gate 1 questions (Q-G1, Q-G11), always pair
  each NEEDS_UPDATE probe with a PASS calibration probe. Gate 1 questions are
  high-stakes — over-triggering NEEDS_UPDATE wastes author time and undermines trust.
  A calibration probe has a sound approach (well-reasoned, evidence-backed) and
  must produce Q-G1=PASS from any correct reviewer.

### Operations

- **ADD**: agent writes new probe files to `output_dir`
- **MODIFY**: agent reads the existing probe, applies the modification guidance, writes back
- **DELETE**: remove the file (leave numbering gaps)

The agent must end its response with this marker:
```
PROBES_GENERATED: {N} added, {M} modified, {D} deleted
```

---

## Step 5 — Persist Analysis & Report

### Persist Analysis

Write the full P1-P12 findings to `{output_dir}/analysis.md` with this frontmatter:
```yaml
---
prompt_path: {prompt_path}
prompt_hash: {md5_hash}
generated: {ISO date, e.g. 2026-03-16}
probe_count: {total probes in output_dir after this run}
---
```

Followed by the complete P1-P12 structured findings. On subsequent runs this file is read first
and only regenerated if the prompt hash has changed.

### Report

After everything is written, display:

1. **Probe listing**: all probes (existing + new) with line counts and boundary tags
2. **Decision point coverage matrix**: which P5 decision points have probes, which don't
3. **Difficulty distribution**: N baseline, M boundary, K adversarial
4. **Next step**: `Try: /improve-prompt {prompt_path} {output_dir}`
