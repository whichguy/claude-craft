# Plan: Fix review-fix STEP B/C stuck-finding routing + STEP E redundant warning

**File**: `agents/review-fix.md`
**Scope**: 3 targeted edits in a single file (pseudocode agent spec)

---

## Problem 1: Critical-without-Fix-block misrouted (pre-existing bug)

**Root cause**: The fixer output schema for `stuck` entries (line 520-522) lacks a `type` field, so STEP B (line 580-584) routes ALL stuck entries — both critical and advisory — to `advisory_stuck`. The only path to `stuck_findings` is STEP C's max_rounds ejection (line 607-612), which only fires for files that had fixes applied (`fixes_applied > 0`) and hit the round limit. Files where the fixer applied 0 fixes exit via the "nothing changed" path (line 598-604) **before** the max_rounds check, so their critical-stuck entries never reach `stuck_findings`.

**Impact**: A critical finding with no Fix block → `final_status = APPROVED_WITH_NOTES` instead of `NEEDS_REVISION`. The file gets committed and possibly merged with an unresolved critical.

**Fix**: Three-part (4 edits):

### Pre-read verification
Before applying any edits, read `agents/review-fix.md` and verify:1. Stuck schema at lines ~520-522 matches the Before block (no `type` field)2. STEP B routing at lines ~580-584 matches the Before block (single `advisory_stuck` push)3. STEP E validation at lines ~714-720 matches the Before block (two independent if-checks)4. STEP C at lines ~607-612 uses `'stuck_critical'` as the dedup key
If any verification fails, stop and reassess — the file has diverged from expected state.
### Edit 1: Add `type` field to fixer stuck output schema

Add `"type": "critical|advisory"` to the `stuck` array schema (line 520-522), matching the `applied` array which already has this field. Also update the fixer instructions (lines 496, 507) to clarify critical vs advisory routing for STUCK.

**Before** (line 520-522):
```
  "stuck": [
    { "line": <number>, "q_number": "<string>", "description": "<string>" }
  ],
```

**After**:
```
  "stuck": [
    { "line": <number>, "type": "critical|advisory", "q_number": "<string>", "description": "<string>" }
  ],
```

### Edit 2: Route stuck entries by type in STEP B

Split the STEP B stuck routing (lines 580-584) to dispatch critical-stuck to `stuck_findings` and advisory-stuck to `advisory_stuck`.

**Before** (lines 580-584):
```javascript
    // Stuck (dedup-guarded)
    result.stuck.forEach(a => {
      const entry = { file, ...a }
      dedup.push(advisory_stuck, 'stuck', entry)
    })
```

**After**:
```javascript
    // Stuck — route by type (critical → stuck_findings, advisory → advisory_stuck)
    result.stuck.filter(a => a.type === 'critical').forEach(a => {
      const entry = { file, ...a }
      dedup.push(stuck_findings, 'stuck_critical', entry)
    })
    result.stuck.filter(a => a.type === 'advisory').forEach(a => {
      const entry = { file, ...a }
      dedup.push(advisory_stuck, 'stuck', entry)
    })
    // Defensive fallback: typeless stuck entries route to advisory_stuck (not silently dropped)    result.stuck.filter(a => a.type !== 'critical' && a.type !== 'advisory').forEach(a => {
      const entry = { file, ...a }
      dedup.push(advisory_stuck, 'stuck', entry)
    })
```

The defensive fallback ensures that stuck entries missing a `type` field (e.g., from a fixer that didn't follow the updated instructions) are routed to `advisory_stuck` rather than being silently dropped. This makes Edit 2 safe against schema transition gaps.
This ensures critical findings without Fix blocks immediately land in `stuck_findings` regardless of the STEP C exit path, producing correct `final_status = NEEDS_REVISION`.

### Edit 3: Update fixer instructions for stuck type clarity

Update the critical STUCK instruction (line 496) and advisory STUCK instruction (line 507) to specify the type field.

**Before** (line 496):
```
5. If no Fix block: record as STUCK
```
**After**:
```
5. If no Fix block: record as STUCK with type "critical"
```

**Before** (line 507):
```
- DO NOT apply. Record as STUCK.
```
**After**:
```
- DO NOT apply. Record as STUCK with type "advisory".
```

---

## Problem 2: Redundant warning on zero reviewer files (cosmetic)

### Edit 4: Reorder STEP E validation to use else-if

**Before** (lines 714-720):
```javascript
    // Output validation: compare expected vs actual temp files
    if (review_files.length < num_reviewers) {
      print: "    ⚠️ ${file}: expected ${num_reviewers} reviewer file(s), found ${review_files.length}"
    }
    if (review_files.length == 0) {
      print: "    ⚠️ ${file}: no reviewer output files — all reviewers failed to write (current_findings unchanged)"
    }
```

**After**:
```javascript
    // Output validation: compare expected vs actual temp files
    if (review_files.length == 0) {
      print: "    ⚠️ ${file}: no reviewer output files — all ${num_reviewers} reviewer(s) failed to write (current_findings unchanged)"
    } else if (review_files.length < num_reviewers) {
      print: "    ⚠️ ${file}: expected ${num_reviewers} reviewer file(s), found ${review_files.length}"
    }
```

Zero-file case gets the most informative single message; partial-file case only fires when there are some (but not all) results.

---

## Verification

- No control flow changes beyond the STEP B routing split
- `stuck_findings` was already declared in State Tracking (line 115) with the correct semantic: "Critical unresolved (no Fix block OR max_rounds reached)"
- STEP C max_rounds ejection (lines 607-612) still works — it handles the "max_rounds reached" case; STEP B now handles the "no Fix block" case. No double-counting risk because dedup guards both paths with distinct namespace keys (`'stuck_critical'` in STEP B vs `'stuck_critical'` in STEP C — same namespace, same dedup)
- `final_status` derivation (lines 1168-1174) is already correct — it checks `stuck_findings.length > 0` for `NEEDS_REVISION`
- Phase 4 Summary section "Critical Findings — Stuck / Unresolved" already reads from `stuck_findings` — no changes needed there
- Tests: `npm test` (219 tests) — no test changes needed as tests don't cover agent spec semantics

## Post-Implementation Workflow
1. `/review-fix --scope=branch` — loop until clean (commit_mode="commit")2. Run build if applicable (e.g., `npm run build`, `tsc --noEmit`)3. Run tests: `npm test`4. If build or tests fail: fix issues, re-run `/review-fix --scope=branch` (step 1), re-run build/tests — repeat until all passing
## Phase 3 Print Format + Example

No changes needed. The example's Round 3 exit path (STEP C "nothing changed") shows advisory-only stuck, which correctly stays in `advisory_stuck`. A critical-without-fix scenario would now show up in `stuck_findings` before reaching the print section, but the existing print statements already handle stuck findings.
