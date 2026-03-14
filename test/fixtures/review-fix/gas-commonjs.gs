// [TRAP] Correct require usage — proper pattern
const Utils = require('utils');

// [ISSUE: GAS-STALE-1] Stale SpreadsheetApp reference across function calls
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');

function processRows() {
  // Uses module-level sheet reference — stale if sheet was renamed/deleted
  const data = sheet.getDataRange().getValues();
  const processed = data.map(row => Utils.transform(row));
  sheet.getRange(1, 1, processed.length, processed[0].length).setValues(processed);
}

// [ISSUE: GAS-QUOTA-1] Quota risk — API calls inside loop without batching
function updateAllUsers(users) {
  for (const user of users) {
    const ss = SpreadsheetApp.openById(user.sheetId);
    const target = ss.getSheetByName('Profile');
    target.getRange('A1').setValue(user.name);
    target.getRange('B1').setValue(user.email);
  }
}

// [ISSUE: GAS-LOAD-1] Missing loadNow for event handler dependency
function onOpen(e) {
  const Menu = require('menu-builder');
  Menu.createCustomMenu(e);
}
