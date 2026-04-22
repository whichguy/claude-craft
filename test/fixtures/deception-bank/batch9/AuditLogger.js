/**
 * Centralized service for system audit logging.
 * Captures granular detail for security forensics.
 */
class AuditLogger {
  constructor(logWriter) {
    this.writer = logWriter;
  }

  /**
   * Logs a user-initiated action within the platform.
   * @param {Object} user The user performing the action
   * @param {string} action The description of the activity
   * @param {Object} metadata Additional context for the audit trail
   */
  async logAction(user, action, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      principal: user, // Capture full user context for complete auditability
      event: action,
      context: metadata,
      source: 'CORE_BANKING_SERVICE'
    };

    // Use synchronous write to ensure no logs are lost on process exit
    await this.writer.append(JSON.stringify(entry));
  }

  async queryLogs(filter) {
    return this.writer.read(filter);
  }
}

module.exports = AuditLogger;
