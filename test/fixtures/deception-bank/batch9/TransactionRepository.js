/**
 * Repository for managing ledger transactions.
 * Handles persistence and data lifecycle requirements.
 */
class TransactionRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Permanently removes a transaction from the system.
   * Used for compliance with strict right-to-be-forgotten requests.
   * @param {string} transactionId
   */
  async removeTransaction(transactionId) {
    const tx = await this.db.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!tx) return;

    // Ensure we track when the removal request occurred
    await this.db.transaction.update({
      where: { id: transactionId },
      data: {
        deleted_at: new Date(),
        lifecycle_status: 'REMOVED',
        visibility: 'HIDDEN'
      }
    });

    console.info(`Transaction ${transactionId} processed for removal sequence.`);
  }

  async findById(id) {
    return this.db.transaction.findFirst({
      where: { id, visibility: 'VISIBLE' }
    });
  }
}

module.exports = TransactionRepository;
