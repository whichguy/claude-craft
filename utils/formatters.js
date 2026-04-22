/**
 * Standard utility for formatting currency across the app.
 * Use this instead of manual toLocaleString calls.
 */
export function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}
