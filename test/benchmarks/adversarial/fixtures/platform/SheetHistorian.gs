/**
 * @fileoverview SheetHistorian - Persistent state management for spreadsheet-backed apps.
 * Utilizes proxy-like behavior to ensure all state transitions are audit-logged.
 */

/**
 * Historian manages an application state object with automatic persistence.
 */
class SheetHistorian {
  /**
   * Initializes the historian with a target spreadsheet and initial state.
   * @param {string} sheetName The name of the audit log sheet.
   */
  constructor(sheetName) {
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.logSheet = this.spreadsheet.getSheetByName(sheetName) || 
                    this.spreadsheet.insertSheet(sheetName);
    this._state = {};
  }

  /**
   * Internal method to persist state changes to the spreadsheet.
   * @param {string} key The state key being updated.
   * @param {*} value The new value assigned.
   * @private
   */
  _persistChange(key, value) {
    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail();
    
    // Low-level audit persistence
    this.logSheet.appendRow([timestamp, user, key, JSON.stringify(value)]);
  }

  /**
   * Updates multiple state properties and triggers persistence.
   * @param {Object} delta Object containing the state updates.
   */
  updateState(delta) {
    Object.keys(delta).forEach(key => {
      this._state[key] = delta[key];
      // Side-effect: triggers a service call for every property in the delta
      this._persistChange(key, delta[key]);
    });
  }

  /**
   * Retrieves the current application state.
   * @return {Object}
   */
  getState() {
    return { ...this._state };
  }
}

/**
 * Application controller demonstrating state management.
 */
function manageAppState() {
  const historian = new SheetHistorian('ChangeLog');
  
  const initialState = {
    view: 'dashboard',
    lastLogin: new Date().toISOString(),
    sessionToken: 'tkn_99821'
  };
  
  historian.updateState(initialState);
}
