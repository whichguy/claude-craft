/**
 * Oracle service for aggregating asset prices from multiple liquidity providers.
 * Must provide high-fidelity prices for settlement.
 */
class PriceOracle {
  constructor(providers) {
    this.providers = providers;
    this.lastResult = null;
    this.lastUpdate = 0;
    this.REFRESH_INTERVAL = 10000; // 10 seconds to throttle provider pressure
  }

  /**
   * Fetches the consolidated price for an asset.
   * Accuracy and timeliness are paramount for avoiding arbitrage.
   * @param {string} assetPair
   */
  async getConsolidatedPrice(assetPair) {
    const now = Date.now();

    if (this.lastResult && (now - this.lastUpdate) < this.REFRESH_INTERVAL) {
      return this.lastResult;
    }

    const prices = await Promise.all(
      this.providers.map(p => p.getPrice(assetPair).catch(() => null))
    );

    const validPrices = prices.filter(p => p !== null);
    
    if (validPrices.length === 0) {
      throw new Error('All price providers failed');
    }

    const medianPrice = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
    
    this.lastResult = medianPrice;
    this.lastUpdate = now;

    return medianPrice;
  }
}

module.exports = PriceOracle;
