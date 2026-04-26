---
name: process-feedback
description: |
  Ingest self-improvement feedback from the backlog and propose surgical prompt updates.
  Ensures high-quality prompt evolution without automated drift.

  AUTOMATICALLY INVOKE when:
  - "process feedback", "check prompt backlog", "improve skills based on feedback"
  - "what improvements are needed for our skills", "analyze feedback backlog"
  - "optimize prompt for [skill]"

  NOT for: Directly editing SKILL.md files (this skill is Propose-Only).
allowed-tools: [read_file, list_directory, write_file, run_shell_command]
---

# /process-feedback — Optimization Architect

Implement a safe, human-in-the-loop mechanism to ingest self-improvement feedback
and propose prompt updates.

**Authority: Read-Only / Propose-Only.**
This skill is explicitly **FORBIDDEN** from calling `replace` or `write_file` on any foundational `SKILL.md` file. It must only generate proposals in the designated `optimization-proposals` directory.

## Step 0 — Setup

Ensure the proposals directory exists and verify the backlog is present:

```bash
mkdir -p tasks/in-progress/optimization-proposals
test -f tasks/in-progress/prompt-improvements-backlog.md || { echo "No feedback backlog yet — feedback-collector plugin has not produced any entries. Stopping."; exit 0; }
```

If the backlog is absent, STOP and report "No feedback backlog yet."

## Step 1 — Ingestion

Read the feedback backlog from `tasks/in-progress/prompt-improvements-backlog.md`.
This file contains raw feedback, often in JSON or structured markdown, collected from various sessions.

## Step 2 — Analysis

1.  **Group findings by skill:** Categorize feedback by the specific skill it targets.
2.  **Identify patterns:** Look for recurring issues, logic gaps, or edge cases that have been reported multiple times across different sessions.
3.  **Prioritize:** Focus on patterns that impact reliability or safety.

## Step 3 — Synthesis

For each target skill identified in Step 2:
1.  Read the current `SKILL.md` for that skill (e.g., `skills/[target-skill]/SKILL.md`).
2.  Analyze how the current prompt fails to address the feedback.
3.  Formulate a precise, surgical update (a "diff" or a rewritten section) that directly addresses the feedback while maintaining the skill's original intent and constraints.

## Step 4 — Output (Propose)

Generate a structured proposal file at:
`tasks/in-progress/optimization-proposals/[timestamp]-[skill]-proposal.md`

The proposal MUST include:
- **Feedback:** Quote the raw JSON or text from the backlog being addressed.
- **Current State:** The specific section of the `SKILL.md` being targeted.
- **Proposed Change:** The rewritten section or surgical update.
- **Rationale:** A clear explanation of *why* this change fixes the reported issue and *how* it improves the skill.

## Step 5 — User Interaction & Approval

1.  Present the summary of the proposal to the user.
2.  Provide the path to the proposal file.
3.  **STOP.** Do not apply any changes.
4.  Wait for the user to manually review the proposal and provide a direct instruction (e.g., "Apply this proposal" or "Use replace to update the skill").

## Safety Constraints

- **No Self-Modification:** The skill must never attempt to edit its own definition or any other `SKILL.md`.
- **Transparency:** Every proposal must link back to the raw feedback that triggered it.
- **Validation:** Proposals should be checked against the existing `CLAUDE.md` and `GEMINI.md` standards.
