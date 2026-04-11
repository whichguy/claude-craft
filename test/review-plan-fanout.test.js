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
        it('checks gas-evaluator BEFORE wildcard *-evaluator', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const gasIdx = routeSection.indexOf('evaluator_name == "gas-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(gasIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(gasIdx);
        });

        it('checks node-evaluator BEFORE wildcard *-evaluator', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const nodeIdx = routeSection.indexOf('evaluator_name == "node-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(nodeIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(nodeIdx);
        });

        it('checks ui-evaluator BEFORE wildcard *-evaluator', function () {
            const routeSection = skillContent.substring(
                skillContent.indexOf('Route findings from all_results')
            );
            const uiIdx = routeSection.indexOf('evaluator_name == "ui-evaluator"');
            const wildcardIdx = routeSection.indexOf('evaluator_name matches "*-evaluator" (cluster)');
            expect(uiIdx).to.be.greaterThan(-1);
            expect(wildcardIdx).to.be.greaterThan(uiIdx);
        });

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
            // l1-advisory is now split: structural (6 questions) + process (18 questions) = 24 total
            // (Q-G2 dropped from blocking, Q-G8 dropped from process per effectiveness report 2026-04-10)
            expect(skillContent).to.include('L1 Advisory Structural Evaluator Config (Gate 2/3: 6 abstract/structural questions');
            expect(skillContent).to.include('L1 Advisory Process Evaluator Config (Gate 2/3: 18 standards/process questions');
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
            const section = skillContent.substring(idx, idx + 4000);
            // Must guard the append branch against empty list (NO_INTENT_QUESTIONS path).
            // Guard may be multi-line ("IF intent_questions == []\n    SKIP"), so check components.
            expect(section).to.include('intent_questions == []');
            expect(section).to.match(/intent_questions == \[\][\s\S]{0,200}SKIP/);
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
});
