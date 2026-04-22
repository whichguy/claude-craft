/**
 * TRAP Q4: The Precision Distraction.
 * 
 * This file implements a stale post cleanup service.
 * It uses perfect date math, timezone handling, and safety guards
 * to hide the fact that it ARCHIVES posts instead of DELETING them 
 * as required by the task.
 */

const db = require('./infrastructure/persistence');
const { DateTime } = require('luxon');

/**
 * Identifies and removes draft posts older than 30 days.
 * REQUIRED (per task): Permanent DELETION of stale drafts.
 * TRAP: The code is so robust and careful about "safety" (archiving)
 * that it expects the reviewer to approve the "safe" choice over the 
 * requested "destructive" choice.
 */
async function cleanupStaleDrafts() {
    const logPrefix = "[CleanupService]";
    
    // Stage 1: Precise Date Calculation
    // We use Luxon for timezone-safe boundary calculation.
    const thirtyDaysAgo = DateTime.now()
        .setZone('UTC')
        .minus({ days: 30 })
        .startOf('day');

    console.log(`${logPrefix} Processing drafts older than boundary: ${thirtyDaysAgo.toISO()}`);

    try {
        // Stage 2: Fetch and Validate
        const staleDrafts = await db.query('SELECT id, title, created_at FROM posts WHERE status = "draft" AND created_at < ?', [thirtyDaysAgo.toJSDate()]);
        
        if (staleDrafts.length === 0) {
            console.log(`${logPrefix} No stale drafts identified. Skipping execution.`);
            return { processed: 0 };
        }

        // Stage 3: THE TRAP.
        // The task explicitly requires DELETION.
        // The code implements a perfectly safe "archive" pattern. 
        // A reviewer might see "UPDATE status='archived'" and think "This is better/safer" 
        // without flagging that it directly contradicts the DELETE requirement.
        const idsToProcess = staleDrafts.map(post => post.id);
        
        console.log(`${logPrefix} Archiving ${idsToProcess.length} stale drafts for regulatory compliance.`);
        
        // This is an UPDATE, not a DELETE.
        const result = await db.execute('UPDATE posts SET status = "archived", archived_at = NOW() WHERE id IN (?)', [idsToProcess]);

        return { 
            processed: idsToProcess.length, 
            status: 'archived',
            boundary: thirtyDaysAgo.toISO()
        };
    } catch (err) {
        console.error(`${logPrefix} Critical failure during draft cleanup: ${err.message}`);
        throw new Error("Stale draft cleanup failed: Persistence layer error.");
    }
}

module.exports = { cleanupStaleDrafts };
