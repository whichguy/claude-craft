const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

const HANDLERS_DIR = path.join(__dirname, '..', 'plugins', 'async-suite', 'handlers');

describe('task-persist-restore.sh', function () {
    this.timeout(15000);

    let tmpDir;
    let fakeHome;
    let fakeTasksDir;
    let fakeSnapshotsDir;

    const CURRENT_SID = 'current-session-1234-5678-abcd-efgh';
    const PRIOR_SID   = 'prior-session-0000-1111-2222-3333';

    beforeEach(function () {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-persist-test-'));
        fakeHome = path.join(tmpDir, 'home');
        fakeTasksDir = path.join(fakeHome, '.claude', 'tasks');
        fakeSnapshotsDir = path.join(fakeHome, '.claude', 'tasks-snapshots');
        fs.mkdirSync(fakeTasksDir, { recursive: true });
        // Current session dir (empty — no tasks yet)
        fs.mkdirSync(path.join(fakeTasksDir, CURRENT_SID), { recursive: true });
    });

    afterEach(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeTask(sessionDir, task) {
        fs.writeFileSync(
            path.join(sessionDir, `${task.id}.json`),
            JSON.stringify(task)
        );
    }

    function makePriorDir() {
        const dir = path.join(fakeTasksDir, PRIOR_SID);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    function runRestore(sessionId, extraEnv) {
        const script = path.join(HANDLERS_DIR, 'task-persist-restore.sh');
        const input = JSON.stringify({ session_id: sessionId, agent_id: '' });
        const env = { ...process.env, HOME: fakeHome, ...extraEnv };
        return execAsync(
            `printf '%s' '${input.replace(/'/g, "'\\''")}' | bash "${script}"`,
            { env, timeout: 10000 }
        );
    }

    // (a) canonical hookSpecificOutput shape with 2 pending tasks
    it('(a) emits hookSpecificOutput.{hookEventName, additionalContext} with pending tasks', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Task one', description: 'Do A', activeForm: 'Doing A', status: 'pending', blocks: [], blockedBy: [] });
        writeTask(priorDir, { id: '2', subject: 'Task two', description: 'Do B', activeForm: 'Doing B', status: 'in_progress', blocks: [], blockedBy: [] });

        const { stdout } = await runRestore(CURRENT_SID);
        const parsed = JSON.parse(stdout.trim());

        expect(parsed).to.have.property('systemMessage');
        expect(parsed).to.have.property('hookSpecificOutput');
        expect(parsed.hookSpecificOutput).to.have.property('hookEventName', 'SessionStart');
        expect(parsed.hookSpecificOutput).to.have.property('additionalContext');
        // additionalContext must NOT be at top level
        expect(parsed).to.not.have.property('additionalContext');
    });

    // (b) silent when .disabled present
    it('(b) exits silently when .disabled flag is present', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Task', description: 'D', activeForm: 'A', status: 'pending', blocks: [], blockedBy: [] });

        fs.mkdirSync(fakeSnapshotsDir, { recursive: true });
        fs.writeFileSync(path.join(fakeSnapshotsDir, '.disabled'), '');

        const { stdout } = await runRestore(CURRENT_SID);
        expect(stdout.trim()).to.equal('');
    });

    // (c) silent when sentinel already present (idempotency)
    it('(c) exits silently when restore sentinel already exists', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Task', description: 'D', activeForm: 'A', status: 'pending', blocks: [], blockedBy: [] });

        fs.mkdirSync(fakeSnapshotsDir, { recursive: true });
        fs.writeFileSync(path.join(fakeSnapshotsDir, `.restored-${CURRENT_SID}`), '');

        const { stdout } = await runRestore(CURRENT_SID);
        expect(stdout.trim()).to.equal('');
    });

    // (d) silent when all prior tasks are completed
    it('(d) exits silently when all prior tasks are completed', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Done', description: 'D', activeForm: 'A', status: 'completed', blocks: [], blockedBy: [] });
        writeTask(priorDir, { id: '2', subject: 'Also done', description: 'E', activeForm: 'B', status: 'completed', blocks: [], blockedBy: [] });

        const { stdout } = await runRestore(CURRENT_SID);
        expect(stdout.trim()).to.equal('');
    });

    // (e) silent when no prior dir has *.json files
    it('(e) exits silently when no prior session dir contains json files', async function () {
        // Prior dir exists but is empty (already consumed)
        makePriorDir();

        const { stdout } = await runRestore(CURRENT_SID);
        expect(stdout.trim()).to.equal('');
    });

    // (f) blockedBy edges pointing at completed tasks are dropped
    it('(f) drops blockedBy edges that reference completed tasks', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Done', description: 'D', activeForm: 'A', status: 'completed', blocks: ['2'], blockedBy: [] });
        writeTask(priorDir, { id: '2', subject: 'Pending', description: 'P', activeForm: 'B', status: 'pending', blocks: [], blockedBy: ['1'] });

        const { stdout } = await runRestore(CURRENT_SID);
        const parsed = JSON.parse(stdout.trim());
        const context = parsed.hookSpecificOutput.additionalContext;

        // Extract the task JSON from the context (last line is the compact JSON)
        const jsonLine = context.split('\n').find(l => l.trim().startsWith('['));
        const tasks = JSON.parse(jsonLine);

        expect(tasks).to.have.lengthOf(1);
        expect(tasks[0].id).to.equal('2');
        // blockedBy reference to completed task '1' should be removed
        expect(tasks[0].blockedBy).to.deep.equal([]);
    });

    // (g) additionalContext mentions TaskCreate, TaskUpdate, and id-remapping
    it('(g) additionalContext references TaskCreate, TaskUpdate, and id-remapping', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Task', description: 'D', activeForm: 'A', status: 'in_progress', blocks: [], blockedBy: [] });

        const { stdout } = await runRestore(CURRENT_SID);
        const parsed = JSON.parse(stdout.trim());
        const ctx = parsed.hookSpecificOutput.additionalContext;

        expect(ctx).to.match(/TaskCreate/);
        expect(ctx).to.match(/TaskUpdate/);
        expect(ctx).to.match(/old.{1,10}id|map.{1,20}id|remap/i);
        // Should mention terminal states, not just "completed"
        expect(ctx).to.match(/abandoned|terminal|cancelled/i);
    });

    // (i) abandoned task excluded from restore; its id pruned from surviving blockedBy
    it('(i) abandoned task excluded from restore and pruned from blockedBy edges', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Abandoned', description: 'D', activeForm: 'A', status: 'abandoned', blocks: ['2'], blockedBy: [] });
        writeTask(priorDir, { id: '2', subject: 'Pending', description: 'P', activeForm: 'B', status: 'pending', blocks: [], blockedBy: ['1'] });

        const { stdout } = await runRestore(CURRENT_SID);
        const parsed = JSON.parse(stdout.trim());
        const context = parsed.hookSpecificOutput.additionalContext;

        const jsonLine = context.split('\n').find(l => l.trim().startsWith('['));
        const tasks = JSON.parse(jsonLine);

        // Only the pending task should be restored
        expect(tasks).to.have.lengthOf(1);
        expect(tasks[0].id).to.equal('2');
        // blockedBy ref to the abandoned task should be dropped
        expect(tasks[0].blockedBy).to.deep.equal([]);
    });

    // (h) prior session *.json files deleted; .lock preserved
    it('(h) deletes prior session json files after emit but preserves .lock', async function () {
        const priorDir = makePriorDir();
        writeTask(priorDir, { id: '1', subject: 'Task', description: 'D', activeForm: 'A', status: 'pending', blocks: [], blockedBy: [] });
        // Simulate a .lock file in the prior session dir
        fs.writeFileSync(path.join(priorDir, '.lock'), 'lock-skeleton');

        const { stdout } = await runRestore(CURRENT_SID);
        const parsed = JSON.parse(stdout.trim());
        expect(parsed.hookSpecificOutput.hookEventName).to.equal('SessionStart');

        // json file should be gone
        expect(fs.existsSync(path.join(priorDir, '1.json'))).to.be.false;
        // .lock should remain
        expect(fs.existsSync(path.join(priorDir, '.lock'))).to.be.true;
    });
});
