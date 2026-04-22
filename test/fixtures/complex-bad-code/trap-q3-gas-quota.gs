/**
 * TRAP Q3: The Functional Abstraction.
 * 
 * This file implements a spreadsheet update script in Google Apps Script.
 * It uses functional programming (map/filter) and modular helpers to hide
 * the fact that it makes multiple API calls inside an iteration.
 */

/**
 * Synchronizes external price data to the 'Catalog' sheet.
 * TRAP: The functional style (map/filter) makes the code look "modern" and 
 * clean, but the 'updateCellFormatting' helper hides a SpreadsheetApp call.
 */
function syncCatalogPrices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Catalog");
  
  if (!sheet) {
    throw new Error("Catalog sheet not found. Ensure the 'Catalog' sheet exists before running sync.");
  }

  const rawData = sheet.getDataRange().getValues();
  const headers = rawData.shift(); // Remove headers
  
  // High-level functional processing
  const updatedData = rawData
    .filter(isValidRow)
    .map(row => {
      const sku = row[0];
      const newPrice = PriceService.fetchLatest(sku);
      
      // THE TRAP: This helper looks like a pure formatting utility.
      // But inside, it performs a GAS API call (getRange().setBackground()).
      // Since it's inside a .map(), it will execute once PER ROW.
      // 500 rows = 500 API calls = Execution timeout / Quota exceeded.
      const status = applyConditionalFormatting(sheet, row, newPrice);
      
      return [sku, row[1], newPrice, status];
    });

  // Looks like it batches at the end (setValues), which distracts from 
  // the API calls happening inside the .map() via applyConditionalFormatting.
  sheet.getRange(2, 1, updatedData.length, updatedData[0].length).setValues(updatedData);
}

function isValidRow(row) {
  return row[0] && row[0] !== "";
}

/**
 * Helper to determine the visual status of a row.
 * TRAP: This is where the hidden API call lives.
 */
function applyConditionalFormatting(sheet, row, price) {
  const rowIndex = row[row.length - 1]; // Assume last col is index
  const cell = sheet.getRange(rowIndex, 3);
  
  if (price > 100) {
    cell.setBackground("#ff9999"); // HIDDEN API CALL IN LOOP
    return "Premium";
  } else {
    cell.setBackground("#99ff99"); // HIDDEN API CALL IN LOOP
    return "Standard";
  }
}
