function syncInventory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Inventory");
  
  // LOGIC: No null check for sheet
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var sku = data[i][0];
    
    // PERFORMANCE: API call inside a loop
    var details = InventoryService.getDetails(sku);
    
    if (details.stock < 5) {
      // PERFORMANCE: Another service call in loop
      MailApp.sendEmail("admin@example.com", "Low Stock", "SKU: " + sku);
      
      // LOGIC: Magic index '5', no bounds check
      sheet.getRange(i + 1, 5).setValue("NOTIFIED");
    }
  }
}
