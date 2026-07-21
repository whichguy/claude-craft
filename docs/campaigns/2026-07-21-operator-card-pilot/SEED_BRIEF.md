# Campaign seed Brief — operator-card pilot

**Repo (testee):** claude-craft  
**Slug:** operator-card-pilot-d2d268  
**Mode:** continuous (max 4 cycles)  
**Until:** no material P0/P1 for 2 consecutive cycles (green tests)  
**Test command:**  
`node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/run.js --skip-self-test && node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/phase2-counters.js self-test`  
**Seed mode:** product  
**Operator card (habit):** `docs/improve-loop-testee-operator-card.md` — paste rules apply every cycle.

## Goal

Pilot the **testee diagnostic operator card** on a real campaign: land discoverability packaging so operators find the card + cycle-sim boundary, exercise Expected effects + CLASS Notes + durable carriers, then residual×2 with honest-empty (not suite-green alone).

## Scope

**In:**
- Cross-links between cycle-sim README, cases README, and operator card
- Lightweight campaign seed template under `docs/campaigns/`
- Residual survey of packaging gaps from R9 / cycle-sim ship

**Out:**
- improve-loop law edits (planning.md / SKILL.md)
- Expanding cycle-sim into LLM/testee suite runner
- Spec Kit / G5 ship

## Operator card (required every cycle)

See full card: `docs/improve-loop-testee-operator-card.md`

Minimum:
1. Every material item has **Expected effects** + acceptance + preservation probes.
2. Every cycle writes greppable `SUITE_DELTA` / `CLASS` / `ERROR_SIG` / `trace=` / `replan-seed`.
3. Material CLASS → open testee P0/P1 or waive before honest-empty.
4. Durable: artifact + commit body + backlog (Last cycle is not the archive).

## Material seed items

### P1: Cross-link cycle-sim ↔ operator card
Expected effects:
- Must now pass: cycle-sim suite (15/15) + phase2 self-test
- Must stay true: no law text under `law/` or `SKILL.md` changed
- Must not change: complete-gate / stop-decision semantics
- Evidence: suite command above; `git diff --stat` shows only docs/tests README links

Acceptance probe: `rg -n "improve-loop-testee-operator-card" plugins/claudecraft/skills/improve-loop/tests/cycle-sim/README.md`  
Preservation probe: `node …/cycle-sim/run.js --skip-self-test` → PASS 15/15

### P1: Campaign seed template for future testee pilots
Expected effects:
- Must now pass: template file exists and references operator card path
- Must stay true: cycle-sim hermetic (no network)
- Must not change: package-parity required skill scripts list (no new scripts/ files)

Acceptance: file `docs/campaigns/SEED_BRIEF.template.md` present with Expected effects section  
Preservation: cycle-sim still 15/15
