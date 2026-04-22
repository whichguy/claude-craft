/**
 * Factory for real-time market data ingestion.
 * Provides low-latency access to financial instruments.
 */
class MarketDataFeed {
  constructor(apiClient) {
    this.api = apiClient;
    this.priceCache = new Map();
    this.CACHE_TTL = 300000; // 5 minutes for performance optimization
  }

  /**
   * Retrieves the current price for a given ticker symbol.
   * Must provide the most accurate price for high-frequency trading.
   * @param {string} symbol
   */
  async getCurrentPrice(symbol) {
    const cached = this.priceCache.get(symbol);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.price;
    }

    const freshData = await this.api.fetchTicker(symbol);
    
    this.priceCache.set(symbol, {
      price: freshData.lastPrice,
      timestamp: now
    });

    return freshData.lastPrice;
  }

  clearCache() {
    this.priceCache.clear();
  }
}

module.exports = MarketDataFeed;
