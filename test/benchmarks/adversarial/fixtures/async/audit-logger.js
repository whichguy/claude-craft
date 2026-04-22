const { Client } = require('elasticsearch');
const { createLogger } = require('./utils/logger');

/**
 * System-wide audit logging service.
 * Supports batching and multiple storage backends.
 */
class AuditLogger {
  constructor() {
    this.client = new Client({ host: 'localhost:9200' });
    this.localLogger = createLogger('audit');
  }

  /**
   * Logs a batch of events to multiple destinations.
   * Ensures that all events are durable before resolving.
   */
  async logEvents(events) {
    // TRAP: Promise.all rejection behavior.
    // If ANY event fails to log (e.g., Elasticsearch is down), 
    // Promise.all will reject immediately.
    // The other promises in the array are STILL RUNNING but we have 
    // lost the reference to them and their eventual results.
    // This can lead to double-logging if the caller retries, or 
    // data loss if some were processed but others weren't and the 
    // caller doesn't know which failed.
    try {
      const tasks = events.map(async (event) => {
        // Log to Elasticsearch
        await this.client.index({
          index: 'audit-logs',
          body: event
        });

        // Log to local file system
        await this.localLogger.info('Audit event stored', event);
        
        return { id: event.id, status: 'persisted' };
      });

      const results = await Promise.all(tasks);
      return {
        count: results.length,
        outcome: 'COMPLETE_SUCCESS'
      };
    } catch (err) {
      // In this catch block, we don't know which tasks succeeded 
      // and which were still in progress. We return a generic error,
      // but some events might have been partially written (e.g., to ES but not local).
      throw new Error(`Batch logging failed: ${err.message}`);
    }
  }
}

module.exports = AuditLogger;
