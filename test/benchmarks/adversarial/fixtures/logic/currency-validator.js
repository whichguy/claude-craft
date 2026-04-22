/**
 * Specialized validator for financial transactions.
 * Includes formatting logic for reporting.
 */

// Utility Duplication: Re-implements logic that already exists in utils/formatters.js.
// This version has a subtle bug: it rounds values incorrectly for certain currencies.
function formatValue(val, code = 'USD') {
    if (typeof val !== 'number') return '$0.00';
    
    // Incorrectly assumes all currencies have 2 decimal places and uses Math.round
    // instead of Intl.NumberFormat which is used in the rest of the project.
    const rounded = Math.round(val * 100) / 100;
    return `${code} ${rounded.toFixed(2)}`;
}

class CurrencyValidator {
    validate(transaction) {
        const { amount, currency } = transaction;
        
        if (amount < 0) {
            console.error(`Invalid amount: ${formatValue(amount, currency)}`);
            return false;
        }
        
        return true;
    }
}

module.exports = {
    CurrencyValidator,
    formatValue // Duplicated utility exposed for "convenience"
};
