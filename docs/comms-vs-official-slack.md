# comms vs official Slack plugin parity audit (Task #10)

## Summary

**Verdict: KEEP comms intact. No parity with the official plugin — they are complementary, not redundant.**

## What `comms` ships

A single skill, `slack-tag`, which is a **write-side workflow**:

- Resolves a person identifier to a Slack user via `slack_search_users` MCP
- Optionally looks up a GUS (Salesforce) work item or GitHub PR
- Formats a rich message with intelligently hyperlinked URLs
- Supports DM-tag, channel post, and thread reply modes
- Always previews before sending

## What the official `slack` plugin (`slackapi/slack-mcp-plugin`) ships

Per the marketplace listing (`claude-plugins-official`):

> Slack workspace integration. Search messages, access channels, read threads, and stay connected with your team's communications while coding. Find relevant discussions and context quickly.

That is a **read-side wrapper** — surface Slack content into the Claude session for context.

## Overlap

None on user-facing capabilities. The two address opposite verbs:

| | Read | Write |
|---|---|---|
| comms (`slack-tag`) | ❌ | ✅ (DM, channel, thread reply) |
| official `slack` | ✅ | ❌ (no send/notify workflow) |

The only shared dependency is the underlying Slack MCP server (`slack_search_users` etc.), but both plugins are workflows on top — not redundant implementations.

## Recommended action

Keep `comms` in the marketplace. Optionally add a one-liner to the comms README/plugin description noting that for read-side context (searching messages, reading threads), users can install `slack@claude-plugins-official` alongside.

No code changes recommended.
