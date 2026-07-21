'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { add, mul } = require('../src/math.js');

describe('math', () => {
  it('add sums', () => {
    assert.equal(add(2, 3), 5);
  });

  it('mul multiplies', () => {
    assert.equal(mul(2, 3), 6);
  });
});
