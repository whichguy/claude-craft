const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Frontmatter schema validator for SKILL.md and agents/*.md.
//
// Catches: typos, missing required fields, name mismatch with directory/filename,
// invalid model identifiers, malformed YAML structure (e.g., missing `---`).
//
// Lightweight — does not require a full YAML parser. Extracts top-level keys
// from the `---`-delimited frontmatter block via line-based parsing. Multi-line
// values introduced by `|` or `>` are handled by treating subsequent indented
// lines as continuations of the same key.

const REPO_ROOT = path.resolve(__dirname, '../..');

// Allowed model identifiers — accept both the "alias" form (sonnet, opus, haiku)
// used by agents and the "full ID" form (claude-sonnet-4-6) used by skills.
// Claude Code accepts both.
const MODEL_PATTERN = /^(claude-(sonnet|opus|haiku)-[0-9]-[0-9]+(-[0-9]+)?(\[[0-9]+m\])?|sonnet|opus|haiku|inherit)$/;

function parseFrontmatter(content) {
    // Frontmatter must be the first thing in the file: ---\n...\n---
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const body = m[1];
    const lines = body.split('\n');
    const fm = {};
    let currentKey = null;
    let currentValue = [];
    for (const line of lines) {
        // Top-level key: starts at column 0, matches "key: value"
        const km = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
        if (km && !line.startsWith(' ') && !line.startsWith('\t')) {
            if (currentKey !== null) fm[currentKey] = currentValue.join('\n').trim();
            currentKey = km[1];
            currentValue = [km[2]];
        } else {
            currentValue.push(line);
        }
    }
    if (currentKey !== null) fm[currentKey] = currentValue.join('\n').trim();
    return fm;
}

function listSkills() {
    const skillsDir = path.join(REPO_ROOT, 'skills');
    if (!fs.existsSync(skillsDir)) return [];
    const out = [];
    for (const name of fs.readdirSync(skillsDir)) {
        const skillPath = path.join(skillsDir, name, 'SKILL.md');
        if (fs.existsSync(skillPath)) out.push({ name, path: skillPath });
    }
    return out;
}

function listAgents() {
    const agentsDir = path.join(REPO_ROOT, 'agents');
    if (!fs.existsSync(agentsDir)) return [];
    const out = [];
    for (const f of fs.readdirSync(agentsDir)) {
        // Filter .ideas.md notes files.
        if (!f.endsWith('.md') || f.endsWith('.ideas.md')) continue;
        out.push({ name: f.replace(/\.md$/, ''), path: path.join(agentsDir, f) });
    }
    return out;
}

// Skills that intentionally lack standard frontmatter — typically reference
// docs misfiled under skills/. Adding to this list is a deliberate decision
// to acknowledge the file is not a real Claude Code skill.
const NON_STANDARD_SKILLS = new Set([
    // intentionally empty — add entries with rationale comments when needed
]);

describe('frontmatter schema: skills', function () {
    const skills = listSkills();

    it('every SKILL.md has parseable frontmatter', function () {
        const broken = [];
        for (const { name, path: p } of skills) {
            if (NON_STANDARD_SKILLS.has(name)) continue;
            const content = fs.readFileSync(p, 'utf8');
            const fm = parseFrontmatter(content);
            if (!fm) broken.push(name);
        }
        expect(broken, `Skills missing or malformed frontmatter: ${broken.join(', ')}`).to.deep.equal([]);
    });

    it('every SKILL.md has a non-empty `name` matching its directory', function () {
        const mismatches = [];
        for (const { name, path: p } of skills) {
            if (NON_STANDARD_SKILLS.has(name)) continue;
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm) continue; // already flagged above
            if (!fm.name) {
                mismatches.push(`${name} (missing name)`);
                continue;
            }
            if (fm.name !== name) {
                mismatches.push(`${name} (frontmatter name="${fm.name}")`);
            }
        }
        expect(mismatches, `Skill name mismatches: ${mismatches.join(', ')}`).to.deep.equal([]);
    });

    it('every SKILL.md has a non-empty `description`', function () {
        const empty = [];
        for (const { name, path: p } of skills) {
            if (NON_STANDARD_SKILLS.has(name)) continue;
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm) continue;
            if (!fm.description || !fm.description.trim() || fm.description.trim() === '|') {
                empty.push(name);
            }
        }
        expect(empty, `Skills with empty description: ${empty.join(', ')}`).to.deep.equal([]);
    });

    it('every SKILL.md `model` field (if set) names a valid Claude model', function () {
        const invalid = [];
        for (const { name, path: p } of skills) {
            if (NON_STANDARD_SKILLS.has(name)) continue;
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm || !fm.model) continue;
            if (!MODEL_PATTERN.test(fm.model.trim())) invalid.push(`${name} (model="${fm.model}")`);
        }
        expect(invalid, `Skills with invalid model: ${invalid.join(', ')}`).to.deep.equal([]);
    });
});

describe('frontmatter schema: agents', function () {
    const agents = listAgents();

    it('every agent .md has parseable frontmatter', function () {
        const broken = [];
        for (const { name, path: p } of agents) {
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm) broken.push(name);
        }
        expect(broken, `Agents missing or malformed frontmatter: ${broken.join(', ')}`).to.deep.equal([]);
    });

    it('every agent .md has `name` matching its filename', function () {
        const mismatches = [];
        for (const { name, path: p } of agents) {
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm) continue;
            if (!fm.name) {
                mismatches.push(`${name} (missing name)`);
                continue;
            }
            if (fm.name !== name) {
                mismatches.push(`${name} (frontmatter name="${fm.name}")`);
            }
        }
        expect(mismatches, `Agent name mismatches: ${mismatches.join(', ')}`).to.deep.equal([]);
    });

    it('every agent .md has a non-empty `description`', function () {
        const empty = [];
        for (const { name, path: p } of agents) {
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm) continue;
            if (!fm.description || !fm.description.trim() || fm.description.trim() === '|') {
                empty.push(name);
            }
        }
        expect(empty, `Agents with empty description: ${empty.join(', ')}`).to.deep.equal([]);
    });

    it('every agent .md `model` field (if set) names a valid Claude model', function () {
        const invalid = [];
        for (const { name, path: p } of agents) {
            const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
            if (!fm || !fm.model) continue;
            if (!MODEL_PATTERN.test(fm.model.trim())) invalid.push(`${name} (model="${fm.model}")`);
        }
        expect(invalid, `Agents with invalid model: ${invalid.join(', ')}`).to.deep.equal([]);
    });
});
