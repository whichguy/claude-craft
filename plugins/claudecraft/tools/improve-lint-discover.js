#!/usr/bin/env node
'use strict';
/**
 * improve-lint-discover.js — discover linters for a git repo, fingerprint configs,
 * cache under <repo>/.git/improve-runs/lint-map.json.
 *
 * No network. Does not install tools. Marks tools available only when a binary
 * (or local node_modules/.bin) exists.
 *
 * CLI:
 *   improve-lint-discover.js discover --repo <path> [--force-refresh]
 *   improve-lint-discover.js match  --repo <path> --paths a b …  [--force-refresh]
 *   improve-lint-discover.js run-plan --repo <path> --paths a b …  [--force-refresh]
 *     → JSON { status, linters:[{id,cmd,paths,scope}], skip_reason? }
 *
 * Cache stores fingerprints + last map for observability. Every discover/run-plan
 * re-resolves binaries (available + absolute cmd) so npm install / PATH changes apply.
 *
 * Exit: 0 ok, 1 usage, 2 IO/parse error
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_VERSION = 1;
const CACHE_NAME = 'lint-map.json';

const JS_GLOBS = ['*.js', '*.mjs', '*.cjs', '*.ts', '*.tsx', '*.jsx'];
const PY_GLOBS = ['*.py'];
const SH_GLOBS = ['*.sh', '*.bash'];
const RS_GLOBS = ['*.rs'];
const GO_GLOBS = ['*.go'];
const BIOME_GLOBS = [...JS_GLOBS, '*.json', '*.css'];
/** make-lint residual: source-ish only — never bare `*` (docs-only must not whole-repo lint). */
const MAKE_RESIDUAL_GLOBS = [...JS_GLOBS, ...PY_GLOBS, ...SH_GLOBS, ...RS_GLOBS, ...GO_GLOBS];
const JS_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const SH_EXTS = new Set(['.sh', '.bash']);

function usage() {
  process.stderr.write(
    'Usage:\n' +
      '  improve-lint-discover.js discover --repo <path> [--force-refresh]\n' +
      '  improve-lint-discover.js match  --repo <path> --paths <p>… [--force-refresh]\n' +
      '  improve-lint-discover.js run-plan --repo <path> --paths <p>… [--force-refresh]\n'
  );
}

function sha256File(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return null;
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(filePath));
    h.update(String(st.size));
    return h.digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function firstExisting(repo, names) {
  for (const n of names) {
    const p = path.join(repo, n);
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function which(bin, repo) {
  // Prefer local node_modules/.bin (no login shell — deterministic PATH walk).
  if (repo) {
    const local = path.join(repo, 'node_modules', '.bin', bin);
    try {
      if (fs.existsSync(local)) return local;
    } catch {
      /* ignore */
    }
  }
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** @returns {'js'|'sh'|'py'|'other'|null} */
function readShebangKind(repo, filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(repo || '', filePath);
  try {
    const fd = fs.openSync(abs, 'r');
    const buf = Buffer.alloc(120);
    const n = fs.readSync(fd, buf, 0, 120, 0);
    fs.closeSync(fd);
    const head = buf.slice(0, n).toString('utf8');
    if (!head.startsWith('#!')) return null;
    const line = head.split(/\r?\n/)[0].toLowerCase();
    if (/\bnodejs\b|\bnode\b/.test(line)) return 'js';
    if (/\b(bash|sh|dash|ksh|zsh)\b/.test(line)) return 'sh';
    if (/\bpython(\d+(\.\d+)?)?\b/.test(line)) return 'py';
    return 'other';
  } catch {
    return null;
  }
}

function makefileHasTarget(repo, target) {
  const mf = firstExisting(repo, ['Makefile', 'makefile', 'GNUmakefile']);
  if (!mf) return false;
  try {
    const text = fs.readFileSync(mf, 'utf8');
    // Lines like "lint:" or "lint :" at start (allow .PHONY noise nearby)
    const re = new RegExp(`^${target}\\s*:`, 'm');
    return re.test(text);
  } catch {
    return false;
  }
}

function readPackageJson(repo) {
  const p = path.join(repo, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function fingerprintRepo(repo) {
  const files = {
    package_json: path.join(repo, 'package.json'),
    makefile: firstExisting(repo, ['Makefile', 'makefile', 'GNUmakefile']),
    eslint_config: firstExisting(repo, [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml',
      '.eslintrc',
    ]),
    pyproject: path.join(repo, 'pyproject.toml'),
    ruff_toml: path.join(repo, 'ruff.toml'),
    biome_json: firstExisting(repo, ['biome.json', 'biome.jsonc']),
    pre_commit_config: path.join(repo, '.pre-commit-config.yaml'),
    cargo_toml: path.join(repo, 'Cargo.toml'),
    go_mod: path.join(repo, 'go.mod'),
  };
  const fp = {};
  for (const [k, f] of Object.entries(files)) {
    if (!f) {
      fp[k] = null;
      continue;
    }
    fp[k] = sha256File(f);
  }
  return fp;
}

function fingerprintsEqual(a, b) {
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] || null) !== (b[k] || null)) return false;
  }
  return true;
}

function cachePath(repo) {
  // Prefer .git/improve-runs (shared by worktrees)
  let gitDir = path.join(repo, '.git');
  try {
    if (fs.existsSync(gitDir) && fs.statSync(gitDir).isFile()) {
      // worktree: .git is a file "gitdir: ..."
      const raw = fs.readFileSync(gitDir, 'utf8').trim();
      const m = raw.match(/^gitdir:\s*(.+)$/i);
      if (m) {
        const wtGit = path.resolve(repo, m[1].trim());
        // common-dir is parent of worktrees/<name>
        const common = path.resolve(wtGit, '../..');
        return path.join(common, 'improve-runs', CACHE_NAME);
      }
    }
  } catch {
    /* fall through */
  }
  // main checkout: .git is a directory
  if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
    return path.join(gitDir, 'improve-runs', CACHE_NAME);
  }
  // not a git repo — local fallback (still untracked if gitignored)
  return path.join(repo, '.improve-lint-cache.json');
}

function loadCache(repo) {
  const p = cachePath(repo);
  try {
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (o && o.version === CACHE_VERSION) return { path: p, data: o };
  } catch {
    /* miss */
  }
  return { path: p, data: null };
}

function saveCache(repo, data) {
  const p = cachePath(repo);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return p;
}

/**
 * Simple *.ext / * globs. Extensionless files match only via shebang (repo required).
 * @param {string} filePath
 * @param {string} glob
 * @param {string|null} [repo]
 */
function pathMatchesGlob(filePath, glob, repo) {
  const base = path.basename(filePath);
  if (glob === '*') return true;
  if (glob.startsWith('*.')) {
    const ext = glob.slice(1).toLowerCase(); // e.g. ".js"
    if (base.toLowerCase().endsWith(ext)) return true;
    // Extensionless: require shebang probe — never claim JS for bare Python/bash scripts.
    if (!base.includes('.') && repo) {
      const kind = readShebangKind(repo, filePath);
      if (kind === 'js' && JS_EXTS.has(ext)) return true;
      if (kind === 'sh' && SH_EXTS.has(ext)) return true;
      if (kind === 'py' && ext === '.py') return true;
    }
    return false;
  }
  return base === glob;
}

/**
 * @param {string} filePath
 * @param {object} linter
 * @param {string|null} [repo] — needed for extensionless shebang matching
 */
function pathMatchesLinter(filePath, linter, repo) {
  const globs = (linter.when && linter.when.globs) || [];
  if (!globs.some((g) => pathMatchesGlob(filePath, g, repo))) return false;
  const prefixes = (linter.when && linter.when.paths_prefix) || null;
  if (prefixes && prefixes.length) {
    // Hard filter: if prefixes are set, path must match at least one.
    const norm = filePath.replace(/\\/g, '/');
    return prefixes.some((pre) => {
      const bare = pre.replace(/\/$/, '');
      const withSlash = bare + '/';
      return norm === bare || norm.startsWith(withSlash);
    });
  }
  return true;
}

function buildLinters(repo) {
  const linters = [];
  const pkg = readPackageJson(repo);
  // Prefer local/node_modules or PATH eslint — avoid bare `npx eslint` (may network-install).
  const eslintLocal = (() => {
    try {
      const p = path.join(repo, 'node_modules', '.bin', 'eslint');
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
    return which('eslint', null); // PATH only, not npx
  })();
  const eslintBin = eslintLocal;
  const hasEslintConfig = !!firstExisting(repo, [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    '.eslintrc',
  ]);

  // package.json scripts.lint — prefer path-scoped eslint if script body is eslint
  if (pkg && pkg.scripts && typeof pkg.scripts.lint === 'string') {
    const body = pkg.scripts.lint.trim();
    const isEslint = /\beslint\b/.test(body);
    const isBiome = /\bbiome\b/.test(body);
    if (isEslint && eslintBin) {
      linters.push({
        id: 'eslint',
        cmd: [eslintBin, '--max-warnings=0'],
        when: { globs: JS_GLOBS.slice() },
        requires_bin: ['eslint'],
        source: 'package.json#scripts.lint',
        available: true,
        scope: 'paths',
      });
    } else if (isEslint && !eslintBin) {
      linters.push({
        id: 'eslint',
        cmd: ['eslint', '--max-warnings=0'],
        when: { globs: JS_GLOBS.slice() },
        requires_bin: ['eslint'],
        source: 'package.json#scripts.lint',
        available: false, // no local/PATH eslint; do not npx-install
        scope: 'paths',
      });
    } else if (isBiome && which('biome', repo)) {
      linters.push({
        id: 'biome',
        cmd: [which('biome', repo), 'check'],
        when: { globs: BIOME_GLOBS.slice() },
        requires_bin: ['biome'],
        source: 'package.json#scripts.lint',
        available: true,
        scope: 'paths',
      });
    } else if (body) {
      // Opaque npm script — whole-repo when any matching js path
      linters.push({
        id: 'npm-lint',
        cmd: [which('npm', repo) || 'npm', 'run', 'lint', '--if-present'],
        when: { globs: JS_GLOBS.slice() },
        requires_bin: ['npm'],
        source: 'package.json#scripts.lint (opaque)',
        available: !!(which('npm', repo)),
        scope: 'whole-repo',
      });
    }
  }

  // Standalone eslint config without scripts.lint
  if (!linters.some((l) => l.id === 'eslint') && hasEslintConfig) {
    linters.push({
      id: 'eslint',
      cmd: [eslintBin || 'eslint', '--max-warnings=0'],
      when: { globs: JS_GLOBS.slice() },
      requires_bin: ['eslint'],
      source: 'eslint.config.*',
      available: !!eslintBin,
      scope: 'paths',
    });
  }

  // biome.json
  if (!linters.some((l) => l.id === 'biome')) {
    const biomeCfg = firstExisting(repo, ['biome.json', 'biome.jsonc']);
    const biomeBin = which('biome', repo);
    if (biomeCfg && biomeBin) {
      linters.push({
        id: 'biome',
        cmd: [biomeBin, 'check'],
        when: { globs: BIOME_GLOBS.slice() },
        requires_bin: ['biome'],
        source: path.basename(biomeCfg),
        available: true,
        scope: 'paths',
      });
    }
  }

  // ruff
  const ruffCfg =
    firstExisting(repo, ['ruff.toml']) ||
    (sha256File(path.join(repo, 'pyproject.toml')) && path.join(repo, 'pyproject.toml'));
  const ruffBin = which('ruff', repo);
  if (ruffBin && (firstExisting(repo, ['ruff.toml', 'pyproject.toml']))) {
    // only if pyproject mentions ruff or ruff.toml exists
    let want = !!firstExisting(repo, ['ruff.toml']);
    if (!want && fs.existsSync(path.join(repo, 'pyproject.toml'))) {
      try {
        const t = fs.readFileSync(path.join(repo, 'pyproject.toml'), 'utf8');
        want = /\bruff\b/.test(t);
      } catch {
        want = false;
      }
    }
    if (want) {
      linters.push({
        id: 'ruff',
        cmd: [ruffBin, 'check'],
        when: { globs: PY_GLOBS.slice() },
        requires_bin: ['ruff'],
        source: ruffCfg ? path.basename(ruffCfg) : 'ruff',
        available: true,
        scope: 'paths',
      });
    }
  }

  // shellcheck (path-scoped; register before make-lint fallback decision)
  const shellcheck = which('shellcheck', repo);
  if (shellcheck) {
    linters.push({
      id: 'shellcheck',
      // -S warning: fail on warning+; ignore pure info (e.g. SC1091 not following).
      cmd: [shellcheck, '-S', 'warning'],
      when: { globs: SH_GLOBS.slice() },
      requires_bin: ['shellcheck'],
      source: 'PATH',
      available: true,
      scope: 'paths',
    });
  }

  // clippy
  if (fs.existsSync(path.join(repo, 'Cargo.toml')) && which('cargo', repo)) {
    linters.push({
      id: 'clippy',
      cmd: ['cargo', 'clippy', '--', '-D', 'warnings'],
      when: { globs: RS_GLOBS.slice() },
      requires_bin: ['cargo'],
      source: 'Cargo.toml',
      available: true,
      scope: 'whole-repo',
    });
  }

  // go vet
  if (fs.existsSync(path.join(repo, 'go.mod')) && which('go', repo)) {
    linters.push({
      id: 'go-vet',
      cmd: ['go', 'vet', './...'],
      when: { globs: GO_GLOBS.slice() },
      requires_bin: ['go'],
      source: 'go.mod',
      available: true,
      scope: 'whole-repo',
    });
  }

  // Makefile lint — residual for source-ish paths not covered by a specific tool.
  // Skip when the project declares eslint/biome lint but the bin is missing: many
  // Makefiles soft-pass ("run npm install first") and would false-green improve cycles.
  const preferredJsLinterMissing = linters.some(
    (l) => (l.id === 'eslint' || l.id === 'biome') && l.available === false
  );
  if (makefileHasTarget(repo, 'lint') && !preferredJsLinterMissing) {
    linters.push({
      id: 'make-lint',
      cmd: ['make', 'lint'],
      when: { globs: MAKE_RESIDUAL_GLOBS.slice() },
      requires_bin: ['make'],
      source: 'Makefile#lint',
      available: !!which('make', repo),
      scope: 'whole-repo',
    });
  }

  return linters;
}

function discover(repo, { forceRefresh = false } = {}) {
  const abs = path.resolve(repo);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw Object.assign(new Error(`not a directory: ${abs}`), { code: 2 });
  }
  const fp = fingerprintRepo(abs);
  const { path: cpath, data: cached } = loadCache(abs);
  const fingerprintHit =
    !forceRefresh &&
    cached &&
    fingerprintsEqual(cached.fingerprint, fp) &&
    Array.isArray(cached.linters);

  // Always re-resolve binaries (available + absolute cmd). Cache hit only means
  // config fingerprint matched — never freeze a stale eslint path or available:false
  // after the operator runs npm install.
  const linters = buildLinters(abs);
  const data = {
    version: CACHE_VERSION,
    repo: abs,
    created_at: fingerprintHit && cached.created_at ? cached.created_at : new Date().toISOString(),
    fingerprint: fp,
    linters,
  };
  const saved = saveCache(abs, data);
  return { ...data, cache_path: saved, cache_hit: !!fingerprintHit };
}

function matchPaths(map, paths, repo) {
  const root = repo || (map && map.repo) || null;
  const list = (paths || []).map((p) => p.replace(/\\/g, '/'));
  const selected = [];
  const covered = new Set();
  const linters = map.linters || [];

  // Prefer non-make tools first so make-lint is only a residual fallback.
  const ordered = [
    ...linters.filter((l) => l.id !== 'make-lint'),
    ...linters.filter((l) => l.id === 'make-lint'),
  ];

  for (const lint of ordered) {
    if (!lint.available) continue;
    let matched = list.filter((p) => pathMatchesLinter(p, lint, root));
    if (lint.id === 'make-lint') {
      // Only source paths not already covered by a more specific tool.
      matched = matched.filter((p) => !covered.has(p));
    }
    if (matched.length === 0) continue;
    for (const p of matched) covered.add(p);
    selected.push({
      id: lint.id,
      cmd: lint.cmd.slice(),
      paths: matched,
      scope: lint.scope || 'paths',
      source: lint.source,
    });
  }
  return selected;
}

function runPlan(repo, paths, opts) {
  const map = discover(repo, opts);
  const list = (paths || []).filter(Boolean);
  if (list.length === 0) {
    return {
      status: 'skipped',
      skip_reason: 'no paths',
      linters: [],
      cache_hit: map.cache_hit,
      cache_path: map.cache_path,
    };
  }
  const selected = matchPaths(map, list, map.repo);
  if (selected.length === 0) {
    return {
      status: 'skipped',
      skip_reason: 'no matching tools',
      linters: [],
      discovered: (map.linters || []).map((l) => ({ id: l.id, available: l.available })),
      cache_hit: map.cache_hit,
      cache_path: map.cache_path,
    };
  }
  return {
    status: 'ready',
    skip_reason: null,
    linters: selected,
    cache_hit: map.cache_hit,
    cache_path: map.cache_path,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const out = { cmd, repo: null, forceRefresh: false, paths: [] };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--repo') out.repo = args[++i];
    else if (a === '--force-refresh') out.forceRefresh = true;
    else if (a === '--paths') {
      while (args[i + 1] && !args[i + 1].startsWith('--')) out.paths.push(args[++i]);
    } else if (a === '--paths-file') {
      const f = args[++i];
      const text = fs.readFileSync(f, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (t && !t.startsWith('#')) out.paths.push(t);
      }
    } else if (a === '-h' || a === '--help') out.cmd = 'help';
    else if (!a.startsWith('-')) out.paths.push(a);
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.cmd || opts.cmd === 'help') {
    usage();
    process.exit(opts.cmd === 'help' ? 0 : 1);
  }
  if (!opts.repo) {
    usage();
    process.exit(1);
  }
  try {
    if (opts.cmd === 'discover') {
      const map = discover(opts.repo, { forceRefresh: opts.forceRefresh });
      process.stdout.write(JSON.stringify(map, null, 2) + '\n');
      process.exit(0);
    }
    if (opts.cmd === 'match') {
      const map = discover(opts.repo, { forceRefresh: opts.forceRefresh });
      const selected = matchPaths(map, opts.paths, map.repo);
      process.stdout.write(JSON.stringify({ selected, cache_hit: map.cache_hit }, null, 2) + '\n');
      process.exit(0);
    }
    if (opts.cmd === 'run-plan') {
      const plan = runPlan(opts.repo, opts.paths, { forceRefresh: opts.forceRefresh });
      process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
      process.exit(0);
    }
    usage();
    process.exit(1);
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e) + '\n');
    process.exit(e && e.code === 2 ? 2 : 1);
  }
}

module.exports = {
  discover,
  matchPaths,
  runPlan,
  fingerprintRepo,
  fingerprintsEqual,
  pathMatchesGlob,
  pathMatchesLinter,
  readShebangKind,
  cachePath,
  buildLinters,
  which,
  MAKE_RESIDUAL_GLOBS,
  CACHE_VERSION,
};

if (require.main === module) main();
