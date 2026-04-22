/**
 * @fileoverview AuditFormatter - High-order styling engine for spreadsheet reports.
 * Employs functional composition to apply complex visual schemas to audit logs.
 */

/**
 * AuditFormatter provides tools for semantic spreadsheet formatting.
 */
const AuditFormatter = (function() {
  const SCHEMAS = {
    CRITICAL: '#ea9999',
    WARNING: '#fce5cd',
    SUCCESS: '#b6d7a8',
    INFO: '#cfe2f3'
  };

  /**
   * Creates a curried styler function for a specific range.
   * @param {GoogleAppsScript.Spreadsheet.Range} range The target range.
   * @return {Function} A styling function that accepts a status code.
   * @private
   */
  function createStyler_(range) {
    return function(status) {
      const color = SCHEMAS[status] || SCHEMAS.INFO;
      // Precision formatting applied to the specific range
      range.setBackground(color);
      range.setFontWeight(status === 'CRITICAL' ? 'bold' : 'normal');
    };
  }

  return {
    /**
     * Applies a semantic theme to a series of rows based on their record state.
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The active sheet.
     * @param {number} startRow The row index to begin formatting.
     * @param {Object[]} records Array of record objects containing status.
     */
    formatAuditLogs: function(sheet, startRow, records) {
      records.forEach((record, index) => {
        const rowNum = startRow + index;
        const rowRange = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn());
        const applyStyle = createStyler_(rowRange);
        
        applyStyle(record.status.toUpperCase());
      });
    }
  };
})();

/**
 * Routine to refresh the audit log presentation.
 */
function refreshAuditStyles() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AuditLog');
  const records = [
    { id: 1, status: 'critical' },
    { id: 2, status: 'info' },
    { id: 3, status: 'success' }
  ];
  AuditFormatter.formatAuditLogs(sheet, 2, records);
}
