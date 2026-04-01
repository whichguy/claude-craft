---
name: slack-tag
description: |
  Ping someone on Slack — optionally about a GUS work item or GitHub PR.
  Resolves identifiers, formats a rich message, previews, and sends on approval.

  **AUTOMATICALLY INVOKE** when:
  - "tag someone on slack about"
  - "notify on slack about W-"
  - "slack ping" / "slack tag"
  - "DM about this work item"
  - "post this PR to slack"
  - "let X know about W-"
  - "ping someone on slack"
  - "message someone on slack about"

  **NOT for:** General Slack announcements or channel summaries
argument-hint: "<person> [work-item] [#channel] [url] [message]"
allowed-tools: all
model: sonnet
---

# slack-tag

Ping someone on Slack — with or without a work item. When a GUS record or
GitHub PR is provided, resolves the item details and formats a rich message.
Without a work item, sends a simple tagged message. Always previews before
sending.

---

## Preflight — Check Prerequisites

Before doing anything, verify the required tools are available:

1. **Slack MCP**: Confirm `slack_search_users` is callable. If not:
   "Slack MCP server isn't connected. Run `/mcp` to authenticate, then try again."

2. **GUS MCP** (only if work item is `W-XXXXX`): Confirm `query_gus_records` is callable. If not:
   "GUS MCP server isn't connected. Check your MCP configuration."

3. **GitHub CLI** (only if work item is `owner/repo#N`): Run `gh auth status` to verify. If not authenticated:
   "GitHub CLI isn't authenticated. Run `! gh auth login` to set up."

Stop on any failure — don't attempt partial workflows.

---

## Step 0 — Parse Arguments

Extract from the user's input (flexible — natural language is fine):

- **person** (required): name, email, or `@handle`
- **work-item** (optional): `W-XXXXX` (GUS) or `owner/repo#N` (GitHub PR)
- **channel** (optional): must start with `#` (e.g. `#gov-cloud-all`) — if omitted, send as DM
- **url** (optional): any `https://` URL — will be intelligently hyperlinked into the message
- **message** (optional): quoted string or trailing text after the other args

If no work item is provided, the message is sent as a simple ping (message only,
no item metadata block).

**Validation**: If both work-item and message are omitted, stop immediately:
"Please provide either a work item or a message (or both)."

Parse left-to-right: first token is always **person**, then look for work-item
patterns (`W-XXXXX` or `owner/repo#N`), channel (`#channel`), and URL
(`https://...`) in remaining tokens, then treat the rest as message.

Examples:
```
/slack-tag john.doe W-12345678
/slack-tag @jane W-12345678 #gov-cloud-all "Needs your eyes on the P1"
/slack-tag jane anthropics/claude-code#100 "Thoughts on this approach?"
/slack-tag john.doe #gov-cloud-all "Hey, got a minute to chat about the deploy?"
/slack-tag @jane "Quick question about the migration"
/slack-tag john.doe https://confluence.internal/pages/12345 "Check out the new design doc"
/slack-tag @jane W-12345678 https://docs.google.com/spreadsheets/d/abc "Data is in the tracker"
```

---

## Step 1 — Triage

No complexity triage — all invocations follow the same inline path:
resolve → format → preview → send. Proceed directly to Step 2.

---

## Step 2 — Resolve Identifiers

**IMPORTANT**: GUS MCP calls must be sequential (never parallel). Slack calls
can run in parallel with each other and with GitHub CLI calls.

### 2a. Find the person on Slack

Call `slack_search_users(query: "<person>")`.

- **Single match**: store `user_id` and `display_name`.
- **Multiple matches**: show a numbered list with name, title, and department.
  Ask the user to pick one.
- **No match**: try `<person>@salesforce.com` as a fallback query. If still
  nothing, ask the user for the person's email or Slack handle.

### 2b. Look up the work item (if provided)

Skip this step entirely if no work item was specified — go straight to Step 2c.
(Step 3 will use the simple message template instead of the GUS/PR templates.)

**If GUS** (matches `^W-[0-9]+$`):

Validate format — reject anything not matching this pattern.
If invalid: "That doesn't look like a GUS work item number. Expected format: W-12345678."

```sql
SELECT Id, Name, Subject__c, Status__c, Priority__c,
       RecordType.Name, Product_Tag__c,
       Scrum_Team__r.Name, Assignee__r.Name
FROM ADM_Work__c
WHERE Name = '<W-number>'
```

Build the GUS URL from the `Id` field:
```
https://gus.lightning.force.com/lightning/r/ADM_Work__c/{Id}/view
```

**If GitHub PR** (matches `owner/repo#N` or a full GitHub URL):

```bash
gh pr view <owner/repo#N> --json title,state,author,url,labels,isDraft
```

**Not found**: report the error and stop. "W-XXXXX not found in GUS. Check the
number?"

### 2c. Resolve the channel (if provided)

Call `slack_search_channels(query: "<channel-name>")` to get `channel_id`.

- Not found: "Can't find #channel. Send as DM to @person instead?"
- Omitted: use the person's `user_id` as the target (DM).

---

## Step 3 — Format the Slack Message

### Design principles

- Lead with the item — bold title is the first thing they see
- One contextual emoji max (priority-driven for GUS, none for PRs)
- Clean metadata line using middle-dot separators
- Link on its own line
- Personal note in a blockquote

### Priority emoji (GUS only)

| Priority | Emoji |
|----------|-------|
| P0 | `:rotating_light:` |
| P1 | `:warning:` |
| P2 | `:mag:` |
| Any other | _(none)_ |

### URL hyperlinking (when a URL is provided)

When the user provides a URL alongside a message, **do not dump the raw URL**
into the message. Instead, intelligently hyperlink it into the message text
using Slack's `[anchor text](url)` markdown format.

**How to pick the anchor text**: Read the message and find the noun phrase that
the URL most naturally describes. Examples:

| Message | URL | Result |
|---------|-----|--------|
| "Check out the new design doc" | `https://confluence.internal/...` | "Check out the new [design doc](https://...)" |
| "Data is in the tracker" | `https://docs.google.com/...` | "Data is in the [tracker](https://...)" |
| "Here's the runbook for the migration" | `https://wiki.internal/...` | "Here's the [runbook](https://...) for the migration" |
| "Can you review this?" | `https://github.com/org/repo/pull/42` | "Can you [review this](https://...)?" |
| "FYI" | `https://example.com/article` | "[FYI](https://...)" (fallback: hyperlink the whole message) |

**Rules**:
- Hyperlink the most semantically relevant phrase, not the entire message
- If no phrase is a natural fit, append the link on its own line: `[Link]({url})`
- Never show a raw URL in the message body
- If a work item is also present, the work item gets its own link line (as usual)
  and the user's URL is hyperlinked into the blockquote message

### @mention behavior

When posting to a **channel**, prefix the message with `<@USER_ID>` so the
person gets a Slack notification. When sending a **DM**, skip the @mention
(they'll see it directly).

### Template — GUS work item

Channel version (with @mention):
```
<@{user_id}> {priority_emoji} **{W-number}: {Subject}**
{RecordType} · {Status} · {Priority} · {Team}
[Open in GUS]({url})

> {message}
```

DM version (no @mention):
```
{priority_emoji} **{W-number}: {Subject}**
{RecordType} · {Status} · {Priority} · {Team}
[Open in GUS]({url})

> {message}
```

### Template — GitHub PR

Channel version (with @mention):
```
<@{user_id}> **{owner/repo}#{number}: {title}**
PR · {state}{draft_badge} · by {author}{label_badges}
[Open on GitHub]({url})

> {message}
```

DM version (no @mention):
```
**{owner/repo}#{number}: {title}**
PR · {state}{draft_badge} · by {author}{label_badges}
[Open on GitHub]({url})

> {message}
```

- **Draft badge**: if the PR is a draft, append ` · _Draft_` to the metadata line.
- **Label badges**: show up to 3 labels as inline code (e.g. `` `enhancement` ``). Skip if none.

### Template — Simple message (no work item)

Channel version (with @mention):
```
<@{user_id}> {message}
```

DM version (no @mention):
```
{message}
```

In all templates, `{message}` means the **hyperlink-processed** message — if a
URL was provided, the anchor text substitution has already been applied before
the message is placed into the template.

### Default messages (when the user doesn't provide one)

Pick based on context:
- GUS P0/P1: "Heads up — this could use some attention."
- GUS general: "Hey — could use your eyes on this when you get a chance."
- GitHub PR: "Mind taking a look when you have a minute?"
- No work item: **a message is required** — ask the user what to say.

---

## Step 4 — Preview & Confirm

Show a terminal preview card before sending:

```
  ╭──────────────────────────────────────────────╮
  │  slack-tag                                    │
  ╰──────────────────────────────────────────────╯

  To        @{handle} ({Full Name})
  Via       #{channel-name} (tagged)   ← or "DM" if no channel
  Item      {W-number} — {Subject}     ← or omit this line if no work item
  Link      {url}                      ← or omit this line if no URL

  ── Message Preview ──────────────────────────────

  {formatted slack message here}

  ────────────────────────────────────────────────
```

Then ask: **"Send this?"** (yes / no / edit)

- **yes** → call `slack_send_message(channel_id: "<id>", message: "<formatted>")`
- **edit** → ask what to change, update the message, re-preview
- **no** → abort cleanly

---

## Step 5 — Delivery Confirmation

After a successful send, print a single confirmation line:

```
  Sent to #{channel} · @{handle} · {work-item-id}     ← omit work-item-id if none
```

---

## Step 6 — Error Handling

| Situation | Response |
|-----------|----------|
| Person not found on Slack | Try `{name}@salesforce.com`, show suggestions, ask for email |
| Multiple Slack matches | Numbered list: name + title + department. Ask to pick. |
| Work item not found | "{W-number} not found in GUS. Check the number?" |
| Channel not found | "Can't find #{name}. Send as DM to @{person} instead?" |
| Slack send fails | Show the error. Offer to retry or save as draft via `slack_send_message_draft`. |
| GUS MCP unavailable | "GUS is unavailable right now. Try again in a moment." |
