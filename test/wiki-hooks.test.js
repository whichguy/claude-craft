const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

const HANDLERS_DIR = path.join(__dirname, '..', 'plugins', 'wiki-hooks', 'handlers');
// reflection-system deleted — session-start-processor logic merged into wiki-detect.sh

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
        // Validate handlerName to prevent shell injection (test-only, but good hygiene)
        if (!/^[\w.-]+$/.test(handlerName)) {
            throw new Error(`Invalid handler name: ${handlerName}`);
        }
        const script = path.join(HANDLERS_DIR, handlerName);
        const jsonStr = JSON.stringify(inputJson);
        const env = { ...process.env, HOME: fakeClaudeHome, ...extraEnv };
        return execAsync(`printf '%s' '${jsonStr.replace(/'/g, "'\\''")}' | bash "${script}"`, {
            env, timeout: 10000,
        });
    }

    // runReflectHook removed — reflection-system deleted, tests below updated to use wiki-detect.sh

    // ================================================================
    // Group 1: wiki-stop.sh find-newer change detection
    // ================================================================
    describe('wiki-stop.sh find-newer', function () {

        it('should detect wiki files modified after session marker', async function () {
            const sid = 'findnewer-test-1234';
            const shortSid = sid.substring(0, 8);

            // Create session marker (simulates wiki-detect.sh at SessionStart)
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${shortSid}-start`), '');

            // Wait so file mtimes differ from marker (2s to clear 1s filesystem granularity on Linux)
            await new Promise(r => setTimeout(r, 2000));

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
    // Group 3: wiki-detect.sh queue detection (directive moved to wiki-queue-nudge.sh)
    // ================================================================
    describe('wiki-detect.sh queue detection', function () {

        it('should NOT include processing directive (moved to wiki-queue-nudge.sh)', async function () {
            // Create a pending queue entry — wiki-detect.sh should NOT mention it
            fs.writeFileSync(
                path.join(fakeClaudeHome, '.claude', 'reflection-queue', 'test-session-wiki.json'),
                JSON.stringify({ type: 'session_wiki', status: 'pending', session_id: 'test' })
            );

            const { stdout } = await runHook('wiki-detect.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'queue-test-1',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed.systemMessage).to.not.include('/wiki-process');
            expect(parsed.systemMessage).to.not.include('AUTOMATIC ACTION');

            // Clean up
            fs.unlinkSync(path.join(fakeClaudeHome, '.claude', 'reflection-queue', 'test-session-wiki.json'));
        });

        it('should still expire old queue entries (housekeeping retained)', async function () {
            const { stdout } = await runHook('wiki-detect.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'queue-test-2',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed.systemMessage).to.not.include('AUTOMATIC ACTION');
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
            expect(parsed.systemMessage).to.include('wiki');
            expect(parsed.systemMessage).to.include('/wiki-load');
            expect(parsed).to.have.property('hookSpecificOutput');
            expect(parsed.hookSpecificOutput).to.have.property('additionalContext');
            // hookEventName must match the actual hook event (SessionStart)
            expect(parsed.hookSpecificOutput).to.have.property('hookEventName', 'SessionStart');
            // additionalContext must be nested, never top-level
            expect(parsed).to.not.have.property('additionalContext');
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

        // A1: soften amplifier framing — replace "consult before answering
        // project-domain questions" with a conditional + explicit skip criteria,
        // so the LLM doesn't fire /wiki-load on clearly off-domain prompts.
        it('should inject softer A1 framing in SessionStart additionalContext', async function () {
            const { stdout } = await runHook('wiki-detect.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'detect-a1-1234',
            });

            const parsed = JSON.parse(stdout.trim());
            const context = parsed.hookSpecificOutput.additionalContext;
            // Positive: conditional framing
            expect(context).to.match(/consult when/i);
            // Positive: explicit negative criteria (skip list)
            expect(context).to.match(/skip for|skip if/i);
            expect(context).to.match(/general coding|math|tool-output|conversation-meta/i);
            // Negative: blanket mandate removed
            expect(context).to.not.match(/Consult before answering/i);
        });
    });

    // ================================================================
    // Group 4b: wiki-precompact.sh hook output schema
    // ================================================================
    describe('wiki-precompact.sh', function () {

        it('should emit only top-level systemMessage (PreCompact rejects hookSpecificOutput)', async function () {
            // Provide a fake transcript so the hook does not skip on empty TRANSCRIPT
            const fakeTranscript = path.join(tmpDir, 'fake-transcript.jsonl');
            fs.writeFileSync(fakeTranscript, '');

            const { stdout } = await runHook('wiki-precompact.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'precompact-test-1234',
                transcript_path: fakeTranscript,
            });

            const parsed = JSON.parse(stdout.trim());
            // PreCompact does NOT support hookSpecificOutput.additionalContext
            // (primary-source schema; only top-level systemMessage is accepted)
            expect(parsed).to.have.property('systemMessage');
            expect(parsed).to.not.have.property('hookSpecificOutput');
            expect(parsed).to.not.have.property('additionalContext');
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

    // ================================================================
    // Group 5b: wiki-notify.sh delta-only injection (N1)
    // Contract: evergreen directive lives in wiki-detect.sh SessionStart.
    // This handler fires per-prompt but emits ONLY when there is a delta —
    // entity match against cached index, or new wiki pages since last check.
    // Silent exit otherwise. WIKI_SKIP=1 always suppresses.
    // ================================================================
    describe('wiki-notify.sh delta-only injection', function () {

        it('should exit silently when no entity match and no new pages', async function () {
            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-silent-1234',
                cwd: fakeRepo,
                prompt: 'some generic question unrelated to the wiki',
            });

            expect(stdout.trim()).to.equal('');
        });

        it('should exit silently when WIKI_SKIP=1 regardless of match state', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'skip-test\treview changes entity\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'skip-test.md'), '# Skip Test\n');

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-skip-1234',
                cwd: fakeRepo,
                prompt: 'review the test entity changes',
            }, { WIKI_SKIP: '1' });

            expect(stdout.trim()).to.equal('');
        });

        it('should return silently for cwd without wiki/log.md', async function () {
            const nonWikiDir = path.join(fakeRepo, '..', 'nowiki-notify');
            fs.mkdirSync(nonWikiDir, { recursive: true });

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-nowiki-1234',
                cwd: nonWikiDir,
                prompt: 'hello',
            });

            expect(stdout.trim()).to.equal('');
        });

        it('should emit compact <wiki_match> block with soft A1 framing when prompt keywords match a cached entity', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'test-entity\ttest entity review changes\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'test-entity.md'), '# Test Entity\n');

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-match-1234',
                cwd: fakeRepo,
                prompt: 'review the test entity changes',
            });

            const parsed = JSON.parse(stdout.trim());
            const context = parsed.hookSpecificOutput.additionalContext;
            expect(context).to.include('<wiki_match>');
            expect(context).to.include('</wiki_match>');
            expect(context).to.include('test-entity');
            expect(context).to.include('/wiki-load');
            // A1: softer framing — "possible"/"if relevant"/"skip if coincidental"
            expect(context).to.match(/possible|if relevant/i);
            expect(context).to.match(/skip if|coincidental/i);
            // A1: old compliance demand must NOT be re-emitted
            expect(context).to.not.include('quote one sentence');
            // Evergreen mandate must NOT be re-emitted here (lives in SessionStart)
            expect(context).to.not.include('<wiki_grounding_required>');
        });

        it('should log AMPLIFIER_MATCH to wiki/log.md on match fire (A1 false-positive tuning)', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'amp-log-ent\tamplifier log entity fixture\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'amp-log-ent.md'), '# Amp Log\n');
            const logPath = path.join(fakeRepo, 'wiki', 'log.md');
            const beforeSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

            await runHook('wiki-notify.sh', {
                session_id: 'notify-amp-log-1234',
                cwd: fakeRepo,
                prompt: 'amplifier log entity fixture',
            });

            expect(fs.existsSync(logPath), 'wiki/log.md must exist after amplifier fire').to.be.true;
            const tail = fs.readFileSync(logPath, 'utf8').slice(beforeSize);
            expect(tail).to.include('AMPLIFIER_MATCH');
            expect(tail).to.include('amp-log-ent');
        });

        // Regression guard (G1): if wiki_log were moved out of the MATCH_COUNT>0
        // block, every silent-exit prompt would pollute wiki/log.md. Pin the
        // negative case so that regression is caught.
        it('should NOT log AMPLIFIER_MATCH on silent-exit (no match, no new pages)', async function () {
            const logPath = path.join(fakeRepo, 'wiki', 'log.md');
            const beforeSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-no-amp-log-1234',
                cwd: fakeRepo,
                prompt: 'zzzz unrelated prompt that will not match anything',
            });

            expect(stdout.trim()).to.equal('');
            const afterSize = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
            if (afterSize > beforeSize) {
                const tail = fs.readFileSync(logPath, 'utf8').slice(beforeSize);
                expect(tail).to.not.include('AMPLIFIER_MATCH');
            }
        });

        it('should keep match payload compact (under 400 bytes of additionalContext)', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'compact-test\tcompact test entity matcher\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'compact-test.md'), '# Compact\n');

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-compact-1234',
                cwd: fakeRepo,
                prompt: 'compact test entity',
            });

            const parsed = JSON.parse(stdout.trim());
            const ctxBytes = Buffer.byteLength(parsed.hookSpecificOutput.additionalContext, 'utf8');
            // Old mandate alone was ~860 bytes; new match block should be well under half that.
            expect(ctxBytes).to.be.lessThan(400);
        });

        it('should use canonical hookSpecificOutput schema with hookEventName UserPromptSubmit when emitting', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'schema-test\tschema test entity matcher\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'schema-test.md'), '# Schema\n');

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-schema-1234',
                cwd: fakeRepo,
                prompt: 'schema test entity',
            });

            const parsed = JSON.parse(stdout.trim());
            expect(parsed).to.not.have.property('additionalContext');
            expect(parsed).to.have.nested.property('hookSpecificOutput.additionalContext');
            expect(parsed).to.have.nested.property('hookSpecificOutput.hookEventName', 'UserPromptSubmit');
        });

        it('should exit silently on /wiki-* commands (user already wiki-aware)', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'wiki-cmd-test\twiki cmd test entity\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'wiki-cmd-test.md'), '# Wiki Cmd\n');

            for (const prompt of ['/wiki-load foo', '/wiki-query bar', '/wiki-lint', '/wiki-init', '/wiki-ingest x', '/wiki-process']) {
                const { stdout } = await runHook('wiki-notify.sh', {
                    session_id: 'notify-wiki-cmd-1234',
                    cwd: fakeRepo,
                    prompt,
                });
                expect(stdout.trim(), `prompt=${prompt}`).to.equal('');
            }
        });

        it('should produce a payload under 10000 bytes (Anthropic injected-context cap)', async function () {
            const cacheDir = path.join(fakeRepo, 'wiki', '.cache');
            fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, 'entity-index.tsv'), 'size-test\tsize test entity matcher\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'size-test.md'), '# Size\n');

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: 'notify-size-1234',
                cwd: fakeRepo,
                prompt: 'size test entity',
            });

            const byteSize = Buffer.byteLength(stdout, 'utf8');
            expect(byteSize).to.be.lessThan(10000);
        });

        // Boundary guard (G2): exactly MAX_NEW=10 must NOT trigger the overflow
        // marker (which would emit "…+0 more" and look broken). Pins off-by-one
        // risk in the `NEW_COUNT > MAX_NEW` conditional.
        it('should NOT emit overflow marker when new page count equals MAX_NEW (10)', async function () {
            const sid = 'notify-boundary-1234';
            const shortSid = sid.substring(0, 8);

            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${shortSid}-start`), '');
            await new Promise(r => setTimeout(r, 2000));

            // Exactly 10 → no overflow, no "+0 more"
            for (let i = 1; i <= 10; i++) {
                fs.writeFileSync(
                    path.join(fakeRepo, 'wiki', 'entities', `boundary-ent-${String(i).padStart(2, '0')}.md`),
                    `# Boundary ${i}\n`
                );
            }

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: sid,
                cwd: fakeRepo,
                prompt: 'generic unrelated prompt',
            });

            const parsed = JSON.parse(stdout.trim());
            const display = parsed.systemMessage;
            const context = parsed.hookSpecificOutput.additionalContext;

            expect(display).to.include('10 new');
            // No overflow marker in either surface
            expect(display).to.not.include('…+');
            expect(display).to.not.include('more');
            expect(context).to.not.include('…+');

            const match = context.match(/New wiki pages since last prompt: ([^<]+)\.\s*\/wiki-load/);
            expect(match).to.not.be.null;
            const names = match[1].trim().split(',').map(s => s.trim()).filter(Boolean);
            expect(names.length).to.equal(10);
        });

        // N2: bulk-import sessions can create many new entity pages. Cap listed
        // names at MAX_NEW=10 with an overflow marker so bulk-import sessions don't emit unbounded payloads.
        it('should cap NEW_NAMES at 10 entries with overflow marker when many new pages', async function () {
            const sid = 'notify-overflow-1234';
            const shortSid = sid.substring(0, 8);

            // Session marker (simulates SessionStart). Older than the soon-to-be-created pages.
            fs.writeFileSync(path.join(fakeRepo, 'wiki', `.session-${shortSid}-start`), '');
            await new Promise(r => setTimeout(r, 2000));

            // Create 13 new entity pages → 3 overflow beyond the 10-cap.
            for (let i = 1; i <= 13; i++) {
                fs.writeFileSync(
                    path.join(fakeRepo, 'wiki', 'entities', `overflow-ent-${String(i).padStart(2, '0')}.md`),
                    `# Overflow ${i}\n`
                );
            }

            const { stdout } = await runHook('wiki-notify.sh', {
                session_id: sid,
                cwd: fakeRepo,
                prompt: 'generic unrelated prompt',
            });

            const parsed = JSON.parse(stdout.trim());
            const display = parsed.systemMessage;
            const context = parsed.hookSpecificOutput.additionalContext;

            // Display total reflects real count (13), NOT the truncated-list length.
            expect(display).to.include('13 new');
            // Overflow marker indicates 3 trimmed.
            expect(display).to.include('…+3 more');
            expect(context).to.include('…+3 more');

            // Listed names: exactly 10 comma-separated entries before the overflow marker.
            const match = context.match(/New wiki pages since last prompt: ([^<]+)\.\s*\/wiki-load/);
            expect(match, 'expected <wiki_new_pages> names block to be present').to.not.be.null;
            const listSegment = match[1].split('…')[0].trim().replace(/,\s*$/, '');
            const names = listSegment.split(',').map(s => s.trim()).filter(Boolean);
            expect(names.length).to.equal(10);
        });
    });

    // ================================================================
    // Group 6: wiki_check_deps dependency validation
    // ================================================================
    describe('wiki_check_deps', function () {

        it('should warn on stderr when jq is unavailable', async function () {
            // PATH=/bin includes bash but excludes /usr/bin/jq and /opt/homebrew/bin/jq
            try {
                await runHook('wiki-detect.sh', {
                    cwd: fakeRepo, agent_id: '', session_id: 'deps-test',
                }, { PATH: '/bin' });
                // Hook exited 0 (silent skip) — that's acceptable behavior
            } catch (e) {
                // Hook errored — stderr should contain the warning
                expect(e.stderr || '').to.include('jq not found');
            }
        });

        it('should capture error details in queue entry structure', async function () {
            // Verify the error field can hold actual error text (not just "max retries reached")
            const entry = {
                status: 'failed',
                error: 'authentication failed: invalid API key',
                retry_count: 3,
                failed_at: new Date().toISOString(),
            };
            const queueFile = path.join(fakeQueueDir, 'err-test.json');
            fs.writeFileSync(queueFile, JSON.stringify(entry));
            const parsed = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
            expect(parsed.error).to.not.equal('max retries reached');
            expect(parsed.error).to.equal('authentication failed: invalid API key');
        });

        it('should support last_error field on retryable failures', async function () {
            const entry = {
                status: 'pending',
                retry_count: 1,
                last_error: 'timeout after 120s',
            };
            const queueFile = path.join(fakeQueueDir, 'retry-test.json');
            fs.writeFileSync(queueFile, JSON.stringify(entry));
            const parsed = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
            expect(parsed.last_error).to.equal('timeout after 120s');
            expect(parsed.status).to.equal('pending');
        });
    });

    // ================================================================
    // Group 7: wiki-periodic-extract.sh
    // ================================================================
    describe('wiki-periodic-extract.sh', function () {
        const fakeTranscriptPath = '/tmp/fake-periodic-transcript.jsonl';

        function periodicQueueFiles() {
            return fs.readdirSync(fakeQueueDir).filter(f => f.includes('-periodic-'));
        }

        it('fires and writes a queue entry when WIKI_PERIODIC_MOD=1', async function () {
            await runHook('wiki-periodic-extract.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'periodic-fire-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            const files = periodicQueueFiles();
            expect(files).to.have.lengthOf(1);
        });

        it('never fires when WIKI_PERIODIC_MOD=99999 (50 invocations)', async function () {
            const sid = 'periodic-nofire';
            const invocations = [];
            for (let i = 0; i < 50; i++) {
                invocations.push(runHook('wiki-periodic-extract.sh', {
                    cwd: fakeRepo,
                    agent_id: '',
                    session_id: `${sid}-${i}`,
                    transcript_path: fakeTranscriptPath,
                }, { WIKI_PERIODIC_MOD: '99999' }));
            }
            await Promise.all(invocations);
            expect(periodicQueueFiles()).to.have.lengthOf(0);
        });

        it('exits silently when agent_id is set (subagent guard)', async function () {
            await runHook('wiki-periodic-extract.sh', {
                cwd: fakeRepo,
                agent_id: 'test-agent-id',
                session_id: 'periodic-subagent-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            expect(periodicQueueFiles()).to.have.lengthOf(0);
        });

        it('exits silently for non-wiki repos', async function () {
            const nonWikiRepo = path.join(tmpDir, 'non-wiki-periodic');
            fs.mkdirSync(nonWikiRepo, { recursive: true });
            require('child_process').execSync('git init -q && echo x > f && git add -A && git commit -q -m init', {
                cwd: nonWikiRepo, stdio: 'pipe',
            });

            await runHook('wiki-periodic-extract.sh', {
                cwd: nonWikiRepo,
                agent_id: '',
                session_id: 'periodic-nowiki-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            expect(periodicQueueFiles()).to.have.lengthOf(0);
        });

        it('queue entry has expected schema fields', async function () {
            await runHook('wiki-periodic-extract.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'periodic-schema-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            const files = periodicQueueFiles();
            expect(files).to.have.lengthOf(1);

            const entry = JSON.parse(fs.readFileSync(path.join(fakeQueueDir, files[0]), 'utf-8'));
            expect(entry.status).to.equal('pending');
            expect(entry.type).to.equal('periodic_extract');
            expect(entry.source).to.equal('userpromptsubmit');
            expect(entry.priority).to.equal('normal');
            expect(entry.transcript_path).to.be.a('string').and.not.empty;
            expect(entry.wiki_path).to.be.a('string').and.not.empty;
        });

        it('two consecutive fires produce two distinct queue files', async function () {
            await runHook('wiki-periodic-extract.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'periodic-unique-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            // Sleep > 1s to guarantee different date +%s suffix
            await new Promise(r => setTimeout(r, 1100));

            await runHook('wiki-periodic-extract.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'periodic-unique-1234',
                transcript_path: fakeTranscriptPath,
            }, { WIKI_PERIODIC_MOD: '1' });

            const files = periodicQueueFiles();
            expect(files).to.have.lengthOf(2);
            expect(files[0]).to.not.equal(files[1]);
        });
    });

    // ================================================================
    // Group: wiki-cache-rebuild.sh file-refs.tsv build (PR1)
    // ================================================================
    describe('wiki-cache-rebuild.sh file-refs.tsv', function () {
        const cacheFile = () => path.join(fakeRepo, 'wiki', '.cache', 'file-refs.tsv');

        function readRefs() {
            if (!fs.existsSync(cacheFile())) return {};
            const out = {};
            for (const line of fs.readFileSync(cacheFile(), 'utf-8').split('\n')) {
                if (!line) continue;
                const [p, slugs] = line.split('\t');
                out[p] = slugs;
            }
            return out;
        }

        it('extracts backtick-wrapped paths that exist on disk', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'real.sh'), '#!/bin/bash\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'foo.md'),
                '---\nname: Foo\n---\n# Foo\nReferences `src/real.sh` and `src/imaginary.sh`.\n');

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-basic-1234',
            });

            const refs = readRefs();
            expect(refs['src/real.sh']).to.equal('foo');
            expect(refs['src/imaginary.sh'], 'non-existent paths must be filtered').to.be.undefined;
        });

        it('excludes noise paths (wiki/, .git/, node_modules/, *.lock, *.log, *.tmp)', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'node_modules'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'yarn.lock'), '');
            fs.writeFileSync(path.join(fakeRepo, 'node_modules', 'x.js'), '');
            fs.writeFileSync(path.join(fakeRepo, 'debug.log'), '');
            fs.writeFileSync(path.join(fakeRepo, 'scratch.tmp'), '');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'bar.md'),
                '# Bar\n`node_modules/x.js` `yarn.lock` `debug.log` `scratch.tmp` `wiki/SCHEMA.md`\n');

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-noise-1234',
            });

            const refs = readRefs();
            expect(refs['node_modules/x.js']).to.be.undefined;
            expect(refs['yarn.lock']).to.be.undefined;
            expect(refs['debug.log']).to.be.undefined;
            expect(refs['scratch.tmp']).to.be.undefined;
            expect(refs['wiki/SCHEMA.md']).to.be.undefined;
        });

        it('aggregates multiple entities referencing same path, sorted and comma-joined', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'lib'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'lib', 'shared.js'), '');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'alpha.md'),
                '# Alpha\n`lib/shared.js`\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'bravo.md'),
                '# Bravo\n`lib/shared.js`\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'charlie.md'),
                '# Charlie\n`lib/shared.js`\n');

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-agg-1234',
            });

            const refs = readRefs();
            expect(refs['lib/shared.js']).to.equal('alpha,bravo,charlie');
        });

        it('caps at 5 slugs with ...+N overflow marker', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'lib'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'lib', 'hot.js'), '');
            for (const slug of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) {
                fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', `${slug}.md`),
                    `# ${slug}\n\`lib/hot.js\`\n`);
            }

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-cap-1234',
            });

            const refs = readRefs();
            expect(refs['lib/hot.js']).to.equal('a1,a2,a3,a4,a5...+2');
        });

        it('rewrites fully — deleted wiki pages drop out', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'k.sh'), '');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'keeper.md'),
                '# Keeper\n`src/k.sh`\n');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'goner.md'),
                '# Goner\n`src/k.sh`\n');

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-del-a-1234',
            });
            expect(readRefs()['src/k.sh']).to.equal('goner,keeper');

            // Delete goner.md; remove debounce marker so rebuild runs; rerun
            fs.unlinkSync(path.join(fakeRepo, 'wiki', 'entities', 'goner.md'));
            const debounce = path.join(fakeRepo, 'wiki', '.cache', 'last-rebuild');
            if (fs.existsSync(debounce)) fs.unlinkSync(debounce);

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-del-b-1234',
            });
            expect(readRefs()['src/k.sh']).to.equal('keeper');
        });

        it('extracts paths from frontmatter sources: inline list', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'docs'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'docs', 'guide.md'), '');
            fs.writeFileSync(path.join(fakeRepo, 'wiki', 'entities', 'quux.md'),
                '---\nname: Quux\nsources: [docs/guide.md, other-slug]\n---\n# Quux\n');

            await runHook('wiki-cache-rebuild.sh', {
                cwd: fakeRepo, agent_id: '', session_id: 'refs-fm-1234',
            });

            const refs = readRefs();
            expect(refs['docs/guide.md']).to.equal('quux');
            // other-slug is not a path (no /), must be excluded
            expect(refs['other-slug']).to.be.undefined;
        });
    });

    // ================================================================
    // Group: wiki-read-gate.sh PreToolUse:Read hint injector (PR2)
    // ================================================================
    describe('wiki-read-gate.sh PreToolUse:Read', function () {
        const cacheDir = () => path.join(fakeRepo, 'wiki', '.cache');
        const refsFile = () => path.join(cacheDir(), 'file-refs.tsv');

        function seedCache(rows) {
            fs.mkdirSync(cacheDir(), { recursive: true });
            const body = rows.map(([p, slugs]) => `${p}\t${slugs}`).join('\n') + '\n';
            fs.writeFileSync(refsFile(), body);
        }

        function parseHookOutput(stdout) {
            if (!stdout.trim()) return null;
            return JSON.parse(stdout);
        }

        it('emits canonical PreToolUse allow+additionalContext when file is in cache', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'hit.sh'), '');
            seedCache([['src/hit.sh', 'alpha,bravo']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-hit-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'src', 'hit.sh') },
            });

            const out = parseHookOutput(stdout);
            expect(out).to.have.nested.property('hookSpecificOutput.hookEventName', 'PreToolUse');
            expect(out).to.have.nested.property('hookSpecificOutput.permissionDecision', 'allow');
            const ctx = out.hookSpecificOutput.additionalContext;
            expect(ctx).to.include('wiki hint:');
            expect(ctx).to.include('src/hit.sh');
            expect(ctx).to.include('alpha,bravo');
            expect(ctx).to.include('/wiki-load alpha');
            expect(ctx.length).to.be.at.most(200);
        });

        it('exits silently (no output) when file is not in cache', async function () {
            fs.writeFileSync(path.join(fakeRepo, 'README.md'), '# readme\n');
            seedCache([['src/something-else.sh', 'foo']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-miss-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'README.md') },
            });

            expect(stdout.trim()).to.equal('');
        });

        it('exits silently when file is outside REPO_ROOT', async function () {
            seedCache([['src/hit.sh', 'alpha']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-outside-1234',
                tool_name: 'Read',
                tool_input: { file_path: '/tmp/not-in-repo.txt' },
            });

            expect(stdout.trim()).to.equal('');
        });

        it('exits silently for noise paths (wiki/, .cache/, *.lock)', async function () {
            fs.writeFileSync(path.join(fakeRepo, 'yarn.lock'), '');
            // Even if the cache has a bogus row for a noise path, the fast-path filter should win.
            seedCache([['yarn.lock', 'alpha'], ['wiki/SCHEMA.md', 'bravo']]);

            for (const p of ['yarn.lock', 'wiki/SCHEMA.md']) {
                const { stdout } = await runHook('wiki-read-gate.sh', {
                    cwd: fakeRepo,
                    agent_id: '',
                    session_id: 'gate-noise-1234',
                    tool_name: 'Read',
                    tool_input: { file_path: path.join(fakeRepo, p) },
                });
                expect(stdout.trim(), `noise path ${p} must be filtered`).to.equal('');
            }
        });

        it('kill switch WIKI_READ_GATE=0 exits immediately', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'hit.sh'), '');
            seedCache([['src/hit.sh', 'alpha']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-kill-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'src', 'hit.sh') },
            }, { WIKI_READ_GATE: '0' });

            expect(stdout.trim()).to.equal('');
        });

        it('fails open on corrupt cache file (no crash, no output)', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'hit.sh'), '');
            fs.mkdirSync(cacheDir(), { recursive: true });
            // Binary garbage — must not crash the hook
            fs.writeFileSync(refsFile(), Buffer.from([0x00, 0xff, 0x00, 0xff, 0x0a]));

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-corrupt-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'src', 'hit.sh') },
            });

            // Corrupt file with no matching row → exit 0 silently
            expect(stdout.trim()).to.equal('');
        });

        it('strips overflow marker from first slug when composing /wiki-load suggestion', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'lib'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'lib', 'hot.js'), '');
            // First slug itself carries the overflow marker (synthetic edge case)
            seedCache([['lib/hot.js', 'a1,a2,a3,a4,a5...+3']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-ovf-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'lib', 'hot.js') },
            });

            const out = parseHookOutput(stdout);
            expect(out.hookSpecificOutput.additionalContext).to.include('/wiki-load a1');
            // Full slug list preserved in the hint body
            expect(out.hookSpecificOutput.additionalContext).to.include('a1,a2,a3,a4,a5...+3');
        });

        it('appends one READ_GATE entry to wiki/log.md on hit', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'hit.sh'), '');
            seedCache([['src/hit.sh', 'alpha']]);
            const before = fs.readFileSync(path.join(fakeRepo, 'wiki', 'log.md'), 'utf-8').split('\n').length;

            await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: '',
                session_id: 'gate-log-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'src', 'hit.sh') },
            });

            const log = fs.readFileSync(path.join(fakeRepo, 'wiki', 'log.md'), 'utf-8');
            const after = log.split('\n').length;
            expect(after).to.be.greaterThan(before);
            expect(log).to.include('READ_GATE');
            expect(log).to.include('path:src/hit.sh');
            expect(log).to.include('slugs:alpha');
        });

        it('exits silently when AGENT_ID is set (subagent Read)', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'src', 'hit.sh'), '');
            seedCache([['src/hit.sh', 'alpha']]);

            const { stdout } = await runHook('wiki-read-gate.sh', {
                cwd: fakeRepo,
                agent_id: 'sub-agent-123',
                session_id: 'gate-subagent-1234',
                tool_name: 'Read',
                tool_input: { file_path: path.join(fakeRepo, 'src', 'hit.sh') },
            });

            expect(stdout.trim()).to.equal('');
        });
    });
});
