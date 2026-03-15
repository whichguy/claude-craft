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
- **Theme**:
  - HTML path: One of `black`, `white`, `league`, `sky`, `moon`, `solarized`, `dracula` — default `sky`
  - Google Slides path: One of `professional`, `warm`, `minimal` — default `professional`. Auto-selected by topic (business→professional, creative→warm, technical→minimal) unless explicitly specified.
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
- `$THEME` — chosen theme (HTML: default `sky`; Google Slides: default `professional`)

---

## Step 2 — Generate & Confirm Outline

Analyze `$TOPIC` and produce a numbered slide outline matching `$COUNT` and `$AUDIENCE`.

**Outline format:**

```
## Presentation Outline — [Title]
Format: [reveal.js HTML | Google Slides]
Slides: [count]  Audience: [audience]  Theme: [theme or N/A]

1. **[Slide Title]** — [type: title | bullet | two-column | stat | code | diagram | table | image | main-point | section | closing]
   [2–3 word summary of content]

Note for Google Slides path: `code` maps to a bullet slide with monospace font (GAS has no syntax highlighting). `diagram` maps to an image slide if a public diagram URL is available, otherwise a descriptive bullet slide.
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
https://cdn.jsdelivr.net/npm/mermaid@10.9.3/dist/mermaid.min.js
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

/* Dense/compact slides: add class="compact" to <section> when a slide has 6+ bullet points */
.reveal .slides section.compact { padding: 20px 40px; }
.reveal .slides section.compact ul li { font-size: .75em; margin-bottom: .2em; line-height: 1.2; }
.reveal .slides section.compact h2 { font-size: 1.2em; margin-bottom: .3em; }
```

Add `class="compact"` to any `<section>` that has 6 or more bullet items to prevent overflow.

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

**Exception — code slides**: Content inside `<pre><code>` must be HTML-escaped (replace `<`, `>`, `&` with their entities) so the browser renders it as literal text. Do NOT add `data-noescape` to avoid the escaping requirement — always escape code content and let the browser display it verbatim.

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

### Color Themes

Select a theme based on `$THEME` (default: `professional`). Each theme is a JS object embedded in the IIFE:

| Theme | When to use | Palette |
|---|---|---|
| `professional` | Business, corporate, formal | bg=#FFFFFF, sectionBg=#1B2A4A, accent=#2563EB, titleColor=#111827, titleColorInv=#FFFFFF, bodyColor=#374151, subtitleColor=#6B7280, shapeFill=#DBEAFE |
| `warm` | Creative, marketing, friendly | bg=#FFFBF2, sectionBg=#3D2B1F, accent=#D97706, titleColor=#1C1917, titleColorInv=#FEF9EE, bodyColor=#44403C, subtitleColor=#78716C, shapeFill=#FEF3C7 |
| `minimal` | Technical, engineering, clean | bg=#FAFAFA, sectionBg=#18181B, accent=#18181B, titleColor=#18181B, titleColorInv=#FAFAFA, bodyColor=#3F3F46, subtitleColor=#71717A, shapeFill=#F4F4F5 |

All themes pass WCAG AA for text contrast. Accent colors are used only for decorative lines and text at 28pt+, never for 18pt body text.

### PredefinedLayout Mapping

All 12 PredefinedLayouts are available. Use `BLANK` for fully custom layouts with positioned elements.

| Slide Type | PredefinedLayout |
|---|---|
| Title / cover | `TITLE` |
| Bullet content | `TITLE_AND_BODY` |
| Two-column | `TITLE_AND_TWO_COLUMNS` or `BLANK` |
| Big stat / number | `BIG_NUMBER` |
| Main point / quote | `MAIN_POINT` |
| Section divider | `SECTION_HEADER` |
| One-column text (dense) | `ONE_COLUMN_TEXT` |
| Closing / next steps | `TITLE_AND_BODY` |
| Custom / image / table | `BLANK` |
| Caption overlay | `CAPTION_ONLY` |

### GAS Code Template

Generate a self-contained IIFE based on the confirmed outline. The default slide canvas is **720x405 pt** (SlidesApp uses points for all dimensional arguments). A newly created presentation via `SlidesApp.create()` has a widescreen 16:9 aspect ratio. The helpers use `left=40, width=640` to leave 40pt margins on each side.

**IIFE structure:**
```javascript
(function() {
  // === THEME ===
  var T = {
    bg: '#FFFFFF', sectionBg: '#1B2A4A', accent: '#2563EB',
    titleColor: '#111827', titleColorInv: '#FFFFFF',
    bodyColor: '#374151', subtitleColor: '#6B7280', shapeFill: '#DBEAFE'
  };

  // === CANVAS CONSTANTS ===
  var W = 720, H = 405;
  var MARGIN = 40, CONTENT_W = 640;
  var TITLE_Y = 28, TITLE_H = 60;
  var BODY_Y = 100, BODY_H = 280;

  // === PRESENTATION ===
  var pres = SlidesApp.create('TITLE_HERE');
  var slides = pres.getSlides();
  if (slides.length > 0) slides[0].remove();

  // === HELPERS ===

  function addText(slide, text, left, top, width, height, opts) {
    opts = opts || {};
    var shape = slide.insertTextBox(text, left, top, width, height);
    var ts = shape.getText().getTextStyle();
    if (opts.fontSize) ts.setFontSize(opts.fontSize);
    if (opts.bold) ts.setBold(true);
    if (opts.italic) ts.setItalic(true);
    if (opts.color) ts.setForegroundColor(opts.color);
    if (opts.font) ts.setFontFamily(opts.font);
    if (opts.align) {
      shape.getText().getParagraphs().forEach(function(p) {
        p.getRange().getParagraphStyle().setParagraphAlignment(
          SlidesApp.ParagraphAlignment[opts.align]
        );
      });
    }
    if (opts.valign) {
      shape.setContentAlignment(SlidesApp.ContentAlignment[opts.valign]);
    }
    return shape;
  }

  function styleRange(textRange, start, end, opts) {
    var ts = textRange.getRange(start, end).getTextStyle();
    if (opts.fontSize) ts.setFontSize(opts.fontSize);
    if (opts.bold) ts.setBold(true);
    if (opts.color) ts.setForegroundColor(opts.color);
    if (opts.italic) ts.setItalic(true);
  }

  function addShape(slide, type, left, top, width, height, fillColor) {
    var shape = slide.insertShape(SlidesApp.ShapeType[type], left, top, width, height);
    if (fillColor) shape.getFill().setSolidFill(fillColor);
    return shape;
  }

  function addLine(slide, x1, y1, x2, y2, color, weight) {
    var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y1, x2, y2);
    line.getLineFill().setSolidFill(color || T.accent);
    line.setWeight(weight || 3);
    return line;
  }

  function addImage(slide, url, left, top, width, height) {
    return slide.insertImage(url, left, top, width, height);
  }

  function addBulletList(shape, presetName) {
    shape.getText().getListStyle().applyListPreset(
      SlidesApp.ListPreset[presetName || 'DISC_CIRCLE_SQUARE']
    );
    return shape;
  }

  function addNotes(slide, text) {
    var shapes = slide.getNotesPage().getShapes();
    for (var i = 0; i < shapes.length; i++) {
      if (String(shapes[i].getPlaceholderType()) === 'BODY') {
        shapes[i].getText().setText(text);
        break;
      }
    }
  }

  function setBg(slide, color) {
    slide.getBackground().setSolidFill(color);
  }

  // === SLIDE BUILDERS ===

  function buildTitleSlide(title, subtitle) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.sectionBg);
    addText(s, title, MARGIN, 100, CONTENT_W, 80,
      {fontSize: 40, bold: true, color: T.titleColorInv, align: 'CENTER'});
    addLine(s, 260, 190, 460, 190, T.accent, 3);
    if (subtitle) {
      addText(s, subtitle, MARGIN, 200, CONTENT_W, 40,
        {fontSize: 20, color: T.titleColorInv, align: 'CENTER'});
    }
    addNotes(s, 'NOTES');
    return s;
  }

  function buildContentSlide(title, bullets, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var body = addText(s, bullets.join('\n'), MARGIN, BODY_Y, CONTENT_W, BODY_H,
      {fontSize: 18, color: T.bodyColor});
    addBulletList(body, 'DISC_CIRCLE_SQUARE');
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildTwoColumnSlide(title, leftBullets, rightBullets, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var colW = 305;
    var left = addText(s, leftBullets.join('\n'), MARGIN, BODY_Y, colW, BODY_H,
      {fontSize: 16, color: T.bodyColor});
    addBulletList(left, 'DISC_CIRCLE_SQUARE');
    var right = addText(s, rightBullets.join('\n'), MARGIN + colW + 30, BODY_Y, colW, BODY_H,
      {fontSize: 16, color: T.bodyColor});
    addBulletList(right, 'DISC_CIRCLE_SQUARE');
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildStatSlide(stat, context, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, stat, MARGIN, 80, CONTENT_W, 120,
      {fontSize: 72, bold: true, color: T.accent, align: 'CENTER', valign: 'MIDDLE'});
    addText(s, context, MARGIN, 220, CONTENT_W, 60,
      {fontSize: 20, color: T.bodyColor, align: 'CENTER'});
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildSectionSlide(title, subtitle, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.sectionBg);
    addText(s, title, MARGIN, 140, CONTENT_W, 80,
      {fontSize: 32, bold: true, color: T.titleColorInv, align: 'CENTER', valign: 'MIDDLE'});
    if (subtitle) {
      addText(s, subtitle, MARGIN, 230, CONTENT_W, 40,
        {fontSize: 16, color: T.titleColorInv, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildTableSlide(title, headers, rows, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    var table = s.insertTable(rows.length + 1, headers.length);
    headers.forEach(function(h, i) {
      table.getCell(0, i).getText().setText(h);
      table.getCell(0, i).getText().getTextStyle().setBold(true);
    });
    rows.forEach(function(row, r) {
      row.forEach(function(cell, c) {
        table.getCell(r + 1, c).getText().setText(String(cell));
      });
    });
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildImageSlide(title, imageUrl, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addImage(s, imageUrl, MARGIN + 70, BODY_Y, 500, 280);
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildClosingSlide(title, bullets, tagline, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.sectionBg);
    addText(s, title, MARGIN, 60, CONTENT_W, 60,
      {fontSize: 32, bold: true, color: T.titleColorInv, align: 'CENTER'});
    if (bullets && bullets.length > 0) {
      var body = addText(s, bullets.join('\n'), MARGIN, 140, CONTENT_W, 160,
        {fontSize: 18, color: T.titleColorInv});
      addBulletList(body, 'DISC_CIRCLE_SQUARE');
    }
    if (tagline) {
      addText(s, tagline, MARGIN, 330, CONTENT_W, 40,
        {fontSize: 16, italic: true, color: T.titleColorInv, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  // === BUILD SLIDES (generate calls from outline) ===
  buildTitleSlide('Presentation Title', 'Subtitle or Date');
  buildContentSlide('Topic One', ['Point A', 'Point B', 'Point C'], 'Notes...');
  // ... (one builder call per slide from the confirmed outline)
  buildClosingSlide('Thank You', ['Next step 1', 'Next step 2'], 'tagline', 'Notes...');

  return pres.getUrl();
})();
```

### Slide Type -> Builder Mapping

| Outline Slide Type | Builder Function | Key Parameters |
|---|---|---|
| Title / cover | `buildTitleSlide(title, subtitle)` | Dark bg, centered, accent divider line |
| Bullet content | `buildContentSlide(title, bullets[], notes)` | Light bg, bullet list preset |
| Two-column | `buildTwoColumnSlide(title, leftBullets[], rightBullets[], notes)` | 305pt columns, 30pt gutter |
| Big stat | `buildStatSlide(stat, context, notes)` | 72pt centered stat, accent color |
| Section break | `buildSectionSlide(title, subtitle?, notes?)` | Dark bg, centered |
| Table / data | `buildTableSlide(title, headers[], rows[][], notes)` | Auto-positioned table |
| Image | `buildImageSlide(title, imageUrl, notes)` | Public URL only, centered |
| Closing | `buildClosingSlide(title, bullets[]?, tagline?, notes)` | Dark bg, optional bullets |
| Custom | Use raw helpers (`addText`, `addShape`, `addLine`, etc.) | Full flexibility |

For slides not matching any builder, use the raw helpers directly.

### Styling Conventions

- **Cover title**: 40pt, bold, `titleColorInv` on dark bg
- **Cover subtitle**: 20pt, regular, `titleColorInv` (on dark cover bg)
- **Title**: 30pt, bold, `titleColor`
- **Body / bullets**: 18pt, `bodyColor` — max 5 bullets per content slide
- **Section headers**: 32pt, bold, `titleColorInv` on dark bg (intentionally smaller than cover)
- **Stat / big number**: 72pt, bold, `accent`, centered
- **Tagline / caption**: 16pt, italic, `titleColorInv` (on dark closing/section bg)
- **Divider lines**: 3pt, `accent` color at y=90 (always saturated accent, never gray)
- **Bullet lists**: Use `applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE)` — never raw `\n`-separated text without bullet preset
- **Two-column**: 305pt columns each with 30pt gutter (on 640pt content width)
- **Speaker notes**: **Mandatory** on every slide via `addNotes()` — 1-2 sentences of talking points

### Gotchas & Limitations

| Issue | Detail | Workaround |
|---|---|---|
| **Canvas size** | 720x405 pt (NOT 960x540) | All coords in this template calibrated for 720x405 |
| **insertTable position** | `insertTable(rows, cols)` auto-positions; cannot specify left/top/width/height | Accept default position; adjust manually in Slides if needed |
| **Images: public URLs only** | Private/authenticated URLs silently fail | Use `DriveApp.getFileById(id).getBlob()` for private images (**requires `drive` scope** — users must re-authorize) |
| **Images: format limits** | PNG, JPEG, GIF only — no SVG, WebP | Convert to PNG before inserting |
| **Images: size limits** | 50MB max, 25 megapixel max, URL max 2KB | Resize large images before inserting |
| **replaceAllText()** | Cannot change formatting; throws if placeholder missing on ANY slide; skips Groups | Use per-slide shape iteration with existence check before replacing |
| **No diagrams** | SlidesApp has no diagram primitives | Use `insertImage` with a pre-rendered diagram URL, or approximate with shapes |
| **No syntax highlighting** | No code formatting support | Use monospace font (`setFontFamily('Roboto Mono')`) for code slides |
| **List presets** | Only 15 preset options; no custom bullet characters | DISC_CIRCLE_SQUARE for bullets, DIGIT_ALPHA_ROMAN for numbered |
| **Performance** | ~0.4s per slide; 3 styled slides in 1.3s | Single IIFE handles ~8-10 slides with minified helpers (~3.5KB js_statement limit). For 10+ slides, split into two calls: first creates pres + returns ID, second opens by ID + appends remaining slides |

### Execute via MCP

The entire generated code is a self-contained IIFE — no separate function definition and call. It runs immediately and returns the presentation URL:
```
mcp__gas__exec({
  scriptId: "[TARGET_SCRIPT_ID]",
  js_statement: "(function() { ... return pres.getUrl(); })();"
})
```

**Payload limit**: The GAS exec API has a ~3.5KB js_statement limit. Minify helper names (e.g., `addText` → `at`, `addLine` → `al`) to fit more slides. For decks over ~8 slides, split into two calls:
1. **Call 1**: Create presentation + slides 1-N/2 → return `{id: pres.getId(), url: pres.getUrl()}`
2. **Call 2**: `SlidesApp.openById(id)` + append remaining slides → return `pres.getUrl()`

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
| GAS exec timeout | Split IIFE into two calls: first creates presentation + returns ID, second opens by ID + adds remaining slides |
| Image URL fails silently | Verify URL is publicly accessible and under 2KB; for private images use `DriveApp.getFileById().getBlob()` (requires `drive` scope) |
| Wrong canvas coordinates | Verify 720x405 pt canvas; recalculate from MARGIN=40, CONTENT_W=640 |
| Mermaid not rendering | Check that `mermaid.initialize()` is called after `Reveal.initialize()` |
| Theme not applying | Verify theme CDN URL is correct; default to `sky` |
| User wants to change outline after generation | Offer to regenerate; re-run from Step 2 |
