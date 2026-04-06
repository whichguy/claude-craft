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
| Q-U1 | Component structure | UI decomposed into reusable components? Flag: monolithic HTML, duplicated patterns, no layout/state/interaction separation. | no new UI components |
| Q-U2 | State management | UI state (loading, error, empty, data) handled explicitly? Spinner/skeleton, error display, empty-state copy present? | purely presentational changes with no dynamic state |
| Q-U3 | Interaction feedback | User actions (submit, click, async) give immediate feedback? Disable-during-submit, progress indicator, success/error toast. | no interactive elements |
| Q-U4 | Responsive & layout constraints | UI respects container constraints? GAS sidebars 300px fixed; dialogs 600px max. No overflow assumptions or fixed widths breaking at sidebar size. | no layout/sizing changes |
| Q-U5 | Accessibility basics | Interactive elements have accessible labels (`aria-label`, `for`/`id` on inputs). Logical tab order. Keyboard nav not broken. | no new interactive elements |
| Q-U6 | Visual consistency | New UI matches existing design language (fonts, colors, spacing, buttons from CSS baseline). No one-off inline styles diverging from patterns. | no visual changes or the project has no existing baseline |
| Q-U7 | UI design narrative | Plan includes UI design narrative: what user sees/does, interaction states, why designed this way? Acceptable: `## UI Design Narrative`/`## User Experience`/`## Design Intent`, 2-5 sentences. Flag: jumps to implementation without design rationale. EDIT: `[EDIT: inject "## UI Design Narrative\n**User experience**: [flow]\n**Design intent**: [rationale]\n**State transitions**: [loading/error/empty/success]"]`. | purely presentational changes with no interaction or new components; plan explicitly references an existing design spec |

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
