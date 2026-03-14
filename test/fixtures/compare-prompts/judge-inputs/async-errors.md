<GROUND_TRUTH_ISSUES>
[
  {"id": "GT-1", "line": 5, "class": "unhandled-promise", "description": "Promise rejection not caught — unhandled rejection will crash Node process"},
  {"id": "GT-2", "line": 12, "class": "race-condition", "description": "File read and write operations not atomic — concurrent requests can corrupt data"}
]
false_positive_traps: ["GT-TRAP-1"]
[
  {"id": "GT-TRAP-1", "line": 18, "class": "looks-like-injection", "description": "Template literal in log statement — this is safe, no user input involved"}
]
</GROUND_TRUTH_ISSUES>

<SOURCE_CODE>
// file-processor.js
const fs = require('fs').promises;

async function processQueue(queueFile) {
  const data = JSON.parse(await fs.readFile(queueFile));  // line 5 - no try/catch
  return data.items.map(item => item.id);
}

async function updateCounter(counterFile) {
  const current = await fs.readFile(counterFile, 'utf8');  // line 12
  const next = parseInt(current) + 1;
  await fs.writeFile(counterFile, String(next));           // line 14
}

function logRequest(req) {
  const msg = `Request from ${req.ip} at ${Date.now()}`;  // line 18 - trap: looks like template injection but is safe
  console.log(msg);
}

module.exports = { processQueue, updateCounter, logRequest };
</SOURCE_CODE>

<REVIEW_OUTPUT>
WARNING: Line 5 — async error not caught. If `fs.readFile` or `JSON.parse` throws, the promise rejection propagates uncaught. Wrap in try/catch or add .catch() handler.

INFO: Line 18 — template literal in logRequest uses req.ip. Ensure ip is validated upstream to avoid log injection.

NOTE: The counter update on lines 12-14 uses a read-then-write pattern which is not atomic. Under concurrent load two requests could read the same value and both write n+1 instead of n+2.
</REVIEW_OUTPUT>
