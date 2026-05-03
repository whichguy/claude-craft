# Validating schedule-plan-tasks changes

When you edit any file in this skill (SKILL.md, references/*.md, or fixtures), you have two
layers of automated verification plus one manual procedure. Use them together.

## 1. Behavioral tests (fast, deterministic, runs every commit)

```bash
npm test
```

Runs the full test suite. The relevant blocks for this skill:

- **`test/schedule-plan-tasks-smoke.test.js`** — string-presence checks. Verifies SKILL.md
  and references contain expected contract strings (algorithm markers, Asserts 3/5/6/7/8,
  needs_split, etc.). Catches accidental deletions during refactors.
- **`test/schedule-plan-tasks-behavior.test.js`** — algorithmic behavior checks. Drives the
  JS reference implementations (`lib/chain-detect.js`, `lib/wiring-build.js`) against the
  same DEPENDS ON graphs as the 7 fixtures, comparing chains/standalones/roles/blockers
  to expectations. Catches algorithm-level regressions even when SKILL.md text is rewritten.

Both run in milliseconds. There is no excuse for skipping them.

## 2. End-to-end fixture validation (slower, exercises the actual skill)

```bash
# Invokes the test-schedule-plan-tasks skill, which dispatches 7 parallel Agents,
# each invoking schedule-plan-tasks --dry-run on a fixture and validating output.
/test-schedule-plan-tasks
```

This runs the actual skill prompt against each fixture. Use it after non-trivial prompt
edits to confirm the LLM still produces the expected topology.

### CRITICAL caveat: the Skill cache

The `Skill()` tool caches skill content at session start. If you edit a skill file AND then
invoke `/test-schedule-plan-tasks` in the same session, the test agents will see the cached
(pre-edit) version of `schedule-plan-tasks/SKILL.md`, not your edits.

**Workaround:** open a fresh Claude Code session before running fixture validation.

This affects only LLM-invocation paths (Skill tool). The behavioral tests in #1 read files
directly and are unaffected.

## 3. Reduction rule changes — manual review only

The Regression Blocker Reduction rule (`SKILL.md`, in the Step 3 task graph section) is an
LLM-judgment call: the LLM has to decide whether a downstream node's tests subsume an
upstream node's behavior. There is no algorithm to test it against.

When changing this rule:
- Verify behavior on **plan3** (KEEP all 3 — dashboard test doesn't subsume 1a/1b unit cases)
- Verify behavior on **plan6** (REMOVE F — G/H exercise F's rate-limit behavior)
- Test changes by reading the new rule against both fixture's Verification sections, then run
  `/test-schedule-plan-tasks` in a fresh session to confirm.

## Recommended workflow for prompt edits

```
1. Edit one file (SKILL.md, references/*.md, etc.)
2. npm test — must remain green; if not, revert or fix
3. grep the touched file for any contract strings the smoke test asserts
4. Commit with a clear "refactor(schedule-plan-tasks): ..." message
5. Push — the next time someone runs npm test, regressions are caught
```

For edits that affect LLM-judgment behavior (Reduction rule, sub-task spawning rules),
add a fresh-session `/test-schedule-plan-tasks` run before pushing.
