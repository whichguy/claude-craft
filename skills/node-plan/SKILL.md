---
name: node-plan
description: |
  Dual-perspective Node.js/TypeScript plan review (TypeScript/API + Node runtime) with
  iterative convergence loop. 35 Node/TS-specific questions (N20/N21 naming+docs deferred
  to L2's Q-G6/Q-G7 which cover these universally).

  **AUTOMATICALLY INVOKE** when:
  - Any plan exists for Node.js or TypeScript changes
  - Plan references package.json, tsconfig.json, .ts files, npm/yarn/pnpm/bun
  - Plan targets Express, Fastify, NestJS, Next.js, or similar Node frameworks
  - Plan modifies async code, environment variables, or Node process lifecycle
  - User says "review plan", "check plan", "node-plan"

  **NOT for:** GAS plans (use /gas-plan), code review (use /review-fix), non-Node plans

  **mode parameter:**
  - `standalone` (default): TeamCreate + parallel evaluators + convergence loop + ExitPlanMode
  - `evaluate`: Single-pass read-only evaluation — returns findings via SendMessage to calling
    team-lead. No edits, no team creation, no ExitPlanMode. Used internally by review-plan.
model: opus
allowed-tools: all
---

# Node.js/TypeScript Plan Review: Iterative Convergence Loop

You review implementation plans from two perspectives per pass: **TypeScript/API evaluator**
(types, async, packages, modules) and **Node runtime evaluator** (process, env, framework,
security). In standalone mode, both perspectives evaluate in parallel each convergence pass
via spawned evaluator agents. In evaluate mode, you do a single-pass evaluation yourself
and return findings to the calling skill.

## Mode Parameter

Two operating modes:
- **`standalone`** (default): Creates an evaluator team, runs parallel TypeScript + Node
  runtime evaluators each pass, merges findings, applies edits, converges, outputs final
  scorecard, calls ExitPlanMode.
- **`evaluate`**: Single-pass read-only evaluation run inside another skill's team. Evaluates
  all applicable questions (both perspectives), sends findings via SendMessage to team-lead,
  then stops. No plan edits. No ExitPlanMode. No team creation.

**How to detect mode:** Scan the invocation prompt for `mode=evaluate`. If found, set
MODE=evaluate. Otherwise MODE=standalone.

**WARNING:** If invoked inside an existing team (team_name present in invocation context), check for `mode=evaluate` before proceeding. Running standalone inside an existing team creates nested team conflicts and a circular ExitPlanMode race condition. When in doubt: if a team_name is present, force MODE=evaluate.

## Core Directive: Loop Until Stable

**In standalone mode: You MUST loop. NEVER output the final scorecard until exit criteria
are met. NEVER stop after one pass.**

## Step 0: Locate Plan and Load Context

1. **Check mode:** Scan invoking prompt for `mode=evaluate`. Set MODE accordingly.
2. **Plan file**: Check skill arg. If empty, use `Glob("~/.claude/plans/*.md")` and pick
   the most recently modified file. If no plan files exist, ask the user via AskUserQuestion.
3. **Standards context** (cache for all passes):
   - Read `~/.claude/CLAUDE.md`
   - Read project MEMORY.md from the project memory directory
4. **Read the plan** and identify domains present (new packages? async code? env vars?
   framework integration? deployment?) for triage.
5. **Branch on mode:** If MODE=evaluate → jump to [Mode: evaluate]. If MODE=standalone →
   jump to [Mode: standalone].

---

## Mode: evaluate

*Single-pass, read-only. Returns findings via SendMessage. No edits. No ExitPlanMode.*

**You are running inside another review skill's team. Your only output is a SendMessage to
the team-lead.**

**Nested team constraint:** Do NOT call TeamCreate in evaluate mode — you are already inside a team. Creating a nested team causes agent isolation and message delivery failures. If you detect you are being invoked inside an existing team (team_name present in context), evaluate mode is mandatory.

1. Read the plan file (done in Step 0).
2. Apply triage: bulk-mark N/A for irrelevant domains.
   - No TypeScript/package changes → bulk N/A N2, N3, N4, N5, N11, N12
   - No async code changes → bulk N/A N6, N7
   - No env var changes → bulk N/A N9, N10
   - No framework changes → bulk N/A N15, N16, N17
   - No new resources/connections → bulk N/A N13, N14, N18
   - No async code → bulk N/A N22, N23, N24, N25, N27, N28, N35
   - No new timers → bulk N/A N26
   - No deployment/containers → bulk N/A N31, N36
   - No secrets/credentials → bulk N/A N33
   - No API endpoint changes → bulk N/A N34
   - Not a monorepo → bulk N/A N30
   - No native addon packages → bulk N/A N32
   - Not a published library → bulk N/A N37
   - No new tests → bulk N/A N19
   - No file path operations → bulk N/A N29
   - Exception: N1 (tsc check) — evaluate regardless if plan involves any TS files.
   - For shared question (N8): evaluate from both lenses, combine findings.
3. Evaluate ALL applicable questions from BOTH perspectives in a single pass.
4. Skip content marked `<!-- node-plan -->` or `<!-- review-plan -->` (self-referential
   protection).
5. Call the **SendMessage** tool exactly once:
   ```
   type: "message"
   recipient: "team-lead"
   summary: "node-plan evaluation complete — N NEEDS_UPDATE"  (fill in count)
   content: |
     FINDINGS FROM node-plan

     [Triage] TypeScript/API domain: [ACTIVE | SKIPPED — reason]
     [Triage] Node runtime domain: [ACTIVE | SKIPPED — reason]

     N1: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
     [EDIT: specific instruction — where to add/change and what, if NEEDS_UPDATE]
     N2: ...
     ...
     N37: ... (N20, N21 not evaluated — covered by L2 Q-G6/Q-G7)
   ```
   Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

6. **STOP.** Do not loop. Do not edit the plan. Do not touch `.plan-reviewed`. Do not call
   ExitPlanMode.

---

## Mode: standalone

*Creates evaluator team, runs convergence loop, applies edits, outputs scorecard, calls
ExitPlanMode.*

### Team Setup

At the start of standalone mode (before the loop):
```
timestamp = Date.now()
team_name = "node-plan-" + timestamp
TeamCreate({team_name, description: "Node.js plan review — parallel TS + Node runtime evaluators"})
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

Each question is owned by one perspective or shared. Tags: `[TS]` = TypeScript/API,
`[NR]` = Node Runtime, `[Shared]` = both.

**TypeScript/API evaluator** — types, async, packages, modules:
- Primary: N1, N2, N3, N4, N5, N6, N7, N11, N12, N19, N29, N30, N32, N37
- Shared: N8

**Node runtime evaluator** — process, env, framework, security:
- Primary: N9, N10, N13, N14, N15, N16, N17, N18, N22, N23, N24, N25, N26, N27, N28,
           N31, N33, N34, N35, N36
- Shared: N8

**Shared question** (N8: Concurrency safety): Both evaluators report on N8. Team-lead
merges: combine findings, keep the more actionable wording.

**Triage shortcut — evaluator skip:**
- No TS/package changes → skip TypeScript evaluator entirely. Mark all TS-owned questions N/A in pass summary. Shared question coverage: Node runtime evaluator evaluates N8.
- No runtime/env/framework changes → skip Node runtime evaluator entirely. Mark all NR-owned questions N/A in pass summary. Shared question coverage: TypeScript evaluator evaluates N8.

**Triage shortcut — question-level bulk N/A:** No new timers → mark N26 N/A without individual evaluation. No file path operations → mark N29 N/A. Shared questions are NEVER bulk-N/A'd.

**Never-N/A exception:** N1 (TypeScript build check) MUST be evaluated whenever the plan
involves any TypeScript files, regardless of triage.

### Execution Flow

```
STEP 0: (done — plan loaded, team created)
  plan_path = <absolute filesystem path resolved in Step 0>
  team_name = <team_name created above>
  prev_needs_update_count = null; prev_needs_update_set = []
  pass_count = 0
  user_already_asked_gate1 = false
  Substitute plan_path and team_name into all evaluator prompts below before spawning.

DO:
  pass_count = pass_count + 1
  CLEAR: current_needs_update_count = 0; current_needs_update_set = []
  Print: "Pass [pass_count/5]: evaluating..."
  TRIAGE: Determine which evaluators are active based on domain analysis.

  [In a SINGLE message, spawn active evaluators as PARALLEL Task calls]
  [Substitute the actual resolved plan_path value into each prompt before spawning]

  --- TypeScript/API Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    model = "opus",
    team_name = <team_name>,
    name = "ts-evaluator-p" + pass_count,
    prompt = """
      You are a senior TypeScript/API engineer evaluating a Node.js/TypeScript implementation
      plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/node-plan/SKILL.md for the full question
        table (questions marked [TS] and [Shared])
      - Standards: Read only the Tool Preferences and relevant Node.js/TypeScript sections of
        ~/.claude/CLAUDE.md as needed (skip unrelated sections)

      Evaluate these questions through the TYPESCRIPT/API lens:
        TS-owned: N1, N2, N3, N4, N5, N6, N7, N11, N12, N19, N29, N30, N32, N37
        Shared (TS lens): N8

      Triage: If plan has no TypeScript/package changes → bulk N/A N2, N3, N4, N5, N11, N12.
              If plan has no new async code → bulk N/A N6, N7.
              If plan has no new tests → N/A N19.
              If plan has no file path operations → N/A N29.
              If plan is not a monorepo/workspace → N/A N30.
              If plan has no packages with native bindings → N/A N32.
              If plan is not a published library → N/A N37.
              Evaluate N1 if any TS files are involved, regardless of triage.
              Evaluate shared N8 regardless.

      Self-referential protection: Skip content marked <!-- node-plan --> or <!-- review-plan -->.

      Output contract — call the SendMessage tool exactly once:
        type: "message"
        recipient: "team-lead"
        summary: "TS evaluation complete — N NEEDS_UPDATE"  (fill in count)
        content: |
          FINDINGS FROM ts-evaluator
          [Triage] ...
          N{#}: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
          [EDIT: instruction if NEEDS_UPDATE]
          (one entry per evaluated question)

      Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only evaluation
      - Do NOT call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings
    """
  )

  --- Node Runtime Evaluator Task ---
  Task(
    subagent_type = "general-purpose",
    model = "opus",
    team_name = <team_name>,
    name = "node-evaluator-p" + pass_count,
    prompt = """
      You are a senior Node.js runtime engineer evaluating a Node.js/TypeScript implementation
      plan.

      Your inputs:
      - Plan file: <plan_path> — read it with the Read tool
      - Question definitions: Read ~/.claude/skills/node-plan/SKILL.md for the full question
        table (questions marked [NR] and [Shared])
      - Standards: Read only the Tool Preferences and relevant Node.js/TypeScript sections of
        ~/.claude/CLAUDE.md as needed (skip unrelated sections)

      Evaluate these questions through the NODE RUNTIME lens:
        NR-owned: N9, N10, N13, N14, N15, N16, N17, N18, N22, N23, N24, N25, N26, N27, N28,
                  N31, N33, N34, N35, N36
        Shared (runtime lens): N8

      Triage: If plan has no env var changes → bulk N/A N9, N10.
              If plan has no new resources/schema changes → bulk N/A N13, N14, N18.
              If plan has no framework changes → bulk N/A N15, N16, N17.
              If plan has no async code → bulk N/A N22, N23, N24, N25, N27, N28, N35.
              If plan has no new timers → N/A N26.
              If plan has no deployment/containers → bulk N/A N31, N36.
              If plan has no secrets/credentials → bulk N/A N33.
              If plan has no API endpoint changes → bulk N/A N34.
              Evaluate shared N8 regardless.

      Self-referential protection: Skip content marked <!-- node-plan --> or <!-- review-plan -->.

      Output contract — call the SendMessage tool exactly once:
        type: "message"
        recipient: "team-lead"
        summary: "Node runtime evaluation complete — N NEEDS_UPDATE"  (fill in count)
        content: |
          FINDINGS FROM node-evaluator
          [Triage] ...
          N{#}: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
          [EDIT: instruction if NEEDS_UPDATE]
          (one entry per evaluated question)

      Do NOT write findings to stdout — the team-lead only receives content via SendMessage.

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only evaluation
      - Do NOT call ExitPlanMode or touch any marker files
      - Call SendMessage exactly once with all findings
    """
  )

  Wait for all active evaluator messages (90s reminder; after 120s total mark
  ⚠️ Evaluator Incomplete for any non-responding evaluator and proceed with
  available findings).
  Incomplete evaluator rule: An Incomplete evaluator contributes ZERO changes and ZERO findings
  to this pass. Pass CAN converge if responding evaluators returned 0 NEEDS_UPDATE AND the
  Incomplete evaluator returned 0 NEEDS_UPDATE in the immediately prior pass. If the Incomplete
  evaluator had NEEDS_UPDATE last pass: do NOT converge; spawn it again next pass.

  -- Merge & Consolidate --
  COLLECT all NEEDS_UPDATE from both evaluator messages
  For shared question (N8) flagged by both:
    Combine into single finding; keep the more actionable wording. (Rationale: "more actionable
    wins" — both perspectives have domain-appropriate framing; choose clearest for implementer.)
  APPLY edits — for each [EDIT: ...] instruction in any evaluator message:
    Call the Edit tool on the plan file to insert/modify the specified content.
    Mark each insertion <!-- node-plan -->.
    Each Edit call = 1 change. Do NOT count findings you only described in text.
  CONSOLIDATE plan (see Consolidation Rules below)
  RE-READ consolidated plan
  SET current_needs_update_count = (total NEEDS_UPDATE from this pass's evaluator messages)
  SET current_needs_update_set = (Q numbers flagged NEEDS_UPDATE this pass)
  PLATEAU = (prev_needs_update_count != null) AND (current_needs_update_count == prev_needs_update_count) AND (current_needs_update_set == prev_needs_update_set)  # set equality: order-independent
  prev_needs_update_count = current_needs_update_count; prev_needs_update_set = current_needs_update_set
  Print pass summary using per-pass template

  -- CONVERGENCE CHECK --
  Gate1_unresolved = count of NEEDS_UPDATE on N1 (the sole weight-3 question; Gate 1 = N1 only)
  IF pass_count >= 5:
    IF Gate1_unresolved > 0:
      user_already_asked_gate1 = true
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

-- REWORK GATE CHECK --
IF Rating == REWORK AND NOT user_already_asked_gate1:
  AskUserQuestion listing the unresolved Gate 1 questions.
  Wait for user response. If user resolves: apply edits, re-evaluate, update scorecard.
  If user overrides: annotate scorecard with override.
-- END REWORK CHECK --

TEARDOWN:
  Bash: touch ~/.claude/.plan-reviewed
  Send shutdown_request to ts-evaluator-p1 through ts-evaluator-p[pass_count]
  Send shutdown_request to node-evaluator-p1 through node-evaluator-p[pass_count]
  TeamDelete
  Call ExitPlanMode
```

### Worked Example

```
Pass 1/5: evaluating...
  [Spawning ts-evaluator-p1 + node-evaluator-p1 in parallel]
  [ts-evaluator-p1 findings]: 3 NEEDS_UPDATE (N1, N4, N6) -- no tsc step, untyped return values,
    route handler no try/catch
  [node-evaluator-p1 findings]: 2 NEEDS_UPDATE (N9, N13) -- new env var undocumented, no SIGTERM handler
  -> Merge: N8 both PASS — no merge needed
  -> Edits: add tsc --noEmit step (N1), type annotations for new fn (N4), wrap handler
    in try/catch (N6), document env var in .env.example (N9), add graceful shutdown (N13)
  -> Consolidate: merge async error + shutdown into single section
Pass 2/5: evaluating...
  [Spawning ts-evaluator-p2 + node-evaluator-p2 in parallel]
  [ts-evaluator-p2 findings]: 0 NEEDS_UPDATE
  [node-evaluator-p2 findings]: 1 NEEDS_UPDATE (N35) -- no unhandledRejection handler for
    new async path
  -> Edit: add process.on('unhandledRejection') note
  -> Consolidate: no duplicates found
Pass 3/5: evaluating...
  [Spawning ts-evaluator-p3 + node-evaluator-p3 in parallel]
  [ts-evaluator-p3 findings]: 0 NEEDS_UPDATE
  [node-evaluator-p3 findings]: 0 NEEDS_UPDATE
  -> CONVERGED at pass 3. Output final scorecard.
```

---

## Exit Criteria (Gate-Based)

- **Gate 1** (blocking, weight 3): All must PASS. Loop until satisfied. If persistent after
  edits, ask the user for resolution before stopping.
- **Gate 2** (important, weight 2): Must stabilize (no new findings between passes). Loop
  until stable.
- **Gate 3** (advisory, weight 1): Note findings but do NOT loop on them.
- N/A counts as PASS for gate evaluation. A weight-3 question marked N/A does not block.
- **Plateau:** NEEDS_UPDATE count unchanged between passes = stop (Gate 2 only; Gate 1
  uses ask-user).
- **Safety cap:** 5 passes.

## Ambiguity Handling

- **Cannot determine PASS vs NEEDS_UPDATE?** Ask the user via AskUserQuestion. Do not guess.
- **Insufficient context to evaluate?** Ask the user what information is needed.
- **Edge case on advisory (weight 1)?** Default to PASS. Do not generate false positives on
  low-weight questions.

## Self-Referential Protection

See `~/.claude/skills/shared/self-referential-protection.md` for the canonical protection policy. <!-- review-plan -->

If shared file is not found, use inline policy: mark all `<!-- node-plan -->` content as review metadata, not production code; do not re-evaluate it. Do NOT flag review-added sections as needing tests (N19), impact analysis, dead code removal, or duplication checks.

## Consolidation Rules (Every Pass)

After edits, consolidate. Specific criteria:
- Merge sections covering the same concern (e.g., separate "Error handling" and "Shutdown"
  into one async safety section)
- Remove redundant notes that repeat what the plan already says
- Each finding adds at most 2-3 sentences. Consolidation removes at least as much text as
  it adds (from pass 2 onward; pass 1 focuses on additions only).
- If plan is growing, prioritize: keep blocking findings, summarize important, drop advisory
- Plan gets cleaner each pass, not longer
- **Keep-exemption:** Content annotated with `<!-- keep: [reason] -->` is EXEMPT from consolidation removal. Never remove or trim `<!-- keep: -->` content based on length heuristics.
- **"Key flow" definition:** Any implementation step, ordering dependency, error path, rollback step, or verification checkpoint. Prose trimming is OK. Removing or merging steps is NOT.
- **Regression check (before RE-READ):** Verify no key flow, corner case, or condition was
  removed during this pass. If any was dropped — even to reduce length — restore it and
  annotate with `<!-- keep: [reason] -->`. Trimming prose is fine; removing logic is not.

---

## Key Questions

Each returns **PASS** / **NEEDS_UPDATE** / **N/A**.
Weights: **3** = blocking | **2** = important | **1** = advisory.

### Quick-Reference Weight Table

**Gate 1 — Blocking (weight 3, must all PASS):**
N1 TypeScript build check [TS]

**Gate 2 — Important (weight 2, must stabilize):**
N2 npm/package changes [TS] | N3 lock file [TS] | N4 type safety [TS] | N5 tsconfig interaction [TS] |
N6 async error handling [TS] | N7 floating promises [TS] | N8 concurrency safety [Shared] |
N9 environment variables [NR] | N10 config hygiene [NR] | N11 module system [TS] |
N12 circular dependencies [TS] | N13 graceful shutdown [NR] | N14 memory/streaming [NR] |
N15 framework integration [NR] | N16 Node version compat [NR] | N17 security surface [NR] |
N18 database migrations [NR] | N22 event loop blocking [NR] | N23 ReDoS safety [NR] |
N24 stream pipeline safety [NR] | N25 EventEmitter hygiene [NR] | N27 child process/worker mgmt [NR] |
N28 HTTP client timeouts [NR] | N30 monorepo phantom deps [TS] | N33 secret management [NR] |
N35 process crash safety [NR] | N36 K8s/container shutdown [NR]

**Gate 3 — Advisory (weight 1, note only):**
N19 test isolation [TS] | N26 timer cleanup [NR] | N29 path handling [TS] |
N31 Docker/container concerns [NR] | N32 native addon compat [TS] |
N34 API contract drift [NR] | N37 TS declaration output [TS]

**Triage shortcut — evaluator skip:** See Perspective Assignments above. Shared questions are NEVER bulk-N/A'd.
**Triage shortcut — question-level bulk N/A:** Bulk-mark specific questions N/A when clearly irrelevant (no TS files → skip N2-N5, N11, N12; no async code → skip N6, N7, N22-N25, N27, N28, N35; no deployment → skip N31, N36). Shared questions are NEVER bulk-N/A'd.

---

### TypeScript Build & Types

**N1: Does the plan include a TypeScript build check?** (3, TS, never N/A when TS files present)
Plan must include `tsc --noEmit` or an equivalent compile step. A plan that skips type-checking
will push broken TypeScript silently and catch errors only at runtime.

**N4: Is type safety maintained throughout the change?** (2, TS)
`any` usage avoided or explicitly justified. New functions have typed parameters and return
types. No `as unknown as X` casts without justification. N/A: no new TypeScript code.

**N5: Does the plan interact with tsconfig.json correctly?** (2, TS)
strict mode, paths aliases, target, module format preserved. N/A: no tsconfig changes.

---

### Dependencies & Module System

**N2: Are npm/package changes justified and safe?** (2, TS)
Each new dependency justified (functionality, bundle size, maintenance). `npm audit` planned.
dev vs prod placement correct. N/A: no package.json changes.

**N3: Is the lock file updated?** (2, TS)
package-lock.json / yarn.lock / pnpm-lock.yaml updated as part of the change. N/A: no
dependency changes.

**N11: Is the module system consistent?** (2, TS)
ESM/CJS consistent with project setup. `import`/`require` not mixed. `"type": "module"` in
package.json aligns with file extensions. N/A: no new imports.

**N12: Are circular dependencies avoided?** (2, TS)
No new circular imports introduced. Flag if new module depends on a module that imports it.
N/A: no new modules.

**N30: Are phantom dependencies guarded in monorepos?** (2, TS)
Dependencies declared in the correct workspace package. No reliance on hoisted transitive
deps. TypeScript project references (`references` in tsconfig) correct. N/A: not a
monorepo/workspace.

**N37: Is TypeScript declaration output configured correctly?** (1, TS)
`.d.ts` generation configured correctly. `exports` map in package.json covers entry points.
strict compat for downstream consumers. N/A: not a published library/package.

---

### Async & Concurrency

**N6: Are async entry points wrapped in error handlers?** (2, TS)
All async route handlers, event listeners, top-level async code wrapped in `try/catch` or
`.catch()`. Unhandled async errors crash Node processes. N/A: no new async code.

**N7: Are all promises awaited or caught?** (2, TS)
All async calls awaited or `.catch()`-ed. No fire-and-forget without error handling.
`void` operator used intentionally where non-blocking is desired. N/A: no new async code.

**N8: Is concurrency safety addressed?** (2, Shared)
No race conditions on shared mutable state. `Promise.all` where parallel is safe.
Mutex/lock for shared resources. N/A: read-only operations only.

---

### Environment & Configuration

**N9: Are new environment variables documented?** (2, NR)
New `process.env.*` references documented in `.env.example`. Validated at startup for
crash-fast behavior (not silently undefined mid-request). N/A: no new `process.env` refs.

**N10: Is configuration hygiene maintained?** (2, NR)
`.env.example` updated alongside `.env` changes. No secrets hardcoded in source files or
committed `.env`. N/A: no env changes.

**N33: Are secrets managed securely?** (2, NR)
Secrets sourced from vault/runtime injection rather than static `.env` files. `process.env`
exposure minimized (don't pass entire `process.env` to functions). N/A: no new secrets or
credentials.

---

### Node Process Lifecycle

**N13: Is graceful shutdown implemented for new resources?** (2, NR)
SIGTERM/SIGINT handlers cover new resources: DB connections, open handles, HTTP servers,
timers, queues. `server.close()` before `process.exit()`. N/A: no new persistent resources.

**N35: Are process crash handlers in place for new async paths?** (2, NR)
`process.on('unhandledRejection')` and `process.on('uncaughtException')` cover new async
paths. Pattern: log-then-exit, not swallow. N/A: no new async code paths.

**N36: Is Kubernetes/container shutdown handled correctly?** (2, NR)
SIGTERM handler includes readiness probe delay and connection draining before exit.
CMD in Dockerfile uses exec form (not shell wrapper) so signal forwarding works.
N/A: not containerized/K8s, or no service lifecycle changes.

---

### Runtime Safety

**N14: Is memory and streaming handled safely?** (2, NR)
Large data sets processed with streams or pagination. Buffer accumulation bounded. No
unbounded array growth in long-lived processes. N/A: no bulk data operations.

**N22: Are event-loop-blocking operations avoided?** (2, NR)
No `readFileSync`/`writeFileSync` in request handlers. No synchronous CPU-heavy operations
(large `JSON.parse`, heavy regex, tight loops) on the main thread. Offload to worker
threads where needed. N/A: no new file I/O, no heavy computation in request handlers.

**N23: Are regular expressions safe from ReDoS?** (2, NR)
No nested quantifiers (`(a+)+`, `(a|a)*`) applied to user-controlled input. Regex
complexity proportional to bounded input. N/A: no new regex patterns, or regex only on
bounded internal data.

**N24: Is stream pipeline safety addressed?** (2, NR)
Uses `stream.pipeline()` over `.pipe()` for automatic error propagation. Errors handled on
all stream segments. Backpressure respected. N/A: no stream operations.

**N25: Is EventEmitter hygiene maintained?** (2, NR)
Listeners cleaned up with `.once()` or explicit `.removeListener()`/`.off()`.
`error` event handled on all custom EventEmitter instances to prevent crash. N/A: no new
EventEmitter usage.

**N26: Are timers stored and cleared?** (1, NR)
`setTimeout`/`setInterval` return values stored and cleared in cleanup paths.
Long-lived timers `.unref()`'d to prevent blocking process exit. N/A: no new timers.

**N27: Are child processes and worker threads managed safely?** (2, NR)
Workers/child processes have `error` event handlers. Terminated in shutdown path. No
orphan processes on parent exit. N/A: no `child_process` or `worker_threads` usage.

**N28: Do outbound HTTP calls configure timeouts?** (2, NR)
Outbound HTTP/HTTPS calls set connect and response timeouts. Connection pooling and
keep-alive configured for high-throughput paths. N/A: no outbound HTTP calls.

---

### Framework & Infrastructure

**N15: Is framework integration correct?** (2, NR)
Express/Fastify/Koa/NestJS middleware order correct (auth before route handlers, error
middleware last in Express). New routes registered in the correct router/module. N/A: no
framework-level changes.

**N16: Are changes compatible with the Node.js version constraint?** (2, NR)
Changes compatible with `.nvmrc` or `engines` field in package.json. No APIs used that
require a newer Node than specified. N/A: no version-sensitive API usage.

**N17: Is the security surface considered for new endpoints?** (2, NR)
New HTTP endpoints use appropriate middleware: helmet, cors with whitelist, rate-limit.
Authentication/authorization applied. N/A: no new HTTP endpoints.

**N18: Are database schema changes handled with migrations?** (2, NR)
Schema changes include forward migration files. Rollback migration exists. Migration run
order explicit. N/A: no schema changes.

---

### Containers & Deployment

**N31: Are Docker/container concerns addressed?** (1, NR)
Non-root user in Dockerfile. Signal forwarding via exec form CMD. `.dockerignore` excludes
`node_modules`, `.env`, secrets. Multi-stage build for smaller production image. N/A: no
Docker/container changes.

---

### Testing & Quality

**N19: Is test isolation maintained?** (1, TS)
New tests mock external dependencies (DB, HTTP, file system). No shared mutable state
between test cases. No test ordering dependencies. N/A: no new tests.

---

### Developer Experience

**N29: Are file paths handled correctly?** (1, TS)
Uses `path.join()`/`path.resolve()` rather than string concatenation for cross-platform
compatibility. ESM vs CJS path resolution accounted for (`__dirname` vs `import.meta.url`).
N/A: no file path operations.

**N32: Are native addons compatible across platforms?** (1, TS)
Packages with native bindings (bcrypt, sharp, better-sqlite3, canvas) account for
platform/ABI/architecture. Prebuilt binaries or compile toolchain documented. N/A: no
packages with native bindings.

**N34: Is the API contract kept in sync?** (1, NR)
OpenAPI/GraphQL/JSON Schema spec updated when endpoint response shapes change. Consumer
teams notified. N/A: no API endpoint changes, or no formal contract definitions.

---

## Rating

| Rating | Criteria |
|--------|----------|
| **READY** | Gate 1 all PASS + Gate 2 all PASS |
| **SOLID** | Gate 1 all PASS + Gate 2 ≤ 2 NEEDS_UPDATE |
| **GAPS** | Gate 1 all PASS + Gate 2 > 2 NEEDS_UPDATE |
| **REWORK** | Gate 1 has any NEEDS_UPDATE |

### Score

`(PASS_weight_sum) / (applicable_max_weight_sum) * 100` — summary metric alongside gate
rating.

---

## Output Templates

### Per-Pass Template

Show only NEEDS_UPDATE items and status changes since last pass. Summarize stable/N/A as
counts.

```
## Pass [N]/5

N/A: [count] | Stable PASS: [count]

| Evaluator | Q#  | Question              | Status       | Notes                      |
|-----------|-----|-----------------------|--------------|----------------------------|
| TS        | N1  | TypeScript build      | NEEDS_UPDATE | No tsc step in plan        |
| TS        | N6  | Async error handling  | NEEDS_UPDATE | Route handler unprotected  |
| NR        | N9  | Environment variables | PASS (fixed) | .env.example updated       |

**Result:** [count] NEEDS_UPDATE ([N-numbers]) — TS: [n], NR: [n]
**TS edits:** [list]
**NR edits:** [list]
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

The canonical post-scorecard sequence is encoded in the execution flow pseudo-code above
(REWORK GATE CHECK block → TEARDOWN block). Summary for reference:

1. **REWORK gate** (in execution flow): If Rating is REWORK, AskUserQuestion listing
   unresolved Gate 1 questions before writing the marker or calling ExitPlanMode.
2. **Write gate marker**: `touch ~/.claude/.plan-reviewed` — allows ExitPlanMode to pass.
3. **Team teardown**: Send shutdown_request to all pass-qualified evaluator agents
   (ts-evaluator-p1..pN, node-evaluator-p1..pN), then TeamDelete. Teardown must complete
   before ExitPlanMode — the session context needed for TeamDelete is not available after
   exiting plan mode.
4. **Call ExitPlanMode immediately.** Do not pause, do not ask "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
