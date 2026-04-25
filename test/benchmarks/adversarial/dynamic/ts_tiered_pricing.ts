/**
 * TieredPricingEngine calculates the total cost for bulk purchases
 * based on a tiered structure. Higher volumes attract lower per-unit prices.
 */
export interface PricingTier {
  minQuantity: number;
  maxQuantity: number | null; // null represents infinity
  unitPrice: number;
}

export class PricingEngine {
  private tiers: PricingTier[];

  constructor(tiers: PricingTier[]) {
    // Sort tiers by minimum quantity to ensure correct processing
    this.tiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    this.validateTiers();
  }

  /**
   * Validates that tiers are contiguous and do not overlap.
   */
  private validateTiers(): void {
    for (let i = 0; i < this.tiers.length - 1; i++) {
      const current = this.tiers[i];
      const next = this.tiers[i + 1];

      if (current.maxQuantity === null) {
        throw new Error("Only the last tier can have an infinite maxQuantity.");
      }

      // Check for gaps or overlaps
      if (current.maxQuantity !== next.minQuantity - 1) {
        throw new Error(
          `Gaps or overlaps detected between tier ${i} and ${i + 1}. ` +
          `Tier ${i} ends at ${current.maxQuantity}, while tier ${i + 1} starts at ${next.minQuantity}.`
        );
      }
    }
  }

  /**
   * Calculates the total price for a given quantity.
   * This implementation uses 'slab pricing', where units are charged
   * based on the tier they fall into.
   */
  public calculateTotal(quantity: number): number {
    if (quantity <= 0) return 0;

    let total = 0;
    let remaining = quantity;

    for (const tier of this.tiers) {
      const tierSize = tier.maxQuantity 
        ? (tier.maxQuantity - tier.minQuantity + 1)
        : Infinity;

      const unitsInThisTier = Math.min(remaining, tierSize);
      
      if (unitsInThisTier <= 0) break;

      total += unitsInThisTier * tier.unitPrice;
      remaining -= unitsInThisTier;

      if (remaining <= 0) break;
    }

    return Number(total.toFixed(2));
  }
}

// Example usage:
// Tier 0: 1-100 units @ $10.00
// Tier 1: 101-500 units @ $8.00
// Tier 2: 501+ units @ $5.00
const engine = new PricingEngine([
  { minQuantity: 1, maxQuantity: 100, unitPrice: 10.00 },
  { minQuantity: 101, maxQuantity: 500, unitPrice: 8.00 },
  { minQuantity: 501, maxQuantity: null, unitPrice: 5.00 },
]);
