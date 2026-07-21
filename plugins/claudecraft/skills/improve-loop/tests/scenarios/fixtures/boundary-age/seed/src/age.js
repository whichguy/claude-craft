'use strict';

/**
 * INTENTIONAL BUG: uses > 18 so age 18 is not adult (should be >= 18).
 * Seed suite is intentionally weak and still PASSES — false green / test-gap.
 */
function isAdult(age) {
  return age > 18;
}

module.exports = { isAdult };
