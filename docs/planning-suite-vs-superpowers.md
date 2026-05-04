# planning-suite vs superpowers parity audit (Task #8)

## Executive Summary

**Total Items Analyzed**: 28 (8 skills, 16 agents, 4 commands)

| Category | CUT | SLIM | KEEP | DEFER |
|----------|-----|------|------|-------|
| **Count** | 4 | 7 | 14 | 2 |
| **%** | 14% | 25% | 50% | 7% |

**Verdict**: planning-suite is **mostly distinct and genuinely valuable**. The CUT set initially looked like 3 items but on execution grew to 4: `create-worktree` was reclassified from KEEP → CUT once we confirmed it had only one live caller (`requirements-generator`) which now uses raw `git worktree add` directly.

**Status as of Task #18 (executed in commits 9da2a47 + post-#18 commit):**
- ✅ `refactor` skill — deleted
- ✅ `code-refactor` agent — deleted
- ✅ `merge-worktree` agent — deleted (`requirements-generator` now uses raw `git merge --squash`)
- ✅ `create-worktree` agent — deleted (`requirements-generator` now uses raw `git worktree add`)

---

## CUT (4) — all executed

| Item | Type | Maps to | Rationale |
|------|------|---------|-----------|
| refactor | skill | superpowers:systematic-debugging (code-quality variants) | Dispatches to code-refactor agent; the skill itself is a thin dispatcher with no unique logic. Superpowers verifies outcomes before declaring done. |
| code-refactor | agent | superpowers:systematic-debugging (refactor-focused) | Identifies code smells and applies safe refactorings. Superpowers' verification workflow already covers this workflow (analyze → plan → fix → confirm). |
| merge-worktree | agent | superpowers:finishing-a-development-branch + raw git | Sole caller (requirements-generator) inlined `git merge --squash` directly. schedule-plan-tasks and delivery-agent already used raw git. |
| create-worktree | agent | superpowers:using-git-worktrees + raw git | Sole live caller (requirements-generator) inlined `git worktree add` directly with collision-resistant naming. The "nested worktree parent tracking" feature was unused by any caller — schedule-plan-tasks orchestrates its own chain semantics. |

---

## SLIM (7)

These have meaningful overlap with superpowers but retain distinct slice worth keeping.

| Item | Type | Overlapping Superpower | Unique Slice to Keep |
|------|------|------------------------|----------------------|
| architect | skill | superpowers:brainstorming (design exploration) | Inline tech comparison + agent dispatch. Superpowers brainstorms intent; architect pre-builds comparison tables and dispatches system-architect agent directly—faster for "X vs Y" decisions. Keep the fast-path inline comparison logic. |
| node-plan | skill | superpowers:writing-plans (general plan review) | Node.js/TypeScript-specific 38-question framework with dual-perspective (TS/API + Node runtime) evaluators. Superpowers' generic writing-plans doesn't target this language+runtime. Keep the domain-specific rigor. |
| schedule-plan-tasks | skill | superpowers:executing-plans (orchestration) + superpowers:using-git-worktrees | Orchestrates parallel tasks across isolated worktrees with self-merge cascade, task-graph wiring, and recovery. Superpowers executes plans linearly; this adds worktree isolation + task API + cascade autonomy. Keep the task-graph wiring and cascade engine. |
| test | skill | superpowers:test-driven-development (test generation) | Detects test framework automatically and matches project patterns. Superpowers is test-first mindset; this generates tests post-implementation and auto-detects existing test infrastructure. Keep framework detection + pattern matching. |
| environment-analyst | agent | superpowers:brainstorming (environment discovery) | Continuous IDEAL-STI stream for environment/integration mapping. Superpowers brainstorms broadly; this is a specialized discovery agent for integration-point analysis and workflow impact. Keep as specialized discovery stream. |
| qa-analyst | agent | superpowers:test-driven-development (test spec generation) | Generates comprehensive test plans + executes with architecture-spec compliance. Superpowers is TDD-first; this is test-after with architecture reference. Keep the comprehensive test-plan generation and spec alignment. |
| system-architect | agent | superpowers:brainstorming (architecture exploration) | Implements LEVEL 1-4 progressive-complexity decision framework with "justify every escalation" rule. Superpowers explores; this decides with evidence gates. Keep the progressive-complexity framework. |

---

## KEEP (14)

No meaningful superpowers overlap or genuinely distinct strategic value.

| Item | Type | Rationale |
|------|------|-----------|
| delivery-agent | agent | Executes a single task from an orchestrated plan with worktree isolation, self-merge cascade, sub-task spawning, and 3-attempt retry logic. No superpowers equivalent—this is plan-execution + task lifecycle + cascade autonomy. |
| deployment-orchestrator | agent | Manages deployments through an infrastructure-specific pipeline (references docs/architecture-specification.md). Superpowers has no deployment agent; this is infrastructure-aware with validation gates and feature classification. |
| file-output-executor | agent | Writes large output (50k+) directly to file to avoid conversation truncation. Utility agent not addressed by superpowers. |
| knowledge-aggregator | agent | Captures patterns and learnings from IDEAL-STI artifacts or generic project wiki. Superpowers has no knowledge-capture agent; this bridges sessions and surfaces reusable insights. |
| recommend-tech | agent | Evaluates 9 technology areas with 3-pass deepening (priority → research → confidence gate). Superpowers:brainstorming explores broadly; this is structured tech evaluation. |
| requirements-generator | agent | Transforms use cases into comprehensive requirements via 16-phase discovery framework with nested worktree isolation and merge-back. Superpowers:writing-plans is plan-first; this is requirements-first with deep structured discovery. |
| synthesis-coordinator | agent | Integrates findings from parallel research streams with cross-stream validation, conflict detection, confidence scoring. No superpowers equivalent; specialized for multi-stream synthesis. |
| tech-research-analyst | agent | Deep technical research across market, technical, business, team, future, compliance dimensions. Superpowers:brainstorming explores; this is focused technical due diligence with weighted scoring. |
| ui-designer | agent | Generates UI/UX specifications via question-driven design (Q-U1 to Q-U9 + client questions). Evaluate mode for plan review. No superpowers equivalent; specialized for interface design. |
| verify-transformation | agent | Detects unintended functionality loss in prose transformations (agent files, docs). Git-history aware. No superpowers equivalent; specialized verification tool. |
| alias | command | Create/list slash command aliases. Utility command not in superpowers. |
| knowledge | command | Discover and integrate project/user knowledge files from hierarchical locations. Utility command not in superpowers. |
| performance | command | Analyze and recommend performance optimizations (frontend, backend, DB, network). Utility command not in superpowers. |
| unalias | command | Remove slash command aliases with safety checks. Utility command not in superpowers. |

---

## DEFER (2)

Needs deeper investigation before deciding.

| Item | Type | Questions | Next Steps |
|------|------|-----------|-----------|
| test-delivery-agent | skill (test harness) | Is this a skill or test infrastructure for delivery-agent? Does it have production use or is it only for testing schedule-plan-tasks? | Read the SKILL.md file to confirm scope. If infrastructure-only, consider removing from public bundle. |
| test-schedule-plan-tasks | skill (test harness) | Same as test-delivery-agent—is this a testable skill or internal test infrastructure? | Read the SKILL.md file. If test-only, mark as internal and exclude from feature parity. |

---

## Notes

- **Shared/** (shared/self-referential-protection.md, skill-authoring-conventions.md, etc.) are utilities/docs, not skills—excluded from count.
- Planning-suite fills gaps in superpowers: worktree orchestration, task-graph execution, language-specific reviews, infrastructure-aware deployment, and specialized agents (tech research, synthesis, requirements).
- Cutting the 3 CUT items would trim 11% of the surface; the bundle would lose no strategic capability.
- SLIM items warrant dedicated attention—each has a distinct niche (fast-path tech compare, Node.js rigor, task-graph cascade, auto-detected test patterns, etc.).
