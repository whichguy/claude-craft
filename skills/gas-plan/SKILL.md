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

**WARNING:** If invoked inside an existing team (team_name present in invocation context), check for `mode=evaluate` before proceeding. Running standalone inside an existing team creates nested team conflicts and a circular ExitPlanMode race condition. When in doubt: if a team_name is present, force MODE=evaluate.

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

**Nested team constraint:** Do NOT call TeamCreate in evaluate mode — you are already inside a team. Creating a nested team causes agent isolation and message delivery failures. If you detect you are being invoked inside an existing team (team_name present in context), evaluate mode is mandatory.

1. Read the plan file (done in Step 0).
2. Apply triage: bulk-mark N/A for irrelevant domains.
   - No UI/HTML/CSS changes → bulk N/A Q14, Q30-Q36, Q43
   - No .gs/deployment/common-js changes → bulk N/A GAS-owned questions
     Exception: Q1, Q2, Q42 are never N/A — evaluate them regardless of triage.
   - No Gmail add-on / CardService in plan → bulk N/A Q44, Q45, Q46, Q47, Q48
     Detection: plan mentions CardService, Gmail add-on, contextualTriggers, or GmailApp.setCurrentMessageAccessToken.
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
- Primary: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36, Q43
- Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

**GAS evaluator** — backend/infrastructure focus:
- Primary: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42, Q44, Q45, Q46, Q48
- Shared (backend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41, Q47

**Shared questions** (Q13, Q15, Q16, Q27, Q28, Q38, Q41, Q47): Both evaluators report on shared Qs. Team-lead merges: combine findings, keep the more actionable wording. Exception: Q47 is a Gmail-domain shared question — bulk N/A when no Gmail add-on/CardService patterns are present (see triage shortcut below).

**Triage shortcut — evaluator skip:**
- No UI/HTML/CSS changes → skip frontend evaluator entirely. Mark all frontend-owned questions N/A in pass summary. Shared question coverage: GAS evaluator evaluates all 7 shared Qs from both lenses (see GAS evaluator prompt fallback instruction).
- No .gs/deployment/common-js changes → skip GAS evaluator entirely. Mark all GAS-owned questions N/A in pass summary. Shared question coverage: frontend evaluator evaluates all 7 shared Qs.

**Triage shortcut — question-level bulk N/A:** No new CSS → mark Q34 N/A without individual evaluation. No new interactive elements → mark Q31 N/A. No Gmail add-on/CardService patterns → bulk N/A Q44-Q48 (Q47 is a Gmail-domain exception to the shared-question rule). All other shared questions are NEVER bulk-N/A'd.

**Never-N/A exception:** Q1, Q2, Q42 are marked "never N/A" and MUST be evaluated regardless of domain triage. If the GAS evaluator is skipped, the team-lead evaluates Q1, Q2, Q42 directly before the merge step.

**Shared Q fallback (in question-cross-reference.md):** See `~/.claude/skills/shared/question-cross-reference.md` for the full shared question list and fallback rules. If shared file is not found, use inline policy above.

### Execution Flow

```
STEP 0: (done — plan loaded, team created)
  plan_path = <absolute filesystem path resolved in Step 0>
  team_name = <team_name created above>
  prev_needs_update_count = null; prev_needs_update_set = []
  Substitute plan_path and team_name into all evaluator prompts below before spawning.

DO:
  CLEAR: current_needs_update_count = 0; current_needs_update_set = []
  Print: "Pass [N/5]: evaluating..."
  TRIAGE: Determine which evaluators are active based on domain analysis.

  [In a SINGLE message, spawn active evaluators as PARALLEL Task calls]
  [Substitute the actual resolved plan_path value into each prompt before spawning]

  --- Frontend Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    model = "opus",
    team_name = <team_name>,
    name = "frontend-evaluator",
    prompt = """
      You are a senior frontend engineer evaluating a GAS implementation plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/gas-plan/SKILL.md for the full question
        table (questions marked [F] and [Shared])
      - Standards: Read only the GAS Development and GAS Client-Server Patterns sections of
        ~/.claude/CLAUDE.md as needed (skip unrelated sections)

      Evaluate these questions through the FRONTEND lens:
        Frontend-owned: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36, Q43
        Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

      Triage: If plan has no UI/HTML/CSS changes → bulk N/A Q14, Q30-Q36, Q43.
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
    model = "opus",
    team_name = <team_name>,
    name = "gas-evaluator",
    prompt = """
      You are a senior GAS backend engineer evaluating a GAS implementation plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/gas-plan/SKILL.md for the full question
        table (questions marked [G] and [Shared])
      - Standards: Read only the GAS Development, MCP GAS Architecture, and GAS Client-Server
        Patterns sections of ~/.claude/CLAUDE.md as needed (skip unrelated sections)

      Evaluate these questions through the GAS engineering lens:
        GAS-owned: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42, Q44, Q45, Q46, Q48
        Shared (GAS lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41, Q47

      Triage: If plan has no .gs/deployment/common-js changes → bulk N/A GAS-specific Qs.
              If plan has no Gmail add-on/CardService patterns → bulk N/A Q44, Q45, Q46, Q47, Q48.
              Evaluate shared Qs regardless (except Q47 when no Gmail — Gmail-domain exception).

      IMPORTANT — if frontend evaluator was skipped this pass (no UI/HTML/CSS changes):
        Also evaluate Q13, Q15, Q16, Q27, Q28, Q38, Q41 from the FRONTEND lens.
        Output each shared question twice: first your GAS finding, then your frontend finding.
        Label clearly: "[GAS lens]" and "[Frontend lens]". Team-lead merges both.

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
  Incomplete evaluator rule: An Incomplete evaluator contributes ZERO changes and ZERO findings
  to this pass. Pass CAN converge if responding evaluators returned 0 NEEDS_UPDATE AND the
  Incomplete evaluator returned 0 NEEDS_UPDATE in the immediately prior pass. If the Incomplete
  evaluator had NEEDS_UPDATE last pass: do NOT converge; spawn it again next pass.

  -- Never-N/A Fallback (GAS evaluator skipped) --
  IF GAS evaluator was skipped this pass (no .gs/deployment/common-js changes):
    Team-lead directly evaluates Q1, Q2, Q42 before the merge step:
    - Q1: Does the plan name a branch and include a push-to-remote step? (blocking)
    - Q2: Do the plan steps actually create a feature branch with incremental commits? (blocking)
    - Q42: Does the plan include a post-implementation review section (/review-fix or /gas-review + build + tests)? (blocking)
    Add findings to current_needs_update_set as if from gas-evaluator.
    These three questions can never converge as N/A — any NEEDS_UPDATE here blocks exit.

  -- Merge & Consolidate --
  COLLECT all NEEDS_UPDATE from both evaluator messages
  For shared questions (Q13, Q15, Q16, Q27, Q28, Q38, Q41, Q47) flagged by both:
    Combine into single finding; keep the more actionable wording. (Rationale: "more actionable
    wins" — both perspectives have domain-appropriate framing; choose clearest for implementer.)
  APPLY edits — for each [EDIT: ...] instruction in any evaluator message:
    Call the Edit tool on the plan file to insert/modify the specified content.
    Mark each insertion <!-- gas-plan -->.
    Each Edit call = 1 change. Do NOT count findings you only described in text.
  CONSOLIDATE plan (see Consolidation Rules below)
  RE-READ consolidated plan
  SET current_needs_update_count = (total NEEDS_UPDATE from this pass's evaluator messages)
  SET current_needs_update_set = (Q numbers flagged NEEDS_UPDATE this pass)
  PLATEAU = (prev_needs_update_count != null) AND (current_needs_update_count == prev_needs_update_count) AND (current_needs_update_set == prev_needs_update_set)  # set equality: order-independent
  prev_needs_update_count = current_needs_update_count; prev_needs_update_set = current_needs_update_set
  Print pass summary using per-pass template

  -- CONVERGENCE CHECK --
  Gate1_unresolved = count of NEEDS_UPDATE on Q1, Q2, Q13, Q15, Q18, Q42 (all weight-3 questions)
  IF pass_count >= 5:
    IF Gate1_unresolved > 0:
      AskUserQuestion to resolve Gate 1 issues, then BREAK
    ELSE:
      Print: "✅ Hard stop — max 5 passes reached, Gate 1 clear."
      BREAK
  IF Gate1_unresolved > 0:
    CONTINUE (never exit with Gate 1 open, even if PLATEAU)
  IF PLATEAU OR current_needs_update_count == 0:
    Print: "✅ Converged."
    BREAK
  -- END CHECK --

WHILE TRUE (loop controlled by convergence check above)

OUTPUT final scorecard

TEARDOWN:
  Bash: touch ~/.claude/.plan-reviewed
  Send shutdown_request to all team agents
  TeamDelete
  Call ExitPlanMode
```

### Worked Example

```
Pass 1/5: evaluating...
  [Spawning frontend-evaluator (general-purpose) + gas-evaluator (general-purpose) in parallel]
  [frontend-evaluator findings]: 1 NEEDS_UPDATE (Q34) -- `.btn` conflicts with Google CSS
  [gas-evaluator findings]: 3 NEEDS_UPDATE (Q1, Q9, Q19) -- no branch named, no push-to-remote step; no deploy target; stub function
  -> Merge: shared Qs all PASS in both — no merge needed
  -> Edits: add CSS namespace note (Q34), add branching section + push-to-remote + deployment target + implementation spec (Q1, Q9, Q19)
  -> Consolidate: merge deployment + rollback into single section
Pass 2/5: evaluating...
  [frontend-evaluator findings]: 0 NEEDS_UPDATE
  [gas-evaluator findings]: 1 NEEDS_UPDATE (Q12) -- incremental verification missing
  -> Edit: add exec checkpoint after each push step
  -> Consolidate: no duplicates found
Pass 3/5: evaluating...
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
- **Safety cap:** 5 passes.

## Ambiguity Handling

- **Cannot determine PASS vs NEEDS_UPDATE?** Ask the user via AskUserQuestion. Do not guess.
- **Insufficient context to evaluate?** Ask the user what information is needed.
- **Edge case on advisory (weight 1)?** Default to PASS. Do not generate false positives on low-weight questions.

## Self-Referential Protection

See `~/.claude/skills/shared/self-referential-protection.md` for the canonical protection policy. <!-- review-plan -->

If shared file is not found, use inline policy: mark all `<!-- gas-plan -->` content as review metadata, not production code; do not re-evaluate it. Do NOT flag review-added sections as needing tests (Q11), impact analysis (Q18), implementation (Q19), dead code removal (Q20), duplication checks (Q39), state edge cases (Q40), or integration checks (Q41).

## Consolidation Rules (Every Pass)

After edits, consolidate. Specific criteria:
- Merge sections covering the same concern (e.g., separate "Deployment" and "Rollback" into one section)
- Remove redundant notes that repeat what the plan already says
- Each finding adds at most 2-3 sentences. Consolidation removes at least as much text as it adds (from pass 2 onward; pass 1 focuses on additions only).
- If plan is growing, prioritize: keep blocking findings, summarize important, drop advisory notes
- Plan gets cleaner each pass, not longer
- **Keep-exemption:** Content annotated with `<!-- keep: [reason] -->` is EXEMPT from consolidation removal. Never remove or trim `<!-- keep: -->` content based on length heuristics.
- **"Key flow" definition:** Any implementation step, ordering dependency, error path, rollback step, or verification checkpoint. Prose trimming is OK. Removing or merging steps is NOT.
- **Regression check (before RE-READ):** Verify no key flow, corner case, or condition was removed during this pass. If any was dropped — even to reduce length — restore it and annotate with `<!-- keep: [reason] -->`. Trimming prose is fine; removing logic is not.

---

## Key Questions

Each returns **PASS** / **NEEDS_UPDATE** / **N/A**.
Weights: **3** = blocking | **2** = important | **1** = advisory.

### Quick-Reference Weight Table

**Gate 1 -- Blocking (weight 3, must all PASS):**
Q1 branching strategy [G] | Q2 branching usage [G] | Q13 standards [Shared] | Q15 simplicity [Shared] | Q18 impact analysis [G] | Q42 post-impl review [G]
*(Note: When gas-plan runs inside review-plan as gas-evaluator, the effective IS_GAS Gate 1 also includes Q-G3 — evaluated by l1-general-reviewer, not gas-plan. See `~/.claude/skills/shared/question-cross-reference.md` Gate 1 Composition table.)*

**Gate 2 -- Important (weight 2, must stabilize):**
Q3 sync [G] | Q4 folders+ordering [G] | Q5 right tools [G] | Q6 exec verify [G] | Q7 common-js sync [G] | Q9 deployment [G] | Q10 rollback [G] | Q11 tests [G] | Q12 incremental verify [G] | Q16 interfaces [Shared] | Q17 step ordering [G] | Q19 empty code [G] | Q20 dead code [G] | Q21 concurrency [G] | Q22 execution limit [G] | Q23 OAuth scopes [G] | Q24 idempotent [G] | Q27 input validation [Shared] | Q28 error handling [Shared] | Q29 logging [G] | Q32 event listeners [F] | Q38 unintended consequences [Shared] | Q39 duplication [G] | Q40 state-exists+absent [G] | Q41 bolt-on vs merge [Shared] | Q44 card structure [G] | Q45 action handlers [G] | Q46 token access [G] | Q47 navigation [Shared] | Q48 trigger coverage [G]

**Gate 3 -- Advisory (weight 1, note only):**
Q8 isolated state [G] | Q14 naming [F] | Q25 quotas [G] | Q26 storage limits [G] | Q30 UX feedback [F] | Q31 accessibility [F] | Q33 error boundary [F] | Q34 CSS conflicts [F] | Q35 LLM comments [F] | Q36 breadcrumbs [F] | Q37 documentation [G] | Q43 plan legibility [F]

**Triage shortcut — evaluator skip:** See Perspective Assignments above. Shared questions are NEVER bulk-N/A'd.
**Triage shortcut — question-level bulk N/A:** Bulk-mark specific questions N/A when clearly irrelevant (no UI changes → skip Q30-Q36, Q43; no new files → skip Q4; no deployment → skip Q10). Shared questions are NEVER bulk-N/A'd.

---

### Git & Version Control

**Q1: Is there a branching/merging strategy?** (3, GAS, never N/A)
All changes get a branch. Plan must name the branch and include a merge-to-main step.
Push-to-remote step must be explicit.

**Q2: Do the plan steps actually use branching?** (3, GAS, never N/A)
Steps must create a feature branch and commit incrementally. Commit messages must follow
project conventions (conventional commits: feat/fix/chore/docs etc.). Risky changes must
include a git rollback path.

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

### Plan Legibility

**Q43: Would any update materially improve plan legibility when run in Claude Code?** (1, Frontend)
As a senior UI engineer running this plan in Claude Code: are steps numbered, are code blocks properly fenced, are section headers scannable, and are conditional branches (IF/ELSE) visually distinct? Flag plans with walls of prose, unnumbered multi-step sequences, or deeply nested logic that becomes hard to follow during execution. N/A: plan is a single atomic step or is already well-structured.

---

### Gmail Add-On / CardService

**Q44: Does the card structure follow stateless best practices?** (2, GAS)
Cards must be rebuilt from scratch on each trigger invocation — CardService has no persistent card objects between calls. Evaluate: (a) State stored in PropertiesService or CacheService, not in card object references; (b) Cache keys use message-scoped prefixes (`ctx_` + messageId, `chat_` + messageId); (c) CacheService TTL appropriate to data lifetime (6 hours for classification, 1 hour for chat, 10 min for temp async state); (d) Async trigger pattern planned for long-running ops (LLM calls, external APIs) — saves state to PropertiesService, creates time-based trigger after 500ms, returns processing card with "Check Response" button, background fn saves result to CacheService, trigger cleaned up in `finally` block; (e) Trigger cleanup strategy explicit (user limit: 20 triggers; accumulation causes quota errors). Flag: mutable card references across invocations, global card caches, `card.update()` anti-patterns, missing trigger cleanup, LLM calls blocking the 30-second response limit without async pattern. N/A: no CardService usage in plan.

**Q45: Are all card action handlers wired and exported?** (2, GAS)
Every `setOnClickAction`, `setOnChangeAction`, `setOnClickOpenLinkAction` must reference a function that is globally visible or registered via `__events__`. Evaluate: (a) Action string in `setFunctionName()` matches an exported function name exactly (case-sensitive); (b) Handler functions in `module.exports` with `__events__: true`; (c) Parameters passed via `setParameters({key: 'value'})` — strings only, objects must be JSON-serialized; (d) Parameter extraction uses `e.commonEventObject.parameters.key`; (e) Form inputs extracted safely: `e.commonEventObject.formInputs[field]?.stringInputs?.value?.[0]` with defaults; (f) Switch widgets set BOTH `setValue('true')` (submitted value) AND `setSelected(boolean)` (UI state); (g) ActionResponse pattern matches intent: pushCard for drill-down (adds back button), updateCard for refresh (no navigation change), popCard for back/cancel, popToRoot for reset after major action, setNotification for toast (mutually exclusive with navigation — navigation wins if both set). Flag: action string references non-exported function, handler names don't match any function in plan's file set, missing `__events__: true`, notification + navigation combined. N/A: no card actions in plan.

**Q46: Is Gmail message access token handled correctly?** (2, GAS)
`GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken)` must be called as the FIRST line in every contextual trigger handler before any `GmailApp.getMessageById()` call. Evaluate: (a) Token set before ALL GmailApp operations in contextual handlers; (b) Token NOT cached across separate trigger invocations (isolated GAS state — caching breaks on new invocations); (c) Token NOT needed in homepage handlers (no `e.gmail` available there — accessing it crashes); (d) Draft creation uses `message.createDraftReply()` or `message.createDraftReplyAll()` for replies — NOT `thread.createDraft()` (creates new message, not reply); (e) Label operations use getOrCreate pattern: `getUserLabelByName()` then `createLabel()` if null (silent failure if label missing); (f) OAuth scopes in appsscript.json match actual operations: `gmail.addons.execute`, `gmail.addons.current.message.readonly`, `gmail.modify` (for drafts/labels/archive). Flag: missing token set before message access, token stored in Properties/global var for reuse across invocations, `thread.createDraft()` for replies, label ops without existence check, missing OAuth scopes for planned GmailApp operations. N/A: no Gmail message access in plan.

**Q47: Is card navigation balanced (push/pop)?** (2, Shared)
Every `pushCard` path must have a corresponding `popCard`, `popToRoot`, or explicit navigation reset path. Evaluate: (a) Detail/settings cards pushed via `pushCard` include a back button using `popCard`; (b) Navigation depth stays reasonable (3-4 cards max; ~10 card practical limit); (c) Major actions (send, archive, delete) use `popToRoot` to reset stack; (d) `updateCard` used for real-time refresh within a view (does not change navigation stack); (e) Error cards include back button — never dead-end the user; (f) No notification + navigation combined (navigation supersedes notification if both set). Flag: unbounded push depth without back navigation, pushed cards with no back button, orphaned card stacks (pushCard with no pop path), popCard called from card that was never pushed, using pushCard where updateCard is semantically correct (chat message refresh). N/A: single-card add-on with no navigation, or all interactions are updateCard only.

**Q48: Are homepage and contextual triggers both covered?** (2, GAS)
`appsscript.json` must declare both `homepageTrigger` (in `addOns.common`) and `contextualTriggers` (in `addOns.gmail`) when the add-on needs both entry points. Evaluate: (a) `homepageTrigger.runFunction` references an existing handler that does NOT access `e.gmail` (unavailable in homepage context); (b) Contextual trigger `onTriggerFunction` references an existing handler that calls `setCurrentMessageAccessToken` before any GmailApp use; (c) Handler functions check for `e.gmail` presence/absence when serving both contexts; (d) appsscript.json `oauthScopes` array includes all scopes needed by both trigger paths; (e) If compose trigger needed: `composeTrigger` section in `addOns.gmail` with `selectActions`; (f) If universal actions needed: `universalActions` section in `addOns.gmail`. Flag: missing trigger type in manifest for a planned entry point, homepage handler that crashes on missing `e.gmail`, contextual handler missing token set, function names in manifest don't match any planned function, OAuth scopes don't cover all planned Gmail operations. N/A: not a Gmail add-on (web app or Sheets-only).

---

### Documentation

**Q37: Does project documentation need updating?** (1, GAS)
Identify affected project docs: MEMORY.md, CLAUDE.md, README, JSDoc. Update when: API behavior changes, new conventions established, module responsibilities shift, new config patterns added. N/A: no behavior/API changes.

---

### Post-Implementation Review

**Q42: Is there a plan to review all changes after all code is applied?** (3, GAS, never N/A)
Plan must include a post-implementation section after all implementation steps:
(1) run `/review-fix` or `/gas-review` — loop until clean,
(2) run build/compile if applicable,
(3) run tests.
Steps 4–5 of CLAUDE.md POST_IMPLEMENT (fail recovery and COMMIT_SUGGESTED deferral) apply at runtime regardless of plan text — plan does not need to restate them.
Ensures regressions and secondary issues are caught before closing out the task.
Mandatory for all plans — cannot be skipped.

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
## Pass [N]/5

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
Converged: [Yes pass N / No max 5 reached]
Gate 1 (blocking):  [PASS / n NEEDS_UPDATE remaining]
Gate 2 (important): [PASS / n NEEDS_UPDATE remaining]
Gate 3 (advisory):  [n noted]
Rating: [READY / SOLID / GAPS / REWORK]
Score: [N]% (weighted percentage)
```

---

## After Review Completes (standalone mode only)

After outputting the Final Scorecard:

1. **REWORK gate:** If Rating is REWORK (any Gate 1 NEEDS_UPDATE remaining after convergence):
   AskUserQuestion listing the unresolved Gate 1 questions. User must explicitly resolve each
   issue or override before proceeding. Do NOT write the marker or call ExitPlanMode until the
   user responds. If user resolves: apply edits and re-evaluate. If user overrides: note override
   in scorecard and proceed.

2. Use the Bash tool to run: `touch ~/.claude/.plan-reviewed` — writes the gate marker so ExitPlanMode will pass
3. **Team teardown:** Send shutdown_request to all evaluator agents, then call TeamDelete. (Teardown must complete before ExitPlanMode — the session context needed for TeamDelete is not available after exiting plan mode.)
4. **Call ExitPlanMode immediately.** Do not pause, do not ask "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
