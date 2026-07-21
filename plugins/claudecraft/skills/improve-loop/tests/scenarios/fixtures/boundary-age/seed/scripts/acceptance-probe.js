#!/usr/bin/env node
'use strict';
/**
 * Operator-card acceptance probe: boundary at 18 must be adult.
 * Fails on seed (false green) even when suite is green.
 */
const assert = require('node:assert/strict');
const { isAdult } = require('../src/age.js');
assert.equal(isAdult(18), true, 'isAdult(18) must be true (>= 18)');
console.log('acceptance-probe PASS');
