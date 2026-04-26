const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execAsync = util.promisify(exec);

const MERGE_HOOKS = path.join(__dirname, '..', 'tools', 'merge-hooks.sh');
const MODEL_ROUTER_PLUGIN = path.join(__dirname, '..', 'plugins', 'model-router');
const CRAFT_HOOKS_PLUGIN = path.join(__dirname, '..', 'plugins', 'craft-hooks');
const WIKI_HOOKS_PLUGIN = path.join(__dirname, '..', 'plugins', 'wiki-hooks');

describe('Merge Hooks', function () {
    this.timeout(15000);

    let tmpDir;
    let claudeDir;
    let settingsFile;
    let pluginsDir;

    // Sample plugin hooks.json with async, timeout, and matcher fields
    const sampleHooks = {
        hooks: {
            SessionStart: [{
                matcher: '*',
                hooks: [
                    { type: 'command', command: '${CLAUDE_PLUGIN_ROOT}/handlers/fast.sh', async: true, timeout: 3 },
                    { type: 'command', command: '${CLAUDE_PLUGIN_ROOT}/handlers/slow.sh', async: true, timeout: 120 }
                ]
            }],
            PreToolUse: [{
                matcher: 'Agent',
                hooks: [
                    { type: 'command', command: '${CLAUDE_PLUGIN_ROOT}/handlers/guard.sh', timeout: 5 }
                ]
            }]
        }
    };

    beforeEach(function () {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-hooks-test-'));
        claudeDir = path.join(tmpDir, '.claude');
        settingsFile = path.join(claudeDir, 'settings.json');
        pluginsDir = path.join(claudeDir, 'plugins');

        fs.mkdirSync(pluginsDir, { recursive: true });

        // Create a fake plugin directory and symlink it
        const pluginSource = path.join(tmpDir, 'test-plugin');
        fs.mkdirSync(path.join(pluginSource, 'hooks'), { recursive: true });
        fs.mkdirSync(path.join(pluginSource, 'handlers'), { recursive: true });
        fs.writeFileSync(path.join(pluginSource, 'hooks', 'hooks.json'), JSON.stringify(sampleHooks, null, 2));
        fs.symlinkSync(pluginSource, path.join(pluginsDir, 'test-plugin'));

        // Minimal settings.json
        fs.writeFileSync(settingsFile, JSON.stringify({ hooks: {} }, null, 2));
    });

    afterEach(function () {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function runMerge(args = '') {
        return execAsync(`bash "${MERGE_HOOKS}" ${args}`, {
            env: { ...process.env, CLAUDE_DIR: claudeDir },
            timeout: 10000,
        });
    }

    function readSettings() {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }

    describe('field preservation', function () {
        it('should preserve async field on merged hooks', async function () {
            await runMerge();
            const settings = readSettings();
            const sessionHooks = settings.hooks.SessionStart;
            const pluginGroup = sessionHooks.find(g =>
                g.hooks.some(h => h.command && h.command.includes('test-plugin'))
            );
            expect(pluginGroup).to.exist;
            const fastHook = pluginGroup.hooks.find(h => h.command.includes('fast.sh'));
            expect(fastHook.async).to.equal(true);
            const slowHook = pluginGroup.hooks.find(h => h.command.includes('slow.sh'));
            expect(slowHook.async).to.equal(true);
        });

        it('should preserve timeout field on merged hooks', async function () {
            await runMerge();
            const settings = readSettings();
            const sessionHooks = settings.hooks.SessionStart;
            const pluginGroup = sessionHooks.find(g =>
                g.hooks.some(h => h.command && h.command.includes('test-plugin'))
            );
            const fastHook = pluginGroup.hooks.find(h => h.command.includes('fast.sh'));
            expect(fastHook.timeout).to.equal(3);
            const slowHook = pluginGroup.hooks.find(h => h.command.includes('slow.sh'));
            expect(slowHook.timeout).to.equal(120);
        });

        it('should preserve matcher field on merged hooks', async function () {
            await runMerge();
            const settings = readSettings();
            const preToolHooks = settings.hooks.PreToolUse;
            const agentGroup = preToolHooks.find(g => g.matcher === 'Agent');
            expect(agentGroup).to.exist;
            expect(agentGroup.hooks[0].timeout).to.equal(5);
        });

        it('should resolve CLAUDE_PLUGIN_ROOT in command paths', async function () {
            await runMerge();
            const settings = readSettings();
            const sessionHooks = settings.hooks.SessionStart;
            const pluginGroup = sessionHooks.find(g =>
                g.hooks.some(h => h.command && h.command.includes('test-plugin'))
            );
            expect(pluginGroup.hooks[0].command).to.include('~/.claude/plugins/test-plugin/handlers/');
            expect(pluginGroup.hooks[0].command).to.not.include('${CLAUDE_PLUGIN_ROOT}');
        });
    });

    describe('--unmerge', function () {
        it('should remove all plugin hooks', async function () {
            await runMerge();
            let settings = readSettings();
            expect(settings.hooks.SessionStart).to.have.length.greaterThan(0);

            await runMerge('--unmerge');
            settings = readSettings();
            // All plugin hooks should be gone
            const allHookArrays = Object.values(settings.hooks);
            for (const groups of allHookArrays) {
                for (const group of groups) {
                    for (const hook of (group.hooks || [])) {
                        expect(hook.command || '').to.not.include('~/.claude/plugins/');
                    }
                }
            }
        });
    });

    describe('--dry-run', function () {
        it('should not modify settings.json', async function () {
            const before = fs.readFileSync(settingsFile, 'utf8');
            await runMerge('--dry-run');
            const after = fs.readFileSync(settingsFile, 'utf8');
            expect(after).to.equal(before);
        });
    });

    describe('idempotency', function () {
        it('should produce identical output when run twice', async function () {
            await runMerge();
            const first = fs.readFileSync(settingsFile, 'utf8');
            await runMerge();
            const second = fs.readFileSync(settingsFile, 'utf8');
            expect(second).to.equal(first);
        });
    });

    describe('error handling', function () {
        it('should fail when a plugin has malformed hooks.json', async function () {
            const brokenPlugin = path.join(tmpDir, 'broken-plugin');
            fs.mkdirSync(path.join(brokenPlugin, 'hooks'), { recursive: true });
            fs.writeFileSync(path.join(brokenPlugin, 'hooks', 'hooks.json'), '{invalid json');
            fs.symlinkSync(brokenPlugin, path.join(pluginsDir, 'broken-plugin'));

            // merge-hooks.sh has set -eo pipefail — jq failure on malformed JSON
            // causes the script to exit before the skip-guard can catch it
            try {
                await runMerge();
                expect.fail('Expected merge to fail with malformed hooks.json');
            } catch (err) {
                expect(err.code).to.not.equal(0);
            }
        });
    });

    describe('preserves non-plugin hooks', function () {
        it('should keep existing non-plugin hooks intact', async function () {
            const manualHook = {
                hooks: {
                    SessionStart: [{
                        matcher: '',
                        hooks: [{ type: 'command', command: 'echo hello' }]
                    }]
                }
            };
            fs.writeFileSync(settingsFile, JSON.stringify(manualHook, null, 2));

            await runMerge();
            const settings = readSettings();
            // Manual hook should still be there
            const manualGroup = settings.hooks.SessionStart.find(g =>
                g.hooks.some(h => h.command === 'echo hello')
            );
            expect(manualGroup).to.exist;
            // Plugin hooks should also be there
            const pluginGroup = settings.hooks.SessionStart.find(g =>
                g.hooks.some(h => h.command && h.command.includes('test-plugin'))
            );
            expect(pluginGroup).to.exist;
        });
    });

    describe('model-router convergence', function () {
        // model-router was superseded by the c-thru repo; the plugin no longer ships with claude-craft.
        before(function () {
            if (!fs.existsSync(MODEL_ROUTER_PLUGIN)) this.skip();
        });

        it('replaces old SessionStart model-router hooks with the current actionable hook set', async function () {
            fs.rmSync(path.join(pluginsDir, 'test-plugin'), { recursive: true, force: true });
            fs.symlinkSync(MODEL_ROUTER_PLUGIN, path.join(pluginsDir, 'model-router'));

            fs.writeFileSync(settingsFile, JSON.stringify({
                hooks: {
                    SessionStart: [{
                        matcher: '*',
                        hooks: [{
                            type: 'command',
                            command: '~/.claude/plugins/model-router/handlers/session-model-capture.sh',
                            timeout: 5,
                        }],
                    }],
                },
            }, null, 2));

            await runMerge();
            const settings = readSettings();

            expect(settings.hooks.SessionStart || []).to.deep.equal([]);

            const preToolHooks = settings.hooks.PreToolUse || [];
            const pluginGroup = preToolHooks.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/model-router/handlers/model-router.sh')
            );
            expect(pluginGroup).to.exist;
            expect(pluginGroup.matcher).to.equal('*');

            const permissionHooks = settings.hooks.PermissionRequest || [];
            const permissionGroup = permissionHooks.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/model-router/handlers/model-router.sh')
            );
            expect(permissionGroup).to.exist;
            expect(permissionGroup.matcher).to.equal('*');
        });
    });

    describe('craft-hooks and wiki-hooks coexistence', function () {
        it('keeps craft-hooks and wiki-hooks in separate matcher-groups on shared events', async function () {
            fs.rmSync(path.join(pluginsDir, 'test-plugin'), { recursive: true, force: true });
            fs.symlinkSync(CRAFT_HOOKS_PLUGIN, path.join(pluginsDir, 'craft-hooks'));
            fs.symlinkSync(WIKI_HOOKS_PLUGIN, path.join(pluginsDir, 'wiki-hooks'));

            await runMerge();
            const settings = readSettings();

            const sessionGroups = settings.hooks.SessionStart || [];
            const craftSession = sessionGroups.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/craft-hooks/handlers/proxy-health-session.sh')
            );
            const wikiSession = sessionGroups.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/wiki-hooks/handlers/wiki-detect.sh')
            );

            expect(craftSession).to.exist;
            expect(wikiSession).to.exist;
            expect(craftSession).to.not.equal(wikiSession);
            expect((craftSession.hooks || []).some(h => (h.command || '').includes('/wiki-hooks/'))).to.equal(false);
            expect((wikiSession.hooks || []).some(h => (h.command || '').includes('/craft-hooks/'))).to.equal(false);

            const promptGroups = settings.hooks.UserPromptSubmit || [];
            const craftPrompt = promptGroups.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/craft-hooks/handlers/proxy-health-notify.sh')
            );
            const wikiPrompt = promptGroups.find(g =>
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/wiki-hooks/handlers/wiki-notify.sh')
            );

            expect(craftPrompt).to.exist;
            expect(wikiPrompt).to.exist;
            expect(craftPrompt).to.not.equal(wikiPrompt);
            expect((craftPrompt.hooks || []).some(h => (h.command || '').includes('/wiki-hooks/'))).to.equal(false);
            expect((wikiPrompt.hooks || []).some(h => (h.command || '').includes('/craft-hooks/'))).to.equal(false);
        });

        it('preserves wiki-specific matchers while still merging craft-hooks on the same events', async function () {
            fs.rmSync(path.join(pluginsDir, 'test-plugin'), { recursive: true, force: true });
            fs.symlinkSync(CRAFT_HOOKS_PLUGIN, path.join(pluginsDir, 'craft-hooks'));
            fs.symlinkSync(WIKI_HOOKS_PLUGIN, path.join(pluginsDir, 'wiki-hooks'));

            await runMerge();
            const settings = readSettings();

            const sessionGroups = settings.hooks.SessionStart || [];
            const clearGroup = sessionGroups.find(g =>
                g.matcher === 'clear' &&
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/wiki-hooks/handlers/wiki-clear.sh')
            );
            const wildcardCraft = sessionGroups.find(g =>
                g.matcher === '*' &&
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/craft-hooks/handlers/proxy-health-session.sh')
            );
            const wildcardWiki = sessionGroups.find(g =>
                g.matcher === '*' &&
                (g.hooks || []).some(h => h.command === '~/.claude/plugins/wiki-hooks/handlers/wiki-detect.sh')
            );

            expect(clearGroup).to.exist;
            expect(wildcardCraft).to.exist;
            expect(wildcardWiki).to.exist;
            expect(wildcardCraft).to.not.equal(wildcardWiki);
        });
    });
});
