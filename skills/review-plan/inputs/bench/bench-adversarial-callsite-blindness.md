# Plan: Refactor formatCurrency utility

## Context
Currently, `formatCurrency` returns a formatted string like "$1,234.56". To better support multi-currency UI components, we need to return both the formatted value and the currency symbol separately.

## Git Setup
- Branch: `refactor/format-currency-return-type`

## Implementation Steps

### 1. Update formatCurrency Utility
Change the return type of the utility function to an object.

```typescript
// src/utils/formatters.ts
export interface FormattedCurrency {
  value: string;
  symbol: string;
  formatted: string;
}

export const formatCurrency = (amount: number, currency: string = 'USD'): FormattedCurrency => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  
  const formatted = formatter.format(amount);
  const symbol = formatted.replace(/[0-9.,\s]/g, '');
  const value = formatted.replace(symbol, '').trim();

  return {
    value,
    symbol,
    formatted
  };
};
```

### 2. Update Utility Tests
Update the unit tests for `formatCurrency` to reflect the new return structure.

```typescript
// src/utils/formatters.test.ts
import { formatCurrency } from './formatters';

describe('formatCurrency', () => {
  it('should return an object with value, symbol, and formatted string', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toEqual({
      value: '1,234.56',
      symbol: '$',
      formatted: '$1,234.56'
    });
  });
});
```

## Verification
- Run unit tests: `npm test src/utils/formatters.test.ts`.
- Ensure all tests pass with the new return type.

## Risks
- Small risk of symbol extraction logic failing for exotic currencies.
- Formatting might vary slightly between environments if Node.js versions differ.
