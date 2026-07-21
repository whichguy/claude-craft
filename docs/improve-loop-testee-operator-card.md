# improve-loop campaign operator card — **testee** diagnostics

**Status:** Campaign habit (seed Brief paste), **not** improve-loop package law.  
**Do not** auto-load this from `SKILL.md` / `references/` — that would be a de-facto law ship.

**Sources:** Advisors final (Fable + Codex Terra + Grok, 2-pass)  
`~/.grok/skills/advisors/runs/20260721T160929Z-1774/final.md`  
**Fable final plan:** session plan 2026-07-21 — adopt as habit; pin law only after retro proves need.

**Related (different layer):** `plugins/claudecraft/skills/improve-loop/tests/cycle-sim/` is a deterministic **law-sim** for Phase-2 / R9 / complete-gate / stop-decision. It does **not** replace this card or prove real testee quality. See also `tests/scenarios/` for deterministic testee fixtures and `docs/campaigns/SEED_BRIEF.template.md` for paste-ready campaign seeds.

---

## Verification-layer boundary

| Layer | Path | Proves | Does not prove |
|---|---|---|---|
| soft case-bank | `plugins/claudecraft/skills/improve-loop/tests/cases` | Spec soft-check codes | Campaigns |
| cycle-sim | `plugins/claudecraft/skills/improve-loop/tests/cycle-sim` | Phase-2/R9/complete/stop pure law | Real testee suites / LLM |
| scenarios | `plugins/claudecraft/skills/improve-loop/tests/scenarios` | Testee red→green + residual sequencing + oracle | A substitute for product campaigns |
| this card | `docs/improve-loop-testee-operator-card.md` | Campaign habit | Package law |

Scenario `--smoke-all` checks fixture seed and golden suites; its scripted runner
uses known deterministic fixture changes. Neither hermetically tests an LLM
multi-cycle improve campaign. This card is the operational standard for evaluating
an actual testee campaign.

---

## One-line model

On a real campaign, the test phase is **compare-and-classify on the testee**, not a green/red exit-code gate.

```text
execute on testee
  → authoritative suite + acceptance probe + light preservation probe
  → min diagnostic (+ escalate on smell; do not overwrite suite status with retries)
  → CLASS: OK | INTENDED_MISS | UNINTENDED | TEST_GAP | PRODUCT_CHOICE | FLAKY | BLOCKED
  → durable carriers: cycle artifact + commit body + open backlog (if material)
  → Phase 3: material CLASS → testee P0/P1 or explicit waive/blocked
  → residual / honest-empty FORBIDDEN over unconsumed material CLASS
  → next cycle re-verifies the original surprise on the testee
```

---

## Paste into seed Brief (per material item)

```markdown
Expected effects
- Must now pass: …
- Must stay true: …
- Must not change: …
- Evidence commands: …
```

| Manifest result | Default CLASS |
|-----------------|---------------|
| Must now pass → fail | INTENDED_MISS |
| Must stay true → fail | UNINTENDED |
| Must not change → unverified | partial (unless waive unobservable) |
| Ad-hoc probe finds unmanifested gap | TEST_GAP + extend manifest |

**Hard:** material item with **zero** INTENDED / acceptance lines cannot reach Outcome `confirmed` (cap at `partial`).

---

## Minimum diagnostic bundle (every cycle)

| Capture | Content |
|---------|---------|
| Suite record | exact cmd, cwd, rev, exit, duration, pass/fail/skip counts |
| RUN_IDENTITY | cmd + test-config + lockfile/rev + shard/platform/seed — incomparable configs must not claim mechanical NEW_FAIL |
| Fail list | named failures (or first ~50 + total) |
| SUITE_DELTA | NEW / FIXED / STILL vs **prior cycle**; also vs **campaign-seed baseline** — STILL not in seed must keep originating cycle + open item or waive |
| Blast radius | per NEW_FAIL: `plausibly-related \| apparently-unrelated \| unknown` |
| Acceptance probe | exact cmd + pass\|fail\|not-run — **not** suite-inferred |
| Preservation probe | one proportional blast-radius check + pass\|fail\|waived-unobservable |
| INTENDED | 3–8 lines: met \| miss \| untested |
| Thesis | re-verified \| assumed-green \| false \| not-checked |
| ERROR_SIG | stable id + first error line |
| CAUSALITY | this-cycle \| pre-existing \| unknown (unknown ⇒ treat as this-cycle) |
| trace= | **retained** cycle artifact (not a temp that dies before replan) |
| Skip/xfail + selection | new skips; discovery/count drift → TEST_SELECTION_DRIFT |
| Lint/type | pass/fail + new-warning count if present |
| Dirty tree | unexpected dirty/generated paths → UNINTENDED candidate |

**Escalation (smell only):** re-run new fails **separately** (never replace authoritative FAIL); optional parent/stash; focused module command. **No rerun-until-green laundering.**

---

## Classification → action on the **testee**

| Class | Detection | Outcome | Default on testee |
|-------|-----------|---------|-------------------|
| Intended landed | Suite/lint **PASS**; acceptance PASS; preservation PASS or waived; INTENDED all met; thesis re-verified; no unallowed NEW_FAIL | `confirmed` | Check off item if code landed |
| Intended miss — finish | Green/no-worse suite but acceptance/INTENDED miss; approach still plausible | `partial` | Finish behavior P0/P1 + usually test-debt |
| Intended miss — approach dead | Same + variants cannot land claim | `disproven` | New replace-approach P0/P1 |
| Unintended | NEW_FAIL / must-stay-green fail / contract-perf / dirty tree | `partial` + residual | **P0** contract/out-of-scope unexplained; **P1** in-scope regression |
| Testee gap | Probe fails; suite green | `partial` + residual | Test debt **P0** if safety/contract-critical else **P1**; seed fix + coverage if defect |
| Product choice | No contract broken; semantics fork | `partial` | P1 `[product-choice]` with alternatives |
| Flaky candidate | Fail then pass under recorded re-run | blocks confirm until triaged | Re-fail once = **real**; never dispose as flaky |
| Blocked env | Infra or same fail on parent/stashed diff | `blocked` | Unblock env; unclear causality → residual-thin discovery P1 |

**Hard defaults**

- Apparently-unrelated NEW_FAIL is **non-weak** until affirmative `classify: waive`.
- Red baseline may **explain** STILL fails; it never upgrades this cycle to `confirmed`.
- Unverified “must stay true / must not change” ⇒ `partial` unless waived unobservable.

---

## Greppable Notes (Last cycle handoff)

```
SUITE: cmd=… exit=… pass=… fail=… skip=… dur=…
RUN_IDENTITY: …
BASELINE: comparable=yes|no; ref=campaign-seed|prior-cycle|<rev>
SUITE_DELTA: NEW=[…] FIXED=[…] STILL=[…]
INTENDED: [check=met|miss|untested; …]
acceptance: pass|fail|not-run|<probe>
preserve: pass|fail|waived-unobservable|<probe>
CLASS: OK|INTENDED_MISS|UNINTENDED|TEST_GAP|PRODUCT_CHOICE|FLAKY|BLOCKED
ERROR_SIG: <id>
CAUSALITY: this-cycle|pre-existing|unknown
THESIS: re-verified|assumed-green|false|not-checked
trace=<retained-path>
replan-seed: …
RESIDUAL_HINT: …
```

Surprise lines: `UNINTENDED:`, `FALSE_GREEN:`, `TEST_GAP:`, `classify: waive <sig> — <why>`.

### Durable carriers (when CLASS is material)

Last cycle is **replaced** each cycle — do not rely on it alone:

1. Retained cycle artifact (`trace=`)
2. Iteration **commit body** with CLASS / ERROR_SIG / SUITE_DELTA NEW / replan-seed  
   *(before commit: grep body for ERROR_SIG/CLASS if CLASS ≠ OK)*
3. Open **testee** backlog item Evidence repeating ERROR_SIG or TEST_GAP id

---

## Residual / honest-empty hard stop (habit)

If prior Notes **or commit body** still has unconsumed  
`CLASS ∈ {INTENDED_MISS, UNINTENDED, TEST_GAP}`  
or unconsumed `UNINTENDED:` / `FALSE_GREEN:` / `TEST_GAP:` lines:

- residual is **not** empty  
- **honest-empty / residual×2 attestation is forbidden**

until each line has (a) open testee P0/P1 Evidence ref, (b) `classify: waive`, or (c) `blocked: env` with owner/cmd.

---

## Backlog shapes (testee)

**Regression/defect** — Evidence: SIG + SUITE_DELTA; Acceptance: named test PASS + original INTENDED still met.

**Test debt** — Acceptance **mandatory**:

1. New test fails on pre-fix commit (or known-bad fixture) under a single named command  
2. Same test passes on fixed tip  
3. Command recorded on the item  

**Replace-approach** — after `disproven`; new Expected effects.  
**Residual-thin discovery** — time-boxed to seed defect/debt/waive/blocked (not eternal investigate).  
**Product-choice** — alternatives listed; not silent waive.

---

## Anti-patterns

Green-suite-as-done; full-suite-only (no acceptance/preservation); CHANGED_PATHS tunnel vision; skip/selection-to-green; severity laundering to P2; Notes-only / Last-cycle-only learning; temp-only traces; flake disposal; baseline-free “known failure”; STILL-as-known without seed membership; env/product conflation; rerun-until-green overwriting authoritative FAIL.

---

## After 1–2 campaigns (retro)

1. Was honest-empty ever attested over an unconsumed surprise?  
2. Did the card cause authoring thrash (>1 extra revision round per item)?  
3. Did diagnostics change any replan decision?

Only if (1) fails repeatedly: consider **one** minimal law pin making the honest-empty hard stop explicit — S2-style first. Everything else stays habit.

---

## Explicit non-goals

- Redesigning improve-loop package law as the first step  
- Treating cycle-sim green as “testee quality solved”  
- Shipping Spec Kit / G5 acceptance guidance without a separate authorized empirical gate  
