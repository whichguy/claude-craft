# Karpathy LLM-wiki concept research → wiki-suite gap analysis (Task #21)

Propose-only review. Maps wiki-suite against Karpathy's canonical "LLM Wiki" pattern (April 2026) and the maturing follow-on patterns (LLM Wiki v2, llm-wiki-kit, obsidian-wiki). Recommends 5 prioritized improvements.

## Maturity verdict

**Converging — not mature, but past the proof-of-concept stage.**

- Canonical source published April 2026: [karpathy/llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — viral within days, 5,000+ stars.
- Multiple independent open-source implementations within ~1 month: [llm-wiki-kit](https://github.com/iamsashank09/llm-wiki-kit), [obsidian-wiki](https://github.com/Ar9av/obsidian-wiki), and the agent-memory-influenced v2 spec [llm-wiki-v2 gist](https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2).
- A real evolution path is visible: v1 (Karpathy) is a 3-operation file-system pattern; v2 imports cognitive-science-flavored ideas (consolidation tiers, Ebbinghaus decay, reinforcement signals) from the agent-memory research line (MemGPT, Letta, Mem0).
- No conventions are locked in yet — schema fields, decay rates, tier definitions all vary. But the *shape* of the conventions is consistent across implementations.

## Karpathy's canonical pattern (v1)

> "Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki**. The wiki is a persistent, compounding artifact. The cross-references are already there." — Karpathy

**Three-layer architecture:**
1. **Raw sources** — immutable user-curated material (PDFs, URLs, articles).
2. **The wiki** — LLM-owned markdown pages (entity pages, source pages, query results).
3. **The schema** — `CLAUDE.md` (or `AGENTS.md`) telling the LLM how to maintain the wiki.

**Three operations:** `ingest`, `query`, `lint`.

**Design principles:**
- Plain markdown — portable, git-versionable, human-readable.
- LLM owns maintenance — humans abandon wikis; LLMs don't.
- One-time compilation — sources processed once, not re-read on every query.
- Optional tooling — modest scale (~100 sources) needs only `index.md`.

## What v2 + parallel implementations add

| Pattern | Source | Description |
|---|---|---|
| Memory consolidation tiers | LLM Wiki v2 | Working → Episodic → Semantic → Procedural memory. Each tier more compressed, more confident, longer-lived. |
| Ebbinghaus decay | LLM Wiki v2 | Confidence/retention decays exponentially with time; access reinforcement resets the curve. Domain-specific rates (architecture: slow; transient bugs: fast). |
| Reinforcement signals | LLM Wiki v2 | Confidence scores include access frequency, recency, contradiction count, source count. Writes "know" their provenance. |
| Multi-format ingestion | llm-wiki-kit | First-class PDF / URL / YouTube transcript / markdown ingest layer. |
| MCP integration | llm-wiki-kit | Standard MCP tool surface (`wiki_ingest`, `wiki_search`, `wiki_lint`, `wiki_graph`, `wiki_log`). Works across Claude, Codex, Cursor, Windsurf. |
| Full-text search | llm-wiki-kit | SQLite FTS5 backend instead of grep. |
| Graph visualization | llm-wiki-kit | Interactive HTML visualization of cross-link structure. |
| Auto-ingest hook | LLM Wiki v2 | Ingest on new source arrival (file watcher / clipboard). |
| Session-end compression | LLM Wiki v2 | Episode-tier compression at session boundary. |
| Contradiction detection on write | LLM Wiki v2 | Block or flag at write time, not just at lint time. |

## Gap analysis: wiki-suite vs the conventions

| Convention | wiki-suite has it? | Detail |
|---|---|---|
| 3-layer architecture (raw / wiki / schema) | ✅ | `raw/` + `.wiki/` + `SCHEMA.md` + `CLAUDE.md` directive |
| Plain markdown | ✅ | All pages markdown with YAML frontmatter |
| Ingest / query / lint operations | ✅ | `/wiki-ingest`, `/wiki-query`, `/wiki-lint` |
| `index.md` + `log.md` | ✅ | Plus a maintenance/ dir for lint reports |
| LLM-write-protected raw/ | ✅ | `wiki-raw-guard.sh` PreToolUse hook |
| Append-only multi-source attribution | ✅ | `**From [Source]:**` bullet pattern in entity pages |
| Cross-linking | ✅ | `related: [...]` frontmatter + inline `→ See also:` |
| Contradiction handling | ⚠️ partial | Pages can have a `## Contradictions` section but no automated detection on write |
| Confidence scoring | ⚠️ partial | `confidence: high\|medium\|low` field exists, but no reinforcement / decay logic |
| Memory consolidation tiers | ❌ | Entities (≈semantic) and queries (≈episodic) exist as page types but there's no working-memory or procedural-memory tier, and no automated promotion between tiers |
| Decay / forgetting curve | ❌ | `last_verified` field exists; lint flags >180-day stale but does NOT decay confidence or surface decay-aware results to query |
| Access-frequency reinforcement | ❌ | Hits via `/wiki-load`, `/wiki-query`, or `wiki-read-gate` are not recorded; high-traffic entities don't accumulate confidence |
| Auto-ingest on new source | ❌ | Manual `/wiki-ingest` only |
| Session-end episode compression | ⚠️ partial | `wiki-stop.sh` queues `session_wiki` for extraction, but the extraction is entity-focused (semantic), not an explicit episodic-tier rollup |
| Multi-format ingestion (PDF/YouTube) | ❌ | URL + file only — no PDF text extraction, no YouTube transcript fetch |
| Full-text search | ❌ | grep + cached entity-index.tsv — fine at modest scale, but no FTS |
| MCP tool surface | ❌ | Skills/commands only; no MCP server |
| Graph visualization | ❌ | None |

## What wiki-suite does that nobody else does

These are differentiators worth preserving regardless of where the broader pattern goes:

1. **Two-tier wiki** — project `.wiki/` + global `~/.claude/wiki/topics/`. Most implementations are single-project; this lets a topic learned in one repo surface in another.
2. **Cache layer** (`display.txt`, `context.txt`, `entity-index.tsv`, `file-refs.tsv`) for sub-millisecond hook-time lookups. Most others rebuild context per query.
3. **PreToolUse(Read) file-ref hint** (`wiki-read-gate.sh`) — surfaces wiki entities exactly when the user opens a file documented by the wiki. Karpathy + parallel projects all rely on at-query-time lookup; this is hook-driven proactive injection.
4. **Proactive-research hook** — auto-spawns a research driver on novel prompts (token-count + rate-limit gated). Most others require manual `/ingest`.
5. **14-handler lifecycle** vs the typical 3-operation surface. SessionStart, UserPromptSubmit, PostToolUse(Write|Edit), PreCompact, Stop, SessionEnd all participate. Heavier than v1, but the v2 spec says you want exactly this — we built it before the spec was written.
6. **Probabilistic background lint** with a 45-min global cooldown + per-session marker. Most implementations make lint a manual operation.

## Recommended improvements (priority order)

### 1. Access-frequency reinforcement (HIGH — small lift, large UX win)

**Pain**: high-value entities and low-value entities are indistinguishable in the index. A 3-year-old entity nobody has hit in months has the same `confidence: high` as one that drove every session this week.

**Design**: add `access_count` + `last_accessed` to entity frontmatter; bump on every `/wiki-load`, `/wiki-query`, and `wiki-read-gate` hit. Surface in lint as an "underused" report (low access_count + old created date) and a "hot" report (high access_count). Optionally: have `/wiki-query` weight matched entities by access score in result ordering.

**Effort**: ~50 lines across `wiki-load` SKILL, `wiki-query` SKILL, `wiki-read-gate.sh`, and `wiki-lint` SKILL. Frontmatter is additive (existing pages remain valid). No schema break.

**Risk**: low — purely additive metadata. Worst case the bump is wrong by a few counts.

### 2. Confidence decay tied to `last_verified` (HIGH — directly addresses an existing field)

**Pain**: `confidence: high` doesn't fade. An entity verified 18 months ago and never re-touched still says "high" — that's the well-known abandoned-wiki problem v2 was designed to fix.

**Design**: don't physically decay the field; compute an *effective confidence* at read time. `wiki-load` and `wiki-query` would compute `effective_confidence = confidence × decay(today - last_verified)` with a configurable half-life per `tags:` (architecture: 365 days, decisions: 180, transient: 30). Surface to the LLM in retrieval as e.g. `confidence: high (effective: medium — last verified 247 days ago)`.

**Effort**: ~30 lines in a new `wiki-common.sh` helper + one-line wrapping in load/query.

**Risk**: low — read-time only, no migration. The decay function itself is the only design call.

### 3. Contradiction detection on write (MEDIUM — high value, moderate lift)

**Pain**: contradictions land silently. The `## Contradictions` section is hand-maintained; entity pages routinely accumulate "From source A: X" and "From source B: not X" without flagging.

**Design**: when the extraction worker (`wiki-worker.sh` Sonnet pass) writes an entity page update, run a follow-up Haiku pass with a prompt: "Read this entity. List contradictions between bullets." If non-empty: append to the page's `## Contradictions` section AND log to `wiki-log.md` with type `CONTRADICTION` AND surface in the next lint report.

**Effort**: ~50 lines in `wiki-worker.sh` + a new template prompt. Costs one extra Haiku call per write — cheap on the c-thru background route.

**Risk**: medium — false-positive contradictions are noise; want a high-precision prompt.

### 4. Episodic-tier rollup at session boundary (MEDIUM — fills a real gap)

**Pain**: extraction at Stop / SessionEnd produces semantic-tier updates (entity pages) but loses the *episodic* shape: "in session X we worked on Y, made decision Z, hit blocker W". Future-you wants to recall the episode, not just the resulting facts. We currently have `queries/` pages for explicit `/wiki-query` results but no automatic session-summary pages.

**Design**: at Stop, in addition to the existing entity extraction, the worker writes `episodes/SESSION_SHORT.md` with frontmatter `{type: episode, session: SHORT, started: ts, ended: ts, related_entities: [...]}` and a 5-bullet body capturing the session arc. Episodes are pure-additive; `/wiki-load` includes them when relevant.

**Effort**: ~80 lines (worker prompt, page template, schema fields, lint accommodation).

**Risk**: medium — schema migration: adds an `episodes/` dir + a new `type: episode` value. Consumers (`/wiki-load`, lint) need to know about it. Backward-compatible if treated as additive.

### 5. Multi-format ingestion: PDF + YouTube (LOW priority — known good pattern but heavy lift)

**Pain**: `/wiki-ingest <pdf>` currently treats the PDF as binary and either skips it or fails. Same for YouTube URLs. llm-wiki-kit shows what users expect.

**Design**: detect MIME / URL pattern in `/wiki-ingest`. PDF → `pdftotext` (or chrome-devtools MCP for pages). YouTube → `yt-dlp --write-auto-sub` for transcript. Then proceed with the existing source-page write.

**Effort**: ~40 lines in `wiki-ingest` SKILL plus a dependency check (`pdftotext`, `yt-dlp`) at the top with a friendly stderr message if missing. Treats them as optional plugins to the ingest skill — degrades gracefully.

**Risk**: low — opt-in, only fires when MIME/URL matches.

## What I would NOT add right now

- **MCP server** (à la llm-wiki-kit). MCP is one delivery surface among several; we already have skills + slash commands which work great inside Claude Code. Adding MCP doubles the maintenance surface for marginal cross-tool benefit.
- **Graph visualization**. Cool demo; doesn't change quality of retrieval. Defer until users ask for it.
- **Working-memory tier** (transcript-of-session-not-yet-extracted). The existing reflection-queue + worker pattern already plays this role implicitly — formalizing it as a "tier" adds vocabulary without changing behavior.
- **Procedural-memory tier**. Procedural memory in agent-memory research means "learned workflows from repeated patterns". For an opinionated solo-dev wiki this is over-engineering; revisit if the wiki ever serves multiple users with shared workflows.

## Top-2 recommended changes (if you only want to ship one batch)

1. **Access-frequency reinforcement** — simple, additive, immediately makes lint reports useful for prioritization. Foundation for any future relevance-ranking.
2. **Confidence decay at read time** — turns the existing `last_verified` field into a live signal instead of a dead field. Requires no migration.

Both can ship together as a single ~80-line change with a one-page schema bump (v2 → v3) and a lint-report addition. They convert two existing dormant frontmatter fields (`last_verified`, `confidence`) into a working memory-decay system without inventing new tiers.
