const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('delivery-agent-description.md (envelope template — runtime header + one-paragraph guidance)', function () {
    const templatePath = path.join(__dirname, '../skills/schedule-plan-tasks/references/delivery-agent-description.md');
    const content = fs.readFileSync(templatePath, 'utf8');

    // --- Runtime header fields ---

    it('contains Task ID: [TASK_ID] field', function () {
        expect(content.includes('Task ID:')).to.be.true;
        expect(content.includes('[TASK_ID]')).to.be.true;
    });

    it('contains Working directory field', function () {
        expect(content.includes('Working directory:')).to.be.true;
    });

    it('contains MERGE_TARGET field', function () {
        expect(content.includes('MERGE_TARGET:')).to.be.true;
        expect(content.includes('[MERGE_TARGET value]')).to.be.true;
    });

    it('contains Self-merge: yes | no field', function () {
        expect(content.includes('Self-merge:')).to.be.true;
    });

    it('contains Isolation field with both modes', function () {
        expect(content.includes('Isolation:')).to.be.true;
        expect(content.includes('native worktree')).to.be.true;
        expect(content.includes('none (trivial)')).to.be.true;
    });

    it('contains External resources field', function () {
        expect(content.includes('External resources:')).to.be.true;
    });

    it('references [one-paragraph guidance] placeholder', function () {
        expect(content.includes('one-paragraph guidance') || content.includes('[one-paragraph guidance]')).to.be.true;
    });

    // --- Multi-section structure must NOT be in the envelope ---

    it('does NOT contain ## Purpose / ## What to do / ## Definition of done section headings', function () {
        // The envelope collapsed those into one paragraph; the agent infers them.
        expect(content.includes('## Purpose\n')).to.be.false;
        expect(content.includes('## What to do\n')).to.be.false;
        expect(content.includes('## Definition of done\n')).to.be.false;
    });

    it('does NOT contain "Sub-tasks allowed" field (always available now)', function () {
        expect(content.includes('Sub-tasks allowed:')).to.be.false;
    });

    // --- INVARIANT content moved to agents/delivery-agent.md — not present here ---

    it('does NOT contain L0/L0a/L1/L2 lifecycle steps (moved to agents/)', function () {
        expect(content.includes('### Step L0')).to.be.false;
        expect(content.includes('### Step L1')).to.be.false;
        expect(content.includes('### Step L2')).to.be.false;
    });

    it('does NOT contain MAX_RETRIES self-merge bash (moved to agents/)', function () {
        expect(content.includes('MAX_RETRIES')).to.be.false;
        expect(content.includes('git rebase')).to.be.false;
    });

    it('does NOT contain ## Status protocol (moved to agents/)', function () {
        expect(content.includes('## Status protocol')).to.be.false;
    });

    it('does NOT contain ## Specialist agents catalog (moved to agents/)', function () {
        expect(content.includes('## Specialist agents')).to.be.false;
    });

    it('does NOT contain ## On RESULT: complete / partial / failed (moved to agents/)', function () {
        expect(content.includes('## On RESULT: complete')).to.be.false;
        expect(content.includes('## On RESULT: failed')).to.be.false;
    });

    it('does NOT contain ## Before return: commit (moved to agents/)', function () {
        expect(content.includes('## Before return: commit')).to.be.false;
    });

    // --- Size budget — ≤ 4 KB ---

    it('is small — ≤ 4 KB', function () {
        const bytes = Buffer.byteLength(content, 'utf8');
        expect(bytes, `envelope size ${bytes} bytes`).to.be.at.most(4096);
    });
});

describe('delivery-agent fixtures — envelope-only shape (header + paragraph)', function () {
    const FIXTURES = path.join(__dirname, 'fixtures', 'delivery-agent');
    const fixtureFiles = ['fixture-standalone.md', 'fixture-trivial.md', 'fixture-chain-head.md'];

    for (const name of fixtureFiles) {
        describe(name, function () {
            const c = fs.readFileSync(path.join(FIXTURES, name), 'utf8');

            it('has runtime header fields: Task ID, Working directory, MERGE_TARGET, Isolation, Self-merge', function () {
                expect(c.includes('Task ID:')).to.be.true;
                expect(c.includes('Working directory:')).to.be.true;
                expect(c.includes('MERGE_TARGET:')).to.be.true;
                expect(c.includes('Isolation:')).to.be.true;
                expect(c.includes('Self-merge:')).to.be.true;
            });

            it('does NOT pin Model: ... (model lives in agents/delivery-agent.md frontmatter)', function () {
                expect(c.includes('Model:')).to.be.false;
            });

            it('does NOT contain "Sub-tasks allowed:" field', function () {
                expect(c.includes('Sub-tasks allowed:')).to.be.false;
            });

            it('does NOT contain INVARIANT body (Execution lifecycle, MAX_RETRIES, Status protocol, Specialist agents)', function () {
                expect(c.includes('## Execution lifecycle')).to.be.false;
                expect(c.includes('MAX_RETRIES')).to.be.false;
                expect(c.includes('## Status protocol')).to.be.false;
                expect(c.includes('## Specialist agents')).to.be.false;
            });

            it('does NOT contain multi-section ## Purpose/## What to do/## Definition of done headings', function () {
                expect(c.includes('## Purpose\n')).to.be.false;
                expect(c.includes('## What to do\n')).to.be.false;
                expect(c.includes('## Definition of done\n')).to.be.false;
            });

            it('is small — ≤ ~1 KB (slim envelope)', function () {
                const bytes = Buffer.byteLength(c, 'utf8');
                expect(bytes, `fixture size ${bytes} bytes`).to.be.at.most(1100);
            });
        });
    }
});

describe('plugins/planning-suite/agents/delivery-agent.md — frontmatter pins model', function () {
    const agentPath = path.join(__dirname, '..', 'agents', 'delivery-agent.md');

    it('frontmatter pins model: claude-sonnet-4-6', function () {
        const c = fs.readFileSync(agentPath, 'utf8');
        const fmEnd = c.indexOf('\n---\n', 4);
        const fm = c.slice(4, fmEnd);
        expect(fm.includes('model: claude-sonnet-4-6')).to.be.true;
    });
});
