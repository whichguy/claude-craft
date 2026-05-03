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

        it('SKILL.md cluster evaluator prompt references EVALUATOR_OUTPUT_CONTRACT', function () {
            const clusterSection = skillContent.substring(
                skillContent.indexOf('--- Cluster Evaluator Config'),
                skillContent.indexOf('--- GAS Evaluator Config')
            );
            expect(clusterSection).to.include('EVALUATOR_OUTPUT_CONTRACT');
        });

        it('SKILL.md UI evaluator prompt references EVALUATOR_OUTPUT_CONTRACT', function () {
            const uiSection = skillContent.substring(
                skillContent.indexOf('--- UI Evaluator Config'),
                skillContent.indexOf('-- Pass-level summary')
            );
            expect(uiSection).to.include('EVALUATOR_OUTPUT_CONTRACT');
        });

        it('EVALUATOR_OUTPUT_CONTRACT section contains all required JSON schema fields', function () {
            const contractSection = skillContent.substring(
                skillContent.indexOf('--- EVALUATOR_OUTPUT_CONTRACT'),
                skillContent.indexOf('--- L1 Blocking Evaluator Config')
            );
            for (const field of requiredFields) {
                expect(contractSection).to.include(`"${field}"`);
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

    describe('single-read fan-in (no polling)', function () {
        it('does NOT define poll_for_wave_results function', function () {
            expect(skillContent).to.not.include('FUNCTION poll_for_wave_results');
        });

        it('does NOT use sleep-based polling', function () {
            expect(skillContent).to.not.include('Bash: sleep 3');
        });

        it('does NOT call poll_for_wave_results', function () {
            expect(skillContent).to.not.include('poll_for_wave_results(');
        });

        it('reads wave results immediately after Task status check', function () {
            const statusCheckIdx = skillContent.indexOf('Check Task return status');
            const readIdx = skillContent.indexOf('Read wave results and print progress');
            expect(statusCheckIdx).to.be.greaterThan(-1);
            expect(readIdx).to.be.greaterThan(statusCheckIdx);
        });

        it('accumulates wave results into all_results', function () {
            expect(skillContent).to.include('all_results[name] = data');
        });

        it('prints wave completion summary', function () {
            expect(skillContent).to.include('complete:');
        });

        it('routes findings from all_results without re-reading files', function () {
            expect(skillContent).to.include('Route findings from all_results');
            expect(skillContent).to.include('already read during wave fan-in');
        });

        it('status grid reads from all_results dict, not RESULTS_DIR files', function () {
            const gridSection = skillContent.substring(
                skillContent.indexOf('Print evaluator status grid'),
                skillContent.indexOf('-- Route findings')
            );
            expect(gridSection).to.include('all_results');
            expect(gridSection).to.not.include('result file read from RESULTS_DIR');
        });
    });

    describe('routing order (specific before wildcard)', function () {
        // GAS/Node L3 evaluators removed via L3-ablation in SKILL.md — tests commented out
        /*
        it('checks gas-evaluator BEFORE wildcard *-evaluator', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const gasIdx = routeSection.indexOf('evaluator_name == "gas-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(gasIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(gasIdx);
        });

        it.skip('checks node-evaluator BEFORE wildcard *-evaluator (L3 ablated)', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const nodeIdx = routeSection.indexOf('evaluator_name == "node-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(nodeIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(nodeIdx);
        });
        */

        it('checks ui-evaluator BEFORE wildcard *-evaluator', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const uiIdx = routeSection.indexOf('evaluator_name == "ui-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(uiIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(uiIdx);
        });

        // References gas-evaluator (removed via L3-ablation) — commented out
        /*
        it('checks l1-blocking BEFORE all others in routing (not fail-closed guards)', function () {
            // Use the "Route findings — specific evaluators" comment to skip fail-closed guards
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings — specific evaluators')
            );
            const l1BlockingIdx = routeSection.indexOf('evaluator_name == "l1-blocking"');
            const l1AdvisoryIdx = routeSection.indexOf('evaluator_name == "l1-advisory-structural"');
            const gasIdx = routeSection.indexOf('evaluator_name == "gas-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(l1BlockingIdx).to.be.greaterThan(-1);
            expect(l1AdvisoryIdx).to.be.greaterThan(l1BlockingIdx);
            expect(gasIdx).to.be.greaterThan(l1AdvisoryIdx);
            expect(l1BlockingIdx).to.be.lessThan(wildcardIdx);
        });
        */
    });

    describe('per-pass variable initialization', function () {
        it('initializes l1_results in per-pass reset block', function () {
            const passInit = skillContent.substring(
                skillContent.indexOf('pass_count += 1'),
                skillContent.indexOf('Pass [pass_count]/5')
            );
            expect(passInit).to.include('l1_results = {}');
        });

        it('initializes l1_edits in per-pass reset block', function () {
            const passInit = skillContent.substring(
                skillContent.indexOf('pass_count += 1'),
                skillContent.indexOf('Pass [pass_count]/5')
            );
            expect(passInit).to.include('l1_edits = {}');
        });

        it('initializes cluster_results in per-pass reset block', function () {
            const passInit = skillContent.substring(
                skillContent.indexOf('pass_count += 1'),
                skillContent.indexOf('Pass [pass_count]/5')
            );
            expect(passInit).to.include('cluster_results = {}');
        });

        it('initializes ui_results in per-pass reset block', function () {
            const passInit = skillContent.substring(
                skillContent.indexOf('pass_count += 1'),
                skillContent.indexOf('Pass [pass_count]/5')
            );
            expect(passInit).to.include('ui_results = {}');
        });

        it('initializes all_results in per-pass reset block', function () {
            const passInit = skillContent.substring(
                skillContent.indexOf('pass_count += 1'),
                skillContent.indexOf('Pass [pass_count]/5')
            );
            expect(passInit).to.include('all_results = {}');
        });
    });

    describe('wave-based spawning with MAX_CONCURRENT', function () {
        it('defines MAX_CONCURRENT = 10', function () {
            expect(skillContent).to.include('MAX_CONCURRENT = 10');
        });

        it('chunks evaluators into waves by MAX_CONCURRENT', function () {
            expect(skillContent).to.include('waves = chunk(evaluators_to_spawn, MAX_CONCURRENT)');
        });

        // Priority 2 (Ecosystem = GAS/Node) removed via L3-ablation — commented out
        /*
        it('spawns evaluators in priority order (L1 blocking/advisory first, UI last)', function () {
            const buildSection = skillContent.substring(
                skillContent.indexOf('-- Build evaluator list'),
                skillContent.indexOf('-- Wave spawning --')
            );
            const p1a = buildSection.indexOf('Priority 1a: L1 blocking');
            const p1b = buildSection.indexOf('Priority 1b: L1 advisory');
            const p2 = buildSection.indexOf('Priority 2: Ecosystem');
            const p3 = buildSection.indexOf('Priority 3: Impact');
            const p4 = buildSection.indexOf('Priority 4: Remaining');
            const p5 = buildSection.indexOf('Priority 5: UI');

            expect(p1a).to.be.greaterThan(-1);
            expect(p1b).to.be.greaterThan(p1a);
            expect(p2).to.be.greaterThan(p1b);
            expect(p3).to.be.greaterThan(p2);
            expect(p4).to.be.greaterThan(p3);
            expect(p5).to.be.greaterThan(p4);
        });
        */

        it('prints wave count and evaluator names per wave', function () {
            expect(skillContent).to.include('wave(s) (max [MAX_CONCURRENT] concurrent)');
            expect(skillContent).to.include('Wave [wave_idx+1]/[len(waves)]');
        });
    });

    describe('Task return status checking', function () {
        it('checks Task tool results before reading results', function () {
            expect(skillContent).to.include('Check Task return status');
        });

        it('writes error sentinel for tool-level Task failures', function () {
            expect(skillContent).to.include('task_result indicates tool-level failure');
            expect(skillContent).to.include('"status":"error","error":"Task failed:');
        });

        it('detects Tasks that returned success but wrote no file', function () {
            expect(skillContent).to.include('Task completed but no JSON file written');
            expect(skillContent).to.include('test -f');
        });

        it('checks status before reading results, not after', function () {
            const checkIdx = skillContent.indexOf('Check Task return status');
            const readIdx = skillContent.indexOf('Read wave results and print progress');
            expect(checkIdx).to.be.greaterThan(-1);
            expect(readIdx).to.be.greaterThan(checkIdx);
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
        it('routes l1-blocking findings into l1_results', function () {
            expect(skillContent).to.include('evaluator_name == "l1-blocking"');
        });

        it('routes l1-advisory findings into l1_results', function () {
            // l1-advisory is now split into structural (Q-G20–Q-G25) + process (Q-G4–Q-G7, Q-G10–Q-G19, Q-G26–Q-G31)
            expect(skillContent).to.include('evaluator_name == "l1-advisory-structural"');
            expect(skillContent).to.include('evaluator_name == "l1-advisory-process"');
        });

        it('routes cluster evaluator findings by name suffix', function () {
            expect(skillContent).to.include('evaluator_name matches "*-evaluator" (cluster)');
        });

        // GAS/Node L3 evaluators removed via L3-ablation — commented out
        /*
        it('routes gas-evaluator findings into gas_results', function () {
            expect(skillContent).to.include('evaluator_name == "gas-evaluator"');
        });

        it.skip('routes node-evaluator findings into node_results (L3 ablated)', function () {
            expect(skillContent).to.include('evaluator_name == "node-evaluator"');
        });
        */

        it('routes ui-evaluator findings into ui_results', function () {
            expect(skillContent).to.include('evaluator_name == "ui-evaluator"');
        });

        it('handles malformed JSON gracefully', function () {
            expect(skillContent).to.include('error: "malformed JSON"');
        });
    });

    describe('dead timeout code removal', function () {
        it('does NOT reference timeout in progress printing', function () {
            // Fan-in progress section should not have timeout-specific branches
            const fanInSection = skillContent.substring(
                skillContent.indexOf('Read wave results and print progress'),
                skillContent.indexOf('Accumulate into pass-level collection')
            );
            expect(fanInSection).to.not.include('"timeout"');
        });

        it('does NOT reference timeout in status grid', function () {
            const gridSection = skillContent.substring(
                skillContent.indexOf('Print evaluator status grid'),
                skillContent.indexOf('Route findings from all_results')
            );
            expect(gridSection).to.not.include('◌ timeout');
        });
    });

    describe('L1 blocking/advisory split', function () {
        it('defines l1-blocking evaluator config for Gate 1 (2 questions)', function () {
            expect(skillContent).to.include('L1 Blocking Evaluator Config (Gate 1: 2 questions');
            expect(skillContent).to.include('Evaluate ONLY these 2 questions: Q-G1, Q-G11');
        });

        it('defines l1-advisory evaluator config for Gate 2/3 (24 questions)', function () {
            // l1-advisory is now split: structural (6 questions) + process (19 questions) = 25 total
            // (Q-G2 dropped from blocking, Q-G8 dropped from process per effectiveness report 2026-04-10; Q-G32 added 2026-04-15)
            expect(skillContent).to.include('L1 Advisory Structural Evaluator Config (Gate 2/3: 6 abstract/structural questions');
            expect(skillContent).to.include('L1 Advisory Process Evaluator Config (Gate 2/3: 19 standards/process questions');
            expect(skillContent).to.include('Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25');
        });

        it('l1-advisory group memoization logic exists (split structural/process)', function () {
            expect(skillContent).to.include('l1_structural_memoized');
            expect(skillContent).to.include('l1_process_memoized');
            expect(skillContent).to.include('Group memoization for l1-advisory-structural');
            expect(skillContent).to.include('Group memoization for l1-advisory-process');
        });

        it('l1-advisory memoization invalidates on edits', function () {
            expect(skillContent).to.include('l1-advisory-structural invalidated (edits applied)');
            expect(skillContent).to.include('l1-advisory-process invalidated (edits applied)');
        });

        it('injects synthetic PASS results when l1-advisory is memoized', function () {
            expect(skillContent).to.include('group-memoized — all were PASS/N/A');
        });

        it('l1-advisory-process evaluator prompt includes Q-G26 and Q-G27', function () {
            const processStart = skillContent.indexOf('L1 Advisory Process Evaluator Config');
            const processSection = skillContent.substring(processStart, processStart + 2000);
            expect(processSection).to.include('Q-G26');
            expect(processSection).to.include('Q-G27');
        });

        it('l1-advisory-process evaluator prompt includes Q-G30 and Q-G31', function () {
            const processStart = skillContent.indexOf('L1 Advisory Process Evaluator Config');
            const processSection = skillContent.substring(processStart, processStart + 2000);
            expect(processSection).to.include('Q-G30');
            expect(processSection).to.include('Q-G31');
        });

        it('process_questions memoization set includes Q-G26 and Q-G27', function () {
            // Both process_questions set definitions (in-loop and memoization block) must contain Q-G26 and Q-G27
            expect(skillContent).to.include('"Q-G26", "Q-G27"');
        });

        it('process_questions memoization set includes Q-G30 and Q-G31', function () {
            // Both process_questions set definitions (in-loop and memoization block) must contain Q-G30 and Q-G31
            expect(skillContent).to.include('"Q-G30", "Q-G31"');
        });
    });

    describe('cross-file question count invariants', function () {
        const questionsPath = path.join(__dirname, '..', 'skills', 'review-plan', 'QUESTIONS.md');
        let questionsContent;
        let l1RowCount;

        before(function () {
            questionsContent = fs.readFileSync(questionsPath, 'utf-8');
            const layer1Start = questionsContent.indexOf('## Layer 1');
            const layer2Start = questionsContent.indexOf('## Layer 2');
            const layer1 = questionsContent.substring(layer1Start, layer2Start);
            l1RowCount = (layer1.match(/^\| Q-[GCE]\d+ \|/gm) || []).length;
        });

        function extractProcessQuestionsSet(content) {
            const match = content.match(
                /Evaluate ONLY these \d+ standards\/process questions: ([^\n]+)/
            );
            return match ? match[1].split(',').map(s => s.trim()) : [];
        }

        it('SKILL.md L1 total matches QUESTIONS.md row count', function () {
            // Guards against L1 row additions in QUESTIONS.md that aren't reflected in SKILL.md counts
            expect(skillContent).to.include(`L1 = ${l1RowCount}`);
        });

        it('SKILL.md per-pass sum matches QUESTIONS.md row count', function () {
            // "2 + 6 + 18 = 26" shape — guard against partial sum drift
            const sumMatch = skillContent.match(/(\d+) \+ (\d+) \+ (\d+) = (\d+)/);
            expect(sumMatch, 'per-pass sum shape not found in SKILL.md').to.not.be.null;
            const [, g1, struct, proc, total] = sumMatch;
            expect(parseInt(g1, 10) + parseInt(struct, 10) + parseInt(proc, 10))
                .to.equal(parseInt(total, 10), 'per-pass components must sum to total');
            expect(parseInt(total, 10)).to.equal(l1RowCount,
                `SKILL.md per-pass sum (${total}) must equal QUESTIONS.md L1 row count (${l1RowCount})`);
        });

        it('Priority 1c comment count matches process_questions set length', function () {
            // L744-style drift catcher: comment literal must match live set cardinality
            const processQuestions = extractProcessQuestionsSet(skillContent);
            const commentMatch = skillContent.match(
                /L1 advisory process \(Gate 2\/3, (\d+) questions/
            );
            expect(commentMatch, 'Priority 1c comment not found in SKILL.md').to.not.be.null;
            expect(parseInt(commentMatch[1], 10)).to.equal(processQuestions.length,
                `Priority 1c comment says ${commentMatch[1]} questions but process_questions set has ${processQuestions.length}`);
        });

        it('L1 Advisory Process Evaluator Config comment matches set length', function () {
            // Guards the evaluator config header at L1038
            const processQuestions = extractProcessQuestionsSet(skillContent);
            const configMatch = skillContent.match(
                /L1 Advisory Process Evaluator Config.*?(\d+) standards\/process questions/
            );
            expect(configMatch, 'L1 Advisory Process Evaluator Config header not found').to.not.be.null;
            expect(parseInt(configMatch[1], 10)).to.equal(processQuestions.length,
                `Evaluator config says ${configMatch[1]} questions but process_questions set has ${processQuestions.length}`);
        });

        it('flag_question_decrements helper defines base_l1 matching QUESTIONS.md L1 row count', function () {
            const helperIdx = skillContent.indexOf('helper: flag_question_decrements(');
            expect(helperIdx, 'flag_question_decrements helper not found in SKILL.md').to.be.greaterThan(0);
            const helperBlock = skillContent.substring(helperIdx, helperIdx + 1500);
            const baseMatch = helperBlock.match(/base_l1 = (\d+)/);
            expect(baseMatch, 'base_l1 literal not found in flag_question_decrements block').to.not.be.null;
            expect(parseInt(baseMatch[1], 10)).to.equal(l1RowCount,
                `base_l1 = ${baseMatch[1]} in SKILL.md but QUESTIONS.md Layer 1 has ${l1RowCount} rows — update base_l1`);
        });

        // IS_GAS axis removed from helper via L3-ablation — commented out
        /*
        it('flag_question_decrements truth table covers all 16 (IS_GAS × HAS_UI × HAS_EXISTING_INFRA × HAS_UNBOUNDED_DATA) combinations', function () {
            const helperIdx = skillContent.indexOf('helper: flag_question_decrements(');
            expect(helperIdx, 'flag_question_decrements helper not found').to.be.greaterThan(0);
            const helperBlock = skillContent.substring(helperIdx, helperIdx + 1500);
            expect(helperBlock).to.include('Truth table');
            // IS_NODE held fixed (cosmetic limitation); 4 binary flags × 2^4 = 16 combinations
            const comboMatches = helperBlock.match(/\([TF],[TF],[TF],[TF]\)→\d/g) || [];
            expect(comboMatches.length, 'Expected 16 flag combinations in truth table').to.equal(16);
        });

        it.skip('flag_question_decrements helper has all 3 adjustment branches (L3 ablated — IS_GAS dropped)', function () {
            const helperIdx = skillContent.indexOf('helper: flag_question_decrements(');
            expect(helperIdx, 'flag_question_decrements helper not found').to.be.greaterThan(0);
            const helperBlock = skillContent.substring(helperIdx, helperIdx + 1500);
            // Branch 1: IS_GAS + HAS_UI → -2 (Q-C17/Q-C25)
            expect(helperBlock).to.match(/is_gas.*has_ui.*adj.*\+= 2/);
            // Branch 2: NOT is_gas + NOT has_existing_infra → -1 (Q-C14)
            expect(helperBlock).to.match(/NOT.*is_gas.*NOT.*has_existing_infra.*adj.*\+= 1/);
            // Branch 3: NOT is_gas + NOT has_unbounded_data → -1 (Q-C32)
            expect(helperBlock).to.match(/NOT.*is_gas.*NOT.*has_unbounded_data.*adj.*\+= 1/);
        });
        */
    });

    describe('Phase 5c.5 Implementation Intent Questions', function () {
        it('SKILL.md defines Phase 5c.5 intent-questions extraction', function () {
            expect(skillContent).to.include('Phase 5c.5');
            expect(skillContent).to.include('Implementation Intent Questions');
            expect(skillContent).to.include('NO_INTENT_QUESTIONS');
        });

        it('intent-questions guards match teaching-notes guards (tier/VCS/fixture/opt-out)', function () {
            // Use the section heading "5c.5." to find the implementation block, not the R&A mention
            const idx = skillContent.indexOf('5c.5. **Implementation Intent Questions**');
            expect(idx, '5c.5 section heading not found').to.be.greaterThan(0);
            const section = skillContent.substring(idx, idx + 4000);
            // Tier guard: FULL only
            expect(section).to.match(/REVIEW_TIER.*FULL/);
            // Opt-out frontmatter guard must be in pseudocode, not just prose
            expect(section).to.match(/frontmatter.*intent_questions.*false.*SKIP|frontmatter\.get.*intent_questions.*==.*false/i);
            // VCS guard: untracked check
            expect(section).to.match(/ls-files --error-unmatch|VCS guard|render_to_terminal_5th_panel/);
        });

        it('Phase 5c.5 does not append to plan when intent_questions is empty', function () {
            const idx = skillContent.indexOf('5c.5. **Implementation Intent Questions**');
            expect(idx, '5c.5 section heading not found').to.be.greaterThan(0);
            const section = skillContent.substring(idx, idx + 5000);
            // Must guard the append branch against empty list (NO_INTENT_QUESTIONS path).
            // Guard may be multi-line ("IF intent_questions == []\n    SKIP"), so check components.
            expect(section).to.include('intent_questions == []');
            expect(section).to.match(/intent_questions == \[\][\s\S]{0,200}SKIP/);
        });

        it('Phase 5c.5 ELSE branch resolves insertion_point concretely (no angle-bracket placeholder in Edit call)', function () {
            const idx = skillContent.indexOf('5c.5. **Implementation Intent Questions**');
            expect(idx, '5c.5 section heading not found').to.be.greaterThan(0);
            const section = skillContent.substring(idx, idx + 5000);
            const elseIdx = section.lastIndexOf('ELSE:');
            expect(elseIdx, 'ELSE branch not found in 5c.5 section').to.be.greaterThan(0);
            const elseBranch = section.substring(elseIdx, elseIdx + 600);
            // Must NOT contain the unresolved token <insertion_point> inside an Edit call
            expect(elseBranch).to.not.match(/Edit\s*\([^)]*<insertion_point>/);
        });
    });

    describe('Phase 6b Teaching Summary', function () {
        it('SKILL.md defines Phase 6b teaching summary panel', function () {
            expect(skillContent).to.include('Phase 6b');
            expect(skillContent).to.include('TEACHING SUMMARY');
        });

        it('Phase 6b fires on all tiers (not FULL only)', function () {
            const phase6b = skillContent.indexOf('5f. **Phase 6b: Teaching Summary**');
            expect(phase6b).to.be.greaterThan(0);
            const phase6bBlock = skillContent.substring(phase6b, phase6b + 2000);
            // Must NOT have a FULL-only guard
            expect(phase6bBlock).to.not.match(/IF REVIEW_TIER.*!=.*FULL.*\n.*SKIP/);
            // Must reference all-tiers intent
            expect(phase6bBlock).to.match(/all tiers|ALL tiers/i);
        });

        it('Phase 6b uses shared resolve_citation helper', function () {
            expect(skillContent).to.match(/helper: resolve_citation/);
            const phase6b = skillContent.indexOf('5f. **Phase 6b: Teaching Summary**');
            const phase6bBlock = skillContent.substring(phase6b, phase6b + 2500);
            expect(phase6bBlock).to.include('resolve_citation');
        });

        it('Phase 5e Teaching Notes still references shared resolve_citation helper', function () {
            // Regression guard: Phase 6b extraction must not orphan the Teaching-Notes citation path
            const phase5e = skillContent.indexOf('5e. **Teaching Notes');
            expect(phase5e, '5e Teaching Notes section not found').to.be.greaterThan(0);
            const phase5eBlock = skillContent.substring(phase5e, phase5e + 2500);
            expect(phase5eBlock).to.include('resolve_citation');
        });
    });

    describe('Phase 7.5 Full Plan Re-display', function () {
        it('SKILL.md defines Phase 7.5 re-display before interactive exit', function () {
            expect(skillContent).to.include('Phase 7.5');
            expect(skillContent).to.include('FINAL PLAN — FULL TEXT AFTER CONVERGENCE');
            // Phase 7.5 must come before AskUserQuestion (step 8)
            const phase7_5_idx = skillContent.indexOf('Phase 7.5');
            const askUserIdx = skillContent.lastIndexOf('AskUserQuestion');
            expect(phase7_5_idx).to.be.greaterThan(0);
            expect(phase7_5_idx).to.be.lessThan(askUserIdx);
        });

        it('Phase 7.5 fires on all tiers (not FULL only)', function () {
            const idx = skillContent.indexOf('Phase 7.5');
            const section = skillContent.substring(idx, idx + 2000);
            // Must NOT have a FULL-only guard that skips fast path
            expect(section).to.not.match(/IF REVIEW_TIER.*TRIVIAL|IF REVIEW_TIER.*SMALL.*SKIP/);
            // Must reference all-tiers intent
            expect(section).to.match(/all tiers|ALL tiers|always runs/i);
        });

        it('Phase 7.5 re-reads plan from disk (not memoized)', function () {
            const idx = skillContent.indexOf('Phase 7.5');
            const section = skillContent.substring(idx, idx + 2000);
            // Must use Read tool on plan_path
            expect(section).to.match(/Read\s*\(\s*plan_path\s*\)/);
        });

        it('Phase 7.5 uses macOS-compatible shasum -a 256 (not Linux-only sha256sum)', function () {
            const idx = skillContent.indexOf('Phase 7.5');
            const section = skillContent.substring(idx, idx + 2000);
            // sha256sum does not exist on macOS (platform: darwin) — must use shasum -a 256
            expect(section).to.not.include('sha256sum');
            expect(section).to.include('shasum -a 256');
        });
    });

    describe('Phase 5g Skill-Learnings Review', function () {
        it('SKILL.md defines Phase 5g skill-learnings review', function () {
            expect(skillContent).to.include('5g. **Skill-Learnings Review**');
            expect(skillContent).to.include('SKILL LEARNINGS');
            expect(skillContent).to.include('NO_SKILL_LEARNINGS');
        });

        it('Phase 5g comes after Phase 5f and before Step 6 cleanup', function () {
            const phase5g = skillContent.indexOf('5g. **Skill-Learnings Review**');
            const phase5f = skillContent.indexOf('5f. **Phase 6b: Teaching Summary**');
            const step6   = skillContent.indexOf('6. **Cleanup and teardown**');
            expect(phase5g, 'Phase 5g not found').to.be.greaterThan(0);
            expect(phase5g).to.be.greaterThan(phase5f);
            expect(phase5g).to.be.lessThan(step6);
        });

        it('Phase 5g is FULL-tier only (not all tiers)', function () {
            const idx = skillContent.indexOf('5g. **Skill-Learnings Review**');
            const section = skillContent.substring(idx, idx + 3000);
            expect(section).to.match(/IF REVIEW_TIER.*!=.*["\']FULL["\'].*\n\s*SKIP/);
        });

        it('Phase 5g has skill_audit opt-out guard', function () {
            const idx = skillContent.indexOf('5g. **Skill-Learnings Review**');
            const section = skillContent.substring(idx, idx + 3000);
            expect(section).to.include('skill_audit');
        });

        it('Phase 5g spawns a Task() agent with questions_path and findings_summary', function () {
            const idx = skillContent.indexOf('5g. **Skill-Learnings Review**');
            const section = skillContent.substring(idx, idx + 3000);
            expect(section).to.include('Task(');
            expect(section).to.include('questions_path');
            expect(section).to.include('findings_summary');
            expect(section).to.include('sr_applied_edits');
        });

        it('Phase 5g directive listed in Role & Authority', function () {
            const roleStart = skillContent.indexOf('## Role & Authority');
            const roleEnd   = skillContent.indexOf('\n---\n', roleStart);
            const roleSection = skillContent.substring(roleStart, roleEnd);
            expect(roleSection).to.include('Phase 5g');
            expect(roleSection).to.include('SKILL LEARNINGS');
        });
    });

    describe('delta-aware evaluator prompts', function () {
        it('defines prev_pass_applied_edits variable', function () {
            expect(skillContent).to.include('prev_pass_applied_edits = []');
        });

        it('builds current_pass_applied_edits after applying edits', function () {
            expect(skillContent).to.include('current_pass_applied_edits = []');
            expect(skillContent).to.include('Build delta summary for next pass');
        });

        it('appends delta context to evaluator prompts on pass 2+', function () {
            expect(skillContent).to.include('Focus verification on plan sections touched by these edits');
            expect(skillContent).to.include('Previous pass applied 0 edits');
        });

        it('carries prev_pass_applied_edits to next pass', function () {
            expect(skillContent).to.include('prev_pass_applied_edits = current_pass_applied_edits');
        });

        it('memo_file checkpoint includes prev_pass_applied_edits', function () {
            const checkpointSection = skillContent.substring(
                skillContent.indexOf('Checkpoint: persist memoized state'),
                skillContent.indexOf('Build breakdown suffix')
            );
            expect(checkpointSection).to.include('prev_pass_applied_edits');
        });
    });

    describe('smart Haiku classification', function () {
        it('Haiku classifies ACTIVE_RISKS domains', function () {
            expect(skillContent).to.include('ACTIVE_RISKS=comma,separated,list');
        });

        it('Haiku classifies risk domains: security, testing, state, operations, external_calls', function () {
            expect(skillContent).to.include('security');
            expect(skillContent).to.include('testing');
            expect(skillContent).to.include('state');
            expect(skillContent).to.include('operations');
            expect(skillContent).to.include('external_calls');
        });

        it('testing cluster activation is conditional on ACTIVE_RISKS', function () {
            expect(skillContent).to.include('if "testing" in ACTIVE_RISKS:        active_clusters.append("testing")');
        });

        it('security cluster activation is conditional on security or external_calls risk', function () {
            expect(skillContent).to.include('if "security" in ACTIVE_RISKS or "external_calls" in ACTIVE_RISKS:');
        });

        it('Haiku fallback defaults ACTIVE_RISKS conservatively', function () {
            expect(skillContent).to.include('ACTIVE_RISKS={"testing", "security", "external_calls"}');
        });
    });

    // ── U1-U7: Async Research Lane (Phase 3c.5 dispatch + Phase 5b.5 join) ──
    describe('async research lane', function () {
        // U1: dispatch uses run_in_background=true
        it('U1: Phase 3c.5 dispatch block contains run_in_background = true', function () {
            const idx = skillContent.indexOf('Phase 3c.5');
            expect(idx, 'Phase 3c.5 not found').to.be.greaterThan(0);
            const phase3c5Block = skillContent.substring(idx, idx + 10000);
            expect(phase3c5Block).to.include('run_in_background = true');
        });

        // U2: heuristic risk gate (ACTIVE_RISKS + grep markers)
        it('U2: Phase 3c.5 contains heuristic risk gate with ACTIVE_RISKS and grep markers', function () {
            const idx = skillContent.indexOf('Phase 3c.5');
            expect(idx, 'Phase 3c.5 not found').to.be.greaterThan(0);
            const phase3c5Block = skillContent.substring(idx, idx + 10000);
            expect(phase3c5Block).to.include('ACTIVE_RISKS');
            expect(phase3c5Block).to.include('spike|proof.of.concept|unproven|benchmark|unknown|assume|tbd');
        });

        // U3: TRIVIAL/SMALL tier early exit
        it('U3: Phase 3c.5 contains REVIEW_TIER != "FULL" early exit', function () {
            const idx = skillContent.indexOf('Phase 3c.5');
            expect(idx, 'Phase 3c.5 not found').to.be.greaterThan(0);
            const phase3c5Block = skillContent.substring(idx, idx + 10000);
            expect(phase3c5Block).to.match(/REVIEW_TIER\s*!=\s*["']FULL["']/);
        });

        // U4: injection-hardening imperative filter list (pinned to prevent drift)
        it('U4: Phase 3c.5 imperative filter pins the full list to prevent drift', function () {
            const idx = skillContent.indexOf('Phase 3c.5');
            expect(idx, 'Phase 3c.5 not found').to.be.greaterThan(0);
            const phase3c5Block = skillContent.substring(idx, idx + 10000);
            // Each imperative must appear in the filter list
            expect(phase3c5Block).to.include('"ignore"');
            expect(phase3c5Block).to.include('"disregard"');
            expect(phase3c5Block).to.include('"system:"');
            expect(phase3c5Block).to.include('"assistant:"');
            expect(phase3c5Block).to.include('"you must"');
            expect(phase3c5Block).to.include('"new instructions"');
        });

        // U5: join phase has GRACE_SECONDS, date +%s, and degraded path print
        it('U5: Phase 5b.5 section contains GRACE_SECONDS, date +%s, and degraded path print', function () {
            // Use the section heading to find the right block (not the early prose mention)
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            expect(phase5b5Block).to.include('GRACE_SECONDS');
            expect(phase5b5Block).to.include('date +%s');
            expect(phase5b5Block).to.include('Degraded');
        });

        // U6: degraded path sets research_findings_block to empty string
        it('U6: Phase 5b.5 degraded path results in empty research_findings_block', function () {
            // Use the section heading to find the right block (not the early prose mention)
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            // Both the empty-research-done branch and the early-skip path must set the block to ""
            const emptyStringMatches = (phase5b5Block.match(/research_findings_block\s*=\s*""/g) || []).length;
            expect(emptyStringMatches, 'research_findings_block must be set to "" in at least 2 code paths').to.be.greaterThanOrEqual(2);
        });

        // U7: memo writer in Phase 4 checkpoint preserves research_pending/done/missing
        it('U7: Phase 4 memo checkpoint preserves research_pending, research_done, research_missing', function () {
            const checkpointIdx = skillContent.indexOf('-- Checkpoint: persist memoized state');
            expect(checkpointIdx, 'Checkpoint section not found').to.be.greaterThan(0);
            const checkpointBlock = skillContent.substring(checkpointIdx, checkpointIdx + 2000);
            expect(checkpointBlock).to.include('research_pending');
            expect(checkpointBlock).to.include('research_done');
            expect(checkpointBlock).to.include('research_missing');
        });

        // U8: dependency-graph comment block at Phase 3c.5 header
        it('U8: Phase 3c.5 dependency-graph comment block present with all required sections and variables', function () {
            const idx = skillContent.indexOf('PHASE 3c.5 / 5b.5 — ASYNC RESEARCH LANE DEPENDENCY CONTRACT');
            expect(idx, 'Dependency-graph comment block not found at Phase 3c.5 header').to.be.greaterThan(0);
            const block = skillContent.substring(idx, idx + 2000);
            // All 6 section labels
            expect(block).to.include('DISPATCH READS');
            expect(block).to.include('DISPATCH WRITES');
            expect(block).to.include('BLIND ZONE');
            expect(block).to.include('JOIN READS');
            expect(block).to.include('JOIN WRITES');
            expect(block).to.include('SOLE CONSUMER');
            // BLIND ZONE must name all three Edit sites by phase
            expect(block).to.include('Phase 4');
            expect(block).to.include('Q-G9');
            expect(block).to.include('Q-E1');
            // All 7 key variables must appear in the contract
            expect(block).to.include('dispatch_epoch');
            expect(block).to.include('plan_sha_at_dispatch');
            expect(block).to.include('research_pending');
            expect(block).to.include('research_done');
            expect(block).to.include('research_missing');
            expect(block).to.include('research_findings_block');
            expect(block).to.include('research_findings_block_header');
        });

        // U9: Phase 5b.5 adaptive grace formula
        it('U9: Phase 5b.5 adaptive grace formula has TARGET_TOTAL_SECONDS=90, MIN_GRACE_SECONDS=30, remaining_budget formula', function () {
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            expect(phase5b5Block).to.include('TARGET_TOTAL_SECONDS = 90');
            expect(phase5b5Block).to.include('MIN_GRACE_SECONDS    = 30');
            expect(phase5b5Block).to.include('remaining_budget       = max(0,');
        });

        // U10: plan_sha_at_dispatch round-trip: Phase 3c.5 writes it, Phase 5b.5 reads it,
        //      annotated header emitted when hashes differ, shasum -a 256 used (not sha256sum)
        it('U10: plan_sha_at_dispatch written in Phase 3c.5 and read in Phase 5b.5 with shasum -a 256', function () {
            // Phase 3c.5 producer: dispatch block writes plan_sha_at_dispatch alongside research_pending
            const dispatch3c5Idx = skillContent.indexOf('Phase 3c.5');
            expect(dispatch3c5Idx, 'Phase 3c.5 section not found').to.be.greaterThan(0);
            const phase3c5Block = skillContent.substring(dispatch3c5Idx, dispatch3c5Idx + 10000);
            expect(phase3c5Block).to.include('plan_sha_at_dispatch');
            expect(phase3c5Block).to.include('shasum -a 256');
            // Phase 5b.5 consumer: reads plan_sha_at_dispatch from _lane_memo (safe-read fallback) and emits annotated header
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            expect(phase5b5Block).to.include('_lane_memo.get("plan_sha_at_dispatch")');
            expect(phase5b5Block).to.include('citations may reference superseded text');
            // Must NOT use Linux-only sha256sum
            expect(phase5b5Block).to.not.include('sha256sum');
        });

        // U11: Sub-case B rehydration (ELIF memo.get("research_done"):) in Phase 5b.5
        it('U11: Phase 5b.5 contains Sub-case B rehydration branch (ELIF memo.get("research_done"):)', function () {
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            expect(phase5b5Block).to.include('ELIF memo.get("research_done"):');
        });

        // U12: _phase_5b5_skip guards both the no-op gate and the poll block gate
        it('U12: Phase 5b.5 has _phase_5b5_skip initialization, no-op gate, and poll-block gate', function () {
            const idx = skillContent.indexOf('5b.5. **Research Lane Join**');
            expect(idx, '5b.5. **Research Lane Join** section heading not found').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(idx, idx + 10000);
            expect(phase5b5Block).to.include('_phase_5b5_skip = false');
            expect(phase5b5Block).to.include('AND NOT _phase_5b5_skip:');
            expect(phase5b5Block).to.include('ELIF NOT _phase_5b5_skip:');
        });

        // U13: Phase 4 memo writer preserves dispatch_epoch and plan_sha_at_dispatch
        it('U13: Phase 4 memo writer preserves dispatch_epoch and plan_sha_at_dispatch across convergence passes', function () {
            // Anchor on the unique comment that the implementer added specifically for this test
            const anchorIdx = skillContent.indexOf('Research lane fields — preserve unmodified each pass');
            expect(anchorIdx, 'Phase 4 memo writer anchor comment not found').to.be.greaterThan(0);
            const writerBlock = skillContent.substring(anchorIdx, anchorIdx + 500);
            expect(writerBlock).to.include('dispatch_epoch');
            expect(writerBlock).to.include('plan_sha_at_dispatch');
        });

        // U14: Phase 5b.5 poll block opens with _lane_memo safe-read and None-fallback guards
        it('U14: Phase 5b.5 poll block initialises _lane_memo and uses None-fallback guards for dispatch_epoch and plan_sha_at_dispatch', function () {
            // Anchor on the ELIF guard that opens the poll block
            const anchorIdx = skillContent.indexOf('ELIF NOT _phase_5b5_skip:');
            expect(anchorIdx, 'Phase 5b.5 ELIF NOT _phase_5b5_skip: not found').to.be.greaterThan(0);
            // Scan the first 2000 chars of the poll block for the _lane_memo initialisation
            // (the block starts with Print lines + multi-line grace comment before reaching _lane_memo)
            const pollBlock = skillContent.substring(anchorIdx, anchorIdx + 2000);
            expect(pollBlock).to.include('_lane_memo = {}');
            expect(pollBlock).to.include('IF dispatch_epoch is None:');
            expect(pollBlock).to.include('IF plan_sha_at_dispatch is None:');
        });

        // U15: Phase 5b.5 contains no bare memo.get() outside a TRY block
        it('U15: Phase 5b.5 contains no bare memo.get() references outside a TRY block', function () {
            // Find Phase 5b.5 section by its heading anchor
            const phase5b5Start = skillContent.indexOf('# ── Phase 5b.5: Research Lane Join ──');
            expect(phase5b5Start, 'Phase 5b.5 heading anchor not found').to.be.greaterThan(0);
            // Phase 5b.5 ends at the next top-level phase comment (Phase 5c)
            const phase5cStart = skillContent.indexOf('5c. **Senior-Engineer Critic Loop**', phase5b5Start);
            expect(phase5cStart, 'Phase 5c anchor not found after 5b.5').to.be.greaterThan(0);
            const phase5b5Block = skillContent.substring(phase5b5Start, phase5cStart);
            // Any bare `memo.get(` (not `_lane_memo.get(`) must be inside a TRY block.
            // Strategy: find all occurrences where `memo.get(` is NOT preceded by `_lane`
            // (i.e., the identifier starts with just `memo`, not `_lane_memo`).
            let searchFrom = 0;
            while (true) {
                const memoGetIdx = phase5b5Block.indexOf('memo.get(', searchFrom);
                if (memoGetIdx === -1) break;
                // Skip if this is `_lane_memo.get(` — walk back to see if `_lane` precedes it
                const prefix = phase5b5Block.substring(Math.max(0, memoGetIdx - 6), memoGetIdx);
                if (prefix.endsWith('_lane_')) {
                    searchFrom = memoGetIdx + 1;
                    continue;
                }
                // Bare memo.get() — must be inside a TRY block.
                // Look back up to 600 chars: the deepest call (memo.get("research_missing",...))
                // is inside Sub-case B which starts ~500 chars after TRY:.
                const lookback = phase5b5Block.substring(Math.max(0, memoGetIdx - 600), memoGetIdx);
                expect(lookback, `bare memo.get() found at offset ${memoGetIdx} in Phase 5b.5 without enclosing TRY:`).to.include('TRY:');
                searchFrom = memoGetIdx + 1;
            }
        });
    });

    describe('SMALL-tier REMOVAL intent questions (Phase 3b)', function () {
        const benchDir = path.join(__dirname, '..', 'skills', 'review-plan', 'inputs', 'bench');

        it('SKILL.md defines SMALL fast-path REMOVAL intent questions block with sonnet model', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            expect(idx, 'SMALL fast-path: REMOVAL intent questions block not found').to.be.greaterThan(0);
            const block = skillContent.substring(idx, idx + 3000);
            expect(block).to.match(/model.*=.*["']sonnet["']/);
        });

        it('SMALL REMOVAL Guard 2 uses list-anchored removal-detection grep (not naive full-file grep)', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            // Grep must scope to list-item lines (anchored to ^/whitespace + list marker)
            expect(block).to.include('delete|remove|replace');
            // Must anchor to line-start + list marker (prevents false positives from prose)
            expect(block).to.match(/\^.*\[-\*0-9\]|\^\[.*:space.*\].*\[-\*0-9\]/);
        });

        it('SMALL REMOVAL Guard 3 respects intent_questions: false opt-out', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            expect(block).to.match(/intent_questions.*false|false.*intent_questions/i);
        });

        it('SMALL REMOVAL Guard 4 skips bench/test/fixture paths', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            expect(block).to.include('fixtures/');
        });

        it('SMALL REMOVAL Guard 5 checks VCS tracking (ls-files --error-unmatch)', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            expect(block).to.include('ls-files --error-unmatch');
        });

        it('SMALL REMOVAL Guard 6 skips append when task returns NO_REMOVAL_QUESTIONS', function () {
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            expect(block).to.include('NO_REMOVAL_QUESTIONS');
        });

        it('SMALL REMOVAL block is NOT spawned for additive-only plans (no removal markers → skip)', function () {
            // The block must have a skip path when _removal_hit is empty and no frontmatter removals
            const idx = skillContent.indexOf('SMALL fast-path: REMOVAL intent questions');
            const block = skillContent.substring(idx, idx + 3000);
            // Skip path must exist before the Task spawn
            const taskIdx = block.indexOf('description = "SMALL removal intent questions"');
            const skipIdx = block.indexOf('additive-only plan');
            expect(skipIdx, 'additive-only skip comment not found').to.be.greaterThan(0);
            expect(skipIdx).to.be.lessThan(taskIdx);
        });

        it('bench-small-removal.md fixture exists and contains list-item removal step', function () {
            const fixturePath = path.join(benchDir, 'bench-small-removal.md');
            expect(fs.existsSync(fixturePath), 'bench-small-removal.md not found').to.be.true;
            const content = fs.readFileSync(fixturePath, 'utf-8');
            // Must contain a removal verb on a list-item line (Guard 2 target)
            expect(content).to.match(/^\s*\d+\.\s+.*\b(remove|delete)\b/im);
        });
    });

    describe('pass 2+ memoized-delta narrowing', function () {
        // D1: pass_delta dict declared and guarded by pass_count > 1
        it('D1: pass_delta dict is declared and its computation is guarded by pass_count > 1', function () {
            expect(skillContent).to.include('pass_delta = {}');
            expect(skillContent).to.include('IF pass_count > 1:');
        });

        // D2: prev_cluster_results and prev_ui_results declared in tracking vars
        it('D2: prev_cluster_results and prev_ui_results are declared in tracking vars', function () {
            expect(skillContent).to.include('prev_cluster_results = {}');
            expect(skillContent).to.include('prev_ui_results = {}');
        });

        // D3: carry-forward seeding block exists and is guarded by pass_count > 1
        it('D3: carry-forward seeding block exists and is guarded by pass_count > 1', function () {
            expect(skillContent).to.include('carry-forward seeding');
            const seedIdx = skillContent.indexOf('carry-forward seeding');
            expect(seedIdx).to.be.greaterThan(-1);
            // Seeding block is inside a pass_count > 1 guard
            const seedBlock = skillContent.substring(seedIdx, seedIdx + 3000);
            expect(seedBlock).to.include('prev_cluster_results');
            expect(seedBlock).to.include('prev_ui_results');
        });

        // D4: Gate 1 safety set for impact cluster (Q-C3) always included in delta
        it('D4: impact cluster delta always includes Gate 1 safety Q-C3', function () {
            const deltaIdx = skillContent.indexOf('pass_delta = {}');
            const deltaBlock = skillContent.substring(deltaIdx, deltaIdx + 3000);
            expect(deltaBlock).to.include('gate1_cluster_impact');
            expect(deltaBlock).to.include('"Q-C3"');
            expect(deltaBlock).to.include('cluster_name == "impact"');
        });

        // GAS/Node L3 evaluator deltas removed via L3-ablation — commented out
        /*
        // D5: Gate 1 safety set for gas evaluator (Q1, Q2, Q13, Q15, Q18, Q42)
        it.skip('D5: gas evaluator delta always includes Gate 1 safety set Q1/Q2/Q13/Q15/Q18/Q42 (L3 ablated)', function () {
            const deltaIdx = skillContent.indexOf('pass_delta = {}');
            const deltaBlock = skillContent.substring(deltaIdx, deltaIdx + 3000);
            expect(deltaBlock).to.include('gate1_gas');
            expect(deltaBlock).to.include('"Q1", "Q2", "Q13", "Q15", "Q18", "Q42"');
        });

        // D6: Gate 1 safety set for node evaluator (N1)
        it.skip('D6: node evaluator delta always includes Gate 1 safety set N1 (L3 ablated)', function () {
            const deltaIdx = skillContent.indexOf('pass_delta = {}');
            const deltaBlock = skillContent.substring(deltaIdx, deltaIdx + 3000);
            expect(deltaBlock).to.include('gate1_node');
            expect(deltaBlock).to.include('"N1"');
        });
        */

        // D7: l1-advisory-structural evaluator prompt has delta injection
        it('D7: l1-advisory-structural evaluator prompt has delta injection block', function () {
            const structStart = skillContent.indexOf('L1 Advisory Structural Evaluator Config');
            const structEnd = skillContent.indexOf('L1 Advisory Process Evaluator Config', structStart);
            const structBlock = skillContent.substring(structStart, structEnd);
            expect(structBlock).to.include('delta filter');
            expect(structBlock).to.include('pass_delta["l1-advisory-structural"]');
            expect(structBlock).to.include('delta: no NEEDS_UPDATE Q-IDs');  // empty branch is live
        });

        // D8: l1-advisory-process evaluator prompt has delta injection
        it('D8: l1-advisory-process evaluator prompt has delta injection block', function () {
            const procStart = skillContent.indexOf('L1 Advisory Process Evaluator Config');
            const procEnd = skillContent.indexOf('--- Cluster Evaluator Config', procStart);
            const procBlock = skillContent.substring(procStart, procEnd);
            expect(procBlock).to.include('delta filter');
            expect(procBlock).to.include('pass_delta["l1-advisory-process"]');
            expect(procBlock).to.include('delta: no NEEDS_UPDATE Q-IDs');  // empty branch is live
        });

        // D9: cluster evaluator prompt has delta injection referencing pass_delta
        it('D9: cluster evaluator prompt has delta injection block referencing pass_delta', function () {
            const clusterStart = skillContent.indexOf('--- Cluster Evaluator Config');
            const clusterEnd = skillContent.indexOf('--- GAS Evaluator Config', clusterStart);
            const clusterBlock = skillContent.substring(clusterStart, clusterEnd);
            expect(clusterBlock).to.include('delta filter');
            expect(clusterBlock).to.include('pass_delta[cluster_name');
            expect(clusterBlock).to.include('delta: no NEEDS_UPDATE Q-IDs');  // empty branch live (non-impact clusters)
        });

        // GAS/Node L3 evaluator prompts removed via L3-ablation — commented out
        /*
        // D10: gas evaluator prompt has delta injection mentioning Gate 1 safety set
        it.skip('D10: gas evaluator prompt has delta injection block mentioning Gate 1 safety set (L3 ablated)', function () {
            const gasStart = skillContent.indexOf('--- GAS Evaluator Config');
            const gasEnd = skillContent.indexOf('--- Node Evaluator Config', gasStart);
            const gasBlock = skillContent.substring(gasStart, gasEnd);
            expect(gasBlock).to.include('delta filter');
            expect(gasBlock).to.include('pass_delta["gas-evaluator"]');
            expect(gasBlock).to.include('Q1, Q2, Q13, Q15, Q18, Q42');
            expect(gasBlock).to.not.include('delta: no NEEDS_UPDATE Q-IDs');  // dead — gate1 always non-empty
        });

        // D11: node evaluator prompt has delta injection mentioning N1
        it.skip('D11: node evaluator prompt has delta injection block mentioning N1 (L3 ablated)', function () {
            const nodeStart = skillContent.indexOf('--- Node Evaluator Config');
            const nodeEnd = skillContent.indexOf('--- UI Evaluator Config', nodeStart);
            const nodeBlock = skillContent.substring(nodeStart, nodeEnd);
            expect(nodeBlock).to.include('delta filter');
            expect(nodeBlock).to.include('pass_delta["node-evaluator"]');
            expect(nodeBlock).to.include('N1');
            expect(nodeBlock).to.not.include('delta: no NEEDS_UPDATE Q-IDs');  // dead — N1 gate1 always non-empty
        });
        */

        // D12: ui evaluator prompt has delta injection
        it('D12: ui evaluator prompt has delta injection block', function () {
            const uiStart = skillContent.indexOf('--- UI Evaluator Config');
            const uiEnd = skillContent.indexOf('-- Pass-level summary', uiStart);
            const uiBlock = skillContent.substring(uiStart, uiEnd);
            expect(uiBlock).to.include('delta filter');
            expect(uiBlock).to.include('pass_delta["ui-evaluator"]');
            expect(uiBlock).to.include('delta: no NEEDS_UPDATE Q-IDs');  // empty branch is live
        });

        // D-delta-print: delta computation block emits per-evaluator Δ print line
        it('D-delta-print: delta computation block emits per-evaluator Δ print line guarded by pass_count > 1', function () {
            const deltaStart = skillContent.indexOf('pass_delta = {}');
            const deltaEnd = skillContent.indexOf('evaluators_to_spawn = []', deltaStart);
            const deltaBlock = skillContent.substring(deltaStart, deltaEnd);
            expect(deltaBlock).to.include('Δ [evaluator_name]');
            expect(deltaBlock).to.include('len(delta_set)');
            expect(deltaBlock).to.include('pass_delta.items()');
        });

        // D13: prev_cluster_results and prev_ui_results appear in memo checkpoint
        it('D13: prev_cluster_results and prev_ui_results are checkpointed in memo writer', function () {
            const checkpointIdx = skillContent.indexOf('-- Checkpoint: persist memoized state');
            expect(checkpointIdx, 'checkpoint section not found').to.be.greaterThan(0);
            const checkpointBlock = skillContent.substring(checkpointIdx, checkpointIdx + 2000);
            expect(checkpointBlock).to.include('prev_cluster_results');
            expect(checkpointBlock).to.include('prev_ui_results');
        });

        // D14: prev_cluster_results and prev_ui_results appear in context recovery
        it('D14: prev_cluster_results and prev_ui_results are restored in context-compression recovery', function () {
            const recoveryIdx = skillContent.indexOf('Context-compression recovery');
            expect(recoveryIdx, 'recovery section not found').to.be.greaterThan(0);
            const recoveryBlock = skillContent.substring(recoveryIdx, recoveryIdx + 3000);
            expect(recoveryBlock).to.include('prev_cluster_results');
            expect(recoveryBlock).to.include('prev_ui_results');
        });

        // D15: evaluator status lines show delta-eval (not hard-coded "re-run") on pass 2+
        it('D15: evaluator status lines show delta-eval count on pass 2+', function () {
            expect(skillContent).to.include('delta-eval');
            // Must NOT still show the old pass-2+ label "re-run (stability not met)"
            expect(skillContent).to.not.include('re-run (stability not met)');
        });

        // D16: carry-forward tracker update block appears after routing, before finding-diff
        it('D16: carry-forward tracker update block appears after routing and before finding-diff', function () {
            const trackerIdx = skillContent.indexOf('Update cluster and UI carry-forward trackers');
            const routeIdx = skillContent.indexOf('Route findings from all_results');
            const diffIdx = skillContent.indexOf('Finding-diff: detect re-raised');
            expect(trackerIdx, 'tracker update block not found').to.be.greaterThan(0);
            expect(trackerIdx).to.be.greaterThan(routeIdx);
            expect(trackerIdx).to.be.lessThan(diffIdx);
        });

        // D17: l1-blocking is NOT narrowed (no pass_delta reference in l1-blocking config)
        it('D17: l1-blocking evaluator is never narrowed (pass_delta not referenced in l1-blocking config)', function () {
            const blockingStart = skillContent.indexOf('--- L1 Blocking Evaluator Config');
            const blockingEnd = skillContent.indexOf('--- L1 Advisory Structural Evaluator Config', blockingStart);
            const blockingBlock = skillContent.substring(blockingStart, blockingEnd);
            expect(blockingBlock).to.not.include('pass_delta');
            expect(blockingBlock).to.not.include('delta filter');
        });

        // GAS/Node-specific routing (gas_results/node_results) removed via L3-ablation — commented out
        /*
        // D18: routing uses per-entry merge (not full dict replacement) for gas/node/cluster/UI
        // Full replacement wipes carry-forward seeded values on pass 2+.
        it.skip('D18: gas/node/cluster/UI routing uses per-entry merge, not full dict replacement (L3 ablated — gas/node removed; cluster/UI part still valid but assertion mixes them)', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings — specific evaluators')
            );
            // Full-replacement patterns that would wipe carry-forward seeding — must NOT appear
            expect(routeSection).to.not.include('gas_results = {q_id: entry.status for');
            expect(routeSection).to.not.include('node_results = {n_id: entry.status for');
            expect(routeSection).to.not.include('ui_results = data.findings');
            expect(routeSection).to.not.match(/cluster_results\[cluster_name\] = data\.findings/);
            // Per-entry merge patterns — must appear in routing section
            expect(routeSection).to.include('gas_results[q_id] = entry.status');
            expect(routeSection).to.include('node_results[n_id] = entry.status');
            expect(routeSection).to.include('ui_results[q_id] = entry');
            expect(routeSection).to.include('cluster_results[cluster_name][q_id] = entry');
        });
        */

        // D19: delta blocks use filter framing with explicit JSON output scope (not old "re-evaluate ONLY" framing)
        it('D19: delta blocks use filter framing with explicit JSON output scope', function () {
            // Positive: new filter framing present
            expect(skillContent).to.include('include in JSON ONLY');
            expect(skillContent).to.include('Omit all other questions from your JSON findings');
            // Negative: old double-ONLY framing must be gone
            expect(skillContent).to.not.include('re-evaluate ONLY the Q-IDs listed below');
        });
    });
});
