const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REFS = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'references');

describe('plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md', function () {
    const filePath = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'SKILL.md');
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

    it('documents 4 modes: live, dry-run, plan-only, dry-run-analyze', function () {
        for (const mode of ['live', 'dry-run', 'plan-only', 'dry-run-analyze']) {
            expect(content.includes(mode), `mode "${mode}" not documented`).to.be.true;
        }
    });

    it('documents --plan-only flag in Mode detection', function () {
        expect(content.includes('--plan-only'), '--plan-only flag').to.be.true;
    });

    it('references simulate-prefix.md for dry-run agent dispatch', function () {
        expect(content.includes('simulate-prefix.md'), 'simulate-prefix reference').to.be.true;
    });

    it('contains Simulated Execution Trace section for dry-run mode', function () {
        expect(content.includes('Simulated Execution Trace'), 'simulated trace section').to.be.true;
    });

    it('documents --dry-run-analyze flag in mode detection', function () {
        expect(content.includes('--dry-run-analyze'), '--dry-run-analyze flag').to.be.true;
    });
});

describe('references/delivery-agent-description.md (envelope only)', function () {
    const filePath = path.join(REFS, 'delivery-agent-description.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains Working directory: header field', function () {
        expect(content.includes('Working directory:'), 'Working directory').to.be.true;
    });

    it('contains Self-merge: yes | no field', function () {
        expect(content.includes('Self-merge:'), 'Self-merge field').to.be.true;
    });

    it('contains Task ID: [TASK_ID] field', function () {
        expect(content.includes('Task ID:'), 'Task ID field').to.be.true;
    });

    // INVARIANT content (MAX_RETRIES, TaskList cascade, investigation-task-template
    // reference, single-commit rule, multi-section ## What to do / ## Definition of done)
    // was promoted to agents/delivery-agent.md. Those assertions live in
    // test/delivery-agent-frontmatter.test.js now.
});

describe('references/self-merge-wrapper.md (deleted)', function () {
    const filePath = path.join(REFS, 'self-merge-wrapper.md');

    it('no longer exists — content absorbed into delivery-agent-description.md', function () {
        expect(fs.existsSync(filePath), 'self-merge-wrapper.md should not exist').to.be.false;
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

describe('references/simulate-prefix.md', function () {
    const filePath = path.join(REFS, 'simulate-prefix.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains SIMULATE MODE banner', function () {
        expect(content.includes('SIMULATE MODE'), 'SIMULATE MODE banner').to.be.true;
    });

    it('forbids real actions (git, file modifications, real Agent dispatch)', function () {
        expect(content.includes('No git commands'), 'no git').to.be.true;
        expect(content.includes('No file modifications'), 'no file mods').to.be.true;
        expect(content.includes('No real Agent dispatch'), 'no real Agent').to.be.true;
    });

    it('describes the read-only cascade-dispatch directive', function () {
        expect(content.includes('TaskList'), 'TaskList allowed').to.be.true;
        expect(content.includes('TaskGet'), 'TaskGet allowed').to.be.true;
        expect(content.includes('DO NOT call Agent'), 'no Agent dispatch').to.be.true;
    });

    it('mandates the standard status block fields', function () {
        for (const f of ['RESULT', 'WORK', 'INCOMPLETE', 'FAILURE', 'ARTIFACT', 'DISPATCHED']) {
            expect(content.includes(f), `status field ${f}`).to.be.true;
        }
    });
});

describe('references/investigation-task-template.md', function () {
    const filePath = path.join(REFS, 'investigation-task-template.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains TaskCreate payload with "Investigate failure" subject', function () {
        expect(content.includes('Investigate failure'), 'investigation task subject').to.be.true;
        expect(content.includes('TaskCreate'), 'TaskCreate verb').to.be.true;
    });

    it('contains FAILURE → ARTIFACT mapping with all 5 failure types', function () {
        for (const f of ['no_change', 'partial_change', 'test_failures', 'conflict_needs_user', 'needs_split']) {
            expect(content.includes(f), `failure type ${f}`).to.be.true;
        }
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

describe('references/reviewer-full.md', function () {
    const content = fs.readFileSync(
        path.join(REFS, 'reviewer-full.md'), 'utf8');

    it('contains Goldilocks Rule (proposal sizing guidance)', function () {
        expect(content.includes('Goldilocks'), 'Goldilocks').to.be.true;
    });

    it('DEPENDS ON must name the concrete artifact constraint', function () {
        expect(content.includes('the reason must name the concrete artifact'),
            'concrete artifact constraint').to.be.true;
    });

    it('output marks trivial tasks with "Trivial: yes"', function () {
        expect(content.includes('Trivial: yes'), 'Trivial: yes marker').to.be.true;
    });

    it('output uses === PROPOSAL section header format', function () {
        expect(content.includes('=== PROPOSAL'), 'PROPOSAL section header').to.be.true;
    });
});

describe('plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md — cascade example', function () {
    const filePath = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'SKILL.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('contains cascade example in chain detection section', function () {
        expect(content.includes('cascade — chain tail fans out'), 'cascade example label').to.be.true;
    });

    it('cascade example shows chain-2 create-wt blocked by chain-1 tail AND upstream standalones', function () {
        expect(
            content.includes("chain-2's create-wt is blocked by B (chain-1 tail delivery-agent) AND C AND D"),
            'chain-2 wiring in cascade example'
        ).to.be.true;
    });

    it('cascade example correctly assigns E as chain-2 head and F as chain-2 tail', function () {
        expect(content.includes('Path=[E,F] → chain-2'), 'chain-2 from fan-in node').to.be.true;
        expect(content.includes('E=head, F=tail'), 'E head F tail').to.be.true;
    });

    it('cascade example shows B as chain-1 tail with succ==2 ending the chain', function () {
        expect(content.includes('succ==2 → stop. Path=[A,B] → chain-1'), 'chain-1 ends at B').to.be.true;
        expect(content.includes('A=head, B=tail'), 'A head B tail').to.be.true;
    });
});

describe('plugins/planning-suite/skills/schedule-plan-tasks/fixtures/plan6-deep-cascading.md', function () {
    const filePath = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'fixtures', 'plan6-deep-cascading.md');
    const content = fs.readFileSync(filePath, 'utf8');

    it('documents all topology labels in Context section', function () {
        const missing = [];
        for (const label of ['chain-1', 'chain-2', 'standalone C', 'standalone D', 'standalone G', 'standalone H']) {
            if (!content.includes(label)) missing.push(label);
        }
        expect(missing, 'missing topology labels').to.deep.equal([]);
    });

    it('annotates Phase B as chain-1 tail with succ=2 fan-out', function () {
        expect(content.includes('succ=2'), 'succ=2 on B').to.be.true;
        expect(content.includes('chain-1 tail'), 'chain-1 tail label').to.be.true;
    });

    it('annotates Phase E as chain-2 head with pred=2 fan-in', function () {
        expect(content.includes('pred=2'), 'pred=2 on E').to.be.true;
        expect(content.includes('chain-2 head') || content.includes('chain-2 begins'), 'chain-2 head label').to.be.true;
    });

    it('Phase C and Phase D both declare DEPENDS ON Phase B', function () {
        const count = (content.match(/DEPENDS ON Phase B/g) || []).length;
        expect(count, '"DEPENDS ON Phase B" count (need ≥2 for C and D)').to.be.at.least(2);
    });

    it('Phase E declares DEPENDS ON Phase C AND Phase D (fan-in)', function () {
        expect(content.includes('DEPENDS ON Phase C'), 'E depends on C').to.be.true;
        expect(content.includes('DEPENDS ON Phase D'), 'E depends on D').to.be.true;
    });

    it('Phase G and Phase H both declare DEPENDS ON Phase F', function () {
        const count = (content.match(/DEPENDS ON Phase F/g) || []).length;
        expect(count, '"DEPENDS ON Phase F" count (need ≥2 for G and H)').to.be.at.least(2);
    });

    it('Git Strategy documents chain-2 create-wt blocked by both C and D (fan-in wiring)', function () {
        expect(content.includes('blocked by both C and D'), 'chain-2 create-wt fan-in wiring').to.be.true;
    });

    it('Git Strategy documents Regression Blocker Reduction — F is NOT a direct regression blocker', function () {
        expect(content.includes('Regression Blocker Reduction'), 'Regression Blocker Reduction section').to.be.true;
        expect(
            content.includes('NOT a direct regression blocker') || content.includes('is NOT a direct'),
            'F excluded from direct blockers'
        ).to.be.true;
    });

    it('Git Strategy states G and H are the direct regression blockers (not F)', function () {
        expect(content.includes('Direct regression blockers: G and H'), 'direct blockers G and H').to.be.true;
    });
});

describe('plugins/planning-suite/skills/schedule-plan-tasks/fixtures/plan7-assert6-violation.md', function () {
    const content = fs.readFileSync(
        path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'fixtures', 'plan7-assert6-violation.md'), 'utf8');

    it('is a positive-control fixture: Assert 6 expected to PASS', function () {
        expect(content.includes('Assert 6'), 'Assert 6 reference').to.be.true;
        expect(content.includes('PASS'), 'expected PASS outcome').to.be.true;
    });

    it('fixture exercises metadata.target_branch field', function () {
        expect(content.includes('metadata.target_branch'),
            'metadata.target_branch').to.be.true;
    });
});

describe('skills/test-schedule-plan-tasks — structure', function () {
    const TEST_SKILL_DIR = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'test-schedule-plan-tasks');
    const REFS = path.join(TEST_SKILL_DIR, 'references');
    const skill = fs.readFileSync(path.join(TEST_SKILL_DIR, 'SKILL.md'), 'utf8');

    it('SKILL.md exists and names all 7 fixtures', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const label = `plan${i}`;
            if (!skill.includes(label)) missing.push(label);
        }
        expect(missing, 'missing fixture references').to.deep.equal([]);
    });

    it('references agent-template.md', function () {
        expect(skill.includes('agent-template.md'), 'agent-template.md reference').to.be.true;
    });

    it('references all 7 expect-planN.md files', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            if (!skill.includes(`expect-plan${i}.md`)) missing.push(`expect-plan${i}.md`);
        }
        expect(missing, 'missing expectation file references').to.deep.equal([]);
    });

    it('agent-template.md names all 6 validation check labels (A–F)', function () {
        const template = fs.readFileSync(
            path.join(TEST_SKILL_DIR, 'references', 'agent-template.md'), 'utf8');
        const missing = [];
        for (const label of ['expected_chains', 'expected_standalones', 'chain_specs',
                             'standalone_specs', 'Wiring Integrity', 'special_assertions']) {
            if (!template.includes(label)) missing.push(label);
        }
        expect(missing, 'missing agent-template.md check labels').to.deep.equal([]);
    });

    it('agent-template.md contains RESULT: PASS and RESULT: FAIL return format', function () {
        const content = fs.readFileSync(path.join(REFS, 'agent-template.md'), 'utf8');
        expect(content.includes('RESULT: PASS'), 'RESULT: PASS').to.be.true;
        expect(content.includes('RESULT: FAIL'), 'RESULT: FAIL').to.be.true;
    });

    it('every expect-planN.md exists on disk', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const fp = path.join(REFS, `expect-plan${i}.md`);
            if (!fs.existsSync(fp)) missing.push(`expect-plan${i}.md`);
        }
        expect(missing, 'missing expectation files').to.deep.equal([]);
    });

    it('every expect-planN.md declares expected_chains and expected_standalones', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const content = fs.readFileSync(path.join(REFS, `expect-plan${i}.md`), 'utf8');
            if (!content.includes('expected_chains')) missing.push(`expect-plan${i}.md missing expected_chains`);
            if (!content.includes('expected_standalones')) missing.push(`expect-plan${i}.md missing expected_standalones`);
        }
        expect(missing, 'missing topology fields').to.deep.equal([]);
    });

    it('every expect-planN.md has a special_assertions section', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const content = fs.readFileSync(path.join(REFS, `expect-plan${i}.md`), 'utf8');
            if (!content.includes('special_assertions')) missing.push(`expect-plan${i}.md`);
        }
        expect(missing, 'missing special_assertions').to.deep.equal([]);
    });

    it('expect-plan2.md asserts Assert 7 (single create-wt for 4-node chain)', function () {
        const content = fs.readFileSync(path.join(REFS, 'expect-plan2.md'), 'utf8');
        expect(content.includes('Assert 7'), 'Assert 7 in plan2').to.be.true;
    });

    it('expect-plan4.md asserts dry-run trivial override (10 task count)', function () {
        const content = fs.readFileSync(path.join(REFS, 'expect-plan4.md'), 'utf8');
        expect(content.includes('trivial override'), 'trivial override assertion').to.be.true;
        expect(content.includes('10'), '10-task count').to.be.true;
    });

    it('expect-plan6.md asserts Regression Blocker Reduction (F excluded)', function () {
        const content = fs.readFileSync(path.join(REFS, 'expect-plan6.md'), 'utf8');
        expect(content.includes('Regression Blocker Reduction'), 'Reduction section').to.be.true;
        expect(content.includes('MUST NOT appear'), 'F must not appear').to.be.true;
    });

    it('expect-plan6.md asserts chain-2 create-wt fan-in wiring (blocked by B, C, D)', function () {
        const content = fs.readFileSync(path.join(REFS, 'expect-plan6.md'), 'utf8');
        expect(content.includes('fan-in wiring'), 'fan-in wiring assertion').to.be.true;
    });

    it('expect-plan7.md asserts Assert 6 metadata.target_branch PASS (positive-control)', function () {
        const content = fs.readFileSync(path.join(REFS, 'expect-plan7.md'), 'utf8');
        expect(content.includes('Assert 6'), 'Assert 6 check').to.be.true;
        expect(content.includes('metadata.target_branch'), 'metadata.target_branch field').to.be.true;
        expect(content.includes('PASS'), 'Assert 6 must PASS').to.be.true;
    });

    it('plan7 fixture exists and is a positive-control test (no Assert 6 violation expected)', function () {
        const fixturePath = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'fixtures', 'plan7-assert6-violation.md');
        const content = fs.readFileSync(fixturePath, 'utf8');
        expect(content.includes('positive-control'), 'positive-control label').to.be.true;
        expect(content.includes('Assert 6 should PASS'), 'Assert 6 PASS statement').to.be.true;
    });
});

describe('skills/test-schedule-plan-tasks — dry-run track', function () {
    const TEST_SKILL_DIR = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'test-schedule-plan-tasks');
    const DR_REFS = path.join(TEST_SKILL_DIR, 'references');
    const skill = fs.readFileSync(path.join(TEST_SKILL_DIR, 'SKILL.md'), 'utf8');

    it('SKILL.md references agent-template-dryrun.md', function () {
        expect(skill.includes('agent-template-dryrun.md'), 'agent-template-dryrun.md reference').to.be.true;
    });

    it('SKILL.md references all 7 expect-planN-dryrun.md files', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            if (!skill.includes(`expect-plan${i}-dryrun.md`)) missing.push(`expect-plan${i}-dryrun.md`);
        }
        expect(missing, 'missing dry-run expectation file references').to.deep.equal([]);
    });

    it('agent-template-dryrun.md exists and contains RESULT: PASS and RESULT: FAIL', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'agent-template-dryrun.md'), 'utf8');
        expect(content.includes('RESULT: PASS'), 'RESULT: PASS').to.be.true;
        expect(content.includes('RESULT: FAIL'), 'RESULT: FAIL').to.be.true;
    });

    it('agent-template-dryrun.md invokes --dry-run mode', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'agent-template-dryrun.md'), 'utf8');
        expect(content.includes('--dry-run'), '--dry-run flag in template').to.be.true;
    });

    it('agent-template-dryrun.md contains the 6 validation check labels (A–F)', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'agent-template-dryrun.md'), 'utf8');
        const missing = [];
        for (const label of ['Trace header', 'Validation section', 'Wave 1 delivery-agents',
                             'Regression ordering', 'No unexpected failures', 'Special assertions']) {
            if (!content.includes(label)) missing.push(label);
        }
        expect(missing, 'missing validation check labels').to.deep.equal([]);
    });

    it('every expect-planN-dryrun.md exists on disk', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const fp = path.join(DR_REFS, `expect-plan${i}-dryrun.md`);
            if (!fs.existsSync(fp)) missing.push(`expect-plan${i}-dryrun.md`);
        }
        expect(missing, 'missing dry-run expectation files').to.deep.equal([]);
    });

    it('every expect-planN-dryrun.md declares expected_first_delivery_agents and validation_all_pass', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const content = fs.readFileSync(path.join(DR_REFS, `expect-plan${i}-dryrun.md`), 'utf8');
            if (!content.includes('expected_first_delivery_agents')) missing.push(`expect-plan${i}-dryrun.md missing expected_first_delivery_agents`);
            if (!content.includes('validation_all_pass')) missing.push(`expect-plan${i}-dryrun.md missing validation_all_pass`);
        }
        expect(missing, 'missing dry-run topology fields').to.deep.equal([]);
    });

    it('every expect-planN-dryrun.md declares expected_failures', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const content = fs.readFileSync(path.join(DR_REFS, `expect-plan${i}-dryrun.md`), 'utf8');
            if (!content.includes('expected_failures')) missing.push(`expect-plan${i}-dryrun.md`);
        }
        expect(missing, 'missing expected_failures field').to.deep.equal([]);
    });

    it('every expect-planN-dryrun.md has a special_assertions section', function () {
        const missing = [];
        for (let i = 1; i <= 7; i++) {
            const content = fs.readFileSync(path.join(DR_REFS, `expect-plan${i}-dryrun.md`), 'utf8');
            if (!content.includes('special_assertions')) missing.push(`expect-plan${i}-dryrun.md`);
        }
        expect(missing, 'missing special_assertions').to.deep.equal([]);
    });

    it('expect-plan4-dryrun.md asserts trivial override NOT active (task count 8, not 10)', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'expect-plan4-dryrun.md'), 'utf8');
        expect(content.includes('8'), 'task count 8').to.be.true;
        expect(content.includes('trivial'), 'trivial isolation mention').to.be.true;
    });

    it('expect-plan6-dryrun.md asserts cascade depth ≥ 6 waves (fan-in wiring validation)', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'expect-plan6-dryrun.md'), 'utf8');
        expect(content.includes('6'), 'cascade depth 6').to.be.true;
        expect(content.includes('fan-in'), 'fan-in assertion').to.be.true;
    });

    it('expect-plan7-dryrun.md asserts Assert 6 validated against real task metadata (not ledger)', function () {
        const content = fs.readFileSync(path.join(DR_REFS, 'expect-plan7-dryrun.md'), 'utf8');
        expect(content.includes('Assert 6'), 'Assert 6 check').to.be.true;
        expect(content.includes('real task'), 'real task metadata check').to.be.true;
        expect(content.includes('PASS'), 'Assert 6 must PASS').to.be.true;
    });

    it('SKILL.md Step 1b declares sequential execution to prevent TaskList pollution', function () {
        expect(skill.includes('sequential'), 'sequential keyword in Step 1b').to.be.true;
        expect(skill.includes('one at a time'), 'one at a time phrase').to.be.true;
    });
});

describe('cross-reference integrity', function () {
    const skillPath = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'schedule-plan-tasks', 'SKILL.md');
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
