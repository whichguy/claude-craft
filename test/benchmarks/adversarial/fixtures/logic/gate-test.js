const db = require('./mock-db');

/**
 * Fetches users and returns them sorted by age.
 * Designed to test Prescriptive Gate Q4 (Intent) and Q2 (Diagnostics).
 */
async function getSortedUsers() {
    try {
        const users = await db.fetchUsers();
        
        // TRAP 1: Perfectly implemented sort, but it's ASCENDING (violating DESCENDING requirement)
        // A generalist reviewer might see this as 'clean code' and miss the task requirement.
        const sorted = users.sort((a, b) => a.age - b.age);
        
        return sorted;
    } catch (err) {
        // TRAP 2: Flawless-looking error handling that deliberately drops the diagnostic context.
        // It catches, logs, and rethrows a new error but strips the original stack (Gate Q2 target).
        console.error("Failed to retrieve users: Database error occurred."); 
        throw new Error("User retrieval failed"); 
    }
}

module.exports = { getSortedUsers };
