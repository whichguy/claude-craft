# Plan: GAS Sidebar Panel for Inventory Lookup

## Context

The warehouse team uses a Google Sheet to track inventory. They need a sidebar panel
in the Sheet that lets them search for a product by SKU or name, view stock levels
across warehouses, and quickly update quantities after receiving shipments. Currently
they scroll through 12,000 rows manually.

## Current State

- Google Sheet with 12,000 product rows (SKU, name, category, warehouse, quantity)
- Apps Script project bound to the sheet (Script ID: 1ABC...xyz)
- No existing sidebar — all interaction is direct cell editing
- Server functions: `searchProducts(query)`, `updateQuantity(sku, warehouse, delta)` exist

## Approach

We will build a custom sidebar using `HtmlService.createHtmlOutputFromFile()`. The sidebar
will have a search bar at the top, a scrollable results list in the middle, and an
update form at the bottom. We'll use `google.script.run` to call the existing server
functions. The sidebar layout will use a fixed-width design optimized for readability.

## Files to Create/Modify

- `Sidebar.html` (new) — complete sidebar UI with inline CSS and JS
- `Code.gs` — add `showSidebar()` function and custom menu

## Implementation

### Phase 1: Sidebar Shell & Menu

1. Add `showSidebar()` to `Code.gs`:
   ```javascript
   function showSidebar() {
     const html = HtmlService.createHtmlOutputFromFile('Sidebar')
       .setTitle('Inventory Lookup')
       .setWidth(500);
     SpreadsheetApp.getUi().showSidebar(html);
   }
   ```

2. Add custom menu in `onOpen()`:
   ```javascript
   function onOpen() {
     SpreadsheetApp.getUi()
       .createMenu('Inventory')
       .addItem('Open Lookup', 'showSidebar')
       .addToUi();
   }
   ```

### Phase 2: Sidebar HTML & CSS

1. Create `Sidebar.html` with full HTML structure
2. Add inline CSS for the layout:
   - Fixed header area (60px) with search input and button
   - Scrollable results area (flex-grow, overflow-y: auto)
   - Fixed footer area (120px) with update form
   - Container width: 500px with 16px padding on each side
   - Results cards: full-width blocks with SKU, name, warehouse, quantity
   - Color scheme: white background, #1a73e8 accent for buttons
   - Font: Roboto 14px for body, 12px for labels

3. Build the search section:
   - Text input (width: 100%) with placeholder "Search by SKU or name..."
   - Search button next to input
   - Result count indicator below search bar

4. Build the results list:
   - Each result as a card showing SKU, product name, warehouse, current qty
   - Click a card to select it (highlight with border)
   - "No results found" message when search returns empty

5. Build the update form at the bottom:
   - Read-only field showing selected product SKU
   - Warehouse dropdown (auto-populated from selected product)
   - Quantity adjustment input (number, can be negative for removals)
   - "Update Stock" button

### Phase 3: JavaScript Logic

1. Add inline `<script>` block:
2. Implement `doSearch()`:
   - Read search input value
   - Call `google.script.run.withSuccessHandler(displayResults).searchProducts(query)`
   - Show "Searching..." text while waiting
3. Implement `displayResults(results)`:
   - Clear previous results
   - Render each result as a clickable card
   - Update result count indicator
4. Implement card selection:
   - On click, store selected SKU and warehouse in variable
   - Populate the update form fields
   - Highlight selected card
5. Implement `doUpdate()`:
   - Read SKU, warehouse, quantity delta from form
   - Call `google.script.run.withSuccessHandler(onUpdateSuccess).updateQuantity(sku, warehouse, delta)`
   - Show confirmation message on success
6. Add Enter key handler on search input to trigger search

### Phase 4: Integration & Testing

1. Deploy sidebar via `showSidebar()` from the Inventory menu
2. Test search with known SKU — verify results appear
3. Test search with partial name — verify fuzzy matching works
4. Select a result and update quantity — verify sheet reflects change
5. Test with no results — verify empty state message

## Verification

1. Open the Sheet, click Inventory > Open Lookup — sidebar appears
2. Search for a known SKU — results list populates correctly
3. Click a result card — update form populates with correct SKU/warehouse
4. Enter quantity delta and click Update — verify the spreadsheet row updates
5. Search for nonsense string — "No results found" appears
6. Verify sidebar renders without horizontal scrollbar
7. Test rapid searches — no stale results displayed
