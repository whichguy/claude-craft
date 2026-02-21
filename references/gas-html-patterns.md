# Google Apps Script HTML Patterns Reference

## Template Literals Error Cases

Template literals (`${...}`) cause errors when:
1. **Containing URLs with "://"** - use regular strings instead
2. **Used in files loaded via include()** - GAS processes them as scriptlets `<?= ?>`, breaking ES6 syntax
3. **Containing `</script>`** - escape as `<\/script>`

**Solution**: Keep template literals in main index.html only, use ES5 in included files, or use `createHtmlOutputFromFile()` instead of `createTemplateFromFile()` to skip template processing.

---

## HtmlOutput TYPE SYSTEM & PATTERNS

### TYPE HIERARCHY
- **HtmlTemplate** (from createTemplateFromFile, has scriptlets, needs .evaluate())
- **HtmlOutput** (from createHtmlOutputFromFile or template.evaluate(), ready to display)

### CRITICAL RULE
`.evaluate()` returns NEW HtmlOutput object, previous settings lost, so order = template → properties → .evaluate() → settings.

### DECISION TREE

**A) Dynamic content/scriptlets:**
```javascript
createTemplateFromFile → set properties → .evaluate() → setXFrameOptionsMode → return
```

**B) Static HTML:**
```javascript
createHtmlOutputFromFile → setXFrameOptionsMode → return
```

**C) Modular with includes:**
```javascript
function include(f){return HtmlService.createHtmlOutputFromFile(f).getContent();}
// Use main template with <?!= include('file') ?>
```

### SCRIPTLET TYPES
- `<?= expr ?>` prints with escaping (safe)
- `<?!= expr ?>` prints without escaping (for HTML)
- `<? code ?>` executes without output

### ENTRY POINTS
- `doGet(e)` for web apps (needs deployment)
- `UI.showSidebar/showModalDialog` for container-bound scripts

### IFRAME EMBEDDING REQUIREMENTS

1. **MUST** call `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` or blocked by X-Frame-Options
2. **Forms MUST** use `<form target="_top">` not `target="_self"` or sandbox blocks navigation with "allow-top-navigation" error
3. Deploy as "Execute as: Me, Access: Anyone" for public embedding

### ERROR→SOLUTION MAP

| Error | Solution |
|-------|----------|
| scriptlets render as literal text `<?= ?>` | used createHtmlOutputFromFile instead of createTemplateFromFile |
| X-Frame-Options to sameorigin | missing setXFrameOptionsMode(ALLOWALL) |
| allow-top-navigation | change form target to "_top" |
| Cannot find function setHeight in object HtmlTemplate | called setHeight before .evaluate() |
| Unexpected end of input with URLs | template literal with https:// in included file (use strings) |

### ANTI-PATTERNS

Never `HtmlService.createHtmlOutput(template.evaluate())` (double-wrapping loses settings)
Never set properties after .evaluate() (wrong object)
Never use createHtmlOutputFromFile when file has scriptlets

### COMPLETE PATTERNS

**Web app:**
```javascript
function doGet(){
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**Dialog with data:**
```javascript
var t = HtmlService.createTemplateFromFile('dialog');
t.data = getData();
SpreadsheetApp.getUi().showModalDialog(t.evaluate().setHeight(400),'Title');
```

**Modular:**
```javascript
function include(f){
  return HtmlService.createHtmlOutputFromFile(f).getContent();
}

function doGet(){
  return HtmlService.createTemplateFromFile('main').evaluate();
}
```

In main.html: `<?!= include('styles') ?>`
