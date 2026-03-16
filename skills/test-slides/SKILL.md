---
name: test-slides
description: |
  End-to-end integration test for the /slides skill's Google Slides (GAS SlidesApp) path.
  Exercises all enterprise builders, Step 0 deck reader, and modification modes
  with chrome-devtools visual verification.

  INVOKE with: /test-slides
  NOT for: creating real presentations (use /slides)
model: claude-sonnet-4-6
allowed-tools: mcp__mcp-gas-deploy__exec, mcp__mcp-gas-deploy__auth, mcp__mcp-gas-deploy__create, mcp__mcp-gas-deploy__deploy, mcp__mcp-gas-deploy__push, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__wait_for, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__evaluate_script, AskUserQuestion
---

# /test-slides — Integration Test for /slides GAS Path

You are a test runner. Execute all phases in order (Phase 0 through Phase 7). Report PASS/FAIL/SKIP per phase using the exact formats shown. Do not improvise content — all slide data and IIFEs are hardcoded below. Copy them verbatim into `mcp__mcp-gas-deploy__exec` calls.

Record start time at the beginning. Track `$SCRIPT_ID`, `$CLEANUP_PROJECT`, `$PRES_ID`, and `$PRES_URL`.

**Local directory convention**: When `$CLEANUP_PROJECT = true` (brand new project), all
`mcp__mcp-gas-deploy__exec` and `mcp__mcp-gas-deploy__push` calls MUST include
`localDir: "/tmp/test-slides-runner"` to avoid polluting the working directory.

## Output Style

Verbose styled output. Symbols: `✓` pass, `✗` fail, `⏭` skip, `●` progress, `⚠️` warn.

```
╭─── PHASE N — [Name] ─────────────╮
  >> Action narration
  ✓ Result status
╰─── Phase N: PASS ─────────────────╯
```

---

## Phase 0 — Project Setup

**If `$ARGUMENTS` contains a scriptId** (non-empty, matches `^[A-Za-z0-9_-]{20,}$`):
- Set `$SCRIPT_ID` = provided value
- Set `$CLEANUP_PROJECT = false`
- Report: `Phase 0: SKIP — using provided scriptId`

**Otherwise** (no argument — create a brand new project):

1. **Create**: Call `mcp__mcp-gas-deploy__create` with:
   - `title`: `test-slides-runner`
   - `localDir`: `/tmp/test-slides-runner` (use Bash `mkdir -p` first)
   Extract the new scriptId from the response. Set `$SCRIPT_ID` = new scriptId, `$CLEANUP_PROJECT = true`.

2. **Configure manifest**: The create tool bootstraps `appsscript.json` in the local dir.
   Using the Edit tool, update `/tmp/test-slides-runner/appsscript.json` to add the required OAuth scopes and webapp config:
   ```json
   {
     "timeZone": "America/New_York",
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "oauthScopes": [
       "https://www.googleapis.com/auth/presentations",
       "https://www.googleapis.com/auth/drive",
       "https://www.googleapis.com/auth/script.external_request"
     ],
     "webapp": {
       "access": "MYSELF",
       "executeAs": "USER_ACCESSING"
     }
   }
   ```

3. **Add exec infrastructure**: The create tool only bootstraps appsscript.json. The exec
   shim files must be copied from an existing project. Using Bash:
   ```
   mkdir -p /tmp/test-slides-runner/common-js
   # Copy from any project that has them (find first available):
   src=$(find ~/gas-projects -name "__mcp_exec.gs" -path "*/common-js/*" -print -quit)
   cp "$(dirname "$src")/require.gs" /tmp/test-slides-runner/common-js/require.gs
   cp "$src" /tmp/test-slides-runner/common-js/__mcp_exec.gs
   ```

4. **Write slide-helpers module**: Write `/tmp/test-slides-runner/slide-helpers.gs` with this content:
   ```javascript
   function _main(module, exports) {
     // slide-helpers: shared GAS Slides helpers for /test-slides
     // at=addText, as=addShape, al=addLine, an=addNote, sb=setBackground, bl=applyBulletList
     var T = {bg:'#FFFFFF',sectionBg:'#1B2A4A',accent:'#2563EB',titleColor:'#111827',
       titleColorInv:'#FFFFFF',bodyColor:'#374151',subtitleColor:'#6B7280',shapeFill:'#DBEAFE'};
     exports.T = T;
     exports.Tx = Object.assign({}, T, {surfaceColor:'#F3F4F6',onSurface:'#1F2937',
       statusSuccess:'#059669',statusWarning:'#d97706',statusError:'#dc2626',
       dividerColor:'#E5E7EB',chartPalette:['#2563EB','#7c3aed','#dc2626','#f59e0b','#10b981'],
       disabledColor:'#9ca3af'});
     exports.at = function(s,t,l,tp,w,h,o) {
       o=o||{};var sh=s.insertTextBox(t,l,tp,w,h);var ts=sh.getText().getTextStyle();
       if(o.fontSize)ts.setFontSize(o.fontSize);if(o.bold)ts.setBold(true);
       if(o.italic)ts.setItalic(true);if(o.color)ts.setForegroundColor(o.color);
       if(o.font)ts.setFontFamily(o.font);
       if(o.align)sh.getText().getParagraphs().forEach(function(p){
         p.getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment[o.align]);});
       if(o.valign)sh.setContentAlignment(SlidesApp.ContentAlignment[o.valign]);
       return sh;
     };
     exports.as = function(s,t,l,tp,w,h,f) {
       var sh=s.insertShape(SlidesApp.ShapeType[t],l,tp,w,h);
       if(f)sh.getFill().setSolidFill(f);return sh;
     };
     exports.al = function(s,x1,y1,x2,y2,c,wt) {
       var ln=s.insertLine(SlidesApp.LineCategory.STRAIGHT,x1,y1,x2,y2);
       ln.getLineFill().setSolidFill(c||T.accent);ln.setWeight(wt||3);return ln;
     };
     exports.an = function(s,t) {
       var shapes=s.getNotesPage().getShapes();
       for(var i=0;i<shapes.length;i++){
         if(String(shapes[i].getPlaceholderType())==='BODY'){shapes[i].getText().setText(t);break;}}
     };
     exports.sb = function(s,c){s.getBackground().setSolidFill(c);};
     exports.bl = function(sh) {
       sh.getText().getListStyle().applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE);
       return sh;
     };
   }
   __defineModule__(_main);
   ```

5. **Push**: Call `mcp__mcp-gas-deploy__push` with `scriptId`: `$SCRIPT_ID`,
   `localDir`: `/tmp/test-slides-runner`.
   This uploads the manifest + exec infrastructure + slide-helpers to the new project.

6. **Deploy**: Call `mcp__mcp-gas-deploy__deploy` with `scriptId`: `$SCRIPT_ID`.
   This creates the web app deployment needed for exec.

7. **Verify**: Call `mcp__mcp-gas-deploy__exec` with `scriptId`: `$SCRIPT_ID`,
   `localDir`: `/tmp/test-slides-runner`,
   `js_statement`: `return 'phase0-ok'`.
   - If this returns `success: true` → project is ready.
   - If this returns a browser authorization error → print the auth URL from the error,
     ask the user to open it in Chrome, then retry once.

**If any step fails**: Print the error, mark Phase 0 as FAIL, abort the entire test.
**PASS**: New project created, deployed, exec verified. Print `$SCRIPT_ID`.

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
| 11 | kpi-dashboard | 4 KPI cards: Active Sites / Species Found / Revenue / Safety |
| 12 | chart | QuickChart.io doughnut — ocean resource distribution |
| 13 | drill-down | 5 teams: Exploration / Mining / Biotech / Energy / Logistics |

Report: `Phase 1: PASS — 13 slides, 13 distinct types`

---

## Phase 2 — Create Initial Deck (3 exec calls)

### Call 1 — Slides 1-5 (Create presentation + return ID)

Run this IIFE verbatim via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.T,at=h.at,as=h.as,al=h.al,an=h.an,sb=h.sb,bl=h.bl;var M=40,CW=640,TY=28,TH=60,BY=100,BH=280;var pres=SlidesApp.create('The Deep Ocean Economy');var ss=pres.getSlides();if(ss.length>0)ss[0].remove();var s1=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s1,T.sectionBg);at(s1,'The Deep Ocean Economy',M,100,CW,80,{fontSize:40,bold:true,color:T.titleColorInv,align:'CENTER'});al(s1,260,190,460,190,T.accent,3);at(s1,'Unlocking the Last Frontier',M,200,CW,40,{fontSize:20,color:T.titleColorInv,align:'CENTER'});an(s1,'Cover: ocean economy overview.');var s2=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s2,T.sectionBg);at(s2,'71% of Earth Remains Unexplored',M,120,CW,160,{fontSize:42,bold:true,color:T.titleColorInv,align:'CENTER',valign:'MIDDLE'});al(s2,260,290,460,290,T.accent,3);an(s2,'Hero: unexplored ocean stat.');var s3=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s3,T.bg);at(s3,'Three Frontiers Driving Ocean Innovation',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s3,M,90,M+100,90,T.accent,3);var b3=at(s3,'Deep seafloor extraction\nMarine biopharmaceuticals\nWave and tidal energy\nAutonomous underwater vehicles',M,BY,CW,BH,{fontSize:18,color:T.bodyColor});bl(b3);an(s3,'Content: three ocean frontiers.');var s4=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s4,T.bg);at(s4,'The Three Pillars of Ocean Industry',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s4,M,90,M+100,90,T.accent,3);var cW=193,cH=250,g=30.5,cY=110;var items=[{t:'Deep-Sea Mining',d:'Polymetallic nodules: rare earths for batteries.'},{t:'Marine Biotech',d:'Unique compounds for medicine and bioplastics.'},{t:'Ocean Energy',d:'Predictable carbon-free coastal electricity.'}];for(var i=0;i<3;i++){var cx=M+i*(cW+g);var card=as(s4,'ROUND_RECTANGLE',cx,cY,cW,cH,T.shapeFill);card.getBorder().getLineFill().setSolidFill(T.shapeFill);at(s4,items[i].t,cx+10,cY+20,cW-20,40,{fontSize:16,bold:true,color:T.titleColor,align:'CENTER'});at(s4,items[i].d,cx+10,cY+70,cW-20,160,{fontSize:13,color:T.bodyColor,align:'CENTER'});}an(s4,'Triptych: ocean industry pillars.');var s5=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s5,T.bg);at(s5,'$282B',M,80,CW,120,{fontSize:72,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(s5,'Projected ocean economy by 2030',M,220,CW,60,{fontSize:20,color:T.bodyColor,align:'CENTER'});an(s5,'Stat: $282B ocean economy by 2030.');return JSON.stringify({id:pres.getId(),url:pres.getUrl()});})()
```

Parse the result: extract `$PRES_ID` and `$PRES_URL` from the returned JSON.

**If Call 1 fails**: Print the error, mark Phase 2 as FAIL, skip to Phase 7 (cleanup).

### Call 2 — Slides 6-10 (Open by ID + append)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID from Call 1.

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.T,at=h.at,as=h.as,al=h.al,an=h.an,sb=h.sb,bl=h.bl;var M=40,CW=640,TY=28,TH=60,BY=100,BH=280;var pres=SlidesApp.openById('$PRES_ID');var s6=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s6,T.bg);al(s6,M,80,M,280,T.accent,4);at(s6,'The ocean is the cornerstone of our life-support system. It shapes climate, provides food, and generates most of the oxygen we breathe.',M+20,90,CW-40,160,{fontSize:24,italic:true,color:T.titleColor});at(s6,'\u2014 Sylvia Earle, oceanographer and National Geographic Explorer',M+20,260,CW-40,40,{fontSize:16,color:T.subtitleColor,align:'END'});an(s6,'Quote: Sylvia Earle on oceans.');var s7=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s7,T.bg);at(s7,'From Exploration to Scale',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s7,M,90,M+100,90,T.accent,3);var steps=['Explore','Map','Extract','Refine','Scale'];var n=steps.length,d=60;var gap=n>1?(CW-n*d)/(n-1):0;var cy=210;for(var i=0;i<n;i++){var cx=M+i*(d+gap);if(i<n-1)al(s7,cx+d,cy+d/2,cx+d+gap,cy+d/2,T.accent,2);var circle=as(s7,'ELLIPSE',cx,cy,d,d,T.shapeFill);circle.getBorder().getLineFill().setSolidFill(T.accent);circle.getBorder().setWeight(2);at(s7,String(i+1),cx,cy,d,d,{fontSize:20,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(s7,steps[i],cx-10,cy+d+10,d+20,60,{fontSize:12,color:T.bodyColor,align:'CENTER'});}an(s7,'Timeline: explore to scale.');var s8=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s8,T.bg);at(s8,'Old vs New Extraction',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s8,M,90,M+100,90,T.accent,3);var colW=305;var lf=at(s8,'Ecosystem-destructive dredging\nHigh carbon per ton\nShallow shelf only',M,BY,colW,BH,{fontSize:16,color:T.bodyColor});bl(lf);var rt=at(s8,'Precision robotic collection\nSolar-powered vessels\nNodule harvesting at 4000m+',M+colW+30,BY,colW,BH,{fontSize:16,color:T.bodyColor});bl(rt);an(s8,'Two-col: old vs new extraction.');var s9=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s9,T.bg);var box=as(s9,'ROUND_RECTANGLE',100,120,520,160,T.shapeFill);box.getBorder().getLineFill().setSolidFill(T.accent);box.getBorder().setWeight(2);at(s9,'The next trillion-dollar industry is 3,000 meters below sea level',120,150,480,100,{fontSize:22,bold:true,color:T.titleColor,align:'CENTER',valign:'MIDDLE'});an(s9,'Takeaway: trillion-dollar deep-sea opportunity.');var s10=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s10,T.sectionBg);at(s10,'Start the Descent',M,60,CW,60,{fontSize:32,bold:true,color:T.titleColorInv,align:'CENTER'});var cb=at(s10,'Commission deep-sea survey Q3\nPartner with marine biotech\nSubmit framework to IMO',M,140,CW,160,{fontSize:18,color:T.titleColorInv});bl(cb);at(s10,'The ocean does not wait. Neither should we.',M,330,CW,40,{fontSize:16,italic:true,color:T.titleColorInv,align:'CENTER'});an(s10,'Closing: next steps.');return pres.getUrl();})()
```

### Call 3 — Slides 11-13: KPI Dashboard + Chart + Drill-Down (Open by ID + append)

Before calling exec, replace `$PRES_ID` in the IIFE below with the actual presentation ID from Call 1.

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.Tx,at=h.at,as=h.as,al=h.al,an=h.an,sb=h.sb;var M=40,CW=640,TY=28,TH=60;var pres=SlidesApp.openById('$PRES_ID');function mc(s,x,y,w,h,label,value,trend){var card=as(s,'ROUND_RECTANGLE',x,y,w,h,T.surfaceColor);card.getFill().setSolidFill(T.surfaceColor,0.9);at(s,label,x+10,y+10,w-20,20,{fontSize:12,color:T.subtitleColor,align:'CENTER'});at(s,String(value),x+10,y+35,w-20,45,{fontSize:36,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});if(trend){var tC=String(trend).charAt(0)==='+'?T.statusSuccess:String(trend).charAt(0)==='-'?T.statusError:T.subtitleColor;at(s,String(trend),x+10,y+h-30,w-20,20,{fontSize:14,color:tC,align:'CENTER'});}}function hb(s,x,y,w,h,val,maxV,color,label){as(s,'RECTANGLE',x,y,w,h,T.dividerColor);var bW=maxV>0?w*(val/maxV):0;if(bW>0)as(s,'RECTANGLE',x,y,bW,h,color||T.accent);if(label)at(s,label,x-120,y,110,h,{fontSize:14,color:T.bodyColor,align:'END',valign:'MIDDLE'});at(s,String(val),x+w+10,y,60,h,{fontSize:16,bold:true,color:T.onSurface,valign:'MIDDLE'});}var s11=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s11,T.bg);at(s11,'Ocean Operations Dashboard',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s11,M,90,M+100,90,T.accent,3);var kpis=[{l:'Active Sites',v:'47',tr:'+12%'},{l:'Species Found',v:'1,284',tr:'+8%'},{l:'Revenue ($M)',v:'156',tr:'+23%'},{l:'Safety Index',v:'98.2%',tr:'\u2192 stable'}];var cols=2,gap=20,cW2=(CW-(cols-1)*gap)/cols,cH2=140;for(var i=0;i<kpis.length;i++){var col=i%cols,row=Math.floor(i/cols);mc(s11,M+col*(cW2+gap),110+row*(cH2+gap),cW2,cH2,kpis[i].l,kpis[i].v,kpis[i].tr);}an(s11,'KPI dashboard metrics.');var s12=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s12,T.bg);at(s12,'Ocean Resource Distribution',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s12,M,90,M+100,90,T.accent,3);var chartCfg={type:'doughnut',data:{labels:['Minerals','Biotech','Energy','Fisheries','Tourism'],datasets:[{data:[35,25,20,12,8],backgroundColor:T.chartPalette}]},options:{plugins:{doughnutlabel:{labels:[{text:'100%',font:{size:28}},{text:'Total'}]}}}};var blob=null;try{blob=UrlFetchApp.fetch('https://quickchart.io/chart',{method:'post',contentType:'application/json',payload:JSON.stringify({width:500,height:280,backgroundColor:'white',chart:chartCfg})}).getBlob();}catch(e){blob=null;}if(blob){s12.insertImage(blob,M+70,100,500,280);}else{at(s12,'[Chart: doughnut visualization would appear here]',M,180,CW,60,{fontSize:18,italic:true,color:T.subtitleColor,align:'CENTER'});}an(s12,'Chart: resource distribution.');var s13=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s13,T.bg);at(s13,'Team Performance by Division',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s13,M,90,M+100,90,T.accent,3);var teams=[{l:'Exploration',v:95},{l:'Mining',v:82},{l:'Biotech',v:71},{l:'Energy',v:64},{l:'Logistics',v:43}];var maxV=95,barH2=22,sp=30,startY=110,barX=M+130,maxBW=CW-200;for(var i=0;i<teams.length;i++){var y=startY+i*sp;var pct=teams[i].v/maxV;var color=pct>0.8?T.statusSuccess:pct>0.5?T.statusWarning:T.statusError;hb(s13,barX,y,maxBW,barH2,teams[i].v,maxV,color,teams[i].l);}an(s13,'Drill-down: team performance.');return JSON.stringify({done:true,slideCount:pres.getSlides().length});})()
```

**Assertions:**
- Call 1: `success === true` AND result contains `id` and `url`
- Call 2: `success === true` AND result contains `docs.google.com/presentation`
- Call 3: `success === true` AND `slideCount === 13`

**PASS**: All three calls succeed with valid responses. Save `$PRES_ID` and `$PRES_URL`.
**FAIL**: Any exec returns error — print error, skip to Phase 7.

---

## Phase 3 — Visual Verification: Initial (chrome-devtools)

Follow these steps exactly. If any step fails with a tool error, set `$VISUAL = "SKIP"` and continue to Phase 4.

1. **Check Chrome availability**: Call `mcp__chrome-devtools__list_pages`. If error:
   - **Auto-launch Chrome**: Run via Bash:
     ```
     /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir="$HOME/.chrome-debug-profile" &
     ```
     Wait 3 seconds (`sleep 3`), then retry `mcp__chrome-devtools__list_pages`.
   - If still error after launch → `$VISUAL = "SKIP"`, skip remaining visual steps.

2. **Navigate**: Call `mcp__chrome-devtools__navigate_page` with `$PRES_URL`.

3. **Login check**: Call `mcp__chrome-devtools__evaluate_script` with `document.location.hostname`. If result contains `accounts.google.com` → `$VISUAL = "SKIP"`.

4. **Wait for slides**: Call `mcp__chrome-devtools__wait_for` with selector `[data-slide-id]`, timeout 10000.

5. **Screenshot**: Call `mcp__chrome-devtools__take_screenshot`.

6. **Count slides**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelectorAll('[data-slide-id]').length`. Expect `13`.

7. **Check title**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelector('[data-slide-id]')?.textContent?.substring(0,100)`. Expect contains `Deep Ocean Economy`.

**PASS**: DOM slide count = 13 AND title visible
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

**Expected final state**: 15 slides (13 - 2 removed + 2 rebuilt + 2 appended)

Report: `Phase 4: PASS — 3 modifications defined`

---

## Phase 5 — Modify Existing Deck (4 exec calls)

**Order**: A → C → B. On any exec failure: mark FAIL, skip remaining. Replace `$PRES_ID` in each IIFE with actual ID from Phase 2.

### Step 5.1 — Read Deck (1 exec call)

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var p=SlidesApp.openById('$PRES_ID');var allSlides=p.getSlides();var slides=allSlides.slice(0,50);var index=[];slides.forEach(function(sl,i){var entry={slide:i+1,shapes:[],texts:[],bg:null,notes:''};try{entry.bg=sl.getBackground().getSolidFill().getColor().asRgbColor().asHexString();}catch(e){entry.bg='none/gradient';}sl.getPageElements().forEach(function(el){var type=String(el.getPageElementType());var info={type:type,left:el.getLeft(),top:el.getTop(),w:el.getWidth(),h:el.getHeight()};if(type==='SHAPE'){var sh=el.asShape();info.shapeType=String(sh.getShapeType());try{info.fill=sh.getFill().getSolidFill().getColor().asRgbColor().asHexString();}catch(e){info.fill='none';}var txt=sh.getText().asString().trim();if(txt){info.text=txt.substring(0,100);entry.texts.push(txt.substring(0,200));}}else if(type==='LINE'){info.lineType='line';}else if(type==='IMAGE'){info.imageType='image';}else if(type==='TABLE'){var tbl=el.asTable();info.rows=tbl.getNumRows();info.cols=tbl.getNumColumns();}entry.shapes.push(info);});try{sl.getNotesPage().getShapes().forEach(function(ns){if(String(ns.getPlaceholderType())==='BODY'){entry.notes=ns.getText().asString().trim().substring(0,200);}});}catch(e){}index.push(entry);});var cs=p.getMasters()[0].getColorScheme();var tc={};['DARK1','LIGHT1','DARK2','LIGHT2','ACCENT1','ACCENT2','ACCENT3','ACCENT4','ACCENT5','ACCENT6'].forEach(function(n){tc[n]=cs.getConcreteColor(SlidesApp.ThemeColorType[n]).asRgbColor().asHexString();});return JSON.stringify({title:p.getName(),slideCount:allSlides.length,theme:{colors:tc},index:index});})()
```

**Assertions**: slideCount=13, every slide has texts[]>0, slide 4 ≥3 ROUND_RECTANGLE, slide 7 ≥1 ELLIPSE, slide 11 ≥4 ROUND_RECTANGLE (KPI), slide 13 ≥5 RECTANGLE (drill-down), theme.colors DARK1+ACCENT1 non-null. Print each result; on FAIL continue but note it.

### Step 5.2 — Modification A: Hero Rewrite (1 exec call)

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.T,at=h.at,al=h.al,an=h.an,sb=h.sb;var M=40,CW=640;var pres=SlidesApp.openById('$PRES_ID');pres.getSlides()[1].remove();var s=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s,T.sectionBg);at(s,'The Ocean Floor Holds More Wealth Than All Land Mines Combined',M,120,CW,160,{fontSize:42,bold:true,color:T.titleColorInv,align:'CENTER',valign:'MIDDLE'});al(s,260,290,460,290,T.accent,3);an(s,'Mod-A: hero rewrite.');var moved=false;try{s.move(2);moved=true;}catch(e){moved=false;}return JSON.stringify({done:true,slideCount:pres.getSlides().length,moved:moved});})()
```

**Assertions**: `done === true`, `slideCount === 13`, note `moved` value.
If `moved === false`, log: "Slide.move() failed — hero slide is at end instead of position 2 (known limitation)".

### Step 5.3 — Modification C: Content → Triptych (1 exec call)

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.T,at=h.at,as=h.as,al=h.al,an=h.an,sb=h.sb;var M=40,CW=640,TY=28,TH=60;var pres=SlidesApp.openById('$PRES_ID');var slides=pres.getSlides();var contentIdx=-1;for(var i=0;i<slides.length;i++){var txt='';slides[i].getPageElements().forEach(function(el){if(String(el.getPageElementType())==='SHAPE'){try{txt+=el.asShape().getText().asString();}catch(e){}}});if(txt.indexOf('Three Frontiers')>-1){contentIdx=i;break;}}if(contentIdx===-1)return JSON.stringify({done:false,error:'Content slide not found'});slides[contentIdx].remove();var s=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(s,T.bg);at(s,'Innovation \u00b7 Sustainability \u00b7 Scale',M,TY,CW,TH,{fontSize:30,bold:true,color:T.titleColor});al(s,M,90,M+100,90,T.accent,3);var cW=193,cH=250,g=30.5,cY=110;var items=[{t:'Innovation',d:'AI-guided exploration at unreachable depths.'},{t:'Sustainability',d:'Zero-waste, ecosystem-first protocols.'},{t:'Scale',d:'Pilot to industrial: ready for deployment.'}];for(var i=0;i<3;i++){var cx=M+i*(cW+g);var card=as(s,'ROUND_RECTANGLE',cx,cY,cW,cH,T.shapeFill);card.getBorder().getLineFill().setSolidFill(T.shapeFill);at(s,items[i].t,cx+10,cY+20,cW-20,40,{fontSize:16,bold:true,color:T.titleColor,align:'CENTER'});at(s,items[i].d,cx+10,cY+70,cW-20,160,{fontSize:13,color:T.bodyColor,align:'CENTER'});}an(s,'Mod-C: content to triptych.');var moved=false;try{s.move(3);moved=true;}catch(e){moved=false;}return JSON.stringify({done:true,slideCount:pres.getSlides().length,moved:moved});})()
```

**Assertions**: `done === true`, `slideCount === 13`.

### Step 5.4 — Modification B: Append Proof Slides (1 exec call)

Run via `mcp__mcp-gas-deploy__exec` with scriptId `$SCRIPT_ID`:

```javascript
return (function(){var h=require('slide-helpers'),T=h.T,at=h.at,al=h.al,an=h.an,sb=h.sb;var M=40,CW=640;var pres=SlidesApp.openById('$PRES_ID');var stat=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(stat,T.bg);at(stat,'94%',M,80,CW,120,{fontSize:72,bold:true,color:T.accent,align:'CENTER',valign:'MIDDLE'});at(stat,'of degraded marine ecosystems recover within 15 years when extraction stops',M,220,CW,60,{fontSize:20,color:T.bodyColor,align:'CENTER'});an(stat,'Mod-B: ecosystem recovery stat.');var qt=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);sb(qt,T.bg);al(qt,M,80,M,280,T.accent,4);at(qt,'The ocean economy is not a future opportunity — it is a present imperative that demands immediate, coordinated global action.',M+20,90,CW-40,160,{fontSize:24,italic:true,color:T.titleColor});at(qt,'\u2014 International Energy Agency, World Energy Outlook 2025',M+20,260,CW-40,40,{fontSize:16,color:T.subtitleColor,align:'END'});an(qt,'Mod-B: IEA quote.');return JSON.stringify({done:true,slideCount:pres.getSlides().length});})()
```

**Assertions**: `done === true`, `slideCount === 15`.

**Phase 5 report**: Print all assertion results. PASS if all exec calls succeed and final slideCount = 15.

---

## Phase 6 — Visual Verification: Modified (chrome-devtools)

Skip this phase entirely if `$VISUAL === "SKIP"` from Phase 3.

1. **Navigate**: Call `mcp__chrome-devtools__navigate_page` with `$PRES_URL` (force reload).

2. **Wait for slides**: Call `mcp__chrome-devtools__wait_for` with selector `[data-slide-id]`, timeout 10000.

3. **Screenshot**: Call `mcp__chrome-devtools__take_screenshot`.

4. **Count slides**: Call `mcp__chrome-devtools__evaluate_script` with `document.querySelectorAll('[data-slide-id]').length`. Expect `15`.

5. **Check hero replaced**: Call `mcp__chrome-devtools__evaluate_script` with:
   ```javascript
   Array.from(document.querySelectorAll('[data-slide-id]')).map(s => s.textContent).join(' ').substring(0, 500)
   ```
   Expect: does NOT contain `71% of Earth`.

**PASS**: Slide count = 15 AND old hero text absent
**SKIP**: Visual skipped from Phase 3
**FAIL**: Wrong count or old hero text still present

---

## Phase 7 — Cleanup

**The presentation is ALWAYS kept** — never auto-trashed. The user wants to review
the generated slides after the test completes.

### Project Cleanup (if `$CLEANUP_PROJECT = true`)

Only the test runner GAS project (infrastructure) is cleaned up — not the presentation.

1. Trash the test runner project via exec:
   ```javascript
   return (function(){DriveApp.getFileById('$SCRIPT_ID').setTrashed(true);return 'project-trashed';})()
   ```
2. Remove the temp local dir: `rm -rf /tmp/test-slides-runner`

If project cleanup fails: log warning, do not affect overall result.

---

## Final Summary

Print this format after all phases (Phase 4 omitted — always PASS):

```
╔═══════════════════════════════════════╗
║  /test-slides — Integration Results   ║
╚═══════════════════════════════════════╝

Phase 0 (Setup):        PASS | SKIP
Phase 1 (Story):        PASS (13 elements, 13 types)
Phase 2 (Create):       PASS | FAIL
Phase 3 (Visual Init):  PASS | FAIL | SKIP
Phase 5 (Read+Modify):  PASS | FAIL
Phase 6 (Visual Mod):   PASS | FAIL | SKIP
Cleanup:                Done | Warning
───────────────────────────────────────
Overall: PASS | FAIL (Phase N)
Duration: ~[N]s

  Presentation: $PRES_URL
  (kept for review — delete manually when done)
```

Overall PASS requires Phases 0/1/2/5 all PASS. Visual phases (3, 6): SKIP acceptable. Always include `$PRES_URL` in summary when Phase 2 succeeded.

---

## Error Reference

| Error | Action |
|---|---|
| exec `success: false` | Print error, FAIL phase, skip dependents |
| Chrome unavailable / login redirect | `$VISUAL = "SKIP"`, continue |
| `Slide.move()` throws | Log warning, not FAIL |
| Cleanup fails | Log warning, no effect on overall |
| Content slide not found (5.3) | FAIL Phase 5, skip remaining |
