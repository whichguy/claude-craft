# Dual-home package map (A / B / M)

Short operator checklist. Normative law lives in phase/contract files; this page is
**hygiene only** (H15–H18).

## Shapes

| Home | Path (typical) | Shape |
|---|---|---|
| **A** | `~/src/claude-craft/plugins/claudecraft/skills/improve-loop` | Thin `SKILL.md` + full `references/` |
| **B** | `~/.claude/skills/improve-loop` | Monolith `SKILL.md` + `scripts/` + `tests/` + **only** `references/goal-objective.template.md` |
| **M** | `~/.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop` | Same ship set as **B** (dogfood / marketplace) |

**A carries references law only; scripts live in B and mirror to M.** `package-parity.js`
compares **B↔M only** (never A; never claims A/script sync) — WP0.

**Never** `cp -R` A `references/` into B or M. M must not grow A-style phase/contract trees.

**R7 pin layer (WP1 honesty):** Status complete is orchestrator-law into `IMPROVE_LOOP.md`,
not a Status CLI. Pure evaluator: B `scripts/complete-gate.js` (truth table + residual×2).

## When you change law text

1. Edit A `references/**` (and thin A `SKILL.md` if the operator card needs a pointer).  
2. Mirror the same law into B monolith sections (surgical).  
3. Verify A: structure test / `node test/plugins/claudecraft/improve-skill-structure.test.js`.  
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

For any new behavior: **SKILL (or A refs) + implementing script + suite asserts** land together
on that home. Landing docs/tests that call a missing script is a P0 miss (H18).

## dual-home Spec Proof

```bash
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"
```

See `contracts/planning.md` Kind `dual-home` example row.
