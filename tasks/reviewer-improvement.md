# Code Reviewer Improvement Tasks

## Metrics & Tracking
- [ ] **Track Loop Efficacy**: For every finding caught during the "Iterative Critique & Refine" phase, explicitly log the iteration number (`Loop 1`, `Loop 2`, etc.).
- [ ] **Ablation Baseline**: Compare how many issues are caught in Loop 1 vs. Loop 2 to see if the second pass is worth the token cost.
- [ ] **Gate vs. Loop Correlation**: Document cases where the Prescriptive Gate caught something the iterative loops missed (The "Trap" cases).

## Performance Optimization
- [ ] **Token Reduction**: Monitor total prompt size. Aim for < 100 lines of instructions without losing adversarial rigor.
- [ ] **Iteration Capping**: Test if a 2-pass limit significantly reduces safety compared to 5 passes.
