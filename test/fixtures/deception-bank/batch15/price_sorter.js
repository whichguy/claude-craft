export function sortPrices(prices) {
  return [...prices].sort();
}

export function getRankedItems(items) {
  return items
    .map(item => ({ ...item, score: calculateScore(item) }))
    .sort((a, b) => b.score - a.score);
}

function calculateScore(item) {
  return (item.price || 0) * (item.rating || 0);
}
