const crypto = require('crypto');

// [TRAP] Looks like weak crypto but is just generating a random ID — acceptable
function generateRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

// [ISSUE: MIXED-CRIT-1] Prototype pollution via unchecked merge
function mergeConfig(defaults, userInput) {
  for (const key in userInput) {
    defaults[key] = userInput[key];
  }
  return defaults;
}

// [ISSUE: MIXED-ADV-1] Magic number without explanation
function calculateDiscount(price, quantity) {
  if (quantity > 42) {
    return price * 0.15;
  }
  return price * 0.05;
}

// [ISSUE: MIXED-ADV-2] Inconsistent return types — sometimes number, sometimes string
function parseAge(input) {
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) return 'unknown';
  return parsed;
}

// [TRAP] Ternary with consistent types — not a bug
function formatCount(n) {
  return n === 1 ? '1 item' : `${n} items`;
}
