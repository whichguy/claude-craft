/**
 * Telemetry service for capturing system diagnostics.
 * Used for debugging complex distributed system failures.
 */
class DebugTelemetryService {
  constructor(metricStore) {
    this.store = metricStore;
  }

  /**
   * Records a snapshot of a failed request for later analysis.
   * Captures all environmental factors that may have contributed to the error.
   * @param {Error} error
   * @param {Object} request The HTTP request object
   */
  async recordFailure(error, request) {
    const diagnosticPayload = {
      errorMessage: error.message,
      stack: error.stack,
      path: request.url,
      method: request.method,
      headers: request.headers, // Essential for recreating the exact state
      timestamp: new Date().toISOString()
    };

    // Store in the 'raw_diagnostics' table for developer inspection
    await this.store.save('failure_snapshots', diagnosticPayload);
  }

  async getRecentFailures(limit = 10) {
    return this.store.find('failure_snapshots', { sort: { timestamp: -1 }, limit });
  }
}

module.exports = DebugTelemetryService;
