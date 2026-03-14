// [TRAP] Name matches behavior — correct
function isEven(n) {
  return n % 2 === 0;
}

// [ISSUE: INTENT-1] Function name says "remove" but it filters IN matching items
function removeInactive(users) {
  return users.filter(u => !u.active);
}

// [ISSUE: INTENT-2] Says "sum" but returns the average
function sumScores(scores) {
  if (scores.length === 0) return 0;
  const total = scores.reduce((a, b) => a + b, 0);
  return total / scores.length;
}

// [ISSUE: INTENT-3] Returns wrong type — docs say string[], returns single string
/**
 * Get active user names
 * @returns {string[]} Array of active user names
 */
function getActiveUserNames(users) {
  const active = users.filter(u => u.active);
  return active.map(u => u.name).join(', ');
}
