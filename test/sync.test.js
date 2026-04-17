const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

describe('Sync Status Tests', function () {
    this.timeout(15000);

    const syncScript = path.join(__dirname, '..', 'tools', 'sync-status.sh');
    const repoDir = path.join(__dirname, '..');

    // Create isolated temp directories for each test
    let tmpDir;
    let fakeRepo;
    let fakeClaudeDir;

    beforeEach(function () {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-craft-test-'));
        fakeRepo = path.join(tmpDir, 'repo');
        fakeClaudeDir = path.join(tmpDir, 'claude');

        // Create fake repo structure with all 6 types
        const dirs = [
            'agents', 'commands', 'skills/my-skill', 'prompts',
            'references', 'plugins/my-plugin'
        ];
        for (const d of dirs) {
            fs.mkdirSync(path.join(fakeRepo, d), { recursive: true });
        }

        // Create fake .git directory so repo discovery works
        fs.mkdirSync(path.join(fakeRepo, '.git'));

        // Create sample files
        fs.writeFileSync(path.join(fakeRepo, 'agents', 'test-agent.md'), '# Test Agent\n');
        fs.writeFileSync(path.join(fakeRepo, 'commands', 'test-cmd.md'), '# Test Cmd\n');
        fs.writeFileSync(path.join(fakeRepo, 'prompts', 'sample-prompt.md'), '# Test Prompt\n');
        fs.writeFileSync(path.join(fakeRepo, 'references', 'test-ref.md'), '# Test Ref\n');
        fs.writeFileSync(path.join(fakeRepo, 'skills', 'my-skill', 'SKILL.md'), '# My Skill\n');
        fs.writeFileSync(path.join(fakeRepo, 'plugins', 'my-plugin', 'plugin.json'), '{}\n');

        // Create legacy/test files that should be skipped
        fs.writeFileSync(path.join(fakeRepo, 'prompts', 'old-do-not-use-legacy.md'), '# Legacy\n');
        fs.writeFileSync(path.join(fakeRepo, 'prompts', 'test-something.md'), '# Test\n');

        // Create global command files that should be skipped during sync
        fs.writeFileSync(path.join(fakeRepo, 'commands', 'alias.md'), '# Alias\n');
        fs.writeFileSync(path.join(fakeRepo, 'commands', 'unalias.md'), '# Unalias\n');

        // Create fake claude directory
        fs.mkdirSync(fakeClaudeDir, { recursive: true });
    });

    afterEach(function () {
        // Recursive delete
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function runSync(action, extraEnv) {
        const env = {
            ...process.env,
            CLAUDE_DIR: fakeClaudeDir,
            REPO_DIR: fakeRepo,
            ...extraEnv
        };
        return execAsync(`bash "${syncScript}" ${action} --repo "${fakeRepo}"`, { env });
    }

    describe('Script Validation', function () {
        it('should exist and be executable', function () {
            expect(fs.existsSync(syncScript)).to.be.true;
            const stats = fs.statSync(syncScript);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });

        it('should pass bash syntax check', async function () {
            await execAsync(`bash -n "${syncScript}"`);
        });
    });

    describe('Sync Action', function () {
        it('should create symlinks for all 6 extension types with correct targets', async function () {
            await runSync('sync');

            // Check file-based types: verify symlink exists AND points to correct target
            const fileChecks = [
                ['agents', 'test-agent.md', 'agents'],
                ['commands', 'test-cmd.md', 'commands'],
                ['prompts', 'sample-prompt.md', 'prompts'],
                ['references', 'test-ref.md', 'references'],
            ];
            for (const [claudeSub, filename, repoSub] of fileChecks) {
                const linkPath = path.join(fakeClaudeDir, claudeSub, filename);
                expect(fs.lstatSync(linkPath).isSymbolicLink()).to.be.true;
                const target = fs.readlinkSync(linkPath);
                expect(target).to.equal(path.join(fakeRepo, repoSub, filename));
            }

            // Check directory-based types: verify symlink exists AND points to correct target
            const dirChecks = [
                ['skills', 'my-skill'],
                ['plugins', 'my-plugin'],
            ];
            for (const [claudeSub, dirname] of dirChecks) {
                const linkPath = path.join(fakeClaudeDir, claudeSub, dirname);
                expect(fs.lstatSync(linkPath).isSymbolicLink()).to.be.true;
                const target = fs.readlinkSync(linkPath);
                expect(target).to.equal(path.join(fakeRepo, claudeSub, dirname));
            }
        });

        it('should skip old-do-not-use-* and test-* prompts', async function () {
            await runSync('sync');

            expect(fs.existsSync(path.join(fakeClaudeDir, 'prompts', 'old-do-not-use-legacy.md'))).to.be.false;
            expect(fs.existsSync(path.join(fakeClaudeDir, 'prompts', 'test-something.md'))).to.be.false;
            expect(fs.existsSync(path.join(fakeClaudeDir, 'prompts', 'sample-prompt.md'))).to.be.true;
        });

        it('should skip global commands (alias, unalias)', async function () {
            await runSync('sync');

            // These should NOT be symlinked (they're copied by install.sh separately)
            const aliasPath = path.join(fakeClaudeDir, 'commands', 'alias.md');
            const unaliasPath = path.join(fakeClaudeDir, 'commands', 'unalias.md');

            // They shouldn't exist at all since sync skips them
            // (install.sh copies them separately, but sync-status.sh doesn't)
            expect(fs.existsSync(aliasPath)).to.be.false;
            expect(fs.existsSync(unaliasPath)).to.be.false;
        });

        it('should not overwrite existing local-only files', async function () {
            // Create a local-only agent before sync
            fs.mkdirSync(path.join(fakeClaudeDir, 'agents'), { recursive: true });
            fs.writeFileSync(path.join(fakeClaudeDir, 'agents', 'local-agent.md'), '# Local\n');

            await runSync('sync');

            // Local file should still exist and not be a symlink
            const localAgent = path.join(fakeClaudeDir, 'agents', 'local-agent.md');
            expect(fs.existsSync(localAgent)).to.be.true;
            expect(fs.lstatSync(localAgent).isSymbolicLink()).to.be.false;
        });

        it('should not recurse into subdirectories for file types', async function () {
            // Create a nested .md file that should NOT be picked up
            fs.mkdirSync(path.join(fakeRepo, 'agents', 'nested'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'agents', 'nested', 'deep.md'), '# Deep\n');

            await runSync('sync');

            // The nested file should not appear in claude dir
            expect(fs.existsSync(path.join(fakeClaudeDir, 'agents', 'deep.md'))).to.be.false;
        });

        it('should be idempotent (running sync twice produces same result)', async function () {
            await runSync('sync');

            // Collect state after first sync
            const agentLink1 = fs.readlinkSync(path.join(fakeClaudeDir, 'agents', 'test-agent.md'));
            const skillLink1 = fs.readlinkSync(path.join(fakeClaudeDir, 'skills', 'my-skill'));

            await runSync('sync');

            // Verify same state after second sync
            const agentLink2 = fs.readlinkSync(path.join(fakeClaudeDir, 'agents', 'test-agent.md'));
            const skillLink2 = fs.readlinkSync(path.join(fakeClaudeDir, 'skills', 'my-skill'));

            expect(agentLink1).to.equal(agentLink2);
            expect(skillLink1).to.equal(skillLink2);

            // No nested symlinks created inside directory types (ln -sfn prevents this)
            const skillContents = fs.readdirSync(path.join(fakeClaudeDir, 'skills'));
            expect(skillContents).to.deep.equal(['my-skill']);
        });

        it('should skip hidden directories for dir-based types', async function () {
            fs.mkdirSync(path.join(fakeRepo, 'skills', '.hidden-skill'), { recursive: true });
            fs.writeFileSync(path.join(fakeRepo, 'skills', '.hidden-skill', 'SKILL.md'), '# Hidden\n');

            await runSync('sync');

            expect(fs.existsSync(path.join(fakeClaudeDir, 'skills', '.hidden-skill'))).to.be.false;
        });
    });

    describe('Status Action', function () {
        it('should show all 6 extension types with registration counts', async function () {
            const { stdout } = await runSync('status');

            // Verify each type appears with "registered" count format
            expect(stdout).to.match(/agents\s+\d+ registered/);
            expect(stdout).to.match(/commands\s+\d+ registered/);
            expect(stdout).to.match(/skills\s+\d+ registered/);
            expect(stdout).to.match(/prompts\s+\d+ registered/);
            expect(stdout).to.match(/references\s+\d+ registered/);
            expect(stdout).to.match(/plugins\s+\d+ registered/);
        });

        it('should show available count when items are not synced', async function () {
            const { stdout } = await runSync('status');
            // Should show "N available" for at least one type
            expect(stdout).to.match(/\d+ available/);
        });

        it('should show 0 available after sync', async function () {
            await runSync('sync');
            const { stdout } = await runSync('status');
            expect(stdout).to.include('All items are in sync');
        });
    });

    describe('Add Action', function () {
        it('should list repo items not in claude dir', async function () {
            const { stdout } = await runSync('add');
            expect(stdout).to.include('test-agent.md');
            expect(stdout).to.include('sample-prompt.md');
        });

        it('should not list skipped prompts', async function () {
            const { stdout } = await runSync('add');
            expect(stdout).to.not.include('old-do-not-use-legacy');
            expect(stdout).to.not.include('test-something');
        });

        it('should show nothing after full sync', async function () {
            await runSync('sync');
            const { stdout } = await runSync('add');
            expect(stdout).to.include('all repo items are installed');
        });
    });

    describe('Publish Action', function () {
        it('should list local-only items', async function () {
            // Create a local-only agent
            fs.mkdirSync(path.join(fakeClaudeDir, 'agents'), { recursive: true });
            fs.writeFileSync(path.join(fakeClaudeDir, 'agents', 'my-custom.md'), '# Custom\n');

            const { stdout } = await runSync('publish');
            expect(stdout).to.include('my-custom.md');
        });

        it('should not list repo-symlinked items', async function () {
            await runSync('sync');

            // Add a local-only item
            fs.writeFileSync(path.join(fakeClaudeDir, 'agents', 'local.md'), '# Local\n');

            const { stdout } = await runSync('publish');
            expect(stdout).to.not.include('test-agent.md');
            expect(stdout).to.include('local.md');
        });
    });

    describe('Error Handling', function () {
        it('should exit 2 for invalid action', async function () {
            try {
                await runSync('invalid-action');
                expect.fail('should have thrown');
            } catch (err) {
                expect(err.code).to.equal(2);
                expect(err.stderr || err.stdout).to.include('Unknown');
            }
        });

        it('should exit 1 when repo not found', async function () {
            try {
                // Override HOME to prevent discover_repo from finding real repo
                const env = { ...process.env, CLAUDE_DIR: fakeClaudeDir, HOME: tmpDir, REPO_DIR: '' };
                await execAsync(`bash "${syncScript}" status --repo /nonexistent/path`, { env, cwd: tmpDir });
                expect.fail('should have thrown');
            } catch (err) {
                expect(err.code).to.equal(1);
                expect(err.stderr).to.include('Repository not found');
            }
        });

        it('should exit 2 when --repo has no value', async function () {
            try {
                const env = { ...process.env, CLAUDE_DIR: fakeClaudeDir, REPO_DIR: fakeRepo };
                await execAsync(`bash "${syncScript}" status --repo`, { env });
                expect.fail('should have thrown');
            } catch (err) {
                expect(err.code).to.equal(2);
            }
        });
    });

    describe('install.sh Validation', function () {
        const installScript = path.join(__dirname, '..', 'install.sh');

        it('should pass bash syntax check', async function () {
            await execAsync(`bash -n "${installScript}"`);
        });

        it('should not contain safe_merge_configs', function () {
            const content = fs.readFileSync(installScript, 'utf8');
            expect(content).to.not.include('safe_merge_configs');
        });

        it('should use sync-status.sh for syncing', function () {
            const content = fs.readFileSync(installScript, 'utf8');
            expect(content).to.include('sync-status.sh');
        });

        it('should use git pull for updates instead of clone', function () {
            const content = fs.readFileSync(installScript, 'utf8');
            expect(content).to.include('pull --ff-only');
            expect(content).to.include('Existing installation found');
        });

        it('should not contain register_hooks (hooks are now plugin-based)', function () {
            const content = fs.readFileSync(installScript, 'utf8');
            expect(content).to.not.include('register_hooks');
        });

        it('should use jq gracefully (skip if not available)', function () {
            const content = fs.readFileSync(installScript, 'utf8');
            // install.sh uses jq for hook installation but skips gracefully if jq is missing
            expect(content).to.include('jq');
            expect(content).to.include('jq not found');
        });
    });

    describe('craft-hooks Plugin', function () {
        const pluginDir = path.join(__dirname, '..', 'plugins', 'craft-hooks');

        it('should have valid plugin.json', function () {
            const pluginJson = path.join(pluginDir, '.claude-plugin', 'plugin.json');
            expect(fs.existsSync(pluginJson)).to.be.true;
            const parsed = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
            expect(parsed).to.have.property('name', 'craft-hooks');
            expect(parsed).to.have.property('version');
        });

        it('should have hooks.json with UserPromptSubmit', function () {
            const hooksJson = path.join(pluginDir, 'hooks', 'hooks.json');
            expect(fs.existsSync(hooksJson)).to.be.true;
            const manifest = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
            expect(manifest.hooks).to.have.property('UserPromptSubmit');
        });

        it('should use ${CLAUDE_PLUGIN_ROOT} paths in hooks.json', function () {
            const hooksJson = path.join(pluginDir, 'hooks', 'hooks.json');
            const content = fs.readFileSync(hooksJson, 'utf8');
            expect(content).to.include('${CLAUDE_PLUGIN_ROOT}');
            expect(content).to.not.include('~/.claude/hooks/');
        });

        it('should have handler scripts that exist', function () {
            const hooksJson = path.join(pluginDir, 'hooks', 'hooks.json');
            const manifest = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));

            for (const event of Object.keys(manifest.hooks)) {
                for (const matcherGroup of manifest.hooks[event]) {
                    for (const hook of matcherGroup.hooks) {
                        // Extract script name from ${CLAUDE_PLUGIN_ROOT}/handlers/foo.sh
                        const scriptName = path.basename(hook.command);
                        const handlerPath = path.join(pluginDir, 'handlers', scriptName);
                        expect(
                            fs.existsSync(handlerPath),
                            `Handler ${scriptName} should exist in plugins/craft-hooks/handlers/`
                        ).to.be.true;
                    }
                }
            }
        });

        it('should have all handler scripts', function () {
            const handlersDir = path.join(pluginDir, 'handlers');
            const scripts = fs.readdirSync(handlersDir).filter(f => f.endsWith('.sh'));
            expect(scripts).to.have.length(6);
            expect(scripts).to.include('prompt-sync-check.sh');
            expect(scripts).to.include('check-skills-changed.sh');
            expect(scripts).to.include('memo-cleanup.sh');
            expect(scripts).to.include('proxy-health-common.sh');
            expect(scripts).to.include('proxy-health-session.sh');
            expect(scripts).to.include('proxy-health-notify.sh');
        });
    });

    describe('uninstall.sh Validation', function () {
        const uninstallScript = path.join(__dirname, '..', 'uninstall.sh');

        it('should pass bash syntax check', async function () {
            await execAsync(`bash -n "${uninstallScript}"`);
        });

        it('should enumerate extension types in removal plan', function () {
            const content = fs.readFileSync(uninstallScript, 'utf8');
            expect(content).to.include('skills');
            expect(content).to.include('prompts');
            expect(content).to.include('references');
        });
    });
});
