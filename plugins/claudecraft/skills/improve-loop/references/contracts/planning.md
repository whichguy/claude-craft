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
| **Spec validation row** | One V-row under `## Spec validation` (PLAN_VALIDATE): intention + kind + artifact + Proof + Status |
| **Phase 3v** | Completion-path gate: run executable Proofs when open P0/P1 = 0; fail seeds coding work |
| **Live plan** | `IMPROVE_LOOP.md` working memory (aka **live ledger** in older pins). History = git commit bodies — not multi-entry Log |

## Promote-class (classify table) — PLAN_CLASSIFY

After inspect of limitations / deferred / operator surfaces / habitat SKIP (product-mixed
always; defect when applicable):

| Class | Criteria (all for **promote**) | Effect |
|---|---|---|
| **promote** | (a) surfaced by scan, (b) not COMPLETED_SET / unexcused DISPROVEN_SET, (c) not `limitation waived:` this campaign, (d) implementable in ≤1 cycle under recorded suite | Six-clause material (T2) |
| **keep P2** | Real but not ≤1-cycle or not worth a material cycle | Deferred one-line P2 |
| **waive** | Intentional forever / out-of-scope | Notes `limitation waived: <short>` + `classify: waive — <why>` |

Every scanned candidate → Last cycle Notes: `classify: promote|keep P2|waive — <why>`.

**T2** iff promote-class non-empty **or** `--plan-deep`.  
**T0p** iff product/mixed **and** promote-class empty **after** full scan.  
**T0** (defect) iff no promote-class after inspect.

## Operator spine (HYBRID work-spec + Validation Spec) — PLAN_VALIDATE lifecycle

**One spine, two views** (Codex Soul HYBRID — normative):

```text
INTENTION
  → WORK SPEC: ## Campaign brief + runtime state + material Backlog/Acceptance
  → VALIDATION SPEC: ## Spec validation (derived V-rows + Proofs)
  → PROOF ARTIFACTS / TESTS when R2 requires
  → CODE
  → 3v PROVE (fail → seed validate V → R8 continue)
  → residual×2 + green suite → R7 complete
```

| View | Owns | Does not own |
|---|---|---|
| **Work spec** (brief + material Backlog + runtime contract) | Product intent: what/why, preserve, assume, scope, behavioral Acceptance | Proof commands; V-row Status; suite green |
| **Validation Spec** (`## Spec validation`) | Proof mapping + latest proof Status | Originating new product intent; Status `complete` |
| **Tests** | Artifacts cited by V-rows | Being the work spec |

Do **not** add a second `## Work Spec` table. Do **not** freeze V-rows before applied brief/backlog anchors. If proof design finds a hole: **revise work-spec first**, then PLAN_SPEC_SYNC. All V pass alone never completes (R7).

```text
1. PLAN     — work-spec: brief + material Backlog + locks (+ runtime when claimed)
2. VALIDATE — ## Spec validation V-rows **derived** from work-spec anchors + proof artifacts
3. CODE     — product (+ un-quarantine / test fill-in)
4. PROVE    — Phase 3v runs Proofs; fail → seed validate V<k> → back to 2/3
```

Improve tests in-loop (R6). residual×2 + green suite remains the **only** Status `complete`
law — 3v blocks complete only by seeding open P0/P1 (never a second complete predicate).

### Sequencing rules (R1–R8, R8b–R8d)

| Rule | Law |
|---|---|
| **R1** | Plan + V-rows before product select when T2/design-change requires validation |
| **R2** | **Mechanical:** if open product Acceptance refs `V<k>` and that V-row’s Proof artifact is **not on disk**, select the open test-authoring item for `V<k>` first (T0 exploratory may skip). **PLAN_SPEC_SOFT never seeds backlog** — soft warnings classify promote\|P2\|waive first |
| **R3** | Product Acceptance references `V<k>` when proving that lock |
| **R4** | Prove (3v) only when open P0/P1 = 0 after replan |
| **R5** | 3v fail → seed `validate V<k>` → iterate coding/tests |
| **R6** | Test improvement first-class; a `validate V<k>` item may fix **product or proof** |
| **R7** | residual×2 + green suite sole Status complete — never “all V pass ⇒ complete” alone |
| **R8** | 3v fail is **never** a terminal Status and **never** an L1 exit reason. In **autonomous** mode, after 3v seeds any `validate V<k>` (or write-section) item, L1 **must immediately** start the next L2 cycle without asking the user — keep coding/fixing until Spec validation is clean or hard stops fire |
| **R8b** | Exit campaign only when: (`**Spec validation:** pass` or vacuous `n/a`) **and** residual×2 complete rules fire, **or** hard stop (same-error ×3 / no-progress ×3 / max-cycles / blocked) |
| **R8c** | `--once` / once mode: still seed and leave Status `active`; **do not** auto multi-cycle — operator re-invokes |
| **R8d** | Discovery card / pulse after 3v fail: say **continuing** (cycle K+1), never “done” |

### Quarantine convention (red-first proofs)

- New proof tests land **quarantined** (skip/pending marker **or** path excluded from default
  recorded test command / Confirm invocation) so the default suite stays green.
- V-row **Proof** cell invokes the test **explicitly un-skipped**.
- Product Acceptance includes **un-quarantine** when the feature is meant to green that
  proof in the default suite.
- Pre-product red suite must **not** feed same-error ×3 (quarantine is load-bearing).

## Decision order (cold-start)

```text
1. SEED_MODE (defect | product | mixed)
2. Inspect + git digest + habitat
3. Classify every candidate (promote|keep P2|waive) + Notes
4. Choose plan tier
5. Write brief (if required) + ## Spec validation when required (T2 / design-change;
   optional T0) + header **Spec validation:** n/a|pending|pass
   + Backlog + Deferred + Product residual survey header
   Prefer seed test-authoring P1s for missing Proof artifacts before product P1s (R2)
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

## Campaign brief — PLAN_BRIEF (work-spec anchors)

Work specification = `## Campaign brief` + material six-clause Backlog (+ runtime state).
Acceptance states **behavioral** outcomes, not proof commands; may cite `V<k>` after derive.

```markdown
## Campaign brief
- **Target / desired outcome:** …
- **Problem / opportunity:** …
- **In scope:** …
- **Out of scope / waived:** …
- **Constraints:** …
- **Sources inspected / Open questions:** … / none | …
- **Surface types / Fidelity preference:** … | n/a — headless
- **Criteria map:** C#: gap → promote|P2|waive (≤6 non-none)   <!-- PLAN_CRITERIA -->
- **Operator post-land:** none | …
- **Runtime contract:** n/a | filled | investigation-P1:<id>   <!-- PLAN_RUNTIME_CONTRACT -->
- **Runtime record:** … (only if filled; 4–6 lines)
- **T2 challenge:** native | advisor | skipped — <why>
- **Success / Done when:** residual×2 + green suite only (skill law). Product residual
  survey may classify/seed work — never a second complete predicate.
  **Must not invent new complete predicates** (R7 sole complete).
- **Plan tier:** 0 | 0p | 1 | 2
```

| Rule | Detail |
|---|---|
| **A placement** | After `## Driver`, before `## Backlog` |
| **B placement** | After `## Isolation`, before `## Backlog` |
| Delimiter | `## Campaign brief` body through next `## ` |
| Writer | Orchestrator only; advisors recommend deltas |
| Soft caps | ≤12 bullets / ~400 words; each clause line ≤200 chars |

## PLAN_CRITERIA — orchestrator preflight (not a 6th advisor block)

Before Round 1 / native-replanner: surface types; habitat claimed? (predicate below);
runtime contract state; C1–C12 gaps → promote|P2|waive (≤6); sticky P2 reclassify once;
operator post-land ≠ product; fidelity preference. Inject into 5-block inputs 1, 2, 4.
Tokens: `PLAN_CRITERIA`, `Criteria scan`. Soft warnings never auto-seed.

## PLAN_RUNTIME_CONTRACT — habitat claim + state machine

**Habitat claimed** only when current **invocation**, brief **Target/In-scope**, or a **current open Acceptance** promises a named external runtime. Ignore examples, history, Deferred, bare paths, incidental keywords.

| State | Selection effect |
|---|---|
| `n/a` | Habitat not claimed |
| `filled` | Compact runtime record present; packaging allowed |
| `investigation-P1:<id>` | Select that investigation before packaging-only items |

Close investigation → rewrite to `filled` or scoped waiver. **Not a Status gate** (selection only).

## Spec validation — PLAN_VALIDATE (Validation Spec — derived prove view)

**Placement:** After `## Campaign brief`, before `## Backlog` (if no brief: after
Isolation/Driver, before Backlog). Orchestrator-only write; advisors may recommend rows.
Every non-`n/a` V-row cites a **live work-spec anchor**. V-rows must not invent intent.

```markdown
## Spec validation
<!-- PLAN_VALIDATE — Phase 3v completion-path gate. Stable V-IDs (never renumber).
     Proof cells must be copy-paste executable with success semantics.
     PLAN_SPEC_SYNC: derived from work-spec anchors; re-sync on divergence.
     <!-- spec-sync: iter N --> -->

| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | … | suite \| L3-test \| skill-law \| prose-sweep \| dual-home \| habitat \| manual | path(s) | command + success (exit 0 \| match \| no match) | pending \| pass \| fail \| n/a |
```

**Header flag:** `**Spec validation:** n/a | pending | pass`  
- `n/a` — section absent or all rows n/a (vacuous 3v pass)  
- `pending` — non-n/a rows not all executable-pass, or 3v seeded fails  
- `pass` — last 3v run: all **executable** rows pass (pure `manual` never required for pass)

| Kind | Blocks unattended complete? | Proof shape |
|---|---|---|
| **suite** / **L3-test** / **prose-sweep** / **dual-home** | Yes if fail | Runnable command |
| **habitat** | Yes if fail (executable when Proof non-empty) | Container/runtime command; never pass from host suite alone |
| **skill-law** with rg/path pin | Yes if fail | `rg` / path existence |
| **manual** | **Never** alone | Human check; pulse `unverified (manual): k` |

**Tier intensity:**

| Tier | Spec validation |
|---|---|
| T0 residual | Optional / omit or 1 row |
| T0p | Prefer 1–3 rows |
| T2 / `--plan-deep` / design-change | **Required** at Phase 0 (primary); missing at 3v → seed write-section once (fallback) |

**Soft caps:** ≤15 rows / ~400 words. Advisors may **add** rows or mark `n/a` with reason;
**never** delete or reword Proof to make a row pass.

**Phase 3v** (see `phase-3v-validate.md`): when open P0/P1 = 0 after replan and no counter-stop,
run executable Proofs; fail seeds deduped `- [ ] P1: [defect] validate V<k>: …`; residual×2
unchanged as sole complete law.

### Unintended-change check-in (planning-time)

When writing or revising `## Spec validation`, ensure intentions cover **more than the new
feature** — so 3v cannot pass while shipping Preserve violations, regressions, or silent
scope expansion.

| Intention class | Source | Typical Kind | Required when |
|---|---|---|---|
| **Preserve** | Each open material item’s `Preserve:` clause (and brief Constraints when load-bearing) | suite / L3-test / skill-law / prose-sweep | T2 / design-change if Preserve is non-trivial; else Notes `preserve n/a: <why>` |
| **Regression** | Recorded **Test command** + any campaign-critical green invariant | suite (preferred) | Always when a recorded test command exists (T0 may be that single suite row) |
| **Scope** | Brief **Out of scope / waived** + target boundary | prose-sweep / skill-law / manual | T2; vacuous T0 residual may omit |

**Rules:**
- Prefer **executable** Proofs (R6/R7 unchanged). Pure `manual` Scope rows never alone block complete.
- Scope rows should prefer an executable diff-boundary Proof over `manual` when a base ref
  exists (e.g. `git diff --stat <base>.. -- ':!<in-scope path>'` with success = empty/no match).
- Do **not** treat check-in rows as a second complete predicate — 3v still only seeds open
  work; residual×2 sole complete (R7).
- Completing an item (A `[x]` / B block-delete) never removes its Preserve V-row — V-IDs are
  stable and the row remains the post-completion guard.
- Check-in rows re-run at every gate firing like all executable rows; a Preserve or Regression
  fail seeds the same deduped `validate V<k>` P1 — no special seed class.
- Advisors may **add** Preserve/regression rows; may not delete Proofs to force pass.
- Planning lifts Preserve text into V-row Intention (or cites item id); Phase 1 still enforces
  Preserve at execute time.
- New regression/preserve tests still land **quarantined** until product un-quarantines.

**Example rows (illustrative):**

| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: \<lock under test\> | L3-test | path | `node test/…` exit 0 | pending |
| V2 | Preserve: \<from item Preserve clause\> | suite or prose-sweep | path | cmd / rg | pending |
| V3 | Regression: recorded suite green | suite | — | `\<Test command\>` exit 0 | pending |
| V4 | Scope: no change outside \<boundary\> | prose-sweep or manual | paths | rg or human | pending |
| V5 | dual-home: B ship set matches marketplace M | dual-home | improve-loop package | `node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"` exit 0 | pending |

**Canonical dual-home Proof** (Kind `dual-home` — self-improve / skill campaigns when both
user package **B** and marketplace **M** exist):

```bash
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"
# equivalent freehand:
# diff -rq "$HOME/.claude/skills/improve-loop/scripts" \
#   "$HOME/.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop/scripts"
# success: exit 0, no content/path drift; M must not carry A-style extra references/*
```

Package shapes (H16): **A** = thin SKILL + full `references/`; **B/M** = monolith +
`scripts/` + `tests/` + only `references/goal-objective.template.md`. Never rsync A
`references/` into M.

### PLAN_SPEC_SYNC — live, plan-derived Spec (not static)

**Spec validation is derived, not authored in isolation.** Each non-`n/a` V-row
**Intention** must cite a **plan anchor** (short quote or section+bullet).

| Plan source | Intention prefix | Typical Kind |
|---|---|---|
| Open material **Acceptance** / locks | `Feature:` / `Lock:` | L3-test / suite |
| Open material **Preserve** | `Preserve:` | suite / skill-law / prose-sweep |
| Brief **Constraints** + recorded **Test command** | `Regression:` | suite |
| Brief **Out of scope / waived** + In scope | `Scope:` | prose-sweep / dual-home / manual |
| Brief **Open questions** / item **Unknown** | `Assumption:` | skill-law / L3-test / manual |
| Brief **Success / Done when** (optional/discouraged) | `Done-when:` | skill-law only |

**Forbidden as sole content:** generic rows with no plan anchor (e.g. only “tests pass”,
“code quality good” untied to this campaign’s Test command / Acceptance / Preserve).

**Trigger:** plan content **diverged since last sync marker** (not “this replan edited
something”). Divergence: material Backlog add/rewrite/drop; brief body change; item
complete-delete (Phase 2); header Test command change.

**Excluded from triggers (anti-thrash):** residual-thin add/complete; 3v-seeded
`validate V<k>` / write-section items — **any lifecycle** (add/complete/delete); Deferred
churn without P0/P1 promotion.

**Marker axis = ledger iter N only** (never L1 cycle K):

| Path | Required write |
|---|---|
| Sync | `<!-- spec-sync: iter N -->` in `## Spec validation` |
| Skip | Notes `spec sync n/a: plan unchanged since iter <N>` (**required**) |

Cold-start: first write includes `<!-- spec-sync: iter N -->` (N from allocate_N).

**Phase 3 apply order (after guards):** (1) Campaign brief (2) Backlog (3) Deferred
(4) **Spec validation** — **re-read applied ledger from disk**; never pre-guard candidate.
Then Phase 3v (`phase-3v-validate.md`).

**Update matrix (summary):** new Acceptance → add Feature row pending; Preserve change →
update + pending if text changed; item complete → Feature `n/a: item complete`, keep
Preserve; plan drops claim → row `n/a: plan dropped claim` **and same pass drop open
`validate V<k>`** with Notes `validate V<k> dropped: plan dropped claim`. Stable V-IDs
never renumber. After sync: header `pending` if any executable non-pass; only 3v sets
`pass`. After skip-sync: leave header untouched.

**Anti-patterns:** frozen Spec after replan; stale `pass` after Intention/Proof rewrite;
sync from pre-guard candidate; re-sync on validate-seed alone; silent Spec sync/3v with no
control-channel evidence; dual banner/Validation dialects. Control-channel formats:
`contracts/progress.md` (PLAN_SPEC_STATUS).

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

Live plan holds full clauses. Phase 4 `Next backlog:` may be title-only.
For each still-open **six-clause material** item, commit Notes/body:

`open intent: <short> | Decision: … | Preserve: …`

Next cold-start prefers intent digest + COMPLETED/DISPROVEN over free invention.

## Advisor schema + throttle

Structured **5-block** (native-replanner and advisors) — **do not** add a 6th block:

```text
1. Purpose fit
2. Material recommendations (class + kind + clauses or residual thin)
3. Deferred P2
4. Risks / stop
5. Anti-reseed (COMPLETED/DISPROVEN rejected or none)
```

**PLAN_CRITERIA preflight** (orchestrator) feeds inputs; not part of response schema.

**T2 challenge:** Notes `T2 challenge: native|advisor|skipped — <why>` when Plan tier 2.
Apply work-spec revisions **before** PLAN_SPEC_SYNC.

| Package | Throttle |
|---|---|
| **A** | Continuous driver `throttle.md` (full panel every **3rd** cycle or stall) — cite, do not override here |
| **B** | Residual/T0/T0p/T1: **native-only**. Full panel only T2 / `--plan-deep` / stall / disagreement. No periodic K this arc |

Advisor input soft cap: open Backlog + ## Last cycle + compact COMPLETED/DISPROVEN sets + preflight.

## Product residual + habitat probe outcomes

Before `product residual survey: none` (product/mixed): criteria trail (≤6); sticky P2
reclassify once; if habitat claimed, re-probe and record outcome:

| Outcome | Effect |
|---|---|
| `pass` | Supports residual none |
| `reachable-fail` | R5/R8 seed if prove path; else classify promote/P2/waive |
| `unavailable` | Notes `unverified (habitat unavailable)` + P2/waive — not residual×2 block |
| `manual/out-of-scope` | Unverified pulse; classify only |

Probes never write Status/streak. Soft-warn if habitat claimed and Spec lacks habitat-relevant row.

## Static PLAN_* pin IDs (docs)

`PLAN_TAG` · `PLAN_CLAUSES` · `PLAN_RESIDUAL` · `PLAN_BRIEF` · `PLAN_VALIDATE` ·
`PLAN_SPEC_SYNC` · `PLAN_SPEC_STATUS` · `PLAN_SPEC_SOFT` · `PLAN_APPLY` · `PLAN_CLASSIFY` ·
`PLAN_LEGACY_A` · `PLAN_CRITERIA` · `PLAN_RUNTIME_CONTRACT`

**PLAN_SPEC_SOFT:** when Node is present, prefer `softCheckSpecBundle` /
`softCheckIntentions` / `softCheckProofDiversity` / `softCheckCoverageMix` (row-class
diversity — **not** true anti-mirror; true anti-mirror deferred) /
`softCheckHabitatClaim` (`softCheckHabitatCoverage` alias) / `softCheckAssumptionProof` /
`softCheckSyncStale` from dogfood `scripts/spec-validate.js`. Disposition Notes
`soft: <code> → addressed|waived|unresolved`.
**Never auto-seed backlog; never sole complete gate.**

Hard refusals: no Spec Kit dep; no residual theater; no inventing material for residual×2;
A continuous `[x]` freeze; no hermes SKILL dual-home claim from this contract alone;
no dual peer work-spec tables; no all-V-pass complete.
