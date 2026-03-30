#!/bin/bash
# SessionStart cleanup: delete stale plan review memo/marker files (>60 min old)
# Runs async — never blocks session startup
find "$HOME/.claude" -maxdepth 1 -type f \( \
  -name ".review-plan-memo-*" -o \
  -name ".gas-plan-memo-*" -o \
  -name ".node-plan-memo-*" \
\) -mmin +60 -delete 2>/dev/null
# Clean up stale gate files (slug-scoped breadcrumbs in plans dir)
find "$HOME/.claude/plans" -maxdepth 1 -name ".review-ready-*" -mmin +60 -delete 2>/dev/null
exit 0
