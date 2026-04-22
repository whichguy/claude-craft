const { EventEmitter } = require('events');

// Global event bus for cross-component signaling
const globalEvents = new EventEmitter();

/**
 * Manages individual client socket lifecycles and provides 
 * hooks for global system events.
 */
class SocketManager {
  constructor(socketId, app) {
    this.socketId = socketId;
    this.app = app;
    this.isClosed = false;
  }

  initialize() {
    const messageHandler = (payload) => {
      if (payload.target === this.socketId || payload.target === 'all') {
        this._dispatch(payload.message);
      }
    };

    // TRAP: Event emitter leak.
    // Every time a new SocketManager is initialized, it adds a listener 
    // to the 'globalEvents' singleton.
    globalEvents.on('broadcast', messageHandler);

    this.app.on('socket:close', (id) => {
      if (id === this.socketId) {
        this.cleanup();
      }
    });
  }

  _dispatch(message) {
    if (this.isClosed) return;
    console.log(`[Socket ${this.socketId}] Sending: ${message}`);
  }

  cleanup() {
    this.isClosed = true;
    console.log(`Cleaning up socket ${this.socketId}`);
    
    // TRAP: The developer forgot to remove the 'messageHandler' from 'globalEvents'.
    // Since 'globalEvents' is a global singleton, the 'messageHandler' closure 
    // will keep 'this' (the SocketManager instance) alive in memory forever, 
    // and the listener will keep executing for every broadcast.
    this.app.removeAllListeners('socket:close');
  }
}

module.exports = { SocketManager, globalEvents };
