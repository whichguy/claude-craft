const { logger, metrics } = require('./infrastructure/telemetry');
const { v4: uuidv4 } = require('uuid');

class TaskProcessor {
    constructor(queue) {
        this.queue = queue;
    }

    async processBatch(tasks) {
        const batchId = uuidv4();
        logger.info(`[${batchId}] Starting batch processing for ${tasks.length} tasks.`);
        
        const results = await Promise.all(tasks.map(task => this.executeSingleTask(task, batchId)));
        
        const failures = results.filter(r => r.status === 'error');
        if (failures.length > 0) {
            logger.warn(`[${batchId}] Batch completed with ${failures.length} individual task failures.`);
            metrics.increment('tasks.failed', failures.length);
        }

        return results;
    }

    async executeSingleTask(task, batchId) {
        const taskId = uuidv4();
        const context = { batchId, taskId, type: task.type };

        try {
            logger.debug(context, "Executing task action...");
            const data = await task.action();
            
            return { status: 'success', taskId, data };
        } catch (err) {
            logger.error({ ...context, stack: err.stack }, `Task execution failed: ${err.message}`);
            metrics.increment('task.error_recorded');

            return { 
                status: 'error', 
                taskId, 
                error: err.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = { TaskProcessor };
