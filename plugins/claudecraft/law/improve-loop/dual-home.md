# Dual-home package map (A / B / M)

Short operator checklist. Normative law lives in phase/contract files; this page is
**hygiene only** (H15–H18).

## Product model (decision — 2026-07-21)

**One product, campaign-default.** The shipped skill is the **B monolith** (autonomous multi-cycle
L1 by default, script-backed). Home **A** is the **law corpus only** — edited in-repo, never
shipped as a second skill under `skills/`. Host **goal** is optional observability; continuous
driver law lives on B L1 (sibling `improve` skill is a thin invoke alias, not a second complete
driver). This **satisfies** H16 (B/M = ship set; A = law text only).

## Shapes

| Home | Path (typical) | Shape |
|---|---|---|
| **A** | `plugins/claudecraft/law/improve-loop/` (in-repo) | `operator-card.md` + full law tree (phases, contracts, ledger-schema) — **not** under `skills/` |
| **B** | `~/.claude/skills/improve-loop` | Monolith `SKILL.md` + `scripts/` + `tests/` + **only** `references/goal-objective.template.md` |
| **M** | marketplace peer of B (git clone of origin ship set) | Same ship set as **B** |

**A carries law text only; scripts live in B and mirror to M.** `package-parity.js` compares
**B↔M only** (never A; never claims A/script sync) — WP0.

**Never** `cp -R` A law into B or M. M must not grow A-style phase/contract trees under the
skill dir (`package-parity` `extraReferencesErrors`).

**R7 pin layer (WP1 honesty):** Status complete is orchestrator-law into `IMPROVE_LOOP.md`,
not a Status CLI. Pure evaluator: B `scripts/complete-gate.js` (truth table + residual×2).

## When you change law text

1. Edit A under `plugins/claudecraft/law/improve-loop/**` (and `operator-card.md` if needed).  
2. Mirror the same law into B monolith sections (surgical).  
3. Verify A: structure / law-parity tests under `test/plugins/claudecraft/`.  
4. Verify B: `node scripts/contract-check.js` + `bash tests/scripts.test.sh`.  
5. Copy B ship set → M (SKILL + scripts + tests + goal template only).  
6. `node scripts/package-parity.js --skill-dir "$B"` (exit 0).  
7. Pathspec commit each home separately — never `git add -A`.

## When you change scripts / tests

1. Implement + test on **B** first.  
2. Green: `bash tests/scripts.test.sh`.  
3. Copy changed files to **M**.  
4. Parity green; M suite green.  
5. Pathspec commit M scripts/tests (and SKILL if touched).

## Atomic ship (H15)

For any new behavior: **SKILL (or A law) + implementing script + suite asserts** land together
on that home. Landing docs/tests that call a missing script is a P0 miss (H18).

## dual-home Spec Proof

```bash
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"
```

See `contracts/planning.md` Kind `dual-home` example row.
