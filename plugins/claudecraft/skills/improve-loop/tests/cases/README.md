# improve-loop illustrative case bank (Tier 1)

Deterministic **ledger → soft-check codes** cases for debugging Spec quality rules.

This is **not** a full `/improve` prompt → thinking → output harness (see planning-suite
`test-prompt-harness` for that shape; improve-loop campaign fixtures do not exist yet).

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
```

## Adding a case

1. Add `name.ledger.md` (IMPROVE_LOOP-shaped markdown with headers + Spec table).
2. Add `name.expected.json`: `{ "ok": false, "codes": ["SUITE_ONLY_PROOFS", ...] }`  
   or `{ "ok": true, "codes": [] }`.
3. Re-run `node scripts/run-case-bank.js` (and dual-home copy if shipping).

## Layers

| Layer | Exists? | Captures thinking? |
|---|---|---|
| This bank (soft-check) | yes | no |
| L3 `tests/scripts.test.sh` | yes | no |
| LLM prompt → thinking → text | no for improve-loop | harness exists elsewhere only |
