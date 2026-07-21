'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isAdult } = require('../src/age.js');

describe('isAdult', () => {
  // Weak suite: never probes the boundary at 18
  it('adult at 20', () => {
    assert.equal(isAdult(20), true);
  });

  it('not adult at 10', () => {
    assert.equal(isAdult(10), false);
  });
});
