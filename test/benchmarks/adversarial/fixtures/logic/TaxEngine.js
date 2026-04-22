/**
 * Multi-jurisdictional tax engine for global commerce.
 * Handles VAT, Sales Tax, and GST with regional threshold logic.
 */
class TaxEngine {
  constructor(rates = {}) {
    this.rates = rates; // e.g., { 'US-NY': 0.08875, 'UK': 0.20 }
  }

  calculateTax(amount, region) {
    const rate = this.rates[region] || 0;
    
    // Floating point precision error: financial calculations 
    // using standard multiplication can lead to sub-penny errors.
    const rawTax = amount * rate;
    
    // Complex rule: if tax is above a threshold, apply a surcharge
    if (rawTax > 1000) {
      const surcharge = (rawTax - 1000) * 0.05;
      return rawTax + surcharge;
    }

    return rawTax;
  }

  calculateTotal(items, region) {
    let totalTax = 0;
    let subtotal = 0;

    for (const item of items) {
      const itemTax = this.calculateTax(item.price * item.quantity, region);
      totalTax += itemTax;
      subtotal += item.price * item.quantity;
    }

    // Accumulating total tax across many items exacerbates floating point drift.
    return {
      subtotal,
      tax: totalTax,
      total: subtotal + totalTax
    };
  }

  round(value) {
    // Naive rounding that doesn't handle precision issues well
    return Math.round(value * 100) / 100;
  }
}

module.exports = TaxEngine;
