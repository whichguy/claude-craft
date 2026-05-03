const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('plugins/planning-suite/agents/delivery-agent.md (promoted from reference template)', function () {
    const agentPath = path.join(__dirname, '../plugins/planning-suite/agents/delivery-agent.md');

    it('file exists', function () {
        expect(fs.existsSync(agentPath), 'plugins/planning-suite/agents/delivery-agent.md').to.be.true;
    });

    const content = fs.readFileSync(agentPath, 'utf8');

    // --- Frontmatter ---

    it('has YAML frontmatter delimited by ---', function () {
        expect(content.startsWith('---\n')).to.be.true;
        expect(content.indexOf('\n---\n', 4)).to.be.above(0);
    });

    function frontmatterText() {
        const end = content.indexOf('\n---\n', 4);
        return content.slice(4, end);
    }

    it('frontmatter sets name: delivery-agent', function () {
        expect(frontmatterText().includes('name: delivery-agent')).to.be.true;
    });

    it('frontmatter sets model: claude-sonnet-4-6', function () {
        expect(frontmatterText().includes('model: claude-sonnet-4-6')).to.be.true;
    });

    it('frontmatter has a description block', function () {
        expect(frontmatterText().includes('description:')).to.be.true;
    });

    it('frontmatter sets a color', function () {
        expect(/\ncolor:\s*\S+/.test(frontmatterText())).to.be.true;
    });

    // --- INVARIANT body markers (moved out of references/) ---

    it('contains ## Execution lifecycle section', function () {
        expect(content.includes('## Execution lifecycle')).to.be.true;
    });

    it('contains all lifecycle steps in order: L0, L0a, L1, L2', function () {
        const l0 = content.indexOf('### Step L0');
        const l0a = content.indexOf('### Step L0a');
        const l1 = content.indexOf('### Step L1');
        const l2 = content.indexOf('### Step L2');
        expect(l0).to.be.above(-1, 'Step L0 missing');
        expect(l0a).to.be.above(l0, 'Step L0a should follow L0');
        expect(l1).to.be.above(l0a, 'Step L1 should follow L0a');
        expect(l2).to.be.above(l1, 'Step L2 should follow L1');
    });

    it('contains ### Phase cascade and ### Phase failure', function () {
        expect(content.includes('### Phase cascade')).to.be.true;
        expect(content.includes('### Phase failure')).to.be.true;
    });

    it('contains ## Specialist agents catalog', function () {
        expect(content.includes('## Specialist agents')).to.be.true;
    });

    it('contains ## Sub-task spawning section (always available)', function () {
        expect(content.includes('## Sub-task spawning')).to.be.true;
        // No "yes only" gating
        expect(content.includes('Sub-tasks allowed: yes only')).to.be.false;
    });

    it('contains self-merge bash with MAX_RETRIES=5', function () {
        expect(content.includes('MAX_RETRIES=5')).to.be.true;
        expect(content.includes('git rebase')).to.be.true;
        expect(content.includes('git merge --no-ff')).to.be.true;
    });

    it('contains ## Status protocol with all 6 fields', function () {
        for (const f of ['RESULT:', 'WORK:', 'INCOMPLETE:', 'FAILURE:', 'ARTIFACT:', 'DISPATCHED:']) {
            expect(content.includes(f), `status field ${f}`).to.be.true;
        }
    });

    it('contains ## On RESULT: complete with TaskList cascade', function () {
        expect(content.includes('## On RESULT: complete')).to.be.true;
        expect(content.includes('TaskList')).to.be.true;
        expect(content.includes('blockedBy')).to.be.true;
    });

    it('## On RESULT: failed references investigation-task-template.md', function () {
        expect(content.includes('## On RESULT: failed')).to.be.true;
        expect(content.includes('investigation-task-template.md')).to.be.true;
    });

    it('keeps [TASK_ID] and [MERGE_TARGET] placeholders for runtime substitution by the envelope', function () {
        expect(content.includes('[TASK_ID]')).to.be.true;
        expect(content.includes('[MERGE_TARGET]')).to.be.true;
    });

    it('contains no Python-style booleans (=True / =False)', function () {
        expect(content.includes('=True')).to.be.false;
        expect(content.includes('=False')).to.be.false;
    });

    it('uses run_in_background: true (JSON lowercase)', function () {
        expect(content.includes('run_in_background: true')).to.be.true;
        expect(content.includes('run_in_background: True')).to.be.false;
    });

    it('contains "exactly one `git commit`" in commit section', function () {
        expect(content.includes('exactly one `git commit`')).to.be.true;
    });

    it('Phase table has all 7 rows (0-6)', function () {
        expect(content.includes('| 0 | Environment prep')).to.be.true;
        expect(content.includes('| 1 | Test spec / coverage plan')).to.be.true;
        expect(content.includes('| 2 | Implement')).to.be.true;
        expect(content.includes('| 3 | Code quality + security review')).to.be.true;
        expect(content.includes('| 4 | Documentation')).to.be.true;
        expect(content.includes('| 5 | Tests + fix')).to.be.true;
        expect(content.includes('| 6 | Migration')).to.be.true;
    });

    it('contains needs_split FAILURE enum', function () {
        expect(content.includes('needs_split')).to.be.true;
    });

    it('does NOT contain deprecated sections', function () {
        expect(content.includes('## Children to dispatch on success')).to.be.false;
        expect(content.includes('## Dependents unblocked on success')).to.be.false;
        expect(content.includes('### Cascade rule')).to.be.false;
    });

    it('Specialist agents catalog has 6 entries (Research, Test spec, Code review, Docs, Tests+fix, Migration)', function () {
        const specStart = content.indexOf('## Specialist agents');
        const spec = content.slice(specStart);
        const entryHeaderCount = (spec.match(/^\*\*[A-Z][^*]+ \(Phase /gm) || []).length;
        expect(entryHeaderCount).to.equal(6);
    });
});
