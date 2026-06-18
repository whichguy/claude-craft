#!/usr/bin/env node
// V2 grader for runs produced by run-fixture.js (single replica).
//
// Reads <run-dir>/stream.jsonl + <run-dir>/run.meta.json, builds the V2
// view set, evaluates the fixture's pass_conditions, writes
// <run-dir>/grade.json, exits non-zero on overall=FAIL.
//
// Schema: see plugins/planning-suite/skills/test-prompt-harness/SKILL.md.

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n[\s\S]*$/;

const STRING_VIEW_NAMES = new Set(['thinking', 'assistant_text', 'tool_inputs', 'tool_outputs', 'everything', 'result']);

function parseFrontmatter(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) throw new Error(`fixture missing frontmatter: ${fixturePath}`);
  return yaml.load(m[1]);
}

function tolerantParseLines(jsonl) {
  const events = [];
  let parseErrors = 0;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); }
    catch (_) { parseErrors++; }
  }
  return { events, parseErrors };
}

function toolResultText(block) {
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .filter(c => c && c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text)
      .join('\n');
  }
  return '';
}

function canonicalInput(input) {
  if (input === null || input === undefined) return JSON.stringify(input);
  if (typeof input !== 'object' || Array.isArray(input)) return JSON.stringify(input);
  return JSON.stringify(input, Object.keys(input).sort());
}

function buildViews(events, meta) {
  const thinkingParts = [];
  const assistantTextParts = [];
  const toolInputParts = [];
  const toolOutputParts = [];
  const toolCalls = [];
  const toolUseById = {};
  const toolResults = [];
  let resultText = '';
  let resultSubtype = '';
  let resultIsError = false;

  for (const ev of events) {
    if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      for (const b of ev.message.content) {
        if (b.type === 'thinking' && typeof b.thinking === 'string') {
          thinkingParts.push(b.thinking);
        } else if (b.type === 'text' && typeof b.text === 'string') {
          assistantTextParts.push(b.text);
        } else if (b.type === 'tool_use') {
          const canon = canonicalInput(b.input);
          toolInputParts.push(canon);
          const call = { tool: b.name, input: b.input, tool_use_id: b.id };
          toolCalls.push(call);
          if (b.id) toolUseById[b.id] = call;
        }
      }
    } else if (ev.type === 'user' && ev.message && Array.isArray(ev.message.content)) {
      for (const b of ev.message.content) {
        if (b.type === 'tool_result') {
          const txt = toolResultText(b);
          toolOutputParts.push(txt);
          const matched = b.tool_use_id ? toolUseById[b.tool_use_id] : null;
          toolResults.push({
            tool: matched ? matched.tool : null,
            tool_use_id: b.tool_use_id || null,
            content: txt,
            is_error: b.is_error === true,
          });
        }
      }
    } else if (ev.type === 'result') {
      if (typeof ev.result === 'string') resultText = ev.result;
      if (typeof ev.subtype === 'string') resultSubtype = ev.subtype;
      if (typeof ev.is_error === 'boolean') resultIsError = ev.is_error;
    }
  }

  const thinking = thinkingParts.join('\n');
  const assistant_text = assistantTextParts.join('\n');
  const tool_inputs = toolInputParts.length ? toolInputParts.join('\n') + '\n' : '';
  const tool_outputs = toolOutputParts.length ? toolOutputParts.join('\n') + '\n' : '';
  const everything = `${thinking}\n${assistant_text}\n${tool_inputs}\n${tool_outputs}\n${resultText}`;

  return {
    thinking,
    assistant_text,
    tool_inputs,
    tool_outputs,
    everything,
    result: resultText,
    tool_calls: toolCalls,
    tool_results: toolResults,
    run: {
      subtype: resultSubtype,
      is_error: resultIsError,
      elapsed_ms: meta && typeof meta.elapsed_ms === 'number' ? meta.elapsed_ms : null,
      parse_errors: 0,
    },
  };
}

function compileRegex(spec) {
  if (!spec || typeof spec !== 'object') {
    return { error: `pattern row must be an object {pattern, case_sensitive}; got ${JSON.stringify(spec)}` };
  }
  if (typeof spec.pattern !== 'string') {
    return { error: `pattern row missing string "pattern": ${JSON.stringify(spec)}` };
  }
  if (typeof spec.case_sensitive !== 'boolean') {
    return { error: `pattern row missing boolean "case_sensitive": ${JSON.stringify(spec)}` };
  }
  try {
    return { regex: new RegExp(spec.pattern, spec.case_sensitive ? '' : 'i') };
  } catch (e) {
    return { error: `INVALID_REGEX: ${e.message}` };
  }
}

function excerptMatch(text, re) {
  const m = re.exec(text);
  if (!m) return '';
  const start = Math.max(0, m.index - 40);
  const end = Math.min(text.length, m.index + m[0].length + 160);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function absentExcerpt(viewName, views) {
  const observed = toolHistogram(views.tool_calls);
  const lastText = views.assistant_text.slice(-200);
  return `view=${viewName} len=${(views[viewName] || '').length} tools_observed=[${observed}] last_assistant_text=${JSON.stringify(lastText)}`;
}

function toolHistogram(toolCalls) {
  const counts = {};
  for (const t of toolCalls) counts[t.tool] = (counts[t.tool] || 0) + 1;
  return Object.keys(counts).map(k => `${k}×${counts[k]}`).join(',');
}

// ---- Fixture-validity ----------------------------------------------------

function validateFixture(pc, runs, quorum) {
  if (pc && Object.prototype.hasOwnProperty.call(pc, 'thread')) {
    throw new Error('V1 schema: pass_conditions.thread is no longer supported. Migrate to pass_conditions.views.<name>.');
  }
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`runs must be a positive integer; got ${runs}`);
  }
  if (typeof quorum === 'number') {
    if (!Number.isInteger(quorum) || quorum < 1 || quorum > runs) {
      throw new Error(`quorum integer must satisfy 1 ≤ quorum ≤ runs (${runs}); got ${quorum}`);
    }
  } else if (typeof quorum === 'string') {
    if (quorum !== 'all' && quorum !== 'majority') {
      throw new Error(`quorum string must be "all" or "majority"; got ${quorum}`);
    }
  } else {
    throw new Error(`quorum must be "all", "majority", or a positive integer; got ${typeof quorum}`);
  }
  // views: each name must be a string view
  if (pc && pc.views && typeof pc.views === 'object') {
    for (const k of Object.keys(pc.views)) {
      if (!STRING_VIEW_NAMES.has(k)) {
        throw new Error(`pass_conditions.views.${k}: unknown view name (allowed: ${Array.from(STRING_VIEW_NAMES).join(', ')})`);
      }
    }
  }
  // tool_calls.counts: exact ↔ min/max are mutually exclusive
  const counts = pc?.tool_calls?.counts || {};
  for (const [tool, spec] of Object.entries(counts)) {
    if (!spec || typeof spec !== 'object') {
      throw new Error(`pass_conditions.tool_calls.counts.${tool}: must be {min,max} or {exact}`);
    }
    const hasExact = Object.prototype.hasOwnProperty.call(spec, 'exact');
    const hasMin = Object.prototype.hasOwnProperty.call(spec, 'min');
    const hasMax = Object.prototype.hasOwnProperty.call(spec, 'max');
    if (hasExact && (hasMin || hasMax)) {
      throw new Error(`pass_conditions.tool_calls.counts.${tool}: "exact" cannot be mixed with "min"/"max"`);
    }
    if (!hasExact && !hasMin && !hasMax) {
      throw new Error(`pass_conditions.tool_calls.counts.${tool}: must specify min, max, or exact`);
    }
  }
  // semantic[].view must be a string view
  const semantic = pc?.semantic || [];
  for (const row of semantic) {
    if (!row || typeof row !== 'object') {
      throw new Error('pass_conditions.semantic[] entries must be objects');
    }
    if (!row.id || typeof row.id !== 'string') {
      throw new Error('pass_conditions.semantic[].id is required');
    }
    if (!STRING_VIEW_NAMES.has(row.view)) {
      throw new Error(`pass_conditions.semantic[id=${row.id}].view: must be one of ${Array.from(STRING_VIEW_NAMES).join(', ')} (structured views not allowed)`);
    }
    if (typeof row.judge_model !== 'string' || !row.judge_model) {
      throw new Error(`pass_conditions.semantic[id=${row.id}].judge_model is required`);
    }
    if (typeof row.rubric !== 'string' || !row.rubric.trim()) {
      throw new Error(`pass_conditions.semantic[id=${row.id}].rubric is required`);
    }
  }
}

// ---- Condition evaluators -----------------------------------------------

function evalStringPatterns(rows, viewName, viewText, must_include, must_not_include) {
  (must_include || []).forEach((spec, i) => {
    const c = compileRegex(spec);
    if (c.error) {
      rows.push({
        id: `views.${viewName}.must_include[${i}]`,
        kind: `views.${viewName}.must_include`,
        verdict: 'FAIL',
        actual_excerpt: c.error,
        spec: { pattern: spec && spec.pattern, case_sensitive: spec && spec.case_sensitive },
      });
      return;
    }
    const ok = c.regex.test(viewText);
    rows.push({
      id: `views.${viewName}.must_include[${i}]`,
      kind: `views.${viewName}.must_include`,
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `absent: ${spec.pattern} (case_sensitive=${spec.case_sensitive})`,
      spec: { pattern: spec.pattern, case_sensitive: spec.case_sensitive },
    });
  });
  (must_not_include || []).forEach((spec, i) => {
    const c = compileRegex(spec);
    if (c.error) {
      rows.push({
        id: `views.${viewName}.must_not_include[${i}]`,
        kind: `views.${viewName}.must_not_include`,
        verdict: 'FAIL',
        actual_excerpt: c.error,
        spec: { pattern: spec && spec.pattern, case_sensitive: spec && spec.case_sensitive },
      });
      return;
    }
    const found = c.regex.test(viewText);
    rows.push({
      id: `views.${viewName}.must_not_include[${i}]`,
      kind: `views.${viewName}.must_not_include`,
      verdict: found ? 'FAIL' : 'PASS',
      actual_excerpt: found ? excerptMatch(viewText, c.regex) : '',
      spec: { pattern: spec.pattern, case_sensitive: spec.case_sensitive },
    });
  });
}

function evalRun(rows, runSpec, runView) {
  if (!runSpec) return;
  if (runSpec.must_succeed !== undefined) {
    const ok = runView.subtype === 'success' && runView.is_error === false;
    rows.push({
      id: 'run.must_succeed',
      kind: 'run.must_succeed',
      verdict: ok === Boolean(runSpec.must_succeed) ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `subtype=${runView.subtype} is_error=${runView.is_error}`,
      spec: { must_succeed: Boolean(runSpec.must_succeed) },
    });
  }
  if (runSpec.max_duration_ms !== undefined) {
    const elapsed = runView.elapsed_ms;
    const ok = elapsed !== null && elapsed <= Number(runSpec.max_duration_ms);
    rows.push({
      id: 'run.max_duration_ms',
      kind: 'run.max_duration_ms',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `elapsed_ms=${elapsed} limit=${runSpec.max_duration_ms}`,
      spec: { max_duration_ms: Number(runSpec.max_duration_ms) },
    });
  }
  if (runSpec.max_parse_errors !== undefined) {
    const errs = runView.parse_errors || 0;
    const ok = errs <= Number(runSpec.max_parse_errors);
    rows.push({
      id: 'run.max_parse_errors',
      kind: 'run.max_parse_errors',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `parse_errors=${errs} limit=${runSpec.max_parse_errors}`,
      spec: { max_parse_errors: Number(runSpec.max_parse_errors) },
    });
  }
}

function evalToolCalls(rows, spec, toolCalls) {
  if (!spec) return;
  const names = toolCalls.map(t => t.tool);
  const counts = {};
  for (const n of names) counts[n] = (counts[n] || 0) + 1;

  (spec.required || []).forEach((name, i) => {
    if (typeof name !== 'string') throw new Error(`tool_calls.required[${i}] must be a string`);
    const ok = names.includes(name);
    rows.push({
      id: `tool_calls.required[${i}]`,
      kind: 'tool_calls.required',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `missing tool: ${name}; observed=[${toolHistogram(toolCalls)}]`,
      spec: { tool: name },
    });
  });

  (spec.forbidden || []).forEach((name, i) => {
    if (typeof name !== 'string') throw new Error(`tool_calls.forbidden[${i}] must be a string`);
    const idx = names.indexOf(name);
    rows.push({
      id: `tool_calls.forbidden[${i}]`,
      kind: 'tool_calls.forbidden',
      verdict: idx === -1 ? 'PASS' : 'FAIL',
      actual_excerpt: idx === -1 ? '' : `forbidden tool invoked: ${name} (invocation #${idx + 1}); observed=[${toolHistogram(toolCalls)}]`,
      spec: { tool: name },
    });
  });

  for (const [tool, cspec] of Object.entries(spec.counts || {})) {
    const n = counts[tool] || 0;
    let ok, expectStr;
    if (cspec.exact !== undefined) {
      ok = n === Number(cspec.exact);
      expectStr = `exact=${cspec.exact}`;
    } else {
      const min = cspec.min !== undefined ? Number(cspec.min) : -Infinity;
      const max = cspec.max !== undefined ? Number(cspec.max) : Infinity;
      ok = n >= min && n <= max;
      expectStr = `${cspec.min !== undefined ? `min=${cspec.min}` : ''}${cspec.min !== undefined && cspec.max !== undefined ? ' ' : ''}${cspec.max !== undefined ? `max=${cspec.max}` : ''}`.trim();
    }
    rows.push({
      id: `tool_calls.counts.${tool}`,
      kind: 'tool_calls.counts',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `${tool} count=${n} ${expectStr}`,
      spec: Object.assign({ tool }, cspec),
    });
  }

  if (Array.isArray(spec.order) && spec.order.length > 0) {
    let j = 0;
    for (let k = 0; k < names.length && j < spec.order.length; k++) {
      if (names[k] === spec.order[j]) j++;
    }
    const ok = j === spec.order.length;
    rows.push({
      id: 'tool_calls.order',
      kind: 'tool_calls.order',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `expected subsequence=[${spec.order.join(',')}] observed=[${names.join(',')}]`,
      spec: { order: spec.order.slice() },
    });
  }

  (spec.inputs || []).forEach((ispec, i) => {
    if (!ispec || typeof ispec.tool !== 'string') {
      throw new Error(`tool_calls.inputs[${i}].tool required`);
    }
    const invocations = toolCalls.filter(t => t.tool === ispec.tool);
    const canon = invocations.map(t => canonicalInput(t.input));
    const isMust = !!ispec.must_match;
    const patSpec = ispec.must_match || ispec.must_not_match;
    if (!patSpec) throw new Error(`tool_calls.inputs[${i}] needs must_match or must_not_match`);
    const c = compileRegex(patSpec);
    if (c.error) {
      rows.push({
        id: `tool_calls.inputs[${i}].${ispec.tool}`,
        kind: 'tool_calls.inputs',
        verdict: 'FAIL',
        actual_excerpt: c.error,
        spec: { tool: ispec.tool, mode: isMust ? 'must_match' : 'must_not_match', pattern: patSpec.pattern, case_sensitive: patSpec.case_sensitive },
      });
      return;
    }
    let ok, why;
    if (isMust) {
      const anyHit = canon.some(s => c.regex.test(s));
      ok = anyHit;
      why = anyHit ? '' : `no invocation of ${ispec.tool} matched /${patSpec.pattern}/ (invocations=${canon.length})`;
    } else {
      const firstHit = canon.findIndex(s => c.regex.test(s));
      ok = firstHit === -1;
      why = ok ? '' : `invocation #${firstHit + 1} of ${ispec.tool} matched forbidden /${patSpec.pattern}/`;
    }
    rows.push({
      id: `tool_calls.inputs[${i}].${ispec.tool}`,
      kind: 'tool_calls.inputs',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: why,
      spec: { tool: ispec.tool, mode: isMust ? 'must_match' : 'must_not_match', pattern: patSpec.pattern, case_sensitive: patSpec.case_sensitive },
    });
  });
}

function evalToolResults(rows, spec, toolResults) {
  if (!spec) return;
  if (spec.all_succeeded !== undefined) {
    const failures = toolResults.filter(r => r.is_error);
    const ok = failures.length === 0;
    rows.push({
      id: 'tool_results.all_succeeded',
      kind: 'tool_results.all_succeeded',
      verdict: ok ? 'PASS' : 'FAIL',
      actual_excerpt: ok ? '' : `errored=[${failures.map(f => f.tool || '?').join(',')}]`,
      spec: { all_succeeded: Boolean(spec.all_succeeded) },
    });
  }
  for (const [tool, ts] of Object.entries(spec.per_tool || {})) {
    const calls = toolResults.filter(r => r.tool === tool);
    if (ts.must_succeed) {
      const errs = calls.filter(r => r.is_error);
      const ok = calls.length > 0 && errs.length === 0;
      rows.push({
        id: `tool_results.per_tool.${tool}`,
        kind: 'tool_results.per_tool',
        verdict: ok ? 'PASS' : 'FAIL',
        actual_excerpt: ok
          ? ''
          : (calls.length === 0
            ? `no tool_result observed for ${tool}`
            : `${tool} errors=${errs.length}/${calls.length}`),
        spec: { tool, must_succeed: true },
      });
    }
  }
}

function evalResult(rows, spec, resultText) {
  if (!spec) return;
  if (spec.must_match) {
    const c = compileRegex(spec.must_match);
    if (c.error) {
      rows.push({
        id: 'result.must_match',
        kind: 'result.must_match',
        verdict: 'FAIL',
        actual_excerpt: c.error,
        spec: { pattern: spec.must_match.pattern, case_sensitive: spec.must_match.case_sensitive },
      });
    } else {
      const ok = c.regex.test(resultText);
      rows.push({
        id: 'result.must_match',
        kind: 'result.must_match',
        verdict: ok ? 'PASS' : 'FAIL',
        actual_excerpt: ok ? '' : `result=${JSON.stringify(resultText.slice(0, 200))}`,
        spec: { pattern: spec.must_match.pattern, case_sensitive: spec.must_match.case_sensitive },
      });
    }
  }
  if (spec.must_not_match) {
    const c = compileRegex(spec.must_not_match);
    if (c.error) {
      rows.push({
        id: 'result.must_not_match',
        kind: 'result.must_not_match',
        verdict: 'FAIL',
        actual_excerpt: c.error,
        spec: { pattern: spec.must_not_match.pattern, case_sensitive: spec.must_not_match.case_sensitive },
      });
    } else {
      const found = c.regex.test(resultText);
      rows.push({
        id: 'result.must_not_match',
        kind: 'result.must_not_match',
        verdict: found ? 'FAIL' : 'PASS',
        actual_excerpt: found ? excerptMatch(resultText, c.regex) : '',
        spec: { pattern: spec.must_not_match.pattern, case_sensitive: spec.must_not_match.case_sensitive },
      });
    }
  }
}

function evalSemantic(rows, semanticSpec, views, fixtureFrontmatter, runJudgeFn) {
  if (!semanticSpec) return;
  if (!runJudgeFn) throw new Error('semantic[] rows require a judge runner');
  const timeoutMs = Number(fixtureFrontmatter.timeout_seconds || 60) * 1000;
  for (const row of semanticSpec) {
    const viewContent = views[row.view] || '';
    const input = `RUBRIC:\n${row.rubric}\n\nOUTPUT_TO_GRADE:\n${viewContent}\n`;
    const res = runJudgeFn({
      model: row.judge_model,
      timeoutMs,
      input,
    });
    rows.push(Object.assign({
      id: `semantic.${row.id}`,
      kind: 'semantic',
      spec: { view: row.view, judge_model: row.judge_model },
    }, res));
  }
}

// ---- Main entry ---------------------------------------------------------

function evalRows(pass_conditions, views, opts = {}) {
  const rows = [];
  const pc = pass_conditions || {};

  evalRun(rows, pc.run, views.run);

  const viewsSpec = pc.views || {};
  for (const v of ['thinking', 'assistant_text', 'tool_inputs', 'tool_outputs', 'everything', 'result']) {
    if (viewsSpec[v]) {
      evalStringPatterns(rows, v, views[v], viewsSpec[v].must_include, viewsSpec[v].must_not_include);
    }
  }

  evalToolCalls(rows, pc.tool_calls, views.tool_calls);
  evalToolResults(rows, pc.tool_results, views.tool_results);
  evalResult(rows, pc.result, views.result);

  if (Array.isArray(pc.semantic) && pc.semantic.length > 0) {
    evalSemantic(rows, pc.semantic, views, opts.fixtureFrontmatter || {}, opts.runJudge);
  }

  return rows;
}

function readMeta(runDir) {
  const metaPath = path.join(runDir, 'run.meta.json');
  if (!fs.existsSync(metaPath)) return {};
  try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { return {}; }
}

function gradeRun(fixturePath, runDir, opts = {}) {
  const fm = parseFrontmatter(fixturePath);
  const runs = fm.runs !== undefined ? Number(fm.runs) : 1;
  const quorum = fm.quorum !== undefined ? fm.quorum : 'majority';
  validateFixture(fm.pass_conditions, runs, quorum);

  const streamPath = path.join(runDir, 'stream.jsonl');
  const jsonl = fs.readFileSync(streamPath, 'utf8');
  const { events, parseErrors } = tolerantParseLines(jsonl);
  const meta = readMeta(runDir);
  const views = buildViews(events, meta);
  views.run.parse_errors = parseErrors;

  let runJudge = opts.runJudge;
  if (!runJudge && Array.isArray(fm.pass_conditions?.semantic) && fm.pass_conditions.semantic.length > 0) {
    runJudge = require('./judge-runner.js').runJudge;
  }

  const rows = evalRows(fm.pass_conditions || {}, views, {
    fixtureFrontmatter: fm,
    runJudge,
  });
  const overall = rows.every(r => r.verdict === 'PASS') ? 'PASS' : 'FAIL';
  const grade = {
    fixture: fm.name || path.basename(fixturePath),
    overall,
    parse_errors: parseErrors,
    runs: 1,
    rows,
  };
  fs.writeFileSync(path.join(runDir, 'grade.json'), JSON.stringify(grade, null, 2) + '\n');
  return grade;
}

if (require.main === module) {
  const [fixturePath, runDir] = process.argv.slice(2);
  if (!fixturePath || !runDir) {
    process.stderr.write('usage: grade-run.js <fixture.md> <run-dir>\n');
    process.exit(2);
  }
  try {
    const g = gradeRun(path.resolve(fixturePath), path.resolve(runDir));
    process.exit(g.overall === 'PASS' ? 0 : 1);
  } catch (e) {
    process.stderr.write(`grade-run.js: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = {
  gradeRun,
  parseFrontmatter,
  buildViews,
  evalRows,
  tolerantParseLines,
  validateFixture,
  canonicalInput,
  compileRegex,
};
