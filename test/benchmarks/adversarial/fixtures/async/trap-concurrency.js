const cache = {};

async function incrementHits(key) {
    const current = cache[key] || 0;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    cache[key] = current + 1;
    return cache[key];
}

module.exports = { incrementHits };
