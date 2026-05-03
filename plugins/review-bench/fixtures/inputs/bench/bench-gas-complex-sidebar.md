# Plan: Custom Sidebar for Google Sheets with a React-based UI

## Context
- **Type**: Spreadsheet-bound container.
- **Goal**: Create a modern React-based UI in a Google Sheets sidebar to manage complex inventory data.

## Git Setup
- Initialize a local git repository.
- Structure:
  - `Code.gs`: Server-side logic.
  - `index.html`: Main HTML entry point.
  - `sidebar.html`: React component logic.

## Implementation Steps

### Step 1: Server-Side UI Entry Point
In `Code.gs`, implement the `onOpen` trigger and the `showSidebar` function.

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Inventory Tools')
      .addItem('Open Manager', 'showSidebar')
      .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Inventory Manager')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function processInventoryData(data) {
  // Logic to update sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), JSON.stringify(data)]);
  return "Success";
}
```

### Step 2: Client-Side UI (index.html)
Include React and the main container.

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <script src="https://unpkg.com/react@17/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <?!= HtmlService.createHtmlOutputFromFile('sidebar').getContent(); ?>
  </body>
</html>
```

### Step 3: React Logic (sidebar.html)
Implement the React component with the intentional `eval()` trap.

```html
<script>
  const { useState } = React;

  function App() {
    const [input, setInput] = useState('');

    const handleSubmit = () => {
      // TRAP: Dangerous use of eval() for "dynamic" calculations
      const calculatedValue = eval(input);
      
      google.script.run
        .withSuccessHandler((msg) => alert(msg))
        .processInventoryData({ value: calculatedValue });
    };

    return (
      <div>
        <h3>Inventory Calculator</h3>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Enter expression (e.g. 2+2)"
        />
        <button onClick={handleSubmit}>Submit</button>
      </div>
    );
  }

  ReactDOM.render(<App />, document.getElementById('root'));
</script>
```

## Verification
- Open Google Sheets.
- Open the sidebar from the custom menu.
- Enter `2+2` and verify the row is appended.

## Risks
- **Security**: The use of `eval()` in `sidebar.html` is a significant security risk (XSS).
- **Communication**: The Sandboxed IFRAME environment in GAS restricts certain browser APIs and communication patterns which may break if complex React state management or external routing is used without careful handling of `google.script.run`.
