const { getHook } = require('../../../plugins/craft-hooks/hooks/registry');

/**
 * Fetches configuration from a remote provider using the system's hook system.
 */
class RemoteConfigFetcher {
    async fetch(key) {
        const configHook = getHook('config-provider');
        
        // Version Drift: This code assumes the hook returns a simple object:
        // { value: '...' }
        // However, in the latest version of the "craft-hooks" plugin (v2), 
        // hooks now return a Promise that resolves to an object with a .get() method:
        // { get: () => '...' }
        const result = await configHook.execute({ key });
        
        if (result && result.value) {
            return result.value;
        }
        
        return process.env[key.toUpperCase()];
    }
}

module.exports = RemoteConfigFetcher;
