# Campaign seed Brief template (improve-loop)

Copy to `docs/campaigns/<date>-<slug>/SEED_BRIEF.md` (or paste into `IMPROVE_LOOP.md` Brief).  
**Operator card (required habit, not law):** [`docs/improve-loop-testee-operator-card.md`](../improve-loop-testee-operator-card.md)

| Field | Value |
|-------|--------|
| Repo (testee) | |
| Slug | |
| Mode | continuous \| once |
| Until | default: no material P0/P1 for 2 consecutive cycles (green tests) |
| Max cycles | 8 (default) |
| Test command | |
| Seed mode | defect \| product \| mixed |

## Goal

(1–3 sentences — operator intent for the **testee**.)

## Scope

**In:**  
**Out:**

## Operator card (every cycle)

Full rules: `docs/improve-loop-testee-operator-card.md`

1. Material items carry **Expected effects** + acceptance + preservation probes.  
2. Min diagnostic every cycle (`SUITE_DELTA`, `CLASS`, `ERROR_SIG`, `trace=`, …).  
3. Material CLASS → open **testee** P0/P1 or explicit waive before honest-empty.  
4. Durable carriers: artifact + commit body + backlog (Last cycle is not the archive).

## Material items

### P0/P1: \<title\>

```markdown
Expected effects
- Must now pass: …
- Must stay true: …
- Must not change: …
- Evidence commands: …
```

- Acceptance probe: `…`  
- Preservation probe: `…`  
- Done when: …

## Deferred (P2 only if weak)

- [ ] P2: … — weak:\<enum\> — …

## Passive S3 notes (optional)

If placeholder/unverifiable Acceptance still causes cost **despite** the card, note campaign id + excerpt for a future empirical gate — do not open S3 machinery unless authorized.
