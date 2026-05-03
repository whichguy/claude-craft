---
name: proactive-research
description: |
  Hook-driven proactive research pipeline. Runs automatically via UserPromptSubmit
  — there is no slash command to trigger it. This page documents how it works,
  how to disable it, and the env-var knobs.
---

# Proactive Research

Every substantive user prompt is fed through a 3-stage background pipeline
that detects external-knowledge gaps in the project wiki and fills them by
dispatching `/wiki-ingest` against canonical URLs.

## Pipeline shape

```
user prompt
  ↓ proactive-research-extract.sh   (UserPromptSubmit hook, ≤50ms)
  │   filters: WIKI_DRIVER guard, AGENT_ID guard, disabled flag,
  │            slash-command, MIN_TOKENS, rate-limit
  │   spawns: detached driver subprocess
  ↓
proactive-research-driver.sh        (background, fire-and-forget)
  ├─ Step 1: claude -p '/wiki-query <prompt>'      (Sonnet)
  │            → markdown with Answer / Evidence / Gaps
  ├─ Step 2: curl Haiku messages API
  │            system: templates/classifier.md
  │            user:   wiki-context + sanitized prompt
  │            → {worthy, reason, sources:[{topic,url}, ...]}
  └─ Step 3: for each source.url:
               claude -p '/wiki-ingest <url>'      (Sonnet, detached)
```

Cost per worthy prompt: 1 Sonnet `/wiki-query` + 1 Haiku curl + N Sonnet
`/wiki-ingest`. Cost per not-worthy prompt that cleared the token gate:
1 Sonnet `/wiki-query` + 1 Haiku curl, then stop.

The hook contract is **fire-and-return**: filter, fork, exit. All real work
happens in the detached driver. The hook never touches an LLM and never
writes a queue entry.

## Recursion guard (architectural — do not remove)

The driver invokes `claude -p` to run `/wiki-query` and `/wiki-ingest`. Each
of those would re-trigger `UserPromptSubmit` and fork-bomb us if not
guarded. The driver runs with `WIKI_DRIVER=1` exported into its env; the
producer hook short-circuits at the top when this is set. **Removing this
guard breaks the architecture.**

## Sanitization (privacy)

Before any external call, the prompt is run through
`wiki_sanitize_for_external` in `wiki-common.sh`:

- Strip absolute paths (`/Users/...`, `/home/...`, `/opt/...`, etc.).
- Redact tokens matching the existing `simple-secrets-scan.sh` regex set.
- Strip repo-local identifiers from `git ls-files` (best-effort).

With `PROACTIVE_RESEARCH_PRIVACY_STRICT=1`, the driver fails closed if
any `<repo-local>` placeholder is still present after sanitization.

## Env-var knobs

| Variable                                | Default | Effect |
| --------------------------------------- | ------- | ------ |
| `PROACTIVE_RESEARCH_DISABLED`           | `0`     | Set to `1` to fully disable the producer hook. |
| `PROACTIVE_RESEARCH_MIN_TOKENS`         | `7`     | Producer skips prompts under this token count (tiktoken if importable, else char/4). |
| `PROACTIVE_RESEARCH_RATE_LIMIT_PER_HR`  | `20`    | Producer drops prompts beyond this count per UTC hour. |
| `PROACTIVE_RESEARCH_MAX_SOURCES`        | `4`     | Driver caps the number of `/wiki-ingest` dispatches. |
| `PROACTIVE_RESEARCH_PRIVACY_STRICT`     | `0`     | Driver skips if a repo-local identifier remains after sanitization. |

The driver also requires `ANTHROPIC_API_KEY` for the Haiku curl call. If
unset, the driver logs and exits without dispatching.

## Logs

Driver stdout/stderr append to `~/.claude/proactive-research/log` with one
line per stage:

```
[2026-05-03T19:41:02Z] driver session:abc12345 step1 /wiki-query: ...
[2026-05-03T19:41:08Z] driver session:abc12345 step2 classify (Haiku)
[2026-05-03T19:41:09Z] driver session:abc12345 WORTHY=true reason="..." sources=2
[2026-05-03T19:41:09Z] driver session:abc12345 dispatch /wiki-ingest https://...
```

The producer hook also emits a single `PROACTIVE driver spawned (tokens=N)`
line per dispatch into the wiki's `log.md`.

## Disabling

Three layers, most surgical first:

- One-shot: prefix a slash command (`/help`, etc.) — slash filter skips it.
- Per-shell: `export PROACTIVE_RESEARCH_DISABLED=1`.
- Per-repo: add `PROACTIVE_RESEARCH_DISABLED=1` to your project's
  `CLAUDE.md` env block (via the `enable-abilities` skill).

## Files

- `plugins/wiki-hooks/handlers/proactive-research-extract.sh` — producer hook.
- `plugins/wiki-hooks/handlers/proactive-research-driver.sh` — driver subprocess.
- `plugins/wiki-hooks/templates/classifier.md` — Haiku classifier system prompt.

## Related

- `/wiki-ingest` — explicit, foreground source ingestion (the curated path
  the driver dispatches into).
- `/wiki-query` — synthesis with citations (the driver's Step 1).
- `/wiki-lint` — wiki health check.
