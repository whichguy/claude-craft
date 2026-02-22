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

## Fallback (If This File Is Not Found)

If `shared/self-referential-protection.md` cannot be located via symlink:
- Mark all content annotated with `<!-- review-plan -->`, `<!-- gas-plan -->`, or `<!-- node-plan -->` as review metadata, not production code.
- Do not re-evaluate any such content — regardless of which skill added it. Each skill skips ALL marked content, not just content marked with its own marker.
- Apply the "never flag" rules above inline.
