## Migration Classification: [ONE-TIME | REPEATABLE]

**Reasoning:** [Explain why this migration is one-time or repeatable]

**IF ONE-TIME:**
- Migration steps documented in `docs/MIGRATION_RUNBOOK.md`
- Manual execution per environment with verification checklist
- No CI/CD automation needed

**IF REPEATABLE:**
- Migration framework: [Framework name, e.g., "Prisma Migrate"]
- Migration location: `<WT>/migrations/` or `<WT>/src/migrations/`
- Version tracking: [How migrations are tracked and ordered]
- Rollback strategy: [How to undo failed migrations]
- CI/CD integration: Migrations run automatically before deployment
