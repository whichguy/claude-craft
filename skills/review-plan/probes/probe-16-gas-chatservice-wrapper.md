# Plan: Fix ChatService Missing CommonJS Wrapper + SystemPrompt Typo

## Context

Quality review of the loadNow audit surfaced two pre-existing structural issues:

1. **`chat-core/ChatService.gs`** has no `_main` wrapper and no `__defineModule__` call. Its 881 lines run at the top level of GAS's global scope, polluting global state (`thinkingQueue`, `_knowledgeProvider`, etc.) and making the file un-registerable via `require()` in the standard CommonJS sense.

2. **`sheets-chat/SystemPrompt.gs`** carries a typo `"systematicallyatically"` at line 930 — the previous review-fix session only patched `chat-core/SystemPrompt.gs`. This file is active: used by `ABTestHarness.gs` and test helpers.

## Files to Modify

| File | Change |
|------|--------|
| `chat-core/ChatService.gs` | Add `_main` wrapper + `__defineModule__(_main)` |
| `sheets-chat/SystemPrompt.gs` | Fix typo at line 930: `systematicallyatically` → `systematically` |

## Critical Context Files (read-only)

- `sheets-chat/UISupport.gs` — `require('chat-core/ChatService')` inside its `_main`; calls `setKnowledgeProvider`, `setToolRegistry`, `setInlineTools` on result
- `chat-core/ClaudeConversation.gs` — `require('chat-core/ChatService')` inside its `_main`; calls `getApiKey()`
- `sheets-chat/ABTestHarness.gs` — `require('sheets-chat/SystemPrompt')` (active consumer)

## Implementation Steps

### Step 0: Feature branch
```bash
git checkout -b fix/chatservice-module-wrapper
```

### Pre-Step 1: Verify current file state
Use `mcp__gas__cat` with `remoteOnly: true` on `chat-core/ChatService` to confirm no `_main` wrapper exists on the remote (top-level code starts after JSDoc). Use `mcp__gas__cat` with `remoteOnly: true` on `sheets-chat/SystemPrompt` around line 930 to confirm the typo `systematicallyatically` is present on the remote before editing. Specifically confirm: (a) the top anchor text `// Import ConfigManager from gas-properties module` appears immediately after the JSDoc block, (b) the exports block closes with `setInlineTools` followed by `};` as the final entry — these are the exact edit anchors used in Step 1 and must match verbatim.
### Pre-Step 2: Audit bare global consumers
Before wrapping ChatService, scan for any code outside `chat-core/ChatService.gs` that directly accesses the globals that currently live at ChatService's top level (`thinkingQueue`, `_knowledgeProvider`, etc.) rather than via `require()` result. A local grep is sufficient:```bash
grep -r "thinkingQueue\|_knowledgeProvider" src/
```
If any callers reference these as bare globals (not via a `require('chat-core/ChatService')` return value), note them — they will silently receive `undefined` after wrapping and will also require updates. Document findings before proceeding.
**Decision gate:** If bare global callers are found, stop and add a Phase 2 to update those callers before pushing the ChatService wrapper. Do not proceed with Step 1 until callers are accounted for. If no bare global callers are found, proceed to Step 1.
> These two changes are treated as a single atomic unit: the typo fix is a one-line change with no behavioral risk, so a combined commit is proportionate. Both are verified together in Step 4.>
> **Parallel execution:** Steps 1 and 2 are independent — run them as parallel Tasks in a SINGLE message.
### Step 1: Wrap `chat-core/ChatService.gs` in `_main`

The file currently has top-level code (lines 1–881). Add the standard wrapper:

**Edit top** — insert wrapper opening after the JSDoc block (before `// Import ConfigManager`):
```
old: // Import ConfigManager from gas-properties module\nconst ConfigManager = require('gas-properties/ConfigManager');
new:
function _main(
  module = globalThis.__getCurrentModule(),
  exports = module.exports,
  log = globalThis.__getModuleLogFunction?.(module) || (() => {})
) {

// Import ConfigManager from gas-properties module
const ConfigManager = require('gas-properties/ConfigManager');
```

**Edit bottom** — close the wrapper after `module.exports = { ... };`:
```
old:   setInlineTools\n};
new:   setInlineTools
};
}

// CommonJS module — exports: getApiKey, setKnowledgeProvider, setToolRegistry, setInlineTools__defineModule__(_main);
```

No indent changes required — GAS CommonJS scoping works without indentation.
No `loadNow` needed — ChatService has no `__events__` or `__global__`.

> **Audit scope for Pre-Step 2:** Before running the grep, read the `module.exports = { ... }` block at the bottom of `chat-core/ChatService.gs` to enumerate ALL currently-exported top-level names (e.g. `getApiKey`, `setKnowledgeProvider`, `setToolRegistry`, `setInlineTools`, plus any others present). Then grep for each of those names — and any other top-level vars/functions in the file — outside `chat-core/ChatService.gs`. Grepping for only `thinkingQueue` and `_knowledgeProvider` is not sufficient; any bare reference to an exported or unexported top-level symbol will silently break after wrapping.
Push to GAS remote: `mcp__gas__edit` with `raw: true, force: true, fileType: "SERVER_JS"`.(`raw: true` is correct here per CLAUDE.md `COMMONJS_RAW` — tells mcp_gas not to auto-wrap; the `_main` wrapper is being added manually so double-wrapping must be avoided. `fileType: "SERVER_JS"` is required when `raw: true` per MEMORY.md quirk — omitting it throws ValidationError.)
### Step 2: Fix typo in `sheets-chat/SystemPrompt.gs`

- Line 930: `systematicallyatically` → `systematically`
- Push to GAS remote: `mcp__gas__edit` with `raw: true, force: true, fileType: "SERVER_JS"` (same `COMMONJS_RAW` rationale — file has a `_main` wrapper, must not auto-wrap; `fileType: "SERVER_JS"` required when `raw: true`)
### Step 3: Commit
```bash
git add chat-core/ChatService.gs sheets-chat/SystemPrompt.gs
git commit -m "fix(modules): add _main wrapper to ChatService; fix typo in sheets-chat/SystemPrompt"
```

### Step 4: Verify on GAS remote
```js
// ChatService resolves
const CS = require('chat-core/ChatService');
typeof CS === 'object' && typeof CS.getApiKey === 'function' ? 'OK' : 'FAIL';

// SystemPrompt typo gone
const SP = require('sheets-chat/SystemPrompt');
typeof SP.buildSystemPrompt === 'function' ? 'OK' : 'FAIL';
```

Run existing test suites for `chat-core` and `sheets-chat` to verify no regressions from the `_main` wrapper change. At minimum confirm `UISupport.gs` and `ClaudeConversation.gs` still resolve ChatService exports correctly via `mcp__gas__exec`.
## Post-Implementation

1. Run `/review-fix` (commit_mode="commit") — loop until clean2. Run build if applicable (e.g. `tsc --noEmit`)3. Run tests4. If build or tests fail: fix issues → re-run `/review-fix` (step 1) → re-run build/tests — repeat until passing5. Update MEMORY.md: remove or correct the note that says `sheets-chat/SystemPrompt.gs was deleted in origin/main` — the file is active and used by `ABTestHarness.gs` and test helpers; the note is wrong6. PR + merge via standard POST_IMPLEMENT pipeline <!-- review-plan -->