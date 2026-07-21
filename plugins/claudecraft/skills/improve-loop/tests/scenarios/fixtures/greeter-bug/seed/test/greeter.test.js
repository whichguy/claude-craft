'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('../src/greeter.js');

describe('greeter', () => {
  it('greets by name', () => {
    assert.equal(greet('Ada'), 'Hello, Ada!');
  });

  it('greets with non-empty name still runs', () => {
    const out = greet('Bob');
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  });
});
