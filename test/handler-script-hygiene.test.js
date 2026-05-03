const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Asserts every plugin handler script under plugins/<name>/handlers/*.sh
// has either `set -e` (and friends) or a `trap ... ERR` near the top.
//
// Without one, an intermediate command failure produces silent partial
// execution and confusing downstream behavior. Discovered as Gap 5 in
// the 2026-04-26 lint coverage gap analysis.

const REPO_ROOT = path.resolve(__dirname, '..');
const HEAD_LINE_BUDGET = 30; // search the first N lines for the guard

// Handlers that intentionally lack set -e because they're either:
//  - shared libraries sourced by handlers (set -e in a library would force
//    every caller to handle errors immediately, defeating reuse), or
//  - tiny single-command handlers where set -e adds no value.
//
// Add to this list with a one-line rationale when intentionally exempt.
const LINT_EXEMPT = new Set([
    'plugins/wiki-suite/handlers/wiki-common.sh',          // sourced library — `wiki_parse_input`, etc.
    'plugins/task-persist/handlers/task-persist-common.sh', // sourced library — `tp_parse_input`, etc.
    'plugins/craft-hooks/handlers/memo-cleanup.sh',         // single `find -delete` with 2>/dev/null
    'plugins/wiki-suite/handlers/wiki-raw-guard.sh',        // 5-line defensively-coded guard with explicit exit codes
]);

function listHandlers() {
    const out = [];
    const pluginsDir = path.join(REPO_ROOT, 'plugins');
    if (!fs.existsSync(pluginsDir)) return out;
    for (const plugin of fs.readdirSync(pluginsDir)) {
        const handlersDir = path.join(pluginsDir, plugin, 'handlers');
        if (!fs.existsSync(handlersDir)) continue;
        for (const f of fs.readdirSync(handlersDir)) {
            if (!f.endsWith('.sh')) continue;
            out.push(path.join(handlersDir, f));
        }
    }
    return out;
}

describe('handler script hygiene: every handler has explicit error handling', function () {
    it('every plugins/*/handlers/*.sh has `set -e` or `trap ... ERR` in its first 30 lines', function () {
        const violations = [];
        for (const full of listHandlers()) {
            const rel = path.relative(REPO_ROOT, full);
            if (LINT_EXEMPT.has(rel)) continue;
            const head = fs.readFileSync(full, 'utf8').split('\n').slice(0, HEAD_LINE_BUDGET).join('\n');
            const hasSetE = /^\s*set\s+-[eou]+/m.test(head);
            const hasTrapErr = /^\s*trap\s+.*\bERR\b/m.test(head);
            if (!hasSetE && !hasTrapErr) violations.push(rel);
        }
        const formatted = violations.map(v => `  ${v}`).join('\n');
        expect(violations, `Handler scripts missing \`set -e\` / \`set -euo pipefail\` / \`trap ... ERR\` — add the guard or add the script to LINT_EXEMPT in test/handler-script-hygiene.test.js with a rationale comment:\n${formatted}`).to.deep.equal([]);
    });
});
