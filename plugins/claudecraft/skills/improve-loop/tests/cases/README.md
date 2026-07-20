# improve-loop illustrative case bank (Tier 1)

Deterministic **ledger → soft-check codes** cases for debugging Spec quality rules.

This is **not** a full `/improve` prompt → thinking → output harness (see planning-suite
`test-prompt-harness` for that shape; improve-loop campaign fixtures do not exist yet).

## What hermetic tests prove (and do not)

| Layer | Proves | Does **not** prove |
|---|---|---|
| This soft case-bank | Soft-check warning codes on written Spec | Campaign planning / Design-time N&S decisions |
| `spec-sync-matrix.test.js` (S2) | PLAN_SPEC_SYNC row-ops goldens | LLM Spec derive quality |
| `complete-gate.js self-test` | R7 residual×2 truth table | Live orchestrator Status writes |
| `ledger-status.js` + `scripts.test.sh` | Parse Status / backlog / cycle / stop counters | PLAN_ORIENT pulse emit in chat |
| Full L3 suite (~320 asserts) | Scripts, worktree, parity, contracts | Multi-cycle autonomous campaign behavior |

**Soft bank ≠ Spec matrix ≠ campaign-loop eval.** A green suite means L3/contracts hold — not that an agent ran a good `/improve` campaign.

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
