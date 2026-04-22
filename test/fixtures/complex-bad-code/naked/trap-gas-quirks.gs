function onTimerTrigger() {
  var cache = CacheService.getUserCache();
  cache.put("lastRun", new Date().toISOString());
  
  console.log("Timer executed and cache updated.");
}

function processSensitiveData_() {
  console.log("Processing sensitive data...");
}

const htmlContent = `
  <script>
    function run() {
      google.script.run
        .withSuccessHandler(() => console.log('Done'))
        .processSensitiveData_(); 
    }
  </script>
`;
