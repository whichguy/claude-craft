#!/usr/bin/env node
/**
 * pointer.js — L3: flock-guarded RMW for improve-loop active.json
 *
 * Usage:
 *   node pointer.js read  --git-common-dir <abs>
 *   node pointer.js write --git-common-dir <abs> --json '<object|@file|->'
 *   node pointer.js clear --git-common-dir <abs>
 *   node pointer.js set-reintegrate-blocked --git-common-dir <abs> --error <msg>
 *
 * Exit codes:
 *   0 ok
 *   1 usage / parse
 *   2 missing pointer (read)
 *   3 IO / lock failure
 *   4 invalid JSON / schema
 *
 * Injectable: IMPROVE_LOOP_POINTER_DIR (override full dir instead of <gcd>/improve-loop)
 */
'use strict';

const fs = require('fs');
const path = require('path');

function usage(msg) {
  if (msg) console.error(msg);
  console.error(`usage:
  node pointer.js read  --git-common-dir <abs>
  node pointer.js write --git-common-dir <abs> --json '<obj|@file|->'
  node pointer.js clear --git-common-dir <abs>
  node pointer.js set-reintegrate-blocked --git-common-dir <abs> --error <msg>`);
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

function dirs(gcd) {
  const base =
    process.env.IMPROVE_LOOP_POINTER_DIR ||
    path.join(path.resolve(gcd), 'improve-loop');
  return {
    base,
    pointer: path.join(base, 'active.json'),
    lock: path.join(base, 'lock'),
  };
}

/** Best-effort exclusive lock via mkdir (atomic on POSIX). */
function withLock(lockDir, fn) {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  let acquired = false;
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      fs.mkdirSync(lockDir);
      acquired = true;
      break;
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        // stale lock > 120s → reclaim
        try {
          const st = fs.statSync(lockDir);
          if (Date.now() - st.mtimeMs > 120_000) {
            fs.rmSync(lockDir, { recursive: true, force: true });
            continue;
          }
        } catch {
          /* ignore */
        }
        // short backoff without SharedArrayBuffer
        const end = Date.now() + 20;
        while (Date.now() < end) {
          /* spin */
        }
        continue;
      }
      throw e;
    }
  }
  if (!acquired) {
    console.error('pointer: could not acquire lock: ' + lockDir);
    process.exit(3);
  }
  try {
    return fn();
  } finally {
    try {
      fs.rmSync(lockDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('pointer: invalid JSON: ' + e.message);
    process.exit(4);
  }
}

function validatePointer(obj) {
  if (!obj || typeof obj !== 'object') {
    console.error('pointer: not an object');
    process.exit(4);
  }
  if (obj.version !== 1 && obj.version !== undefined) {
    // allow missing version for write; require for read completeness
  }
  return obj;
}

function cmdRead(gcd) {
  const { pointer } = dirs(gcd);
  if (!fs.existsSync(pointer)) {
    console.error('pointer: missing ' + pointer);
    process.exit(2);
  }
  const obj = validatePointer(readJson(pointer));
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function cmdWrite(gcd, jsonSpec) {
  if (!jsonSpec) usage('write requires --json');
  let raw;
  if (jsonSpec === '-') {
    raw = fs.readFileSync(0, 'utf8');
  } else if (jsonSpec.startsWith('@')) {
    raw = fs.readFileSync(jsonSpec.slice(1), 'utf8');
  } else {
    raw = jsonSpec;
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error('pointer: --json parse failed: ' + e.message);
    process.exit(4);
  }
  if (obj.version == null) obj.version = 1;
  validatePointer(obj);
  const { base, pointer, lock } = dirs(gcd);
  withLock(lock, () => {
    fs.mkdirSync(base, { recursive: true });
    const tmp = pointer + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, pointer);
  });
  process.stdout.write(pointer + '\n');
}

function cmdClear(gcd) {
  const { pointer, lock, base } = dirs(gcd);
  withLock(lock, () => {
    if (fs.existsSync(pointer)) fs.unlinkSync(pointer);
    // leave base dir
  });
  process.stdout.write('cleared\n');
}

function cmdReintegrateBlocked(gcd, errMsg) {
  const { pointer, lock, base } = dirs(gcd);
  withLock(lock, () => {
    if (!fs.existsSync(pointer)) {
      console.error('pointer: missing ' + pointer);
      process.exit(2);
    }
    const obj = readJson(pointer);
    obj.state = 'reintegrate_blocked';
    obj.reintegrate_error = errMsg || 'unknown';
    const tmp = pointer + '.tmp.' + process.pid;
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, pointer);
  });
  process.stdout.write('reintegrate_blocked\n');
}

const action = process.argv[2];
const gcd = arg('--git-common-dir');
if (!action || !gcd) usage();

try {
  switch (action) {
    case 'read':
      cmdRead(gcd);
      break;
    case 'write':
      cmdWrite(gcd, arg('--json'));
      break;
    case 'clear':
      cmdClear(gcd);
      break;
    case 'set-reintegrate-blocked':
      cmdReintegrateBlocked(gcd, arg('--error') || 'blocked');
      break;
    default:
      usage('unknown action: ' + action);
  }
} catch (e) {
  console.error('pointer: ' + (e && e.message ? e.message : e));
  process.exit(3);
}
