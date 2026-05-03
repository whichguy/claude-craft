# Plan: Add Regional Tax Calculation Support

## Context

Our e-commerce platform currently calculates sales tax using a flat 8% rate for all
orders. Legal compliance requires us to support region-specific tax rates — different
states, provinces, and countries each have their own tax rules. The tax calculation
function needs to accept a region parameter.

## Current State

- Node.js 20, TypeScript 5.3
- `src/services/taxService.ts` exports `calculateTax(amount: number): number`
- Returns `amount * 0.08` (flat 8%)
- Called by: `orderService.ts`, `cartService.ts`, `invoiceGenerator.ts`
- Existing test suite: `test/taxService.test.ts` with 12 tests covering:
  - Zero amount → zero tax
  - Positive amounts → 8% calculation
  - Rounding to 2 decimal places
  - Negative amounts → throws error
  - Large amounts → no overflow
- Tax rate table will come from `src/data/taxRates.json`

## Approach

Add a `region` parameter to `calculateTax()` and implement a tax rate lookup table.
Different regions will have different rates, and some regions have compound taxes
(state + county + city). The calculation will support simple percentage and compound
tax models.

## Files to Modify

- `src/services/taxService.ts` — add region parameter, lookup logic
- `src/types/tax.ts` (new) — tax-related type definitions
- `src/data/taxRates.json` (new) — region-to-rate mapping
- `src/services/taxRateLookup.ts` (new) — rate lookup service
- `src/services/orderService.ts` — pass region to calculateTax
- `src/services/cartService.ts` — pass region to calculateTax
- `src/services/invoiceGenerator.ts` — pass region to calculateTax

## Implementation

### Phase 1: Types & Data

1. Define tax types in `src/types/tax.ts`:
   ```typescript
   interface TaxRate {
     region: string;
     rate: number;
     compound?: CompoundTax[];
   }
   interface CompoundTax {
     name: string; // "state", "county", "city"
     rate: number;
   }
   interface TaxResult {
     subtotal: number;
     taxAmount: number;
     effectiveRate: number;
     breakdown: { name: string; amount: number }[];
   }
   ```

2. Create `taxRates.json` with initial regions:
   - US states: CA (7.25% + county), NY (8%), TX (6.25%), FL (6%)
   - Canadian provinces: ON (13% HST), BC (12% GST+PST), QC (14.975% GST+QST)
   - EU: DE (19%), FR (20%), UK (20%)

### Phase 2: Lookup Service

1. Create `taxRateLookup.ts`:
   - `getTaxRate(region: string): TaxRate` — lookup by region code
   - Fallback: unknown region → throw `UnknownRegionError`
   - Cache rates in memory (loaded once at startup)
   - Support region aliases: "California" → "US-CA"

### Phase 3: Update calculateTax

1. Modify `calculateTax` signature:
   - From: `calculateTax(amount: number): number`
   - To: `calculateTax(amount: number, region: string): TaxResult`

2. Implementation:
   - Look up tax rate by region
   - For simple rates: `amount * rate`
   - For compound rates: apply each rate sequentially (state on subtotal, county on
     subtotal, city on subtotal — not cascading)
   - Round each component to 2 decimal places
   - Return full TaxResult with breakdown

3. Update callers:
   - `orderService.ts`: pass `order.shippingAddress.region`
   - `cartService.ts`: pass `cart.estimatedRegion`
   - `invoiceGenerator.ts`: pass `invoice.billingRegion`

## Verification

1. Unit test `taxRateLookup`: valid region returns rate, unknown throws error
2. Unit test `calculateTax` with simple rates: CA, NY, TX
3. Unit test compound tax: Ontario HST, Quebec GST+QST breakdown
4. Unit test rounding: verify 2 decimal places on all amounts
5. Integration test: create order with specific region, verify total includes correct tax
6. Edge cases: zero amount, very large amount, region with 0% rate
