#!/usr/bin/env node
/**
 * resolve-target-repo.js — L3: resolve install-surface paths under ~/.claude
 * to the real git checkout when the install entry (leaf or ancestor) is a symlink.
 *
 * Usage:
 *   node resolve-target-repo.js --target-path <path> [--claude-home <dir>]
 *
 * Always call when the candidate path is under claude-home (package dir, file, or a
 * path *inside* a package-dir install symlink). On exit 0, use json.target_repo as
 * TARGET_REPO. symlink_followed is observability (kickoff card), not a gate.
 *
 * Exit codes:
 *   0 ok (JSON on stdout)
 *   1 usage
 *   2 path missing
 *   3 broken symlink (leaf or intermediate under claude-home)
 *   4 no git root for resolved path
 *
 * Injectable: GIT_CMD
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { git, errMsg, isUnder } = require('./lib-paths.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node resolve-target-repo.js --target-path <path> [--claude-home <dir>]'
  );
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

const targetArg = arg('--target-path');
if (!targetArg) usage('require --target-path');

const claudeHome = path.resolve(
  arg('--claude-home') || process.env.CLAUDE_HOME || path.join(process.env.HOME || '', '.claude')
);
let claudeHomeReal = claudeHome;
try {
  claudeHomeReal = fs.realpathSync(claudeHome);
} catch {
  /* home may not exist yet in fixtures */
}

const targetPath = path.resolve(targetArg);
const notes = [];

// lstat sees broken leaf symlinks; existsSync does not (follows)
let st;
try {
  st = fs.lstatSync(targetPath);
} catch {
  console.error('resolve-target-repo: path missing: ' + targetPath);
  process.exit(2);
}

const underClaude =
  isUnder(targetPath, claudeHome) || isUnder(targetPath, claudeHomeReal);
const isSymlink = st.isSymbolicLink();
let resolvedPath = targetPath;

try {
  resolvedPath = fs.realpathSync(targetPath);
} catch (e) {
  // Broken leaf or intermediate install symlink
  if (isSymlink || underClaude) {
    console.error(
      'resolve-target-repo: symlink broken: ' + targetPath + ' — ' + errMsg(e)
    );
    process.exit(3);
  }
  notes.push('realpath-failed: ' + errMsg(e).slice(0, 80));
}

const resolvedOutsideHome =
  underClaude &&
  !isUnder(resolvedPath, claudeHome) &&
  !isUnder(resolvedPath, claudeHomeReal);

const leafSymlinkMoved =
  isSymlink && path.resolve(resolvedPath) !== path.resolve(targetPath);

// Install follow: left claude-home after realpath (dir/file/ancestor), or leaf symlink moved
let symlinkFollowed = false;
if (underClaude && (resolvedOutsideHome || leafSymlinkMoved)) {
  symlinkFollowed = true;
  notes.push(
    resolvedOutsideHome ? 'symlink-followed-left-home' : 'symlink-followed-within-home'
  );
} else if (underClaude) {
  // Real path still under install home (no product-repo escape)
  notes.push('under-claude-home-realpath-stayed');
} else if (isSymlink) {
  notes.push('symlink-outside-claude-home');
}

// Git root: if path is a file, start from dirname
let gitProbe = resolvedPath;
try {
  if (fs.statSync(resolvedPath).isFile()) gitProbe = path.dirname(resolvedPath);
} catch {
  /* use as-is */
}

let targetRepo = null;
try {
  targetRepo = path.resolve(git(gitProbe, ['rev-parse', '--show-toplevel']));
  const bare = git(targetRepo, ['rev-parse', '--is-bare-repository']);
  if (bare === 'true') {
    targetRepo = null;
    notes.push('bare-repository-rejected');
  }
} catch (e) {
  notes.push('no-git-root: ' + errMsg(e).slice(0, 120));
}

const out = {
  target_path: targetPath,
  is_symlink: isSymlink,
  resolved_path: resolvedPath,
  under_claude_home: underClaude,
  claude_home: claudeHome,
  target_repo: targetRepo,
  symlink_followed: symlinkFollowed,
  notes,
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(targetRepo ? 0 : 4);
