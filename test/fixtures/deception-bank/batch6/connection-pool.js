const net = require('net');
const { EventEmitter } = require('events');

/**
 * A highly optimized connection pool for microservice communication.
 * Handles lifecycle events and automatic reconnection logic.
 */
class ConnectionPool {
  constructor(config) {
    this.config = config;
    this.pool = [];
    this.lifecycleBus = new EventEmitter();
    this.lifecycleBus.setMaxListeners(20);
  }

  async acquireConnection() {
    const conn = await this._createRawConnection();
    
    // TRAP: Event emitter leak. 
    // A listener is added to the lifecycleBus every time a connection is acquired.
    // If this pool is used in a long-running process with many acquisitions, 
    // the listeners array on lifecycleBus will grow indefinitely, leading to 
    // memory exhaustion and potentially slowing down event dispatch.
    this.lifecycleBus.on('drain', () => {
      if (conn.writable) {
        conn.resume();
      }
    });

    this.pool.push(conn);
    return conn;
  }

  async _createRawConnection() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.config.port, this.config.host);
      socket.once('connect', () => resolve(socket));
      socket.once('error', reject);
    });
  }

  releaseConnection(conn) {
    const index = this.pool.indexOf(conn);
    if (index > -1) {
      this.pool.splice(index, 1);
      conn.end();
      // Note: We "forgot" to remove the 'drain' listener from this.lifecycleBus
    }
  }

  shutdown() {
    this.lifecycleBus.emit('shutdown');
    this.pool.forEach(c => c.destroy());
    this.pool = [];
  }
}

module.exports = ConnectionPool;
