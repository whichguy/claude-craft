#!/usr/bin/env node
// k=N orchestrator. For runs=1, runs run-fixture + grade-run once and
// copies r1/grade.json up. For runs>1, spawns k run-fixture.js calls in
// parallel, then k grade-run.js calls in parallel, then grade-aggregate.js.
//
// CLI:  node bin/run-bench.js <fixture.md> <run-dir>
// API:  const { runBench } = require('./run-bench'); runBench(fixturePath, runDir)

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n[\s\S]*$/;
const BIN_DIR = __dirname;

function parseFrontmatter(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) throw new Error(`fixture missing frontmatter: ${fixturePath}`);
  return yaml.load(m[1]);
}

function spawnPromise(cmd, args, opts) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, Object.assign({ stdio: ['ignore', 'pipe', 'pipe'] }, opts));
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', d => { stdout += d.toString(); });
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    p.on('error', (err) => resolve({ status: -1, signal: null, stdout, stderr: stderr + String(err) }));
  });
}

async function runBench(fixturePath, runDir) {
  const fm = parseFrontmatter(fixturePath);
  const runs = fm.runs !== undefined ? Number(fm.runs) : 1;
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`runs must be a positive integer; got ${fm.runs}`);
  }
  const fixtureTimeoutMs = (Number(fm.timeout_seconds) + 30) * 1000;
  fs.mkdirSync(runDir, { recursive: true });

  // Phase A: run k replicas in parallel.
  const replicaDirs = [];
  const runFixtureBin = path.join(BIN_DIR, 'run-fixture.js');
  const runPromises = [];
  for (let i = 1; i <= runs; i++) {
    const replicaDir = path.join(runDir, `r${i}`);
    fs.mkdirSync(replicaDir, { recursive: true });
    replicaDirs.push(replicaDir);
    runPromises.push(spawnPromise(process.execPath,
      [runFixtureBin, fixturePath, replicaDir, '--replica-id', String(i)],
      { timeout: fixtureTimeoutMs }));
  }
  const runResults = await Promise.all(runPromises);
  for (let i = 0; i < runResults.length; i++) {
    if (runResults[i].status !== 0) {
      process.stderr.write(`run-bench: replica r${i + 1} run-fixture exited ${runResults[i].status} (signal=${runResults[i].signal}); stderr: ${runResults[i].stderr}\n`);
    }
  }

  // Phase B: grade each replica in parallel.
  const gradeFixtureBin = path.join(BIN_DIR, 'grade-run.js');
  const gradePromises = [];
  for (const replicaDir of replicaDirs) {
    gradePromises.push(spawnPromise(process.execPath,
      [gradeFixtureBin, fixturePath, replicaDir],
      { timeout: 60000 }));
  }
  const gradeResults = await Promise.all(gradePromises);
  for (let i = 0; i < gradeResults.length; i++) {
    // grade-run exits 1 on FAIL — that's fine, only >1 is a crash
    if (gradeResults[i].status > 1) {
      throw new Error(`grade-run for r${i + 1} crashed: status=${gradeResults[i].status} stderr=${gradeResults[i].stderr}`);
    }
  }

  // Phase C: aggregate (or fast-path copy for k=1).
  if (runs === 1) {
    const r1 = path.join(runDir, 'r1', 'grade.json');
    fs.copyFileSync(r1, path.join(runDir, 'grade.json'));
    const grade = JSON.parse(fs.readFileSync(path.join(runDir, 'grade.json'), 'utf8'));
    return grade;
  }
  const aggBin = path.join(BIN_DIR, 'grade-aggregate.js');
  const aggResult = spawnSync(process.execPath, [aggBin, fixturePath, runDir], { encoding: 'utf8', timeout: 60000 });
  if (aggResult.status > 1) {
    throw new Error(`grade-aggregate crashed: ${aggResult.stderr}`);
  }
  const grade = JSON.parse(fs.readFileSync(path.join(runDir, 'grade.json'), 'utf8'));
  return grade;
}

if (require.main === module) {
  const [fixturePath, runDir] = process.argv.slice(2);
  if (!fixturePath || !runDir) {
    process.stderr.write('usage: run-bench.js <fixture.md> <run-dir>\n');
    process.exit(2);
  }
  runBench(path.resolve(fixturePath), path.resolve(runDir))
    .then(g => process.exit(g.overall === 'PASS' ? 0 : 1))
    .catch(e => { process.stderr.write(`run-bench.js: ${e.message}\n`); process.exit(2); });
}

module.exports = { runBench };
