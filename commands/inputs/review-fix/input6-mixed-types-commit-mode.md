# Context: Mixed file types (.ts + .gs) + commit_mode="commit"

Files: `src/tools/deployTool.ts` and `src/gas/appsscript.gs`

**$ARGUMENTS value (explicit args):** `src/tools/deployTool.ts src/gas/appsscript.gs`

**Parameters passed:**
- `commit_mode="commit"` (this is a POST_IMPLEMENT pipeline invocation)
- No `plan_summary`

**Scenario details:**
The dispatcher receives two files of different types:
- `src/tools/deployTool.ts` → TypeScript → should route to `code-reviewer`
- `src/gas/appsscript.gs` → GAS → should route to `gas-code-review`

The review-fix agent accepts a single `reviewer_agent` parameter. The routing table maps file patterns to agents but gives no guidance on what to do when multiple files with conflicting routing rules are passed together.

**Expected dispatcher behavior:**
1. Derive `task_name` via `git rev-parse --abbrev-ref HEAD`
2. Recognize $ARGUMENTS is non-empty → skip auto-detection steps
3. Handle mixed file types: two files map to different agents (`code-reviewer` for `.ts`, `gas-code-review` for `.gs`)
4. Select a routing strategy (e.g., route by majority type, or pass files in separate batches, or apply the routing table per-file to each spawn call)
5. Note `commit_mode="commit"` — this affects POST_REVIEW_FIX behavior (no PR created; only a commit is made)
6. After agent completes and if `<!-- COMMITTED -->` marker is present: apply POST_REVIEW_FIX rules in "commit" mode (not PR mode)

**What a correct response looks like:**
The dispatcher must decide how to handle mixed-type files. The prompt's routing table gives per-file-type rules but the agent spawn takes one `reviewer_agent`. A correct response either: (a) routes by the dominant/first file type, (b) spawns separate agent calls per file type, or (c) uses `code-reviewer` as the default fallback. The key discriminating behavior: the dispatcher does NOT silently ignore the `.gs` file's routing requirement, and it correctly applies `commit_mode="commit"` semantics when the `<!-- COMMITTED -->` marker appears.
