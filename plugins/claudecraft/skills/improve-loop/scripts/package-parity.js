#!/usr/bin/env node
/**
 * B↔M improve-loop package parity (stdlib only).
 *
 * ## Scope (WP0 — pin this; greppable)
 * package-parity compares **B↔M only** (user skill vs marketplace mirror).
 * **A is out of scope** — A carries references/ law only; scripts live in B and
 * mirror to M. Never inspects claude-craft A tree; never claims A/script sync.
 *
 * Ship set compared when both peers exist:
 *   SKILL.md, scripts/**, tests/**, references/goal-objective.template.md
 *
 * Marketplace (M) must not carry A-style extra references/* (only goal template).
 *
 * Usage:
 *   node package-parity.js [--skill-dir <path>] [--peer <path>] [--json]
 *   node package-parity.js --self-test
 *
 * Exit: 0 ok or soft peer_absent skip; 1 usage / hard fail (drift, A-dump,
 *       peer_incomplete partial ship, forced peer_missing). --json prints the
 *       result object then exits with the **same** code (never exit 0 on ok:false).
 *
 * Peer policy:
 *   - peer directory **absent** → soft-skip when softMissingPeer (default CLI)
 *   - peer directory **exists but incomplete** (no scripts/*) → **always hard fail**
 *     (H18 partial ship — SKILL-only marketplace stub must not green)
 *
 * Env:
 *   IMPROVE_LOOP_PARITY=0  — callers (contract-check) may skip parity entirely
 *   HOME — default peer discovery
 *
 * Injectable: none (pure fs)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USER_REL = path.join('.claude', 'skills', 'improve-loop');
const MARKET_REL = path.join(
  '.claude',
  'plugins',
  'marketplaces',
  'claude-craft',
  'plugins',
  'claudecraft',
  'skills',
  'improve-loop'
);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function has(name) {
  return process.argv.includes(name);
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileSha(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function walkFiles(root, base = root, out = []) {
  if (!exists(root)) return out;
  for (const name of fs.readdirSync(root)) {
    if (name === '.' || name === '..') continue;
    const abs = path.join(root, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(abs, base, out);
    else if (st.isFile()) out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out;
}

function packageRole(skillDir) {
  const n = path.resolve(skillDir).split(path.sep).join('/');
  if (n.includes('/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop')) {
    return 'marketplace';
  }
  if (n.endsWith('/.claude/skills/improve-loop') || n.endsWith('/skills/improve-loop')) {
    // Prefer user if under .claude/skills
    if (n.includes('/.claude/skills/improve-loop')) return 'user';
  }
  return 'unknown';
}

function defaultPeer(skillDir, home) {
  const role = packageRole(skillDir);
  const h = home || process.env.HOME || '';
  if (!h) return null;
  if (role === 'user') return path.join(h, MARKET_REL);
  if (role === 'marketplace') return path.join(h, USER_REL);
  // unknown: try both
  const user = path.join(h, USER_REL);
  const market = path.join(h, MARKET_REL);
  const resolved = path.resolve(skillDir);
  if (path.resolve(user) === resolved) return market;
  if (path.resolve(market) === resolved) return user;
  return null;
}

/**
 * Allowed relative paths under ship set (exact files + all under scripts/ and tests/).
 */
function collectShipRelPaths(skillDir) {
  const rels = new Set();
  const skill = path.join(skillDir, 'SKILL.md');
  if (exists(skill)) rels.add('SKILL.md');
  const goal = path.join(skillDir, 'references', 'goal-objective.template.md');
  if (exists(goal)) rels.add('references/goal-objective.template.md');
  for (const sub of ['scripts', 'tests']) {
    const root = path.join(skillDir, sub);
    if (!isDir(root)) continue;
    for (const r of walkFiles(root)) {
      rels.add(`${sub}/${r}`);
    }
  }
  return [...rels].sort();
}

/**
 * Marketplace must not ship A-style references dumps.
 */
function extraReferencesErrors(skillDir) {
  const errors = [];
  const refDir = path.join(skillDir, 'references');
  if (!isDir(refDir)) return errors;
  const files = walkFiles(refDir);
  for (const r of files) {
    if (r !== 'goal-objective.template.md') {
      errors.push(`extra references (A-dump forbidden on B/M): references/${r}`);
    }
  }
  return errors;
}

/**
 * @param {{ skillDir: string, peerDir?: string|null, home?: string, softMissingPeer?: boolean }} opts
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, errors: string[], role?: string, peer?: string }}
 */
function checkParity(opts) {
  const skillDir = path.resolve(opts.skillDir);
  const home = opts.home || process.env.HOME || '';
  const softMissingPeer = opts.softMissingPeer !== false;
  const errors = [];
  const role = packageRole(skillDir);

  // Always enforce M-shape references rule on this package if it looks like B/M
  // (has scripts/ + only goal template expected).
  if (isDir(path.join(skillDir, 'scripts'))) {
    errors.push(...extraReferencesErrors(skillDir));
  }

  let peerDir =
    opts.peerDir != null && opts.peerDir !== ''
      ? path.resolve(opts.peerDir)
      : defaultPeer(skillDir, home);

  // Incomplete install stubs (e.g. contract-check FAKE_HOME with SKILL only) are not peers.
  // A real B/M peer has SKILL.md + a non-empty scripts/ directory.
  function peerLooksComplete(dir) {
    if (!isDir(dir) || !exists(path.join(dir, 'SKILL.md'))) return false;
    const scripts = path.join(dir, 'scripts');
    if (!isDir(scripts)) return false;
    try {
      return fs.readdirSync(scripts).some((n) => n.endsWith('.js') || n.endsWith('.sh'));
    } catch {
      return false;
    }
  }

  const peerExists = !!(peerDir && isDir(peerDir));
  const peerComplete = peerExists && peerLooksComplete(peerDir);

  if (!peerExists) {
    // Local shape errors (e.g. A-dump) still fail even when peer is missing.
    if (errors.length) {
      return {
        ok: false,
        skipped: false,
        reason: 'local_shape',
        errors,
        role,
        peer: peerDir || null,
      };
    }
    if (softMissingPeer) {
      return {
        ok: true,
        skipped: true,
        reason: 'peer_missing',
        errors: [],
        role,
        peer: peerDir || null,
      };
    }
    return {
      ok: false,
      skipped: false,
      reason: 'peer_missing',
      errors: ['peer package directory missing'],
      role,
      peer: peerDir || null,
    };
  }

  // Peer path exists but is not a complete B/M ship set → H18 partial ship (always hard).
  // Never soft-skip incomplete stubs (SKILL-only marketplace dump).
  if (!peerComplete) {
    return {
      ok: false,
      skipped: false,
      reason: 'peer_incomplete',
      errors: [
        ...errors,
        'peer package incomplete (partial ship): need SKILL.md + scripts/* (H18)',
      ],
      role,
      peer: peerDir,
    };
  }

  // Peer also must not have A-dump if it is marketplace-shaped
  if (packageRole(peerDir) === 'marketplace' || isDir(path.join(peerDir, 'scripts'))) {
    // Only apply extra-ref fail for marketplace role strictly; user B also only has goal template
    errors.push(
      ...extraReferencesErrors(peerDir).map((e) => `peer: ${e}`)
    );
  }

  const aRels = collectShipRelPaths(skillDir);
  const bRels = collectShipRelPaths(peerDir);
  const aSet = new Set(aRels);
  const bSet = new Set(bRels);

  for (const r of aRels) {
    if (!bSet.has(r)) errors.push(`only in skill-dir: ${r}`);
  }
  for (const r of bRels) {
    if (!aSet.has(r)) errors.push(`only in peer: ${r}`);
  }

  for (const r of aRels) {
    if (!bSet.has(r)) continue;
    const pa = path.join(skillDir, r);
    const pb = path.join(peerDir, r);
    try {
      if (fileSha(pa) !== fileSha(pb)) {
        errors.push(`content differs: ${r}`);
      }
    } catch (e) {
      errors.push(`compare failed ${r}: ${e.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    errors,
    role,
    peer: peerDir,
  };
}

function selfTest() {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-loop-parity-'));
  const a = path.join(tmp, 'user');
  const b = path.join(tmp, 'market');
  const mk = (root) => {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(root, 'references'), { recursive: true });
    fs.writeFileSync(path.join(root, 'SKILL.md'), '# skill\n');
    fs.writeFileSync(path.join(root, 'scripts', 'x.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(root, 'tests', 't.sh'), '#!/bin/sh\n');
    fs.writeFileSync(
      path.join(root, 'references', 'goal-objective.template.md'),
      '# goal <TARGET>\n'
    );
  };
  mk(a);
  mk(b);

  let r = checkParity({ skillDir: a, peerDir: b, softMissingPeer: false });
  if (!r.ok) throw new Error('equal packages should pass: ' + r.errors.join('; '));

  fs.writeFileSync(path.join(b, 'scripts', 'x.js'), 'module.exports = 2;\n');
  r = checkParity({ skillDir: a, peerDir: b, softMissingPeer: false });
  if (r.ok || !r.errors.some((e) => /content differs: scripts\/x\.js/.test(e))) {
    throw new Error('drift should fail content differs: ' + JSON.stringify(r));
  }

  fs.writeFileSync(path.join(b, 'scripts', 'x.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(b, 'references', 'phase-1-execute.md'), '# dump\n');
  r = checkParity({ skillDir: a, peerDir: b, softMissingPeer: false });
  if (r.ok || !r.errors.some((e) => /extra references|only in peer: references/.test(e))) {
    throw new Error('A-dump should fail: ' + JSON.stringify(r));
  }

  r = checkParity({
    skillDir: a,
    peerDir: path.join(tmp, 'nope'),
    softMissingPeer: true,
  });
  if (!r.ok || !r.skipped) throw new Error('soft peer_missing should skip ok');

  // Incomplete peer (SKILL-only) must **hard-fail** even with softMissingPeer (H18 partial ship).
  const stub = path.join(tmp, 'stub-market');
  fs.mkdirSync(stub, { recursive: true });
  fs.writeFileSync(path.join(stub, 'SKILL.md'), '# stub only\n');
  r = checkParity({ skillDir: a, peerDir: stub, softMissingPeer: true });
  if (r.ok || r.skipped || r.reason !== 'peer_incomplete') {
    throw new Error('incomplete peer must hard-fail (H18): ' + JSON.stringify(r));
  }
  if (!r.errors.some((e) => /partial ship|incomplete/i.test(e))) {
    throw new Error('incomplete peer error text: ' + JSON.stringify(r));
  }

  r = checkParity({
    skillDir: a,
    peerDir: path.join(tmp, 'nope'),
    softMissingPeer: false,
  });
  if (r.ok || r.reason !== 'peer_missing') {
    throw new Error('hard peer_missing should fail: ' + JSON.stringify(r));
  }

  // cleanup best-effort
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (_) {}
  console.log('package-parity self-test PASS');
  return 0;
}

function main() {
  if (has('--self-test')) {
    try {
      process.exit(selfTest());
    } catch (e) {
      console.error('package-parity self-test FAIL:', e.message);
      process.exit(1);
    }
  }

  const home = process.env.HOME || '';
  const skillDir = arg(
    '--skill-dir',
    path.join(home, USER_REL)
  );
  const peerArg = arg('--peer', null);
  const json = has('--json');

  if (!isDir(skillDir)) {
    console.error('usage: package-parity.js --skill-dir <path> [--peer <path>] [--json]');
    console.error('skill-dir missing:', skillDir);
    process.exit(1);
  }

  const result = checkParity({
    skillDir,
    peerDir: peerArg,
    home,
    softMissingPeer: true,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.skipped) {
    console.log('OK: package-parity skipped (peer_missing)');
    console.log('skill-dir:', skillDir);
  } else if (result.ok) {
    console.log('PASS: package-parity ship set matches peer');
    console.log('skill-dir:', skillDir);
    console.log('peer:', result.peer);
  } else {
    console.error('FAIL: package-parity');
    for (const e of result.errors || []) console.error(' -', e);
  }
  // Same exit law for --json and text: ok/skipped → 0; hard fail → 1
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  checkParity,
  collectShipRelPaths,
  packageRole,
  defaultPeer,
  extraReferencesErrors,
  USER_REL,
  MARKET_REL,
};

if (require.main === module) {
  main();
}
