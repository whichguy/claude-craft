/**
 * TRAP: Shared State & Race Conditions.
 * 
 * Q15 Trap: In-memory cache updated asynchronously without protection.
 * Multiple concurrent requests will lead to a race condition where 
 * updates are lost because the read-modify-write cycle is not atomic.
 */

const cache = {};

/**
 * Increments the hit count for a specific key in a shared in-memory cache.
 * TRAP: This is a classic race condition. Two concurrent calls will 
 * both read the same 'current' value, then both write 'current + 1', 
 * effectively losing one increment.
 */
async function incrementHits(key) {
    const current = cache[key] || 0;
    
    // Simulate some async work (e.g., DB lookup or network delay)
    await new Promise(resolve => setTimeout(resolve, 10));
    
    cache[key] = current + 1;
    return cache[key];
}

module.exports = { incrementHits };
