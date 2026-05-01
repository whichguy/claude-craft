const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REFS = path.join(REPO_ROOT, 'skills', 'schedule-plan-tasks', 'references');

describe('skills/schedule-plan-tasks/SKILL.md', function () {
    const filePath = path.join(REPO_ROOT, 'skills', 'schedule-plan-tasks', 'SKILL.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains chain detection algorithm', function () {
        const missing = [];
        if (!content.includes('chain seeds')) missing.push('"chain seeds" not found');
        if (!content.includes('succ[')) missing.push('"succ[" not found');
        if (!content.includes('pred[')) missing.push('"pred[" not found');
        if (!content.includes('fan-in')) missing.push('"fan-in" not found');
        if (!content.includes('fan-out')) missing.push('"fan-out" not found');
        expect(missing, 'chain detection markers').to.deep.equal([]);
    });

    it('contains Two-phase task creation (Binding)', function () {
        expect(content.includes('Two-phase task creation'), 'Two-phase task creation').to.be.true;
    });

    it('contains Assert 3, 5, 6, 7, 8', function () {
        for (let i of [3, 5, 6, 7, 8]) {
            const label = 'Assert ' + i;
            expect(content.includes(label), label + ' not found').to.be.true;
        }
    });

    it('does NOT contain Assert 4 (legacy propagate SHA rule removed)', function () {
        expect(content.includes('Assert 4')).to.be.false;
    });

    it('contains FAILURE_TYPE: needs_split', function () {
        expect(content.includes('needs_split'), 'needs_split').to.be.true;
    });

    it('contains "### Chains" table in Dry-Run Report section', function () {
        expect(content.includes('### Chains'), '### Chains').to.be.true;
    });

    it('contains addBlockedBy (Phase 2 wiring pass)', function () {
        const matches = content.match(/addBlockedBy/g);
        const count = matches ? matches.length : 0;
        expect(count, 'addBlockedBy occurrences: ' + count).to.be.at.least(2);
    });
});

describe('references/run-agent-description.md', function () {
    const filePath = path.join(REFS, 'run-agent-description.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains ## Working directory', function () {
        expect(content.includes('## Working directory'), 'Working directory').to.be.true;
    });

    it('contains ## Definition of done', function () {
        expect(content.includes('## Definition of done'), 'Definition of done').to.be.true;
    });

    it('contains ## Dependents unblocked on success', function () {
        expect(content.includes('## Dependents unblocked on success'), 'Dependents unblocked on success').to.be.true;
    });

    it('contains "exactly one `git commit`" in commit section', function () {
        expect(content.includes('exactly one `git commit`'), 'exactly one git commit').to.be.true;
    });

    it('contains needs_split in FAILURE_TYPE', function () {
        expect(content.includes('needs_split'), 'needs_split').to.be.true;
    });

    it('contains Chain: and Chain ID: fields', function () {
        expect(content.includes('Chain:'), 'Chain:').to.be.true;
        expect(content.includes('Chain ID:'), 'Chain ID:').to.be.true;
    });

    it('contains conditional self-merge (only for Chain: none and Chain: tail)', function () {
        expect(content.includes('Chain: none'), 'Chain: none').to.be.true;
        expect(content.includes('Chain: tail'), 'Chain: tail').to.be.true;
    });
});

describe('references/self-merge-wrapper.md', function () {
    const filePath = path.join(REFS, 'self-merge-wrapper.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains header: Appended only to Chain: none and Chain: tail tasks', function () {
        expect(content.includes('Appended only to Chain: none and Chain: tail tasks'), 'header').to.be.true;
    });
});

describe('references/create-wt-prompt.md', function () {
    const filePath = path.join(REFS, 'create-wt-prompt.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains chain naming (chain-K instructions)', function () {
        expect(content.includes('chain-K'), 'chain-K').to.be.true;
    });

    it('contains shared worktree for chain members', function () {
        expect(content.includes('share this single worktree'), 'shared worktree').to.be.true;
    });

    it('contains [ -e guard before symlink with resource-not-found error message', function () {
        expect(content.includes('-e'), '-e flag').to.be.true;
        expect(content.includes('resource not found'), 'resource not found message').to.be.true;
    });
});

describe('references/dry-run-analyzer.md', function () {
    const filePath = path.join(REFS, 'dry-run-analyzer.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('states Assert 1 and Assert 2 no longer exist', function () {
        expect(content.includes('Assert 1'), 'Assert 1 ref').to.be.true;
        expect(content.includes('Assert 2'), 'Assert 2 ref').to.be.true;
    });

    it('contains Assert 7 for chain integrity', function () {
        expect(content.includes('Assert 7'), 'Assert 7').to.be.true;
    });

    it('contains regression coverage for chain-tail and standalone', function () {
        expect(content.includes('chain-tail'), 'chain-tail').to.be.true;
        expect(content.includes('standalone'), 'standalone').to.be.true;
    });
});

describe('cross-reference integrity', function () {
    const skillPath = path.join(REPO_ROOT, 'skills', 'schedule-plan-tasks', 'SKILL.md');
    const skill = fs.readFileSync(skillPath, 'utf8');

    it('every reference file mentioned in SKILL.md exists on disk', function () {
        const missing = [];
        const refs = [...skill.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/references\/([^\s\)`]+)/g)];
        for (const m of refs) {
            const name = m[1];
            if (name.includes('*') || name.includes('?')) continue;
            const fp = path.join(REFS, name);
            if (!fs.existsSync(fp)) missing.push(name);
        }
        expect(missing, 'missing reference files').to.deep.equal([]);
    });
});
