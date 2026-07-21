<!-- Host-agnostic control-channel progress pulses for improve / improve-loop -->

# Contract: Progress pulses (control channel)

## Dialect map (scan first)

| Dialect | When emitted | Jump |
|---|---|---|
| **Pulse** (`PLAN_PROGRESS_ALIGN`) | Each cycle draft/gate/final control-channel update | [Required markdown shape](#required-markdown-shape-plan_progress_align) |
| **PLAN_SPEC_STATUS** | Spec step banners, sync/prove cards, Validation line | [PLAN_SPEC_STATUS](#plan_spec_status--spec-evidence--step-coordinates-canonical) |
| **PLAN_ORIENT** | Tab-switch / mid-cycle orientation (triplet, heartbeat, footer) | [PLAN_ORIENT](#plan_orient--tab-switch--mid-cycle-orientation-canonical) |

Improve already persists truth in `IMPROVE_LOOP.md` and git commits. **Progress pulses** are
**side-channel** operator/UI updates so humans and host goal dashboards see live status
during iteration. They do **not** replace the ledger and must **not** affect stop predicates
or reintegrate.

## Capability

```text
progress.emit(markdown [, structured?])
# Prefer host goal progress when available:
#   goal.report(progress)  — see goal.md (sibling)
# Always fall back to a user-visible assistant/stdout block so the operator never gets silence.
```

## Required markdown shape (PLAN_PROGRESS_ALIGN)

Compact host/headless pulse — greppable heading, residual×2-safe meter, optional Spec line.
**Not** a substitute for mid-cycle PLAN_ORIENT chat (triplet / `improve cycle` log pulse).

Pulse kind map: **`draft`** = Phase 2 (Last cycle replace); **`gate`** = Phase 3v prove card cycle; **`final`** = Phase 4/5 finalize + emit.

```markdown
## Improve progress — cycle K/MAX · iter N · <draft|gate|final>

**When:** <ISO-8601 or local timestamp>
**Target:** <one line from IMPROVE_LOOP title / target>
**Campaign goal:** <one line or —>
**Status:** active | complete | stopped (<reason>)

`complete` on a pulse only after the terminal cycle is **landed** (Phase 4 commit ok; reintegrate as applicable). Before land: keep `active` with Committed pending — never control-channel “done” ahead of durable truth.
**Residual:** m/2 · open P0/P1 k · suite PASS|FAIL|n/a
**Now:** `<step_id>` · `<item slug>` · <action ≤72 chars>
**Last resolved:** <one line or —>
**Next:** <one resolved handoff>
**Outcome (this unit):** confirmed | disproven | partial | blocked | n/a
**Test:** PASS | FAIL | skipped | n/a
**Committed:** pending | yes | no — <reason> | n/a

### This unit — key changes
- <path>: <≤1 line what changed>
- … (at most 8 paths; or "no code landed")

### This unit — key learnings
- <novel learning or disproof; ≤2 lines>
- … (prefer *new* vs prior improve-loop digest; or "none new")

Validation: N pass / M fail (V…) / W pending / K n/a [unverified manual: k] · sync=iter J | skip@J
```

Heading **must** start with `## Improve progress` so headless logs are greppable.
Omit `Validation:` when Spec section is absent. **R8d:** executable Validation fail never
implies Status `complete` — keep `active` + continuing.

**Legacy (continuous A only):** if caller cannot supply `open_p01`, formatter may still emit
`Backlog: done/total items checked` — do **not** prefer this as the residual meter when
open P0/P1 is known (B/M delete-on-complete).

## Optional structured companion

When the host accepts JSON progress (same emit):

```json
{
  "kind": "improve.progress",
  "cycle": 3,
  "max_cycles": 8,
  "iter": 3,
  "pulse_kind": "final",
  "campaign_goal": "align progress formatter with residual×2",
  "phase": "S8 cycle",
  "status": "active",
  "outcome": "confirmed",
  "test": "PASS",
  "committed": "yes",
  "open_p01": 2,
  "residual_streak": 0,
  "step_id": "5-signal",
  "item": "P1:progress-align",
  "action": "emit final pulse",
  "last_resolved": "suite green",
  "next": "continuing cycle 4/8",
  "validation": "Validation: 3 pass / 0 fail / 0 pending / 0 n/a · sync=iter 3",
  "no_progress": 0,
  "same_error": 0,
  "changed_paths": ["README.md"],
  "learnings": ["…"],
  "backlog_done": 2,
  "backlog_total": 5
}
```

`cycle` required. Prefer `open_p01` + `residual_streak` over legacy `backlog_*`.
Markdown is **mandatory**; JSON is optional.

### Optional pure formatter (deterministic)

Ship path: `plugins/claudecraft/tools/improve-progress-format.js`

```bash
node <plugin>/tools/improve-progress-format.js --file pulse.json
# or: … | node improve-progress-format.js
```

Input JSON fields align with the structured companion above (`cycle` required). Use when the
orchestrator wants a guaranteed schema-compliant pulse; still allowed to hand-author the same
markdown. Exit 2 if `cycle` is missing. **PLAN_PROGRESS_ALIGN:** open P0/P1 primary residual
meter; cycle K + iter N both when known.

## Field sources (prefer deterministic)

| Field | Source |
|---|---|
| cycle K / max | L1 cycle_count / MAX_CYCLES (driver); not ledger N alone |
| iter N | Last cycle `**N:**` / header `Iteration counter` (ledger axis) |
| open P0/P1 | Count open `- [ ]` titles with `P0:`/`P1:` under `## Backlog` (**primary residual meter**) |
| residual streak | `consecutive-non-material-cycles` after Phase 3 |
| item / step_id | Selected slug + L2 step id (display only — not resume authority) |
| Validation | When `## Spec validation` exists — **one grammar** (see PLAN_SPEC_STATUS below): `Validation: N pass / M fail (V…) / W pending / K n/a [unverified manual: k] · sync=iter J \| skip@J`. On any executable fail / seeded `validate V<k>`: verdict is **continuing** (R8d) — never “done”. Required phrasing: `Validation fail → seeded V… → continuing cycle K+1` |
| outcome / test / committed | Latest Last cycle |
| backlog done/total | **Legacy / A continuous only** — count `- [x]` vs all checklist lines; omit when `open_p01` set |
| stall counters | `## Stop-condition tracking` |
| changed_paths | Pre-test `CHANGED_PATHS`, or `git show --name-only` if commit landed |
| learnings | Thesis + Outcome (+ disproof) + short Notes; skip restating prior digest |
| next | **One** resolved handoff (not a four-branch menu) |
| caps / elapsed | Driver: k, max_cycles, `started_at` from `.git/improve-runs/*.json` when present |

## When to emit

| Moment | Who | Required? |
|---|---|---|
| After Phase 2 Last cycle replace | improve-loop | **Yes** — draft pulse (Committed may still be pending) |
| After Phase 4 commit or veto | improve-loop | **Yes** — finalize Committed + paths (update same cycle’s pulse or emit short amend) |
| End of Phase 5 | improve-loop | **Yes** if not already finalized post-Phase 4 |
| After each S8 cycle | improve driver | **Yes** — ensure pulse exists; synthesize from Log if cycle omitted it |
| S2 / S3 worktree | improve driver | Optional one-liner |
| S11 reintegrate / S12 destroy | improve driver | **Yes** (short result) |
| S13 done | improve driver | **Yes** final summary |
| Mid Phase 1 | improve-loop | Optional **once** if executor is still running past ~soft budget |

**Do not** emit per advisor message, per file write, or per test log line.

**Relation to PLAN_ORIENT:** mid-cycle tab-switch uses chat `▸` triplet + `improve cycle`
log pulse. This `## Improve progress` block is the **cycle-boundary / host** pulse
(formatter path). Both share residual meter vocabulary (open P0/P1, streak) — not a second
banner dialect.

## PLAN_SPEC_STATUS — Spec evidence + step coordinates (canonical)

Durable Spec truth is `## Spec validation` + git. This section is the **only** normative
control-channel dialect for Spec sync/prove (A authors; B/M quote verbatim).

### Coordinates

| Axis | Display | In `spec-sync` marker? |
|---|---|---|
| L1 cycle K | `cycle K/MAX` (omit pre-first-L2) | No |
| Ledger iter N | `iter N` | **Yes only** — `<!-- spec-sync: iter N -->` |
| L2 step id | ASCII token | — |

Step ids: `0-resume` · `1-execute` · `2-learn` · `3-replan` · `3-apply` · `3-spec-sync` ·
`3v-prove` · `4-commit` · `5-signal`.

### 1. Step banner (extend existing `▸` dialect — no box rulers)

```text
▸ improve · Phase 3 · cycle K/MAX · iter N · 3-spec-sync · <one-line action> (from 3-apply)
```

All L2 steps use this one dialect. `(from <prev-id>)` required entering `3-spec-sync`,
`3v-prove`, `5-signal`. Pins: never glyphs or `━` rulers.

### 2. Spec sync evidence

**Sync path** — short card:

```markdown
### Spec sync · cycle K/MAX · iter N

| | |
|---|---|
| **Step** | `3-spec-sync` |
| **Path** | sync |
| **Marker** | `spec-sync: iter N` |
| **Anchors** | brief · material Backlog · assumptions · Test command |
| **Rows** | +added · ~updated · n/a-retired · unchanged |

**Delta** (≤8 lines; then `+j more`)
- V<k> …
```

**Skip path** — one line under banner (not a full card):

```text
Spec sync · skip · unchanged since iter J · marker intact
```

### 3. Spec prove card (`3v-prove`)

```markdown
### Spec prove · cycle K/MAX · iter N · 3v

| | |
|---|---|
| **Step** | `3v-prove` |
| **Header** | pass \| pending \| n/a (vacuous) |
| **Counts** | N pass / M fail / W pending / K n/a |
| **Loop effect** | continuing (R8) \| no spec obstacle — completion still governed solely by R7 residual×2 \| vacuous |

**Evidence (non-pass rows only)**
| ID | Intention (short) | Result | Evidence | Next |
|---|---|---|---|---|
| V2 | Preserve: … | fail | exit 1 · tail… | seed `validate V2` |

pass: V1 V3 · n/a: V5

**Seeds this 3v:** `validate V2: …` · none
```

Result tokens for pins: ASCII `pass` / `fail` / `pending` / `manual` / `n/a`. Loop effect
never “done”/“complete”.

### 4. Validation line (pulse · commit-body Test evidence · discovery)

```text
Validation: N pass / M fail (V…) / W pending / K n/a [unverified manual: k] · sync=iter J | skip@J
```

One line; greppable `Validation:`. Digests accept legacy lines without `· sync=`.

### 5. Discovery Spec block (≤2 lines)

```markdown
**Spec:** <same Validation line>
**Unmet:** V2 … — seeded|open · _(none)_
```

### 6. Campaign report Spec arc

```text
Spec: last Validation … · sync iters N..N' · failed ids this campaign (if any)
```

### Emit cadence (Spec path)

| Moment | Emit | Required? |
|---|---|---|
| Enter L2 step | `▸` banner + step id | Yes (all steps) |
| End `3-spec-sync` | Sync card or skip one-liner | Yes |
| End `3v-prove` | Prove card | Yes when Spec exists or T2 write-section seeded |
| Pulse Phase 2/4/5 | Validation line | Yes when Spec exists |
| Discovery | Spec block ≤2 lines | Yes when Spec exists |
| Mid-Proof per row | Do not spam | Optional one evaluates beat |

Evidence rules: unmet executable rows in prove table + Validation fail ids; pass rows not
re-printed full; control channel never invents Status; ledger+git win on disagreement.
Pin ASCII only: `3-spec-sync`, `Spec prove`, `Spec sync`, `Validation:`, `spec-sync: iter`,
`improve goal ·`, `· on:`, `(cont)`.

## PLAN_ORIENT — tab-switch / mid-cycle orientation (canonical)

Cycle-boundary cards (kickoff, discovery, campaign report) already orient. **Intra-cycle**
re-entry is the gap: longest wall-clock stretches (Phase 1 execute, Phase 3 replan) surface
coordinate-less beats and a phase banner several screens above the scroll bottom.

**Fancy = density + orientation recurrence**, not a second decorative system. One dialect:
existing `▸` banners + existing pulse line + one new greppable label `improve goal ·`.

### Gaps (do not re-litigate Spec dialects)

| ID | Gap |
|---|---|
| A | Reasoning beats omit cycle/iter/phase — mid-Phase-1 newest lines do not orient |
| B | Campaign goal only at kickoff + discovery end — invisible mid long execute |
| C | Banner has *now* without meter; pulse has *meter* without item — never co-located mid-cycle |
| D | No freshness guarantee at scroll bottom after phase-entry banner |
| E | STOP line meter-less (minor if report immediate) |

### P0-1 — Orientation triplet (long-phase entry only)

At entry to **`1-execute`** and **`3-replan`** only, emit the existing `▸` banner **immediately
followed by** a goal line and the standard pulse line:

```text
▸ improve · Phase 1 · cycle K/MAX · iter N · 1-execute · execute: <item ≤80 chars> (from 0-resume)
improve goal · <campaign goal ≤100 chars> · done-when residual×2 + green suite
improve cycle K/MAX · iter N · active · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · continuing
```

- One new greppable label: `improve goal ·` (ASCII pin).  
- Reuses existing `▸` + pulse prefixes.  
- Goal line states R7 **done-when rule text**, never a live complete status.  
- Other L2 steps keep the bare one-line `▸` banner (no forced triplet).  
- **Rejected:** packing goal/Status/open/residual onto the `▸` line itself (anti-bloat;
  Fable #3 one dialect + Sol mega-banner rejection).

### P0-2 — Re-banner heartbeat inside long phases

After substantial sub-actions within `1-execute` / `3-replan` (suite finished, revert applied,
hygiene pass, advisor round returned), re-emit the `▸` banner with the same coordinates and
an updated one-line action, suffixed `(cont)`:

```text
▸ improve · Phase 1 · cycle K/MAX · iter N · 1-execute · test suite finished — reconciling Outcome (cont)
```

Rule of thumb: **no stretch of more than ~8 tool calls** without a coordinate-bearing `▸`
line. Zero new dialects; `(cont)` is ASCII. Beats stay terse — the nearby banner carries
coordinates.

### P1-1 — Turn-end pulse footer (mid-cycle turns)

Any assistant turn that ends while a cycle is in flight (i.e. **not** ending on a discovery
card or campaign report) ends with the standard pulse line, extended with an `· on:` tail
naming the **current work-item slug** (≤60 chars):

```text
improve cycle K/MAX · iter N · active · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · continuing · on: <item slug ≤60 chars>
```

- Strongest tab-switch affordance: last chat line = meter + current item.  
- Additive `· on:` suffix; digests **must** tolerate legacy pulses without it.  
- Footer **never invents** status — quote last gate-set status; after 3v fail use
  `active · continuing` (R8), never `done`/`complete`.  
- **Item slug** (Sol fold): short stable identity for the selected unit
  (`P1:validate-V2`, `P1:alias-registry`, `residual-survey`, `product-residual-survey`).
  Derive at selection; carry through later banners/footers; never treat as resume authority.
  Optional one-shot focus block when the item **changes** only — not every phase.

### P1-2 — STOP + pulse pair

On any `▸ improve · STOP …`, emit the pulse line **immediately after** it:

```text
▸ improve · STOP · cycle K/MAX · <reason code> — <one human sentence>
improve cycle K/MAX · iter N · stopped (<reason>) · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · report next
```

### P1-3 — Resolved Phase 5 handoff (Sol fold)

Discovery card **Next** and `5-signal` banner state **one chosen branch**, not a menu of
every possible branch:

```text
**Next:** continuing cycle K+1/MAX · next open: <slug or residual survey>
```

or on terminal: `**Next:** campaign report · merge-back` / operator action. On 3v fail:
name the seeded item and `continuing cycle K+1` per R8d.

### P2 — Discovery card row order

Hoist **Residual meter** to immediately under **Campaign goal (reminder)** (label-only
reorder; digests key on labels, not row order). Full discovery slim (suppress zero counters)
is deferred.

### Emit cadence (orientation)

| Moment | Emit | Required? |
|---|---|---|
| Enter `1-execute` / `3-replan` | Orientation triplet (banner + goal + pulse) | **Yes** |
| Sub-action in long phase | `▸` re-banner `(cont)` | **Yes** when >8 tools since last coordinate line |
| Mid-cycle assistant turn end | Pulse footer with `· on:` | **Yes** |
| STOP | STOP banner + pulse pair | **Yes** |
| Item selection change | Optional short focus block once | Optional |
| Discovery **Next** | One resolved handoff only | **Yes** |

### Explicit non-goals (PLAN_ORIENT)

- No second banner system / box rulers / `━` / continuation glyphs in pins  
- No progress-bar % toward “done” (R7 is residual×2, not a gauge)  
- No emoji meters on greppable lines  
- No re-kickoff per cycle / mid-cycle dashboard cards  
- No status synthesis in orientation lines (`complete`/`done` only from gates)  
- No relying on `update_goal` as sole orientation channel  
- No Spec Kit; dual-home: A authors this block; B/M quote verbatim — never dump A
  reference trees into B/M  

## Host map

| Host | Emit |
|---|---|
| Claude goal mode | Progress/update tool with markdown body if available |
| Grok goal mode | `update_goal` message (or equivalent) with markdown |
| No goal facility | User-visible assistant markdown block |
| Headless / CI | stdout with `## Improve progress` |
| `improve` driver S8 | User-visible pulse each cycle (`goal.report` if host goal also bound) |

**Order:** try host goal progress → always ensure visible markdown fallback.

## Privacy

- No secret-shaped strings (same patterns as Phase 4 commit scan).  
- No full test logs, `.env`, or raw tokens — at most a one-line test summary / error signature.  
- Truncate paths and learnings rather than pasting large dumps.

## Relation to ledger

| Durable | Ephemeral |
|---|---|
| `IMPROVE_LOOP.md` Log | Progress pulse |
| `improve-loop: iteration N —` commits | Goal UI / chat |

If pulse and Log disagree, **Log + git win**.

Pulses do **not** replace `## Driver` or run-state JSON for resume after compaction — those
are durable; pulses are side-channel only.
