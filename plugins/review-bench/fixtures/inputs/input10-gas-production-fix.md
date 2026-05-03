# Plan: Fix onThinking — Respect Caller Callback + Harden Internal Fallback

## Context

`ClaudeConversation.sendMessage()` builds its own `onThinking` closure and silently ignores
`params.onThinking`. `ChatService` passes `onThinking: onThinking` — a callback that calls
`checkControlMessages()` before storing each thinking block. This is the only per-thinking-block
cancellation check in the system. The `typeof checkControlMessages === 'function'` guards inside
`ClaudeConversation` are permanent no-ops because `checkControlMessages` is only in scope inside
`ChatService`'s closure. During a long thinking-only stream, cancel won't be detected until the
next strategic checkpoint (before API call or before tool execution).

Additionally, the internal closure calls `storeThinkingMessage` bare — no try/catch. A transient
CacheService error (quota, size limit, lock timeout) would propagate and abort the response loop.

Fix: destructure `onThinking` from params, delegate to the caller-supplied callback when present,
and fall back to a hardened internal closure (with try/catch) for direct calls where no caller
callback is provided.

## Implementation Steps

1. `mcp__gas__auth mode:status` — confirm GAS session active
2. Read `chat-core/ClaudeConversation.gs` — verify that `onThinking` is NOT present in the
   params destructuring at line ~311–323, and that the internal `onThinking` closure at line ~355
   calls `this._ChatService.storeThinkingMessage` without a try/catch
3. Edit `chat-core/ClaudeConversation.gs` via `mcp__gas__write`:
   - Line ~311: add `onThinking: callerOnThinking = null` to the params destructuring block
   - Line ~355: replace the current bare internal closure with a conditional:
     - If `callerOnThinking` is non-null: wrap it with a `requestId` guard and delegate
     - Else: internal closure with `try/catch` around `storeThinkingMessage`; log error as
       non-fatal and continue
4. Exec verify: `mcp__gas__exec` → `require('chat-core/ClaudeConversation'); 'ok'` — module
   loads cleanly with no parse or reference errors
5. Send a test message in the staging sidebar — cancel mid-thinking — verify cancel fires
   at the next thinking block, not the next tool call
6. Verify compaction path: trigger a compaction (long context) — both compaction thinking
   messages still appear in the thinking block in the UI
7. Commit: `git add chat-core/ClaudeConversation.gs && git commit -m "fix: respect caller onThinking callback + harden internal fallback"`

## Verification

- Step 4: `require('chat-core/ClaudeConversation'); 'ok'` exec returns success
- Step 5: cancel mid-thinking fires promptly (next thinking block, not next tool call)
- Step 6: compaction thinking messages still visible in sidebar
- No regressions in normal chat flow — `npm test` passes
