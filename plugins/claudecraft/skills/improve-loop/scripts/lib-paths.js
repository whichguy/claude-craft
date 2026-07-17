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

function porcelain(repo) {
  const out = git(repo, ['status', '--porcelain']);
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((line) => {
    // XY PATH or XY ORIG -> NEW
    const rest = line.slice(3);
    if (rest.includes(' -> ')) {
      return rest.split(' -> ').pop();
    }
    return rest.replace(/^"/, '').replace(/"$/, '');
  });
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
  porcelain,
  isTracked,
  randomHex,
};
