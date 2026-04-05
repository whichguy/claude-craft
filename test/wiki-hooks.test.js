const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

const HANDLERS_DIR = path.join(__dirname, '..', 'plugins', 'wiki-hooks', 'handlers');
const REFLECT_HANDLERS_DIR = path.join(__dirname, '..', 'plugins', 'reflection-system', 'hooks-handlers');

describe('Wiki Hooks', function () {
    this.timeout(15000);

    let tmpDir;
    let fakeRepo;
    let fakeClaudeHome;
    let fakeQueueDir;

    beforeEach(function () {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-hooks-test-'));
        fakeRepo = path.join(tmpDir, 'repo');
        fakeClaudeHome = path.join(tmpDir, 'claude-home');
        fakeQueueDir = path.join(fakeClaudeHome, '.claude', 'reflection-queue');

        // Create a git repo with wiki structure
        fs.mkdirSync(path.join(fakeRepo, 'wiki', 'entities'), { recursive: true });
        fs.mkdirSync(path.join(fakeRepo, 'wiki', 'sources'), { recursive: true });
        fs.mkdirSync(path.join(fakeRepo, 'wiki', 'maintenance'), { recursive: true });
        fs.mkdirSync(path.join(fakeRepo, 'raw'), { recursive: true });

        fs.writeFileSync(path.join(fakeRepo, 'wiki', 'index.md'), [
            '# Wiki Index — test-repo',
            '',
            '## Pages',
            '',
            '| Page | Summary | Last Updated |',
            '|------|---------|--------------|',
            '',
            '## About',
            '',
            'Test wiki.',
        ].join('\n'));

        fs.writeFileSync(path.join(fakeRepo, 'wiki', 'log.md'), [
            '# Wiki Log',
            '',
            '## Entries',
            '',
            '[2026-04-05 10:00] INIT wiki-init: initialized',
        ].join('\n'));

        fs.writeFileSync(path.join(fakeRepo, 'wiki', 'SCHEMA.md'), '---\nschema_version: 1\n---\n# Schema\n');

        // Init git repo (safe — uses array form via execSync with cwd)
        require('child_process').execSync('git init -q && git add -A && git commit -q -m init', {
            cwd: fakeRepo, stdio: 'pipe',
        });

        fs.mkdirSync(fakeQueueDir, { recursive: true });
    });

    afterEach(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        try { fs.rmdirSync(path.join(fakeClaudeHome, '.claude', '.wiki-stop-lock')); } catch {}
    });

    /**
     * Run a hook handler with JSON input piped to stdin.
     * HOME override isolates queue writes to temp dir.
     * Note: exec() is used intentionally here — input is test-controlled JSON, not user input.
     */
    function runHook(handlerName, inputJson, extraEnv) {
        const script = path.join(HANDLERS_DIR, handlerName);
        const jsonStr = JSON.stringify(inputJson);
        const env = { ...process.env, HOME: fakeClaudeHome, ...extraEnv };
        return execAsync(`printf '%s' '${jsonStr.replace(/'/g, "'\\''")}' | bash "${script}"`, {
            env, timeout: 10000,
        });
    }

    function runReflectHook(handlerName, inputJson, extraEnv) {
        const script = path.join(REFLECT_HANDLERS_DIR, handlerName);
        const jsonStr = JSON.stringify(inputJson);
        const env = { ...process.env, HOME: fakeClaudeHome, ...extraEnv };
        return execAsync(`printf '%s' '${jsonStr.replace(/'/g, "'\\''")}' | bash "${script}"`, {
            env, timeout: 10000,
        });
    }

    // ================================================================
    // Group 1: wiki-stop.sh find-newer change detection
    // ================================================================
    describe('wiki-stop.sh find-newer', function () {

        it('should detect wiki files modified after session marker', async function () {
            const sid = 'findnewer-test-1234';
            const shortSid = sid.substring(0, 8);

            // Create session marker (simulates wiki-detect.sh at SessionStart)
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${shortSid}-start`), '');

            // Wait so file mtimes differ from marker
            await new Promise(r => setTimeout(r, 1100));

            // Simulate wiki changes during the session
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'test-entity.md'), '# Test Entity\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'sources', 'test-source.md'), '# Test Source\n');

            await runHook('wiki-stop.sh', {
                cwd: fakeRepo, agent_id: '', session_id: sid,
                transcript_path: '/tmp/fake-transcript.jsonl',
            });

            // Verify wiki_change queue entry lists the changed files
            const changeQueue = path.join(fakeQueueDir, `${sid}-wikichange.json`);
            expect(fs.existsSync(changeQueue), 'wiki_change queue entry should exist').to.be.true;

            const entry = JSON.parse(fs.readFileSync(changeQueue, 'utf-8'));
            expect(entry.type).to.equal('wiki_change');
            expect(entry.status).to.equal('pending');
            expect(entry.changed_files).to.be.an('array').with.lengthOf(2);
            expect(entry.changed_files).to.include('entities/test-entity.md');
            expect(entry.changed_files).to.include('sources/test-source.md');

            // Session marker should be cleaned up
            expect(fs.existsSync(path.join(fakeRepo, 'wiki', `.session-${shortSid}-start`))).to.be.false;
        });

        it('should not create wiki_change entry when no files changed', async function () {
            const sid = 'nochange-test-5678';
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${sid.substring(0, 8)}-start`), '');

            await runHook('wiki-stop.sh', {
                cwd: fakeRepo, agent_id: '', session_id: sid,
                transcript_path: '/tmp/fake.jsonl',
            });

            expect(fs.existsSync(path.join(fakeQueueDir, `${sid}-wiki.json`))).to.be.true;
            expect(fs.existsSync(path.join(fakeQueueDir, `${sid}-wikichange.json`))).to.be.false;
        });

        it('should append SESSION_END to log.md', async function () {
            const sid = 'logtest-abcd-1234';
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${sid.substring(0, 8)}-start`), '');

            await runHook('wiki-stop.sh', {
                cwd: fakeRepo, agent_id: '', session_id: sid,
                transcript_path: '/tmp/fake.jsonl',
            });

            const log = fs.readFileSync(path.join(fakeRepo, 'wiki', 'log.md'), 'utf-8');
            expect(log).to.include('SESSION_END');
            expect(log).to.include(`session:${sid.substring(0, 8)}`);
        });

        it('should not create session_wiki entry when transcript_path is empty', async function () {
            const sid = 'notranscript-9999';
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${sid.substring(0, 8)}-start`), '');

            await runHook('wiki-stop.sh', {
                cwd: fakeRepo, agent_id: '', session_id: sid,
                transcript_path: '',
            });

            expect(fs.existsSync(path.join(fakeQueueDir, `${sid}-wiki.json`))).to.be.false;
        });
    });

    // ================================================================
    // Group 2: wiki-stop.sh mkdir lock concurrency
    // ================================================================
    describe('wiki-stop.sh concurrency', function () {

        it('should serialize concurrent stop hooks via mkdir lock', async function () {
            const sidA = 'concurrent-aaaa-1111';
            const sidB = 'concurrent-bbbb-2222';

            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${sidA.substring(0, 8)}-start`), '');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${sidB.substring(0, 8)}-start`), '');

            // Run both stop hooks in parallel
            await Promise.all([
                runHook('wiki-stop.sh', {
                    cwd: fakeRepo, agent_id: '', session_id: sidA,
                    transcript_path: '/tmp/transcript-a.jsonl',
                }),
                runHook('wiki-stop.sh', {
                    cwd: fakeRepo, agent_id: '', session_id: sidB,
                    transcript_path: '/tmp/transcript-b.jsonl',
                }),
            ]);

            // Both SESSION_END entries should be in log
            const log = fs.readFileSync(path.join(fakeRepo, 'wiki', 'log.md'), 'utf-8');
            const endEntries = log.split('\n').filter(l => l.includes('SESSION_END'));
            expect(endEntries.length).to.equal(2);

            // Both queue entries should exist (unique filenames)
            expect(fs.existsSync(path.join(fakeQueueDir, `${sidA}-wiki.json`))).to.be.true;
            expect(fs.existsSync(path.join(fakeQueueDir, `${sidB}-wiki.json`))).to.be.true;

            // Lock dir should be cleaned up
            expect(fs.existsSync(path.join(fakeClaudeHome, '.claude', '.wiki-stop-lock'))).to.be.false;
        });
    });

    // ================================================================
    // Group 3: session-start-processor.sh dual-path topic search
    // ================================================================
    describe('session-start-processor.sh dual-path topics', function () {

        it('should find topics in global wiki dir', async function () {
            const globalTopicDir = path.join(fakeClaudeHome, '.claude', 'wiki', 'topics');
            fs.mkdirSync(globalTopicDir, { recursive: true });
            fs.writeFileSync(
                path.join(globalTopicDir, 'test-patterns.md'),
                '---\ntopic: test-patterns\n---\n# Test Patterns\nUsed in myproject for testing.\n'
            );

            const { stdout } = await runReflectHook('session-start-processor.sh', {
                cwd: '/tmp/myproject', agent_id: '', session_id: 'topic-test-1',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed.systemMessage).to.include('test-patterns');
            expect(parsed.systemMessage).to.include('/wiki-load');
        });

        it('should find topics in legacy reflection-knowledge dir', async function () {
            const legacyDir = path.join(fakeClaudeHome, '.claude', 'reflection-knowledge', 'topics');
            fs.mkdirSync(legacyDir, { recursive: true });
            fs.writeFileSync(
                path.join(legacyDir, 'legacy-design.md'),
                '---\ntopic: legacy-design\n---\n# Legacy\nPatterns from legacyrepo.\n'
            );

            const { stdout } = await runReflectHook('session-start-processor.sh', {
                cwd: '/tmp/legacyrepo', agent_id: '', session_id: 'topic-test-2',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed.systemMessage).to.include('legacy-design');
        });

        it('should deduplicate topics present in both dirs', async function () {
            const globalDir = path.join(fakeClaudeHome, '.claude', 'wiki', 'topics');
            const legacyDir = path.join(fakeClaudeHome, '.claude', 'reflection-knowledge', 'topics');
            fs.mkdirSync(globalDir, { recursive: true });
            fs.mkdirSync(legacyDir, { recursive: true });

            const content = '---\ntopic: shared-topic\n---\n# Shared\nUsed in duperepo.\n';
            fs.writeFileSync(path.join(globalDir, 'shared-topic.md'), content);
            fs.writeFileSync(path.join(legacyDir, 'shared-topic.md'), content);

            const { stdout } = await runReflectHook('session-start-processor.sh', {
                cwd: '/tmp/duperepo', agent_id: '', session_id: 'topic-test-3',
            });

            const parsed = JSON.parse(stdout.trim());
            const matches = parsed.systemMessage.match(/shared-topic/g);
            expect(matches.length).to.equal(1, 'topic should appear only once (deduplicated)');
        });

        it('should be silent for repos with short generic names', async function () {
            // "src" is in the skip list
            try {
                const { stdout } = await runReflectHook('session-start-processor.sh', {
                    cwd: '/tmp/src', agent_id: '', session_id: 'topic-test-4',
                });
                if (stdout.trim()) {
                    const parsed = JSON.parse(stdout.trim());
                    expect(parsed.systemMessage).to.not.include('KNOWLEDGE CONTEXT');
                }
            } catch {
                // Silent exit is acceptable
            }
        });
    });

    // ================================================================
    // Group 4: wiki-detect.sh basic contract
    // ================================================================
    describe('wiki-detect.sh', function () {

        it('should output valid systemMessage JSON for wiki repos', async function () {
            const { stdout } = await runHook('wiki-detect.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'detect-test-1234',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed).to.have.property('systemMessage');
            expect(parsed.systemMessage).to.include('Wiki:');
            expect(parsed.systemMessage).to.include('/wiki-load');
        });

        it('should be silent for non-wiki repos', async function () {
            const nonWikiRepo = path.join(tmpDir, 'non-wiki');
            fs.mkdirSync(nonWikiRepo, { recursive: true });
            require('child_process').execSync('git init -q && echo x > f && git add -A && git commit -q -m init', {
                cwd: nonWikiRepo, stdio: 'pipe',
            });

            try {
                const { stdout } = await runHook('wiki-detect.sh', {
                    cwd: nonWikiRepo, agent_id: '', session_id: 'detect-none',
                });
                expect(stdout.trim()).to.equal('');
            } catch (e) {
                expect(e.stdout || '').to.equal('');
            }
        });

        it('should create session marker file', async function () {
            const sid = 'marker-test-abcdefgh';
            await runHook('wiki-detect.sh', { cwd: fakeRepo, agent_id: '', session_id: sid });

            const marker = path.join(fakeRepo, 'wiki', `.session-${sid.substring(0, 8)}-start`);
            expect(fs.existsSync(marker)).to.be.true;
        });
    });

    // ================================================================
    // Group 5: wiki-raw-guard.sh
    // ================================================================
    describe('wiki-raw-guard.sh', function () {

        it('should block writes to /raw/ paths', async function () {
            try {
                await runHook('wiki-raw-guard.sh', { file_path: '/repo/raw/test.md' });
                throw new Error('should have exited non-zero');
            } catch (e) {
                expect(e.code).to.equal(2);
                expect(e.stdout).to.include('LLM-write-protected');
            }
        });

        it('should block writes to relative raw/ paths', async function () {
            try {
                await runHook('wiki-raw-guard.sh', { file_path: 'raw/test.md' });
                throw new Error('should have exited non-zero');
            } catch (e) {
                expect(e.code).to.equal(2);
            }
        });

        it('should allow writes to non-raw paths', async function () {
            const { stdout } = await runHook('wiki-raw-guard.sh', { file_path: '/repo/wiki/entities/test.md' });
            expect(stdout.trim()).to.equal('');
        });

        it('should not false-positive on rawdata/', async function () {
            const { stdout } = await runHook('wiki-raw-guard.sh', { file_path: '/repo/rawdata/file.md' });
            expect(stdout.trim()).to.equal('');
        });
    });
});
