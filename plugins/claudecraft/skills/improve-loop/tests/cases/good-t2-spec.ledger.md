# Improve Loop: good T2 habitat Spec (illustrative Fixture B)

**Test command:** `make test-fast`
**Started:** 2026-07-19          **Status:** active
**Iteration counter:** 0
**Seed mode:** mixed
**Product residual survey:** pending
**Plan tier:** 2
**Spec validation:** pending
**Habitat claimed:** yes
**Habitat probe:** docker ps --format '{{.Names}}'
**Habitat probe result:** ok
**Habitat probe evidence:** hermes Up
**Operator done-when:** skill readable + discoverable in container
**Install mechanism:** symlink

## Campaign brief
- **Target:** backchain skill hermes docker (illustrative good Spec)
- **Plan tier:** 2

## Spec validation
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: dual install | L3-test | install.sh | bash test/install-targets.test.sh | pending |
| V2 | Preserve: Claude install | suite | install.sh | bash test/install-targets.test.sh | pending |
| V3 | Regression: host suite | suite | — | make test-fast | pending |
| V4 | Feature: container readable | habitat | SKILL.md | docker exec hermes test -e /opt/data/skills/software-development/backchain/SKILL.md | pending |
| V5 | Scope: skill-only package | prose-sweep | SKILL.md | rg -n 'skill package' SKILL.md | pending |

## Backlog
- [ ] P1: [implementation] dual install + habitat proof

## Deferred (P2)

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)
- consecutive-non-material-cycles: 0

## Next
- **Action:** execute
- **Item:** dual install + habitat proof
- **Why:** illustrative good Spec

## Last cycle
**(none — cold-start illustrative)**
