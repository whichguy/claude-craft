# Context: Empty $ARGUMENTS, no git-detectable modified files

## Scenario

The user invoked `/review-fix` with no arguments. The `$ARGUMENTS` block is empty. Git commands find only `.json` and `.lock` files in the working tree — no reviewable source files.

**Git detection output (simulated):**
```
package-lock.json
tsconfig.json
```

Both files are filtered out (`.json` and `.lock` exclusion rules apply).

**Expected dispatcher behavior:**
1. Derive `task_name` via `git rev-parse --abbrev-ref HEAD`
2. Enter the empty-args path (Steps 1–3)
3. Run git detection — finds `package-lock.json`, `tsconfig.json`
4. Apply filter — both are `.json` files, filter removes them
5. Print: `"  → No reviewable files detected — exiting."`
6. Stop — do not spawn the review-fix agent
7. Do not output a review report (there is nothing to review)

**What a correct response looks like:**
The dispatcher prints the "no reviewable files" message and stops. It does NOT spawn the agent, does NOT attempt a review with zero files, and does NOT produce an empty or placeholder report.
