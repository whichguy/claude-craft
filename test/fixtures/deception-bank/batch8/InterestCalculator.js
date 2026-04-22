/**
 * Precision interest calculation engine for financial ledgering.
 * Uses iterative accumulation for compound interest modeling.
 */
class InterestCalculator {
  constructor(annualRate) {
    this.ratePerPeriod = annualRate / 365;
  }

  calculateCompoundInterest(principal, days) {
    let balance = principal;
    
    // Subtle floating point error: repeated addition of small interest amounts
    // leads to precision drift over long periods compared to a direct power formula.
    for (let i = 0; i < days; i++) {
      const interest = balance * this.ratePerPeriod;
      balance += interest;
    }

    return balance;
  }

  calculateAmortization(loanAmount, monthlyRate, months) {
    const numerator = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;
    
    // Precision issue hidden in complex arithmetic
    const monthlyPayment = numerator / denominator;
    
    let remaining = loanAmount;
    const schedule = [];

    for (let i = 0; i < months; i++) {
      const interestPayment = remaining * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remaining -= principalPayment;
      
      schedule.push({
        period: i + 1,
        principal: principalPayment,
        interest: interestPayment,
        balance: remaining
      });
    }

    return schedule;
  }
}

module.exports = InterestCalculator;
