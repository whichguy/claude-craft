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

  **NOT for:** Code review (use /gas-review),
  prompt analysis (use /review-bench:improve-prompt --mode critique), non-GAS plans

  **mode parameter:**
  - `standalone` (default): TeamCreate + parallel evaluators + convergence loop + ExitPlanMode
  - `evaluate`: Single-pass read-only evaluation — returns findings via SendMessage to calling
    team-lead. No edits, no team creation, no ExitPlanMode. Used internally by review-plan.
model: claude-sonnet-4-6
allowed-tools: all
---

# GAS Plan Review: Iterative Convergence Loop

You review implementation plans from two perspectives per pass: **frontend engineer** (HTML/CSS/UX) and **GAS engineer** (backend/infrastructure). Both perspectives evaluate in parallel each convergence pass via spawned evaluator agents.

*Evaluate mode (used internally by review-plan) is handled by EVALUATE.md — this file is standalone only.*

## Core Directive: Loop Until Stable

Loop until convergence. Do not output the final scorecard until exit criteria are met.

## Step 0: Locate Plan and Load Context

1. **Plan file**: Check skill arg. If empty, use `Glob("~/.claude/plans/*.md")` and pick the most recently modified file. If no plan files exist, ask the user via AskUserQuestion.
2. **Standards context** (cache for all passes):
   - Read `~/.claude/CLAUDE.md`
   - Find and read the project memory file:
     `Glob("~/.claude/projects/*/memory/MEMORY.md")` → read most recently modified
     (skip gracefully if none found)
   - Path variables (substitute into evaluator prompts at spawn time, same as `<plan_path>`):
     - `<questions_path>`: `~/.claude/skills/gas-plan/QUESTIONS.md`
       (`~` makes this portable across users; update here if install base changes)
3. **Read the plan** and identify domains present (UI changes? new files? deployment? common-js edits?) for triage.

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
  Do not leave orphaned team processes.
```

### Perspective Assignments

Each question is owned by one perspective or shared. Tags: `[F]` = Frontend, `[G]` = GAS, `[Shared]` = both.

**Frontend evaluator** — HTML/CSS/UX focus:
- Primary: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36
- Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41
- Note: Q43 (plan legibility) is evaluated post-loop, not by this evaluator during convergence passes.

**GAS evaluator** — backend/infrastructure focus:
- Primary: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42, Q44, Q45, Q46, Q47, Q48, Q49, Q50, Q51, Q52, Q53, Q54
- Shared (backend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

**Shared questions** (Q13, Q15, Q16, Q27, Q28, Q38, Q41): Both evaluators report on these. Team-lead merges: combine findings, keep the more actionable wording. Q47 (card navigation) is a Gmail-domain GAS-primary question — not in the shared list above. GAS evaluator covers it when active (bulk N/A when no Gmail add-on); frontend evaluator covers it only in the GAS-skipped fallback (see triage shortcut below).

**Triage shortcut — evaluator skip:**
- No UI/HTML/CSS changes → skip frontend evaluator entirely. Mark all frontend-owned questions N/A in pass summary (Q14, Q30-Q36; Q43 is post-loop and not part of convergence pass scoring). Shared question coverage: GAS evaluator evaluates all 7 non-Gmail shared Qs from both lenses (Q13, Q15, Q16, Q27, Q28, Q38, Q41 — Q47 only when Gmail add-on present; see GAS evaluator prompt fallback instruction).
- No .gs/deployment/common-js changes → skip GAS evaluator entirely. Mark all GAS-owned questions N/A in pass summary. Shared question coverage: frontend evaluator evaluates all 7 non-Gmail shared Qs (Q13, Q15, Q16, Q27, Q28, Q38, Q41 — Q47 is Gmail-domain, skip when no Gmail add-on; if Gmail add-on IS present and GAS evaluator is skipped, frontend evaluator also evaluates Q47 from both lenses; see frontend evaluator IMPORTANT block).

**Triage shortcut — question-level bulk N/A:** No new CSS → mark Q34 N/A without individual evaluation. No new interactive elements → mark Q31 N/A. No Gmail add-on/CardService patterns → bulk N/A Q44-Q48 (Q47 is GAS-primary, not a shared question — Gmail-domain bulk N/A applies here). All other shared questions are never bulk-N/A'd.

**Never-N/A exception:** Q1, Q2, Q42 are marked "never N/A" and are evaluated regardless of domain triage. If the GAS evaluator is skipped, the team-lead evaluates Q1, Q2, Q42 directly before the merge step.

### Execution Flow

```
STEP 0: (done — plan loaded, team created)
  plan_path = <absolute filesystem path resolved in Step 0>
  team_name = <team_name created above>
  pass_count = 0
  prev_needs_update_count = null; prev_needs_update_set = []
  pass1_needs_update_set = []      # snapshot after pass 1 for resolved_questions computation
  total_changes_all_passes = 0     # running sum; increment by changes_this_pass after each pass's edits
  gas_memoized_questions = set()   # Q1, Q2, Q42 once confirmed stable PASS/N/A
  gate1_gas = {"Q1", "Q2", "Q13", "Q15", "Q18", "Q42"}  # defined once; used in stability-memoization check
  gas_memoized_since = {}          # pass_count when each was memoized
  prev_gas_results = {}            # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass (for stability-based memoization)
  spawned_evaluators = []          # names of agents actually launched (for precise teardown)
  results = {}                     # maps Q-ID → "PASS" | "NEEDS_UPDATE" | "N/A" — rebuilt each pass
  user_already_asked_gate1 = false # prevents asking user twice at pass_count >= 5
  incomplete_had_needs_update_last_pass = false # set per-pass; prevents false convergence when Incomplete evaluator had NEEDS_UPDATE last pass
  memo_file = "~/.claude/.gas-plan-memo-" + timestamp + ".json"
  # memo_file: checkpoint written after each pass for context-compression resilience.
  # If state is lost mid-loop (long reviews): re-read memo_file at start of next pass.
  Substitute plan_path, team_name, and questions_path (all derived in Step 0) into all evaluator prompts below before spawning.

DO:
  -- Context-compression recovery: if memoized state appears lost, restore from checkpoint --
  _recovered_this_pass = false
  IF memo_file exists AND gas_memoized_questions is empty AND prev_needs_update_count == null:
    Read memo_file → restore gas_memoized_questions, gas_memoized_since,
                     prev_needs_update_count, prev_needs_update_set, pass_count,
                     prev_gas_results (default {} if missing)
    _recovered_this_pass = true
    Print: "⚠️ Context recovery: restored memoized state from checkpoint (pass [pass_count])"

  IF NOT _recovered_this_pass:
    pass_count = pass_count + 1
  CLEAR: current_needs_update_count = 0; current_needs_update_set = []; changes_this_pass = 0; incomplete_had_needs_update_last_pass = false
  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5]: evaluating..."
  TRIAGE: Determine which evaluators are active based on domain analysis.
  Print: "  Spawning: " + (frontend active? "frontend" : "⏭️ frontend") + " · " + (gas active? "gas" : "⏭️ gas")

  -- Memoized directive construction --
  memoized_directive = ""
  IF gas_memoized_questions is non-empty:
    ids = comma-sep sorted Q-IDs from gas_memoized_questions (e.g. "Q1, Q2, Q42")
    pass_notes = join([q + " (since pass " + gas_memoized_since[q] + ")" for q in sorted gas_memoized_questions])
    memoized_directive = "Memoized questions — SKIP (stable PASS since pass [N]): " + ids + "\n(" + pass_notes + ")\nTreat as PASS in your output — do not re-evaluate."
    (substitute actual pass numbers from gas_memoized_since[q_id] for each Q-ID before injecting)

  [In a SINGLE message, spawn active evaluators as PARALLEL Task calls]
  [Substitute the actual resolved plan_path and questions_path values into each prompt before spawning]
  [If memoized_directive is non-empty, inject it into each evaluator prompt before the Constraints section]
  [After spawning each evaluator, append its name to spawned_evaluators]

  --- Frontend Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    model = "claude-sonnet-4-6",
    team_name = <team_name>,
    name = "frontend-evaluator-p" + pass_count,
    prompt = """
      You are a senior frontend engineer evaluating a GAS implementation plan.

      Your inputs:
      - Question definitions: Read <questions_path> for the full question
        table (questions marked [F] and [Shared])
      - Standards: Read only the GAS Development and GAS Client-Server Patterns sections of
        ~/.claude/CLAUDE.md as needed (skip unrelated sections)

      Evaluate these questions through the FRONTEND lens:
        Frontend-owned: Q14, Q30, Q31, Q32, Q33, Q34, Q35, Q36
        Shared (frontend lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41
        Note: Q43 (plan legibility) is evaluated post-loop — do not evaluate it here.

      Triage: If plan has no UI/HTML/CSS changes → bulk N/A Q14, Q30-Q36.
              Evaluate shared Qs regardless.

      IMPORTANT — if GAS evaluator was skipped this pass (no .gs/deployment/common-js changes):
        Also evaluate Q13, Q15, Q16, Q27, Q28, Q38, Q41 from the GAS engineering lens.
        If the plan also contains Gmail add-on/CardService patterns, also evaluate Q47 from both lenses.
        Output each shared question twice: first your frontend finding, then your GAS finding.
        Label clearly: "[Frontend lens]" and "[GAS lens]". Team-lead merges both.

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

      Do not write findings to stdout — the team-lead only receives content via SendMessage.

      [MEMOIZED_DIRECTIVE — team-lead injects memoized_directive here if non-empty.
       This directive OVERRIDES the question list above — memoized questions are PASS
       regardless of what the plan says. Do not re-evaluate them.]

      Constraints:
      - Do not use Edit, Write, or Bash tools — read-only evaluation
      - Do not call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- GAS Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    model = "claude-sonnet-4-6",
    team_name = <team_name>,
    name = "gas-evaluator-p" + pass_count,
    prompt = """
      You are a senior GAS backend engineer evaluating a GAS implementation plan.

      Question definitions: Read <questions_path> for the full question
        table (questions marked [G] and [Shared]) — includes GAS Gotchas reference.
      Standards: Read only the GAS Development, MCP GAS Architecture, and GAS Client-Server
        Patterns sections of ~/.claude/CLAUDE.md as needed (skip unrelated sections).

      Evaluate these questions through the GAS engineering lens:
        GAS-owned: Q1-Q12, Q17-Q26, Q29, Q37, Q39-Q40, Q42, Q44, Q45, Q46, Q47, Q48, Q49, Q50, Q51, Q52, Q53, Q54
        Shared (GAS lens): Q13, Q15, Q16, Q27, Q28, Q38, Q41

      Triage: If plan has no .gs/deployment/common-js changes → bulk N/A GAS-specific Qs.
              If plan has no Gmail add-on/CardService patterns → bulk N/A Q44, Q45, Q46, Q47, Q48.
              Evaluate shared Qs regardless (Q47 is GAS-primary, not shared — bulk N/A when no Gmail).

      If frontend evaluator was skipped this pass (no UI/HTML/CSS changes):
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

      Do not write findings to stdout — the team-lead only receives content via SendMessage.

      [MEMOIZED_DIRECTIVE — team-lead injects memoized_directive here if non-empty.
       This directive OVERRIDES the question list above — memoized questions are PASS
       regardless of what the plan says. Do not re-evaluate them.]

      Constraints:
      - Do not use Edit, Write, or Bash tools — read-only evaluation
      - Do not call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  Wait for all active evaluator messages (90s reminder; after 120s total mark ⚠️ Evaluator Incomplete for any non-responding evaluator and proceed with available findings).
  Incomplete evaluator rule: An Incomplete evaluator contributes ZERO changes and ZERO findings
  to this pass. Pass CAN converge if responding evaluators returned 0 NEEDS_UPDATE AND the
  Incomplete evaluator returned 0 NEEDS_UPDATE in the immediately prior pass. If the Incomplete
  evaluator had NEEDS_UPDATE last pass: do NOT converge; spawn it again next pass.
  Incomplete state tracking:
  IF any evaluator was marked ⚠️ Evaluator Incomplete this pass:
    incomplete_evaluator_qs = [questions owned by the incomplete evaluator(s)]
    IF any q in incomplete_evaluator_qs is in prev_needs_update_set:
      incomplete_had_needs_update_last_pass = true

  -- Merge & Consolidate --
  COLLECT all NEEDS_UPDATE from both evaluator messages
  BUILD results dict:
    results = {}  # reset first — Never-N/A override runs after this, so its writes survive
    For each question reported by any evaluator this pass:
      results[q_id] = the status it reported ("PASS", "NEEDS_UPDATE", or "N/A")
    For questions not covered by any active evaluator (triage-skipped evaluator):
      results[q_id] = "N/A"
    For already-memoized questions: results[q_id] = "PASS" (carried forward from gas_memoized_questions)
  -- Never-N/A override (runs after BUILD so writes survive to memoization update) --
  never_na_findings = []
  IF GAS evaluator was skipped this pass (no .gs/deployment/common-js changes):
    FOR q_id IN ["Q1", "Q2", "Q42"]:
      IF q_id in gas_memoized_questions:
        results[q_id] = "PASS"  # already set by BUILD above; confirming invariant
        CONTINUE
      # Not memoized — evaluate directly:
      IF q_id == "Q1": check — does the plan name a branch and include a push-to-remote step? (blocking)
      IF q_id == "Q2": check — do the plan steps create a feature branch with incremental commits? (blocking)
      IF q_id == "Q42": check — does the plan include a post-implementation review section (/review or /gas-review + build + tests)? (blocking)
      Set results[q_id] = "PASS" or "NEEDS_UPDATE" based on the check above.
      IF results[q_id] == "NEEDS_UPDATE": never_na_findings.append(q_id)
    These three questions can never converge as N/A — any NEEDS_UPDATE here blocks exit.
  For shared questions (Q13, Q15, Q16, Q27, Q28, Q38, Q41) — whether flagged by both
    evaluators or reported with dual labels ([GAS lens]/[Frontend lens]) by a single evaluator
    in the evaluator-skipped case:
    Combine into single finding; keep the more actionable wording. (Rationale: "more actionable
    wins" — both perspectives have domain-appropriate framing; choose clearest for implementer.)
  For Q47 (GAS-primary, Gmail-domain) — only in the evaluator-skipped + Gmail-present case:
    If frontend evaluator was skipped and Gmail add-on is present, frontend evaluator reported
    Q47 with dual labels ([GAS lens]/[Frontend lens]). Combine into single finding, same rule.
    In all other cases (both evaluators active, or no Gmail): Q47 is a single GAS finding only.
  APPLY edits — for each [EDIT: ...] instruction in any evaluator message:
    Call the Edit tool on the plan file to insert/modify the specified content.
    Mark each insertion <!-- gas-plan -->.
    Each Edit call = 1 change (increment changes_this_pass). Do not count findings you only described in text.
  total_changes_all_passes += changes_this_pass
  CONSOLIDATE plan (see Consolidation Rules below)
  RE-READ consolidated plan
  SET current_needs_update_set = (Q numbers flagged NEEDS_UPDATE from evaluator messages) UNION never_na_findings
  SET current_needs_update_count = len(current_needs_update_set)
  IF pass_count == 1: pass1_needs_update_set = current_needs_update_set[:]  # snapshot for resolved_questions
  PLATEAU = (prev_needs_update_count != null) AND (current_needs_update_count == prev_needs_update_count) AND (sameQNumbers(current_needs_update_set, prev_needs_update_set))  # set equality: order-independent; sameQNumbers = both arrays contain identical Q-number strings regardless of order
  prev_needs_update_count = current_needs_update_count; prev_needs_update_set = current_needs_update_set
  Print pass summary using per-pass template

  -- Post-pass memoization update --
  # Q1 + Q2: branching (additive-only — once branch + commits present, never removed)
  FOR q_id IN ["Q1", "Q2"]:
    IF results[q_id] in [PASS, N/A] AND q_id NOT in gas_memoized_questions:
      gas_memoized_questions.add(q_id)
      gas_memoized_since[q_id] = pass_count
  # Q42: post-impl review section (additive-only — same reasoning as Q-NEW in review-plan)
  IF results["Q42"] in [PASS, N/A] AND "Q42" NOT in gas_memoized_questions:
    gas_memoized_questions.add("Q42")
    gas_memoized_since["Q42"] = pass_count

  # Stability-based memoization for Gate 2/3 questions (post-pass 2)
  # If a Gate 2 or Gate 3 question returned PASS/N/A in BOTH the previous pass AND this pass
  # (with plan edits applied between them), it's empirically stable — safe to memoize.
  # Gate 1 questions are NEVER stability-memoized (too important to skip based on heuristic).
  # gate1_gas defined in STEP 0 above — not redefined here.
  IF pass_count >= 2:
    FOR q_id in results:
      IF q_id in prev_gas_results:
        IF prev_gas_results[q_id] in [PASS, N/A] AND results[q_id] in [PASS, N/A]:
          IF q_id NOT in gate1_gas:
            IF q_id NOT in gas_memoized_questions:
              gas_memoized_questions.add(q_id)
              gas_memoized_since[q_id] = pass_count
  prev_gas_results = results  # Set LAST — after stability check reads it

  -- Checkpoint: persist memoized state for context-compression resilience --
  Write memo_file with JSON: {
    pass_count, gas_memoized_questions: [...gas_memoized_questions],
    gas_memoized_since, prev_needs_update_count,
    prev_needs_update_set: [...prev_needs_update_set],
    prev_gas_results
  }

  -- CONVERGENCE CHECK --
  Gate1_unresolved = count of NEEDS_UPDATE on Q1, Q2, Q13, Q15, Q18, Q42 (all weight-3 questions)
  IF pass_count >= 5:
    IF Gate1_unresolved > 0:
      IF NOT user_already_asked_gate1:
        user_already_asked_gate1 = true
        AskUserQuestion listing the unresolved Gate 1 questions.
        Wait for user response.
        IF user resolves: apply edits, re-evaluate (one final pass), update scorecard, then BREAK
        IF user overrides: annotate scorecard with override, then BREAK
      ELSE:
        # Already asked once — do not ask again; break with current state
        Print: "⚠️ Gate 1 unresolved after user response — breaking with REWORK rating."
        BREAK
    ELSE:
      Print: "✅ Hard stop — max 5 passes reached, Gate 1 clear."
      BREAK
  IF Gate1_unresolved > 0:
    CONTINUE (never exit with Gate 1 open, even if PLATEAU)
  IF (PLATEAU OR current_needs_update_count == 0) AND NOT incomplete_had_needs_update_last_pass:
    elapsed = Math.round((Date.now() - timestamp) / 1000)
    IF pass_count == 1:
      Print: "✅ Converged — no issues found (pass 1, [elapsed]s)"
    ELSE:
      resolved_questions = pass1_needs_update_set - current_needs_update_set
      Print: "✅ Converged after [pass_count] passes ([elapsed]s | [total_changes_all_passes] total changes)"
      IF resolved_questions is non-empty:
        Print: "Resolved: [comma-separated resolved_questions sorted by ID]"
      Print: "Gate 1: ✅ Clean | Gate 2: ✅ [n Gate2 PASS] PASS | Advisory: [n noted] noted"
    BREAK
  -- END CHECK --

WHILE TRUE (loop controlled by convergence check above)

OUTPUT final scorecard

# ⚠️ Do not execute teardown from here. Jump to "After Review Completes" section below.
# That section handles: Q43 post-loop evaluation → gate marker → teardown → ExitPlanMode.
# The TEARDOWN pseudo-block below is a conceptual placeholder only.
TEARDOWN: (see "After Review Completes" steps 2–5 for the actual teardown sequence)
```

### Worked Example

```
Pass 1/5: evaluating...
  [Spawning frontend-evaluator-p1 + gas-evaluator-p1 in parallel]
  [frontend-evaluator-p1 findings]: 1 NEEDS_UPDATE (Q34) -- `.btn` conflicts with Google CSS
  [gas-evaluator-p1 findings]: 3 NEEDS_UPDATE (Q1, Q9, Q19) -- no branch named, no merge strategy, no push-to-remote step; no deploy target; stub function
  -> Build results: {Q34: NEEDS_UPDATE, Q1: NEEDS_UPDATE, Q9: NEEDS_UPDATE, Q19: NEEDS_UPDATE, Q2: PASS, Q42: PASS, ...}
  -> Merge: shared Qs all PASS in both — no merge needed
  -> Edits: add CSS namespace note (Q34), add branching section + merge strategy + push-to-remote + deployment target + implementation spec (Q1, Q9, Q19)
  -> Consolidate: merge deployment + rollback into single section
  -> Memoize post-pass: Q2 PASS → gas_memoized_questions={Q2}, Q42 PASS → gas_memoized_questions={Q2, Q42}
  N/A: 12 | Stable PASS: 27 | ⏭️ Memoized: none
Pass 2/5: evaluating...
  [Memoized directive injected: "Memoized questions — SKIP (stable PASS since pass 1): Q2, Q42 (Q2 since pass 1, Q42 since pass 1) — Treat as PASS in your output."]
  [Spawning frontend-evaluator-p2 + gas-evaluator-p2 in parallel]
  [frontend-evaluator-p2 findings]: 0 NEEDS_UPDATE
  [gas-evaluator-p2 findings]: 1 NEEDS_UPDATE (Q12) -- incremental verification missing; Q2, Q42: PASS (memoized, skipped)
  -> Build results: {Q12: NEEDS_UPDATE, Q1: PASS, Q2: PASS (memoized), Q42: PASS (memoized), ...}
  -> Edit: add exec checkpoint after each push step
  -> Consolidate: no duplicates found
  -> Memoize post-pass: Q1 PASS → gas_memoized_questions={Q1, Q2, Q42}
  N/A: 12 | Stable PASS: 30 | ⏭️ Memoized: Q2, Q42 (not re-evaluated this pass)
Pass 3/5: evaluating...
  [Memoized directive injected: "Memoized questions — SKIP (stable PASS): Q1 (since pass 2), Q2 (since pass 1), Q42 (since pass 1)"]
  [Spawning frontend-evaluator-p3 + gas-evaluator-p3 in parallel]
  [frontend-evaluator-p3 findings]: 0 NEEDS_UPDATE
  [gas-evaluator-p3 findings]: 0 NEEDS_UPDATE; Q1, Q2, Q42: PASS (memoized, skipped)
  N/A: 12 | Stable PASS: 31 | ⏭️ Memoized: Q1, Q2, Q42 (not re-evaluated this pass)
  -> CONVERGED at pass 3. Output final scorecard.
[Post-loop] Q43 evaluator spawned → PASS — steps are numbered, code blocks fenced.
Organization Quality (Q43): PASS
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

See `shared/self-referential-protection.md` — read at `~/.claude/skills/shared/self-referential-protection.md` (skip gracefully if not found) for the canonical protection policy.

If shared file is not found, use inline policy: mark all `<!-- gas-plan -->` content as review metadata, not production code; do not re-evaluate it. Do not flag review-added sections as needing tests (Q11), impact analysis (Q18), implementation (Q19), dead code removal (Q20), duplication checks (Q39), state edge cases (Q40), or integration checks (Q41).

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

**Gate 1 — Blocking (weight 3, must all PASS):**
Q1 branching strategy [G] | Q2 branching usage [G] | Q13 standards [Shared] | Q15 simplicity [Shared] | Q18 impact analysis [G] | Q42 post-impl review [G]
*(Note: When gas-plan runs inside review-plan as gas-evaluator, the effective IS_GAS Gate 1 also includes Q-G3 — evaluated by l1-evaluator, not gas-plan.)*

**Gate 2 — Important (weight 2, must stabilize):**
Q3 sync [G] | Q4 folders+ordering [G] | Q5 right tools [G] | Q6 exec verify [G] | Q7 common-js sync [G] | Q9 deployment [G] | Q10 rollback [G] | Q11 tests [G] | Q12 incremental verify [G] | Q16 interfaces [Shared] | Q17 step ordering [G] | Q19 empty code [G] | Q20 dead code [G] | Q21 concurrency [G] | Q22 execution limit [G] | Q23 OAuth scopes [G] | Q24 idempotent [G] | Q27 input validation [Shared] | Q28 error handling [Shared] | Q29 logging [G] | Q32 event listeners [F] | Q38 unintended consequences [Shared] | Q39 duplication [G] | Q40 state-exists+absent [G] | Q41 bolt-on vs merge [Shared] | Q44 card structure [G] | Q45 action handlers [G] | Q46 token access [G] | Q47 navigation [G] | Q48 trigger coverage [G] | Q49 V8 parsing order [G] | Q50 namespace collision [G] | Q52 execution mechanism [G] | Q53 container-bound separation [G] | Q54 GCP project [G]

**Gate 3 — Advisory (weight 1, note only):**
Q8 isolated state [G] | Q14 naming [F] | Q25 quotas [G] | Q26 storage limits [G] | Q30 UX feedback [F] | Q31 accessibility [F] | Q33 error boundary [F] | Q34 CSS conflicts [F] | Q35 LLM comments [F] | Q36 breadcrumbs [F] | Q37 documentation [G] | Q43 plan legibility [F] [post-loop] | Q51 debug logging [G]

**Triage shortcut — evaluator skip:** See Perspective Assignments above. Shared questions are never bulk-N/A'd.
**Triage shortcut — question-level bulk N/A:** Bulk-mark specific questions N/A when clearly irrelevant (no UI changes → skip Q14, Q30-Q36; no new files → skip Q4; no deployment → skip Q10). Shared questions are never bulk-N/A'd. Note: Q43 is evaluated post-loop only — not during convergence passes.

---

### Git & Version Control

**Q1: Is there a branching/merging strategy?** (3, GAS, never N/A)
All changes get a branch. Plan must name the branch, merge target, PR workflow, and merge
strategy (squash / rebase / merge commit). Push-to-remote step must be explicit.

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
HTML files must use `write({..., raw: true})` (not plain `write` which adds CommonJS wrappers). `.gs` files use `write` without `raw: true`. `cat` paths must omit `.gs` extension. N/A: no file push/read operations.

**Q6: Is there exec verification after each push?** (2, GAS)
Each write (or `write({..., raw:true})`) must be followed by an exec to verify code loads. Push does not mean it works. N/A: no remote pushes.

**Q7: If editing common-js modules, are mcp_gas templates also updated?** (2, GAS)
CLAUDE.md: `COMMON-JS_SYNC`. Changes to shared modules must include dual updates. N/A: no common-js edits.

**Q8: Does the plan account for GAS isolated execution state?** (1, GAS)
Each `exec()` has isolated global state -- no persistence between calls. Data must go through Properties/Cache. N/A: no cross-exec state needed.

**Q49: Does the plan respect V8 file parsing order?** (2, GAS)
If any new file is added, or any file's position changes, verify that no loadNow module ends up with dependencies at higher file positions. loadNow modules must be positioned LAST, after all their transitive dependencies. Symptom of failure: "Module not found" at startup even though ls() shows the file exists.
N/A: plan adds no new files AND changes no file positions AND no loadNow modules exist in the project.

---

### Deployment & Rollback

**Q9: Is the deployment defined with target environment?** (2, GAS)
GAS changes need push/deploy steps: write/write({...,raw:true})/rsync, exec verification, target env (dev/staging/prod). N/A: local-only files.

**Q10: Is there a rollback plan if deployment goes wrong?** (2, GAS)
Recovery path: revert commit + redeploy, versioned rollback, or hold previous deployment. Flag doGet/doPost/__events__ changes without rollback note. N/A: no deployment.

---

### Testing & Verification

**Q11: Are tests updated for these changes?** (2, GAS)
Interface changes need test updates. Bug fixes need regression tests. New functions need new tests. N/A: pure CSS/HTML visual changes.

**Q12: Is there incremental verification at each step?** (2, GAS)
Each step must have a checkpoint (exec, test, manual check). Flag all-testing-at-end. N/A: single atomic change.
For plans that modify sidebar/HTML files (sheets-sidebar/, common-js/html/): verification steps should reference the gas-sidebar skill procedures (launch sidebar → send prompt → wait for response → read response). A plan that says "open the sidebar and check it works" without citing the concrete gas-sidebar workflow is insufficient — the sidebar runs in a cross-origin iframe and requires specific DevTools automation patterns.

---

### Standards & Conventions

**Q13: Does the plan adhere to project standards and conventions?** (3, Shared, never N/A)
CLAUDE.md: CommonJS wrappers, `__events__`, `loadNow:true`, `write({..., raw:true})` for HTML, `createGasServer/exec_api`.
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

**Q50: Does the plan introduce any GAS global namespace collision?** (2, GAS)
Check: do any new or modified modules declare top-level vars/consts whose names match GAS built-in globals (Logger, Utilities, DriveApp, SpreadsheetApp, ScriptApp, UrlFetchApp, CacheService, PropertiesService, LockService, HtmlService, ContentService, MailApp, GmailApp, etc.)? loadNow modules are highest risk since they run at parse time. Also check require() aliases — `const Logger = require(...)` at module top level is safe; `var Logger = ...` outside a function is not.
N/A: plan adds no new modules AND no existing module is modified at its top-level scope.

**Q51: Do new modules use the 3-param _main signature for debug logging?** (1, GAS)
Any new CommonJS module (_main factory) should use `function _main(module, exports, log)`. The `log` param is auto-injected by require.js and is a no-op when not enabled — zero runtime cost. Plans that include debugging/testing steps should also show how to enable it:
  exec: setModuleLogging('folder/ModuleName', true)  // enable during test
  exec: setModuleLogging('folder/ModuleName', false, 'script', true)  // disable after
N/A: plan adds no new CommonJS modules (no new _main factory files).

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

**Q26: Are Properties/Cache payloads within actual limits?** (1, GAS)
PropertiesService: 524,288 chars/value, 512KB total per store, 500 keys max. CacheService: 102,400 bytes/value, 250-char key max, FIFO eviction (not LRU — hot keys can still be evicted). Exceeding these silently fails or throws with no clear error. N/A: plan does not read/write PropertiesService or CacheService.

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

**Q47: Is card navigation balanced (push/pop)?** (2, GAS)
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
(1) run `/review` or `/gas-review` — loop until clean,
(2) run build/compile if applicable,
(3) run tests.
Steps 4–5 of CLAUDE.md POST_IMPLEMENT (fail recovery and PR creation) apply at runtime regardless of plan text — plan does not need to restate them.
Ensures regressions and secondary issues are caught before closing out the task.
Mandatory for all plans — cannot be skipped.

---

## Rating

| Rating | Criteria |
|--------|----------|
| **READY** | Gate 1 all PASS + Gate 2 all PASS |
| **SOLID** | Gate 1 all PASS + Gate 2 ≤ 2 NEEDS_UPDATE |
| **GAPS** | Gate 1 all PASS + Gate 2 > 2 NEEDS_UPDATE |
| **REWORK** | Gate 1 has any NEEDS_UPDATE |

### Score

`(PASS_weight_sum) / (applicable_max_weight_sum) * 100` — summary metric alongside gate rating.
Q43 (weight 1) is included in applicable_max_weight_sum once evaluated post-loop; its result is appended to the scorecard separately under "Organization Quality (Q43)" but counts toward the score.

---

## Output Templates

### Per-Pass Template

Show only NEEDS_UPDATE items and status changes since last pass. Summarize stable/N/A as counts.

```
## Pass [N]/5

N/A: [count] | Stable PASS: [count] | ⏭️ Memoized: [comma-sep Q-IDs, or "none"] (not re-evaluated this pass)

  ✅ frontend  ✗[fn] ✓[fm] —[fk]   (or: ⏭️ frontend  skipped | ⚠️ frontend  timeout)
  ✅ gas       ✗[gn] ✓[gm] —[gk]   (or: ⏭️ gas  skipped | ⚠️ gas  timeout)

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
Rating: [🟢 READY / 🟡 SOLID / 🟠 GAPS / 🔴 REWORK]  [N]%
Converged: [Yes pass N / No max 5 reached]
Gate 1 (blocking):  [✅ PASS / ❌ n remaining]
Gate 2 (important): [✅ PASS / ❌ n remaining]
Gate 3 (advisory):  [n noted]
Organization Quality (Q43): [PASS | NEEDS_UPDATE — reason | ⚠️ timed out]  # appended by post-loop step 2; omit if N/A (< 3 steps)
```

---

## After Review Completes (standalone mode only)

After outputting the Final Scorecard:

1. **REWORK gate** (handled inside the convergence loop — not a post-loop step): Gate 1 is
   resolved by the `pass_count >= 5` branch inside the loop. By the time the loop exits, Gate 1
   is either clean or the user has been asked and responded. If Rating is REWORK when the loop
   exits (user override or unresolvable): note the override in the scorecard. Do not re-run the
   REWORK check here — it was already handled inside the loop.

2. **Q43 post-loop evaluation (plan legibility / organization):**
   [Substitute plan_path and questions_path (resolved in Step 0) before spawning]
   Spawn a single Task (general-purpose, current team_name):
   ```
   name: "q43-evaluator"
   prompt: Evaluate Q43 from <questions_path>.
           Q43 checks: Are steps numbered? Are code blocks fenced? Are section headers scannable?
           Are conditional branches (IF/ELSE) visually distinct? Are walls of prose present?
           Skip content marked <!-- gas-plan --> or <!-- review-plan -->.
           Return one of:
             PASS — [one-sentence reason]
             NEEDS_UPDATE — [specific edit instruction: what to add/change and where]
           Send findings via SendMessage to team-lead (type: message, recipient: team-lead).

           Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate Q43 above.
   ```
   Append "q43-evaluator" to spawned_evaluators.
   Wait for message (90s max). Timeout handling:
     IF no response after 90s:
       ⚠️ Q43 Evaluator Incomplete — proceed without Q43 evaluation.
       Add to scorecard: `Organization Quality (Q43): ⚠️ Evaluator timed out — skipped`
       Continue to step 3.
   IF NEEDS_UPDATE: apply one round of edits to the plan file.
   Add Q43 result to the Final Scorecard output under a new line:
   `Organization Quality (Q43): [PASS | NEEDS_UPDATE — reason]`

3. Use the Bash tool to run: `slug=$(basename '<plan_path>' .md) && echo '<plan_path>' > ~/.claude/plans/.review-ready-"$slug" && rm -f <memo_file>` — writes the slug-scoped gate file so ExitPlanMode will pass; second command removes the convergence checkpoint (no longer needed after loop exits)
4. **Team teardown:** Send shutdown_request to all agents in `spawned_evaluators` (only agents that were actually launched — triage-skipped evaluators and any agents not appended to spawned_evaluators are never targeted), then call TeamDelete. (Teardown must complete before ExitPlanMode — the session context needed for TeamDelete is not available after exiting plan mode.)
5. **Call ExitPlanMode immediately.** Do not pause, do not ask "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for the slug-scoped gate file (~/.claude/plans/.review-ready-{slug}) and blocks if not found. The PostToolUse hook deletes it on successful exit.
