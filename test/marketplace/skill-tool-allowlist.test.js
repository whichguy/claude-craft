const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Validates that every tool name listed in `allowed-tools:` (skills) or
// `tools:` (agents) frontmatter is a real Claude Code tool, an MCP tool
// matching the namespaced pattern, or one of the wildcard markers.
//
// Catches:
//   - Snake_case Gemini-style tool names (read_file, list_directory,
//     write_file, run_shell_command) accidentally pasted into a Claude
//     Code skill.
//   - Typos in tool names (e.g. "TodoWrte" for "TaskCreate").
//   - References to retired tools after Claude Code releases.
//
// Discovered during gap analysis: skills/process-feedback/SKILL.md:13
// declared `[read_file, list_directory, write_file, run_shell_command]`,
// none of which exist in Claude Code (those are Gemini's tool names).

const REPO_ROOT = path.resolve(__dirname, '../..');

// Canonical Claude Code tool inventory (stable as of 2026-04). Update when
// the platform adds/retires tools. MCP tools are matched by pattern below.
const CLAUDE_CODE_TOOLS = new Set([
    'Agent', 'AskUserQuestion', 'Bash', 'Edit', 'EnterPlanMode',
    'ExitPlanMode', 'Glob', 'Grep', 'MultiEdit', 'NotebookEdit',
    'Read', 'ScheduleWakeup', 'Skill', 'Task', 'TaskCreate', 'TaskGet',
    'TaskList', 'TaskOutput', 'TaskStop', 'TaskUpdate', 'TodoWrite',
    'ToolSearch', 'WebFetch', 'WebSearch', 'Write',
    // Wildcards
    'all', '*',
]);

// MCP tools follow `mcp__<server>__<tool>` or `mcp__<server>__*` pattern.
const MCP_TOOL_PATTERN = /^mcp__[A-Za-z0-9_-]+__([A-Za-z0-9_-]+|\*)$/;
// Server-level wildcard: `mcp__<server>__*` (already covered by above) and
// some skills use just `mcp__<server>__*` so we accept that too.

function parseFrontmatter(content) {
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const lines = m[1].split('\n');
    const fm = {};
    let key = null, value = [];
    for (const line of lines) {
        const km = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
        if (km && !line.startsWith(' ') && !line.startsWith('\t')) {
            if (key !== null) fm[key] = value.join('\n').trim();
            key = km[1];
            value = [km[2]];
        } else {
            value.push(line);
        }
    }
    if (key !== null) fm[key] = value.join('\n').trim();
    return fm;
}

// Parse a tools-list value like "Agent, Bash, Read" or "[read_file, list_directory]"
// or "all" or "mcp__gas__*, Read".
function parseToolList(rawValue) {
    if (!rawValue) return [];
    let s = rawValue.trim();
    // Strip surrounding [ ] for YAML inline arrays.
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    return s.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function validateTool(name) {
    if (CLAUDE_CODE_TOOLS.has(name)) return true;
    if (MCP_TOOL_PATTERN.test(name)) return true;
    return false;
}

function* listSkillsAndAgents() {
    const skillsDir = path.join(REPO_ROOT, 'skills');
    if (fs.existsSync(skillsDir)) {
        for (const name of fs.readdirSync(skillsDir)) {
            const p = path.join(skillsDir, name, 'SKILL.md');
            if (fs.existsSync(p)) yield { kind: 'skill', name, path: p, frontmatterField: 'allowed-tools' };
        }
    }
    const agentsDir = path.join(REPO_ROOT, 'agents');
    if (fs.existsSync(agentsDir)) {
        for (const f of fs.readdirSync(agentsDir)) {
            if (!f.endsWith('.md') || f.endsWith('.ideas.md')) continue;
            const p = path.join(agentsDir, f);
            yield { kind: 'agent', name: f.replace(/\.md$/, ''), path: p, frontmatterField: 'tools' };
        }
    }
}

describe('tool allowlist: every allowed-tools entry is a real Claude Code or MCP tool', function () {
    it('finds no unknown tools across all skills and agents', function () {
        const violations = [];
        for (const item of listSkillsAndAgents()) {
            const fm = parseFrontmatter(fs.readFileSync(item.path, 'utf8'));
            if (!fm) continue;
            // Skills use `allowed-tools:`, agents use `tools:`. Try both fields
            // on either kind to be lenient about ad-hoc usage.
            const raw = fm[item.frontmatterField] || fm['allowed-tools'] || fm['tools'];
            if (!raw) continue;
            const tools = parseToolList(raw);
            for (const tool of tools) {
                if (!validateTool(tool)) {
                    violations.push(`${item.kind}:${item.name} — "${tool}"`);
                }
            }
        }
        const formatted = violations.map(v => `  ${v}`).join('\n');
        expect(violations, `Unknown tool names — fix the SKILL.md/agent.md frontmatter, or add the tool to CLAUDE_CODE_TOOLS in test/skill-tool-allowlist.test.js if it's a new platform tool:\n${formatted}`).to.deep.equal([]);
    });
});
