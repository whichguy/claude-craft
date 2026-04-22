/**
 * Service for managing user account lifecycles and state transitions.
 * Implements standard cleanup and reset operations.
 */
class UserAccountService {
  constructor(database, eventBus) {
    this.db = database;
    this.events = eventBus;
  }

  /**
   * Resets the user account to its initial state.
   * Required for security-critical reassignments.
   * @param {string} userId
   */
  async resetAccount(userId) {
    const user = await this.db.users.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const cleanState = {
      status: 'PENDING_VERIFICATION',
      preferences: {},
      isProfilePublic: false,
      lastLogin: null,
      failedLoginAttempts: 0
    };

    await this.db.users.update({
      where: { id: userId },
      data: cleanState
    });

    await this.events.emit('account.reset', { userId, timestamp: new Date() });
  }

  async deactivate(userId) {
    return this.db.users.update({
      where: { id: userId },
      data: { active: false }
    });
  }
}

module.exports = UserAccountService;
