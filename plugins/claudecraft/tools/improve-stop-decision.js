#!/usr/bin/env node
'use strict';
/**
 * Thin executable shim → skill ship-set implementation.
 * Canonical body: skills/improve-loop/scripts/improve-stop-decision.js
 * (Live dual-home has only the scripts/ copy; tools/ stays for law/CLI paths.)
 */
const impl = require('../skills/improve-loop/scripts/improve-stop-decision.js');

module.exports = impl;

if (require.main === module) {
  impl.main(process.argv.slice(2));
}
