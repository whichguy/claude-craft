# Q6 synthesis-preamble fixture — direct sandbox-provisioner dispatch

This fixture is NOT a plan; it's the exact prompt the orchestrator would
construct for a synthesis-mode dispatch (Sandbox-Ref already supplied). The
intent is to dispatch ONE general-purpose Agent with the preamble + body and
inspect whether the agent correctly skips Steps 1–3.

## How to run

The harness for this fixture is a manual one-shot — invoke directly via the
Agent tool (or hand it to `/test-delivery-agent --fixture <this file>` if you
prefer the printed-transcript path; the result is identical):

```js
Agent({
  subagent_type: "general-purpose",
  description: "Q6 synthesis preamble probe",
  prompt: "<contents of THIS file, with placeholders substituted as below>"
})
```

Placeholders before dispatch:
- `[TARGET_SYSTEM]` → `gas`
- `[SOURCE_REF]` → `AKfycXYZ_production_script`
- `[SANDBOX_NAMING_HINT]` → `sandbox-q6-probe`
- `[REFS_OUT_PATH]` → `/tmp/.sandbox-refs-q6.json`
- `[SANDBOX_REF]` → `AKfycSANDBOX_pre_existing`

## Pass conditions

The agent must:
1. Acknowledge synthesis mode in its first response. ✓ if response opens
   with "synthesis mode" or "skipping Steps 1–3" or equivalent.
2. NOT call any MCP/CLI inventory tool (`command -v clasp`,
   `mcp__mcp-gas-deploy__fork`, etc.) — Step 1 is overridden.
3. NOT run any create/fork/clone primitive against gas.
4. Write a refs JSON at `[REFS_OUT_PATH]` containing
   `sandbox_ref: "AKfycSANDBOX_pre_existing"` (verbatim from the preamble).
5. Emit `STATUS: success` on the final line.

A FAILURE shape (any of):
- Agent inventories tools / runs `command -v clasp` (Step 1 not skipped)
- Agent attempts `mcp__mcp-gas-deploy__fork` or `clasp create` (Step 2/3
  primitive ran despite "OVERRIDES BODY")
- Refs JSON contains the source ref instead of the supplied sandbox ref
  (preamble's sandbox_ref was ignored in favor of body's Source-Ref text)

## Prompt body to dispatch

```
<<<PREAMBLE — copy verbatim from
   plugins/planning-suite/skills/schedule-plan-tasks/references/sandbox-provisioner-synthesis-preamble.md,
   with placeholders substituted as listed above>>>

<<<BODY — copy verbatim from
   plugins/planning-suite/skills/schedule-plan-tasks/references/sandbox-provisioner-prompt.md
   (the verbatim section between the triple-backtick fences), with the same
   placeholders substituted>>>
```

The orchestrator does this concatenation at SKILL.md Phase 0 step 4 path 2
(synthesis). The harness operator does the same here to probe whether the
preamble's "OVERRIDES BODY" framing wins against the body's "discover how to
create or claim a sandbox" framing.
