---
name: slides
description: |
  Generate professional presentations from material, notes, or topic descriptions.
  Produces reveal.js HTML (single file, no build step) or Google Slides (via GAS SlidesApp).

  AUTOMATICALLY INVOKE when: "create slides", "make a deck", "generate a presentation",
  "slides about", "deck on", "presentation from [material]"

  NOT for: editing existing PPTX, converting files, exporting Sheets charts
model: claude-sonnet-4-6
allowed-tools: all
---

# /slides — AI Presentation Generator

You generate professional presentations from topics, notes, or raw material. Two output paths:
- **Path A — reveal.js HTML**: Single self-contained file, CDN-based, opens in any browser
- **Path B — Google Slides**: Created via GAS `SlidesApp`, returns a Drive URL

Follow all five steps in order. Do not skip Step 2 outline confirmation unless `--no-confirm` is present in the invocation args.

---

## Step 1 — Gather Input

Parse the invocation args for:
- **Topic or material**: Text, bullet points, or a description to base slides on
- **Output format**: `html` (reveal.js) or `google` (Google Slides)
- **Slide count**: A specific number, or default to 6–8
- **Audience**: `general`, `technical`, or `executive` (affects language complexity)
- **Theme** (HTML path only): One of `black`, `white`, `league`, `sky`, `moon`, `solarized`, `dracula` — default `sky`
- **`--no-confirm` flag**: If present, skip outline confirmation in Step 2

**If topic/material is missing OR format is not specified**, use `AskUserQuestion` with these questions:

```
Question 1 (header: "Content"): "What should the presentation cover? Paste your notes, bullet points, or describe the topic."
  → free text (Other option)

Question 2 (header: "Format"): "Which output format?"
  Options:
    - label: "HTML (reveal.js)", description: "Single self-contained HTML file — open in any browser, no install needed"
    - label: "Google Slides", description: "Creates a real Google Slides deck via GAS — returns a Drive URL"

Question 3 (header: "Audience"): "Who is the audience?"
  Options:
    - label: "Technical", description: "Engineers, developers — detailed, can include code and diagrams"
    - label: "Executive", description: "Leadership — high-level, metrics-focused, minimal jargon"
    - label: "General", description: "Mixed or unspecified audience"

Question 4 (header: "Slide count"): "How many slides?"
  Options:
    - label: "6–8 (default)", description: "Standard deck — enough depth without overload"
    - label: "10–12", description: "Longer presentation with more detail per section"
    - label: "4–5", description: "Short overview or lightning talk"
```

If format was specified but topic is missing, ask only for content (Question 1).
If topic was specified but format is missing, ask only for format (Question 2).

After gathering all required info, record:
- `$TOPIC` — the raw topic/material text
- `$FORMAT` — `html` or `google`
- `$COUNT` — target slide count (integer or range like "6-8")
- `$AUDIENCE` — `technical`, `executive`, or `general`
- `$THEME` — chosen theme (HTML path only; default `sky`)

---

## Step 2 — Generate & Confirm Outline

Analyze `$TOPIC` and produce a numbered slide outline matching `$COUNT` and `$AUDIENCE`.

**Outline format:**

```
## Presentation Outline — [Title]
Format: [reveal.js HTML | Google Slides]
Slides: [count]  Audience: [audience]  Theme: [theme or N/A]

1. **[Slide Title]** — [type: title | bullet | two-column | stat | code | diagram | section]
   [2–3 word summary of content]
2. ...
```

Include:
- A title/cover slide (slide 1)
- A closing/next-steps slide (last slide)
- Section breaks for decks over 8 slides
- Code slides only if `$AUDIENCE == technical`
- At most one diagram slide (use Mermaid for HTML path)

**If `--no-confirm` is NOT present**, print the outline and ask the user to approve or request changes:

> "Does this outline look right? Reply 'yes' to generate, or describe any changes."

Wait for confirmation before proceeding. If the user requests changes, revise the outline and ask again. Loop until approved.

**If `--no-confirm` IS present**, print the outline and immediately proceed to Step 3.

---

## Step 3A — reveal.js HTML Path

*Only execute this step if `$FORMAT == html`.*

### HTML Generation Rules

Generate a complete, self-contained HTML file using the reveal.js CDN:

**CDN URLs (jsDelivr, v5.2.1):**
```
CSS:    https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.css
Theme:  https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/theme/$THEME.css
JS:     https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.js
Plugin - Highlight: https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/highlight/highlight.js
Plugin - Notes:     https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/notes/notes.js
// Markdown plugin omitted — slides use native HTML templates. Load only if generating markdown-sourced slides.
Highlight CSS:      https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/plugin/highlight/monokai.css
```

If any slide is type `diagram`, also load Mermaid:
```
https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js
```

**Initialization:**
```javascript
Reveal.initialize({
  hash: true,
  slideNumber: 'c/t',
  transition: 'slide',
  plugins: [ RevealHighlight, RevealNotes ]
});
```

If Mermaid is loaded, add after Reveal.initialize:
```javascript
mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
```

**CSS Overrides** (inside `<style>` in `<head>`):
```css
.reveal h1, .reveal h2 { text-shadow: 0 2px 4px rgba(0,0,0,.15); }
.reveal .slides section { padding: 40px 60px; box-sizing: border-box; }
.reveal ul li { margin-bottom: .4em; line-height: 1.4; }
.reveal .subtitle { font-size: .65em; opacity: .75; margin-top: .5em; }
```

### Slide Type → HTML Mapping

| Type | HTML Pattern |
|---|---|
| Title / cover | `<section><h1>TITLE</h1><p class="subtitle">SUBTITLE</p><aside class="notes">NOTES</aside></section>` |
| Bullet content | `<section><h2>TITLE</h2><ul><li>POINT</li>…</ul><aside class="notes">NOTES</aside></section>` |
| Two-column | `<section><h2>TITLE</h2><div style="display:flex;gap:2em"><div><ul><li>…</li></ul></div><div><ul><li>…</li></ul></div></div><aside class="notes">NOTES</aside></section>` |
| Big stat | `<section><h2 class="r-fit-text">STAT</h2><p>CONTEXT</p><aside class="notes">NOTES</aside></section>` |
| Code | `<section><h2>TITLE</h2><pre><code class="language-js" data-trim>CODE</code></pre><aside class="notes">NOTES</aside></section>` |
| Diagram | `<section><h2>TITLE</h2><div class="mermaid">MERMAID_SYNTAX</div><aside class="notes">NOTES</aside></section>` |
| Section break | `<section data-background-color="#2c3e50"><h2>SECTION_TITLE</h2><aside class="notes">NOTES</aside></section>` |
| Closing | `<section><h2>TITLE</h2><ul><li>NEXT_STEP</li>…</ul><p><em>TAGLINE</em></p><aside class="notes">NOTES</aside></section>` |

**Every slide must have a `<aside class="notes">` block** — generate 1–2 sentences of speaker notes tailored to the content.

### XSS Sanitization

All user-supplied text embedded in HTML must have these characters escaped before insertion:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#39;`

Apply escaping to all slide titles, bullet text, speaker notes, and any other user-controlled content embedded in the HTML. Do NOT escape the structural HTML tags you generate — only the content values.

### Output

Write the file to the user's Desktop using an absolute path. Resolve the Desktop path before writing:
```bash
echo "$HOME/Desktop"
```
Use the result as the directory. Full path: `$HOME/Desktop/[kebab-title]-slides.html`

Where `[kebab-title]` is the presentation title converted to lowercase kebab-case (e.g., "MCP GAS Architecture Overview" → `mcp-gas-architecture-overview`).

Use the `Write` tool to create the file at the resolved Desktop path. Do not use Bash redirection or `cat` — the `Write` tool provides better permission handling and review visibility.

Print after writing:
```
✅ Slides written to: [full absolute path]
   Open with: open "[full absolute path]"
   Press S in the browser to open speaker notes view.
```

---

## Step 3B — Google Slides via GAS Path

*Only execute this step if `$FORMAT == google`.*

### Pre-condition: Verify OAuth Scope

Before executing GAS code, check that the target GAS project's `appsscript.json` contains the `https://www.googleapis.com/auth/presentations` scope.

Use `mcp__gas__cat` to read `appsscript.json` from the target script. If the scope is absent:
1. Add it to the `oauthScopes` array using `mcp__gas__edit`
2. Inform the user: "Added `presentations` scope to appsscript.json. You will need to re-authorize the script once (open the script editor and run any function to trigger the OAuth flow)."

**Default target script**: SHEETS_CHAT (`1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`)

If the user specifies a different scriptId in the invocation args, use that instead.

### PredefinedLayout Mapping

| Slide Type | PredefinedLayout |
|---|---|
| Title / cover | `SlidesApp.PredefinedLayout.TITLE` |
| Bullet content | `SlidesApp.PredefinedLayout.TITLE_AND_BODY` |
| Two-column | `SlidesApp.PredefinedLayout.BLANK` |
| Big stat / number | `SlidesApp.PredefinedLayout.BIG_NUMBER` |
| Section divider | `SlidesApp.PredefinedLayout.SECTION_HEADER` |
| Custom / image | `SlidesApp.PredefinedLayout.BLANK` |

### GAS Code Template

Generate a self-contained `createPresentation()` function based on the confirmed outline. The canvas is 720×540 pt (SlidesApp uses points for all dimensional arguments to `insertTextBox`). Standard layout: width 960 pt × 540 pt total slide area, but the writable region is typically 720 pt wide × 540 pt tall after margins.

**Code structure:**
```javascript
function createPresentation() {
  const title = "PRESENTATION_TITLE";
  const pres = SlidesApp.create(title);

  // Remove the default blank slide
  const slides = pres.getSlides();
  if (slides.length > 0) slides[0].remove();

  // Helper: add a slide with layout and return it
  function addSlide(layout) {
    return pres.appendSlide(layout);
  }

  // Helper: add text box with consistent styling
  function addTitle(slide, text, fontSize) {
    const shape = slide.insertTextBox(text, 30, 20, 900, 80);
    const style = shape.getText().getTextStyle();
    style.setFontSize(fontSize || 36).setBold(true);
    return shape;
  }

  function addBody(slide, text, fontSize) {
    const shape = slide.insertTextBox(text, 30, 120, 900, 380);
    const style = shape.getText().getTextStyle();
    style.setFontSize(fontSize || 20);
    return shape;
  }

  // SLIDE 1: Title slide
  const slide1 = addSlide(SlidesApp.PredefinedLayout.TITLE);
  addTitle(slide1, "SLIDE_TITLE", 44);
  addBody(slide1, "SLIDE_SUBTITLE", 24);

  // SLIDE N: [type]
  // ... (generate one block per slide from the outline)

  return pres.getUrl();
}
```

**Styling conventions:**
- Title text: 36pt, bold
- Cover title: 44pt, bold
- Body / bullet text: 20pt, normal
- Section headers: 32pt, bold
- Stat / big number: 60pt, bold, centered
- Use `\n` to separate bullet items in a single `insertTextBox` call

### Execute via MCP

Execute the generated function with:
```
mcp__gas__exec({
  scriptId: "[TARGET_SCRIPT_ID]",
  js_statement: "[FULL_FUNCTION_DEFINITION]\ncreatePresentation();"
})
```

### Error Handling

If `mcp__gas__exec` returns `success: false` or an error:
1. Print: `GAS exec failed: [error message]`
2. Offer the user two options via `AskUserQuestion`:
   - **Retry**: Fix any identified issue in the GAS code and re-execute
   - **Fall back to HTML**: Generate the reveal.js HTML file instead (proceed to Step 3A)

### Output

On success, print:
```
✅ Google Slides created: [URL]
   Open the link above to view your presentation in Google Drive.
```

---

## Slide Count Guidelines

| Count | Structure |
|---|---|
| 4–5 | Cover + 2–3 content + Closing |
| 6–8 | Cover + 1 section break + 4–5 content + Closing |
| 10–12 | Cover + 2 section breaks + 7–8 content + Closing |

Adjust proportionally for the actual slide count requested.

---

## Audience Tone Guide

| Audience | Language | Include |
|---|---|---|
| Technical | Precise, jargon OK | Code slides, architecture diagrams, implementation details |
| Executive | Plain, outcome-focused | Metrics, business impact, ROI, risk/opportunity framing |
| General | Accessible, concrete | Examples, analogies, minimal jargon, real-world context |

---

## Common Errors & Recovery

| Situation | Action |
|---|---|
| GAS OAuth error | Add `presentations` scope, prompt user to re-authorize |
| GAS exec timeout | Break `createPresentation()` into smaller batches; add one slide at a time |
| Mermaid not rendering | Check that `mermaid.initialize()` is called after `Reveal.initialize()` |
| Theme not applying | Verify theme CDN URL is correct; default to `sky` |
| User wants to change outline after generation | Offer to regenerate; re-run from Step 2 |
