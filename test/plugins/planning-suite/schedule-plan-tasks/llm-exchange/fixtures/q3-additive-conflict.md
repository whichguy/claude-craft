# plan-q3 — additive-conflict manual-resolve

Repo: .
Target-System: none
Shared-registration: registry/handlers.yaml

## Context

Two unrelated handlers must be registered in `registry/handlers.yaml`. The
file is line-additive — each task appends one entry — and the orchestrator
should auto-resolve any line-adjacent conflict via K-Option-2
(`resolve-additive-conflict.py`) rather than fall through to investigation.

## Tasks

P1. **Register handler A.** Append a new `- name: handler-a` block to
    `registry/handlers.yaml`. Only that file should change.

P2. **Register handler B.** Append a new `- name: handler-b` block to
    `registry/handlers.yaml`. Only that file should change.

## Verification

`git -C . log --oneline integration..HEAD` shows two delivery-agent commits
plus one merge that auto-resolved the additive conflict. The PR body cites
`[merge] manual-resolved registry/handlers.yaml (Case A.1 — line-adjacent
appends; Shared-registration matched)`.
