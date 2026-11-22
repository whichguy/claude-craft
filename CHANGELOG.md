# Changelog

## 2026-11-22 — plan-review gates: the investigation stage is removed (planning-suite 0.4.0)

The `ExitPlanMode` unknowns gate now does one thing: it denies until the plan has an `## Open Unknowns` section (a Codex audit when the Codex CLI is available, a generic instruction when it is not). The second stage, which denied a plan that tagged a bullet `[investigate]` until `/investigate-plan` had run or the user waived it, is gone: its deny text sent every user to a command that exists only with the Hermes container. The handlers are synced from `hermes-skills-marketplace` `plan-review` 0.2.0 (its pull request #4), their canonical home, so the manifest drift check matches again.

### Removed capabilities

- **planning-suite** — in `handlers/plan-unknowns-gate.py`: the investigation stage, the `needs-investigation` sentinel, the `[investigate]` tag handling and the paragraph of the Codex prompt that taught it, the `CLAUDE_PLAN_INVESTIGATE` advisory, `INV_CONTAINER` with the container probe, and the `/investigate-plan` pointers in the stage-one messages. In `handlers/plan-worktree-gate.py`: its deferral to that stage. In `handlers/plan-review-cleanup.py`: `KINDS` keeps only `worktree-assessed`. Migration: a plan that tags a bullet `[investigate]` is now treated like any other bullet, `CLAUDE_PLAN_INVESTIGATE` is ignored, and investigation sentinels left in `~/.claude/plans` by earlier versions are harmless and are no longer removed.

### Notes

- The two gate suites follow the hub: the `[investigate]` cases now pin that the tag neither defers the gate nor writes a sentinel, and the slug cases that belonged to the removed stage are gone with it. This repository's hermetic `CLAUDE_PLAN_*` unset at the top of both suites is kept.
- `hooks/hooks.json` describes the one remaining stage. The 900 s hook timeouts are unchanged.

## 2026-11-19 — remaining model pins moved to the 5.5 generation (gas-suite 0.2.2, slides-suite 0.1.1, wiki-suite 0.3.1)

The three plugins the earlier 5.5 entry below left on Claude 4.x now name the 5.5 models: 19 pins in 17 files.
`claude-sonnet-4-6` → `claude-sonnet-5-5` (gas-suite 12, slides-suite 2, wiki-suite 2), and `claude-haiku-4-5-20251001`
or `claude-haiku-4-5` → `claude-haiku-5-5` (gas-suite 1, wiki-suite 2). No plugin in this repository pins a 4.x model
any more.

### Changed behaviour

- **wiki-suite** — `proactive-research-driver.sh` calls the Messages API directly, so the swap needed more than the ID.
  Haiku 5.5 thinks by default and thinking counts toward `max_tokens`; a reply can begin with a `thinking` block. The
  classifier request now sends `max_tokens: 2000` (was 400) and `output_config: {effort: "low"}`, and the handler reads
  the first `text` block by type instead of `.content[0].text` (which is empty when a thinking block comes first, so
  the classifier would never have found a prompt worth researching).
- **wiki-suite** — the `WIKI_WORKER_MODEL` and `WIKI_LINT_MODEL` defaults are `claude-haiku-5-5` and
  `claude-sonnet-5-5`. With the c-thru proxy, `~/.claude/model-map.json` must have entries for the new names.

### Notes

- The direct API call was not run live (no `ANTHROPIC_API_KEY` on the machine that made the change); the request body
  and the reply parsing were checked against recorded reply shapes.

## 2026-11-19 — test-prompt-harness judge runs without tools and returns a validated verdict; schedule nudge repointed (planning-suite 0.3.3)

A review of `test-prompt-harness` after the parsing fix below. Measurements are in
`docs/experiments/test-prompt-harness-judge-parsing-2026-11-19.md` (rounds R4 to R7).

### Changed behaviour

- **The judge has nothing to act with.** `bin/judge-runner.js` ran the judge as a full Claude Code session: 477 tools
  with permissions bypassed, 79 MCP servers and 337 skills, reading text another model wrote. It now runs with its own
  grader system prompt, `--tools ""`, `--disable-slash-commands`, `--strict-mcp-config` and `--no-session-persistence`:
  0 tools, 0 MCP servers, 0 skills, and no saved session. A graded text that told the judge to answer PASS was graded
  FAIL in 12 of 12 live trials.
- **A judge call costs about a ninth.** Input drops from about 70,000 tokens to about 7,000 before the graded text;
  per call about $0.001 on Haiku 5.5 (was $0.0088) and $0.013 on Haiku 4.5 (was $0.064).
- **The verdict is validated by the CLI.** The judge replies through `--json-schema`, and the runner reads
  `structured_output`. Before, 2 of 18 Haiku 5.5 replies were invalid hand-written JSON (unescaped quotes), which the
  runner reports as FAIL; with the schema 36 of 36 parsed. The reply text is still parsed when no object is present.
- **Rubrics state the rule only.** The reply format now comes from the harness. Rubrics that end with "Output ONLY a
  JSON object …" still work. The SKILL.md example is reworded: Haiku 4.5 read "must contain a single line" as "the
  output must be one line" (0/3 on a passing case) and "must contain a line that reads exactly" correctly (3/3).
- **Checks on `thinking` fail loudly on Claude 5.x subjects.** 5.x models stream thinking blocks with empty text, so
  `views.thinking` rows and `semantic` rows on `thinking` graded an empty string (`must_not_include` always passed).
  Those rows now return FAIL with "thinking text unavailable", and the judge is not called for them. Migration: grade
  `assistant_text` or `result` for a 5.x subject.
- **Grading is no longer cut off mid-judge.** `run-bench.js` allowed grading a fixed 60 s; it now allows 60 s plus the
  fixture's `timeout_seconds` per `semantic` row, and reports a killed grader instead of failing on a missing
  `grade.json`.

- **`Execute: schedule` no longer points at a retired skill.** The ExitPlanMode nudge told Claude to run
  `/skill-craft:backchain` and then `/skill-craft:plan-dispatcher`. Backchain was retired on 2026-11-16 (skill-craft
  2.43.0), so the first step named a skill that does not exist. The nudge now says to write the approved plan's steps
  as a dependency graph in the format Plan Dispatcher's protocol describes (a task, a ready contract and a done
  contract per step), then run `/skill-craft:plan-dispatcher`. `Execute: inline` and `Execute: ask` are unchanged.

### Notes

- A missing `claude` binary is reported as "judge could not start: ENOENT …" instead of "judge exit=null".
- SKILL.md no longer says costs are written to `run.meta.json` (they never were; a replica's cost is in its stream's
  terminal `result` event) and counts five scripts, not four.
- `golden-judge-result.json` is re-captured with the new invocation.

## 2026-11-19 — test-prompt-harness judge reads the CLI's single result object (planning-suite 0.3.2)

`test-prompt-harness`' `bin/judge-runner.js` parsed the stdout of `claude -p --output-format json` as an array of events.
Without `--verbose` that command prints one result object (`claude --help` describes `json` as "single result"). So
every `semantic` pass condition returned FAIL with "judge stdout was not a JSON array (top-level type=object)", whatever
the judge model or the graded output. The runner now reads the single result object, and still reads the event array
that `--verbose` prints.

### Notes

- The unit tests missed this because the only judge golden, `golden-judge.json`, had been captured with `--verbose`. A
  second golden, `golden-judge-result.json`, is recorded with the runner's exact arguments (`claude` 2.1.328, Haiku 5.5).
- The gated live suite (`RUN_LLM_BENCH=1`, fixture `smoke-echo`) now passes 16/16, including its semantic row.
- Rubric wording matters for the judge. With the SKILL.md example rubric (no explicit PASS/FAIL rules), Haiku 4.5
  failed all 3 passing cases: it applied the rubric's "Output ONLY a JSON object" line to the graded output. Haiku 5.5
  got 6/6 right. The `smoke-echo` rubric, which spells out when to PASS and FAIL, passes on Haiku 4.5.

## 2026-11-19 — model pins moved to the 5.5 generation (planning-suite 0.3.1, review-suite 0.2.8, review-bench 0.3.1, gas-suite 0.2.1)

Every Claude 4.x model ID in planning-suite, review-suite and review-bench now names its 5.5 counterpart:
`claude-sonnet-4-6` → `claude-sonnet-5-5`, `claude-opus-4-6` and `claude-opus-4-7` → `claude-opus-5-5`, and
`claude-haiku-4-5-20251001` → `claude-haiku-5-5` (50 replacements in 18 files). The old models are still served, so
nothing was broken; at API list prices they cost 1.25x (Opus), 1.5x (Sonnet) and 10x (Haiku) as much per token as their
5.5 equivalents.

### Changed defaults

- **review-bench** — the judge agents `question-bench-judge` and `review-plan-ablation-judge` (were `claude-opus-4-7`),
  the default `judge_model` / `research_model` of `question-bench`, `derive-questions`, `optimize-questions`,
  `improve-prompt` and `optimize-system-prompt` ideate mode (were `claude-opus-4-6`), and `compare-questions`'
  `apply_model` / `judge_model` (were `claude-sonnet-4-6`). **Bench scores produced with the new judges are not
  comparable with earlier results** (the last committed ones are from 2026-05-09). To reproduce an earlier score, pass
  the old judge explicitly (`--judge-model claude-opus-4-6`).
- **review-bench** — `prompt-comparator`, `optimize-system-prompt` and the ideate-mode benchmark and ideation models.
- **planning-suite** — `node-plan` and its evaluator tasks, the `file-output-executor` agent, and `test-prompt-harness`'
  fixture example, semantic `judge_model` example and `bin/judge-runner.js` CLI default (now `claude-haiku-5-5`).
- **review-suite, gas-suite** — the `MODEL_ID` example in the shared `skill-authoring-conventions.md` (synced from
  `tools/shared-templates/`); gas-suite changes only through that shared copy.

### Notes

- `improve-prompt`'s references (`technique-library.md`, `critique-rubric.md`, `anti-patterns.md`) gain 5.x thinking
  rows: adaptive thinking only, depth set by `output_config.effort`; `budget_tokens` returns a 400 on every 5.x model,
  and `{type: "disabled"}` returns a 400 on Opus 5.5 and Sonnet 5.5 (Sonnet 5.5 uses `{type: "between_tools"}`).
- gas-suite, slides-suite and wiki-suite keep their own 4.x pins; only the shared file changed in gas-suite.
- Test fixtures under `test/plugins/planning-suite/llm-bench/` still name Haiku 4.5: the golden stream and judge files
  are a recorded Haiku 4.5 run, and the smoke fixture that produced them stays paired with them.

## 2026-11-08 — claudecraft 0.2.3: improve-loop no longer refers to review-converge

`improve-loop` named `review-converge` as a sibling skill that this marketplace does not ship, and its checks pinned that
mention. Public users cannot install the sibling, so the card and the checks now describe `improve-loop` alone. The section
that introduced the family is now titled "Improvement loop contracts", and rule 5 no longer points at the sibling.

### Removed capabilities

- **claudecraft** — the family-table row, the "Sibling skill" paragraph and the ralph note that named `review-converge`
  (and its legacy alias `grok-review-converge`) in `skills/improve-loop/SKILL.md`; in `scripts/contract-check.js`, the
  `review-converge` composition checks, the pin that required the sibling to be named, and the `--converge` flag; and
  `scripts/converge-ledger-resolve.js`, whose only users were those checks. Migration: none for `improve-loop` itself;
  a script that passes `--converge` to `contract-check.js` can drop it (the flag is now ignored).

## 2026-11-08 — real organisation identifiers replaced with placeholders (form990 0.2.1, review-suite 0.2.7, comms 0.1.1)

The `form990` plugin's tests, notes and examples contained a real organisation's identifiers (an EIN, a state charity
registration number, the names of its officers and directors, an organisation e-mail address, domain, name and street address,
a Candid profile id and an IRS object id) and the names of a tax preparer and two contractors. They are replaced with obvious
placeholders in the same formats, so the tests still exercise the same rules (the verification harness passes the same 31 cases
before and after), and the public audit note about them (`docs/pii-audit.md`) is removed. Two review fixtures, one review-plan
note and one slack-tag manifest that carried a personal home-folder name now use a neutral one, and two tracked symlinks in
`.claude/agents/` whose targets named a home folder (a path that exists on no other machine) are deleted.

### Notes

- Git history is not rewritten: earlier commits still contain the original values.
- The `form990` plugin remains tied to one filer's workflow; only its embedded identifiers changed.

## 2026-09-26 — skills consolidated into skill-craft (planning-suite 0.3.0, review-bench 0.3.0, claudecraft 0.2.2)

skill-craft ([whichguy/skill-craft](https://github.com/whichguy/skill-craft), plugin
`skill-craft@whichguy`) is now the single source of truth for the skills below; claude-craft no
longer ships its duplicate copies.

### Removed capabilities

- **planning-suite** — `architect`, `c-plan`, `prompt-align`, `prompt-audit`, `prompt-migrate`,
  `prompt-refine`, `test`. Migration: `/skill-craft:<leaf>` (`test` is `/skill-craft:plan-test`).
- **planning-suite plan scheduling** — `schedule-plan-tasks`, `delivery-agent`, their test
  harnesses and `lib/`. Migration: `/skill-craft:backchain` to produce a dependency graph, then
  `/skill-craft:plan-dispatcher` to execute it. The ExitPlanMode nudge routes `Execute: schedule`
  there; plans without an `Execute:` line now default to inline implementation.
- **review-bench** — `compare-prompts` (+ `compare-prompts-judge`), `improve-system-prompt`,
  `review-fix-bench` (+ its bundled `tools/review-fix-bench.sh` copy). Migration:
  `/skill-craft:<leaf>`. The repo-root `tools/review-fix-bench.sh` and `npm run bench:*` remain.
- **claudecraft** — `improve-loop` no longer claims the bare `/improve <target>` trigger, which
  belongs to skill-craft's `improve` skill. Use `/improve-loop` or `/claudecraft:improve-loop`.

### Still present (not regressed)

- `question-bench` and `derive-questions` stay in review-bench; skill-craft retired its copies,
  so these are now the only source.
- `node-plan`, `test-prompt-harness` and every other planning-suite agent remain.

## 2026-05-09 — review-plan: micro-noclose-strict promotion (22fd345)

`plugins/review-suite/skills/review-plan/SKILL.md` was reduced from 4070 lines of orchestration to a 34-line single-pass directive (`micro-noclose-strict`), validated by 50 paired sub-agent runs across 5 fixtures. The trade-off was an explicit reduction of skill scope; capabilities below are removed by design.

### Removed capabilities

- **Convergence loop (multi-pass evaluation)** — Removed. The old skill ran up to 5 evaluation passes with inline plan edits between passes. Now: single-pass review only. Migration: read the verdict, edit the plan manually, re-invoke `/review-suite:review-plan` for another pass.

- **Final scorecard / Teaching Notes panel** — Removed. The old skill emitted a structured scorecard (findings digest, senior-engineer critic loop, Teaching Notes section) on completion. Now: prose flagged issues + one-sentence verdict. Migration: maintain decision records out-of-band.

- **Phase 5g skill-learnings emission** — Removed. The old skill spawned a sub-agent at the end of every FULL-tier review to surface 0–5 self-improvement suggestions for the review-plan skill itself. Now: no auto-feedback. Migration: file enhancement suggestions as GitHub issues.

- **Implementation Intent Questions appended to plan** — Removed. The old skill extracted plan-specific verification questions and wrote them back into the plan file as a contract for `/review-fix` (intent-to-code drift detection). Now: the skill never modifies the plan file. Migration: define verification contracts manually in the plan or a sibling document.

- **Question ID system (Q-G1, Q-G5, Q-C3, Q-G30, …)** — Removed from output. The skill instructions now explicitly say "Do not use question IDs"; findings are graded by category. Migration: none.

- **Tier dispatch (TRIVIAL / SMALL / FULL)** — Removed. The old skill classified plans into three tiers and ran different question subsets. Now: a single senior-engineer directive applies uniformly, with N/A only for documentation-only plans. Migration: none — depth is uniform.

- **Layer 2 dispatch into language-specific plans** — Removed from review-plan. The old SKILL.md detected GAS/Node plans and invoked `gas-plan` / `node-plan` as a layered review. Now: review-plan does not dispatch. Note: `gas-suite/skills/gas-review/SKILL.md:59` still says "review-plan handles GAS detection and gas-plan invocation internally" — this is documentation drift; gas-review still receives a verdict back, the dispatch is just no longer automatic. Migration: invoke `/planning-suite:gas-plan` or `/planning-suite:node-plan` directly when language-specific layered review is wanted. (Both skills remain independent, with their own internal convergence loops and scorecards — they are not affected by this change.)

- **Adversarial close (two-question structured phase)** — Folded into the directive. The old skill ran two explicit validation questions ("Fabricated quantitative evidence", "Phantom types/symbols") after the main directive. Now: these are merged into the directive prose plus a deterministic count-based severity rule. Migration: none — same checks, less ceremony.

### Still present (not regressed)

- **`MANDATORY_PRE_EXIT_PLAN` gate file** at `~/.claude/plans/.review-ready-<slug>` — still emitted on `PASS` verdict (lines 46–56 of new SKILL.md). The ExitPlanMode PreToolUse hook in `plugins/planning-suite/hooks/hooks.json` continues to consume it.

- **GAS plan review entry point** — `/review-suite:review-plan` is still the documented entry point for plan review per `gas-gmail-cards.md`. Output shape changed (no scorecard) but the call still works.

### Cross-model behavior

`RUN-FINDINGS.md` documents that probe-9 produces `NOT_READY` 3/3 on Opus but `NEEDS_UPDATE` 5/5 on Sonnet — this Opus/Sonnet severity-tier gap is now an allowed and tested baseline, encoded in the `--model` flag's cross-model regression cell in `/ablate-review-plan`.
