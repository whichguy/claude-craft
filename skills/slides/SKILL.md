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

Follow all steps in order. Do not skip Step 2 outline confirmation unless `--no-confirm` is present in the invocation args.

---

## Step 0 — Read Existing Deck (Optional)

*Skip this step if the user wants a new presentation from scratch. Execute this step when the user provides an existing presentation ID or URL and wants to modify, evaluate, or extend an existing deck.*

**Triggers:** User says "modify these slides", "update this deck", "improve this presentation", "add slides to [URL]", "evaluate this deck", "what's wrong with this deck"

### Extract Deck Structure

Run this IIFE via `mcp__mcp-gas-deploy__exec`, replacing `PRES_ID` with the actual presentation ID (extract from URL if needed — the ID is the long string after `/d/` in Google Slides URLs):

```javascript
return (function() {
  var p = SlidesApp.openById('PRES_ID');
  var allSlides = p.getSlides();
  var slides = allSlides.slice(0, 50);
  var index = [];
  slides.forEach(function(sl, i) {
    var entry = {slide: i+1, shapes: [], texts: [], bg: null, notes: ''};
    try { entry.bg = sl.getBackground().getSolidFill().getColor().asRgbColor().asHexString(); } catch(e) { entry.bg = 'none/gradient'; }
    sl.getPageElements().forEach(function(el) {
      var type = String(el.getPageElementType());
      var info = {type: type, left: el.getLeft(), top: el.getTop(), w: el.getWidth(), h: el.getHeight()};
      if (type === 'SHAPE') {
        var sh = el.asShape();
        info.shapeType = String(sh.getShapeType());
        try { info.fill = sh.getFill().getSolidFill().getColor().asRgbColor().asHexString(); } catch(e) { info.fill = 'none'; }
        var txt = sh.getText().asString().trim();
        if (txt) { info.text = txt.substring(0, 100); entry.texts.push(txt.substring(0, 200)); }
      } else if (type === 'LINE') {
        info.lineType = 'line';
      } else if (type === 'IMAGE') {
        info.imageType = 'image';
      } else if (type === 'TABLE') {
        var tbl = el.asTable();
        info.rows = tbl.getNumRows();
        info.cols = tbl.getNumColumns();
      }
      entry.shapes.push(info);
    });
    try {
      sl.getNotesPage().getShapes().forEach(function(ns) {
        if (String(ns.getPlaceholderType()) === 'BODY') {
          entry.notes = ns.getText().asString().trim().substring(0, 200);
        }
      });
    } catch(e) {}
    index.push(entry);
  });
  var cs = p.getMasters()[0].getColorScheme();
  var tc = {};
  ['DARK1','LIGHT1','DARK2','LIGHT2','ACCENT1','ACCENT2','ACCENT3','ACCENT4','ACCENT5','ACCENT6'].forEach(function(n) {
    tc[n] = cs.getConcreteColor(SlidesApp.ThemeColorType[n]).asRgbColor().asHexString();
  });
  var fonts = {h:null, b:null};
  slides.slice(0,5).forEach(function(sl) {
    sl.getShapes().forEach(function(sh) {
      sh.getText().getRuns().forEach(function(r) {
        var f = r.getTextStyle().getFontFamily(), fs = r.getTextStyle().getFontSize();
        if(f) { if(fs>=24 && !fonts.h) fonts.h=f; if(fs<24 && fs>=12 && !fonts.b) fonts.b=f; }
      });
    });
  });
  return JSON.stringify({
    title: p.getName(),
    slideCount: allSlides.length,
    slidesRead: slides.length,
    theme: {colors: tc, fonts: fonts},
    index: index
  });
})()
```

**Note:** Capped at 50 slides to stay within GAS 6-min exec timeout. For decks >50 slides, run multiple calls with `allSlides.slice(50, 100)`, etc.

### Parse Output into Context Variables

From the JSON result, derive:
- `$DECK_TITLE` — `title` field
- `$DECK_INDEX` — `index` array (per-slide: slide number, text content, shape types, positions, bg color, notes)
- `$DECK_THEME` — `theme` object (colors + fonts) — feeds into custom theme flow (set `$THEME = "custom"`)
- `$DECK_ARC` — story arc classification (derived by LLM from `$DECK_INDEX`, NOT produced by the IIFE)

### Slide Type Classification Heuristics

Apply these to `$DECK_INDEX` to classify each existing slide:

| Pattern in extracted data | Inferred type |
|---|---|
| 1 large-font TEXT_BOX on dark bg, no bullets | `hero` |
| 3 equal-width ROUND_RECTANGLE shapes side by side | `triptych` |
| Large italic text + small right-aligned attribution + vertical LINE | `quote` |
| ELLIPSE shapes with connecting horizontal LINEs + labels | `timeline` |
| Single ROUND_RECTANGLE with bordered box + centered text | `takeaway` |
| 1 very large number/stat + context line | `stat` |
| Multiple bullet items in single text box | `content` |
| 2 text boxes side by side (similar width) | `two-column` |
| TABLE element present | `table` |
| Dark bg + large centered title | `title` or `section` |
| Grid of ROUND_RECTANGLE cards with label/value/trend text | `kpi-dashboard` |
| Row of ELLIPSE icons with values and labels below | `kpi-strip` |
| IMAGE element (non-decorative) with chart appearance | `chart` |
| Horizontal RECTANGLE bars with proportional widths + labels | `drill-down` |
| Two-half layout with LINE divider + ELLIPSE arrow center | `before-after` |
| Vertical RECTANGLE bars (one highlighted red) + "Root Cause" text | `anomaly` |

### Deck Diagnosis

After classification, perform these analyses:

1. **Story arc gap detection**: Classify each slide into arc segments (Hook/Problem/Solution/Proof/Vision/Close). Flag gaps: "No hook slide", "3 consecutive content slides in Problem — needs variety", "Close uses generic CTA instead of specific action"
2. **Billboard test on existing slides**: Run word count limits from Step 1B against extracted text. Flag violations: "Slide 4 has 68 words — exceeds 35-word limit for content slides"
3. **Layout variety score**: Count distinct slide types. Compare to targets (10-slide deck = 5+ types). Flag monotonous decks.
4. **Specific improvement recommendations**: Produce actionable suggestions: "Convert slide 5 from content to triptych (3 parallel items detected)", "Insert hero slide before slide 3 to strengthen hook"

### Integration with Subsequent Steps

- Step 1B content analysis uses `$DECK_ARC` as starting point
- Step 2 outline shows existing slides alongside proposed changes (marked `[existing]` vs `[new]` vs `[replace]`)
- Theme auto-set to `custom` using `$DECK_THEME` colors/fonts
- **Layout consistency**: Extract dominant title Y-position from existing deck (most common `top` value for large-font text shapes). If it differs from `TITLE_Y=28`, note the offset so new slides can be adjusted to match

### Modification Modes

Each mode uses a different IIFE pattern:

| Mode | Pattern | When to use |
|---|---|---|
| **append** | `SlidesApp.openById(id)` + append via builders | Adding new slides to end |
| **insert** | `openById` + `insertSlide(index, layout)` at position, then build | Adding slides at specific position |
| **replace** | `openById` + `getSlides()[n].remove()` + insert new at same position | Rebuilding a specific slide |
| **restyle** | `openById` + iterate shapes, extract text, remove all, rebuild with different builder | Changing slide type while preserving content |

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
  - **Custom theme from existing deck**: If user provides a presentation ID or URL (e.g., "match the style of [URL]"), set `$THEME = "custom"` and `$THEME_SOURCE_ID = [extracted presentation ID]`.
- **Story arc** (`$ARC`): `product-launch | org-report | auto` — default `auto`
  - `product-launch`: Connected narrative (Salesforce/Apple pattern), metrics woven into story
  - `org-report`: McKinsey Pyramid (insight-first titles, charts prove claims)
  - `auto`: Existing 4-framework heuristic from Step 1B (unchanged)
  - Auto-detected from topic keywords: "launch", "release", "product" → `product-launch`; "review", "report", "quarterly", "Q1-Q4" → `org-report`
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
- `$ARC` — story arc template (`product-launch`, `org-report`, or `auto`)

---

## Step 1B — Content Analysis

**Skip this step** if `$TOPIC` is already structured (bullet points, numbered list, clear headers). Proceed directly to Step 2.

### Narrative Framework Selection

Classify the input into one of these frameworks to guide story structure:

| Framework | When to use | Structure |
|---|---|---|
| **Raskin 5-Step** (enterprise default) | Sales pitch, product story, persuasive | World Shift → Winners/Losers → Promised Land → Magic Gifts → Proof |
| **SCQA** (McKinsey) | Problem + solution, analytical | Situation → Complication → Question → Answer |
| **Hero's Journey** (customer story) | Case study, transformation | Challenge → Guide → Solution → Transformation |
| **Linear** (fallback) | Informational, how-to, no clear arc | Intro → Body sections → Conclusion |

**Key enterprise principle:** The customer is the hero, not the product. The product/company is the "guide" (StoryBrand framework). Frame problems as the customer's challenge, solutions as the customer's transformation.

### Content Element Extraction

Classify each extracted content element into a slide type using this decision tree:

```
1. Single powerful statement (<=10 words)? → `hero`
2. Statistic, percentage, large number? → `stat`
3. Direct quote with attribution? → `quote`
4. Sequential process (3-5 steps)? → `timeline`
5. Exactly 3 parallel items (pillars, features)? → `triptych`
6. Before/after or two-side comparison? → `before-after`
7. 3-6 KPI metrics with trends (+/-/→)? → `kpi-dashboard`
8. 3-5 inline metrics (lighter than dashboard)? → `kpi-strip`
9. Ranked items by team/category with values? → `drill-down`
10. Deviation or anomaly with root cause? → `anomaly`
11. Trend data (time series, growth)? → `chart` (requires QuickChart.io)
12. Tabular data (3+ rows)? → `table`
13. Key conclusion or takeaway? → `takeaway`
14. Default remaining points → `content` (max 5 bullets)
```

### Enterprise Story Arc Pacing

| Deck segment | Slides | Recommended types | Enterprise purpose |
|---|---|---|---|
| **Hook** | 1-2 | `title` → `hero` | Name the world shift, grab attention |
| **Problem** | 1-2 | `content`, `stat`, `two-column`, `before-after` | Frame customer's challenge |
| **Solution** | 2-3 | `triptych`, `content`, `timeline`, `kpi-strip` | Present approach (customer as hero) |
| **Proof** | 1-2 | `stat`, `quote`, `chart`, `kpi-dashboard`, `drill-down` | Social proof, metrics, testimonials |
| **Vision** | 1 | `hero` or `takeaway` | Promised land / transformation |
| **Close** | 1 | `closing` | Specific next steps (not vague CTA) |

For <=6 slides: combine Problem+Solution into 2-3 slides. For 10+: expand Proof with additional evidence.

### Billboard Test

Before finalizing any slide content, apply the billboard test: can the main message be read in 3 seconds? If not, shorten. Enterprise word limits:

| Slide type | Max words (content only) | Max items |
|---|---|---|
| hero | 10 | 1 message |
| stat | 5 (stat) + 15 (context) | 1 stat |
| quote | 40 (quote) + 10 (attribution) | 1 quote |
| triptych | 60 (3 × 20) | 3 cards |
| timeline | 20 (5 × 4) | 3-5 steps |
| takeaway | 20 | 1 message |
| content | 35 (5 × 7) | 5 bullets |
| two-column | 42 (2 × 3 × 7) | 3+3 bullets |
| kpi-dashboard | 3 per card (label + value + trend) | 2-6 cards |
| kpi-strip | 2 per metric (value + label) | 3-5 metrics |
| chart | 5 (title only — data is visual) | 1 chart |
| drill-down | 2 per bar (label + value) | 3-8 bars |
| before-after | 42 (2 × 3 × 7) | 3+3 bullets per side |
| anomaly | 3 per bar + 21 root cause (3 × 7) | 3-6 bars + 2-3 bullets |

**Output:** Record `$CONTENT_MAP` — ordered list of `{slideType, title, content, notes}` that feeds Step 2.

### Story Arc Templates

When `$ARC` is not `auto`, override `$CONTENT_MAP` with the arc template below. Map user content to template positions; generate placeholder content for unfilled slots.

#### `product-launch` Arc — Connected Narrative (Salesforce/Apple Pattern)

Each title reads as a paragraph in a connected story. Metrics woven into narrative, not isolated.

| Position | Type | Intent | Design Pattern |
|----------|------|--------|----------------|
| 1 | title | Product + tagline | Dark bg, centered |
| 2 | hero | World shift (why now) | Single statement, 42pt |
| 3 | content | Customer pain | 3-4 bullets, light bg |
| 4 | before-after | Legacy vs modern | Vertical split comparison |
| 5 | triptych | Solution pillars | 3 cards |
| 6 | stat | Proof metric | 72pt number |
| 7 | image | Product visual | Full-bleed or centered |
| 8 | quote | Customer testimonial | Accent bar + italic |
| 9 | kpi-strip | Key metrics row | 3-5 inline metrics |
| 10 | takeaway | Core promise | Boxed statement |
| 11 | closing | CTA + next steps | Dark bg |

#### `org-report` Arc — McKinsey Pyramid (Insight-First)

Titles state the insight; charts/data prove the claim. Summary → drill-down → anomaly → action.

| Position | Type | Intent | Design Pattern |
|----------|------|--------|----------------|
| 1 | title | Report + period | "Q2 2026 Engineering Review" |
| 2 | kpi-dashboard | Executive summary | 4-6 KPI cards |
| 3 | chart | Primary trend | QuickChart line/bar |
| 4 | drill-down | By team/leader | Horizontal bars |
| 5 | chart | Secondary metric | Quality/velocity trend |
| 6 | anomaly | Deviation highlight | Red bar + root cause |
| 7 | two-column | This Q vs last Q | Side-by-side bullets |
| 8 | stat | Headline achievement | Big number |
| 9 | takeaway | Key insight | Boxed statement |
| 10 | closing | Next quarter actions | Action items |

#### Arc Application Rules

1. **Content mapping**: Match user's content elements to template positions by intent (not type). If user provides a customer quote, it maps to the `quote` position regardless of where it appears in their notes.
2. **Flexible count**: Arc templates define the ideal sequence. For shorter decks (6-8 slides), compress: merge positions 3+4, drop position 7 (image), merge 9+10. For longer decks (12+), expand Proof section.
3. **Auto-detect**: When `$ARC == auto`, check topic keywords. If no match, use the 4-framework heuristic from Step 1B.
4. **Override**: User can always override arc choice in outline confirmation (Step 2).

---

## Step 2 — Generate & Confirm Outline

Use `$CONTENT_MAP` from Step 1B if available; otherwise analyze `$TOPIC` directly to produce a numbered slide outline matching `$COUNT` and `$AUDIENCE`.

**Outline format:**

```
## Presentation Outline — [Title]
Format: [reveal.js HTML | Google Slides]
Slides: [count]  Audience: [audience]  Theme: [theme or N/A]

1. **[Slide Title]** — [type: title | bullet | two-column | stat | hero | triptych | quote | timeline | takeaway | kpi-dashboard | kpi-strip | chart | drill-down | before-after | anomaly | code | diagram | table | image | section | closing]
   [2–3 word summary of content]

Note for Google Slides path: `code` maps to a bullet slide with monospace font (GAS has no syntax highlighting). `diagram` maps to an image slide if a public diagram URL is available, otherwise a descriptive bullet slide. All enterprise types map to GAS builders: `hero` → buildHeroSlide, `triptych` → buildTriptychSlide, `quote` → buildQuoteSlide, `timeline` → buildTimelineSlide, `takeaway` → buildTakeawaySlide, `kpi-dashboard` → buildKpiDashboardSlide, `kpi-strip` → buildKpiStripSlide, `chart` → buildChartSlide, `drill-down` → buildDrillDownSlide, `before-after` → buildBeforeAfterSlide, `anomaly` → buildAnomalySlide.
2. ...
```

Include:
- A title/cover slide (slide 1)
- A closing/next-steps slide (last slide)
- Section breaks for decks over 8 slides
- Code slides only if `$AUDIENCE == technical`
- At most one diagram slide (use Mermaid for HTML path)
- **Layout rotation**: Never use the same slide type for two consecutive slides. If content map produces adjacent duplicates, convert the second to a different type or insert a `section` break. A 10-slide deck should use >=5 distinct types.
- **Slide titles**: Use the Pyramid Principle — the title IS the main point (e.g., "Reduce Deployment Time 60%"), not a generic label ("Our Solution"). Every title should be a complete assertion.

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

Before executing GAS code, check that the target GAS project's `appsscript.json` contains the required scopes:
- `https://www.googleapis.com/auth/presentations` — always required
- `https://www.googleapis.com/auth/script.external_request` — required if using `chart` slide type (QuickChart.io)
- `https://www.googleapis.com/auth/drive` — required if using Drive image IDs

Use `mcp__mcp-gas-deploy__pull` to fetch the project locally, then read `appsscript.json` from the local directory (`~/gas-projects/<scriptId>/appsscript.json`). If the scope is absent:
1. Edit the local file to add it to the `oauthScopes` array, then `mcp__mcp-gas-deploy__push` to sync
2. Inform the user: "Added `presentations` scope to appsscript.json. You will need to re-authorize the script once (open the script editor and run any function to trigger the OAuth flow)."

**Default target script**: SHEETS_CHAT (`1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`)

If the user specifies a different scriptId in the invocation args, use that instead.

### Color Themes

Select a theme based on `$THEME` (default: `professional`). Each theme is a JS object embedded in the IIFE:

Each theme defines 16 properties — 8 core + 8 extended (surfaces, status, structure, data viz, disabled):

| Theme | When to use | Core Palette | Extended Tokens |
|---|---|---|---|
| `professional` | Business, corporate, formal | bg=#FFFFFF, sectionBg=#1B2A4A, accent=#2563EB, titleColor=#111827, titleColorInv=#FFFFFF, bodyColor=#374151, subtitleColor=#6B7280, shapeFill=#DBEAFE | surfaceColor=#F3F4F6, onSurface=#1F2937, statusSuccess=#059669, statusWarning=#d97706, statusError=#dc2626, dividerColor=#E5E7EB, chartPalette=[#2563EB,#7c3aed,#dc2626,#f59e0b,#10b981], disabledColor=#9ca3af |
| `warm` | Creative, marketing, friendly | bg=#FFFBF2, sectionBg=#3D2B1F, accent=#D97706, titleColor=#1C1917, titleColorInv=#FEF9EE, bodyColor=#44403C, subtitleColor=#78716C, shapeFill=#FEF3C7 | surfaceColor=#FFF7ED, onSurface=#292524, statusSuccess=#059669, statusWarning=#d97706, statusError=#dc2626, dividerColor=#E7E5E4, chartPalette=[#D97706,#b45309,#dc2626,#059669,#7c3aed], disabledColor=#a8a29e |
| `minimal` | Technical, engineering, clean | bg=#FAFAFA, sectionBg=#18181B, accent=#18181B, titleColor=#18181B, titleColorInv=#FAFAFA, bodyColor=#3F3F46, subtitleColor=#71717A, shapeFill=#F4F4F5 | surfaceColor=#F4F4F5, onSurface=#27272A, statusSuccess=#059669, statusWarning=#d97706, statusError=#dc2626, dividerColor=#E4E4E7, chartPalette=[#18181B,#3F3F46,#71717A,#A1A1AA,#D4D4D8], disabledColor=#a1a1aa |

All themes pass WCAG AA for text contrast. Accent colors are used only for decorative lines and text at 28pt+, never for 18pt body text. Use `onSurface` (not accent) for text on `shapeFill` backgrounds to ensure 4.5:1 contrast.

### Theme Extraction (Custom Theme)

When `$THEME == "custom"`, run this extraction IIFE via `mcp__mcp-gas-deploy__exec` BEFORE generating slides. Replace `SOURCE_ID` with `$THEME_SOURCE_ID`:

```javascript
return (function() {
  var p = SlidesApp.openById('SOURCE_ID');
  var cs = p.getMasters()[0].getColorScheme();
  var tc = {};
  ['DARK1','LIGHT1','DARK2','LIGHT2','ACCENT1','ACCENT2','ACCENT3',
   'ACCENT4','ACCENT5','ACCENT6'].forEach(function(n) {
    tc[n] = cs.getConcreteColor(SlidesApp.ThemeColorType[n]).asRgbColor().asHexString();
  });
  var slides = p.getSlides(), bg1='', bg2='';
  try { bg1 = slides[0].getBackground().getSolidFill().getColor().asRgbColor().asHexString(); } catch(e){}
  try { bg2 = slides.length>1 ? slides[1].getBackground().getSolidFill().getColor().asRgbColor().asHexString() : bg1; } catch(e){}
  var fonts = {h:null, b:null};
  slides.slice(0,3).forEach(function(sl) {
    sl.getShapes().forEach(function(sh) {
      sh.getText().getRuns().forEach(function(r) {
        var f=r.getTextStyle().getFontFamily(), fs=r.getTextStyle().getFontSize();
        if(f) { if(fs>=24 && !fonts.h) fonts.h=f; if(fs<24 && fs>=12 && !fonts.b) fonts.b=f; }
      });
    });
  });
  return JSON.stringify({tc:tc, bg:{t:bg1,c:bg2}, fonts:fonts});
})()
```

Map the extraction result to the T object:

| T property | Source | Fallback |
|---|---|---|
| bg | bg.c (content bg) | '#FFFFFF' |
| sectionBg | tc.DARK1 | '#1B2A4A' |
| accent | tc.ACCENT1 | '#2563EB' |
| titleColor | tc.DARK1 | '#111827' |
| titleColorInv | tc.LIGHT1 | '#FFFFFF' |
| bodyColor | tc.DARK2 | '#374151' |
| shapeFill | lighten(tc.ACCENT1, 80%) | '#DBEAFE' |
| surfaceColor | tc.LIGHT2 | '#F3F4F6' |
| onSurface | darken(tc.DARK2, 20%) | '#1F2937' |
| statusSuccess | (hardcode safe) | '#059669' |
| statusWarning | (hardcode safe) | '#d97706' |
| statusError | (hardcode safe) | '#dc2626' |
| dividerColor | tc.DARK2 lightened to 10% opacity | '#E5E7EB' |
| chartPalette | [tc.ACCENT2, tc.ACCENT3, tc.ACCENT4, tc.ACCENT5, tc.ACCENT6] | ['#2563EB','#7c3aed','#dc2626','#f59e0b','#10b981'] |
| disabledColor | lighten(tc.DARK2, 60%) | '#9ca3af' |

**Status colors**: Always use hardcoded safe defaults (green/amber/red). Do not derive from theme — status semantics must be universal.

If `fonts.h` is detected, add `{font: fonts.h}` to title `addText` opts. Same for `fonts.b` → body text opts.

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
    // Core (8)
    bg: '#FFFFFF', sectionBg: '#1B2A4A', accent: '#2563EB',
    titleColor: '#111827', titleColorInv: '#FFFFFF',
    bodyColor: '#374151', subtitleColor: '#6B7280', shapeFill: '#DBEAFE',
    // Surfaces (2)
    surfaceColor: '#F3F4F6', onSurface: '#1F2937',
    // Semantic Status (3)
    statusSuccess: '#059669', statusWarning: '#d97706', statusError: '#dc2626',
    // Structure (1)
    dividerColor: '#E5E7EB',
    // Data Viz (1 array)
    chartPalette: ['#2563EB','#7c3aed','#dc2626','#f59e0b','#10b981'],
    // Disabled (1)
    disabledColor: '#9ca3af'
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

  function addImage(slide, imageSource, left, top, width, height) {
    // Accepts public URL string OR Drive file ID (20+ char alphanumeric)
    var img = String(imageSource).match(/^[a-zA-Z0-9_-]{20,}$/)
      ? DriveApp.getFileById(imageSource) : imageSource;
    return slide.insertImage(img, left, top, width, height);
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

  // === INFOGRAPHIC PRIMITIVES ===
  // Reusable shape helpers for data-rich slides (KPI cards, charts, dashboards)

  function progressBar(slide, x, y, w, h, pct, color) {
    addShape(slide, 'ROUND_RECTANGLE', x, y, w, h, T.dividerColor);
    if (pct > 0) addShape(slide, 'ROUND_RECTANGLE', x, y, w * (pct / 100), h, color || T.accent);
  }

  function metricCard(slide, x, y, w, h, label, value, trend) {
    var card = addShape(slide, 'ROUND_RECTANGLE', x, y, w, h, T.surfaceColor);
    card.getFill().setSolidFill(T.surfaceColor, 0.9);
    addText(slide, label, x + 10, y + 10, w - 20, 20,
      {fontSize: 12, color: T.subtitleColor, align: 'CENTER'});
    addText(slide, String(value), x + 10, y + 35, w - 20, 45,
      {fontSize: 36, bold: true, color: T.accent, align: 'CENTER', valign: 'MIDDLE'});
    if (trend) {
      var tColor = String(trend).charAt(0) === '+' ? T.statusSuccess
        : String(trend).charAt(0) === '-' ? T.statusError : T.subtitleColor;
      addText(slide, String(trend), x + 10, y + h - 30, w - 20, 20,
        {fontSize: 14, color: tColor, align: 'CENTER'});
    }
  }

  function hBar(slide, x, y, w, h, value, maxVal, color, label) {
    addShape(slide, 'RECTANGLE', x, y, w, h, T.dividerColor);
    var barW = maxVal > 0 ? w * (value / maxVal) : 0;
    if (barW > 0) addShape(slide, 'RECTANGLE', x, y, barW, h, color || T.accent);
    if (label) addText(slide, label, x - 120, y, 110, h,
      {fontSize: 14, color: T.bodyColor, align: 'END', valign: 'MIDDLE'});
    addText(slide, String(value), x + w + 10, y, 60, h,
      {fontSize: 16, bold: true, color: T.onSurface, valign: 'MIDDLE'});
  }

  function statusDot(slide, x, y, status) {
    var color = status === 'success' ? T.statusSuccess
      : status === 'warning' ? T.statusWarning
      : status === 'error' ? T.statusError : T.disabledColor;
    addShape(slide, 'ELLIPSE', x, y, 12, 12, color);
  }

  // === SLIDE BUILDERS ===

  function buildTitleSlide(title, subtitle, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.sectionBg);
    addText(s, title, MARGIN, 100, CONTENT_W, 80,
      {fontSize: 40, bold: true, color: T.titleColorInv, align: 'CENTER'});
    addLine(s, 260, 190, 460, 190, T.accent, 3);
    if (subtitle) {
      addText(s, subtitle, MARGIN, 200, CONTENT_W, 40,
        {fontSize: 20, color: T.titleColorInv, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
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

  // === ENTERPRISE BUILDERS ===
  // PAYLOAD RULE: Each exec call must include ONLY the builders it invokes.
  // Budget: helpers (~1.6KB) + 4-5 builders (~200-450B each) + invocations.
  // Never include all 13 builders in one call.

  function buildHeroSlide(message, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.sectionBg);
    addText(s, message, MARGIN, 120, CONTENT_W, 160,
      {fontSize: 42, bold: true, color: T.titleColorInv, align: 'CENTER', valign: 'MIDDLE'});
    addLine(s, 260, 290, 460, 290, T.accent, 3);
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildTriptychSlide(title, items, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var cardW = 193, cardH = 250, gutter = 30.5, cardY = 110;
    for (var i = 0; i < 3; i++) {
      var cx = MARGIN + i * (cardW + gutter);
      var card = addShape(s, 'ROUND_RECTANGLE', cx, cardY, cardW, cardH, T.shapeFill);
      card.getBorder().getLineFill().setSolidFill(T.shapeFill);
      addText(s, items[i].t, cx + 10, cardY + 20, cardW - 20, 40,
        {fontSize: 16, bold: true, color: T.titleColor, align: 'CENTER'});
      addText(s, items[i].d, cx + 10, cardY + 70, cardW - 20, 160,
        {fontSize: 13, color: T.bodyColor, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildQuoteSlide(quote, attribution, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addLine(s, MARGIN, 80, MARGIN, 280, T.accent, 4);
    addText(s, quote, MARGIN + 20, 90, CONTENT_W - 40, 160,
      {fontSize: 24, italic: true, color: T.titleColor});
    addText(s, '\u2014 ' + attribution, MARGIN + 20, 260, CONTENT_W - 40, 40,
      {fontSize: 16, color: T.subtitleColor, align: 'END'});
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildTimelineSlide(title, steps, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var n = steps.length, d = 60;
    var gap = n > 1 ? (CONTENT_W - n * d) / (n - 1) : 0;
    var cy = 210;
    for (var i = 0; i < n; i++) {
      var cx = MARGIN + i * (d + gap);
      if (i < n - 1) addLine(s, cx + d, cy + d/2, cx + d + gap, cy + d/2, T.accent, 2);
      var circle = addShape(s, 'ELLIPSE', cx, cy, d, d, T.shapeFill);
      circle.getBorder().getLineFill().setSolidFill(T.accent);
      circle.getBorder().setWeight(2);
      addText(s, String(i + 1), cx, cy, d, d,
        {fontSize: 20, bold: true, color: T.accent, align: 'CENTER', valign: 'MIDDLE'});
      addText(s, steps[i], cx - 10, cy + d + 10, d + 20, 60,
        {fontSize: 12, color: T.bodyColor, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildTakeawaySlide(message, notes) {
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    var box = addShape(s, 'ROUND_RECTANGLE', 100, 120, 520, 160, T.shapeFill);
    box.getBorder().getLineFill().setSolidFill(T.accent);
    box.getBorder().setWeight(2);
    addText(s, message, 120, 150, 480, 100,
      {fontSize: 22, bold: true, color: T.titleColor, align: 'CENTER', valign: 'MIDDLE'});
    if (notes) addNotes(s, notes);
    return s;
  }

  // --- NEW BUILDERS (Phase 3) ---

  function buildKpiDashboardSlide(title, kpis, notes) {
    // kpis: [{label, value, trend}] — 2-6 items
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var n = kpis.length, cols = n <= 4 ? 2 : 3;
    var rows = Math.ceil(n / cols), gap = 20;
    var cW = (CONTENT_W - (cols - 1) * gap) / cols, cH = 140;
    for (var i = 0; i < n; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var cx = MARGIN + col * (cW + gap);
      var cy = 110 + row * (cH + gap);
      metricCard(s, cx, cy, cW, cH, kpis[i].label, kpis[i].value, kpis[i].trend);
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildKpiStripSlide(title, metrics, notes) {
    // metrics: [{icon, value, label}] — 3-5 items
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var n = metrics.length, gap = 20;
    var itemW = (CONTENT_W - (n - 1) * gap) / n;
    for (var i = 0; i < n; i++) {
      var mx = MARGIN + i * (itemW + gap);
      var my = 180;
      addShape(s, 'ELLIPSE', mx + (itemW - 40) / 2, my, 40, 40, T.surfaceColor);
      addText(s, metrics[i].icon || '\u2022', mx + (itemW - 40) / 2, my, 40, 40,
        {fontSize: 18, color: T.accent, align: 'CENTER', valign: 'MIDDLE'});
      addText(s, String(metrics[i].value), mx, my + 50, itemW, 35,
        {fontSize: 28, bold: true, color: T.onSurface, align: 'CENTER'});
      addText(s, metrics[i].label, mx, my + 85, itemW, 25,
        {fontSize: 12, color: T.subtitleColor, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildChartSlide(title, chartConfig, notes) {
    // chartConfig: Chart.js config object for QuickChart.io
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var blob = null;
    try {
      var json = JSON.stringify(chartConfig);
      if (json.length > 2000) {
        blob = UrlFetchApp.fetch('https://quickchart.io/chart', {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({width: 600, height: 300, backgroundColor: 'white', chart: chartConfig})
        }).getBlob();
      } else {
        var url = 'https://quickchart.io/chart?c=' + encodeURIComponent(json)
          + '&w=600&h=300&bkg=white&devicePixelRatio=1';
        blob = UrlFetchApp.fetch(url).getBlob();
      }
    } catch(e) { blob = null; }
    if (blob) {
      s.insertImage(blob, MARGIN + 20, 100, 600, 280);
    } else {
      addText(s, '[Chart: data visualization would appear here]', MARGIN, 180, CONTENT_W, 60,
        {fontSize: 18, italic: true, color: T.subtitleColor, align: 'CENTER'});
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildDrillDownSlide(title, items, notes) {
    // items: [{label, value, max?}] — up to 8 items
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var maxVal = 0;
    items.forEach(function(it) { if (it.value > maxVal) maxVal = it.value; });
    var barH = 22, spacing = 30, startY = 110;
    var barX = MARGIN + 130, maxBarW = CONTENT_W - 200;
    for (var i = 0; i < Math.min(items.length, 8); i++) {
      var y = startY + i * spacing;
      var pct = maxVal > 0 ? items[i].value / maxVal : 0;
      var color = pct > 0.8 ? T.statusSuccess : pct > 0.5 ? T.statusWarning : T.statusError;
      hBar(s, barX, y, maxBarW, barH, items[i].value, maxVal, color, items[i].label);
    }
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildBeforeAfterSlide(title, before, after, notes) {
    // before: {label, bullets[]}, after: {label, bullets[]}
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    // Left half (before)
    addShape(s, 'RECTANGLE', 0, 100, 350, 305, T.surfaceColor);
    addText(s, before.label || 'Before', 20, 110, 310, 30,
      {fontSize: 20, bold: true, color: T.onSurface, align: 'CENTER'});
    var lb = addText(s, before.bullets.join('\n'), 20, 150, 310, 240,
      {fontSize: 14, color: T.bodyColor});
    addBulletList(lb);
    // Divider with arrow
    addLine(s, 360, 140, 360, 380, T.dividerColor, 2);
    var arrow = addShape(s, 'ELLIPSE', 340, 235, 40, 40, T.accent);
    addText(s, '\u2192', 340, 235, 40, 40,
      {fontSize: 20, bold: true, color: T.titleColorInv, align: 'CENTER', valign: 'MIDDLE'});
    // Right half (after)
    var rightBg = addShape(s, 'RECTANGLE', 370, 100, 350, 305);
    rightBg.getFill().setSolidFill(T.accent, 0.15);
    addText(s, after.label || 'After', 390, 110, 310, 30,
      {fontSize: 20, bold: true, color: T.onSurface, align: 'CENTER'});
    var rb = addText(s, after.bullets.join('\n'), 390, 150, 310, 240,
      {fontSize: 14, color: T.bodyColor});
    addBulletList(rb);
    if (notes) addNotes(s, notes);
    return s;
  }

  function buildAnomalySlide(title, bars, rootCause, notes) {
    // bars: [{label, value, highlighted?}] — 3-6 items
    // rootCause: string[] — 2-3 bullet explanations
    var s = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    setBg(s, T.bg);
    addText(s, title, MARGIN, TITLE_Y, CONTENT_W, TITLE_H,
      {fontSize: 30, bold: true, color: T.titleColor});
    addLine(s, MARGIN, 90, MARGIN + 100, 90, T.accent, 3);
    var maxVal = 0;
    bars.forEach(function(b) { if (b.value > maxVal) maxVal = b.value; });
    var n = bars.length, barW = Math.min(80, (CONTENT_W - (n - 1) * 15) / n);
    var chartH = 150, chartY = 100, baseY = chartY + chartH;
    for (var i = 0; i < n; i++) {
      var bx = MARGIN + i * (barW + 15);
      var bH = maxVal > 0 ? chartH * (bars[i].value / maxVal) : 0;
      var color = bars[i].highlighted ? T.statusError : T.dividerColor;
      addShape(s, 'RECTANGLE', bx, baseY - bH, barW, bH, color);
      addText(s, bars[i].label, bx, baseY + 5, barW, 20,
        {fontSize: 10, color: T.subtitleColor, align: 'CENTER'});
      addText(s, String(bars[i].value), bx, baseY - bH - 18, barW, 18,
        {fontSize: 11, bold: true, color: T.onSurface, align: 'CENTER'});
    }
    // Root cause section
    addText(s, 'Root Cause', MARGIN, 290, CONTENT_W, 25,
      {fontSize: 16, bold: true, color: T.titleColor});
    var rc = addText(s, rootCause.join('\n'), MARGIN, 318, CONTENT_W, 80,
      {fontSize: 14, color: T.bodyColor});
    addBulletList(rc);
    if (notes) addNotes(s, notes);
    return s;
  }

  // === BUILD SLIDES (generate calls from outline) ===
  buildTitleSlide('Presentation Title', 'Subtitle or Date', 'Notes...');
  buildContentSlide('Topic One', ['Point A', 'Point B', 'Point C'], 'Notes...');
  // ... (one builder call per slide from the confirmed outline)
  buildClosingSlide('Thank You', ['Next step 1', 'Next step 2'], 'tagline', 'Notes...');

  return pres.getUrl();
})();
```

### Slide Type -> Builder Mapping

| Outline Slide Type | Builder Function | Key Parameters |
|---|---|---|
| Title / cover | `buildTitleSlide(title, subtitle, notes?)` | Dark bg, centered, accent divider line |
| Bullet content | `buildContentSlide(title, bullets[], notes)` | Light bg, bullet list preset |
| Two-column | `buildTwoColumnSlide(title, leftBullets[], rightBullets[], notes)` | 305pt columns, 30pt gutter |
| Big stat | `buildStatSlide(stat, context, notes)` | 72pt centered stat, accent color |
| Section break | `buildSectionSlide(title, subtitle?, notes?)` | Dark bg, centered |
| Table / data | `buildTableSlide(title, headers[], rows[][], notes)` | Auto-positioned table |
| Image | `buildImageSlide(title, imageUrl, notes)` | Public URL only, centered |
| Closing | `buildClosingSlide(title, bullets[]?, tagline?, notes)` | Dark bg, optional bullets |
| Hero statement | `buildHeroSlide(message, notes)` | Dark bg, 42pt centered, max 10 words |
| Triptych (3-card) | `buildTriptychSlide(title, [{t,d},...], notes)` | 3 rounded-rect cards, 193pt each |
| Quote / callout | `buildQuoteSlide(quote, attribution, notes)` | Vertical accent bar, italic quote |
| Timeline / process | `buildTimelineSlide(title, steps[], notes)` | Circles + connecting lines, 3-5 steps |
| Key takeaway | `buildTakeawaySlide(message, notes)` | Rounded-rect box with accent border |
| KPI dashboard | `buildKpiDashboardSlide(title, [{label,value,trend}], notes)` | 2-6 metric cards in grid, status-colored trends |
| KPI strip | `buildKpiStripSlide(title, [{icon,value,label}], notes)` | 3-5 inline metrics with icons |
| Chart (QuickChart) | `buildChartSlide(title, chartConfig, notes)` | QuickChart.io image; POST for configs >2000 chars; fallback text |
| Drill-down | `buildDrillDownSlide(title, [{label,value}], notes)` | Horizontal bars, status-colored by threshold |
| Before/after | `buildBeforeAfterSlide(title, {label,bullets[]}, {label,bullets[]}, notes)` | Vertical split with arrow divider |
| Anomaly | `buildAnomalySlide(title, [{label,value,highlighted?}], rootCause[], notes)` | Vertical bars + root cause bullets |
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

### Enterprise Storytelling Patterns

Salesforce-style narrative principles:

1. **Customer as hero** — never position the product as protagonist. The customer's challenge is the conflict, your solution is the "guide's gift"
2. **Name the world shift** — open with an undeniable industry change that creates urgency
3. **Proof sequence** — emotional proof (customer story) → capability proof (feature/demo) → quantified proof (metrics) → third-party proof (analyst quote)
4. **Specific closes** — "Contract review by March 15, launch April 1" not "Let's schedule a follow-up"
5. **One idea per slide** — each slide makes exactly one point. If you need two points, use two slides

**Advanced styling techniques (already available in helpers):**
- **Per-character emphasis:** `styleRange(shape.getText(), start, end, {bold:true, color:T.accent})` to bold key phrases within body text
- **Shape backgrounds:** Insert ROUND_RECTANGLE BEFORE text. Shapes render in insertion order (last = front). Use `shape.sendToBack()` if needed
- **Z-order:** `bringToFront()` / `sendToBack()` for layered compositions
- **Border control:** `shape.getBorder().getLineFill().setSolidFill(color)` + `.setWeight(pts)`
- **Monospace for code:** `{font: 'Roboto Mono'}` in addText opts
- **Image + text overlay (hero):** `addImage(slide, url, 0, 0, 720, 405)` → overlay RECTANGLE (sectionBg, alpha 0.6) → white text on top. Insertion order = z-order
- **Infographic primitives:** `progressBar()`, `metricCard()`, `hBar()`, `statusDot()` — composable building blocks for dashboards and data slides
- **QuickChart.io charts:** `buildChartSlide()` with Chart.js config — line, bar, doughnut, pie, radar, sparkline. Free tier: 50 req/day. Requires `script.external_request` scope

### Content Density & Layout Selection

Use the Content Element Extraction decision tree (Step 1B) to classify content into slide types. Additionally:

- **Layout rotation**: Never use the same slide type for two consecutive slides
- **Variety target**: A 10-slide deck should use >=5 distinct slide types
- **Billboard test**: Apply word count limits from Step 1B for each slide type
- **Story arc pacing**: Follow the Hook → Problem → Solution → Proof → Vision → Close structure

### Tested API References

All APIs below were empirically verified via live GAS execution (March 2026). These supplement Google's documentation with observed behavior.

**Shape Primitives:**
- `SlidesApp.ShapeType.ROUND_RECTANGLE` — confirmed (NOT `ROUNDED_RECTANGLE`). Width/height have minor float imprecision (~0.008pt off specified values)
- `SlidesApp.ShapeType.ELLIPSE` — confirmed. Exact positioning for circles (equal width/height)
- `insertTextBox()` creates shapes with `getShapeType()` returning `TEXT_BOX` (not a separate page element type)
- Shape dimensions: `getWidth()`/`getHeight()` return floats, not exact integers (e.g., 192.992 instead of 193)

**Z-Order:**
- Insertion order = render order. Last inserted element renders on top
- `sendToBack()` and `bringToFront()` both confirmed as available functions on shapes
- To layer text over a shape: insert shape first, then text box

**Border Styling:**
- Chain: `shape.getBorder().getLineFill().setSolidFill(color)` + `shape.getBorder().setWeight(pts)`
- `getWeight()` returns the exact value set (e.g., `setWeight(2)` → `getWeight()` returns `2`)
- Hidden border technique: set border color = fill color (visually invisible)

**Per-Character Styling (styleRange):**
- `getText().getRange(start, end)` — 0-indexed, end is exclusive (like `String.substring`)
- Chained styling works: `range.getTextStyle().setBold(true).setForegroundColor('#hex')`
- `asString()` appends a trailing `\n` to all text content — account for this in range calculations

**Lines:**
- Vertical lines: `insertLine(STRAIGHT, x, y1, x, y2)` — same x, different y. Results in element with `width=0`
- `Line.getStart()` returns object with `getX()`, `getY()`, `toString()` — **NOT** `getLeft()`/`getTop()` (common mistake)
- Line element position: use `line.getLeft()`, `line.getTop()`, `line.getWidth()`, `line.getHeight()` for bounding box
- `setWeight(pts)` and `getLineFill().setSolidFill(color)` both confirmed

**Alignment:**
- `SlidesApp.ParagraphAlignment.END` — confirmed for right-align text
- `SlidesApp.ContentAlignment.MIDDLE` — confirmed for vertical centering within a shape
- Both accessed via string keys on the enum object (e.g., `SlidesApp.ParagraphAlignment['END']`)

**Theme Extraction:**
- All 10 `ThemeColorType` values return valid hex via `getConcreteColor().asRgbColor().asHexString()`
- Default Google Slides theme: DARK1=#000000, LIGHT1=#FFFFFF, DARK2=#595959, LIGHT2=#EEEEEE, ACCENT1=#4285F4
- Background color: `slide.getBackground().getSolidFill().getColor().asRgbColor().asHexString()` — throws if gradient/image bg

**Font Detection:**
- `getRuns()` returns styled text runs. `getTextStyle().getFontFamily()` and `.getFontSize()` work on each run
- **Gotcha:** Placeholder shapes on default slides have Arial font. Font detection may pick up placeholder fonts before user-added text. Filter shapes by non-empty `getText().asString().trim()` for accuracy

**Deck Reader (Slide Introspection):**
- `getPageElements()` returns all elements: SHAPE, LINE, IMAGE, TABLE (and potentially GROUP, WORD_ART, SHEETS_CHART, VIDEO)
- `getPageElementType()` returns a string enum value
- `asShape().getShapeType()` returns specific type: TEXT_BOX, ROUND_RECTANGLE, ELLIPSE, etc.
- `asTable().getNumRows()` / `.getNumColumns()` for table dimensions
- Speaker notes: `slide.getNotesPage().getShapes()` → filter by `getPlaceholderType() === 'BODY'` → `getText().asString()`
- Unfilled shapes: `getSolidFill()` throws — wrap in try/catch, default to `'none'`

**QuickChart.io (chart builder):**
- GET mode: `https://quickchart.io/chart?c=CONFIG&w=600&h=300&bkg=white&devicePixelRatio=1`
- POST mode (for configs >2000 chars): `UrlFetchApp.fetch(url, {method:'post', contentType:'application/json', payload:JSON.stringify({...})})`
- Supported types: `bar`, `horizontalBar`, `line`, `pie`, `doughnut`, `radar`, `sparkline`, `radialGauge`
- Plugins: `datalabels` (value labels), `doughnutlabel` (center text), `annotation` (reference lines)
- Progress ring: doughnut with `cutout:'75%'` + doughnutlabel center text
- Sparkline: `type:'sparkline'` at 200x60, no axes
- Returns PNG blob suitable for `slide.insertImage(blob, ...)`
- Free tier: 50 requests/day (sufficient for 1-2 decks)
- Requires `script.external_request` OAuth scope

**Alpha/Opacity:**
- `shape.getFill().setSolidFill(color, alpha)` — alpha is 0-1 float (0=transparent, 1=opaque)
- Works on any shape fill, NOT on lines or text
- Use for card backgrounds (0.9), overlays (0.6), subtle tints (0.15)

**Performance (5-slide deck):**
- All 5 enterprise builders + helpers in single IIFE: ~3s execution time
- Deck reader IIFE (5 slides, 17 page elements): ~3s execution time
- Minified helper names (at/as/al/an/sb/bl) fit 5 builders + invocations under 2.5KB
- Chart slides add ~1-2s per QuickChart.io fetch

### Gotchas & Limitations

| Issue | Detail | Workaround |
|---|---|---|
| **Canvas size** | 720x405 pt (NOT 960x540) | All coords in this template calibrated for 720x405 |
| **insertTable position** | `insertTable(rows, cols)` auto-positions; cannot specify left/top/width/height | Accept default position; adjust manually in Slides if needed |
| **Images: public URLs only** | Private/authenticated URLs silently fail | `addImage()` auto-detects Drive file IDs (20+ alphanumeric chars) and calls `DriveApp.getFileById()` — **requires `drive` scope** |
| **Image overlay** | Full-bleed image + text needs layering | Insert image → dark overlay RECTANGLE (`sectionBg`, alpha 0.6) → text on top. Insertion order = z-order |
| **QuickChart.io** | External API for chart images — needs `script.external_request` scope | Free tier: 50 req/day. POST mode for configs >2000 chars. Fallback text if fetch fails |
| **Images: format limits** | PNG, JPEG, GIF only — no SVG, WebP | Convert to PNG before inserting |
| **Images: size limits** | 50MB max, 25 megapixel max, URL max 2KB | Resize large images before inserting |
| **replaceAllText()** | Cannot change formatting; throws if placeholder missing on ANY slide; skips Groups | Use per-slide shape iteration with existence check before replacing |
| **Float imprecision** | Shape dimensions return floats, not exact integers (e.g., 192.992 instead of 193) | Cosmetic only — visually imperceptible. Do not compare dimensions with strict equality |
| **Line.getStart()** | Returns `{getX, getY, toString}` — NOT `getLeft/getTop` | Use `line.getLeft()`/`line.getTop()` on the line element itself for bounding box position |
| **asString() trailing \\n** | `getText().asString()` always appends a newline character | Account for `\n` when calculating text ranges or comparing text content; use `.trim()` |
| **Placeholder font leak** | Default slide placeholders have Arial font; `getRuns()` picks these up | Filter by non-empty `getText().asString().trim()` before font detection |
| **Unfilled shape fill** | `getSolidFill()` throws on shapes without explicit fill (e.g., text boxes) | Always wrap `getSolidFill()` in try/catch, default to `'none'` |
| **No diagrams** | SlidesApp has no diagram primitives | Use `insertImage` with a pre-rendered diagram URL, or approximate with shapes |
| **No syntax highlighting** | No code formatting support | Use monospace font (`setFontFamily('Roboto Mono')`) for code slides |
| **List presets** | Only 15 preset options; no custom bullet characters | DISC_CIRCLE_SQUARE for bullets, DIGIT_ALPHA_ROMAN for numbered |
| **Performance** | ~0.4s per slide; 3 styled slides in 1.3s | Include ONLY builders invoked per call. Budget: helpers (~1.6KB) + builders (200-450B each) + invocations. Max 4-5 builders per call. For 8+ slides: split into two calls |

### Execute via MCP

The entire generated code is a self-contained IIFE — no separate function definition and call. It runs immediately and returns the presentation URL:
```
mcp__mcp-gas-deploy__exec({
  scriptId: "[TARGET_SCRIPT_ID]",
  js_statement: "return (function() { ... return pres.getUrl(); })();"
})
```

**Payload limit**: The GAS exec API has a ~3.5KB js_statement limit. Minify helper names (e.g., `addText` → `at`, `addLine` → `al`) to fit more slides. For decks over ~8 slides, split into two calls:
1. **Call 1**: Create presentation + slides 1-N/2 → return `{id: pres.getId(), url: pres.getUrl()}`
2. **Call 2**: `SlidesApp.openById(id)` + append remaining slides → return `pres.getUrl()`

### Error Handling

If `mcp__mcp-gas-deploy__exec` returns `success: false` or an error:
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

| Count | Structure | Types |
|---|---|---|
| 4–5 | Title + 2-3 content + Closing | Mix: 1 hero/stat, rest varied |
| 6–8 | Title + section + 4-5 content + Closing | 3+ distinct types; include hero or takeaway |
| 10–12 | Title + 2 sections + 7-8 content + Closing | 5+ distinct types; include triptych/timeline/kpi-dashboard/chart |
| 13+ | Split into 2 exec calls | Call 1: through mid-section; Call 2: remainder |

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
