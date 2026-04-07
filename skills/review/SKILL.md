---
name: review
description: |
  Perform code review with optional auto-fix. Dispatches to code-reviewer or review-fix
  agent for complex multi-file reviews.

  AUTOMATICALLY INVOKE when:
  - "review this", "check this code", "code review", "review my changes"
  - "review and fix", "fix issues", "clean this up"
  - Before commits on non-trivial changes

  NOT for: GAS projects (use /gas-review), plan review (use /review-plan)
allowed-tools: all
---

# /review — Code Review with Optional Auto-Fix

Review code for bugs, logic errors, security vulnerabilities, and quality issues.
Fast path for small reviews; dispatches to agents for complex multi-file work.

## Step 0 — Parse Arguments

From the invocation args, extract:
- **target_files**: Specific files/dirs/globs to review. If empty, detect from git.
- **--all**: Review all tracked files in the repo (full-repo audit)
- **mode**: "review" (default — read-only findings) or "fix" (review + auto-apply fixes)
- **--dry-run**: Show what would be changed without applying (only with fix mode)

File detection (when no target_files specified):
```bash
# --all flag: every tracked file
git ls-files

# Default: uncommitted + staged + untracked (excluding .gitignore'd)
{ git diff --name-only HEAD; git diff --cached --name-only; git status --porcelain | grep -v '^??' | cut -c4-; } | sort -u
```
Filter out `.json`, `.lock` files unless explicitly named in target_files.

## Step 1 — Triage

Count the files and assess complexity:

**Fast path** (inline review):
- 1-2 files AND each file < 500 lines
- No "fix" mode requested
- Proceed to Step 2a

**Agent path** (dispatch):
- 3+ files, OR user said "fix", "review and fix", "clean up"
- Any file > 500 lines
- Proceed to Step 2b

## Step 2a — Inline Review

For each file:
1. Read the file completely
2. Evaluate against:
   - **Bugs**: Logic errors, off-by-one, null/undefined access
   - **Security**: Injection, XSS, hardcoded secrets, unsafe eval
   - **Quality**: Dead code, unused imports, naming, complexity
   - **Style**: Consistency with surrounding codebase patterns
3. Report findings with file:line references

Format:
```
## [filename]

**Critical** (must fix):
- [file:line] [finding]

**Advisory** (should fix):
- [file:line] [finding]

**Note** (optional):
- [file:line] [finding]
```

If zero findings: "No issues found."

## Step 2b — Agent Dispatch

Spawn the appropriate agent:

If mode is "fix" or user said "review and fix":
```
Use the Agent tool:
  subagent_type: "review-fix"
  prompt: "target_files=\"[file list]\"
task_name=\"[task context]\"
worktree=\"[working directory]\"
commit_mode=\"commit\"
Review and apply all Critical and Advisory fixes. Loop until clean."
```

If mode is "review" (read-only):
```
Use the Agent tool:
  subagent_type: "code-reviewer"
  prompt: "target_files=\"[file list]\"
task_name=\"[task context]\"
worktree=\"[working directory]\"
review_mode=\"full\"
Review all files for bugs, security vulnerabilities, and quality issues."
```

## Step 3 — Post-Processing

After review completes:
- Summarize total findings by severity
- If fixes were applied, list what changed
- Suggest next steps: "Run tests to verify", "Commit when ready"
