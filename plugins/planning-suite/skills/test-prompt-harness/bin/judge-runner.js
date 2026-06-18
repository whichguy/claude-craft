#!/usr/bin/env node
// LLM-as-judge runner for semantic pass_conditions.
//
// Spawns a single-shot `claude -p --output-format json` invocation with the
// rubric + view content piped on stdin. Parses the assistant's final text
// out of the response and returns {verdict, reasoning, judge_model,
// judge_duration_ms}.
//
// Response shape (grounded in fixtures/_golden/golden-judge.json):
//   `claude -p --output-format json --verbose ...` writes a JSON ARRAY of
//   events to stdout. The terminal event with `type === "result"` carries
//   the assistant's final text in its `.result` string. That string MAY be
//   wrapped in a ```json … ``` (or bare ```…```) markdown fence — strip
//   the fence before JSON.parse.
//
// Test seam: runJudge(args, input, { spawn }) accepts an injectable spawn
// (defaults to require('child_process').spawnSync). Tests inject a fake
// spawn that returns a canned stdout/status; no claude binary needed on
// the default `npm test` path.

'use strict';

const { spawnSync: realSpawnSync } = require('child_process');
const crypto = require('crypto');

const FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/m;

function extractAssistantText(stdout) {
  // The response is a JSON array of events; find the terminal `result` event.
  let arr;
  try {
    arr = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`judge stdout was not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(arr)) {
    throw new Error(`judge stdout was not a JSON array (top-level type=${typeof arr})`);
  }
  // Walk in reverse to find the result event.
  for (let i = arr.length - 1; i >= 0; i--) {
    const ev = arr[i];
    if (ev && ev.type === 'result' && typeof ev.result === 'string') {
      return ev.result;
    }
  }
  throw new Error('judge response had no terminal result event with string .result');
}

function stripFence(text) {
  const m = FENCE_RE.exec(text.trim());
  return m ? m[1].trim() : text.trim();
}

function parseVerdict(rawText) {
  const stripped = stripFence(rawText);
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    throw new Error(`judge final text was not JSON after fence-strip: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('judge JSON was not an object');
  }
  if (parsed.verdict !== 'PASS' && parsed.verdict !== 'FAIL') {
    throw new Error(`judge verdict must be "PASS" or "FAIL"; got ${JSON.stringify(parsed.verdict)}`);
  }
  return {
    verdict: parsed.verdict,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
  };
}

function truncate(s, n) {
  if (typeof s !== 'string') return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// runJudge({ model, timeoutMs, input }, { spawn }) → row-shape result
function runJudge({ model, timeoutMs, input }, { spawn = realSpawnSync } = {}) {
  if (!model) throw new Error('runJudge: model required');
  if (typeof input !== 'string') throw new Error('runJudge: input string required');
  const sessionId = crypto.randomUUID();
  const args = [
    '-p', '--output-format', 'json',
    '--session-id', sessionId,
    '--permission-mode', 'bypassPermissions',
    '--allowed-tools', '',
    '--model', String(model),
  ];

  const t0 = Date.now();
  const proc = spawn('claude', args, {
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  const elapsed = Date.now() - t0;

  if (proc.signal === 'SIGTERM' || (proc.error && proc.error.code === 'ETIMEDOUT')) {
    return {
      verdict: 'FAIL',
      reasoning: '',
      actual_excerpt: `judge timeout after ${Math.round(timeoutMs / 1000)}s`,
      judge_model: model,
      judge_duration_ms: elapsed,
    };
  }
  if (proc.status !== 0) {
    return {
      verdict: 'FAIL',
      reasoning: '',
      actual_excerpt: `judge exit=${proc.status} stderr=${truncate(proc.stderr || '', 400)}`,
      judge_model: model,
      judge_duration_ms: elapsed,
    };
  }
  let assistantText;
  try {
    assistantText = extractAssistantText(proc.stdout || '');
  } catch (e) {
    return {
      verdict: 'FAIL',
      reasoning: '',
      actual_excerpt: `${e.message}: ${truncate(proc.stdout || '', 400)}`,
      judge_model: model,
      judge_duration_ms: elapsed,
    };
  }
  try {
    const parsed = parseVerdict(assistantText);
    return {
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
      actual_excerpt: parsed.verdict === 'PASS' ? '' : (parsed.reasoning || 'judge returned FAIL'),
      judge_model: model,
      judge_duration_ms: elapsed,
    };
  } catch (e) {
    return {
      verdict: 'FAIL',
      reasoning: '',
      actual_excerpt: `${e.message}; raw=${truncate(assistantText, 400)}`,
      judge_model: model,
      judge_duration_ms: elapsed,
    };
  }
}

module.exports = { runJudge, extractAssistantText, stripFence, parseVerdict };

if (require.main === module) {
  // CLI for ad-hoc smoke testing: read stdin, pass to runJudge with default model
  const model = process.argv[2] || 'claude-haiku-4-5-20251001';
  const timeoutMs = Number(process.argv[3] || 60) * 1000;
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { input += d; });
  process.stdin.on('end', () => {
    const r = runJudge({ model, timeoutMs, input });
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(r.verdict === 'PASS' ? 0 : 1);
  });
}
