---
prompt_path: skills/review-plan/SKILL.md
prompt_hash: c9d6f0ec4e50
generated: 2026-03-16
probe_count: 16
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
| probe-10-rename-refactor-calibration | BREADTH/PASS | Real-world Rails rename refactor: 11 phases, explicit file lists, concrete verification — should produce SOLID/READY with few Gate 2 findings | Gate 1 CLEAR; breadth test for late advisory questions |
| probe-11-api-surface-reduction | Q-G11, Q-C40 | Real Go library: `sed -i` batch rename with no pre-check of function count, no caller analysis, "major breaking change" claim with no migration path | Q-G11=NEEDS_UPDATE (asserted 302 functions without reading codebase); Q-C40=NEEDS_UPDATE (breaking change claim vs no migration path) |
| probe-12-go-rewrite-vague-verification | Q-G20, Q-G11 | Real Python→Go migration: Phase 3 testing = vague checklist ("end-to-end tests with real API"), Phase 4 "security audit" with no tools or criteria; `go mod init github.com/yourusername/` never resolves actual repo name | Q-G20=NEEDS_UPDATE (Phase 3/4 verification untestable); Q-G11=NEEDS_UPDATE (placeholder username in init command) |
| probe-13-gas-onthinking-fix | PASS (GAS) | Real GAS plan: fix `onThinking` callback silently dropped in ClaudeConversation.gs — before/after code, explicit line refs, exec verification, branch/deploy section. IS_GAS calibration. | Gate 1 CLEAR; IS_GAS=true; SOLID/READY expected |
| probe-14-gas-driveapp-resilience | PASS (GAS) | Real GAS plan: DriveApp + SpreadsheetApp null-guard fixes across DynamicToolLoader (remote) + SheetsKnowledgeProvider.gs (local). Explicit `mcp__gas__cat` read step, exec verification, branch/rollback. IS_GAS calibration. | Gate 1 CLEAR; IS_GAS=true; multi-file breadth test |
| probe-15-gas-gmail-quality-fixes | PASS (GAS) | Real GAS Gmail add-on quality review: 5 fixes (try-catch, security injection, PROCESSING label, escapeHtml, cache). GmailApp + CardService + CacheService patterns. Multi-fix with test suite verification. | Gate 1 CLEAR; IS_GAS=true; broad advisory coverage |
| probe-16-gas-chatservice-wrapper | Q-G21 (GAS) | Real GAS plan: add `_main` wrapper to ChatService.gs. Pre-Step 2 says "grep for `thinkingQueue\|_knowledgeProvider`" — Step 1 audit note then says that scope IS INSUFFICIENT. Contradictory instructions within same plan. | Q-G21=NEEDS_UPDATE (internal contradiction: narrow grep prescribed then immediately contradicted); IS_GAS=true |

## Question Coverage

### Gate 1 (blocking, weight 3)
- **Q-G1** — probe-1: unvalidated constraint presented as fact
- **Q-G1 PASS** — probe-9: calibration (sound approach with evidence — must NOT flag)
- **Q-G11** — probe-2: no demonstrated code reading

### GAS real-world plans (from ~/.claude/plans/)
- **PASS** — probe-13: ClaudeConversation.gs onThinking fix — professional, exec-verified
- **PASS** — probe-14: DriveApp/SpreadsheetApp resilience — multi-file, explicit read steps
- **PASS** — probe-15: Gmail add-on quality fixes — GmailApp+CardService, test suite
- **Q-G21** — probe-16: ChatService _main wrapper — Pre-Step 2 vs Step 1 audit note contradict each other

### Real-world (calibration + breadth)
- **BREADTH** — probe-10: professional Rails rename, should score SOLID/READY (tests late-advisory coverage)
- **Q-G11+Q-C40** — probe-11: Go library with batch `sed` renames, no pre-checks, no migration path
- **Q-G20+Q-G11** — probe-12: Go rewrite checklist plan with untestable Phase 3/4 verification

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
