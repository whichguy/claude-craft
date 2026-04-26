const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Two structural lints over the skills/agents/commands extension graph:
//
// 1) Cross-reference lint — every `/skill-name` reference in primary docs
//    (skills/, agents/, plugins/, README.md, CLAUDE.md, etc.) must resolve
//    to a local skill, command, or a known external (Claude Code builtin or
//    GAS WebApp endpoint or historical breadcrumb).
//
//    Catches the bug class fixed in commit 625475c (6 stale
//    /ideate-system-prompt examples in the moved workflow file) and any
//    future deletion-without-cleanup.
//
// 2) Dead-skill / dead-agent detector — every skill and agent must have at
//    least one external reference (outside its own directory/file). Skills
//    or agents marked as team-internal in their frontmatter are exempt.
//
//    Catches the bug class deleted in commit a9c5656 (gas-cell-comments
//    orphan, 427 lines).

const REPO_ROOT = path.resolve(__dirname, '..');

// ─── HELPERS ──────────────────────────────────────────────────────────────

function listSkills() {
    const seen = new Set();
    const skillsDir = path.join(REPO_ROOT, 'skills');
    if (fs.existsSync(skillsDir)) {
        for (const name of fs.readdirSync(skillsDir)) {
            if (fs.existsSync(path.join(skillsDir, name, 'SKILL.md'))) seen.add(name);
        }
    }
    // Also include skills nested inside plugins (e.g., plugins/async-workflow/skills/foo/SKILL.md).
    const pluginsDir = path.join(REPO_ROOT, 'plugins');
    if (fs.existsSync(pluginsDir)) {
        for (const plugin of fs.readdirSync(pluginsDir)) {
            const ps = path.join(pluginsDir, plugin, 'skills');
            if (!fs.existsSync(ps)) continue;
            for (const name of fs.readdirSync(ps)) {
                if (fs.existsSync(path.join(ps, name, 'SKILL.md'))) seen.add(name);
            }
        }
    }
    return [...seen];
}

function listCommands() {
    const seen = new Set();
    const cmdDir = path.join(REPO_ROOT, 'commands');
    if (fs.existsSync(cmdDir)) {
        for (const f of fs.readdirSync(cmdDir)) {
            if (f.endsWith('.md')) seen.add(f.replace(/\.md$/, ''));
        }
    }
    // Also include commands nested inside plugins (e.g., plugins/async-workflow/commands/bg.md).
    const pluginsDir = path.join(REPO_ROOT, 'plugins');
    if (fs.existsSync(pluginsDir)) {
        for (const plugin of fs.readdirSync(pluginsDir)) {
            const pc = path.join(pluginsDir, plugin, 'commands');
            if (!fs.existsSync(pc)) continue;
            for (const f of fs.readdirSync(pc)) {
                if (f.endsWith('.md')) seen.add(f.replace(/\.md$/, ''));
            }
        }
    }
    return [...seen];
}

function listAgents() {
    const agentsDir = path.join(REPO_ROOT, 'agents');
    if (!fs.existsSync(agentsDir)) return [];
    return fs.readdirSync(agentsDir)
        // .ideas.md files are notes, not agents — filter them out.
        .filter(f => f.endsWith('.md') && !f.endsWith('.ideas.md'))
        .map(f => f.replace(/\.md$/, ''));
}

function* walkDocs(roots) {
    for (const root of roots) {
        const stat = fs.statSync(root, { throwIfNoEntry: false });
        if (!stat) continue;
        if (stat.isFile()) {
            if (root.endsWith('.md')) yield root;
            continue;
        }
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(root, entry.name);
            // Skip fixture/bench/probe/generation directories — they hold
            // synthetic content where /xxx is often a route path, not a
            // slash-command.
            if (entry.isDirectory()) {
                if (['inputs', 'probes', 'fixtures', 'benchmarks', 'generations', 'experiments', 'plans', 'node_modules', '.git', 'tests', 'logs', 'results'].includes(entry.name)) continue;
                yield* walkDocs([full]);
                continue;
            }
            if (entry.name.endsWith('.md')) yield full;
        }
    }
}

// ─── ALLOWLISTS ───────────────────────────────────────────────────────────

// Claude Code builtin slash commands (not exhaustive — add as encountered).
const CLAUDE_CODE_BUILTINS = new Set([
    'help', 'clear', 'exit', 'init', 'memory', 'model', 'review',
    'security-review', 'permissions', 'mcp', 'agents', 'compact', 'cost',
    'doctor', 'feedback', 'login', 'logout', 'release-notes', 'upgrade',
    'vim', 'migrate-installer', 'status', 'bug', 'config', 'terminal-setup',
    'output-style', 'reset', 'loop', 'fast', 'schedule', 'rename', 'restore',
    'ide', 'hooks', 'usage', 'install-github-app', 'pr_comments', 'add-dir',
    'resume', 'continue', 'prompts',
]);

// References that look like /xxx but are NOT slash commands.
// Filesystem paths, GAS WebApp endpoints, etc.
const NON_SLASH_COMMAND_REFS = new Set([
    'tmp',                    // filesystem path mention
    'dev', 'exec',            // GAS WebApp deployment endpoints (/dev, /exec URLs)
]);

// Historical breadcrumbs — deleted/merged skills referenced in
// "was the standalone X" / "subsumes X via Y" prose. Add to this list when
// a skill is deleted or merged so the lint passes on intentional history docs.
const HISTORICAL_BREADCRUMBS = new Set([
    'ideate-system-prompt',   // merged → /optimize-system-prompt --mode ideate (d2e528d)
    'prompt-critique',        // merged → /improve-prompt --mode critique (c7203dd)
    'prompt-probes',          // merged → /improve-prompt --with-probes (de7f44b)
    'optimize-review-questions', // deleted (543611c) — Q1-Q37 target gone
]);

// Internal-only agents/skills that are exempt from the dead-code detector
// because they are dispatched only by other agents in their team.
// Frontmatter description should make this explicit.
const INTERNAL_ONLY_EXEMPTIONS = new Set([
    'gas-cross-file-validator',     // team specialist, dispatched by gas-review-team-lead
    'gas-debug-commonjs',           // gas-debug-team-lead specialist
    'gas-debug-html',               // gas-debug-team-lead specialist
    'gas-debug-spreadsheet',        // gas-debug-team-lead specialist
    'gas-debug-hypothesis-tester',  // gas-debug-team-lead specialist
    'gas-ui-code-review',           // gas-review-team-lead specialist
    'gas-ui-plan-review',           // gas-plan / gas-review-team-lead specialist
    'gas-quality-check',            // gas-code-review deep validator
]);

// User-facing entry points whose lack of cross-references from other
// skills/agents is by design — the user invokes them directly via
// natural-language topic match, not via dispatch from another skill.
// Adding to this list is a deliberate "this orphan is intentional" decision.
const USER_FACING_NO_REFS_OK = new Set([
    // Skills invoked by topic, not dispatched
    'enable-abilities',
    'form990',
    'make-slides',
    'slack-tag',
    'test-slides',
    'validate-questions',
    // Agents invoked directly by user / Task() but not from other skills' SKILL.md
    'environment-analyst',
    'prompt-reviewer',
    'synthesis-coordinator',
    'verify-transformation',
]);

// Special subagent_type values that aren't agent names — Claude Code's built-in
// dispatch types and well-known generic markers.
const BUILTIN_SUBAGENT_TYPES = new Set([
    'general-purpose',
    'Plan', 'Explore',           // CLI-provided agents (not in agents/)
    'statusline-setup',
]);

// Placeholder identifiers used in skill examples that document Task() syntax,
// and loop variables (e.g. `for each (file, reviewer): subagent_type = reviewer`).
// These appear inside ```bash``` or pseudo-code blocks and are not real dispatch.
const SUBAGENT_TYPE_EXAMPLES = new Set([
    'foo',           // generic placeholder
    'prompter',      // form990 task-runner placeholder
    'reviewer',      // loop variable in review-fix.md / review-fix-thin.md
]);

// ─── TESTS ────────────────────────────────────────────────────────────────

describe('cross-reference lint: every /skill-name in primary docs resolves', function () {
    const skills = new Set(listSkills());
    const commands = new Set(listCommands());

    it('finds no unresolved slash-command references', function () {
        const docRoots = [
            path.join(REPO_ROOT, 'skills'),
            path.join(REPO_ROOT, 'agents'),
            path.join(REPO_ROOT, 'plugins'),
            path.join(REPO_ROOT, 'README.md'),
            path.join(REPO_ROOT, 'CLAUDE.md'),
            path.join(REPO_ROOT, 'GEMINI.md'),
            path.join(REPO_ROOT, 'EXPERIMENTS.md'),
        ];

        const unresolved = []; // [{ ref, file, line }]

        for (const file of walkDocs(docRoots)) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                // Match `/foo` (must be inline-code wrapped in backticks,
                // contain only [a-z0-9-] after the slash, and end at backtick
                // — excludes `/api/auth` style URL paths).
                const matches = lines[i].matchAll(/`\/([a-z][a-z0-9-]*)`/g);
                for (const m of matches) {
                    const name = m[1];
                    if (skills.has(name)) continue;
                    if (commands.has(name)) continue;
                    if (CLAUDE_CODE_BUILTINS.has(name)) continue;
                    if (NON_SLASH_COMMAND_REFS.has(name)) continue;
                    if (HISTORICAL_BREADCRUMBS.has(name)) continue;
                    unresolved.push({
                        ref: `/${name}`,
                        file: path.relative(REPO_ROOT, file),
                        line: i + 1,
                    });
                }
            }
        }

        const formatted = unresolved.map(u => `  ${u.file}:${u.line}  ${u.ref}`).join('\n');
        expect(unresolved, `Unresolved slash-command references — fix the ref or add to the appropriate allowlist in test/skill-cross-references.test.js:\n${formatted}`).to.deep.equal([]);
    });
});

describe('dead-code detector: every skill and agent has at least one external reference', function () {
    const skills = listSkills();
    const agents = listAgents();

    function externalReferenceCount(name, ownerDir) {
        // Search all .md, .sh, .json, .js files for the name; ignore matches
        // inside ownerDir.
        const ownerAbs = path.resolve(ownerDir);
        let refs = 0;
        function scan(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name.startsWith('.')) continue; // .claude, .git, .nyc_output, etc.
                    if (entry.name === 'node_modules') continue;
                    if (path.resolve(full).startsWith(ownerAbs)) continue;
                    scan(full);
                    continue;
                }
                if (!/\.(md|sh|json|js)$/.test(entry.name)) continue;
                const content = fs.readFileSync(full, 'utf8');
                // Match the name as a whole word — avoid prefix matches
                // (e.g., "gas-debug" shouldn't match "gas-debug-team-lead").
                // Negative lookbehind/lookahead exclude [a-z0-9-] on each side so
                // hyphenated names are matched as whole tokens (e.g. `gas-debug`
                // does NOT match inside `gas-debug-team-lead`).
                const re = new RegExp(`(?<![a-z0-9-])${name.replace(/-/g, '\\-')}(?![a-z0-9-])`);
                if (re.test(content)) refs++;
            }
        }
        scan(REPO_ROOT);
        return refs;
    }

    it('every skill has ≥1 external reference', function () {
        const orphans = [];
        for (const name of skills) {
            if (INTERNAL_ONLY_EXEMPTIONS.has(name)) continue;
            if (USER_FACING_NO_REFS_OK.has(name)) continue;
            const ownerDir = path.join(REPO_ROOT, 'skills', name);
            if (externalReferenceCount(name, ownerDir) === 0) orphans.push(name);
        }
        expect(orphans, `Orphan skills (no external references — candidates for deletion or addition to INTERNAL_ONLY_EXEMPTIONS): ${orphans.join(', ')}`).to.deep.equal([]);
    });

    it('every agent has ≥1 external reference', function () {
        const orphans = [];
        for (const name of agents) {
            if (INTERNAL_ONLY_EXEMPTIONS.has(name)) continue;
            if (USER_FACING_NO_REFS_OK.has(name)) continue;
            const ownerFile = path.join(REPO_ROOT, 'agents', `${name}.md`);
            // Owner "directory" for agents is just the single file.
            // Use an exclusion that matches the file path.
            let refs = 0;
            (function scan(dir) {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name.startsWith('.')) continue;
                        if (entry.name === 'node_modules') continue;
                        scan(full);
                        continue;
                    }
                    if (full === ownerFile) continue;
                    if (!/\.(md|sh|json|js)$/.test(entry.name)) continue;
                    const content = fs.readFileSync(full, 'utf8');
                    // Negative lookbehind/lookahead exclude [a-z0-9-] on each side so
                    // hyphenated names are matched as whole tokens (e.g. `gas-debug`
                    // does NOT match inside `gas-debug-team-lead`).
                    const re = new RegExp(`(?<![a-z0-9-])${name.replace(/-/g, '\\-')}(?![a-z0-9-])`);
                    if (re.test(content)) refs++;
                }
            })(REPO_ROOT);
            if (refs === 0) orphans.push(name);
        }
        expect(orphans, `Orphan agents (no external references — candidates for deletion or addition to INTERNAL_ONLY_EXEMPTIONS): ${orphans.join(', ')}`).to.deep.equal([]);
    });
});

describe('subagent_type dispatch: every Task() / frontmatter subagent_type resolves', function () {
    const agents = new Set(listAgents());

    it('finds no broken subagent_type references', function () {
        const docRoots = [
            path.join(REPO_ROOT, 'skills'),
            path.join(REPO_ROOT, 'agents'),
            path.join(REPO_ROOT, 'plugins'),
            path.join(REPO_ROOT, 'commands'),
        ];

        const unresolved = [];

        for (const file of walkDocs(docRoots)) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                // Match: subagent_type: "foo" / subagent_type: 'foo' / subagent_type="foo" / subagent_type=foo
                const matches = lines[i].matchAll(/subagent_type\s*[:=]\s*["']?([a-z][a-z0-9-]+)["']?/g);
                for (const m of matches) {
                    const name = m[1];
                    if (agents.has(name)) continue;
                    if (BUILTIN_SUBAGENT_TYPES.has(name)) continue;
                    if (SUBAGENT_TYPE_EXAMPLES.has(name)) continue;
                    unresolved.push({
                        name,
                        file: path.relative(REPO_ROOT, file),
                        line: i + 1,
                    });
                }
            }
        }

        const formatted = unresolved.map(u => `  ${u.file}:${u.line}  subagent_type="${u.name}"`).join('\n');
        expect(unresolved, `Broken subagent_type dispatches — agent does not exist; fix the name, add to BUILTIN_SUBAGENT_TYPES if it's a Claude Code built-in, or to SUBAGENT_TYPE_EXAMPLES if it's a placeholder in pseudo-code:\n${formatted}`).to.deep.equal([]);
    });
});
