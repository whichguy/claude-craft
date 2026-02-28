# Review-Plan Question Definitions — Layer 3 (UI Evaluator)

This file is read by the ui-evaluator only. It contains L3 UI questions (Q-U1 through Q-U7)
plus two L2 Client cluster questions (Q-C17, Q-C25) merged into the ui-evaluator when HAS_UI=true.

For the full question set (L1 + L2 + L3), see QUESTIONS.md.

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 3: UI Specialization

*9 questions total: Q-U1 through Q-U7 + Q-C17 + Q-C25. Active when HAS_UI=true.*

*For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A***

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-U1 | Component structure | Is the UI decomposed into logical, reusable components? Flag: monolithic HTML blobs, duplicated UI patterns, no separation between layout, state, and interaction. | no new UI components |
| Q-U2 | State management | Is UI state (loading, error, empty, data) handled explicitly? Loading spinner/skeleton, error display, empty-state copy all accounted for? | purely presentational changes with no dynamic state |
| Q-U3 | Interaction feedback | Do user actions (form submission, button click, async calls) provide immediate feedback? Disable-during-submission, progress indicator, success/error toast. | no interactive elements |
| Q-U4 | Responsive & layout constraints | Does the UI respect container constraints? GAS sidebars are 300px fixed; dialogs are 600px max. No overflow assumptions, no fixed pixel widths that break at sidebar dimensions. | no layout/sizing changes |
| Q-U5 | Accessibility basics | Interactive elements have accessible labels (`aria-label`, `for`/`id` pairs on form inputs). Tab order is logical. Keyboard navigation not broken. | no new interactive elements |
| Q-U6 | Visual consistency | New UI matches the existing design language (fonts, colors, spacing, button styles from the project's CSS baseline). No one-off inline styles that diverge from established patterns. | no visual changes or the project has no existing baseline |
| Q-U7 | UI design narrative | Does the plan include a UI design narrative describing the user experience: what does the user see and do, what interaction states they move through (loading, error, success, empty), and why the UI is designed this way? Acceptable: a `## UI Design Narrative`, `## User Experience`, or `## Design Intent` section with 2–5 sentences. Flag: plan goes straight to component/HTML implementation steps without any user-facing design rationale. EDIT injection — team-lead applies: `[EDIT: inject ## UI Design Narrative section: "## UI Design Narrative\n**User experience**: [what the user sees and does — the interaction flow]\n**Design intent**: [why this UI approach; what workflow or feeling it supports]\n**State transitions**: [how loading, error, empty, and success states are handled]"]`. | purely presentational changes with no interaction or new components; plan explicitly references an existing design spec |

---

### Client Cluster Questions (merged into ui-evaluator when HAS_UI=true)

The following 2 questions are evaluated by the ui-evaluator when HAS_UI=true
(merged from Client cluster — no separate client-evaluator is spawned).

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C17 | 2 | Event listener cleanup | Listeners removed to prevent accumulation/leaks? | no new listeners |
| Q-C25 | 3 | UI error boundary | Client-side error handler for silent failures? (window.onerror, try/catch around init) | no new client logic |

IS_GAS: **fully superseded when HAS_UI=true** (gas-evaluator Q32, Q33).
IS_NODE: not superseded — evaluate normally.

Count ui-evaluator edits → `ui_plan_changes += count` (combined into `changes_this_pass` in Convergence Loop)
