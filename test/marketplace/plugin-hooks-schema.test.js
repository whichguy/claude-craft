const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Validates plugins/<name>/hooks/hooks.json schema and resolves every
// hook command path to an existing file.
//
// Schema:
//   { "hooks": { "<EventName>": [ { "matcher": "...", "hooks": [
//       { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/handlers/x.sh", "timeout": N, "async": true|false }
//   ] } ] } }
//
// Catches:
//   - Renamed handler scripts that hooks.json wasn't updated to follow
//   - Typos in handler paths (e.g. "handles/" instead of "handlers/")
//   - Missing required fields (type, command)
//   - Invalid event names

const REPO_ROOT = path.resolve(__dirname, '../..');

// Claude Code's documented hook event names.
const VALID_EVENTS = new Set([
    'SessionStart', 'SessionEnd', 'UserPromptSubmit',
    'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop',
    'Notification', 'PermissionRequest', 'SubagentStop',
]);

function listPluginHooksFiles() {
    const out = [];
    const pluginsDir = path.join(REPO_ROOT, 'plugins');
    if (!fs.existsSync(pluginsDir)) return out;
    for (const plugin of fs.readdirSync(pluginsDir)) {
        const hooksJson = path.join(pluginsDir, plugin, 'hooks', 'hooks.json');
        if (fs.existsSync(hooksJson)) {
            out.push({ plugin, hooksJson, pluginRoot: path.join(pluginsDir, plugin) });
        }
    }
    return out;
}

function resolveCommandPath(command, pluginRoot) {
    // Replace ${CLAUDE_PLUGIN_ROOT} with the actual plugin directory.
    return command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
}

describe('plugin hooks.json: schema + handler path resolution', function () {
    const files = listPluginHooksFiles();

    it('every hooks.json parses as valid JSON', function () {
        const broken = [];
        for (const { plugin, hooksJson } of files) {
            try {
                JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
            } catch (err) {
                broken.push(`${plugin}: ${err.message}`);
            }
        }
        expect(broken, `Malformed hooks.json files: ${broken.join('; ')}`).to.deep.equal([]);
    });

    it('every event name in hooks.json is a valid Claude Code event', function () {
        const violations = [];
        for (const { plugin, hooksJson } of files) {
            const data = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
            for (const evt of Object.keys(data.hooks || {})) {
                if (!VALID_EVENTS.has(evt)) {
                    violations.push(`${plugin}: "${evt}"`);
                }
            }
        }
        expect(violations, `Unknown hook event names — typo? Or new Claude Code event not in VALID_EVENTS: ${violations.join(', ')}`).to.deep.equal([]);
    });

    it('every hook entry has required fields (type, command)', function () {
        const violations = [];
        for (const { plugin, hooksJson } of files) {
            const data = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
            for (const [evt, groups] of Object.entries(data.hooks || {})) {
                for (const g of groups) {
                    for (const h of g.hooks || []) {
                        if (h.type !== 'command') {
                            violations.push(`${plugin}/${evt}: type="${h.type}" (only "command" supported)`);
                        }
                        if (!h.command) {
                            violations.push(`${plugin}/${evt}: missing "command" field`);
                        }
                    }
                }
            }
        }
        expect(violations, `hooks.json entries with missing/invalid fields:\n  ${violations.join('\n  ')}`).to.deep.equal([]);
    });

    it('every hook command resolves to an existing handler file', function () {
        const missing = [];
        for (const { plugin, hooksJson, pluginRoot } of files) {
            const data = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
            for (const [evt, groups] of Object.entries(data.hooks || {})) {
                for (const g of groups) {
                    for (const h of g.hooks || []) {
                        if (!h.command) continue;
                        const resolved = resolveCommandPath(h.command, pluginRoot);
                        // If the path still contains ${...}, we can't resolve it locally — skip.
                        if (resolved.includes('${')) continue;
                        if (!fs.existsSync(resolved)) {
                            const rel = path.relative(REPO_ROOT, resolved);
                            missing.push(`${plugin}/${evt}: ${h.command} → ${rel} (does not exist)`);
                        }
                    }
                }
            }
        }
        expect(missing, `hooks.json command paths that don't resolve to a real file:\n  ${missing.join('\n  ')}`).to.deep.equal([]);
    });
});
