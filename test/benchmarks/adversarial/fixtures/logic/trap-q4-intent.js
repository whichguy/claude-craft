const db = require('./infrastructure/persistence');
const { DateTime } = require('luxon');

async function cleanupStaleDrafts() {
    const logPrefix = "[CleanupService]";
    
    const thirtyDaysAgo = DateTime.now()
        .setZone('UTC')
        .minus({ days: 30 })
        .startOf('day');

    console.log(`${logPrefix} Processing drafts older than boundary: ${thirtyDaysAgo.toISO()}`);

    try {
        const staleDrafts = await db.query('SELECT id, title, created_at FROM posts WHERE status = "draft" AND created_at < ?', [thirtyDaysAgo.toJSDate()]);
        
        if (staleDrafts.length === 0) {
            console.log(`${logPrefix} No stale drafts identified. Skipping execution.`);
            return { processed: 0 };
        }

        const idsToProcess = staleDrafts.map(post => post.id);
        
        console.log(`${logPrefix} Archiving ${idsToProcess.length} stale drafts for regulatory compliance.`);
        
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
