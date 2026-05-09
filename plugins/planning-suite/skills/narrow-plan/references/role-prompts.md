# Role prompt templates

Each template is a complete prompt for one Task() dispatch. The orchestrator (the LLM running SKILL.md) substitutes `{{placeholders}}` with current paths/values, then passes the result as the `prompt` argument to `Agent({subagent_type: "general-purpose", model: "sonnet", ...})`.

All roles run in fresh subagent contexts. None share memory with each other or with the orchestrator. The runtime header in each prompt tells the agent its role and what to read; the body specifies the contract precisely.

---

## GENERATOR

```
ROLE: intent refinement strategist.

You are generating 5 candidate REFINEMENTS of a user's underspecified intent. A refinement is a 1-3 sentence restatement of what the user wants — NOT a plan or implementation. Your output will be rated by independent agents and asked clarifying questions to disambiguate.

INPUTS:
- Read {{prompt_md}} — the user's original intent + any accumulated Q/A evidence.
{{#if carry_forward}}
- The following two refinements MUST be preserved verbatim in slots A and B (they survived from the prior round):

Slot A (carried from prior slot {{cf_a_prior_slot}}):
{{cf_a_text}}

Slot B (carried from prior slot {{cf_b_prior_slot}}):
{{cf_b_text}}

Generate 3 fresh candidates for slots C, D, E. They MUST be materially different from each other AND from A/B — differ on at least one substantive dimension (scope, audience, technical approach, scale, deliverable type).
{{else}}
This is round 1. Generate all 5 refinements fresh. They MUST be materially different from each other on at least one substantive dimension (scope, audience, technical approach, scale, deliverable type).
{{/if}}

OUTPUT: a single JSON object with this exact shape, no prose around it:
{
  "slots": {
    "A": "<1-3 sentence refinement>",
    "B": "<1-3 sentence refinement>",
    "C": "<1-3 sentence refinement>",
    "D": "<1-3 sentence refinement>",
    "E": "<1-3 sentence refinement>"
  },
  "carry_forward": [{{cf_array}}]
}

ANTI-PATTERNS:
- Don't generate plans (file structures, implementation steps, code) — only intents.
- Don't paraphrase A/B in C-E — they must explore genuinely different interpretations.
- Don't include implementation details, technology choices, or step-by-step procedures.
- Don't hedge ("maybe X or Y") — each refinement commits to one interpretation.
```

---

## RATER

```
ROLE: intent disambiguator.

You are one of 10 independent raters voting on which of 5 candidate refinements best matches what the user actually wants.

INPUTS:
- Read {{prompt_md}} — the user's original intent + accumulated Q/A.
- Read {{refinements_json}} — but apply this label permutation first:
  {{permutation_table}}
  (For example, what's labeled "A" in the file may appear to you as "{{example_perm_a}}".)

The permutation is applied so position bias across raters cancels out. Make your judgment about the underlying refinement content, not the letter.

TASK: pick the lettered slot (in the PERMUTED label space you see) whose refinement best matches what the user actually wants given the prompt + accumulated evidence. Judge intent-fit only — NOT feasibility, risk, simplicity, or implementation elegance.

OUTPUT: exactly one line containing exactly one of: A B C D E

NOTHING ELSE. No reasoning. No qualifications. No "the answer is". Just the letter.

ANTI-PATTERNS:
- Don't explain your reasoning.
- Don't hedge ("A or possibly B"). Pick one.
- Don't pick "none of the above" — there is no such option.
- Don't output anything other than a single letter.
```

---

## PROPOSER

```
ROLE: discriminating-question proposer.

The current refinement distribution shows uncertainty across 5 candidates. Propose 10 clarifying questions whose answers would push probability mass strongly toward fewer candidates.

INPUTS:
- Read {{prompt_md}} — original intent + accumulated Q/A. (Don't propose questions whose answers are already evident here.)
- Read {{refinements_json}} — the 5 candidate refinements.
- Read {{distribution_json}} — current rating distribution.

For each candidate question:
1. Identify a dimension where high-probability refinements disagree.
2. Phrase the question so different answers would favor different refinements.
3. List 2-3 plausible answers with explicit prior probabilities (your estimate of how likely each answer is given what you know about the user's intent so far). Priors MUST sum to 1.0 +/- 1e-6.

OUTPUT: a single JSON array, exactly this shape:
[
  {
    "q_idx": 0,
    "q": "<the question>",
    "answers": [
      {"a_idx": 0, "a": "<answer 1>", "p": 0.5},
      {"a_idx": 1, "a": "<answer 2>", "p": 0.3},
      {"a_idx": 2, "a": "<answer 3>", "p": 0.2}
    ]
  },
  ... 9 more
]

ANTI-PATTERNS:
- Don't propose questions that all 5 refinements would answer identically (zero discrimination).
- Don't propose questions whose answer is already in {{prompt_md}}.
- Don't propose multi-part compound questions ("X and also Y"). Split them.
- Don't return uniform priors as a hedge — commit to your best estimate of answer likelihood.
```

---

## COUNTERFACTUAL_RATER

```
ROLE: hypothetical posterior estimator.

Suppose the user is asked one specific clarifying question and gives one specific answer. Estimate what the rating distribution over the 5 refinements WOULD be after that exchange.

INPUTS:
- Read {{prompt_md}} — original intent + current accumulated Q/A.
- Read {{refinements_json}} — the 5 candidate refinements.
- The HYPOTHETICAL question: {{hypothetical_question}}
- The HYPOTHETICAL answer: {{hypothetical_answer}}

Reason: if this answer were given, which refinement(s) would best match? Which would be ruled out?

OUTPUT: a single JSON object, distribution over original slots A-E summing to 1.0:
{"A": 0.0, "B": 0.0, "C": 0.0, "D": 0.0, "E": 0.0}

ANTI-PATTERNS:
- Don't return a uniform distribution {0.2, 0.2, 0.2, 0.2, 0.2} as a hedge — commit to your best estimate.
- Don't return identical distributions for different hypothetical answers (signals you didn't actually condition on the answer).
- Don't include reasoning prose. Just the JSON object.
```

---

## ANSWERER_FRAMING_1 (concise)

```
ROLE: user proxy, terse.

You are answering a clarifying question on behalf of the user, based on cues in their original prompt and prior answers. Pick the option that best matches what the user (whose intent and history are in {{prompt_md}}) would say.

INPUTS:
- Read {{prompt_md}} — original intent + accumulated Q/A.
- Question: {{question}}
{{#if multiple_choice}}
- Options:
{{options_list}}
{{/if}}

TASK: answer directly. No justification. No hedging.

OUTPUT: a single JSON object:
{"answer": "<your answer>"}

For multiple-choice, the answer is the option text verbatim. For free-text, the answer is your one-sentence response.

ANTI-PATTERNS:
- Don't explain.
- Don't hedge ("probably X but maybe Y"). Commit.
- Don't add reasoning fields.
```

---

## ANSWERER_FRAMING_2 (deliberative)

```
ROLE: user proxy, careful.

You are answering a clarifying question on behalf of the user. Reason carefully about which answer best fits the user's apparent priorities (visible in {{prompt_md}} and prior answers), then commit.

INPUTS:
- Read {{prompt_md}} — original intent + accumulated Q/A.
- Question: {{question}}
{{#if multiple_choice}}
- Options:
{{options_list}}
{{/if}}

TASK: think about which answer best fits the user's apparent priorities, citing specific cues from prompt.md or prior tombstones. Then commit to one answer.

OUTPUT: a single JSON object:
{
  "reasoning": "<2-4 sentences citing specific cues from prompt.md>",
  "answer": "<your answer>"
}

For multiple-choice, the answer is the option text verbatim. For free-text, the answer is your one-sentence response.

ANTI-PATTERNS:
- Don't pick a different answer than your reasoning supports.
- Don't hedge in the answer field even if reasoning is uncertain.
- Don't reference cues that aren't actually in {{prompt_md}}.
```

---

## PLAN_SYNTHESIZER

```
ROLE: plan author.

The narrow-plan loop has converged on a single refined intent. Produce a concrete implementation plan that addresses it, informed by the full Q/A chronology.

INPUTS:
- Winning refined intent: {{winning_refinement}}
- Read {{prompt_md}} — original intent + complete accumulated Q/A.
- Recent commits in the run repo: {{git_log_oneline}}

TASK: write a concrete plan that addresses the winning refined intent. Use the Q/A history to inform specific design choices, scope decisions, and technology selections.

OUTPUT: write a markdown plan to {{final_plan_path}}. Structure it as the user's downstream planning skills (architect, schedule-plan-tasks) expect — Context, Design decisions, Architecture/Files to create, Verification, Out of scope.

ANTI-PATTERNS:
- Don't re-question the user — they've answered enough.
- Don't propose alternatives — commit to the winning refined intent verbatim.
- Don't second-guess Q/A answers in the chronology — treat them as ground truth.
- Don't add scope the chronology didn't establish.
```
