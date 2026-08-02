const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const HANDLER = path.join(
    REPO_ROOT,
    'plugins',
    'planning-suite',
    'handlers',
    'exit-plan-mode-schedule-nudge.sh'
);
const HANDLER_PY = path.join(
    REPO_ROOT,
    'plugins',
    'planning-suite',
    'handlers',
    'exit-plan-mode-schedule-nudge.py'
);

function runNudge({ home, stdin = '', env = {} }) {
    return execFileSync('bash', [HANDLER], {
        env: { ...process.env, HOME: home, ...env },
        encoding: 'utf8',
        input: stdin,
    });
}

describe('plugins/planning-suite/handlers/exit-plan-mode-schedule-nudge', function () {
    it('ships bash wrapper + python companion', function () {
        expect(fs.existsSync(HANDLER)).to.equal(true);
        expect(fs.existsSync(HANDLER_PY)).to.equal(true);
        const src = fs.readFileSync(HANDLER, 'utf8');
        expect(src).to.include('exit-plan-mode-schedule-nudge.py');
    });

    it('emits EXECUTE NOW with --plan when planFilePath is in payload', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-test-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const multiBody = [
            '# Multi-step feature',
            '',
            '## Context',
            'Build a multi-file feature with verification.',
            '',
            '## Phase 1',
            'Create module A and tests.',
            '',
            '## Phase 2',
            'Wire module B to A and add integration tests.',
            '',
            '## Phase 3',
            'Run full suite and open PR.',
            '',
            '## Verification',
            'npm test',
        ].join('\n');
        const planPath = path.join(tmpHome, '.claude', 'plans', 'fixture.md');
        fs.writeFileSync(planPath, multiBody);
        // Newer decoy must not win over payload path
        const decoy = path.join(tmpHome, '.claude', 'plans', 'newer-decoy.md');
        fs.writeFileSync(decoy, '# decoy\n');
        const old = Date.now() / 1000 - 3600;
        fs.utimesSync(planPath, old, old);

        const stdin = JSON.stringify({
            tool_name: 'ExitPlanMode',
            tool_input: { planFilePath: planPath },
        });
        const stdout = runNudge({ home: tmpHome, stdin });
        const parsed = JSON.parse(stdout);
        expect(parsed.hookSpecificOutput.hookEventName).to.equal('PostToolUse');
        const ctx = parsed.hookSpecificOutput.additionalContext;
        expect(ctx).to.include('EXECUTE NOW');
        expect(ctx).to.include('approved via ExitPlanMode');
        expect(ctx).to.match(/schedule-plan-tasks --plan '/);
        expect(ctx).to.include(planPath);
        expect(ctx).to.not.include('If the user wants to execute');
        expect(ctx).to.not.include('newer-decoy');
        expect(ctx).to.not.include('EXECUTE NOW (inline)');
        expect(parsed.systemMessage).to.match(/immediately invoke/i);

        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/\[schedule-nudge\].*src=payload/);
        expect(log).to.match(/execute=schedule/);
        expect(log).to.include(planPath);

        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('pathless EXECUTE NOW when no payload path (never mtime-picks a plan)', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-pathless-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpHome, '.claude', 'plans', 'stale.md'),
            '# should not appear\n'
        );
        const stdout = runNudge({
            home: tmpHome,
            stdin: JSON.stringify({ tool_name: 'ExitPlanMode', tool_input: {} }),
        });
        const parsed = JSON.parse(stdout);
        const ctx = parsed.hookSpecificOutput.additionalContext;
        expect(ctx).to.include('EXECUTE NOW');
        expect(ctx).to.not.include('stale.md');
        expect(ctx).to.not.match(/schedule-plan-tasks --plan '/);
        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/src=none/);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('unique content-hash match resolves src=hash', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-hash-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const body = [
            '# unique plan body for hash match',
            'Execute: schedule',
            '',
            '## Phase 1',
            'Do first multi-file change.',
            '## Phase 2',
            'Do second multi-file change and verify.',
        ].join('\n');
        const planPath = path.join(tmpHome, '.claude', 'plans', 'hashed.md');
        fs.writeFileSync(planPath, body);
        const stdin = JSON.stringify({
            tool_name: 'ExitPlanMode',
            tool_input: { plan: body },
        });
        const stdout = runNudge({ home: tmpHome, stdin });
        const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
        expect(ctx).to.include('EXECUTE NOW');
        // macOS may resolve /var → /private/var; match basename + --plan form
        expect(ctx).to.include('hashed.md');
        expect(ctx).to.match(/schedule-plan-tasks --plan '/);
        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/src=hash/);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('Execute: inline routes to in-session implement (no schedule-plan-tasks)', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-inline-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const planPath = path.join(tmpHome, '.claude', 'plans', 'tiny.md');
        fs.writeFileSync(
            planPath,
            '# Rename\nExecute: inline\n\n## Step 1\nRename the package.\n'
        );
        const stdin = JSON.stringify({
            tool_name: 'ExitPlanMode',
            tool_input: { planFilePath: planPath },
        });
        const stdout = runNudge({ home: tmpHome, stdin });
        const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
        expect(ctx).to.include('EXECUTE NOW (inline)');
        expect(ctx).to.include('Do **not** invoke');
        expect(ctx).to.not.match(/Immediately invoke `\/schedule-plan-tasks --plan/);
        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/execute=inline/);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('Execute: ask waits for explicit go-ahead', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-ask-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const planPath = path.join(tmpHome, '.claude', 'plans', 'later.md');
        fs.writeFileSync(
            planPath,
            '# Big rewrite\nExecute: ask\n\n## Phase 1\n...\n## Phase 2\n...\n'
        );
        const stdin = JSON.stringify({
            tool_name: 'ExitPlanMode',
            tool_input: { planFilePath: planPath },
        });
        const stdout = runNudge({ home: tmpHome, stdin });
        const parsed = JSON.parse(stdout);
        const ctx = parsed.hookSpecificOutput.additionalContext;
        expect(ctx).to.not.include('EXECUTE NOW');
        expect(ctx).to.include('Execute: ask');
        expect(parsed.systemMessage).to.match(/wait for explicit/i);
        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/execute=ask/);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('CLAUDE_PLAN_AUTO_EXECUTE=0 omits EXECUTE NOW', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-off-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const planPath = path.join(tmpHome, '.claude', 'plans', 'p.md');
        fs.writeFileSync(planPath, 'x');
        const stdin = JSON.stringify({
            tool_name: 'ExitPlanMode',
            tool_input: { planFilePath: planPath },
        });
        const stdout = runNudge({
            home: tmpHome,
            stdin,
            env: { CLAUDE_PLAN_AUTO_EXECUTE: '0' },
        });
        const parsed = JSON.parse(stdout);
        const ctx = parsed.hookSpecificOutput.additionalContext;
        expect(ctx).to.not.include('EXECUTE NOW');
        expect(ctx).to.include('Auto-execute is off');
        expect(ctx).to.include(planPath);
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('caps the log at <=200 lines', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-cap-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        fs.mkdirSync(path.join(tmpHome, '.claude', 'logs'), { recursive: true });
        const planPath = path.join(tmpHome, '.claude', 'plans', 'p.md');
        fs.writeFileSync(planPath, 'x');
        const seed = Array.from({ length: 500 }, (_, i) => `[old] line ${i}`).join('\n') + '\n';
        const logPath = path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log');
        fs.writeFileSync(logPath, seed);

        runNudge({
            home: tmpHome,
            stdin: JSON.stringify({
                tool_name: 'ExitPlanMode',
                tool_input: { planFilePath: planPath },
            }),
        });

        const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
        expect(lines.length).to.be.at.most(200);
        expect(lines[lines.length - 1]).to.match(/^\[schedule-nudge\]/);

        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
});
