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
 * Normalize campaign target strings for equality (different-target discard).
 * Collapses whitespace/case so "ask skill" vs "Ask  skill" still match.
 */
function normalizeTarget(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ephemeral runtime litter that must not block merge-back / enter.
 *
 * Env IMPROVE_LOOP_LITTER_GLOBS:
 *   unset → defaults (bundled_manifest_*.tmp, *~, leading-dot *.tmp basenames)
 *   "" or "-" → no litter patterns (strict)
 *   comma-separated basename globs with * only (e.g. "*.tmp,.cache_*")
 */
function litterGlobs() {
  if (!Object.prototype.hasOwnProperty.call(process.env, 'IMPROVE_LOOP_LITTER_GLOBS')) {
    return ['.bundled_manifest_*.tmp', '*~', '.*.tmp'];
  }
  const raw = String(process.env.IMPROVE_LOOP_LITTER_GLOBS || '').trim();
  if (raw === '' || raw === '-') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function globToRegExp(glob) {
  const g = String(glob || '');
  let re = '^';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') re += '.*';
    else if ('\\.[]{}()+-^$|?'.includes(c)) re += '\\' + c;
    else re += c;
  }
  re += '$';
  return new RegExp(re);
}

function isLitterPath(p, globs) {
  const n = String(p || '').replace(/^\.\//, '');
  const base = path.basename(n);
  const list = globs || litterGlobs();
  if (!list.length) return false;
  // Always treat Hermes/agent bundled-manifest temps as litter by basename prefix
  // even when env overrides omit the default (prefix still common).
  if (/^\.bundled_manifest_.*\.tmp$/i.test(base)) return true;
  return list.some((g) => globToRegExp(g).test(base));
}

/**
 * Walk an untracked directory (git often reports only `?? skills/`) and yield
 * relative file paths so litter basenames can match. Caps depth to avoid
 * scanning huge trees.
 */
function listUntrackedFilesUnder(repo, relDir, maxDepth) {
  const depthCap = maxDepth == null ? 6 : maxDepth;
  const root = path.join(repo, relDir);
  const out = [];
  function walk(abs, rel, depth) {
    if (depth > depthCap) return;
    let names;
    try {
      names = fs.readdirSync(abs);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === '.git') continue;
      const childAbs = path.join(abs, name);
      const childRel = rel ? rel + '/' + name : name;
      let st;
      try {
        st = fs.lstatSync(childAbs);
      } catch {
        continue;
      }
      if (st.isDirectory() && !st.isSymbolicLink()) {
        walk(childAbs, childRel, depth + 1);
      } else if (st.isFile() || st.isSymbolicLink()) {
        out.push(childRel);
      }
    }
  }
  if (!fs.existsSync(root)) return out;
  let st;
  try {
    st = fs.lstatSync(root);
  } catch {
    return out;
  }
  if (!st.isDirectory()) return out;
  walk(root, String(relDir || '').replace(/\/$/, ''), 0);
  return out;
}

/**
 * Parse porcelain into { path, xy, untracked } rows.
 * xy is the two-char status (or single-char padded).
 *
 * Untracked directories (`?? skills/`) are expanded to contained files so
 * litter globs (basename) and ambient/code classification see real paths —
 * git only reports the directory when the whole tree is untracked.
 */
function porcelainEntries(repo) {
  const out = git(repo, ['status', '--porcelain']);
  if (!out) return [];
  const rows = [];
  for (const line of out.split('\n').filter(Boolean)) {
    const s = String(line);
    let xy = '  ';
    if (s.length >= 3 && s[2] === ' ') xy = s.slice(0, 2);
    else if (s.length >= 2 && s[1] === ' ') xy = s[0] + ' ';
    const p = porcelainPath(line);
    const untracked = xy.includes('?');
    if (!p) continue;
    const abs = path.join(repo, p.replace(/\/$/, ''));
    let isDir = p.endsWith('/');
    if (!isDir && untracked) {
      try {
        isDir = fs.lstatSync(abs).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (untracked && isDir) {
      const files = listUntrackedFilesUnder(repo, p.replace(/\/$/, ''));
      if (files.length === 0) {
        // empty or unreadable dir — keep the dir row so code dirt still surfaces
        rows.push({ path: p.replace(/\/$/, '') + '/', xy, untracked: true });
      } else {
        for (const f of files) {
          rows.push({ path: f, xy: '??', untracked: true });
        }
      }
    } else {
      rows.push({ path: p, xy, untracked });
    }
  }
  return rows;
}

/**
 * Classify launch porcelain paths into code (blocks), ambient (runtime, non-blocking),
 * isolation (campaign plumbing, non-blocking), and litter (ephemeral temps, non-blocking).
 *
 * `paths` may be string[] or porcelainEntries() rows. When only strings are given,
 * litter is still matched by basename (caller should prefer entries for untracked-only
 * auto-clean).
 */
function classifyLaunchDirt(paths) {
  const prefixes = ambientPrefixes();
  const globs = litterGlobs();
  const isolation = [];
  const ambient = [];
  const litter = [];
  const code = [];
  for (const item of paths || []) {
    const p = typeof item === 'string' ? item : item && item.path;
    if (!p) continue;
    if (isIsolationDirt(p)) isolation.push(p);
    else if (isAmbientDirt(p, prefixes)) ambient.push(p);
    else if (isLitterPath(p, globs)) litter.push(p);
    else code.push(p);
  }
  return {
    code,
    ambient,
    isolation,
    litter,
    ambient_prefixes: prefixes,
    litter_globs: globs,
  };
}

/**
 * Best-effort delete of **untracked** litter paths under repo.
 * Never deletes tracked files. Returns { removed, skipped, notes }.
 */
function cleanUntrackedLitter(repo, entriesOrPaths) {
  const notes = [];
  const removed = [];
  const skipped = [];
  const globs = litterGlobs();
  if (!globs.length && !Object.prototype.hasOwnProperty.call(process.env, 'IMPROVE_LOOP_LITTER_GLOBS')) {
    // defaults still active via isLitterPath bundled_manifest rule
  }
  let entries = entriesOrPaths;
  if (!entries || !entries.length) {
    try {
      entries = porcelainEntries(repo);
    } catch (e) {
      notes.push('litter-clean-list-fail:' + errMsg(e).slice(0, 80));
      return { removed, skipped, notes };
    }
  }
  // Expand untracked dirs (porcelain may only list `?? skills/`) so litter
  // basenames inside become unlink candidates.
  const expanded = [];
  for (const item of entries) {
    const p = typeof item === 'string' ? item : item && item.path;
    if (!p) continue;
    const untracked =
      typeof item === 'string' ? !isTracked(repo, p) : !!item.untracked;
    const abs = path.join(repo, String(p).replace(/\/$/, ''));
    let isDir = String(p).endsWith('/');
    if (!isDir) {
      try {
        isDir = fs.lstatSync(abs).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (untracked && isDir) {
      for (const f of listUntrackedFilesUnder(repo, String(p).replace(/\/$/, ''))) {
        expanded.push({ path: f, untracked: true });
      }
    } else {
      expanded.push(
        typeof item === 'string' ? { path: p, untracked } : { path: p, untracked }
      );
    }
  }

  for (const item of expanded) {
    const p = item.path;
    const untracked = !!item.untracked;
    if (!p || !isLitterPath(p, globs)) continue;
    if (!untracked) {
      skipped.push(p);
      notes.push('litter-skip-tracked:' + p);
      continue;
    }
    const abs = path.join(repo, p);
    try {
      if (!fs.existsSync(abs)) {
        skipped.push(p);
        continue;
      }
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) {
        // refuse recursive dir deletes of litter dirs for safety
        skipped.push(p);
        notes.push('litter-skip-dir:' + p);
        continue;
      }
      fs.unlinkSync(abs);
      removed.push(p);
    } catch (e) {
      skipped.push(p);
      notes.push('litter-clean-fail:' + p + ':' + errMsg(e).slice(0, 60));
    }
  }
  if (removed.length) notes.push('litter-cleaned:' + removed.length);
  if (removed.length && removed.length <= 12) {
    notes.push('litter-cleaned-paths:' + removed.join(','));
  }
  return { removed, skipped, notes };
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
  porcelainEntries,
  listUntrackedFilesUnder,
  ambientPrefixes,
  litterGlobs,
  isIsolationDirt,
  isAmbientDirt,
  isLitterPath,
  normalizeTarget,
  classifyLaunchDirt,
  cleanUntrackedLitter,
  isTracked,
  randomHex,
};
