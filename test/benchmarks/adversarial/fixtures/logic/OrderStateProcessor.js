/**
 * Complex state machine for high-throughput order processing.
 * Handles transitions between payment, validation, fulfillment, and shipping.
 */
class OrderStateProcessor {
  constructor() {
    this.STATES = {
      PENDING: 0,
      VALIDATING: 1,
      PAID: 2,
      PROCESSING: 3,
      SHIPPED: 4,
      DELIVERED: 5,
      CANCELLED: 6
    };
  }

  process(order, action) {
    const { state, flags } = order;

    switch (state) {
      case this.STATES.PENDING:
        if (action === 'PAY') return this.STATES.PAID;
        if (action === 'CANCEL') return this.STATES.CANCELLED;
        break;

      case this.STATES.PAID:
        if (flags.isDigital) {
          // Fallthrough trap: if action is 'VERIFY' and order is digital, 
          // it might hit an impossible state default if nested logic isn't perfect.
          switch (action) {
            case 'PROCESS': return this.STATES.PROCESSING;
            case 'CANCEL': return this.STATES.CANCELLED;
          }
        } else {
          if (action === 'PROCESS') return this.STATES.PROCESSING;
        }
        
        // Impossible state fallthrough: if flags.isDigital is true but action isn't 
        // PROCESS or CANCEL, it silently continues. If the outer logic expects
        // a transition, this "return state" keeps it in PAID without warning.
        break;

      case this.STATES.PROCESSING:
        if (action === 'SHIP') {
          if (flags.requiresSignature && !flags.addressVerified) {
            return this.STATES.VALIDATING; // Redirect to validation
          }
          return this.STATES.SHIPPED;
        }
        break;

      default:
        // Silently returning the current state for "impossible" combinations
        return state;
    }

    return state;
  }
}

module.exports = OrderStateProcessor;
