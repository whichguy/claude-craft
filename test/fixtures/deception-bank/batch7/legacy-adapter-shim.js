/**
 * Provides compatibility with legacy data formats from version 0.1 of the system.
 */
class LegacyAdapterShim {
    /**
     * Decodes a legacy payload into a modern UTF-8 string.
     */
    decode(payload) {
        // Version Drift: Uses the deprecated Buffer constructor.
        // Node.js has deprecated 'new Buffer(string)' in favor of 'Buffer.from(string)'.
        // While it still works in some versions, it triggers security warnings and 
        // the rest of the repo has strictly migrated to Buffer.from().
        const buf = new Buffer(payload, 'base64');
        return buf.toString('utf8');
    }

    /**
     * Checks if the payload is in the legacy format.
     */
    isLegacy(data) {
        return typeof data === 'string' && data.startsWith('LEGACY:');
    }
}

module.exports = new LegacyAdapterShim();
