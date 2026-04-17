---
name: map-model
description: |
  Update claude-craft model-map routing safely — routes, fallback strategies,
  active form-factor profile, and the default launched model. Applies edits
  only after the entire config resolves without cycles.

  AUTOMATICALLY INVOKE when:
  - "map model", "model map", "routing map", "change route"
  - "set fallback", "update fallback", "fallback strategy"
  - "set default model", "default launched model"
  - "force profile", "set form factor profile", "llm_active_profile"
allowed-tools: Read, Bash, Glob
argument-hint: "<natural language request>"
---

# /map-model — Safe model-map editor

Use this skill when the user wants to change model routing behavior.
All edits must go through `tools/model-map-edit.js`, which edits only the user
override file and regenerates the effective merged `model-map.json` after
validating the final graph.

## Step 1 — Find the active model-map

Read, in order:

1. repo defaults: `config/model-map.json`
2. user overrides: `~/.claude/model-map.overrides.json`
3. effective merged config: `~/.claude/model-map.json`

Read the effective config first so you understand the current routes, profiles,
and fallbacks, but write only to the overrides file.

## Step 2 — Build one edit spec

Translate the user request into a single JSON edit spec for
`tools/model-map-edit.js`. Supported keys:

```json
{
  "routes": {
    "logical-label": "another-label-or-model"
  },
  "fallback_strategies": {
    "terminal-model-or-label": {
      "on": {
        "network": ["fallback-a", "fallback-b"]
      }
    }
  },
  "active_profile": "16gb",
  "default_model": "workhorse"
}
```

Rules:

- `routes` may create new logical labels or repoint existing ones.
- `fallback_strategies` should be written as complete strategy objects for the
  keys being updated.
- `active_profile` forces `llm_active_profile`.
- `default_model` rewrites `routes.default`.

Batch related edits into a single spec so validation covers the final combined
state.

## Step 3 — Apply and validate

Run:

```bash
node tools/model-map-edit.js config/model-map.json ~/.claude/model-map.overrides.json ~/.claude/model-map.json '<json-edit-spec>'
```

The tool refuses to write if:

- a route cycle exists
- a fallback chain forms a cycle
- an explicit profile does not exist
- any required profile shape becomes invalid

## Step 4 — Report the result

Summarize:

- which file changed
- which routes/fallbacks/profile/default changed
- whether any new logical labels were created

If validation blocks the edit, explain the cycle or unresolved mapping clearly
and do not hand-edit the file.
- a user preference matches the repo default exactly, in which case it is pruned
  from the override file
