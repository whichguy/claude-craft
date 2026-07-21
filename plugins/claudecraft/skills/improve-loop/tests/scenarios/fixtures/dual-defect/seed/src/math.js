'use strict';

/** INTENTIONAL: add is wrong (subtracts). */
function add(a, b) {
  return a - b;
}

/** INTENTIONAL: mul is wrong (returns a only). */
function mul(a, b) {
  return a;
}

module.exports = { add, mul };
