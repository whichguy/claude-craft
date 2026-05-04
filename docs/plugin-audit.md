# Plugin-vs-Marketplace Audit

Date: 2026-05-04
Scope: 12 in-repo bundles vs official + community Claude Code plugin ecosystem.

## Decision Table

| Bundle | Equivalent | Quality | Recommendation | Reason |
|---|---|---|---|---|
| **gas-suite** | none | — | **KEEP** (niche) | No official GAS review/debug/sidebar specialist exists. |
| **wiki-suite** | context7 (file-context only) | medium | **KEEP** (niche) | context7 ≠ LLM wiki + proactive research; ingest/query/process/lint is unique. |
| **review-suite** | official `code-review` | high | **SLIM** | Defer simple PR-comment flows to official; keep Adversarial Auditor + iterative review-fix loop + memory audits. |
| **review-bench** | none | — | **KEEP** (niche) | No A/B prompt or question-ablation tooling in official ecosystem. |
| **planning-suite** | `feature-dev`, `superpowers` (official) | high | **SLIM** | Adopt superpowers as base; keep architect + schedule-plan-tasks + node-plan as extensions. |
| **async-suite** | native Claude Code hooks | medium | **SLIM** | Native hooks subsume some bg/todo helpers; keep task-persist + feedback-collector + harvest. |
| **slides-suite** | `frontend-design` (UI only) | medium | **KEEP reveal.js + GAS deck**; defer HTML-only slides to frontend-design |
| **comms** | official `slack`, `github`, `discord` plugins | medium | **REPLACE if parity** | Audit /slack-tag vs official Slack plugin; deprecate if equivalent. |
| **form990** | none | — | **KEEP** (niche) | Specialized; no equivalent. |
| **plan-red-team** | `security-guidance` (static) | medium | **KEEP** (niche) | Iterative Opus red-team with plan refinement is more advanced. |
| **local-classifier** | none | — | **DEPRECATE if unused** | Experimental Ollama hook; low priority. |
| **c-thru** | none | — | **KEEP** | Multi-provider LLM router; complements ecosystem. |

## Action Summary

1. **Slim planning-suite** — adopt official `superpowers` / `feature-dev` as base; keep `architect`, `schedule-plan-tasks`, `node-plan` as extensions. Highest payoff.
2. **Slim review-suite** — defer PR-comment orchestration to official `code-review`; keep Adversarial Auditor + review-fix loop + memory audits.
3. **Audit comms** — compare /slack-tag vs official Slack plugin; replace if parity.
4. **Decide local-classifier** — confirm whether actively used. If not, deprecate.
5. **Keep niche bundles untouched** — gas-suite, wiki-suite, review-bench, form990, plan-red-team, c-thru have no equivalents.

## Sources

- https://github.com/anthropics/claude-plugins-official
- https://code.claude.com/docs/en/discover-plugins
- https://claude.com/plugins/code-review
- https://claude.com/plugins/superpowers
- https://github.com/ComposioHQ/awesome-claude-plugins

## Next steps (not in this PR)

Each "SLIM" recommendation needs a follow-up issue with concrete cut-list before action — feature parity has not been verified line-by-line, just at scope-description level.
