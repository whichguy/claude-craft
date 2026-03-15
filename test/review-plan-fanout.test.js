const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Review-Plan Task Fan-Out', function () {
    const skillPath = path.join(__dirname, '..', 'skills', 'review-plan', 'SKILL.md');
    const gasEvalPath = path.join(__dirname, '..', 'skills', 'gas-plan', 'EVALUATE.md');
    const nodeEvalPath = path.join(__dirname, '..', 'skills', 'node-plan', 'EVALUATE.md');

    let skillContent;
    let gasEvalContent;
    let nodeEvalContent;

    before(function () {
        skillContent = fs.readFileSync(skillPath, 'utf-8');
        gasEvalContent = fs.readFileSync(gasEvalPath, 'utf-8');
        nodeEvalContent = fs.readFileSync(nodeEvalPath, 'utf-8');
    });

    describe('JSON output schema', function () {
        const requiredFields = ['evaluator', 'pass', 'status', 'elapsed_s', 'findings', 'counts'];

        it('SKILL.md L1 evaluator prompt contains all required JSON schema fields', function () {
            for (const field of requiredFields) {
                expect(skillContent).to.include(`"${field}"`);
            }
        });

        it('SKILL.md cluster evaluator prompt contains all required JSON schema fields', function () {
            const clusterSection = skillContent.substring(
                skillContent.indexOf('--- Cluster Evaluator Config'),
                skillContent.indexOf('--- GAS Evaluator Config')
            );
            for (const field of requiredFields) {
                expect(clusterSection).to.include(`"${field}"`);
            }
        });

        it('SKILL.md UI evaluator prompt contains all required JSON schema fields', function () {
            const uiSection = skillContent.substring(
                skillContent.indexOf('--- UI Evaluator Config'),
                skillContent.indexOf('-- Fan-in:')
            );
            for (const field of requiredFields) {
                expect(uiSection).to.include(`"${field}"`);
            }
        });

        it('gas-plan EVALUATE.md Step 3 contains JSON schema fields', function () {
            for (const field of requiredFields) {
                expect(gasEvalContent).to.include(`"${field}"`);
            }
        });

        it('node-plan EVALUATE.md Step 3 contains JSON schema fields', function () {
            for (const field of requiredFields) {
                expect(nodeEvalContent).to.include(`"${field}"`);
            }
        });

        it('counts sub-object includes pass, needs_update, na', function () {
            expect(skillContent).to.include('"counts": {"pass": N, "needs_update": N, "na": N}');
        });

        it('error schema includes evaluator, status, error fields', function () {
            expect(skillContent).to.include('"status": "error"');
            expect(skillContent).to.include('"error": "<message>"');
        });
    });

    describe('poll_for_wave_results', function () {
        it('defines polling function with expected_names parameter', function () {
            expect(skillContent).to.include('FUNCTION poll_for_wave_results(expected_names)');
        });

        it('exits loop when all expected files are present (missing is empty → BREAK)', function () {
            expect(skillContent).to.include('IF missing is empty: BREAK');
        });

        it('uses 3-second poll interval', function () {
            expect(skillContent).to.include('Bash: sleep 3');
        });

        it('prints wave completion summary', function () {
            expect(skillContent).to.include('wave complete:');
        });
    });

    describe('timeout sentinel at 120s', function () {
        it('writes timeout sentinel JSON after 120s for missing evaluators', function () {
            expect(skillContent).to.include('IF elapsed_s >= 120');
            expect(skillContent).to.include('"status":"timeout"');
        });

        it('prints 90s warning before timeout', function () {
            expect(skillContent).to.include('IF elapsed_s >= 90');
            expect(skillContent).to.include('waiting:');
        });
    });

    describe('wave-based spawning with MAX_CONCURRENT', function () {
        it('defines MAX_CONCURRENT = 8', function () {
            expect(skillContent).to.include('MAX_CONCURRENT = 8');
        });

        it('chunks evaluators into waves by MAX_CONCURRENT', function () {
            expect(skillContent).to.include('waves = chunk(evaluators_to_spawn, MAX_CONCURRENT)');
        });

        it('spawns evaluators in priority order (L1 first, UI last)', function () {
            const buildSection = skillContent.substring(
                skillContent.indexOf('-- Build evaluator list'),
                skillContent.indexOf('-- Wave spawning --')
            );
            const p1 = buildSection.indexOf('Priority 1: L1');
            const p2 = buildSection.indexOf('Priority 2: Ecosystem');
            const p3 = buildSection.indexOf('Priority 3: Impact');
            const p4 = buildSection.indexOf('Priority 4: Git');
            const p5 = buildSection.indexOf('Priority 5: Remaining');
            const p6 = buildSection.indexOf('Priority 6: UI');

            expect(p1).to.be.greaterThan(-1);
            expect(p2).to.be.greaterThan(p1);
            expect(p3).to.be.greaterThan(p2);
            expect(p4).to.be.greaterThan(p3);
            expect(p5).to.be.greaterThan(p4);
            expect(p6).to.be.greaterThan(p5);
        });

        it('prints wave count and evaluator names per wave', function () {
            expect(skillContent).to.include('wave(s) (max [MAX_CONCURRENT] concurrent)');
            expect(skillContent).to.include('wave [wave_idx+1]/[len(waves)]');
        });

        it('polls for wave results after each wave spawn', function () {
            expect(skillContent).to.include('poll_for_wave_results(wave_names)');
        });
    });

    describe('per-pass cleanup', function () {
        it('removes prior-pass JSON files before next wave spawns', function () {
            expect(skillContent).to.include('IF pass_count > 1:');
            expect(skillContent).to.include('rm -f "$RESULTS_DIR"/*.json');
        });

        it('prints cleanup confirmation', function () {
            expect(skillContent).to.include('cleared pass [pass_count - 1] results');
        });
    });

    describe('team infrastructure removal', function () {
        it('SKILL.md does not reference TeamCreate', function () {
            expect(skillContent).to.not.include('TeamCreate');
        });

        it('SKILL.md does not reference TeamDelete', function () {
            expect(skillContent).to.not.include('TeamDelete');
        });

        it('SKILL.md does not reference SendMessage', function () {
            expect(skillContent).to.not.include('SendMessage');
        });

        it('SKILL.md does not reference spawned_evaluators', function () {
            expect(skillContent).to.not.include('spawned_evaluators');
        });

        it('SKILL.md does not include team_name in Task blocks', function () {
            // Check that no Task block contains team_name parameter
            const taskBlocks = skillContent.split('Task(');
            for (let i = 1; i < taskBlocks.length; i++) {
                const block = taskBlocks[i].substring(0, taskBlocks[i].indexOf(')'));
                expect(block).to.not.include('team_name =');
            }
        });

        it('gas-plan EVALUATE.md does not reference SendMessage in Step 3', function () {
            const step3 = gasEvalContent.substring(gasEvalContent.indexOf('## Step 3'));
            expect(step3).to.not.include('SendMessage');
        });

        it('node-plan EVALUATE.md does not reference SendMessage in Step 3', function () {
            const step3 = nodeEvalContent.substring(nodeEvalContent.indexOf('## Step 3'));
            expect(step3).to.not.include('SendMessage');
        });
    });

    describe('results directory lifecycle', function () {
        it('creates temp dir with mktemp', function () {
            expect(skillContent).to.include('mktemp -d /tmp/review-plan.XXXXXX');
        });

        it('stores results_dir (not team_name) in memo_file checkpoint', function () {
            expect(skillContent).to.include('results_dir: RESULTS_DIR');
            expect(skillContent).to.not.match(/Write memo_file.*team_name/);
        });

        it('cleans up results dir in teardown', function () {
            expect(skillContent).to.include('rm -rf "$RESULTS_DIR"');
        });

        it('cleans up orphaned temp dirs older than 60 minutes', function () {
            expect(skillContent).to.include("find /tmp -maxdepth 1 -name 'review-plan.*' -mmin +60");
        });

        it('error handler removes results dir', function () {
            const errorSection = skillContent.substring(
                skillContent.indexOf('**Error handling:**'),
                skillContent.indexOf('---', skillContent.indexOf('**Error handling:**'))
            );
            expect(errorSection).to.include('rm -rf "$RESULTS_DIR"');
        });
    });

    describe('context-compression recovery', function () {
        it('restores results_dir from memo_file on recovery', function () {
            expect(skillContent).to.include('results_dir = memo_data.results_dir');
        });

        it('handles old team-based memo format gracefully', function () {
            expect(skillContent).to.include('memo_data.team_name is present');
            expect(skillContent).to.include('Old memo format detected');
        });

        it('re-creates temp dir if macOS cleaned up /tmp', function () {
            expect(skillContent).to.include('Results dir gone');
            expect(skillContent).to.include('test -d "$results_dir"');
        });
    });

    describe('atomic JSON writes', function () {
        it('SKILL.md evaluators write .tmp then mv (atomic rename)', function () {
            expect(skillContent).to.include('.json.tmp');
            expect(skillContent).to.include("mv '");
        });

        it('gas-plan EVALUATE.md uses atomic write pattern', function () {
            expect(gasEvalContent).to.include('.json.tmp');
            expect(gasEvalContent).to.include('mv ');
        });

        it('node-plan EVALUATE.md uses atomic write pattern', function () {
            expect(nodeEvalContent).to.include('.json.tmp');
            expect(nodeEvalContent).to.include('mv ');
        });
    });

    describe('EVALUATE.md header updates', function () {
        it('gas-plan says "evaluator tasks" not "teams"', function () {
            expect(gasEvalContent).to.include('Used inside review-plan evaluator tasks');
            expect(gasEvalContent).to.not.include('Used inside review-plan teams');
        });

        it('node-plan says "evaluator tasks" not "teams"', function () {
            expect(nodeEvalContent).to.include('Used inside review-plan evaluator tasks');
            expect(nodeEvalContent).to.not.include('Used inside review-plan teams');
        });
    });

    describe('fan-in JSON reading', function () {
        it('routes l1-evaluator findings into l1_results', function () {
            expect(skillContent).to.include('evaluator_name == "l1-evaluator"');
        });

        it('routes cluster evaluator findings by name suffix', function () {
            expect(skillContent).to.include('evaluator_name matches "*-evaluator" (cluster)');
        });

        it('routes gas-evaluator findings into gas_results', function () {
            expect(skillContent).to.include('evaluator_name == "gas-evaluator"');
        });

        it('routes node-evaluator findings into node_results', function () {
            expect(skillContent).to.include('evaluator_name == "node-evaluator"');
        });

        it('routes ui-evaluator findings into ui_results', function () {
            expect(skillContent).to.include('evaluator_name == "ui-evaluator"');
        });

        it('handles malformed JSON gracefully', function () {
            expect(skillContent).to.include('CATCH JSON parse error');
        });
    });
});
