const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Review-Plan Integration (Intent-based)', function () {
    const skillPath = path.join(__dirname, '..', 'skills', 'review-plan', 'SKILL.md');
    let skillContent;

    before(function () {
        if (!fs.existsSync(skillPath)) {
            this.skip();
        }
        skillContent = fs.readFileSync(skillPath, 'utf-8');
    });

    describe('Output Contract & Schema', function () {
        it('defines EVALUATOR_OUTPUT_CONTRACT with core JSON fields', function () {
            // Find the contract section by looking for the header and capturing until the next header or significant distance
            const contractStart = skillContent.indexOf('--- EVALUATOR_OUTPUT_CONTRACT');
            expect(contractStart, 'EVALUATOR_OUTPUT_CONTRACT header not found').to.be.greaterThan(-1);
            
            const contractText = skillContent.substring(contractStart, contractStart + 2000);
            const requiredFields = ['evaluator', 'pass', 'status', 'elapsed_s', 'findings', 'counts'];
            for (const field of requiredFields) {
                expect(contractText).to.match(new RegExp(`"${field}"`));
            }
        });

        it('ensures all evaluators reference the shared output contract or include core fields', function () {
            // L3 ablation (SKILL-v-no-l3 promotion): GAS + Node evaluators removed.
            const evaluatorConfigs = [
                { name: 'L1 Blocking', pattern: /--- L1 Blocking Evaluator Config/ },
                { name: 'L1 Advisory Structural', pattern: /--- L1 Advisory Structural Evaluator Config/ },
                { name: 'L1 Advisory Process', pattern: /--- L1 Advisory Process Evaluator Config/ },
                { name: 'Cluster', pattern: /--- Cluster Evaluator Config/ },
                { name: 'UI', pattern: /--- UI Evaluator Config/ }
            ];

            const externalContractEvaluators = new Set();

            evaluatorConfigs.forEach(config => {
                const startIdx = skillContent.search(config.pattern);
                expect(startIdx, `${config.name} config not found`).to.be.greaterThan(-1);

                const restAfterStart = skillContent.substring(startIdx + 10);
                // Match any Title-case "<Name> Evaluator Config" header so newly added
                // evaluator types don't silently break the section boundary lookup.
                const nextHeaderRel = restAfterStart.search(/\n\s*--- [A-Z][\w ]*Evaluator Config/);
                const sectionEnd = nextHeaderRel === -1 ? skillContent.length : startIdx + 10 + nextHeaderRel;
                const section = skillContent.substring(startIdx, sectionEnd);

                if (externalContractEvaluators.has(config.name)) {
                    const delegates = /<(gas|node)_eval_path>/i.test(section);
                    expect(delegates, `${config.name} should delegate to external eval file`).to.be.true;
                    return;
                }

                const hasContractRef = section.includes('EVALUATOR_OUTPUT_CONTRACT');
                const hasFields = ['evaluator', 'findings'].every(f => section.includes(`"${f}"`));
                expect(hasContractRef || hasFields, `${config.name} missing contract reference or schema fields`).to.be.true;
            });
        });
    });

    describe('Orchestration & Routing', function () {
        it('identifies critical CLI orchestrator markers for routing', function () {
            const markers = [
                { name: 'pass_count', pattern: /pass_count\s*=\s*\d+|pass_count\s*\+=\s*1/ },
                { name: 'RESULTS_DIR', pattern: /RESULTS_DIR\s*=|"\$RESULTS_DIR"/ },
                { name: 'all_results', pattern: /all_results\s*=\s*\{|all_results\[.+\]\s*=/ },
                { name: 'pass_delta', pattern: /pass_delta\s*=\s*\{|pass_delta\[.+\]/ }
            ];

            markers.forEach(marker => {
                expect(skillContent, `Missing marker: ${marker.name}`).to.match(marker.pattern);
            });
        });

        it('verifies MAX_CONCURRENT setting', function () {
            const maxConcurrentMatch = skillContent.match(/MAX_CONCURRENT\s*=\s*(\d+)/);
            expect(maxConcurrentMatch, 'MAX_CONCURRENT not defined').to.not.be.null;
            const value = parseInt(maxConcurrentMatch[1], 10);
            expect(value).to.be.at.least(1);
        });

        it('verifies wave-based spawning logic', function () {
            expect(skillContent).to.match(/waves\s*=\s*chunk\(.+MAX_CONCURRENT\)/);
            expect(skillContent).to.match(/FOR wave_idx.+IN.+waves/i);
        });
    });

    describe('State Persistence & Recovery', function () {
        it('verifies memoization/checkpointing of critical state', function () {
            const checkpointMatch = skillContent.match(/Checkpoint: persist memoized state|Write memo_file/);
            expect(checkpointMatch, 'Checkpoint logic not found').to.not.be.null;

            const recoveryMatch = skillContent.match(/Context-compression recovery|Restore state/);
            expect(recoveryMatch, 'Recovery logic not found').to.not.be.null;
        });
    });

    describe('Delta-aware Narrowing', function () {
        it('ensures delta filter is applied to non-blocking evaluators', function () {
            // L3 ablation: GAS + Node evaluators removed.
            const evaluatorsWithDelta = [
                'L1 Advisory Structural',
                'L1 Advisory Process',
                'Cluster',
                'UI'
            ];

            evaluatorsWithDelta.forEach(name => {
                const regex = new RegExp(`--- ${name} Evaluator Config[\\s\\S]+?delta filter`, 'i');
                expect(skillContent, `${name} missing delta filter`).to.match(regex);
            });
        });
    });

    describe('Cross-file Invariants', function () {
        it('verifies base_l1 in helper matches QUESTIONS.md Layer 1 row count', function () {
            const questionsPath = path.join(__dirname, '..', 'skills', 'review-plan', 'QUESTIONS.md');
            if (!fs.existsSync(questionsPath)) this.skip();

            const questionsContent = fs.readFileSync(questionsPath, 'utf-8');
            const layer1Start = questionsContent.indexOf('## Layer 1');
            const layer2Start = questionsContent.indexOf('## Layer 2');
            const layer1 = questionsContent.substring(layer1Start, layer2Start);
            const l1RowCount = (layer1.match(/^\| Q-[GCE]\d+ \|/gm) || []).length;

            const baseL1Match = skillContent.match(/base_l1\s*=\s*(\d+)/);
            expect(baseL1Match, 'base_l1 not found in SKILL.md helper').to.not.be.null;
            expect(parseInt(baseL1Match[1], 10)).to.equal(l1RowCount);
        });
    });
});
