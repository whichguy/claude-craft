---
argument-hint: "[agents|commands|skills|prompts|references|plugins|all] [--dry-run]"
description: >
  Research Claude Code best practices then audit and fix all extensions in the
  claude-craft repo. Spawns parallel research, synthesis, and audit agent teams.
  Applies Critical fixes (model versions, missing fields, broken YAML).
  Advisory findings surfaced but not auto-applied.
  **AUTOMATICALLY INVOKE** when user says "update extensions", "fix best practices",
  "audit agents", "update models", "check agent definitions", "craft update",
  "update craft", "are my agents up to date".
allowed-tools: "all"
---

You are the craft-update team lead. You orchestrate a research → synthesize → audit → fix
loop across all claude-craft extensions, then produce a structured summary.

---

## Phase 0: Setup (synchronous, before spawning any agents)

### Step 0.1: Parse Arguments

Scan all tokens in `$ARGUMENTS` regardless of position:

```
dry_run = any token matching "--dry-run", "--dryrun", "-n"  → boolean
scope_tokens = remaining non-flag tokens (may be empty)
scope_filter = scope_tokens.join(' ') || "all"
```

If `scope_filter` is not one of `agents`, `commands`, `skills`, `prompts`, `references`,
`plugins`, `all` (case-insensitive), AND it is not empty: warn
`"Unrecognized argument '[token]' — ignoring"` and treat scope as `all`.

### Step 0.2: Discover Files

Use Glob to find files for each scope type. Apply `scope_filter` to include only the
requested types (`all` includes every type):

| Type | Glob pattern | Skip pattern |
|------|-------------|--------------|
| agents | `~/claude-craft/agents/*.md` | — |
| commands | `~/claude-craft/commands/*.md` | `alias.md`, `unalias.md` |
| skills | `~/claude-craft/skills/*/SKILL.md` | — |
| prompts | `~/claude-craft/prompts/*.md` | `old-do-not-use-*`, `test-*` |
| references | `~/claude-craft/references/*.md` | — |
| plugins | `~/claude-craft/plugins/*/` (look for `SKILL.md` or `manifest.json`) | — |

Resolve `~` to the actual home directory path. Build `file_manifest` mapping each type
to its discovered absolute file paths.

If the filtered total across all included types = 0, stop and report:
```
No files found for scope '[scope_filter]'.
Available types: agents (N), commands (N), skills (N), prompts (N), references (N), plugins (N)
```

### Step 0.3: Prepare Temp Dir

1. Delete stale temp files: glob `~/claude-craft/.tmp/bp-*.md` — for each found, delete it
2. Ensure directory exists: `mkdir -p ~/claude-craft/.tmp/`
3. Compute timestamp: `ts = Date.now().toString(36)`
4. Set: `bp_path = "~/claude-craft/.tmp/bp-" + ts + ".md"` (resolve ~ to absolute)

### Step 0.4: Create Team

```javascript
TeamCreate({
  team_name: "craft-update-" + ts,
  description: "Best practices research, audit, and fix for claude-craft extensions"
});
team_name = "craft-update-" + ts;
```

### Step 0.5: Create All Tasks Upfront

Create tasks in this order and immediately set `owner` on each via TaskUpdate:

```
R1: research-models          (no blockedBy)  owner: researcher-models
R2: research-agent-structure (no blockedBy)  owner: researcher-agents
R3: research-command-structure (no blockedBy) owner: researcher-commands
R4: research-skill-structure (no blockedBy)  owner: researcher-skills

S1: synthesize-best-practices  blockedBy: [R1, R2, R3, R4]  owner: synthesizer

A1: audit-agents      blockedBy: [S1]  owner: auditor-agents      (if agents in scope)
A2: audit-commands    blockedBy: [S1]  owner: auditor-commands    (if commands in scope)
A3: audit-skills      blockedBy: [S1]  owner: auditor-skills      (if skills in scope)
A4: audit-prompts     blockedBy: [S1]  owner: auditor-prompts     (if prompts in scope)
A5: audit-references  blockedBy: [S1]  owner: auditor-references  (if references in scope)
A6: audit-plugins     blockedBy: [S1]  owner: auditor-plugins     (if plugins in scope)

F1: apply-critical-fixes  blockedBy: [all active A-tasks]  owner: team-lead

SUM1: produce-summary     blockedBy: [F1]  owner: team-lead
```

Only create Audit tasks for types included in scope_filter.

### Step 0.6: Report to User

```
craft-update started
  Scope:     [types included, comma-separated]
  Files:     agents(N) commands(N) skills(N) prompts(N) references(N) plugins(N)
  Team:      [team_name]
  Temp:      [bp_path]
  Mode:      [live | dry-run]
  Tasks:     [total tasks created]
```

---

## Phase 1: Research (4 parallel Task spawns — single message)

Spawn all 4 researchers in ONE message. Each researcher uses WebSearch + WebFetch + Read.

### Task spawn template:

```javascript
Task({
  subagent_type: "general-purpose",
  team_name: team_name,
  name: "researcher-[name]",
  description: "Research [focus area] best practices",
  prompt: `You are researcher-[name] on team ${team_name}.

[Researcher-specific instructions below]

## Output Format (required — team lead parses this)

For each finding, use EXACTLY this schema:

\`\`\`
## Finding: [BP-N]
- Title: [short name]
- Severity: Critical | Advisory
- Scope: agents | commands | skills | prompts | all
- Pattern: [what to look for — YAML key, section name, or regex]
- Compliant example:
  \`\`\`
  [inline code block]
  \`\`\`
- Non-compliant example:
  \`\`\`
  [inline code block]
  \`\`\`
- Confidence: high | medium | low
- Source: [URL or "training knowledge"]
\`\`\`

Number findings sequentially starting at BP-1. Use Critical only for issues that
would cause incorrect routing, broken tool access, or deprecated behavior.
Use Advisory for quality improvements.

When complete, send your full findings output to team-lead via SendMessage:
  type: "message"
  recipient: "team-lead"
  content: your full findings (all BP-N blocks)
  summary: "research-complete: N findings (C critical, A advisory)"`
});
```

### Researcher-specific instructions:

**researcher-models** (R1):
```
Research task: Canonical Claude model IDs and tier selection for Claude Code extensions.

Focus EXCLUSIVELY on:
- Current model IDs for sonnet-4-6, haiku-4-5, opus-4-6 (exact format)
- Which model tier is appropriate for which extension type (agents vs skills vs commands)
- Deprecated model IDs to flag (e.g. claude-sonnet-4-5-20250929, claude-3-5-sonnet)
- How the `model:` YAML field is used in agent/skill frontmatter
- Whether commands use a `model:` field

Search: "Claude Code agent model field" "claude-sonnet-4-6" "claude-haiku-4-5" site:docs.anthropic.com
Also search: "Claude Code best practices 2025 model selection agents"

OUT OF SCOPE — defer to other researchers:
  - Agent description/trigger format → researcher-agents
  - Command frontmatter fields → researcher-commands
  - SKILL.md structure → researcher-skills
```

**researcher-agents** (R2):
```
Research task: Agent frontmatter fields and description patterns for Claude Code.

Focus EXCLUSIVELY on:
- Required vs optional frontmatter fields for .md agent files
- The `color:` field — valid values, whether required
- AUTOMATICALLY INVOKE format — exact phrasing, placement in description
- NOT for: pattern — exact phrasing, placement
- STRONGLY RECOMMENDED pattern — when to use vs AUTOMATICALLY INVOKE
- Description character limits or best practices
- Input contract design — how parameters are documented in agent body
- Whether `name:` field is used/required in agent frontmatter

Search: "Claude Code agent definition" "Claude Code agent frontmatter" site:docs.anthropic.com
Also search: "Claude Code agents best practices description AUTOMATICALLY INVOKE"

OUT OF SCOPE:
  - model: field values → researcher-models
  - command-specific fields (argument-hint) → researcher-commands
  - SKILL.md differences → researcher-skills
```

**researcher-commands** (R3):
```
Research task: Command frontmatter and body structure for Claude Code slash commands.

Focus EXCLUSIVELY on:
- Required vs optional frontmatter fields for command .md files
- `argument-hint:` field — format, purpose
- `allowed-tools:` field — valid values ("all", specific tool names)
- `description:` field — how it appears in /help, length limits
- Whether commands support `model:` field (they may not)
- Prompt body best practices — phases, state tracking, output contracts
- How $ARGUMENTS is referenced in command body

Search: "Claude Code slash command" "Claude Code command frontmatter" "allowed-tools" site:docs.anthropic.com
Also search: "Claude Code custom commands best practices 2025"

OUT OF SCOPE:
  - model: field → researcher-models
  - SKILL.md format → researcher-skills
  - Agent description patterns → researcher-agents
```

**researcher-skills** (R4):
```
Research task: SKILL.md format and model selection for Claude Code skills.

Focus EXCLUSIVELY on:
- How SKILL.md differs from agent .md files (different frontmatter? different fields?)
- Whether skills use `model:` field and which tier is appropriate
- `allowed-tools:` scoping for skills — same as commands?
- Trigger detection patterns in skill descriptions
- Whether skills support `color:`, `name:`, other frontmatter fields
- Skill directory structure expectations

Search: "Claude Code skills SKILL.md" "Claude Code skill definition" site:docs.anthropic.com
Also search: "Claude Code skills vs agents difference 2025"

OUT OF SCOPE:
  - Command argument-hint → researcher-commands
  - Agent description patterns → researcher-agents
  - model: ID values → researcher-models
```

### Timeout handling:

After spawning all 4 researchers, wait for their SendMessage deliveries. Track which
have reported.

- After ~120 seconds from spawn: send a reminder to any non-reporting researcher:
  `"Reminder: please send your findings to team-lead now — we're waiting on you"`
- After 30 more seconds with no response: mark that researcher as `RESEARCH_INCOMPLETE`
  with a note in the synthesis that findings for their domain are incomplete
- Do not hang indefinitely — proceed to Phase 2 once all 4 have reported or timed out

Collect all research reports into: `research_reports = { R1: ..., R2: ..., R3: ..., R4: ... }`

---

## Phase 2: Synthesis (single synthesizer agent, blocked by all 4 researchers)

Spawn synthesizer after all 4 researchers have reported (or been marked timed-out):

```javascript
Task({
  subagent_type: "general-purpose",
  team_name: team_name,
  name: "synthesizer",
  description: "Merge research findings into best practices document",
  prompt: `You are the synthesizer on team ${team_name}.

Your job: merge 4 research reports into a single best-practices document at:
  ${bp_path}

## Research Reports

${research_reports.R1 || "R1: RESEARCH_INCOMPLETE — model IDs domain"}
---
${research_reports.R2 || "R2: RESEARCH_INCOMPLETE — agent structure domain"}
---
${research_reports.R3 || "R3: RESEARCH_INCOMPLETE — command structure domain"}
---
${research_reports.R4 || "R4: RESEARCH_INCOMPLETE — skill structure domain"}

## Synthesis Rules

1. Merge all BP-N findings into a single numbered sequence (BP-1, BP-2, ...)
2. Dedup: if two researchers describe the same finding, merge into one entry
   - If they AGREE on severity → keep that severity
   - If they CONTRADICT (one says Critical, other says Advisory, or different
     fix approach) → mark as BOTH:
     \`\`\`
     - Disputed: yes
     - Position A: [researcher] says [severity]: [rationale]
     - Position B: [researcher] says [severity]: [rationale]
     \`\`\`
     Disputed items are automatically downgraded to Advisory — never Critical
3. RESEARCH_INCOMPLETE domains: note "findings may be incomplete for [domain]"
4. Confidence aggregation: if two researchers both say "high" → high; if one says
   "low" → inherit lower confidence

## Output File Format

Write to: ${bp_path}

Use EXACTLY this structure:

\`\`\`markdown
# Best Practices: Claude Code Extensions
Generated: [ISO timestamp]
Sources: R1=[complete|incomplete], R2=[...], R3=[...], R4=[...]

## Summary
[2-3 sentence overview of key findings]

## Findings

[All BP-N blocks in the schema format from research phase, merged and deduplicated]

## Disputed Findings
[Any items marked Disputed:yes, with both positions]

## Incomplete Coverage
[Any domains marked RESEARCH_INCOMPLETE]
\`\`\`

## Verification

After writing:
1. Read back the first 200 bytes of ${bp_path} to confirm the file was written
2. Report the finding count

When complete, send to team-lead via SendMessage:
  type: "message"
  recipient: "team-lead"
  content: "synthesis-complete: ${bp_path} — N findings (C critical, A advisory, D disputed)"
  summary: "synthesis-complete: N findings"`
});
```

Team lead waits for the `synthesis-complete:` message before proceeding to Phase 3.
If no message after 180 seconds: log `SYNTHESIS_INCOMPLETE` and proceed with empty bp_path
(auditors will skip best-practices checks but can still flag obvious issues).

Mark task S1 as completed after synthesis confirmation received.

---

## Phase 3: Audit (parallel — all blocked by S1, spawn in single message)

After synthesis confirmed, spawn all active auditor agents in ONE message.

Each auditor receives:
- The bp_path (reads it independently)
- Their assigned file list from file_manifest

### Auditor prompt template:

```javascript
Task({
  subagent_type: "general-purpose",
  team_name: team_name,
  name: "auditor-[type]",
  description: "Audit [type] files against best practices",
  prompt: `You are auditor-[type] on team ${team_name}.

## Your Assignment

Audit these files against the best practices document:
Files: ${file_manifest['type'].join('\n')}

Best practices document: ${bp_path}

## Instructions

1. Read the best practices document at ${bp_path}
2. For each file in your assignment:
   a. Read the file using the Read tool
   b. Check against every applicable BP-N finding
   c. Report findings using the EXACT format below

## Required Output Format

For each file, produce a section:

\`\`\`
## Audit: [filename]

### Finding: [BP-N] — [Critical|Advisory]
- File: /absolute/path/to/file.md
- Line: [line_start]
- old_string: |
    [VERBATIM content copied from Read tool output — exact whitespace, no paraphrasing]
- new_string: |
    [replacement content]
- Rationale: [one sentence]
\`\`\`

If a file has zero findings: \`## Audit: [filename] — APPROVED\`

If a file cannot be read: \`AUDIT_ERROR: could not read [path] — [reason]\`

## Rules

- old_string MUST be verbatim from Read tool output — copy-paste exactly
- Every Critical finding MUST have both old_string and new_string
- Advisory findings may include old_string/new_string (recommended) or just rationale
- Do NOT fabricate findings to fill the template
- If bp_path cannot be read, audit for obviously incorrect patterns only:
  - Wrong model IDs (any model ID not matching claude-*-4-5* or claude-*-4-6* patterns)
  - Missing required YAML fields (model, color, description for agents)
  - Malformed YAML frontmatter

When complete, send all audit output to team-lead via SendMessage:
  type: "message"
  recipient: "team-lead"
  content: [your complete audit output — all file sections]
  summary: "audit-[type]-complete: N files, C critical, A advisory"`
});
```

### Timeout handling:

Track which auditors have reported. For each active auditor:
- After ~90 seconds: send reminder
- After 30 more seconds with no response: mark files as `⚠️ Audit Incomplete`

Collect all audit reports into: `audit_reports = { agents: ..., commands: ..., ... }`

Parse each report to extract:
- `critical_findings[]` — `{ file, line_start, bp_n, old_string, new_string, rationale }`
- `advisory_findings[]` — `{ file, line_start, bp_n, description }`
- `audit_errors[]` — files that could not be read
- `approved[]` — files with zero findings

Mark all active A-tasks as completed after their auditors have reported.

---

## Phase 4: Fix Application (team lead, blocked by all active A-tasks)

**dry-run mode**: Skip all Edit calls. Collect findings, report what *would* change.
Jump to Phase 5.

**live mode**:

### State tracking:

```
critical_resolved = []    # { file, bp_n, description }
stuck_findings = []       # { file, bp_n, description, old_string, new_string }
skipped_already = []      # { file, bp_n, description }
files_changed = []        # files where at least one Edit succeeded
```

### For each file that has Critical findings:

1. **Group all Critical findings for this file** — do not interleave with other files
2. **Sort by `line_start` descending** (reverse line order — bottom of file first)
   This prevents earlier edits from shifting line numbers that invalidate later `old_string` matches
3. For each finding in reverse order:

   a. Attempt Edit:
      ```javascript
      Edit({
        file_path: finding.file,
        old_string: finding.old_string,
        new_string: finding.new_string
      });
      ```

   b. If Edit succeeds:
      - Record in `critical_resolved`
      - Add `finding.file` to `files_changed` (if not already present)
      - Re-read the edited section to confirm the change landed

   c. If Edit fails — `old_string` not found:
      - Read a 10-line window around `finding.line_start` in the current file
      - If `finding.new_string` content is already present → `skipped_already_addressed`
      - Otherwise → `stuck_findings` (record full finding for summary)

---

## Phase 5: Summary + Teardown

### Summary Output

Print to user:

```markdown
## craft-update Summary

**Scope**: [types included, comma-separated]
**Mode**: [live | dry-run]
**Files changed**: [comma-separated list, or "none"]

### Critical Fixes Applied ([count])

[For each in critical_resolved:]
- `/path/to/file.md` — [BP-N]: [rationale / what changed]

[If none: "_No Critical findings required fixes._"]

### Critical Findings — Stuck ([count])

[If none: "_All Critical findings resolved._"]

[For each in stuck_findings:]
- `/path/to/file.md` — [BP-N]: [description]
  ```
  old: [old_string]
  new: [new_string]
  ```

### Advisory Findings — Surfaced, Not Auto-Fixed ([count])

[If none: "_No Advisory findings._"]

[For each in advisory_findings:]
- `/path/to/file.md` — [BP-N]: [description]

### Disputed Best Practices ([count])

[If none: "_No disputed findings._"]

[For each disputed item in bp_path:]
- [BP-N]: [both positions — requires human decision]

### Research Coverage

[For each domain: complete | INCOMPLETE]

### Final Status: UPDATED | UPDATED_WITH_NOTES | NO_CHANGES

[One sentence rationale.]
```

**Final status derivation:**
- `NO_CHANGES` — zero Critical findings across all audits
- `UPDATED` — Critical fixes applied, zero stuck, zero advisory
- `UPDATED_WITH_NOTES` — Critical fixes applied AND (stuck findings OR advisory findings OR disputed items)

### Teardown Sequence

1. Delete temp file: `rm ~/claude-craft/.tmp/bp-{ts}.md`
2. Collect all spawned agent names:
   - Researchers: `researcher-models`, `researcher-agents`, `researcher-commands`, `researcher-skills`
   - Synthesizer: `synthesizer`
   - Auditors: `auditor-agents`, `auditor-commands`, `auditor-skills`, `auditor-prompts`,
     `auditor-references`, `auditor-plugins` (only those actually spawned)
3. Send shutdown_request to each (only if they were spawned):
   ```javascript
   SendMessage({ type: "shutdown_request", recipient: "[name]", content: "craft-update complete" });
   ```
4. Wait for confirmations — 10 second timeout per agent; do not hang if no response
5. Call `TeamDelete()`

---

## Design Constraints

**Advisory findings are never auto-fixed.** Agent and command definitions are behavioral
contracts — Advisory changes could silently shift Claude's routing or behavior.

**Disputed best practices become Advisory.** If two researchers contradict on severity
or fix approach, the item must not be auto-applied. Human decision required.

**Fix source is auditor's old_string/new_string.** Do not re-reason or generate
alternative fixes. If old_string is missing from a Critical finding, mark stuck.

**Reverse line order prevents cascading failures.** Applying bottom-first ensures that
line numbers for remaining edits in the same file remain valid.

**Synthesis is a separate agent.** Team lead manages task state and message routing;
synthesis requires focused cognitive work that benefits from a clean context.

**Tasks created upfront with blockedBy.** Infrastructure enforces phase order and
survives partial failures without ad-hoc timer logic.
