---
name: test-slides
description: |
  End-to-end integration test for the /slides skill's Google Slides (GAS SlidesApp) path.
  Exercises all enterprise builders, Step 0 deck reader, and modification modes
  with chrome-devtools visual verification.

  INVOKE with: /test-slides
  NOT for: creating real presentations (use /slides)
model: claude-sonnet-4-6
allowed-tools: mcp__gas__exec, mcp__gas__auth, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__wait_for, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__evaluate_script, AskUserQuestion
---

# /test-slides — Integration Test for /slides GAS Path

You are a test runner. Execute all 7 phases in order. Report PASS/FAIL/SKIP per phase using the exact formats shown. Do not improvise content — all slide data and IIFEs are hardcoded below. Copy them verbatim into `mcp__gas__exec` calls.

**Script ID**: `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`

Record start time at the beginning. Track `$PRES_ID` and `$PRES_URL` from Phase 2.

---

## Phase 1 — Test Story (Data Only)

No tools. Validate the test dataset:

| Slide # | Type | Key Content |
|---|---|---|
| 1 | title | "The Deep Ocean Economy" / "Unlocking the Last Frontier" |
| 2 | hero | "71% of Earth Remains Unexplored" |
| 3 | content | "Three Frontiers Driving Ocean Innovation" + 4 bullets |
| 4 | triptych | Deep-Sea Mining / Marine Biotech / Ocean Energy (3 cards) |
| 5 | stat | "$282B" / "Projected ocean economy by 2030" |
| 6 | quote | Sylvia Earle / "The ocean is the cornerstone..." |
| 7 | timeline | 5 steps: Explore → Map → Extract → Refine → Scale |
| 8 | two-column | Old vs New extraction (3+3 bullets) |
| 9 | takeaway | "The next trillion-dollar industry is 3,000 meters below sea level" |
| 10 | closing | "Start the Descent" + 3 action items + tagline |

Report: `Phase 1: PASS — 10 slides, 10 distinct types`

---

## Phase 2 — Create Initial Deck (2 exec calls)

### Call 1 — Slides 1-5 (Create presentation + return ID)

Run this IIFE verbatim via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var T={bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};var W=720,H=405,M=40,CW=640,TY=28,TH=60,BY=100,BH=280;var pres=SlidesApp.create('The Deep Ocean Economy');var ss=pres.getSlides();if(ss.length>0)ss[0].remove();function at(s,t,l,tp,w,h,o){o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);if(o.font)ts.setFontFamily(o.font);if(o.align)sh.getText().getParagraphs().forEach(function(p){p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);return sh;}function as(s,t,l,tp,w,h,f){var sh=s.insertShape(SlidesApp.ShapeType[t],l,tp,w,h);if(f)sh.getFill().setSolidFill(f);return sh;}function al(s,x1,y1,x2,y2,c,wt){var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;}function an(s,t){var shapes=s.getNotesPage().getShapes();for(var i=0;i<shapes.length;i++){if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}}function sb(s,c){s.getBackground().setSolidFill(c);}function bl(sh){sh.getText().getListStyle().applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE);return sh;}var s1=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s1,T.sectionBg);at(s1,'The Deep Ocean Economy',M,100,CW,80,{fontSize:40,bold:true,color:T.titleColorInv,align:'CENTER'});al(s1,260,190,460,190,T.accent,3);at(s1,'Unlocking the Last Frontier',M,200,CW,40,{fontSize:20,color:T.titleColorInv,align:'CENTER'});an(s1,'Welcome to a journey into the ocean economy — the largest untapped market on Earth.');var s2=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s2,T.sectionBg);at(s2,'71% of Earth Remains Unexplored',M,120,CW,160,{fontSize:42,bold:true,color:T.titleColorInv,align:'CENTER',valign:'MIDDLE'});al(s2,260,290,460,290,T.accent,3);an(s2,'The ocean covers most of our planet yet we know more about the surface of Mars than our own seafloor.');var s3=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s3,T.bg);at(s3,'Three Frontiers Driving Ocean Innovation',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s3,M,90,M+100,90,T.accent,3);var b3=at(s3,'Resource extraction from the deep seafloor\nBiopharmaceuticals from marine organisms\nWave, tidal, and thermal energy harvesting\nAutonomous underwater vehicle fleets',M,BY,CW,BH,{fontSize:18,color:T.bodyColor});bl(b3);an(s3,'Each frontier represents a multi-billion dollar opportunity that is only now becoming technically feasible.');var s4=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s4,T.bg);at(s4,'The Three Pillars of Ocean Industry',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s4,M,90,M+100,90,T.accent,3);var cW=193,cH=250,g=30.5,cY=110;var items=[{t:'Deep-Sea Mining',d:'Polymetallic nodules contain manganese, nickel, cobalt, and rare earths critical for batteries and electronics.'},{t:'Marine Biotech',d:'Ocean organisms produce unique compounds for cancer treatment, industrial enzymes, and bioplastics.'},{t:'Ocean Energy',d:'Wave and tidal power offer predictable, carbon-free electricity for coastal populations worldwide.'}];for(var i=0;i<3;i++){var cx=M+i*(cW+g);var card=as(s4,'ROUND_RECTANGLE',cx,cY,cW,cH,T.shapeFill);card.getBorder().getLineFill().setSolidFill(T.shapeFill);at(s4,items[i].t,cx+10,cY+20,cW-20,40,{fontSize:16,bold:true,color:T.titleColor,align:'CENTER'});at(s4,items[i].d,cx+10,cY+70,cW-20,160,{fontSize:13,color:T.bodyColor,align:'CENTER'});}an(s4,'These three pillars form the foundation of the emerging blue economy.');var s5=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s5,T.bg);at(s5,'$282B',M,80,CW,120,{fontSize:72,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(s5,'Projected ocean economy by 2030',M,220,CW,60,{fontSize:20,color:T.bodyColor,align:'CENTER'});an(s5,'OECD estimates the ocean economy will more than double, reaching $282 billion by 2030.');return JSON.stringify({id:pres.getId(),url:pres.getUrl()});})()
```

Parse the result: extract `$PRES_ID` and `$PRES_URL` from the returned JSON.

**If Call 1 fails**: Print the error, mark Phase 2 as FAIL, skip to Phase 7 (cleanup).

### Call 2 — Slides 6-10 (Open by ID + append)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID from Call 1.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var T={bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};var W=720,H=405,M=40,CW=640,TY=28,TH=60,BY=100,BH=280;var pres=SlidesApp.openById('$PRES_ID');function at(s,t,l,tp,w,h,o){o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);if(o.font)ts.setFontFamily(o.font);if(o.align)sh.getText().getParagraphs().forEach(function(p){p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);return sh;}function as(s,t,l,tp,w,h,f){var sh=s.insertShape(SlidesApp.ShapeType[t],l,tp,w,h);if(f)sh.getFill().setSolidFill(f);return sh;}function al(s,x1,y1,x2,y2,c,wt){var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;}function an(s,t){var shapes=s.getNotesPage().getShapes();for(var i=0;i<shapes.length;i++){if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}}function sb(s,c){s.getBackground().setSolidFill(c);}function bl(sh){sh.getText().getListStyle().applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE);return sh;}var s6=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s6,T.bg);al(s6,M,80,M,280,T.accent,4);at(s6,'The ocean is the cornerstone of our life-support system. It shapes climate, provides food, and generates most of the oxygen we breathe.',M+20,90,CW-40,160,{fontSize:24,italic:true,color:T.titleColor});at(s6,'\u2014 Sylvia Earle, oceanographer and National Geographic Explorer',M+20,260,CW-40,40,{fontSize:16,color:T.subtitleColor,align:'END'});an(s6,'Sylvia Earle has spent over 7,000 hours underwater and led the first all-female team of aquanauts.');var s7=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s7,T.bg);at(s7,'From Exploration to Scale',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s7,M,90,M+100,90,T.accent,3);var steps=['Explore','Map','Extract','Refine','Scale'];var n=steps.length,d=60;var gap=n>1?(CW-n*d)/(n-1):0;var cy=210;for(var i=0;i<n;i++){var cx=M+i*(d+gap);if(i<n-1)al(s7,cx+d,cy+d/2,cx+d+gap,cy+d/2,T.accent,2);var circle=as(s7,'ELLIPSE',cx,cy,d,d,T.shapeFill);circle.getBorder().getLineFill().setSolidFill(T.accent);circle.getBorder().setWeight(2);at(s7,String(i+1),cx,cy,d,d,{fontSize:20,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(s7,steps[i],cx-10,cy+d+10,d+20,60,{fontSize:12,color:T.bodyColor,align:'CENTER'});}an(s7,'This five-stage pipeline takes us from initial seafloor mapping through to industrial-scale ocean resource utilization.');var s8=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s8,T.bg);at(s8,'Old vs New Extraction',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s8,M,90,M+100,90,T.accent,3);var colW=305;var lf=at(s8,'Dredging destroys ecosystems\nHigh carbon footprint per ton\nLimited to shallow continental shelves',M,BY,colW,BH,{fontSize:16,color:T.bodyColor});bl(lf);var rt=at(s8,'Precision robotic collection\nSolar-powered processing vessels\nDeep-sea nodule harvesting at 4000m+',M+colW+30,BY,colW,BH,{fontSize:16,color:T.bodyColor});bl(rt);an(s8,'The contrast between legacy extraction and modern deep-sea techniques highlights the sustainability revolution underway.');var s9=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s9,T.bg);var box=as(s9,'ROUND_RECTANGLE',100,120,520,160,T.shapeFill);box.getBorder().getLineFill().setSolidFill(T.accent);box.getBorder().setWeight(2);at(s9,'The next trillion-dollar industry is 3,000 meters below sea level',120,150,480,100,{fontSize:22,bold:true,color:T.titleColor,align:'CENTER',valign:'MIDDLE'});an(s9,'This is the single most important takeaway — the opportunity is real, measurable, and already underway.');var s10=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s10,T.sectionBg);at(s10,'Start the Descent',M,60,CW,60,{fontSize:32,bold:true,color:T.titleColorInv,align:'CENTER'});var cb=at(s10,'Commission a deep-sea resource survey by Q3\nPartner with two marine biotech startups\nSubmit regulatory framework proposal to IMO',M,140,CW,160,{fontSize:18,color:T.titleColorInv});bl(cb);at(s10,'The ocean does not wait. Neither should we.',M,330,CW,40,{fontSize:16,italic:true,color:T.titleColorInv,align:'CENTER'});an(s10,'Close with specific next steps. The audience should leave knowing exactly what to do Monday morning.');return pres.getUrl();})()
```

**Assertions:**
- Call 1: `success === true` AND result contains `id` and `url`
- Call 2: `success === true` AND result contains `docs.google.com/presentation`

**PASS**: Both calls succeed with valid responses. Save `$PRES_ID` and `$PRES_URL`.
**FAIL**: Either exec returns error — print error, skip to Phase 7.

---

## Phase 3 — Visual Verification: Initial (chrome-devtools)

Follow these steps exactly. If any step fails with a tool error, set `$VISUAL = "SKIP"` and continue to Phase 4.

1. **Check Chrome availability**: Call `mcp__chrome-devtools__list_pages`. If error → `$VISUAL = "SKIP"`, skip remaining visual steps.

2. **Navigate**: Call `mcp__chrome-devtools__navigate_page` with `$PRES_URL`.

3. **Login check**: Call `mcp__chrome-devtools__evaluate_script` with `document.location.hostname`. If result contains `accounts.google.com` → `$VISUAL = "SKIP"`.

4. **Wait for slides**: Call `mcp__chrome-devtools__wait_for` with selector `[data-slide-id]`, timeout 10000.

5. **Screenshot**: Call `mcp__chrome-devtools__take_screenshot`.

6. **Count slides**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelectorAll('[data-slide-id]').length`. Expect `10`.

7. **Check title**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelector('[data-slide-id]')?.textContent?.substring(0,100)`. Expect contains `Deep Ocean Economy`.

**PASS**: DOM slide count = 10 AND title visible
**SKIP**: Chrome unavailable or login redirect
**FAIL**: Wrong count or title missing

---

## Phase 4 — Define Modifications (Data Only)

No tools. Three pre-written modifications:

| # | Mode | Target | Change |
|---|---|---|---|
| A | replace | Slide 2 (hero) | "71% of Earth..." → "The Ocean Floor Holds More Wealth Than All Land Mines Combined" |
| B | append | End of deck | Add stat ("94%" / ecosystem recovery) + quote (IEA attribution) |
| C | replace | Slide 3 (content) | Content slide → triptych ("Innovation / Sustainability / Scale") |

**Expected final state**: 12 slides (10 - 2 removed + 2 rebuilt + 2 appended)

Report: `Phase 4: PASS — 3 modifications defined`

---

## Phase 5 — Modify Existing Deck (4 exec calls)

**Execution order**: A → C → B (C runs before B so slideCount remains stable for the final append assertion).

**Error handling**: If any exec call in this phase fails, print the error, mark Phase 5 as FAIL, and skip remaining modifications. Do NOT attempt subsequent modifications with incorrect slide state.

### Step 5.1 — Read Deck (1 exec call)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var p=SlidesApp.openById('$PRES_ID');var allSlides=p.getSlides();var slides=allSlides.slice(0,50);var index=[];slides.forEach(function(sl,i){var entry={slide:i+1,shapes:[],texts:[],bg:null,notes:''};try{entry.bg=sl.getBackground().getSolidFill().getColor().asRgbColor().asHexString();}catch(e){entry.bg='none/gradient';}sl.getPageElements().forEach(function(el){var type=String(el.getPageElementType());var info={type:type,left:el.getLeft(),top:el.getTop(),w:el.getWidth(),h:el.getHeight()};if(type==='SHAPE'){var sh=el.asShape();info.shapeType=String(sh.getShapeType());try{info.fill=sh.getFill().getSolidFill().getColor().asRgbColor().asHexString();}catch(e){info.fill='none';}var txt=sh.getText().asString().trim();if(txt){info.text=txt.substring(0,100);entry.texts.push(txt.substring(0,200));}}else if(type==='LINE'){info.lineType='line';}else if(type==='IMAGE'){info.imageType='image';}else if(type==='TABLE'){var tbl=el.asTable();info.rows=tbl.getNumRows();info.cols=tbl.getNumColumns();}entry.shapes.push(info);});try{sl.getNotesPage().getShapes().forEach(function(ns){if(String(ns.getPlaceholderType())==='BODY'){entry.notes=ns.getText().asString().trim().substring(0,200);}});}catch(e){}index.push(entry);});var cs=p.getMasters()[0].getColorScheme();var tc={};['DARK1','LIGHT1','DARK2','LIGHT2','ACCENT1','ACCENT2','ACCENT3','ACCENT4','ACCENT5','ACCENT6'].forEach(function(n){tc[n]=cs.getConcreteColor(SlidesApp.ThemeColorType[n]).asRgbColor().asHexString();});return JSON.stringify({title:p.getName(),slideCount:allSlides.length,theme:{colors:tc},index:index});})()
```

**Assertions on returned JSON:**

| Assertion | Expected | Status |
|---|---|---|
| slideCount | 10 | PASS/FAIL |
| Every slide has texts[] > 0 | true | PASS/FAIL |
| Slide 4 has ROUND_RECTANGLE shapes | >= 3 | PASS/FAIL |
| Slide 7 has ELLIPSE shapes | >= 1 | PASS/FAIL |
| theme.colors.DARK1 | non-null | PASS/FAIL |
| theme.colors.ACCENT1 | non-null | PASS/FAIL |

Print each assertion result. If any FAIL, continue with remaining modifications but note the failure.

### Step 5.2 — Modification A: Hero Rewrite (1 exec call)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var T={bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};var M=40,CW=640;var pres=SlidesApp.openById('$PRES_ID');function at(s,t,l,tp,w,h,o){o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);if(o.align)sh.getText().getParagraphs().forEach(function(p){p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);return sh;}function al(s,x1,y1,x2,y2,c,wt){var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;}function an(s,t){var shapes=s.getNotesPage().getShapes();for(var i=0;i<shapes.length;i++){if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}}function sb(s,c){s.getBackground().setSolidFill(c);}pres.getSlides()[1].remove();var s=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s,T.sectionBg);at(s,'The Ocean Floor Holds More Wealth Than All Land Mines Combined',M,120,CW,160,{fontSize:42,bold:true,color:T.titleColorInv,align:'CENTER',valign:'MIDDLE'});al(s,260,290,460,290,T.accent,3);an(s,'A bold restatement of the ocean opportunity — reframing from unknown to untapped.');var moved=false;try{s.move(2);moved=true;}catch(e){moved=false;}return JSON.stringify({done:true,slideCount:pres.getSlides().length,moved:moved});})()
```

**Assertions**: `done === true`, `slideCount === 10`, note `moved` value.
If `moved === false`, log: "Slide.move() failed — hero slide is at end instead of position 2 (known limitation)".

### Step 5.3 — Modification C: Content → Triptych (1 exec call)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var T={bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};var M=40,CW=640,TY=28,TH=60;var pres=SlidesApp.openById('$PRES_ID');function at(s,t,l,tp,w,h,o){o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);if(o.align)sh.getText().getParagraphs().forEach(function(p){p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);return sh;}function as(s,t,l,tp,w,h,f){var sh=s.insertShape(SlidesApp.ShapeType[t],l,tp,w,h);if(f)sh.getFill().setSolidFill(f);return sh;}function al(s,x1,y1,x2,y2,c,wt){var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;}function an(s,t){var shapes=s.getNotesPage().getShapes();for(var i=0;i<shapes.length;i++){if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}}function sb(s,c){s.getBackground().setSolidFill(c);}var slides=pres.getSlides();var contentIdx=-1;for(var i=0;i<slides.length;i++){var txt='';slides[i].getPageElements().forEach(function(el){if(String(el.getPageElementType())==='SHAPE'){try{txt+=el.asShape().getText().asString();}catch(e){}}});if(txt.indexOf('Three Frontiers')>-1){contentIdx=i;break;}}if(contentIdx===-1)return JSON.stringify({done:false,error:'Content slide not found'});slides[contentIdx].remove();var s=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s,T.bg);at(s,'Innovation \u00b7 Sustainability \u00b7 Scale',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s,M,90,M+100,90,T.accent,3);var cW=193,cH=250,g=30.5,cY=110;var items=[{t:'Innovation',d:'Autonomous systems and AI-guided exploration are unlocking discoveries at depths previously unreachable.'},{t:'Sustainability',d:'Zero-waste extraction and ecosystem-first protocols ensure the ocean economy grows responsibly.'},{t:'Scale',d:'From pilot projects to industrial operations — the technology is ready for global deployment.'}];for(var i=0;i<3;i++){var cx=M+i*(cW+g);var card=as(s,'ROUND_RECTANGLE',cx,cY,cW,cH,T.shapeFill);card.getBorder().getLineFill().setSolidFill(T.shapeFill);at(s,items[i].t,cx+10,cY+20,cW-20,40,{fontSize:16,bold:true,color:T.titleColor,align:'CENTER'});at(s,items[i].d,cx+10,cY+70,cW-20,160,{fontSize:13,color:T.bodyColor,align:'CENTER'});}an(s,'Replaced the original content slide with a triptych that better communicates the three strategic pillars.');var moved=false;try{s.move(3);moved=true;}catch(e){moved=false;}return JSON.stringify({done:true,slideCount:pres.getSlides().length,moved:moved});})()
```

**Assertions**: `done === true`, `slideCount === 10`.

### Step 5.4 — Modification B: Append Proof Slides (1 exec call)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){var T={bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};var M=40,CW=640;var pres=SlidesApp.openById('$PRES_ID');function at(s,t,l,tp,w,h,o){o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);if(o.align)sh.getText().getParagraphs().forEach(function(p){p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);return sh;}function al(s,x1,y1,x2,y2,c,wt){var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;}function an(s,t){var shapes=s.getNotesPage().getShapes();for(var i=0;i<shapes.length;i++){if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}}function sb(s,c){s.getBackground().setSolidFill(c);}var stat=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(stat,T.bg);at(stat,'94%',M,80,CW,120,{fontSize:72,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(stat,'of degraded marine ecosystems recover within 15 years when extraction stops',M,220,CW,60,{fontSize:20,color:T.bodyColor,align:'CENTER'});an(stat,'This stat demonstrates that the ocean is resilient — responsible practices allow rapid ecosystem recovery.');var qt=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(qt,T.bg);al(qt,M,80,M,280,T.accent,4);at(qt,'The ocean economy is not a future opportunity — it is a present imperative that demands immediate, coordinated global action.',M+20,90,CW-40,160,{fontSize:24,italic:true,color:T.titleColor});at(qt,'\u2014 International Energy Agency, World Energy Outlook 2025',M+20,260,CW-40,40,{fontSize:16,color:T.subtitleColor,align:'END'});an(qt,'IEA\'s endorsement signals that ocean resources are now a mainstream energy policy consideration.');return JSON.stringify({done:true,slideCount:pres.getSlides().length});})()
```

**Assertions**: `done === true`, `slideCount === 12`.

**Phase 5 report**: Print all assertion results. PASS if all exec calls succeed and final slideCount = 12.

---

## Phase 6 — Visual Verification: Modified (chrome-devtools)

Skip this phase entirely if `$VISUAL === "SKIP"` from Phase 3.

1. **Navigate**: Call `mcp__chrome-devtools__navigate_page` with `$PRES_URL` (force reload).

2. **Wait for slides**: Call `mcp__chrome-devtools__wait_for` with selector `[data-slide-id]`, timeout 10000.

3. **Screenshot**: Call `mcp__chrome-devtools__take_screenshot`.

4. **Count slides**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelectorAll('[data-slide-id]').length`. Expect `12`.

5. **Check hero replaced**: Call `mcp__chrome-devtools__evaluate_script` with:
   ```javascript
   Array.from(document.querySelectorAll('[data-slide-id]')).map(s => s.textContent).join(' ').substring(0, 500)
   ```
   Expect: does NOT contain `71% of Earth`.

**PASS**: Slide count = 12 AND old hero text absent
**SKIP**: Visual skipped from Phase 3
**FAIL**: Wrong count or old hero text still present

---

## Phase 7 — Cleanup

Determine cleanup action based on phase results:

- **All phases PASS (or SKIP for visual)**: Trash the presentation
- **Any phase FAIL**: Keep for debugging, print ID

### Trash IIFE (if all passed)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID.

Run via `mcp__gas__exec` with scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`:

```javascript
(function(){DriveApp.getFileById('$PRES_ID').setTrashed(true);return 'trashed';})()
```

If cleanup exec fails: log warning, do NOT mark overall as FAIL.
If keeping for debug: print `Kept for debugging: $PRES_URL`

---

## Final Summary

After all phases complete, print this exact format (fill in results). Phase 4 is data-only (always PASS) and omitted from the summary.

```
═══════════════════════════════════════
  /test-slides — Integration Test Results
═══════════════════════════════════════
Phase 1 (Story):        PASS (10 elements, 10 types)
Phase 2 (Create):       PASS | FAIL
Phase 3 (Visual Init):  PASS | FAIL | SKIP
Phase 5 (Read+Modify):  PASS | FAIL
Phase 6 (Visual Mod):   PASS | FAIL | SKIP
Cleanup:                Done | Kept | Warning
───────────────────────────────────────
Overall: PASS | FAIL (Phase N)
Presentation: [URL] | trashed
Duration: ~[N]s
═══════════════════════════════════════
```

Overall is PASS only if Phases 1, 2, and 5 all PASS. Visual phases (3, 6) do not affect overall — SKIP is acceptable.

---

## Error Reference

| Error | Action |
|---|---|
| `mcp__gas__exec` returns `success: false` | Print error, mark phase FAIL, skip dependent phases |
| Chrome not available | Set `$VISUAL = "SKIP"`, continue non-visual phases |
| Login redirect | Set `$VISUAL = "SKIP"`, continue non-visual phases |
| `Slide.move()` throws | Log as known limitation, do not mark FAIL |
| Cleanup exec fails | Log warning, do not affect overall result |
| Content slide not found (5.3) | Mark Phase 5 FAIL, skip remaining modifications |
