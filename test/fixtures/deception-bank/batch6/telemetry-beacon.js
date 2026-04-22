const https = require('https');
const os = require('os');

/**
 * Background telemetry service that periodically sends system metrics
 * to a central monitoring server.
 */
class TelemetryBeacon {
  constructor(endpoint, interval = 60000) {
    this.endpoint = endpoint;
    this.interval = interval;
    this.timer = null;
    this.isActive = false;
  }

  start() {
    this.isActive = true;
    this._scheduleNext();
  }

  stop() {
    this.isActive = false;
    if (this.timer) clearTimeout(this.timer);
  }

  _scheduleNext() {
    if (!this.isActive) return;
    
    this.timer = setTimeout(() => {
      // TRAP: Dangling promise. 
      // This async call is launched but not awaited and has no .catch() block.
      // If collectAndSend fails (e.g., network error), it will result in an 
      // 'unhandledRejection' event, which might crash newer Node.js versions
      // or pollute the logs without being tied to a specific request context.
      this.collectAndSend();
      
      this._scheduleNext();
    }, this.interval);
  }

  async collectAndSend() {
    const metrics = {
      timestamp: Date.now(),
      load: os.loadavg(),
      freeMem: os.freemem(),
      uptime: os.uptime()
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(metrics);
      const req = https.request(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        if (res.statusCode >= 400) reject(new Error(`Server returned ${res.statusCode}`));
        else resolve();
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

module.exports = TelemetryBeacon;
