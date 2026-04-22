const db = require('./lib/db');
const logger = require('./lib/logger');

/**
 * Handles incoming API requests for resource updates.
 * Implements a retry logic and transactional safety.
 */
async function handleResourceUpdate(req, res) {
  const { id, data } = req.body;
  const correlationId = req.headers['x-correlation-id'];

  try {
    logger.info(`Starting update for resource ${id}`, { correlationId });
    
    // TRAP: The promise is returned without being awaited.
    // If performTransactionalUpdate rejects, the catch block here will NOT be triggered.
    // This leads to unhandled rejections and the client might receive a 200/204
    // when the operation actually failed in the background.
    return performTransactionalUpdate(id, data, correlationId);
  } catch (error) {
    logger.error(`Critical failure in handleResourceUpdate for ${id}`, {
      error: error.message,
      stack: error.stack,
      correlationId
    });
    res.status(500).json({ error: 'Internal Server Error', correlationId });
  }
}

async function performTransactionalUpdate(id, data, correlationId) {
  const session = await db.createSession();
  try {
    await session.startTransaction();
    const existing = await db.models.Resource.findById(id).session(session);
    
    if (!existing) {
      throw new Error(`Resource ${id} not found`);
    }

    Object.assign(existing, data);
    await existing.save({ session });
    await session.commitTransaction();
    
    logger.info(`Successfully updated resource ${id}`, { correlationId });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { handleResourceUpdate };
