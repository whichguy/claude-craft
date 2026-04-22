# Code Reviewer Improvement Tasks

## Metrics & Tracking
- [ ] **Track Loop Efficacy**: For every finding caught during the "Iterative Critique & Refine" phase, explicitly log the iteration number (`Loop 1`, `Loop 2`, etc.).
- [ ] **Ablation Baseline**: Compare how many issues are caught in Loop 1 vs. Loop 2 to see if the second pass is worth the token cost.
- [ ] **Gate vs. Loop Correlation**: Document cases where the Prescriptive Gate caught something the iterative loops missed (The "Trap" cases).

## User Experience & Feedback
- [ ] **Linter Recommendations**: If Phase 0 fails to discover a linter for a specific file type (e.g. .py, .go), add a specific recommendation in the final reply to "Discover and configure a linter for [Type]".
