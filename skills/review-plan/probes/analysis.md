---
prompt_path: skills/review-plan/SKILL.md
prompt_hash: c9d6f0ec4e50
generated: 2026-03-16
probe_count: 5
---

# Probe Analysis — review-plan Question Quality

## Probe Inventory

| Probe | Target Questions | Deficiency Type | Lines |
|-------|-----------------|-----------------|-------|
| probe-1-unvalidated-constraint | Q-G1 | Rejects simpler alternative (PropertiesService) as fact without benchmarks or evidence; false dichotomy in approach justification | 74 |
| probe-2-phantom-code-references | Q-G11, Q-C38 | Modifies existing sync code using only generic language ("update the handler", "modify the sync engine") without citing file paths, function names, or current behavior; recalls cross-boundary function signature from memory with wrong field positions (0 and 3 instead of 0 and 4) | 71 |
| probe-3-cross-phase-contradiction | Q-G21, Q-G22, Q-G10 | Phase 1 reads symlinks as single source of truth; Phase 3 copies files for portability — contradictory premises. Phase 2 reads `installMode` field from registry JSON that Phase 1 never defines as an output field. Unstated assumption about registry schema shape | 75 |
| probe-4-guidance-implementation-gap | Q-C40, Q-G20 | Design section claims "validates checksums before overwriting" but no implementation step performs checksum validation (only file existence checks). Verification section uses untestable assertions: "verify behavior is correct", "check for regressions" | 71 |
| probe-5-translation-boundary-gap | Q-C37, Q-C39 | Step 5 ("convert analysis results into test assertion data") is the creative load-bearing translation step but gets least specification — no mapping rules, output format, or quality criteria. Field index mapping is wrong: extracts field 3 as `kind` but actual TYPES format has `repo_subdir` at position 3 and `kind` at position 4 | 75 |

## Question Coverage

### Gate 1 (blocking, weight 3)
- **Q-G1** — probe-1: unvalidated constraint presented as fact
- **Q-G11** — probe-2: no demonstrated code reading

### Gate 2 (important, weight 2)
- **Q-G10** — probe-3: unstated schema assumption
- **Q-G20** — probe-4: untestable verification assertions
- **Q-G21** — probe-3: contradictory premises across phases
- **Q-G22** — probe-3: Phase 2 reads field Phase 1 never outputs
- **Q-C37** — probe-5: creative translation step underspecified
- **Q-C38** — probe-2: cross-boundary signature recalled from memory (wrong)
- **Q-C39** — probe-5: field index mismatch against actual TYPES schema
- **Q-C40** — probe-4: design claims checksum validation, no step implements it

## Usage

```bash
/improve-prompt skills/review-plan/SKILL.md skills/review-plan/probes/
```

## Feedback Loop

After running `/improve-prompt`, review its discrimination report:
- If a probe fails to trigger its target question(s) → sharpen the deficiency
- If a probe triggers many non-target questions → reduce incidental issues to isolate target
