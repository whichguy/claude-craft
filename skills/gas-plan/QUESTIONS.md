<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md AND EVALUATE.md triage/evaluate sections. All 3 steps required. -->

# GAS Plan Question Definitions

## Gate Weight Reference

Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

**Gate 1 — Blocking (weight 3, must all PASS):**
Q1 branching strategy [G] | Q2 branching usage [G] | Q13 standards [Shared] | Q15 simplicity [Shared] | Q18 impact analysis [G] | Q42 post-impl review [G]
*(Note: When gas-plan runs inside review-plan as gas-evaluator, the effective IS_GAS Gate 1 also includes Q-G3 — evaluated by l1-evaluator, not gas-plan.)*

**Gate 2 — Important (weight 2, must stabilize):**
Q3 sync [G] | Q4 folders+ordering [G] | Q5 right tools [G] | Q6 exec verify [G] | Q7 common-js sync [G] | Q9 deployment [G] | Q10 rollback [G] | Q11 tests [G] | Q12 incremental verify [G] | Q16 interfaces [Shared] | Q17 step ordering [G] | Q19 empty code [G] | Q20 dead code [G] | Q21 concurrency [G] | Q22 execution limit [G] | Q23 OAuth scopes [G] | Q24 idempotent [G] | Q27 input validation [Shared] | Q28 error handling [Shared] | Q29 logging [G] | Q32 event listeners [F] | Q38 unintended consequences [Shared] | Q39 duplication [G] | Q40 state-exists+absent [G] | Q41 bolt-on vs merge [Shared] | Q44 card structure [G] | Q45 action handlers [G] | Q46 token access [G] | Q47 navigation [G] | Q48 trigger coverage [G] | Q49 V8 parsing order [G] | Q50 namespace collision [G]

**Gate 3 — Advisory (weight 1, note only):**
Q8 isolated state [G] | Q14 naming [F] | Q25 quotas [G] | Q26 storage limits [G] | Q30 UX feedback [F] | Q31 accessibility [F] | Q33 error boundary [F] | Q34 CSS conflicts [F] | Q35 LLM comments [F] | Q36 breadcrumbs [F] | Q37 documentation [G] | Q43 plan legibility [F] [post-loop] | Q51 debug logging [G]

**Triage shortcut — evaluator skip:** See Perspective Assignments in SKILL.md. Shared questions are NEVER bulk-N/A'd.
**Triage shortcut — question-level bulk N/A:** Bulk-mark specific questions N/A when clearly irrelevant (no UI changes → skip Q14, Q30-Q36; no new files → skip Q4; no deployment → skip Q10). Shared questions are NEVER bulk-N/A'd. Note: Q43 is evaluated post-loop only — not during convergence passes.

---

## Key Questions

Each returns **PASS** / **NEEDS_UPDATE** / **N/A**.
Weights: **3** = blocking | **2** = important | **1** = advisory.

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
(1) run `/review-fix` or `/gas-review` — loop until clean,
(2) run build/compile if applicable,
(3) run tests.
Steps 4–5 of CLAUDE.md POST_IMPLEMENT (fail recovery and COMMIT_SUGGESTED deferral) apply at runtime regardless of plan text — plan does not need to restate them.
Ensures regressions and secondary issues are caught before closing out the task.
Mandatory for all plans — cannot be skipped.

---

### GAS Gotchas Reference (for Q49, Q50, Q51, Q26)

**V8 File Parsing Order:**
- `loadNow: true` modules execute eagerly at parse time — they MUST be positioned LAST in
  file order, after all their dependencies. If a dependency file is at a higher position
  (lower number), `require()` will throw "Module not found" at startup.
- Rule: whenever a plan adds files or changes positions, check if any loadNow module now
  has deps at higher positions.

**GAS Global Namespace Collisions:**
- GAS built-in globals: Logger, Utilities, DriveApp, SpreadsheetApp, ScriptApp,
  UrlFetchApp, CacheService, PropertiesService, LockService, HtmlService, ContentService,
  MailApp, GmailApp, CalendarApp, ContactsApp, DocumentApp, SlidesApp, FormApp, Maps,
  Session, Browser, console, Xml, XmlService, Jdbc, ScriptProperties, UserProperties.
- A module-level `var Logger = ...` or `const Utilities = ...` in any file visible to GAS
  top-level scope will shadow the built-in. loadNow modules are especially vulnerable
  since they execute at parse time.

**Properties/Cache Actual Limits (for Q26):**
- PropertiesService: 524,288 chars/value, 512KB total per store, 500 keys max
- CacheService: 102,400 bytes/value, 250-char key max, eviction is FIFO (not LRU)
- Exceeding these silently fails or throws — validate before storing.

**CommonJS Debug Logging Pattern (for Q51):**
- New modules should use the 3-param signature: `function _main(module, exports, log)`
- `log` is auto-injected by require.js — no-op by default, routes to Logger.log when enabled
- Enable per-module via exec(): `setModuleLogging('folder/ModuleName', true)` (script scope)
- Disable after debugging: `setModuleLogging('folder/ModuleName', false, 'script', true)`
