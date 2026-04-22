/**
 * TRAP: GAS Runtime Quirks & HTML Service Rules.
 * 
 * Q8 Trap: Using CacheService.getUserCache() in a function intended for 
 * a time-based trigger. In GAS, time-based triggers run as the "system" 
 * and do not have access to 'UserCache'. This will throw a runtime exception.
 * 
 * Q35 Trap: google.script.run calling a private function (ending in _).
 * GAS prevents calling private functions from the client-side.
 */

function onTimerTrigger() {
  // ERROR: getUserCache() is not available in time-based trigger context.
  // Must use getScriptCache() or getDocumentCache().
  var cache = CacheService.getUserCache();
  cache.put("lastRun", new Date().toISOString());
  
  console.log("Timer executed and cache updated.");
}

/**
 * A private helper function that should NOT be callable from HTML.
 */
function processSensitiveData_() {
  console.log("Processing sensitive data...");
}

/**
 * Simulated HTML content showing the violation.
 */
const htmlContent = `
  <script>
    function run() {
      // ERROR: google.script.run cannot call functions ending in _
      google.script.run
        .withSuccessHandler(() => console.log('Done'))
        .processSensitiveData_(); 
    }
  </script>
`;
