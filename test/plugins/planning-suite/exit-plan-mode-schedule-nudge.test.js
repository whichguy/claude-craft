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

describe('plugins/planning-suite/handlers/exit-plan-mode-schedule-nudge.sh', function () {
    const src = fs.readFileSync(HANDLER, 'utf8');

    it('contains capped breadcrumb append (Phase 1 diagnostic)', function () {
        expect(src).to.include('planning-suite-hooks.log');
        expect(src).to.include('tail -n 199');
        expect(src).to.include('[schedule-nudge]');
    });

    it('emits PostToolUse hookSpecificOutput.additionalContext when a plan exists', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-test-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const planPath = path.join(tmpHome, '.claude', 'plans', 'fixture.md');
        fs.writeFileSync(planPath, '# fixture plan\n');

        const stdout = execFileSync('bash', [HANDLER], {
            env: { ...process.env, HOME: tmpHome },
            encoding: 'utf8',
        });
        const parsed = JSON.parse(stdout);
        expect(parsed.hookSpecificOutput.hookEventName).to.equal('PostToolUse');
        expect(parsed.hookSpecificOutput.additionalContext).to.include('approved via ExitPlanMode');
        expect(parsed.hookSpecificOutput.additionalContext).to.include('schedule-plan-tasks');

        const log = fs.readFileSync(
            path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log'),
            'utf8'
        );
        expect(log).to.match(/\[schedule-nudge\] .* plan=.*fixture\.md/);

        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('exits silently (no stdout) when no plan file present', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-empty-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        const stdout = execFileSync('bash', [HANDLER], {
            env: { ...process.env, HOME: tmpHome },
            encoding: 'utf8',
        });
        expect(stdout.trim()).to.equal('');
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('caps the log at <=200 lines', function () {
        const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-nudge-cap-'));
        fs.mkdirSync(path.join(tmpHome, '.claude', 'plans'), { recursive: true });
        fs.mkdirSync(path.join(tmpHome, '.claude', 'logs'), { recursive: true });
        fs.writeFileSync(path.join(tmpHome, '.claude', 'plans', 'p.md'), 'x');
        const seed = Array.from({ length: 500 }, (_, i) => `[old] line ${i}`).join('\n') + '\n';
        const logPath = path.join(tmpHome, '.claude', 'logs', 'planning-suite-hooks.log');
        fs.writeFileSync(logPath, seed);

        execFileSync('bash', [HANDLER], {
            env: { ...process.env, HOME: tmpHome },
            encoding: 'utf8',
        });

        const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
        expect(lines.length).to.be.at.most(200);
        expect(lines[lines.length - 1]).to.match(/^\[schedule-nudge\]/);

        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
});
