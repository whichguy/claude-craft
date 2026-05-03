---
name: slack-tag
description: |
  Ping someone on Slack — optionally about a GUS work item or GitHub PR,
  with optional URL intelligently hyperlinked into the message.
  Resolves identifiers, formats a rich message, previews, and sends on approval.
  Can also post directly to a channel without tagging a specific person, or
  reply to an existing thread using keywords, URLs, or 'last'.

  **AUTOMATICALLY INVOKE** when:
  - "tag someone on slack about"
  - "notify on slack about W-"
  - "slack ping" / "slack tag"
  - "DM about this work item"
  - "post this PR to slack"
  - "let X know about W-"
  - "ping someone on slack"
  - "message someone on slack about"
  - "post to #channel"
  - "send to #channel"

  - "reply to the thread about"
  - "reply in thread" / "thread reply"
  - "follow up on the slack thread"

  **NOT for:** General Slack announcements or channel summaries
argument-hint: "[person] [work-item] [#channel] [thread] [url] [message]"
allowed-tools: all
model: sonnet
---

# slack-tag

Ping someone on Slack — with or without a work item. When a GUS record or
GitHub PR is provided, resolves the item details and formats a rich message.
Without a work item, sends a simple tagged message. Can also post directly to
a channel without tagging a specific person. Always previews before sending.

---

## Preflight — Check Prerequisites

Before doing anything, verify the required tools are available:

1. **Slack MCP**: Confirm `slack_search_users` is callable. If not:
   "Slack MCP server isn't connected. Run `/mcp` to authenticate, then try again."

2. **GUS MCP** (only if work item is `W-XXXXX` — optional integration, configure if your org uses Salesforce GUS): Confirm `query_gus_records` is callable. If not:
   "GUS MCP server isn't connected. Check your MCP configuration or omit the work item."

3. **GitHub CLI** (only if work item is `owner/repo#N`): Run `gh auth status` to verify. If not authenticated:
   "GitHub CLI isn't authenticated. Run `! gh auth login` to set up."

Stop on any failure — don't attempt partial workflows.

---

## Step 0 — Parse Arguments

Extract from the user's input (flexible — natural language is fine):

- **person** (optional): name, email, or `@handle` — required for DMs, optional when a `#channel` is provided
- **work-item** (optional): `W-XXXXX` (GUS) or `owner/repo#N` (GitHub PR)
- **channel** (optional): must start with `#` (e.g. `#your-channel`) — if omitted, send as DM (requires person)
- **thread** (optional): a loose reference to an existing thread to reply to. Can be:
  - A keyword, topic, or phrase (e.g. `thread:"deploy issue"`, `thread:migration`)
  - `thread:last` or `thread:latest` — the most recent thread the user participated in
  - A raw Slack timestamp (e.g. `thread:1775762900.190809`)
  - A Slack message URL (e.g. `thread:https://workspace.slack.com/archives/C.../p...`)
  When present, the message is sent as a threaded reply. Requires a `#channel` (unless the thread reference is a URL that encodes the channel).
- **url** (optional): any `https://` URL — will be intelligently hyperlinked into the message
- **message** (optional): quoted string or trailing text after the other args

If no work item is provided, the message is sent as a simple ping (message only,
no item metadata block).

**Validation**:
- If both work-item and message are omitted, stop immediately:
  "Please provide either a work item or a message (or both)."
- If neither person nor channel is provided, stop immediately:
  "Please provide a person to DM or a #channel to post to."
- If thread is provided and is NOT a Slack URL (doesn't match `https://.*slack.com/archives/`),
  verify a channel is also provided. If not: "Thread references like 'thread:last' or
  'thread:keywords' require a #channel. Either add a channel or use the full Slack message URL."

Parse left-to-right: scan all tokens for structured patterns first — work-item
(`W-XXXXX` or `owner/repo#N`), channel (`#channel`), and URL (`https://...`).
If a non-pattern token appears before any structured token, treat it as **person**.
Remaining unmatched tokens form the **message**. If the first token is `#channel`
and no person-like token is found, this is a channel-only post (no person).

**Parse priority**: Work-item patterns are matched before the generic URL
parameter. Full GitHub PR URLs (`https://github.com/owner/repo/pull/N`) are
treated as the work-item, not the URL. To reference both a PR and a separate
link (e.g., a design doc), use shorthand for the PR: `owner/repo#N https://...`.

Examples:
```
/slack-tag john.doe W-12345678
/slack-tag @jane W-12345678 #eng-alerts "Needs your eyes on the P1"
/slack-tag jane your-org/your-repo#100 "Thoughts on this approach?"
/slack-tag john.doe #eng-alerts "Hey, got a minute to chat about the deploy?"
/slack-tag @jane "Quick question about the migration"
/slack-tag john.doe https://your-wiki.example.com/pages/12345 "Check out the new design doc"
/slack-tag @jane W-12345678 https://docs.google.com/spreadsheets/d/abc "Data is in the tracker"
/slack-tag @jane your-org/your-repo#100 https://your-wiki.example.com/runbook "See the runbook for context"
/slack-tag #general "Reminder: review deadline is Friday"
/slack-tag #eng-alerts W-12345678 "FYI — this just got escalated"
/slack-tag #eng-alerts thread:"deploy issue" "Here's the fix we discussed"
/slack-tag #eng-alerts thread:last "Following up on this"
/slack-tag thread:https://workspace.slack.com/archives/C0XXXXXXXXX/p0000000000000000 "Update on the rollout"
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

Skip this step if no person was specified (channel-only post).

Call `slack_search_users(query: "<person>")`.

- **Single match**: store `user_id` and `display_name`.
- **Multiple matches**: show a numbered list with name, title, and department.
  Ask the user to pick one.
- **No match**: try `<person>@your-org.com` as a fallback query. If still
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
https://your-gus-instance.force.com/lightning/r/ADM_Work__c/{Id}/view
```

**If GitHub PR** (matches `owner/repo#N` or a full GitHub URL):

```bash
gh pr view <owner/repo#N> --json title,state,author,url,labels,isDraft
```

**Not found**: report the error and stop. "W-XXXXX not found in GUS. Check the
number?"

### 2c. Resolve the channel (if provided)

Call `slack_search_channels(query: "<channel-name>")` to get `channel_id`.

- Not found (with person): "Can't find #channel. Send as DM to @person instead?"
- Not found (no person): "Can't find #channel. Please check the channel name."
- Omitted: use the person's `user_id` as the target (DM).

### 2d. Resolve the thread (if provided)

Skip this step if no thread reference was specified.

**If raw timestamp** (matches `^\d+\.\d+$`): use directly as `thread_ts`.

**If Slack URL** (matches `https://.*slack.com/archives/(C[A-Z0-9]+)/p(\d+)`):
extract `channel_id` from capture group 1, derive `thread_ts` by inserting a dot
after the 10th digit of capture group 2. If a `#channel` was also provided,
resolve both and compare. If they differ, ask: "The thread URL points to
#{url_channel}, but you specified #{explicit_channel}. Which one should I use?"

**If `last` or `latest`**: call `slack_read_channel(channel_id: "<channel_id>")`,
scan recent messages for ones authored by or mentioning the current user, and use
the most recent thread's parent `ts`. If no recent thread is found:
"No recent threads found in #{channel}. Try a keyword instead?"

**If keyword/topic/phrase** (anything else): search for the thread:

1. Call `slack_search_public(query: "<keywords> in:#<channel>")`. If the search
   call fails, report: "Slack search is temporarily unavailable. Try using the
   thread URL or timestamp directly."
2. From results, pick the best match — prefer messages that started threads
   (have `reply_count > 0`). If multiple candidates, show the top 3 with a
   snippet and ask the user to pick.
3. If no results: "Couldn't find a thread about '{keywords}' in #{channel}.
   Try different keywords?"

Once resolved, call `slack_read_thread(channel_id, message_ts: "<thread_ts>")`
to confirm the thread exists and grab the parent message text (used in the
preview card). If the thread read fails: "That thread exists but couldn't be
loaded (may have been deleted or restricted). Try a different thread?"

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
| "Check out the new design doc" | `https://your-wiki.example.com/...` | "Check out the new [design doc](https://...)" |
| "Data is in the tracker" | `https://docs.google.com/...` | "Data is in the [tracker](https://...)" |
| "Here's the runbook for the migration" | `https://your-wiki.example.com/...` | "Here's the [runbook](https://...) for the migration" |
| "Can you review this?" | `https://github.com/org/repo/pull/42` | "Can you [review this](https://...)?" |
| "FYI" | `https://example.com/article` | "[FYI](https://...)" (fallback: hyperlink the whole message) |

**Rules**:
- Hyperlink the most semantically relevant phrase, not the entire message
- If no phrase is a natural fit, append on its own line as `[View link]({url})`
- Never show a bare URL — always wrap in `[anchor text](url)` markdown
- If a work item is also present, the work item gets its own link line (as usual)
  and the user's URL is hyperlinked into the blockquote message:

  ```
  :warning: **W-12345678: Fix auth flow**
  Bug · In Progress · P1 · Gov Cloud
  [Open in GUS](https://your-gus-instance.force.com/...)

  > Data is in the [tracker](https://docs.google.com/spreadsheets/d/abc)
  ```

### @mention behavior

When posting to a **channel with a person**, prefix the message with `<@USER_ID>`
so the person gets a Slack notification. When sending a **DM**, skip the @mention
(they'll see it directly). When posting to a **channel without a person**
(channel-only), skip the @mention entirely.

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

Channel-only version (no person):
```
{message}
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
- Thread reply (no work item, no explicit message): "Following up on this."
- No work item (with person): **a message is required** — ask the user what to say.
- No work item (channel-only): **a message is required** — ask the user what to say.

---

## Step 4 — Preview & Confirm

Show a terminal preview card before sending:

```
  ╭──────────────────────────────────────────────╮
  │  slack-tag                                    │
  ╰──────────────────────────────────────────────╯

  To        @{handle} ({Full Name})   ← or omit if channel-only
  Via       #{channel-name} (tagged)   ← or "DM" if no channel; "(broadcast)" if no person
  Thread    ↳ "{first 60 chars of parent message}..."   ← only shown when replying to a thread
  Item      {W-number} — {Subject}     ← or omit this line if no work item
  Ref       {url}                      ← omit if no user-provided URL

  ── Message Preview ──────────────────────────────

  {formatted slack message here}

  ────────────────────────────────────────────────
```

If no `thread` argument was provided, show a tip below the card:
```
  💡 Tip: Add thread:"keyword" to reply to an existing thread in this channel.
```
Skip this tip when the user already supplied a `thread` argument.

Then ask: **"Send this?"** (yes / no / edit)

- **yes** → call `slack_send_message(channel_id: "<id>", message: "<formatted>")`.
  If replying to a thread, include `thread_ts: "<thread_ts>"` in the call.
- **edit** → ask what to change, update the message, re-preview
- **no** → abort cleanly

---

## Step 5 — Delivery Confirmation

After a successful send, print the confirmation and thread context:

```
  Sent to #{channel} · @{handle} · {work-item-id}     ← omit @handle if channel-only, omit work-item-id if none
  📌 This message landed in #{channel} ({channel_id}) at ts {message_ts}. Follow-ups should thread here.
```

The breadcrumb uses the `channel_id` from Step 2c and the message timestamp
returned by `slack_send_message`. It's open-ended guidance — any future Claude
session reading the transcript will have enough context to thread a reply
using `slack_send_message` with `thread_ts`, without being locked into a
rigid template.

---

## Step 6 — Error Handling

| Situation | Response |
|-----------|----------|
| Person not found on Slack | Try `{name}@your-org.com`, show suggestions, ask for email |
| Multiple Slack matches | Numbered list: name + title + department. Ask to pick. |
| Work item not found | "{W-number} not found in GUS. Check the number?" |
| Channel not found | "Can't find #{name}. Send as DM to @{person} instead?" |
| Slack send fails | Show the error. Offer to retry or save as draft via `slack_send_message_draft`. |
| GUS MCP unavailable | "GUS is unavailable right now. Try again in a moment." |
| Thread not found by keyword | "Couldn't find a thread about '{keywords}' in #{channel}. Try different keywords?" |
| No recent threads (last/latest) | "No recent threads found in #{channel}. Try a keyword instead?" |
| Thread URL parse failure | "Couldn't parse that Slack URL. Expected: https://WORKSPACE.slack.com/archives/CXXXXXXXX/pXXXXXXXXXXXXXXXX" |
| Thread ts without channel | "Thread timestamp needs a #channel or use the full Slack message URL." |
