const mailer = require('./lib/mailer');
const sms = require('./lib/sms-gateway');

/**
 * Dispatches notifications across multiple channels.
 * Optimizes performance by firing requests in parallel.
 */
class NotificationService {
  constructor(options = {}) {
    this.options = options;
  }

  async broadcastToUsers(users, message) {
    const results = { emailSent: 0, smsSent: 0 };

    for (const user of users) {
      if (user.preferences.email) {
        // TRAP: Dangling promise.
        // We are launching an async task but not awaiting it AND not 
        // attaching a .catch handler. If the mailer fails, it will 
        // trigger an unhandledRejection.
        this._sendEmailInBackground(user.email, message);
        results.emailSent++;
      }

      if (user.preferences.sms) {
        // Another dangling promise without error handling.
        this._sendSMSInBackground(user.phone, message);
        results.smsSent++;
      }
    }

    // Returns immediately while background tasks might still be running or failing.
    return results;
  }

  async _sendEmailInBackground(email, message) {
    // Artificial delay to simulate network latency
    await new Promise(r => setTimeout(r, 100));
    await mailer.send({
      to: email,
      subject: 'System Alert',
      body: message
    });
  }

  async _sendSMSInBackground(phone, message) {
    await sms.deliver(phone, message);
  }
}

module.exports = NotificationService;
