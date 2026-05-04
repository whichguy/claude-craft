# Self-Referential Protection Policy

## Canonical Marker Rules

Each review skill marks its own additions with a skill-specific HTML comment suffix:

| Skill | Marker |
|-------|--------|
| review-plan | `<!-- review-plan -->` |
| gas-plan | `<!-- gas-plan -->` |
| node-plan | `<!-- node-plan -->` |

## Protection Rules

1. **Skip on re-evaluation:** Content already marked with any of the above markers is **plan metadata, not implementation scope**. Do NOT re-evaluate it in subsequent passes.

2. **Never flag review-added sections for:** tests, impact analysis, implementation stubs, dead code removal, duplication checks, state edge cases, or integration checks — review additions are meta-content for the plan, not new production logic.

3. **Multiple markers coexist:** A plan reviewed by multiple skills may have content marked `<!-- review-plan -->` (added by review-plan) alongside content marked `<!-- gas-plan -->` (added by gas-plan). Each skill skips ALL marked content, regardless of which skill added it.

4. **Mark every insertion:** Every edit a review skill makes to the plan must include the skill's marker suffix so subsequent passes can identify and skip it.

## Post-Review Cleanup Policy

Markers are **temporary scaffolding for the review loop** — they are not permanent plan annotations.
They must persist through every loop pass (see Protection Rules above). Only after the
convergence loop exits and the final scorecard is output does review-plan strip all markers
from the plan file before writing the gate marker and calling ExitPlanMode:

- `" <!-- review-plan -->"` → `""` (removed)
- `" <!-- gas-plan -->"` → `""` (removed)
- `" <!-- node-plan -->"` → `""` (removed)

This delivers a clean, marker-free plan to the user for implementation. The content annotated
by these markers (e.g. branching strategy sections, post-implementation workflow blocks) is
preserved — only the comment suffixes are stripped.

**Rationale:** Markers serve two purposes during review: (1) identify review-added content so
re-evaluation skips it, and (2) tag content that should not be consolidated away. Both purposes
are complete once convergence is achieved. Leaving markers in the final deliverable would clutter
the user's plan with internal review scaffolding.

## Fallback (If This File Is Not Found)

If `shared/self-referential-protection.md` cannot be located via symlink:
- Mark all content annotated with `<!-- review-plan -->`, `<!-- gas-plan -->`, or `<!-- node-plan -->` as review metadata, not production code.
- Do not re-evaluate any such content — regardless of which skill added it. Each skill skips ALL marked content, not just content marked with its own marker.
- Apply the "never flag" rules above inline.
