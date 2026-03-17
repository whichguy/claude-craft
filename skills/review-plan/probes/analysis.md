---
prompt_path: skills/review-plan/SKILL.md
prompt_hash: c9d6f0ec4e50
generated: 2026-03-16
probe_count: 9
---

# Probe Analysis — review-plan Question Quality

## Probe Inventory

| Probe | Primary Target | Deficiency Type | Discrimination Criterion |
|-------|---------------|-----------------|--------------------------|
| probe-1-unvalidated-constraint | Q-G1 | Unvalidated constraint (PropertiesService rejected without benchmarks) | Q-G1=NEEDS_UPDATE; all other Gate 1 = PASS |
| probe-2-phantom-code-references | Q-G11 | Phantom references (no file paths or function names cited) | Q-G11=NEEDS_UPDATE; Q-C38 no longer present |
| probe-3-cross-phase-contradiction | Q-G21, Q-G22 | Cross-phase contradiction + undefined field | Q-G21=NEEDS_UPDATE, Q-G22=NEEDS_UPDATE; Gate 1 CLEAR |
| probe-4-guidance-implementation-gap | Q-C40 | Design claims checksum validation; no step implements it | Q-C40=NEEDS_UPDATE; Q-G20 no longer present |
| probe-5-translation-boundary-gap | Q-C39 | Wrong field index (kind at 3, should be 4) | Q-C39=NEEDS_UPDATE; Q-C37 no longer present |
| probe-6-cross-boundary-signature | Q-C38 | Cross-boundary signature with wrong parameter positions | Q-C38=NEEDS_UPDATE; all Gate 1 PASS |
| probe-7-untestable-verification | Q-G20 | Verification section has no concrete commands or measurable outputs | Q-G20=NEEDS_UPDATE; Q-C40 not present |
| probe-8-underspecified-translation | Q-C37 | Load-bearing transformation step has no mapping rules or output spec | Q-C37=NEEDS_UPDATE; Q-C39 not present |
| probe-9-g1-pass-calibration | Q-G1 PASS | Approach is well-validated with benchmarks (calibration probe) | Q-G1=PASS; any NEEDS_UPDATE here = over-trigger |

## Question Coverage

### Gate 1 (blocking, weight 3)
- **Q-G1** — probe-1: unvalidated constraint presented as fact
- **Q-G1 PASS** — probe-9: calibration (sound approach with evidence — must NOT flag)
- **Q-G11** — probe-2: no demonstrated code reading

### Gate 2 (important, weight 2)
- **Q-G10** — probe-3: unstated schema assumption
- **Q-G20** — probe-7: untestable verification assertions
- **Q-G21** — probe-3: contradictory premises across phases
- **Q-G22** — probe-3: Phase 2 reads field Phase 1 never outputs
- **Q-C37** — probe-8: creative translation step underspecified
- **Q-C38** — probe-6: cross-boundary signature recalled from memory (wrong)
- **Q-C39** — probe-5: field index mismatch against actual TYPES schema
- **Q-C40** — probe-4: design claims checksum validation, no step implements it

## Usage

```bash
/improve-prompt skills/review-plan/SKILL.md skills/review-plan/probes/
```

## Feedback Loop

A probe **worked** if: (a) its primary target question = NEEDS_UPDATE in the output AND (b) ≤1 non-target Gate 2 question also = NEEDS_UPDATE. A probe **failed** if the target is absent or rated PASS. A probe **is noisy** if 3+ non-target questions fire.

For calibration probe-9: it **worked** if Q-G1=PASS. It **failed** (over-trigger) if Q-G1=NEEDS_UPDATE on a plan that explicitly provides benchmarks and reasoning.
