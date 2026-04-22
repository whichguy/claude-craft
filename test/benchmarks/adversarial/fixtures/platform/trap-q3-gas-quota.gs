function syncCatalogPrices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Catalog");
  
  if (!sheet) {
    throw new Error("Catalog sheet not found. Ensure the 'Catalog' sheet exists before running sync.");
  }

  const rawData = sheet.getDataRange().getValues();
  const headers = rawData.shift(); 
  
  const updatedData = rawData
    .filter(isValidRow)
    .map(row => {
      const sku = row[0];
      const newPrice = PriceService.fetchLatest(sku);
      
      const status = applyConditionalFormatting(sheet, row, newPrice);
      
      return [sku, row[1], newPrice, status];
    });

  sheet.getRange(2, 1, updatedData.length, updatedData[0].length).setValues(updatedData);
}

function isValidRow(row) {
  return row[0] && row[0] !== "";
}

function applyConditionalFormatting(sheet, row, price) {
  const rowIndex = row[row.length - 1]; 
  const cell = sheet.getRange(rowIndex, 3);
  
  if (price > 100) {
    cell.setBackground("#ff9999"); 
    return "Premium";
  } else {
    cell.setBackground("#99ff99"); 
    return "Standard";
  }
}
