---
name: review-plan
description: |
  Universal plan review: 3 layers (general quality, code change quality, GAS specialization).
  All plans are assumed to involve code changes. Invokes gas-plan conditionally when GAS
  patterns detected.

  AUTOMATICALLY INVOKE when:
  - MANDATORY_PRE_EXIT_PLAN directive applies (before ExitPlanMode)
  - User says "review plan", "check plan", "plan ready?"
  - Any plan file needs review (GAS or non-GAS)

  NOT for: Code review of existing files (use /gas-review or /review-fix)
model: opus
allowed-tools: all
---

# Universal Plan Review: Convergence Loop

You apply a 3-layer quality review to any implementation plan: general quality, code change
quality, and conditional GAS specialization via gas-plan when GAS patterns are detected.
You iterate until all layers and sub-skills report zero changes in the same pass.

**You MUST loop. NEVER output the final scorecard until exit criteria are met.**

---

## Step 0: Locate Plan and Load Context

1. **Find the plan file:**
   - If an argument was passed (file path), use it directly
   - Otherwise: `Glob("~/.claude/plans/*.md")` → pick the most recently modified
   - Read the plan file fully

2. **Load standards context:**
   - Read `~/.claude/CLAUDE.md` for directives and conventions
   - Read `~/.claude/projects/-Users-jameswiese/memory/MEMORY.md` for patterns

3. **Set context flags** (scan plan text for patterns):
   ```
   IS_GAS = any of: .gs refs | mcp__gas__ | scriptId | SpreadsheetApp | DriveApp |
            GmailApp | ScriptApp | HtmlService | __events__ | __global__ |
            google.script.run | createGasServer | appsscript.json | "Apps Script" |
            "Google Apps Script"

   HAS_UI = any of: sidebar | dialog | HTML | CSS | UI | frontend | client-side

   [future: IS_SEC, HAS_API]
   ```

4. **Initialize tracking:**
   ```
   pass_count = 0
   last_gas_plan_hash = ""   ← hash of plan when gas-plan last ran
   ```

---

## Convergence Loop

```
DO:
  pass_count += 1
  changes_this_pass = 0
  l1_changes = 0
  l2_changes = 0
  gas_plan_changes = 0

  Print: "Pass [pass_count/5]: evaluating..."

  [ Layer 1: General Quality ]   ← always, every pass
  [ Layer 2: Code Change Quality ] ← always, every pass
  [ Key Questions: Sub-Skill Invocations ]
  [ Consolidate ]
  RE-READ plan

  Print: "Pass [pass_count] complete — [changes_this_pass] changes  (L1: [l1_changes], L2: [l2_changes], gas-plan: [gas_plan_changes])"

WHILE changes_this_pass > 0 AND pass_count < 5
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do NOT re-evaluate content already marked `<!-- review-plan -->` or `<!-- gas-plan -->`.

---

## Layer 1: General Quality

*7 questions. Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? | never |
| Q-G3 | Post-impl review | Plan includes `/review-fix` (or `/gas-review` for GAS) step after all changes? | never |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | — |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |

Count L1 edits → `l1_changes += count`; `changes_this_pass += l1_changes`

---

## Layer 2: Code Change Quality

*25 questions. Applies to every plan (code changes assumed).*

**Triage shortcuts — mark N/A proactively:**
- no UI/client logic → N/A Q-C17, Q-C25
- no deployment → N/A Q-C6, Q-C7
- single atomic change → N/A Q-C5, Q-C9
- read-only ops → N/A Q-C18, Q-C19
- no new APIs/services → N/A Q-C22, Q-C23
- local-only changes → N/A Q-C24

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C1 | Branching strategy | Branch named, merge target, PR workflow defined? | never |
| Q-C2 | Branching usage | Steps actually use feature branch + incremental commits? | never |
| Q-C3 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C4 | Tests updated | Interface/bug/new-function changes have matching test updates? | pure visual |
| Q-C5 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C6 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C8 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C9 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C12 | Duplication | No reimplementation of existing utilities? | no new functions |
| Q-C13 | State edge cases | State-exists AND state-absent cases covered for persistent storage? | no storage |
| Q-C14 | Bolt-on vs integrated | New code extends existing modules; not isolated additions? | purely additive |
| Q-C15 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | Error handling | Try/catch on external calls; actionable messages; fail-loud noted? | no new error paths |
| Q-C17 | Event listener cleanup | Listeners removed to prevent accumulation/leaks? | no new listeners |
| Q-C18 | Concurrency | Shared state locked; background tasks have concurrency plan? | read-only |
| Q-C19 | Idempotency | Operations safe to retry; data mutations deduped? | read-only |
| Q-C20 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? | bounded ops |
| Q-C22 | Auth/permission additions | New scopes or permissions noted with user impact? | no new services |
| Q-C24 | Local↔remote sync | Sync strategy explicit for local→remote pushes? Stale reads avoided? | local-only |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C23 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C25 | UI error boundary | Client-side error handler for silent failures? (window.onerror, try/catch around init) | no new client logic |

Count L2 edits → `l2_changes += count`; `changes_this_pass += l2_changes`

---

## Key Questions: Sub-Skill Invocations

### Q-GAS: GAS Specialization

```
current_plan_hash = hash(plan_content)

IF IS_GAS AND current_plan_hash ≠ last_gas_plan_hash:
  → Task(subagent_type="gas-plan", prompt="Review plan at <path>. Return a list of changes made. Do NOT write any marker file and do NOT call ExitPlanMode — just return your findings.")
  → gas-plan runs its own internal convergence loop, then returns
  → Incorporate all gas-plan findings into the plan
  → Update last_gas_plan_hash = current_plan_hash
  → gas_plan_changes = count of changes incorporated
  → changes_this_pass += gas_plan_changes

ELSE (IS_GAS is false, OR hash unchanged since last gas-plan run):
  → gas_plan_changes = 0   ← contributes nothing this pass
```

**Consolidation:** After gas-plan returns, merge its findings with L1/L2. Remove true duplicates
(same concern raised by both L2 and gas-plan). Keep gas-plan's more specific GAS framing where
both are present.

### Q-SEC, Q-UI (future)
Reserved slots — follow same pattern as Q-GAS when implemented.

---

## Consolidate and RE-READ

After all layers complete for this pass:
1. Merge overlapping findings; remove duplicate annotations
2. RE-READ the full consolidated plan
3. Print pass summary

---

## Exit Criteria

**Converge** when ANY of:
- `changes_this_pass == 0` (all layers + sub-skills quiet in same pass)
- `pass_count == 5` (max reached)

---

## Output: Unified Scorecard

```
## review-plan Scorecard

### Passes: [N] (converged / max reached)

### Gate 1 — Blocking
[PASS] or [N NEEDS_UPDATE remaining]
- Q-G1 Approach soundness: [status]
- Q-G2 Standards compliance: [status]
- Q-G3 Post-impl review: [status]
- Q-C1 Branching strategy: [status]
- Q-C2 Branching usage: [status]
- Q-C3 Impact analysis: [status]

### Gate 2 — Important
[PASS] or [N NEEDS_UPDATE remaining]
[list applicable questions with status]

### Gate 3 — Advisory
[N noted]
[list applicable questions]

### GAS Specialization (gas-plan)
[NOT INVOKED — no GAS patterns detected]
OR
[PASS — converged after N gas-plan passes]
OR
[N NEEDS_UPDATE remaining]

### Rating
READY   — Gate 1 + Gate 2 all PASS
SOLID   — Gate 1 PASS, ≤ 2 Gate 2 NEEDS_UPDATE
GAPS    — Gate 1 PASS, > 2 Gate 2 NEEDS_UPDATE
REWORK  — any Gate 1 NEEDS_UPDATE
```

---

## After Review Completes

After outputting the Final Scorecard:
1. Use the Bash tool to run: `touch ~/.claude/.plan-reviewed` — writes the gate marker so ExitPlanMode will pass
2. **Call ExitPlanMode immediately.** Do not pause, do not ask the user "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
