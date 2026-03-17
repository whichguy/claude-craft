# Plan: Fix onThinking — Respect Caller Callback + Add try/catch (Q1 + Q2)

## Context

Two advisory findings from the compaction thinking messages review:

**Q1 — `params.onThinking` is silently dropped**
`ClaudeConversation.sendMessage()` builds its own internal `onThinking` and never reads
`params.onThinking`. `ChatService` passes `onThinking: onThinking` — a callback that calls
`checkControlMessages()` before storing each thinking block. That is the only per-thinking-block
cancellation check in the system. The `typeof checkControlMessages === 'function'` guards inside
`ClaudeConversation` are permanent no-ops (that identifier is only in scope inside `ChatService`'s
closure). Result: during a long thinking-only stream, cancel won't be detected until the next
strategic checkpoint (before API call / before tool execution).

**Q2 — Internal closure has no `try/catch`**
`ChatService`'s `onThinking` wraps `storeThinkingMessage` in `try/catch` ("Never let thinking errors
crash the main message flow"). The internal `ClaudeConversation` closure calls it bare. A transient
CacheService error (quota, size limit, lock timeout) would propagate and abort the response loop.

---

## Decision: Option A — Respect caller-supplied `onThinking`

Destructure `onThinking` from params and use it when provided. Fall back to a hardened internal
closure (with `try/catch`) when not provided. This is the intended design — `ChatService` owns the
`onThinking` contract (cancellation + error suppression); `ClaudeConversation` should delegate to it.

---

## Change — `chat-core/ClaudeConversation.gs`

### 1. Add `onThinking` to params destructuring (~line 311)

```javascript
const {
  messages = [],
  text,
  system = null,
  context = {},
  attachments = [],
  maxTokens = null,
  enableThinking = true,
  requestId,
  sequenceId,
  model = null,
  tools: messageTools = null,
  onThinking: callerOnThinking = null    // ← ADD
} = params;
```

### 2. Replace `onThinking` closure definition (~line 355)

**Before:**
```javascript
// [THINK] Passed as context.think → tools → exec thinking() → sidebar
const onThinking = (thinkingText, seqId) => {
  if (!requestId) return;
  this._ChatService.storeThinkingMessage(thinkingText, seqId, requestId);
};
```

**After:**
```javascript
// [THINK] Use caller-supplied onThinking (includes cancellation check + error suppression).
// Fall back to internal closure for direct calls (e.g. recursive compaction retry).
const onThinking = callerOnThinking
  ? (thinkingText, seqId) => {
      if (!requestId) return;
      callerOnThinking(thinkingText, seqId);
    }
  : (thinkingText, seqId) => {
      if (!requestId) return;
      try {
        this._ChatService.storeThinkingMessage(thinkingText, seqId, requestId);
      } catch (e) {
        Logger.log('[ClaudeConversation] onThinking error (non-fatal): ' + e.message);
      }
    };
```

**Note on the recursive compaction retry:** The recursive `sendMessage` call (line ~555) spreads
`...params` — so `callerOnThinking` IS passed through to the retry. Compaction thinking messages
will go through `ChatService`'s callback, which calls `checkControlMessages()` first. This is
correct behavior: a cancel during compaction should be honoured.

---

## Critical Files

- `chat-core/ClaudeConversation.gs`
  - Line ~311-323: params destructuring
  - Line ~355-359: `onThinking` closure

## Verification

1. `mcp__gas__exec`: `require('chat-core/ClaudeConversation'); 'ok'` — module loads cleanly
2. Send a message in the sidebar, cancel mid-thinking — verify cancel fires promptly
3. Compaction path: both compaction thinking messages still appear in thinking block
4. No regressions in normal chat flow

## Branch & Deployment

- **Branch:** `feature/sidebar-width-presets`, merge target: `main`
- **Push:** `mcp__gas__write` → `chat-core/ClaudeConversation`
- **Post-implement:** `/review-fix`
