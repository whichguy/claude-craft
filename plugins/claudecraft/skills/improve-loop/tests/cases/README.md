# improve-loop illustrative case bank (Tier 1)

Deterministic **ledger → soft-check codes** cases for debugging Spec quality rules.

This is **not** a full `/improve` prompt → thinking → output harness (see planning-suite
`test-prompt-harness` for that shape; improve-loop campaign fixtures do not exist yet).

## What hermetic tests prove (and do not)

| Layer | Proves | Does **not** prove |
|---|---|---|
| This soft case-bank | Soft-check warning codes on written Spec | Campaign planning / Design-time N&S decisions |
| `spec-sync-matrix.test.js` (S2) | PLAN_SPEC_SYNC row-ops goldens | LLM Spec derive quality |
| `complete-gate.js self-test` | R7 residual×2 truth table (pure `evaluateComplete`) | Live orchestrator Status writes / L1 e2e |
| `spec-validate.js self-test` | 3v seed/dedupe (V1 vs V10 colon token), soft≠seed composition, **WP2b soft-check CLI spawn** | Agent Phase 3v apply path |
| `scripts.test.sh` soft-check CLI block | Real `soft-check --plan-file` exit 0 + JSON + **plan byte identity** | Campaign multi-cycle |
| `ledger-status.js` + rest of suite | Parse Status / backlog / cycle / stop counters | PLAN_ORIENT pulse emit in chat |
| Full L3 suite | Scripts, worktree, parity, contracts | Multi-cycle autonomous campaign behavior |

**Soft bank ≠ Spec matrix ≠ campaign-loop eval.** A green suite means L3/contracts hold — not that an agent ran a good `/improve` campaign.

### Behavioral-pin inventory (post planning-doc arc)

| Fable ask | Pin home | Residual |
|---|---|---|
| R7 sole complete | `complete-gate.js` self-test (+ suite invoke) | No Status CLI — pure evaluator only (intentional) |
| 3v seed + V1/V10 dedupe | `spec-validate.js` self-test `seedLinesForFails` | Orchestrator apply still LLM-owned |
| soft≠seed / CLI read-only | self-test WP2b + `scripts.test.sh` CLI block | Done for real CLI spawn |

## What each case shows

| File | Input | Expected output |
|---|---|---|
| `thin-habitat-spec.ledger.md` | Thin packaging Spec + Habitat claimed | Soft-check warning codes |
| `good-t2-spec.ledger.md` | Good T2 Spec with habitat Proof | `ok: true`, no warnings |

## Run

```bash
SKILL="$HOME/.claude/skills/improve-loop"
node "$SKILL/scripts/run-case-bank.js"
# or one case:
node "$SKILL/scripts/spec-validate.js" soft-check \
  --plan-file "$SKILL/tests/cases/thin-habitat-spec.ledger.md"
# status facts (not this bank): node scripts/ledger-status.js --workspace <wt>
```

## Adding a case

1. Add `name.ledger.md` (IMPROVE_LOOP-shaped markdown with headers + Spec table).
2. Add `name.expected.json`: `{ "ok": false, "codes": ["SUITE_ONLY_PROOFS", ...] }`  
   or `{ "ok": true, "codes": [] }`.
3. Re-run `node scripts/run-case-bank.js` (and dual-home copy if shipping).

**Do not** put ledger-status JSON goldens here — soft-check only. Status parse coverage lives in `tests/scripts.test.sh` (and complete-gate self-test for residual×2 inputs).

## Layers

| Layer | Exists? | Captures thinking? |
|---|---|---|
| This bank (soft-check) | yes | no |
| L3 `tests/scripts.test.sh` | yes | no |
| LLM prompt → thinking → text | no for improve-loop | harness exists elsewhere only |
