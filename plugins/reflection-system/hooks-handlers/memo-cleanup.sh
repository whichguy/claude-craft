#!/bin/bash
# SessionStart cleanup: delete stale plan review memo/marker files (>60 min old)
# Runs async — never blocks session startup
find "$HOME/.claude" -maxdepth 1 -type f \( \
  -name ".review-plan-memo-*" -o \
  -name ".gas-plan-memo-*" -o \
  -name ".node-plan-memo-*" -o \
  -name ".plan-reviewed-*" \
\) -mmin +60 -delete 2>/dev/null
exit 0
