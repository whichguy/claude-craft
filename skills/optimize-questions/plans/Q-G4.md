# Plan: Reporting Dashboard Date Format Standardization

## Context

The reporting dashboard displays dates inconsistently across modules. The `RevenueReport`
component formats dates as "MM/DD/YYYY" while the backend API returns ISO 8601. Users have
reported confusion when exported CSVs show different date formats than the UI.

The shared utility `formatDate()` in `src/utils/date-helpers.ts` is the central formatting
function used across the codebase. We need to update it to support locale-aware formatting
and add a `format` parameter with a default of `"short"` for backward compatibility.

## Approach

Modify `formatDate()` to accept an optional `options` object with `locale` and `format`
properties. Update the `RevenueReport` module to pass the user's locale preference. Add
unit tests for the new parameter combinations.

## Files to Modify

- `src/utils/date-helpers.ts` — Update `formatDate()` signature and implementation
- `src/components/reports/RevenueReport.tsx` — Pass locale to `formatDate()`
- `src/components/reports/RevenueReport.test.tsx` — Test locale-aware formatting
- `src/utils/date-helpers.test.ts` — Test new parameter combinations

## Implementation Steps

### Step 1: Update `formatDate()` signature

In `src/utils/date-helpers.ts`, change:

```ts
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
```

To:

```ts
interface FormatDateOptions {
  locale?: string;
  format?: 'short' | 'medium' | 'long' | 'iso';
}

export function formatDate(date: Date | string, options: FormatDateOptions = {}): string {
  const d = new Date(date);
  const { locale = 'en-US', format = 'short' } = options;

  switch (format) {
    case 'iso':
      return d.toISOString().split('T')[0];
    case 'long':
      return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'medium':
      return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case 'short':
    default:
      return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
}
```

### Step 2: Update RevenueReport component

In `src/components/reports/RevenueReport.tsx`, update the date rendering calls:

```tsx
import { formatDate } from '../../utils/date-helpers';
import { useUserPreferences } from '../../hooks/useUserPreferences';

// Inside component:
const { locale } = useUserPreferences();
const displayDate = formatDate(report.createdAt, { locale, format: 'medium' });
```

### Step 3: Add unit tests for formatDate

In `src/utils/date-helpers.test.ts`, add tests for each format variant and locale:

```ts
describe('formatDate with options', () => {
  it('returns short format by default for backward compatibility', () => { ... });
  it('returns ISO format when specified', () => { ... });
  it('respects locale for long format', () => { ... });
  it('handles string date input', () => { ... });
  it('handles invalid date gracefully', () => { ... });
});
```

### Step 4: Update RevenueReport tests

Add tests in `src/components/reports/RevenueReport.test.tsx` verifying:
- Dates render with the user's locale preference
- Default locale fallback works when preference is unset
- CSV export uses ISO format

## Verification

1. Run `npm test -- --grep "formatDate"` to validate utility tests pass
2. Run `npm test -- --grep "RevenueReport"` to validate component tests pass
3. Manual check: open the RevenueReport page and verify dates display in locale format
4. Manual check: export CSV and confirm ISO dates in the output
5. Run `npx tsc --noEmit` to confirm no type errors from the signature change

## Risks

- The new default format (`toLocaleDateString`) may produce slightly different output than
  the old manual formatting for `en-US`. Snapshot tests in RevenueReport may need updating.
- If a locale string is invalid, `toLocaleDateString` falls back to the runtime default
  rather than throwing, which is acceptable behavior.
