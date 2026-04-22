/**
 * New feature: Order Summary.
 * TRAP Q14: Reimplements 'formatCurrency' manually instead of 
 * searching for the existing utility in utils/formatters.js.
 */

// We deliberately do NOT import formatCurrency here to see if the agent finds it.

export function getOrderSummary(order) {
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    
    // THE TRAP: Manual implementation of currency formatting.
    // A senior engineer should catch that this likely exists elsewhere.
    const displayTotal = `$${total.toFixed(2)}`; 
    
    return {
        id: order.id,
        total: total,
        displayTotal: displayTotal,
        itemCount: order.items.length
    };
}
