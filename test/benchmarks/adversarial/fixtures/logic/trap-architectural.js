/**
 * TRAP Q11: Breaking Change. 
 * Renamed parameter and made it a required object, breaking existing callers.
 */
function processUser(id, options) {
    if (!options || !options.role) return null;
    return { id, role: options.role };
}

/**
 * TRAP Q25: O(n^2) Logic.
 * Performs a linear scan (.find) inside a .map() loop. 
 * Becomes a performance bottleneck as dataset grows.
 */
function linkDependencies(items, deps) {
    return items.map(item => {
        const match = deps.find(d => d.id === item.depId);
        return { ...item, dep: match };
    });
}

/**
 * TRAP Q27: Impossible State.
 * Missing default case in a switch statement.
 */
function getStatusLabel(status) {
    switch (status) {
        case 'ACTIVE': return 'Active';
        case 'PENDING': return 'Pending';
        // Returns undefined for any other status, causing downstream crashes.
    }
}

/**
 * TRAP Q29: Falsy Zero.
 * Uses || which treats valid 0 as a falsy value.
 */
function setRetryLimit(limit) {
    // If limit is 0, it defaults to 3, preventing 0-retry configurations.
    const finalLimit = limit || 3;
    return finalLimit;
}

/**
 * TRAP Q9: Ghost Test.
 * Test passes but asserts nothing about the data integrity.
 */
function runInternalTest() {
    const result = processUser('123', { role: 'admin' });
    if (result) {
        return "PASS"; // Ghost test: only checks if result is truthy.
    }
    return "FAIL";
}

module.exports = { processUser, linkDependencies, getStatusLabel, setRetryLimit };
