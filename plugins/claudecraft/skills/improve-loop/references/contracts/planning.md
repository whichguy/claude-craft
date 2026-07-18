<!-- Host-agnostic planning contract — cold-start + replan intensity (Spec-Kit-lite, no Spec Kit dep) -->

# Contract: Planning (campaign brief + tiers + backlog grammar)

Normative design for **elaborate planning** without residual theater. Package **A**
(continuous) and package **B** (open-only dogfood) share this design language; **apply
rules fork** (see PLAN_APPLY).

## Glossary

| Term | Meaning |
|---|---|
| **Open P0/P1** | Unchecked **title** lines under `## Backlog` that count for residual×2 / complete (package-local open-count) |
| **Six-clause material** | Kinds `defect` \| `product-choice` \| `architecture` \| `implementation` with five clause sub-bullets |
| **Residual item** | Kind `[residual]` with Evidence + Acceptance only |
| **Residual-only cycle** | Open P0/P1 count **= 0** after replan (not “has a residual seed item”) |
| **Promote-class** | Scan candidates classified `promote` (see below) |

## Promote-class (classify table) — PLAN_CLASSIFY

After inspect of limitations / deferred / operator surfaces / habitat SKIP (product-mixed
always; defect when applicable):

| Class | Criteria (all for **promote**) | Effect |
|---|---|---|
| **promote** | (a) surfaced by scan, (b) not COMPLETED_SET / unexcused DISPROVEN_SET, (c) not `limitation waived:` this campaign, (d) implementable in ≤1 cycle under recorded suite | Six-clause material (T2) |
| **keep P2** | Real but not ≤1-cycle or not worth a material cycle | Deferred one-line P2 |
| **waive** | Intentional forever / out-of-scope | Notes `limitation waived: <short>` + `classify: waive — <why>` |

Every scanned candidate → Log Notes: `classify: promote|keep P2|waive — <why>`.

**T2** iff promote-class non-empty **or** `--plan-deep`.  
**T0p** iff product/mixed **and** promote-class empty **after** full scan.  
**T0** (defect) iff no promote-class after inspect.

## Decision order (cold-start)

```text
1. SEED_MODE (defect | product | mixed)
2. Inspect + git digest + habitat
3. Classify every candidate (promote|keep P2|waive) + Notes
4. Choose plan tier
5. Write brief (if required) + Backlog + Deferred + Product residual survey header
6. Phase 1 if selecting an open item (incl. residual investigation);
   residual-only cycle only when open count = 0
```

## Plan tiers

| Tier | When | Brief | Cold-start seed | Advisors |
|---|---|---|---|---|
| **T0** | defect + empty promote-class | Optional | Thin residual survey (**never empty open** on cold-start) | Native-only preferred |
| **T0p** | product/mixed + empty promote-class after scan | Full | Residual thin product survey; survey flag **pending** | Native-only preferred |
| **T2** | promote-class non-empty or `--plan-deep` | Full | 1–3 six-clause (**seed cap**) | Full panel if configured |
| **T1** | mid-campaign after land | Keep + surgical delta | Preserve clauses; replan free | Panel on stall/disagreement |
| Mid residual×2 | open count 0 | Keep | Empty open OK | Native |

**Product residual survey header:** `**Product residual survey:** pending | done | n/a (defect)`.  
Cold-start T0p does **not** set `done` — mid-campaign gate still fires once when open hits 0.

## Campaign brief — PLAN_BRIEF

```markdown
## Campaign brief
- **Target:** …
- **Problem / opportunity:** …
- **In scope:** …
- **Out of scope / waived:** …
- **Constraints:** …
- **Sources inspected:** …
- **Success / Done when:** restates skill law only — residual×2 + green suite
  (+ product residual gate when product/mixed). Must not invent new complete predicates.
- **Open questions:** none | …
- **Plan tier:** 0 | 0p | 1 | 2
```

| Rule | Detail |
|---|---|
| **A placement** | After `## Driver`, before `## Backlog` |
| **B placement** | After `## Isolation`, before `## Backlog` |
| Delimiter | `## Campaign brief` body through next `## ` |
| Writer | Orchestrator only; advisors recommend deltas |
| Soft caps | ≤12 bullets / ~400 words; each clause line ≤200 chars |

## Canonical backlog forms (PLAN_TAG / PLAN_CLAUSES / PLAN_RESIDUAL)

**Greppable (preferred new seeds, B required):**

```markdown
- [ ] P1: [defect] <change> (<path/symbol>) — <why>
  - Evidence: …
  - Decision: …
  - Preserve: …
  - Unknown: none | …
  - Acceptance: …
```

```markdown
- [ ] P1: [residual] <finding> (<path/symbol>)
  - Evidence: …
  - Acceptance: …
```

**Legacy A (still valid — PLAN_LEGACY_A):** `- [ ] [P1][defect] …` with same clause sub-bullets.

**Unknown gate:** at most one cold-start seed with `Unknown:` ≠ `none`; that item →
investigation Thesis first.

## Multi-line grammar — PLAN_APPLY

Contiguous **item block** = title + immediate sub-bullets matching
`^  - (Evidence|Decision|Preserve|Unknown|Acceptance):`  
Block ends at next checklist title, next `## `, or blank line then non-clause content.

- Residual: only Evidence + Acceptance; strip Decision/Preserve if present.
- Extra sub-bullets → drop to Notes.
- Orphan clause lines → strip on apply.
- One line per clause this arc.
- Phase 2 complete: **delete entire contiguous block** (title + clauses), not title alone.

## PLAN_APPLY package fork

### Apply (A continuous)

- Preserve already-`[x]` items verbatim in replan.
- Do **not** open-only delete of completed history this arc.
- Open-count: unchecked non-P2 titles; dual-accept greppable + legacy forms.
- New seeds prefer greppable `P1: [kind]`.

### Apply (B open-only)

- Never emit `- [x]` in live Backlog.
- Complete = **delete entire contiguous block** (title + clauses).
- Open-count: unchecked title lines matching `^- \[ \] .*P[01]:`.
- Mini-parser: `scripts/backlog-blocks.js` (parse / openCount / deleteBlock).

## Intent digest (Phase 4)

Live ledger holds full clauses. Phase 4 `Next backlog:` may be title-only.
For each still-open **six-clause material** item, commit Notes/body:

`open intent: <short> | Decision: … | Preserve: …`

Next cold-start prefers intent digest + COMPLETED/DISPROVEN over free invention.

## Advisor schema + throttle

Structured 5-block (native-replanner and advisors):

```text
1. Purpose fit
2. Material recommendations (class + kind + clauses or residual thin)
3. Deferred P2
4. Risks / stop
5. Anti-reseed (COMPLETED/DISPROVEN rejected or none)
```

| Package | Throttle |
|---|---|
| **A** | Continuous driver `throttle.md` (full panel every **3rd** cycle or stall) — cite, do not override here |
| **B** | Residual/T0/T0p/T1: **native-only**. Full panel only T2 / `--plan-deep` / stall / disagreement. No periodic K this arc |

Advisor input soft cap: open Backlog + last 3 Log + compact COMPLETED/DISPROVEN sets.

## Static PLAN_* pin IDs (docs)

`PLAN_TAG` · `PLAN_CLAUSES` · `PLAN_RESIDUAL` · `PLAN_BRIEF` · `PLAN_APPLY` ·
`PLAN_CLASSIFY` · `PLAN_LEGACY_A`

Hard refusals: no Spec Kit dep; no residual theater; no inventing material for residual×2;
A continuous `[x]` freeze; no hermes SKILL dual-home claim from this contract alone.
