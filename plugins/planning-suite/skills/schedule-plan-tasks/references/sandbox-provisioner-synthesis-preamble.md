# Sandbox Provisioner — Synthesis-Mode Preamble (verbatim)

The orchestrator PREPENDS this block to the substituted body of
`sandbox-provisioner-prompt.md` when dispatching in **synthesis mode**
(`Sandbox-Ref` set in plan front-matter, or Layer-2 family + user-supplied
ref). The block explicitly overrides the body's Steps 1–3 — the body's
"You are the sandbox provisioner. Your single job: discover how to create or
claim a sandbox..." preamble describes the **full-provision** workflow and
DOES NOT apply when this block is prepended.

The orchestrator substitutes `[SANDBOX_REF]`, `[SOURCE_REF]`, and
`[TARGET_SYSTEM]` into the placeholders below before prepending.

```
# SYNTHESIS MODE — OVERRIDES BODY
The prompt body below describes the FULL-PROVISION workflow. For THIS
dispatch, Steps 1–3 are SKIPPED. Treat the body as a reference for the
Step 4 deploy_recipe / cleanup vocabulary only — do NOT inventory tools,
do NOT run any create/fork/clone primitive.

sandbox_ref = [SANDBOX_REF]
source_ref  = [SOURCE_REF]   (use the literal string "user-supplied" if unknown)
target_system = [TARGET_SYSTEM]

Discover the appropriate `deploy_recipe`, `cleanup_hint`/`cleanup_note`, and
`sandbox_url` from the Step 4a/4b examples for [TARGET_SYSTEM] (verifying the
live tool's `--help` as Step 4a/4b require). Then emit the success line and
exit.
```
