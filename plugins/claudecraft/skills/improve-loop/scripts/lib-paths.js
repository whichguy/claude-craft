/**
 * Shared path resolution for improve-loop L3 scripts (stdlib only).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GIT = process.env.GIT_CMD || 'git';

/**
 * Agent hosts (e.g. Grok Build) sometimes export GIT_DIR / GIT_WORK_TREE so every
 * `git -C <repo>` still targets the outer session repo. L3 must ignore those for
 * `-C`-scoped work. Matches scripts.test.sh unset list.
 */
function gitSpawnEnv(extra) {
  const env = { ...process.env, ...(extra || {}) };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_COMMON_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  return env;
}

function git(repo, args, opts = {}) {
  try {
    const { env: envOpt, inheritStderr, ...rest } = opts;
    return execFileSync(GIT, ['-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', inheritStderr ? 'inherit' : 'pipe'],
      env: gitSpawnEnv(envOpt),
      ...rest,
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
  // Legacy launch-side locator (v1). Prefer runStatePaths(workspace) for v2.
  const base =
    process.env.IMPROVE_LOOP_POINTER_DIR ||
    path.join(commonGitDir, 'improve-loop');
  return {
    base,
    pointer: path.join(base, 'active.json'),
    lock: path.join(base, 'lock'),
  };
}

/** Canonical per-campaign run state lives inside the worktree (v2). */
function runStatePaths(workspace) {
  const dir = path.join(path.resolve(workspace), '.improve-loop');
  return {
    dir,
    state: path.join(dir, 'state.json'),
    lock: path.join(dir, 'lock'),
  };
}

/** Short-lived create mutex under launch .worktrees/ (not full pointer). */
function createLockPath(launch) {
  return path.join(path.resolve(launch), '.worktrees', '.improve-loop-create.lock');
}

function ensureImproveLoopGitignore(workspace) {
  const gi = path.join(workspace, '.gitignore');
  let body = '';
  if (fs.existsSync(gi)) body = fs.readFileSync(gi, 'utf8');
  const lines = body.split(/\r?\n/);
  const has = lines.some((l) => {
    const t = l.trim();
    return t === '.improve-loop/' || t === '.improve-loop';
  });
  if (!has) {
    const next =
      body.length === 0
        ? '.improve-loop/\n'
        : body.endsWith('\n')
          ? body + '.improve-loop/\n'
          : body + '\n.improve-loop/\n';
    fs.writeFileSync(gi, next, 'utf8');
    return { path: gi, changed: true };
  }
  return { path: gi, changed: false };
}

function readRunState(workspace) {
  if (!workspace) return null;
  const { state } = runStatePaths(workspace);
  if (!fs.existsSync(state)) return null;
  try {
    const obj = JSON.parse(fs.readFileSync(state, 'utf8'));
    if (!obj || typeof obj !== 'object') return null;
    // Denormalize for callers that still expect worktree_path
    if (!obj.worktree_path) obj.worktree_path = path.resolve(workspace);
    return obj;
  } catch {
    return null;
  }
}

function writeRunState(workspace, obj) {
  const { dir, state, lock } = runStatePaths(workspace);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.mkdirSync(lock);
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      const err = new Error('run-state lock busy at ' + lock);
      err.code = 'LOCK_BUSY';
      throw err;
    }
    throw e;
  }
  try {
    const o = { ...(obj || {}) };
    if (o.version == null) o.version = 2;
    if (o.target && !o.target_norm) {
      // normalizeTarget is defined below; call late via require cycle-safe inline
      o.target_norm = String(o.target)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    }
    o.worktree_path = path.resolve(workspace);
    const tmp = state + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(o, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, state);
    return state;
  } finally {
    try {
      fs.rmSync(lock, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function deleteRunState(workspace) {
  if (!workspace) return;
  const { dir, state } = runStatePaths(workspace);
  try {
    if (fs.existsSync(state)) fs.unlinkSync(state);
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Find live campaign worktrees with .improve-loop/state.json.
 * @returns {{ workspace: string, state: object }[]}
 */
function findActiveRuns(launch, opts = {}) {
  const results = [];
  const seen = new Set();
  const wantTarget = opts.target
    ? String(opts.target).toLowerCase().replace(/\s+/g, ' ').trim()
    : null;

  function consider(dir) {
    if (!dir || seen.has(dir)) return;
    if (!fs.existsSync(dir)) return;
    seen.add(dir);
    const st = readRunState(dir);
    if (!st) return;
    if (st.state !== 'active' && st.state !== 'reintegrate_blocked') return;
    if (wantTarget) {
      const tn =
        st.target_norm ||
        (st.target
          ? String(st.target).toLowerCase().replace(/\s+/g, ' ').trim()
          : '');
      if (tn && tn !== wantTarget) return;
    }
    results.push({ workspace: path.resolve(dir), state: st });
  }

  const wtRoot = path.join(launch, '.worktrees');
  if (fs.existsSync(wtRoot)) {
    try {
      for (const name of fs.readdirSync(wtRoot)) {
        if (name.startsWith('.')) continue;
        consider(path.join(wtRoot, name));
      }
    } catch {
      /* ignore */
    }
  }
  const claudeWt = path.join(launch, '.claude', 'worktrees');
  if (fs.existsSync(claudeWt)) {
    try {
      for (const name of fs.readdirSync(claudeWt)) {
        if (!name.startsWith('improve-')) continue;
        consider(path.join(claudeWt, name));
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const list = git(launch, ['worktree', 'list', '--porcelain']);
    for (const line of list.split('\n')) {
      if (line.startsWith('worktree ')) {
        consider(line.slice('worktree '.length).trim());
      }
    }
  } catch {
    /* ignore */
  }

  // Sort newest first
  results.sort((a, b) => {
    const ta = Date.parse(a.state.created_at || 0) || 0;
    const tb = Date.parse(b.state.created_at || 0) || 0;
    return tb - ta;
  });
  return results;
}

/**
 * Resolve one active run for a launch root (optional target filter).
 * Also migrates legacy $COMMON_GIT/improve-loop/active.json into wt state once.
 * @returns {{ workspace: string, state: object } | null}
 */
function resolveActiveRun(launch, commonGitDir, opts = {}) {
  let runs = findActiveRuns(launch, opts);
  if (runs.length === 1) return runs[0];
  if (runs.length > 1) {
    if (opts.target) {
      // already filtered — still ambiguous
      const err = new Error('ambiguous-run: multiple active worktrees');
      err.code = 'AMBIGUOUS_RUN';
      err.runs = runs;
      throw err;
    }
    // No target: prefer single most recent only if opts.allowNewest
    if (opts.allowNewest) return runs[0];
    const err = new Error('ambiguous-run: multiple active worktrees');
    err.code = 'AMBIGUOUS_RUN';
    err.runs = runs;
    throw err;
  }

  // Legacy external pointer migrate
  const { pointer } = pointerPaths(commonGitDir);
  if (fs.existsSync(pointer)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(pointer, 'utf8'));
      const wt = legacy.worktree_path;
      if (wt && fs.existsSync(wt)) {
        const migrated = {
          version: 2,
          state: legacy.state || 'active',
          target: legacy.target || opts.target || null,
          target_norm: legacy.target
            ? String(legacy.target).toLowerCase().replace(/\s+/g, ' ').trim()
            : null,
          test_command: legacy.test_command || null,
          launch_root: legacy.launch_root || launch,
          launch_branch: legacy.launch_branch || null,
          launch_head_at_enter: legacy.launch_head || null,
          campaign_branch: legacy.campaign_branch || null,
          created_at: legacy.created_at || new Date().toISOString(),
          carried_paths: legacy.carried_paths || [],
          carried_wip_at_enter: !!legacy.carried_wip_at_enter,
          reintegrate_error: legacy.reintegrate_error || null,
          worktree_path: wt,
          migrated_from: 'legacy-active.json',
        };
        try {
          writeRunState(wt, migrated);
        } catch {
          /* if lock fails, still return legacy shape */
        }
        // Clear external pointer after successful migrate
        try {
          fs.unlinkSync(pointer);
        } catch {
          /* ignore */
        }
        return { workspace: path.resolve(wt), state: readRunState(wt) || migrated };
      }
      // Stale pointer — clear
      try {
        fs.unlinkSync(pointer);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore bad JSON */
    }
  }
  return null;
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
 *   set (incl. "" or "-") → fully overrides profile prefixes **and** path allowlist
 *   unset → use IMPROVE_LOOP_AMBIENT_PROFILE (default none = legacy cron/, wiki/)
 *
 * Env IMPROVE_LOOP_AMBIENT_PROFILE (only when PREFIXES unset):
 *   none (default) → cron/, wiki/ only (no basenames) — legacy, no regression
 *   agent-home     → cron/, wiki/, memories/ + path-qualified scripts/hermes_release_watch.py
 */
function ambientProfileName() {
  const raw = String(process.env.IMPROVE_LOOP_AMBIENT_PROFILE || 'none')
    .trim()
    .toLowerCase();
  if (raw === 'agent-home' || raw === 'agent_home') return 'agent-home';
  return 'none';
}

function ambientPrefixes() {
  if (Object.prototype.hasOwnProperty.call(process.env, 'IMPROVE_LOOP_AMBIENT_PREFIXES')) {
    const raw = String(process.env.IMPROVE_LOOP_AMBIENT_PREFIXES || '').trim();
    if (raw === '' || raw === '-') return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => (p.endsWith('/') ? p : p + '/'));
  }
  if (ambientProfileName() === 'agent-home') {
    return ['cron/', 'wiki/', 'memories/'];
  }
  // profile none / default: legacy defaults
  return ['cron/', 'wiki/'];
}

/**
 * Path-qualified ambient files (not bare basenames anywhere).
 * Empty when PREFIXES is set (override) or profile is none.
 */
function ambientPathAllowlist() {
  if (Object.prototype.hasOwnProperty.call(process.env, 'IMPROVE_LOOP_AMBIENT_PREFIXES')) {
    return [];
  }
  if (ambientProfileName() === 'agent-home') {
    return ['scripts/hermes_release_watch.py'];
  }
  return [];
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
  if (
    prefs.some((pre) => n === pre.slice(0, -1) || n.startsWith(pre))
  ) {
    return true;
  }
  const allow = ambientPathAllowlist();
  return allow.some((a) => n === a || n.endsWith('/' + a));
}

/** Subjects that count as improve-loop campaign commits (merge-back rebase-safe). */
const IMPROVE_LOOP_SUBJECT = /^improve-loop: (iteration |archive )/;

/**
 * Count commits on campaign not in launch that have improve-loop subjects.
 * Range: launchBranch..campaignBranch (exclusive start, inclusive tip).
 */
function countUnmergedImproveCommits(launch, launchBranch, campaignBranch) {
  if (!launch || !launchBranch || !campaignBranch) return 0;
  const range = launchBranch + '..' + campaignBranch;
  const out = git(launch, ['log', range, '--format=%s']);
  if (!out) return 0;
  let n = 0;
  for (const line of out.split('\n')) {
    if (IMPROVE_LOOP_SUBJECT.test(String(line || '').trim())) n++;
  }
  return n;
}

/**
 * Whether campaign isolation must not be discarded/teardown'd without force.
 *
 * Protected when:
 *   - unmerged improve-loop commits on campaign vs launch, OR
 *   - ptr.state === reintegrate_blocked and we cannot prove empty improve range
 *     (git error / missing branches → fail-closed protected)
 *
 * Empty-range exception: reintegrate_blocked but tip already ancestor of launch
 * (0 unmerged improve commits, scan succeeded) → not protected.
 *
 * @returns {{
 *   protected: boolean,
 *   reason: string|null,
 *   unmergedImproveCount: number,
 *   campaign_branch: string|null,
 *   launch_branch: string|null,
 *   scan_error: string|null
 * }}
 */
function isReintegrateProtected(launch, ptr) {
  const empty = {
    protected: false,
    reason: null,
    unmergedImproveCount: 0,
    campaign_branch: null,
    launch_branch: null,
    scan_error: null,
  };
  if (!ptr || typeof ptr !== 'object') return empty;

  const campaign = ptr.campaign_branch || null;
  const launchBranch = ptr.launch_branch || null;
  const stateBlocked = ptr.state === 'reintegrate_blocked';
  let unmerged = 0;
  let scanError = null;

  if (campaign && launchBranch && launch) {
    try {
      // Ensure refs exist; missing ref throws → fail-closed when blocked
      git(launch, ['rev-parse', '--verify', campaign]);
      git(launch, ['rev-parse', '--verify', launchBranch]);
      unmerged = countUnmergedImproveCommits(launch, launchBranch, campaign);
    } catch (e) {
      scanError = errMsg(e).slice(0, 160);
    }
  } else if (stateBlocked) {
    return {
      protected: true,
      reason: 'reintegrate_blocked_missing_branches',
      unmergedImproveCount: 0,
      campaign_branch: campaign,
      launch_branch: launchBranch,
      scan_error: 'missing campaign_branch or launch_branch',
    };
  }

  if (unmerged > 0) {
    return {
      protected: true,
      reason: 'unmerged_improve',
      unmergedImproveCount: unmerged,
      campaign_branch: campaign,
      launch_branch: launchBranch,
      scan_error: scanError,
    };
  }

  if (stateBlocked) {
    if (scanError) {
      return {
        protected: true,
        reason: 'reintegrate_blocked_scan_error',
        unmergedImproveCount: 0,
        campaign_branch: campaign,
        launch_branch: launchBranch,
        scan_error: scanError,
      };
    }
    // Empty improve range — exception (do not require porcelain-clean launch)
    return {
      protected: false,
      reason: 'empty_range_exception',
      unmergedImproveCount: 0,
      campaign_branch: campaign,
      launch_branch: launchBranch,
      scan_error: null,
    };
  }

  return {
    protected: false,
    reason: null,
    unmergedImproveCount: 0,
    campaign_branch: campaign,
    launch_branch: launchBranch,
    scan_error: scanError,
  };
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
    ambient_paths: ambientPathAllowlist(),
    ambient_profile: Object.prototype.hasOwnProperty.call(
      process.env,
      'IMPROVE_LOOP_AMBIENT_PREFIXES'
    )
      ? 'prefixes-override'
      : ambientProfileName(),
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
  gitSpawnEnv,
  errMsg,
  resolveRepo,
  commonGit,
  launchRoot,
  pointerPaths,
  runStatePaths,
  createLockPath,
  ensureImproveLoopGitignore,
  readRunState,
  writeRunState,
  deleteRunState,
  findActiveRuns,
  resolveActiveRun,
  slugify,
  stampSlug,
  ensureWorktreesGitignore,
  isUnder,
  porcelainPath,
  porcelain,
  porcelainEntries,
  listUntrackedFilesUnder,
  ambientPrefixes,
  ambientProfileName,
  ambientPathAllowlist,
  litterGlobs,
  isIsolationDirt,
  isAmbientDirt,
  isLitterPath,
  normalizeTarget,
  classifyLaunchDirt,
  cleanUntrackedLitter,
  isTracked,
  randomHex,
  IMPROVE_LOOP_SUBJECT,
  countUnmergedImproveCommits,
  isReintegrateProtected,
};
