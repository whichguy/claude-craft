# Dual-home package map (Law / Live / Publish)

Short operator checklist. Normative law lives in phase/contract files; this page is
**hygiene only** (H15–H18).

**Legacy letters:** Law=A · Live=B · Publish=M. Prefer purpose names in conversation.

## Product model (decision — 2026-07-21)

**One product, campaign-default.** The shipped skill is the **Live monolith** (autonomous
multi-cycle L1 by default, script-backed). **Law** is the corpus only — edited in-repo,
never shipped as a second skill under `skills/`. Host **goal** is optional observability;
continuous driver law lives on Live L1 (sibling `improve` skill is a thin invoke alias, not
a second complete driver). This **satisfies** H16 (Live/Publish = ship set; Law = text only).

## Shapes

| Home | Purpose name | Path (typical) | Shape |
|---|---|---|---|
| **A** | **Law** | `plugins/claudecraft/law/improve-loop/` | `operator-card.md` + phases/contracts — **not** under `skills/` |
| **B** | **Live** | `~/.claude/skills/improve-loop` (often symlink → gba) | Monolith `SKILL.md` + `scripts/` + `tests/` + goal template only |
| **M** | **Publish-src** | `src/claude-craft/.../skills/improve-loop/` | Same ship set as Live — **only product commit home** |
| — | **Publish-checkout** | `~/.claude/plugins/marketplaces/.../skills/improve-loop/` | Marketplace clone — refresh only, do not WIP-commit product here |
| — | **Plugin-cache** | `~/.claude/plugins/cache/.../claudecraft/<ver>/skills/improve-loop/` | Namespaced `claudecraft:improve-loop` install |

**Law carries text only; scripts live on Live and mirror to Publish.** `package-parity.js`
compares **B↔M only** / Live↔Publish ship sets (never Law; never claims Law/script sync) — WP0.

**Never** `cp -R` Law into Live or Publish skill dirs. Publish must not grow Law-style
phase/contract trees under the skill dir (`package-parity` `extraReferencesErrors`).

**R7 pin layer (WP1 honesty):** Status complete is orchestrator-law into `IMPROVE_LOOP.md`,
not a Status CLI. Pure evaluator: Live `scripts/complete-gate.js` (truth table + residual×2).

**Stop-decision:** canonical implementation is `skills/improve-loop/scripts/improve-stop-decision.js`.
`plugins/claudecraft/tools/improve-stop-decision.js` is an executable shim that re-exports it
(for law paths and mocha CLI tests).

## When you change law text

1. Edit Law under `plugins/claudecraft/law/improve-loop/**` (and `operator-card.md` if needed).  
2. Mirror the same law into Live monolith sections (surgical).  
3. Verify Law: structure / law-parity tests under `test/plugins/claudecraft/`.  
4. Verify Live: `node scripts/contract-check.js --skill-dir "$LIVE"` + `bash tests/scripts.test.sh`.  
5. Copy Live ship set → Publish-src (SKILL + scripts + tests + goal template only).  
6. `node scripts/package-parity.js --skill-dir "$LIVE" --peer "$PUB_SRC"` (exit 0; never self-peer).  
7. Pathspec commit each home separately — never `git add -A`.  
8. Bump **both** `plugins/claudecraft/.claude-plugin/plugin.json` and marketplace entry versions
   when the ship set or law product surface changes; then `claude plugin update claudecraft@claude-craft`.

## When you change scripts / tests

1. Implement + test on **Live** first.  
2. Green: `bash tests/scripts.test.sh`.  
3. Copy changed files to **Publish-src**.  
4. Parity green with explicit `--peer`; Publish suite green.  
5. Pathspec commit Publish-src scripts/tests (and SKILL if touched).  
6. Version bump both surfaces when product behavior changes.

## Atomic ship (H15)

For any new behavior: **SKILL (or Law) + implementing script + suite asserts** land together
on that home. Landing docs/tests that call a missing script is a P0 miss (H18).

## dual-home Spec Proof

```bash
# (a) Live ↔ Publish-src  (always name both paths)
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$LIVE" --peer "$PUB_SRC"

# (b) Publish-src ↔ Publish-checkout (after marketplace pull)
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$PUB_SRC" --peer "$PUB_REF"

# (c) Publish-src ↔ Plugin-cache installPath
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$PUB_SRC" --peer "$CACHE"

# Self-peer must FAIL (do not treat this as green):
# node package-parity.js --skill-dir "$X" --peer "$X"  → reason peer_is_self
```

See `contracts/planning.md` Kind `dual-home` example row.

## CI / fail-closed

Local hooks are convenience only. **Required** shipping gate is repo CI: shell suite,
`npm run test:improve-loop`, hermetic contract-check on Publish-src, package-parity self-test,
and claudecraft plugin/marketplace version equality.
