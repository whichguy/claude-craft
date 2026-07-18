/**
 * Shared path resolution for improve-loop L3 scripts (stdlib only).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GIT = process.env.GIT_CMD || 'git';

function git(repo, args, opts = {}) {
  try {
    return execFileSync(GIT, ['-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', opts.inheritStderr ? 'inherit' : 'pipe'],
      ...opts,
    }).trim();
  } catch (e) {
    // Normalize stderr so callers can always String(e.stderr)
    if (e && e.stderr != null && !Buffer.isBuffer(e.stderr)) {
      /* already string when encoding utf8 */
    } else if (e && Buffer.isBuffer(e.stderr)) {
      e.stderr = e.stderr.toString('utf8');
    }
    throw e;
  }
}

/** Human-readable git/child error for logs. */
function errMsg(e) {
  if (!e) return 'unknown error';
  const se = e.stderr != null ? String(e.stderr).trim() : '';
  if (se) return se;
  return e.message ? String(e.message) : String(e);
}

function resolveRepo(repoArg) {
  const abs = path.resolve(repoArg);
  const top = git(abs, ['rev-parse', '--show-toplevel']);
  return path.resolve(top);
}

function commonGit(repo) {
  // prefer absolute path-format when available
  try {
    return path.resolve(
      git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    );
  } catch {
    const rel = git(repo, ['rev-parse', '--git-common-dir']);
    return path.resolve(repo, rel);
  }
}

function launchRoot(commonGitDir) {
  // primary worktree = dirname of absolute --git-common-dir for non-bare
  return path.dirname(commonGitDir);
}

function pointerPaths(commonGitDir) {
  const base =
    process.env.IMPROVE_LOOP_POINTER_DIR ||
    path.join(commonGitDir, 'improve-loop');
  return {
    base,
    pointer: path.join(base, 'active.json'),
    lock: path.join(base, 'lock'),
  };
}

function slugify(target) {
  const s = String(target || 'target')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'target';
}

function randomHex(n) {
  // n hex chars
  const buf = require('crypto').randomBytes(Math.ceil(n / 2));
  return buf.toString('hex').slice(0, n);
}

function stampSlug(target) {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const ts =
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
  return `${slugify(target)}-${ts}-${randomHex(6)}`;
}

function ensureWorktreesGitignore(launch) {
  const gi = path.join(launch, '.gitignore');
  let body = '';
  if (fs.existsSync(gi)) body = fs.readFileSync(gi, 'utf8');
  const lines = body.split(/\r?\n/);
  const has = lines.some((l) => l.trim() === '.worktrees/');
  if (!has) {
    const next =
      body.length === 0
        ? '.worktrees/\n'
        : body.endsWith('\n')
          ? body + '.worktrees/\n'
          : body + '\n.worktrees/\n';
    fs.writeFileSync(gi, next, 'utf8');
    return { path: gi, changed: true };
  }
  return { path: gi, changed: false };
}

function isUnder(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  return c === p || c.startsWith(p + path.sep);
}

/**
 * Parse one `git status --porcelain` line to a path.
 * Standard form is `XY PATH` (two status chars + space). Some git/worktree
 * combinations have been observed to emit a single status char + space
 * (`M path`); tolerate that so ambient filters see `cron/...` not `ron/...`.
 */
function porcelainPath(line) {
  const s = String(line || '');
  let rest;
  if (s.length >= 3 && s[2] === ' ') {
    rest = s.slice(3); // XY PATH
  } else if (s.length >= 2 && s[1] === ' ') {
    rest = s.slice(2); // X PATH (tolerant)
  } else {
    rest = s;
  }
  if (rest.includes(' -> ')) {
    rest = rest.split(' -> ').pop();
  }
  // unquote C-style quoted paths
  if (rest.startsWith('"') && rest.endsWith('"')) {
    rest = rest.slice(1, -1);
  }
  return rest;
}

function porcelain(repo) {
  const out = git(repo, ['status', '--porcelain']);
  if (!out) return [];
  return out.split('\n').filter(Boolean).map(porcelainPath);
}

/**
 * Ambient launch-dirt prefixes (runtime noise that must not block enter/merge-back).
 *
 * Env IMPROVE_LOOP_AMBIENT_PREFIXES:
 *   unset     → defaults cron/, wiki/ (agent home-dir data repos like ~/.hermes)
 *   "" or "-" → no ambient prefixes (strict: only isolation dirt is non-blocking)
 *   "a/,b/"   → use that comma-separated list (trailing / optional)
 */
function ambientPrefixes() {
  if (!Object.prototype.hasOwnProperty.call(process.env, 'IMPROVE_LOOP_AMBIENT_PREFIXES')) {
    return ['cron/', 'wiki/'];
  }
  const raw = String(process.env.IMPROVE_LOOP_AMBIENT_PREFIXES || '').trim();
  if (raw === '' || raw === '-') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (p.endsWith('/') ? p : p + '/'));
}

function isIsolationDirt(p) {
  const n = String(p || '').replace(/^\.\//, '');
  return (
    n === 'IMPROVE_LOOP.md' ||
    n === '.gitignore' ||
    n === '.worktrees' ||
    n.startsWith('.worktrees/')
  );
}

function isAmbientDirt(p, prefixes) {
  const n = String(p || '').replace(/^\.\//, '');
  const prefs = prefixes || ambientPrefixes();
  return prefs.some(
    (pre) => n === pre.slice(0, -1) || n.startsWith(pre)
  );
}

/**
 * Classify launch porcelain paths into code (blocks), ambient (runtime, non-blocking),
 * and isolation (campaign plumbing, non-blocking).
 */
function classifyLaunchDirt(paths) {
  const prefixes = ambientPrefixes();
  const isolation = [];
  const ambient = [];
  const code = [];
  for (const p of paths || []) {
    if (isIsolationDirt(p)) isolation.push(p);
    else if (isAmbientDirt(p, prefixes)) ambient.push(p);
    else code.push(p);
  }
  return { code, ambient, isolation, ambient_prefixes: prefixes };
}

function isTracked(repo, filePath) {
  try {
    git(repo, ['ls-files', '--error-unmatch', '--', filePath]);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  GIT,
  git,
  errMsg,
  resolveRepo,
  commonGit,
  launchRoot,
  pointerPaths,
  slugify,
  stampSlug,
  ensureWorktreesGitignore,
  isUnder,
  porcelainPath,
  porcelain,
  ambientPrefixes,
  isIsolationDirt,
  isAmbientDirt,
  classifyLaunchDirt,
  isTracked,
  randomHex,
};
