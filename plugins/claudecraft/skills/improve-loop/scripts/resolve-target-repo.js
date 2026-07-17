#!/usr/bin/env node
/**
 * resolve-target-repo.js — L3: resolve install-surface paths under ~/.claude
 * to the real git checkout when the install entry is a symlink.
 *
 * Usage:
 *   node resolve-target-repo.js --target-path <path> [--claude-home <dir>] [--json]
 *
 * Exit codes:
 *   0 ok (JSON on stdout)
 *   1 usage
 *   2 path missing
 *   3 broken symlink
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
    'usage: node resolve-target-repo.js --target-path <path> [--claude-home <dir>] [--json]'
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
const targetPath = path.resolve(targetArg);
const notes = [];

// lstat sees broken symlinks; existsSync does not (follows)
let st;
try {
  st = fs.lstatSync(targetPath);
} catch {
  console.error('resolve-target-repo: path missing: ' + targetPath);
  process.exit(2);
}

const underClaude = isUnder(targetPath, claudeHome);
const isSymlink = st.isSymbolicLink();
let resolvedPath = targetPath;
let symlinkFollowed = false;

if (isSymlink) {
  try {
    resolvedPath = fs.realpathSync(targetPath);
    if (resolvedPath !== targetPath) {
      symlinkFollowed = underClaude;
      if (symlinkFollowed) notes.push('symlink-followed');
      else notes.push('symlink-resolved-outside-claude-home-rule');
    }
  } catch (e) {
    console.error(
      'resolve-target-repo: symlink broken: ' + targetPath + ' — ' + errMsg(e)
    );
    process.exit(3);
  }
} else {
  try {
    // Normalize .. and such without requiring symlink follow
    resolvedPath = fs.realpathSync(targetPath);
  } catch {
    resolvedPath = targetPath;
  }
  if (underClaude) notes.push('under-claude-home-not-symlink');
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

if (!targetRepo) {
  const out = {
    target_path: targetPath,
    is_symlink: isSymlink,
    resolved_path: resolvedPath,
    under_claude_home: underClaude,
    claude_home: claudeHome,
    target_repo: null,
    symlink_followed: symlinkFollowed,
    notes,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(4);
}

const result = {
  target_path: targetPath,
  is_symlink: isSymlink,
  resolved_path: resolvedPath,
  under_claude_home: underClaude,
  claude_home: claudeHome,
  target_repo: targetRepo,
  symlink_followed: symlinkFollowed,
  notes,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
