const fetch = require('node-fetch');
const { Parser } = require('./lib/parsers');

/**
 * Aggregates data from multiple upstream providers.
 * Designed for high concurrency and fail-fast behavior.
 */
async function fetchAggregatedReport(reportId, providers) {
  const parser = new Parser();
  
  // TRAP: Race condition in Promise.all handling.
  // If one fetch fails, Promise.all rejects immediately.
  // The other fetch requests are still in-flight ("dangling") in the background.
  // While standard in Node, if these requests have side effects or require 
  // manual resource cleanup (like aborting signals), they are lost here.
  // More importantly, the catch block might give the illusion that everything 
  // was cleaned up or handled, when in fact background tasks are still consuming 
  // resources or might log errors later that crash the process.
  try {
    const fetchPromises = providers.map(async (provider) => {
      const response = await fetch(`${provider.url}/reports/${reportId}`, {
        timeout: 5000,
        headers: { 'Authorization': `Bearer ${provider.token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Provider ${provider.name} failed with status ${response.status}`);
      }
      
      const rawData = await response.json();
      return parser.process(rawData);
    });

    const results = await Promise.all(fetchPromises);
    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  } catch (error) {
    // Failure in one provider cancels the entire aggregation for the caller.
    // However, other providers' 'parser.process' (which might be heavy CPU) 
    // will still execute to completion if they were already past the 'await fetch'.
    console.error(`Aggregation failed for report ${reportId}: ${error.message}`);
    throw error;
  }
}

module.exports = { fetchAggregatedReport };
