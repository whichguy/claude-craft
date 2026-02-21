---
name: gas-plan
description: |
  Dual-perspective GAS plan review (frontend + backend) with iterative convergence loop.

  **AUTOMATICALLY INVOKE** when:
  - Any plan exists for GAS changes, GAS project changes, or uses mcp_gas
  - Plan mode produces a plan file for a GAS project (scriptId present)
  - User says "review plan", "check plan", "validate plan", "plan review"
  - User says "is this plan ready", "plan quality", "gas-plan"
  - After ExitPlanMode on any GAS project plan
  - Plan references .gs files, .html files in GAS context, or mcp__gas__ tools
  - Plan modifies CommonJS modules, __events__, doGet/doPost, or addon code

  **NOT for:** Code review (use /gas-review), test review (use /gas-test-review),
  prompt analysis (use /prompt-critique), non-GAS plans

  **mode parameter:**
  - `standalone` (default): TeamCreate + parallel evaluators + convergence loop + ExitPlanMode
  - `evaluate`: Single-pass read-only evaluation — returns findings via SendMessage to calling
    team-lead. No edits, no team creation, no ExitPlanMode. Used internally by review-plan.
model: opus
allowed-tools: all
---

# GAS Plan Review: Iterative Convergence Loop

You review implementation plans from two perspectives per pass: **frontend engineer** (HTML/CSS/UX) and **GAS engineer** (backend/infrastructure). In standalone mode, both perspectives evaluate in parallel each convergence pass via spawned evaluator agents. In evaluate mode, you do a single-pass evaluation yourself and return findings to the calling skill.

## Mode Parameter

Two operating modes:
- **`standalone`** (default): Creates an evaluator team, runs parallel frontend + GAS evaluators each pass, merges findings, applies edits, converges, outputs final scorecard, calls ExitPlanMode.
- **`evaluate`**: Single-pass read-only evaluation run inside another skill's team. Evaluates all applicable questions (both perspectives), sends findings via SendMessage to team-lead, then stops. No plan edits. No ExitPlanMode. No team creation.

**How to detect mode:** Scan the invocation prompt for `mode=evaluate`. If found, set MODE=evaluate. Otherwise MODE=standalone.

## Core Directive: Loop Until Stable

**In standalone mode: You MUST loop. NEVER output the final scorecard until exit criteria are met. NEVER stop after one pass.**

## Step 0: Locate Plan and Load Context

1. **Check mode:** Scan invoking prompt for `mode=evaluate`. Set MODE accordingly.
2. **Plan file**: Check skill arg. If empty, use `Glob("~/.claude/plans/*.md")` and pick the most recently modified file. If no plan files exist, ask the user via AskUserQuestion.
3. **Standards context** (cache for all passes):
   - Read `~/.claude/CLAUDE.md`
   - Read project MEMORY.md from the project memory directory
4. **Read the plan** and identify domains present (UI changes? new files? deployment? common-js edits?) for triage.
5. **Branch on mode:** If MODE=evaluate → jump to [Mode: evaluate]. If MODE=standalone → jump to [Mode: standalone].

---

## Mode: evaluate

*Single-pass, read-only. Returns findings via SendMessage. No edits. No ExitPlanMode.*

**You are running inside another review skill's team. Your only output is a SendMessage to the team-lead.**

1. Read the plan file (done in Step 0).
2. Apply triage: bulk-mark N/A for irrelevant domains.
   - No UI/HTML/CSS changes → bulk N/A Q14, Q30-Q36
   - No .gs/deployment/common-js changes → bulk N/A GAS-owned questions
     Exception: Q1, Q2, Q42 are never N/A — evaluate them regardless of triage.
   - For shared questions (Q13, Q15, Q16, Q27, Q28, Q38, Q41): evaluate from both lenses, combine
3. Evaluate ALL applicable questions from BOTH perspectives in a single pass.
4. Skip content marked `<!-- gas-plan -->` or `<!-- review-plan -->` (self-referential protection).
5. Call the **SendMessage** tool exactly once:
   ```
   type: "message"
   recipient: "team-lead"
   summary: "gas-plan evaluation complete — N NEEDS_UPDATE"  (fill in count)
   content: |
     FINDINGS FROM gas-plan

     [Triage] Frontend domain: [ACTIVE | SKIPPED — reason]
     [Triage] GAS domain: [ACTIVE | SKIPPED — reason]

     Q1: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
     [EDIT: specific instruction — where to add/change and what, if NEEDS_UPDATE]
     Q2: ...
     ...
     Q42: ...
   ```
   Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

6. **STOP.** Do not loop. Do not edit the plan. Do not touch `.plan-reviewed`. Do not call ExitPlanMode.

---

## Mode: standalone

*Creates evaluator team, runs convergence loop, applies edits, outputs scorecard, calls ExitPlanMode.*

### Team Setup

At the start of standalone mode (before the loop):
```
timestamp = Date.now()
team_name = "gas-plan-" + timestamp
TeamCreate({team_name, description: "GAS plan review — parallel frontend + GAS evaluators"})
```

### Error Handling

Wrap the entire convergence loop in error handling:
```
IF any unrecoverable error occurs during the convergence loop:
  1. Send shutdown_request to any active evaluator agents
  2. TeamDelete
  3. Surface the error to the user via AskUserQuestion
  Do NOT leave orphaned team processes.
```

### Perspective Assignments

Each question is owned by one perspective or shared. Tags: `[F]` = Frontend, `[G]` = GAS, `[Shared]` = both.

**Frontend evaluator** — HTML/CSS/UX focus:
- Primary: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36
- Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

**GAS evaluator** — backend/infrastructure focus:
- Primary: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42
- Shared (backend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

**Shared questions** (Q13, Q15, Q16, Q27, Q28, Q38, Q41): Both evaluators report on shared Qs. Team-lead merges: combine findings, keep the more actionable wording.

**Triage shortcut:** No UI/HTML/CSS changes → skip frontend evaluator (bulk N/A; shared evaluated by GAS evaluator). No .gs/deployment/common-js changes → skip GAS evaluator (shared evaluated by frontend evaluator).
**Never-N/A exception:** Q1, Q2, Q42 are marked "never N/A" and MUST be evaluated regardless of domain triage. If the GAS evaluator is skipped, the team-lead evaluates Q1, Q2, Q42 directly before the merge step.

### Execution Flow

```
STEP 0: (done — plan loaded, team created)
  plan_path = <absolute filesystem path resolved in Step 0>
  team_name = <team_name created above>
  Substitute plan_path and team_name into all evaluator prompts below before spawning.

DO:
  Print: "Pass [N/15]: evaluating..."
  TRIAGE: Determine which evaluators are active based on domain analysis.

  [In a SINGLE message, spawn active evaluators as PARALLEL Task calls]
  [Substitute the actual resolved plan_path value into each prompt before spawning]

  --- Frontend Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    team_name = <team_name>,
    name = "frontend-evaluator",
    prompt = """
      You are a senior frontend engineer evaluating a GAS implementation plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/gas-plan/SKILL.md for the full question
        table (questions marked [F] and [Shared])
      - Standards: Read ~/.claude/CLAUDE.md and project MEMORY.md as needed

      Evaluate these questions through the FRONTEND lens:
        Frontend-owned: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36
        Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

      Triage: If plan has no UI/HTML/CSS changes → bulk N/A Q14, Q30-Q36.
              Evaluate shared Qs regardless.

      Self-referential protection: Skip content marked <!-- gas-plan --> or <!-- review-plan -->.

      Output contract — call the SendMessage tool exactly once:
        type: "message"
        recipient: "team-lead"
        summary: "Frontend evaluation complete — N NEEDS_UPDATE"  (fill in count)
        content: |
          FINDINGS FROM frontend-evaluator
          [Triage] ...
          Q{N}: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
          [EDIT: instruction if NEEDS_UPDATE]
          (one entry per evaluated question)

      Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only evaluation
      - Do NOT call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings
    """
  )

  --- GAS Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    team_name = <team_name>,
    name = "gas-evaluator",
    prompt = """
      You are a senior GAS backend engineer evaluating a GAS implementation plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/gas-plan/SKILL.md for the full question
        table (questions marked [G] and [Shared])
      - Standards: Read ~/.claude/CLAUDE.md and project MEMORY.md as needed

      Evaluate these questions through the GAS engineering lens:
        GAS-owned: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42
        Shared (GAS lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

      Triage: If plan has no .gs/deployment/common-js changes → bulk N/A GAS-specific Qs.
              Evaluate shared Qs regardless.

      Self-referential protection: Skip content marked <!-- gas-plan --> or <!-- review-plan -->.

      Output contract — call the SendMessage tool exactly once:
        type: "message"
        recipient: "team-lead"
        summary: "GAS evaluation complete — N NEEDS_UPDATE"  (fill in count)
        content: |
          FINDINGS FROM gas-evaluator
          [Triage] ...
          Q{N}: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
          [EDIT: instruction if NEEDS_UPDATE]
          (one entry per evaluated question)

      Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only evaluation
      - Do NOT call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings
    """
  )

  Wait for all active evaluator messages (90s reminder; after 120s total mark ⚠️ Evaluator Incomplete for any non-responding evaluator and proceed with available findings).

  -- Merge & Consolidate --
  COLLECT all NEEDS_UPDATE from both evaluator messages
  For shared questions (Q13, Q15, Q16, Q27, Q28, Q38, Q41) flagged by both:
    Combine into single finding; keep the more actionable wording
  APPLY all NEEDS_UPDATE edits to plan (targeted insertions, 2-3 sentences each), mark <!-- gas-plan -->
  CONSOLIDATE plan (see Consolidation Rules below)
  RE-READ consolidated plan
  TRACK prev_needs_update_count and prev_needs_update_set between passes
  PLATEAU = same count AND same Q numbers as previous pass
  Print pass summary using per-pass template

WHILE exit criteria not met (max 15 passes)

OUTPUT final scorecard

TEARDOWN:
  Bash: touch ~/.claude/.plan-reviewed
  Send shutdown_request to all team agents
  TeamDelete
  Call ExitPlanMode
```

### Worked Example

```
Pass 1/15: evaluating...
  [Spawning frontend-evaluator (haiku) + gas-evaluator (sonnet) in parallel]
  [frontend-evaluator findings]: 1 NEEDS_UPDATE (Q34) -- `.btn` conflicts with Google CSS
  [gas-evaluator findings]: 3 NEEDS_UPDATE (Q1, Q9, Q19) -- no branch named, no deploy target, stub function
  -> Merge: shared Qs all PASS in both — no merge needed
  -> Edits: add CSS namespace note (Q34), add branching section + deployment target + implementation spec (Q1, Q9, Q19)
  -> Consolidate: merge deployment + rollback into single section
Pass 2/15: evaluating...
  [frontend-evaluator findings]: 0 NEEDS_UPDATE
  [gas-evaluator findings]: 1 NEEDS_UPDATE (Q12) -- incremental verification missing
  -> Edit: add exec checkpoint after each push step
  -> Consolidate: no duplicates found
Pass 3/15: evaluating...
  [frontend-evaluator findings]: 0 NEEDS_UPDATE
  [gas-evaluator findings]: 0 NEEDS_UPDATE
  -> CONVERGED at pass 3. Output final scorecard.
```

---

## Exit Criteria (Gate-Based)

- **Gate 1** (blocking, weight 3): All must PASS. Loop until satisfied. If persistent after edits, ask the user for resolution before stopping.
- **Gate 2** (important, weight 2): Must stabilize (no new findings between passes). Loop until stable.
- **Gate 3** (advisory, weight 1): Note findings but do NOT loop on them.
- N/A counts as PASS for gate evaluation. A weight-3 question marked N/A does not block.
- **Plateau:** NEEDS_UPDATE count unchanged between passes = stop (Gate 2 only; Gate 1 uses ask-user).
- **Safety cap:** 15 passes.

## Ambiguity Handling

- **Cannot determine PASS vs NEEDS_UPDATE?** Ask the user via AskUserQuestion. Do not guess.
- **Insufficient context to evaluate?** Ask the user what information is needed.
- **Edge case on advisory (weight 1)?** Default to PASS. Do not generate false positives on low-weight questions.

## Self-Referential Protection

Mark review additions with `<!-- gas-plan -->` suffix. Use this marker to skip self-referential re-evaluation in subsequent passes.

Content added by this review (branching sections, deployment steps, test notes) is **plan metadata, not implementation scope**. Do NOT flag review-added sections as needing:
- Tests (Q11) -- review additions don't need test coverage
- Impact analysis (Q18) -- review additions don't have callers
- Implementation (Q19) -- review additions aren't stubs
- Dead code removal (Q20) -- review additions aren't replacing anything
- Duplication check (Q39) -- review additions are not new production logic; they cannot duplicate existing implementations
- State edge case check (Q40) -- review additions are not new production code; they cannot have uninitialized or misformatted state
- Integration check (Q41) -- review additions are meta-content for the plan, not new architecture components

## Consolidation Rules (Every Pass)

After edits, consolidate. Specific criteria:
- Merge sections covering the same concern (e.g., separate "Deployment" and "Rollback" into one section)
- Remove redundant notes that repeat what the plan already says
- Each finding adds at most 2-3 sentences. Consolidation removes at least as much text as it adds (from pass 2 onward; pass 1 focuses on additions only).
- If plan is growing, prioritize: keep blocking findings, summarize important, drop advisory notes
- Plan gets cleaner each pass, not longer

---

## Key Questions

Each returns **PASS** / **NEEDS_UPDATE** / **N/A**.
Weights: **3** = blocking | **2** = important | **1** = advisory.

### Quick-Reference Weight Table

**Gate 1 -- Blocking (weight 3, must all PASS):**
Q1 branching strategy [G] | Q2 branching usage [G] | Q13 standards [Shared] | Q15 simplicity [Shared] | Q18 impact analysis [G] | Q42 post-impl review [G]

**Gate 2 -- Important (weight 2, must stabilize):**
Q3 sync [G] | Q4 folders+ordering [G] | Q5 right tools [G] | Q6 exec verify [G] | Q7 common-js sync [G] | Q9 deployment [G] | Q10 rollback [G] | Q11 tests [G] | Q12 incremental verify [G] | Q16 interfaces [Shared] | Q17 step ordering [G] | Q19 empty code [G] | Q20 dead code [G] | Q21 concurrency [G] | Q22 execution limit [G] | Q23 OAuth scopes [G] | Q24 idempotent [G] | Q27 input validation [Shared] | Q28 error handling [Shared] | Q29 logging [G] | Q32 event listeners [F] | Q38 unintended consequences [Shared] | Q39 duplication [G] | Q40 state-exists+absent [G] | Q41 bolt-on vs merge [Shared]

**Gate 3 -- Advisory (weight 1, note only):**
Q8 isolated state [G] | Q14 naming [F] | Q25 quotas [G] | Q26 storage limits [G] | Q30 UX feedback [F] | Q31 accessibility [F] | Q33 error boundary [F] | Q34 CSS conflicts [F] | Q35 LLM comments [F] | Q36 breadcrumbs [F] | Q37 documentation [G]

**Triage shortcut:** Bulk-mark N/A for entire domains when clearly irrelevant (no UI changes -> skip UX & Frontend, no new files -> skip folder/ordering, no deployment -> skip rollback).

---

### Git & Version Control

**Q1: Is there a branching/merging strategy?** (3, GAS, never N/A)
All changes get a branch. Plan must name the branch, merge target, and PR workflow.

**Q2: Do the plan steps actually use branching?** (3, GAS, never N/A)
Steps must create a feature branch and commit incrementally. Risky changes must include a git rollback path.

---

### MCP GAS Workflow

**Q3: Is local/remote file sync accounted for?** (2, GAS)
`mcp__gas__cat` can return stale local. Specify `remoteOnly: true` for reads and verify after push. N/A: no remote file reads.

**Q4: Are files in the right folders and in correct dependency order?** (2, GAS)
Folders: addon code in `inbox-crew/addon/`, common modules in `common-js/`, HTML in `html/`, tests in `test/`. Order: `require.gs` at position 0, then base modules before consumers, tests last. Flag wrong folder placement or out-of-order dependencies. N/A: no new files.

**Q5: Are the right mcp_gas tools used for each file type?** (2, GAS)
HTML files must use `raw_write` (not `write` which adds CommonJS wrappers). `.gs` files use `write`. `cat` paths must omit `.gs` extension. N/A: no file push/read operations.

**Q6: Is there exec verification after each push?** (2, GAS)
Each write/raw_write must be followed by an exec to verify code loads. Push does not mean it works. N/A: no remote pushes.

**Q7: If editing common-js modules, are mcp_gas templates also updated?** (2, GAS)
CLAUDE.md: `COMMON-JS_SYNC`. Changes to shared modules must include dual updates. N/A: no common-js edits.

**Q8: Does the plan account for GAS isolated execution state?** (1, GAS)
Each `exec()` has isolated global state -- no persistence between calls. Data must go through Properties/Cache. N/A: no cross-exec state needed.

---

### Deployment & Rollback

**Q9: Is the deployment defined with target environment?** (2, GAS)
GAS changes need push/deploy steps: write/raw_write/rsync, exec verification, target env (dev/staging/prod). N/A: local-only files.

**Q10: Is there a rollback plan if deployment goes wrong?** (2, GAS)
Recovery path: revert commit + redeploy, versioned rollback, or hold previous deployment. Flag doGet/doPost/__events__ changes without rollback note. N/A: no deployment.

---

### Testing & Verification

**Q11: Are tests updated for these changes?** (2, GAS)
Interface changes need test updates. Bug fixes need regression tests. New functions need new tests. N/A: pure CSS/HTML visual changes.

**Q12: Is there incremental verification at each step?** (2, GAS)
Each step must have a checkpoint (exec, test, manual check). Flag all-testing-at-end. N/A: single atomic change.

---

### Standards & Conventions

**Q13: Does the plan adhere to project standards and conventions?** (3, Shared, never N/A)
CLAUDE.md: CommonJS wrappers, `__events__`, `loadNow:true`, `raw_write` for HTML, `createGasServer/exec_api`.
MEMORY.md: doGet null-return, `result.error` not `result.success`, ConfigManager namespaces.

**Q14: Do new names follow existing codebase conventions?** (1, Frontend)
Casing, module naming, config key patterns. N/A: no new names.

---

### Simplicity & Architecture

**Q15: Is this as simple as possible, but no simpler?** (3, Shared, never N/A)
Over-engineering: unnecessary modules, premature abstractions, duplicated common-js logic, future-proofing.
Under-engineering: missing error handling on GAS APIs, missing null checks on sheet ops.

**Q16: Are modified interfaces consistent with other interfaces?** (2, Shared)
All callers identified and updated, return formats match siblings, __events__ consistent. N/A: no export/signature changes.

**Q17: Are step ordering and sequencing dependencies explicit?** (2, GAS)
Clear DAG. Flag: refs to uncreated files, deploy before push, `require()` targets pushed after importers. N/A: single step.

**Q41: Is the proposed change integrated into existing architecture or bolted on as an isolated addition?** (2, Shared)
New code should extend existing modules, reuse existing patterns, and follow established data flows. Flag: new utility when an existing one covers the use case or could be extended; new file when an existing file handles the concern; new pattern when existing conventions already address it; additions that don't connect to the codebase's module structure or data flow. N/A: change is purely additive with no existing structure to integrate into.

---

### Impact & Cleanup

**Q18: Are there other impacted features not considered?** (3, GAS)
Cross-ref changed modules against callers (grep `require()`, call sites, `__events__`). Flag unmentioned callers that may break. N/A: fully isolated, zero callers.

**Q19: Is there any empty code that needs implementation?** (2, GAS)
Flag stubs, TODOs, "implement later" without full spec. Allow explicitly phased delivery. N/A: no placeholders.

**Q20: Is there dead code that should be removed?** (2, GAS)
Old implementation marked for removal when replaced? Flag orphaned exports, unused handlers in changed modules. N/A: nothing replaced.

**Q38: Are there unintended consequences from this plan that need to be addressed?** (2, Shared)
Side effects beyond the stated goal: breaking existing workflows, changing user-facing behavior unintentionally, introducing performance regressions, altering data formats consumed by other systems, or shifting security boundaries. Flag anything the plan doesn't explicitly acknowledge. N/A: trivial isolated change with no external touchpoints.

**Q39: Does the plan introduce logic duplicating existing implementations?** (2, GAS)
Before adding new functions or modules, verify no equivalent already exists (grep callers, scan module registry). Flag plans that reimplement logic already in common-js or sibling modules without justification. N/A: no new functions or modules introduced.

**Q40: Does the plan account for both state-exists and state-absent edge cases in persistent storage?** (2, GAS)
State-exists risk: code that reads ConfigManager/Properties/Cache/Sheets and misinterprets values left by a prior version — old schema format, stale cache entry, conflicting user config from an earlier install. State-absent risk: code that reads state before it has ever been written — uninitialized ConfigManager/Properties key, cold Cache, missing sheet row or named range, first-run user. Flag: reads without null/existence check; writes that assume stored data is in the expected schema; feature paths with no initialization guard for first-run. N/A: plan introduces no reads from or writes to ConfigManager, Properties, Cache, Sheets, or any shared persistent storage.

---

### Concurrency, Quotas & Runtime

**Q21: Are there concurrency considerations?** (2, GAS)
Shared state (Properties, Cache, sheets) needs locking. Triggers/background need concurrency plan. N/A: read-only, client-only.

**Q22: Will the operation fit within the 6-minute execution limit?** (2, GAS)
Batch ops, large sheet reads, chained APIs need runtime estimate and chunking. N/A: bounded quick ops.

**Q23: Does the plan add new OAuth scopes?** (2, GAS)
Adding scopes forces re-auth for all users. Note which APIs and user impact. N/A: no new GAS services.

**Q24: Are operations idempotent -- safe to retry?** (2, GAS)
Triggers/web apps can fire twice. Data mutations need dedup or check-before-write. N/A: read-only.

**Q25: Are quota and rate limits accounted for?** (1, GAS)
UrlFetch 20K/day, Properties 50 reads/min, runtime 6min, triggers 90min. N/A: no API/batch/trigger additions.

**Q26: Are Properties/Cache payloads within size limits?** (1, GAS)
Properties: 9KB/key, 500KB total. Cache: 100KB/key. N/A: no new stored data.

---

### Security

**Q27: Is input validated at trust boundaries?** (2, Shared)
doGet/doPost params, form submissions, exec_api args need sanitization. Flag raw `e.parameter`, unescaped HTML, formula injection. N/A: no untrusted input.

---

### Error Handling & Logging

**Q28: Are errors handled gracefully with actionable messages?** (2, Shared)
Try/catch on GAS APIs, user-facing messages (not stacks), fail-loud vs fail-silent noted. Consistent with ChatService format. N/A: no new error paths.

**Q29: Is the logging strategy informative yet compact?** (2, GAS)
`setModuleLogging(pattern)` over `Logger.log()`. Context without dumps. No sensitive data. N/A: no server logic changes.

---

### UX & Frontend

**Q30: Is there UX feedback during long operations?** (1, Frontend)
Loading states, spinners, cancel support for >2s ops. N/A: no new UI server calls.

**Q31: Are new UI elements accessible?** (1, Frontend)
`aria-*` labels, tab order, focus management in iframes. N/A: no new interactive elements.

**Q32: Are event listeners cleaned up to prevent memory leaks?** (2, Frontend)
Sidebar reopens accumulate listeners. Flag `setInterval`, `addEventListener` without cleanup. N/A: no new listeners.

**Q33: Is there a client-side error boundary for silent crashes?** (1, Frontend)
`window.onerror` or try/catch around init. N/A: no new client logic.

**Q34: Do new CSS styles avoid conflicts with Google's add-on CSS?** (1, Frontend)
Namespace classes (`.chat-btn` not `.btn`). Avoid broad selectors. N/A: no new CSS.

---

### LLM Maintainability

**Q35: Are there token-optimized LLM comments where needed?** (1, Frontend)
`<!-- LLM: [module] [function] [5-8 word purpose] -->` for WHAT. N/A: trivial/self-documenting.

**Q36: Are there breadcrumb comments for non-obvious patterns?** (1, Frontend)
WHY something exists: workarounds, undocumented behavior, intentional oddities. N/A: no non-obvious patterns.

---

### Documentation

**Q37: Does project documentation need updating?** (1, GAS)
Identify affected project docs: MEMORY.md, CLAUDE.md, README, JSDoc. Update when: API behavior changes, new conventions established, module responsibilities shift, new config patterns added. N/A: no behavior/API changes.

---

### Post-Implementation Review

**Q42: Is there a plan to review all fixes after all changes are applied?** (3, GAS, never N/A)
Plan must include a post-implementation review step: run `/review-fix` or `/gas-review` after all changes are applied. Ensures regressions and secondary issues are caught before closing out the task. Mandatory for all plans — cannot be skipped.

---

## Rating

| Rating | Criteria |
|--------|----------|
| **READY** | Gate 1 all PASS + Gate 2 all PASS |
| **SOLID** | Gate 1 all PASS + Gate 2 <= 2 NEEDS_UPDATE |
| **GAPS** | Gate 1 all PASS + Gate 2 > 2 NEEDS_UPDATE |
| **REWORK** | Gate 1 has any NEEDS_UPDATE |

### Score

`(PASS_weight_sum) / (applicable_max_weight_sum) * 100` -- summary metric alongside gate rating.

---

## Output Templates

### Per-Pass Template

Show only NEEDS_UPDATE items and status changes since last pass. Summarize stable/N/A as counts.

```
## Pass [N]/15

N/A: [count] | Stable PASS: [count]

| Evaluator | Q# | Question | Status | Notes |
|-----------|-----|----------|--------|-------|
| Frontend  | Q34 | CSS conflicts | NEEDS_UPDATE | `.btn` conflicts with Google CSS |
| GAS       | Q1  | Branching strategy | NEEDS_UPDATE | No branch named |
| GAS       | Q12 | Incremental verify | PASS (was NEEDS_UPDATE) | exec checkpoint added |

**Result:** [count] NEEDS_UPDATE ([Q numbers]) -- Frontend: [n], GAS: [n]
**Frontend edits:** [list]
**GAS edits:** [list]
**Consolidation:** [what was merged/removed]
```

### Final Scorecard

```
Converged: [Yes pass N / No max 15 reached]
Gate 1 (blocking):  [PASS / n NEEDS_UPDATE remaining]
Gate 2 (important): [PASS / n NEEDS_UPDATE remaining]
Gate 3 (advisory):  [n noted]
Rating: [READY / SOLID / GAPS / REWORK]
Score: [N]% (weighted percentage)
```

---

## After Review Completes (standalone mode only)

After outputting the Final Scorecard:
1. Use the Bash tool to run: `touch ~/.claude/.plan-reviewed` — writes the gate marker so ExitPlanMode will pass
2. **Team teardown:** Send shutdown_request to all evaluator agents, then call TeamDelete. (Teardown must complete before ExitPlanMode — the session context needed for TeamDelete is not available after exiting plan mode.)
3. **Call ExitPlanMode immediately.** Do not pause, do not ask "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
