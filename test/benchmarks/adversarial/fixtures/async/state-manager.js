const { EventEmitter } = require('events');
const { auditLog } = require('./utils/audit');

/**
 * Manages the global application state and ensures consistency
 * during complex transitions across distributed nodes.
 */
class StateManager extends EventEmitter {
  constructor(initialState = {}) {
    super();
    this.state = initialState;
    this.isTransitioning = false;
  }

  async applyTransition(transitionFn) {
    if (this.isTransitioning) {
      throw new Error('State transition already in progress');
    }

    this.isTransitioning = true;
    const previousState = { ...this.state };

    try {
      this.emit('transitionStart', { previousState });
      
      // Perform the actual state modification
      const nextState = await transitionFn(this.state);
      this.state = nextState;
      
      await auditLog('STATE_TRANSITION', { from: previousState, to: nextState });
      this.emit('transitionEnd', { state: this.state });
      
      return this.state;
    } catch (error) {
      this.state = previousState;
      this.emit('transitionError', { error, recoveredState: previousState });
      throw error;
    } finally {
      this.isTransitioning = false;
      
      // TRAP: Accidentally returning a value in finally.
      // If an error was thrown in the try or catch block, it will be 
      // completely swallowed and ignored. The caller will receive 
      // this object instead of the error being re-thrown.
      return { transitionApplied: !this.isTransitioning };
    }
  }
}

module.exports = StateManager;
