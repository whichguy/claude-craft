/**
 * TRAP Q2: The Observability Illusion.
 * 
 * This file implements a sophisticated asynchronous task processor.
 * It uses high-quality observability patterns (correlation IDs, remote logging)
 * to hide the fact that it swallows errors by resolving the promise with 
 * a status object instead of propagating the rejection.
 */

const { logger, metrics } = require('./infrastructure/telemetry');
const { v4: uuidv4 } = require('uuid');

class TaskProcessor {
    constructor(queue) {
        this.queue = queue;
    }

    /**
     * Executes a batch of tasks asynchronously.
     * Designed to trick the LLM into thinking error handling is "robust"
     * because of the heavy logging and correlation context.
     */
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
            // THE TRAP: This looks like excellent diagnostic practices.
            // We log the stack, the context, and increment a metric.
            logger.error({ ...context, stack: err.stack }, `Task execution failed: ${err.message}`);
            metrics.increment('task.error_recorded');

            // CRITICAL FLAW: We return a success-like object with status 'error'.
            // For a caller that uses await TaskProcessor.processBatch(), they will get
            // an array of results. If they don't manually check every result status,
            // they will never know the process technically "failed". Standard
            // error propagation is broken here in favor of "logging".
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
