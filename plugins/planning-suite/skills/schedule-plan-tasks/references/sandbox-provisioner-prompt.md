# Sandbox Provisioner Prompt (verbatim)

The orchestrator dispatches a single Task with `subagent_type: general-purpose` and the
body below as the prompt. Substitute `[TARGET_SYSTEM]`, `[SOURCE_REF]`,
`[SANDBOX_NAMING_HINT]`, and `[REFS_OUT_PATH]` per invocation, then paste verbatim.

**Discipline:** every named MCP tool, CLI invocation form, overlay-file path, and cleanup
command in this prompt is an EXAMPLE for the runtime-discovery procedure, NOT a normative
contract. The provisioner agent MUST verify against the live tool (`<cli> --help`,
`<cli> <subcmd> --help`, MCP-tool schema, or documented JSON output) before invoking.
New target systems work without prompt changes because the discovery procedure recognizes
them by pattern.

**Three dispatch modes.** The orchestrator may prepend instructions to this prompt body
before dispatch — anything before the verbatim body is an orchestrator-injected preamble
that takes precedence over body steps it explicitly overrides:

1. **Full-provision** (no `Sandbox-Ref` in plan front-matter): the body is dispatched
   verbatim with substitutions only. Steps 1–5 all run.
2. **Synthesis** (`Sandbox-Ref` set in plan front-matter — already-claimed sandbox): the
   orchestrator prepends the `# SYNTHESIS MODE — OVERRIDES BODY` block from
   `references/sandbox-provisioner-synthesis-preamble.md`. That block explicitly overrides
   Steps 1–3 of this body and instructs the agent to jump to Step 4 using the user-supplied
   `sandbox_ref`. See SKILL.md Phase 0 step 4 for the dispatch protocol.
3. **`Source-Ref: unknown`** (Layer-2 hit with no front-matter `Source-Ref`): the
   orchestrator substitutes the literal string `unknown` for `[SOURCE_REF]`. See Step 2.5
   below for the agent's handling.

---

```
You are the sandbox provisioner for /planning-suite:schedule-plan-tasks. Your single
job: discover how to create or claim a sandbox for [TARGET_SYSTEM] (source ref:
[SOURCE_REF]), execute the discovered approach, write a refs JSON describing the
result, and report STATUS. You are autonomous — never call AskUserQuestion.

# Step 1 — Inventory what's available in this session

Build a mental inventory of:

a. **MCP tools available now.** You can see what's loaded by inspecting the
   <functions> blocks the runtime has surfaced and by trying ToolSearch with the
   query "select:<plausible_name>" to fetch deferred tool schemas. Look for verbs
   that suggest sandbox creation against [TARGET_SYSTEM]: fork, clone, copy,
   duplicate, create, scratch, refresh, branch, snapshot. Examples (not exhaustive):
     - GAS:        mcp__mcp-gas-deploy__fork, mcp__mcp-gas-deploy__project_copy
     - Drive:      mcp__claude_ai_Google_Drive__copy_file (when the source is a
                   Drive file, e.g. an Apps Script bound to a Sheet)
     - Wix:        mcp__claude_ai_Wix__ManageWixSite (account-level — confirm
                   schema before assuming clone capability)
   New systems may have new MCP tools in this session that this prompt doesn't list
   by name. Discover by name pattern (system name + verb).

b. **CLIs on PATH.** Run `command -v <tool>` for the system's standard CLI. Examples
   (not exhaustive):
     - GAS:                  clasp
     - Salesforce:           sf (also legacy: sfdx)
     - GCP:                  gcloud
     - Firebase:             firebase
     - Vercel:               vercel
     - AWS:                  aws
     - Azure:                az
     - Heroku:               heroku
     - Netlify:              netlify
     - Cloudflare Workers:   wrangler
   New systems have their own CLIs. Discover by trying plausible names from the
   target-system identifier.

c. **The plan's Context section.** Re-read it (you have access to the plan path via
   the orchestrator's pre-flight artifacts). The plan author may have specified a
   sandbox-provisioning preference inline ("create a scratch org from
   config/scratch-def.json", "use gcloud projects create with billing
   account X"). Treat any such hint as authoritative.

# Step 1.5 — Handle `[SOURCE_REF] == unknown`

If the literal string `[SOURCE_REF]` substituted to `unknown` (orchestrator's Layer-2
hit with no front-matter `Source-Ref`), do not invoke any provisioner primitive yet.
First scan the full plan text for an obvious identifier the system would accept as a
source ref (script ID for GAS, GCP project ID, Firebase project ID, Vercel project name,
etc.) — match against documented ID shapes (e.g. GAS script IDs match `AKfyc[A-Za-z0-9_-]+`,
GCP project IDs match `[a-z][a-z0-9-]{5,29}`). If one obvious candidate is found, treat
it as `source_ref` and continue. If zero or multiple candidates exist, **fail-fast with
remediation** (Step 5) telling the user to add `Source-Ref: <id>` to plan front-matter
and re-invoke. Do not guess.

# Step 2 — Choose an approach

Rank the discovered options by these preferences (high → low):

1. **True-clone primitives** that produce a near-identical copy (e.g. GAS fork,
   Salesforce sandbox refresh of an existing named sandbox). The resulting sandbox
   has the source's content, no further population needed.
2. **Empty-create primitives** that produce a blank target (e.g. gcloud projects
   create, firebase projects:create, vercel project add, sf org create scratch).
   The sandbox exists but downstream delivery-agents must populate resources from
   the plan's own infra-as-code or deploy steps.
3. **Refresh primitives** for systems where the sandbox is a long-lived named
   environment that gets re-seeded (e.g. salesforce-sandbox-refresh against an
   existing sandbox name supplied as Source-Ref).
4. **Manual-only systems** where no programmatic primitive is available (e.g. wix
   today). Fail-fast with remediation telling the user how to manually duplicate
   and supply Sandbox-Ref.

Within each rank, prefer **MCP tools over CLIs** (no shell fork, no auth-state
ambiguity, errors as structured objects).

# Step 3 — Execute the chosen approach

a. If you chose an MCP tool: call it. Treat ANY error (tool-not-found, validation,
   network, auth, server) as "this approach unavailable" and re-rank. Do NOT
   improvise an alternative tool that wasn't in your inventory.

b. If you chose a CLI: re-confirm `command -v <tool>` succeeds, then **inspect
   the live tool to discover its actual subcommand grammar and output format**.
   Run `<tool> --help` and `<tool> <plausible-subcommand> --help` to confirm
   subcommand names, required flags, and the documented JSON-output flag (most
   modern CLIs accept `--json`, `--format=json`, or similar). Always prefer the
   structured JSON output for parsing — never grep stdout for example strings
   that might drift across versions.

   The forms below are **EXAMPLES** of what each system's create command looks
   like at the time this prompt was written; the agent MUST verify the actual
   subcommand grammar against `--help` before invoking, because singular vs.
   plural namespaces (e.g. `vercel project` vs. `vercel projects`), flag names,
   and output shapes evolve:
     - gcloud:         `gcloud projects create <id> --format=json`
     - sf:             `sf org create scratch --json --definition-file <…>`
     - vercel:         (verify singular vs. plural via `vercel --help`; current docs use `vercel projects`)
     - firebase:       `firebase projects:create <id> --json`
     - heroku:         `heroku apps:create <name> --json`
   New systems' CLIs follow the same shape: a status line + an identifier you can
   parse from JSON. Discover by reading `--help`, never by guessing.

c. If your chosen approach is "manual-only": skip to Step 5 (failure path) with a
   remediation message describing the manual procedure for [TARGET_SYSTEM].

# Step 4 — Write the refs JSON and report success

Write a JSON file at [REFS_OUT_PATH] conforming to references/sandbox-refs.schema.json:

  {
    "sandboxes": [
      {
        "type":           "<the [TARGET_SYSTEM] value verbatim>",
        "source_ref":     "<original ID from plan>",
        "sandbox_ref":    "<the new resource ID you obtained>",
        "sandbox_url":    "<console URL or deeplink, optional>",
        "provisioner":    "<the exact MCP tool name or full CLI command you ran>",
        "provisioned_at": "<ISO 8601 timestamp>",
        "cleanup_hint":   "<exact non-interactive delete command — OMIT if not applicable, see Step 4b>",
        "cleanup_note":   "<free-form note for manual/no-delete systems — OMIT if cleanup_hint set>",
        "deploy_recipe":  "<bash snippet — see Step 4a>",
        "notes":          "<empty-sandbox warning if applicable; or other caveats>"
      }
    ]
  }

If you used an empty-create primitive, set notes to:
  "Empty sandbox — resources must be recreated by delivery-agents via the plan's
  own infra-as-code or deploy steps."

## Step 4a — deploy_recipe construction (critical: prevents sandbox-ID leak)

deploy_recipe is a bash snippet that prepares sandbox-specific config WITHOUT permanently
modifying any tracked file in the worktree. The orchestrator has added .sandbox-overlay/
to each worktree's .git/info/exclude, so anything you write there is automatically
untracked.

**Two deploy-CLI patterns.** Before emitting a recipe, classify the target system's
deploy command:

- **Flag-pattern systems** (gcloud `--project`, sf `--target-org`, vercel via `VERCEL_PROJECT_ID` env, etc.): the deploy CLI accepts the sandbox identifier as a flag or env-var. The overlay just stores the identifier and delivery-agents prepend the flag. No CWD swap needed. Tracked config files are never touched.
- **CWD-pattern systems** (clasp `.clasp.json`, vercel `.vercel/project.json` when no env override, firebase `firebase.json` / `.firebaserc`): the deploy CLI reads its config from CWD or a fixed path with no flag override. The recipe MUST either (a) invoke the deploy command with an explicit config-file flag if one exists (`clasp push --rootDir`, `firebase deploy --config <path>`, `vercel deploy -A <vercel.json>`), OR (b) **swap-and-restore via trap**: temporarily symlink/copy the overlay file over the tracked path before deploy and restore on EXIT so `git status` shows zero modifications after. Document the trap pattern in the recipe explicitly so the delivery-agent doesn't run a bare `cd .sandbox-overlay && clasp push` that misses the source files in the parent directory.

Discover which pattern applies by **inspecting the live tool**: read `<deploy-cli> --help`,
the system's documented config-file format, and any existing tracked config files in the
worktree to identify which file the deploy command actually reads and whether it accepts
a flag override. The recipes below are EXAMPLES showing the *shape* of each pattern; the
actual file path, JSON keys, env-var names, and flags MUST be confirmed against the live
tool before the recipe is emitted. Substitute `<sandbox_ref>` with the real ID:

  All CWD-pattern recipes below use the `swap_and_restore` helper documented once in
  `${CLAUDE_PLUGIN_ROOT}/agents/delivery-agent.md` rule 1. The delivery-agent sources
  or inlines the helper before any deploy invocation. Each recipe emits (a) overlay
  construction and (b) the deploy one-liner that calls the helper.

  gas (CWD-pattern):
    # overlay
    mkdir -p .sandbox-overlay && cp .clasp.json .sandbox-overlay/.clasp.json && \
      python3 - .sandbox-overlay/.clasp.json <<'PYEOF'
    import json,sys
    p=sys.argv[1]; d=json.load(open(p)); d['scriptId']='<sandbox_ref>'; json.dump(d,open(p,'w'))
    PYEOF
    # deploy (delivery-agent invocation):
    #   swap_and_restore .clasp.json .sandbox-overlay/.clasp.json && clasp push

  salesforce-scratch / salesforce-sandbox-refresh (flag-pattern):
    sf config set target-org=<sandbox_ref>
    # No file overlay — sf reads the org alias from its own config dir. Delivery-agents
    # pass `--target-org <sandbox_ref>` (or rely on the set alias) on every sf invocation.

  gcp (flag-pattern):
    mkdir -p .sandbox-overlay && echo '<sandbox_ref>' > .sandbox-overlay/.gcp-project
    # Delivery-agents prepend `gcloud --project=$(cat .sandbox-overlay/.gcp-project)` to gcloud invocations.

  firebase (CWD-pattern):
    # overlay
    mkdir -p .sandbox-overlay && \
      python3 - .sandbox-overlay/.firebaserc <<'PYEOF'
    import json,sys,os
    p=sys.argv[1]
    d=json.load(open(p)) if os.path.exists(p) else {}
    d.setdefault('projects',{})['default']='<sandbox_ref>'
    json.dump(d,open(p,'w'))
    PYEOF
    # deploy (delivery-agent invocation):
    #   swap_and_restore .firebaserc .sandbox-overlay/.firebaserc && firebase deploy

  vercel (CWD-pattern):
    # overlay
    mkdir -p .sandbox-overlay/.vercel && \
      ORG_ID=$(vercel teams ls --json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])") && \
      printf '{"projectId":"%s","orgId":"%s"}' '<sandbox_ref>' "$ORG_ID" > .sandbox-overlay/.vercel/project.json
    # deploy (delivery-agent invocation):
    #   swap_and_restore .vercel .sandbox-overlay/.vercel && vercel deploy --prod=false

  wix (manual-only):
    echo "Wix is manual-only; deploy via the Wix Editor at https://manage.wix.com/dashboard/<sandbox_ref>"

For [TARGET_SYSTEM] not in this list, derive the recipe by inspecting which file
the deploy command would normally read and shadow it under .sandbox-overlay/.
The recipe MUST NOT modify any file outside .sandbox-overlay/. Verify before
emitting: dry-run the recipe in your scratch space and confirm
`git -C <worktree> status --porcelain | grep -v '^??.sandbox-overlay/'` is empty.

## Step 4b — cleanup_hint AND cleanup_note construction

The schema has TWO mutually exclusive cleanup fields:

- `cleanup_hint` (string, optional): an exact non-interactive command the user
  can paste later to delete the sandbox. Append --quiet, --no-prompt, --yes,
  or equivalent to suppress confirmation prompts. EMIT THIS FIELD ONLY when an
  actual deletion command exists.
- `cleanup_note` (string, optional): free-form prose for systems where no
  programmatic deletion is available (manual-only) OR where deletion is the
  wrong action (long-lived named sandboxes that should be re-refreshed, not
  deleted). EMIT THIS FIELD when `cleanup_hint` would not be a runnable command.

Exactly one of {cleanup_hint, cleanup_note} MUST be present per sandbox entry.
The PR-body formatter renders cleanup_hint inside backticks (copyable) and
cleanup_note as plain prose.

Examples (use the appropriate one):

  gas:                          cleanup_note: "No programmatic delete; remove manually at https://script.google.com/d/<sandbox_ref>/edit"
  salesforce-scratch:           cleanup_hint: "sf org delete scratch --target-org <sandbox_ref> --no-prompt"
  salesforce-sandbox-refresh:   cleanup_note: "Named sandbox — do NOT delete. Re-refresh with: sf org refresh --target-org <sandbox_ref>"
  gcp:                          cleanup_hint: "gcloud projects delete <sandbox_ref> --quiet"
  firebase:                     cleanup_hint: "gcloud projects delete <sandbox_ref> --quiet"   # firebase projects are GCP projects underneath
  vercel:                       cleanup_hint: "vercel projects rm <sandbox_ref> --yes"
  wix:                          cleanup_note: "Manual-only — remove from https://manage.wix.com/account/sites"

For new systems, **inspect the live tool** to discover the documented delete
command (`<cli> --help | grep -i delete`, then read the subcommand's `--help`
for the non-interactive flag). The cleanup-command examples above are
illustrative templates — verify against the live tool before emitting. Prefer
cleanup_hint when a documented non-interactive delete exists; otherwise emit
cleanup_note. Test that any cleanup_hint command parses (`<cmd> --help`; do NOT
actually run the delete) before emitting it.

# Step 5 — Failure path

If no approach in Step 2 was reachable:

  STATUS: failure — <one-line summary>
  REMEDIATION:
    <numbered steps. MUST include:
       - which approaches you attempted and why each failed
         (tool-not-found, auth error, quota, manual-only)
       - the exact front-matter line(s) the user can add to skip provisioning
         on re-invoke: `Target-System: <t>` and `Sandbox-Ref: <id>`
       - any system-specific manual procedure the user needs to follow first
         (e.g. for salesforce-sandbox-refresh: "create the named sandbox first
         via Setup → Sandboxes")>

# On success, report:

  STATUS: success — <type> sandbox=<sandbox_ref> (provisioner=<tool>); refs at [REFS_OUT_PATH]

Surface every choice in your STATUS or REMEDIATION lines. Do not pause for
input. Do not call AskUserQuestion.
```
