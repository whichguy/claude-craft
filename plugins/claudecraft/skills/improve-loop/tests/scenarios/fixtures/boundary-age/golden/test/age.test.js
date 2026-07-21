'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isAdult } = require('../src/age.js');

describe('isAdult', () => {
  it('adult at 20', () => {
    assert.equal(isAdult(20), true);
  });

  it('not adult at 10', () => {
    assert.equal(isAdult(10), false);
  });

  // Test debt landed with the fix — suite now covers the boundary
  it('adult at boundary 18', () => {
    assert.equal(isAdult(18), true);
  });
});
