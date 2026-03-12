---
name: make-slides
description: |
  Generate a Google Slides presentation from any content — text, markdown,
  topic description, URL, or structured data.

  **AUTOMATICALLY INVOKE** when user says:
  - "make slides", "create slides", "create a presentation"
  - "turn this into a deck", "build a slide deck", "generate slides"
  - "present this", "presentation from this content"

model: sonnet
allowed-tools:
  - mcp__gas-mcp__create_presentation
  - mcp__chrome-devtools__list_pages
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__wait_for
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__evaluate_script
  - WebFetch
---

# Make Slides

You create Google Slides presentations from user-provided content, then
visually verify them with Chrome DevTools.

---

## Phase 1 — Understand the Input

Accept content in any form:
- **Pasted text / markdown** → extract structure directly
- **Topic only** → generate a logical outline from knowledge
- **URL** → call WebFetch, summarize key points before structuring

Before structuring slides, identify 3–5 main themes in the content. Each
theme becomes a section. This prevents the common mistake of mapping one
paragraph to one slide.

---

## Phase 2 — Design the Slide Structure

### Deck Architecture

| Position | Layout | Purpose |
|----------|--------|---------|
| Slide 1 (cover) | auto | Deck title + subtitle/tagline |
| Slides 2–3 | TITLE_AND_BODY or SECTION_HEADER | Context / agenda |
| Middle slides | TITLE_AND_BODY, BIG_NUMBER, MAIN_POINT | Core content |
| Last slide | TITLE_AND_BODY | "Thank You / Questions" |

Default: 8–12 slides. Respect explicit count requests. Hard max: 20 slides.

### Layout Selection Rules

| Slide content type | Layout to use |
|-------------------|---------------|
| Normal content with 2–6 bullets | `TITLE_AND_BODY` (default) |
| Transition between sections | `SECTION_HEADER` |
| Single key metric or stat | `BIG_NUMBER` |
| Bold qualitative statement / quote | `MAIN_POINT` |
| Intentionally empty (for images added later) | `BLANK` |

### Layout Schemas

**TITLE_AND_BODY** (default):
```json
{ "title": "Why This Matters", "bullets": ["Reason A", "Reason B", "Reason C"], "notes": "..." }
```

**SECTION_HEADER** — title only, no bullets:
```json
{ "layout": "SECTION_HEADER", "title": "Part 2: Results" }
```

**BIG_NUMBER** — `title` is the stat (rendered large), `bullets[0]` is the label below it:
```json
{ "layout": "BIG_NUMBER", "title": "94%", "bullets": ["user satisfaction (Q4 2025)"], "notes": "Source: internal survey" }
```

**MAIN_POINT** — `title` is a short, bold statement filling the slide:
```json
{ "layout": "MAIN_POINT", "title": "The future is APIs." }
```

### Cover Slide
The first item in `slides[]` (with no `layout` field) sets the cover subtitle text:
```json
{ "title": "Tagline or author name — March 2026" }
```

### Bullet Writing Rules
- 3–6 bullets per TITLE_AND_BODY slide
- Each bullet ≤ 10 words — punchy phrases, not full sentences
- Parallel grammatical structure within each slide (all verbs, or all nouns, etc.)
- Lead with the key word (verb or noun first, not "The" or "A")

### Speaker Notes
Every slide gets 1–3 sentences of talking points:
- Expand on what's on screen
- End the last note sentence with a transition to the next slide

---

## Phase 3 — Content Patterns for Common Slide Types

These patterns map content types to the correct JSON representation.

### Comparison / Before-After
Use paired SECTION_HEADER + TITLE_AND_BODY slides:
```json
[
  { "layout": "SECTION_HEADER", "title": "Before" },
  { "title": "Current State", "bullets": ["Manual process", "3-day cycle time", "High error rate"] },
  { "layout": "SECTION_HEADER", "title": "After" },
  { "title": "Proposed State", "bullets": ["Automated", "2-hour cycle time", "Near-zero errors"] }
]
```
Two-column side-by-side layouts are not available via this API.

### Timeline / Roadmap
Use TITLE_AND_BODY with time-prefixed bullets:
```json
{
  "title": "Q1–Q4 2026 Roadmap",
  "bullets": ["Q1: Foundation — infrastructure", "Q2: MVP — core features", "Q3: Scale — performance", "Q4: Expand — new markets"],
  "notes": "Q2 is the critical milestone"
}
```
Visual timeline bars with connectors require manual editing in Slides.

### Quote / Testimonial
Use MAIN_POINT for the quote; include attribution in notes (not on slide):
```json
{
  "layout": "MAIN_POINT",
  "title": "\"The only way to do great work is to love what you do.\"",
  "notes": "— Steve Jobs, Stanford 2005"
}
```
Or use TITLE_AND_BODY when attribution must be visible:
```json
{
  "title": "\"The only way to do great work is to love what you do.\"",
  "bullets": ["— Steve Jobs, Stanford Commencement 2005"]
}
```

### Process Flow (Step-by-Step)
Numbered bullets, introduced by a SECTION_HEADER:
```json
[
  { "layout": "SECTION_HEADER", "title": "How It Works" },
  {
    "title": "5-Step Process",
    "bullets": ["1. Discover — identify the problem", "2. Define — scope requirements", "3. Design — prototype", "4. Develop — build and test", "5. Deploy — ship and measure"]
  }
]
```
Flowchart diagrams with arrows cannot be created via this tool.

### Key Stat Callout
Use BIG_NUMBER:
```json
{ "layout": "BIG_NUMBER", "title": "$2.4M", "bullets": ["annual cost savings from automation"], "notes": "Source: Finance Q4 report" }
```

### Simulated Table
Avoid table-like ASCII art — proportional fonts break alignment. Instead use
a TITLE_AND_BODY slide with a note to add a real table manually:
```json
{
  "title": "Feature Comparison",
  "bullets": ["API Access: Basic=No, Pro=Yes, Enterprise=Yes", "SSO: Basic=No, Pro=No, Enterprise=Yes", "SLA: Basic=None, Pro=99.9%, Enterprise=99.99%"],
  "notes": "PRESENTER NOTE: Convert to a real Slides table for final version"
}
```

### Known Limitations
The GAS SlidesApp API cannot create:
- Multi-column layouts (two columns side-by-side)
- Positioned text boxes or shapes
- Tables
- Images or diagrams
- Custom fonts or colors

Always note these in speaker notes when the user's intent requires them.

---

## Phase 4 — Create the Presentation

Call `mcp__gas-mcp__create_presentation` with:
- `title`: the presentation title
- `slides`: the structured array (first item = cover subtitle data)

Capture the returned `url` and `slideCount`.

---

## Phase 5 — Visual Verification with Chrome DevTools

Verify the output matches intent. Chrome must be running with
`--remote-debugging-port=9222`. Check first:

```
list_pages → if error: skip verification, report URL only
```

### Verification Steps

1. **Open the presentation**
   ```
   navigate_page → url from create_presentation result
   ```

2. **Detect login redirect** (before waiting for content)
   ```
   evaluate_script → document.location.hostname
   ```
   If result contains `accounts.google.com`:
   → Report "Chrome requires Google login to open this presentation"
   → Skip remaining verification steps

3. **Wait for slide editor to load**
   ```
   wait_for → [data-slide-id] (data attribute on slide elements, more stable than class names)
   timeout: 10s
   ```

4. **Take a screenshot**
   ```
   take_screenshot
   ```

5. **Count slides in DOM**
   ```
   evaluate_script → document.querySelectorAll('[data-slide-id]').length
   ```
   Compare to `slideCount` from the MCP result. Report if they differ.

6. **Get title from first slide**
   ```
   evaluate_script → document.querySelector('[data-slide-id]')?.textContent?.substring(0, 100)
   ```
   Verify the presentation title is visible.

### Visual Check Criteria
- [ ] Screenshot shows the Slides editor (not a login page or error)
- [ ] DOM slide count matches `slideCount` from `create_presentation` response
- [ ] First slide thumbnail contains the deck title text
- [ ] No obvious layout errors visible (blank sections that should have text)

### Reporting
```
Presentation created: <url>
<N> slides — visual verification: PASS / FAIL / SKIPPED (Chrome not available)
```

If verification fails: describe the discrepancy and offer to regenerate.

---

## Phase 6 — Error Handling

| Error condition | Action |
|----------------|--------|
| `create_presentation` returns error | Show message; offer to output raw JSON for manual creation |
| Chrome not available | Create and report URL without visual check |
| Login redirect detected | Report URL; ask user to open Chrome with their Google account |
| Screenshot shows blank page | Retry: `wait_for` 5s, then `take_screenshot` again |
| Slide count mismatch | Report discrepancy and offer to regenerate |

---

## Slide Count Guidance

| Input | Slides |
|-------|--------|
| Topic only | 8–10 |
| Short text (< 300 words) | 6–8 |
| Medium (300–1000 words) | 10–12 |
| Long (> 1000 words) | 12–18 |
| User-specified | Honor exactly (max 20) |
