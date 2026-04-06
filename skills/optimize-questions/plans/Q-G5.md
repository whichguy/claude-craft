# Plan: Fix Timezone Bug in Date Display

## Context

Users in non-UTC timezones report that event dates on the calendar view show the wrong day.
An event created at 11pm EST on March 5th displays as March 6th because the component passes
raw ISO strings to `new Date()` without timezone handling.

Bug report: "Created event for March 5th, but it shows March 6th on the calendar."

## Approach

Fix the timezone conversion in the calendar date display, then modernize the entire date
infrastructure to prevent similar issues going forward.

## Files to Modify

- `src/utils/dateUtils.ts` — Fix timezone conversion, refactor all helpers, migrate to date-fns
- `src/components/Calendar/CalendarDay.tsx` — Apply timezone-safe formatting
- `src/components/Calendar/CalendarDay.test.tsx` — Timezone regression tests
- `src/utils/dateUtils.test.ts` — Comprehensive test suite for refactored utilities
- `src/components/DatePicker/DatePicker.tsx` — New date picker component
- `src/components/DatePicker/DatePicker.module.css` — Date picker styles
- `package.json` — Add date-fns, remove moment.js

## Implementation Steps

### Step 1: Fix the timezone bug in CalendarDay

In `CalendarDay.tsx`, replace `new Date(event.date)` with date-fns `parseISO(event.date)`.
This ensures "2024-03-05" is treated as a local date, not UTC midnight.

### Step 2: Refactor dateUtils.ts to use date-fns

Replace all existing date utilities with date-fns equivalents:
- `formatShortDate()` -> `format(date, 'MMM d, yyyy')`
- `formatRelativeTime()` -> `formatDistanceToNow(date)`
- `getWeekStart()` -> `startOfWeek(date)`
- `getMonthRange()` -> `{ start: startOfMonth(date), end: endOfMonth(date) }`
- `isToday()`, `addDays()`, `diffInDays()` -> date-fns direct equivalents
- Add new helpers: `parseUserDate()`, `toUTCString()`, `formatForAPI()`
- Add timezone-aware `formatInTimezone()` using date-fns-tz

### Step 3: Create new DatePicker component

Build a reusable date picker to replace native `<input type="date">` in the event creation
form. Features: month/year nav, day grid, keyboard navigation, ARIA labels, min/max date
constraints, locale-aware names, click-outside-to-close, portal-based dropdown.

### Step 4: Remove moment.js dependency

`npm uninstall moment && npm install date-fns date-fns-tz`. Migrate remaining imports in:
- `src/components/EventForm/EventForm.tsx`
- `src/components/Timeline/Timeline.tsx`
- `src/pages/Analytics/Analytics.tsx`
- `src/hooks/useRelativeTime.ts`

### Step 5: Write comprehensive tests

Rewrite `dateUtils.test.ts` covering timezone edge cases (midnight, DST transitions, leap
years, invalid dates). Add CalendarDay regression test for the original bug. Add DatePicker
component tests for keyboard navigation and accessibility.

### Step 6: Integrate DatePicker into EventForm

Replace `<input type="date">` in `EventForm.tsx` with the new `<DatePicker>` component.

### Step 7: Update snapshot tests

Run `npm test -- -u` to update snapshots affected by formatting changes.

## Verification

1. Run `npm test` to verify all tests pass
2. Manual test: create event at 11pm EST, verify correct date displays
3. Verify moment.js is fully removed from the bundle
4. Check bundle size improvement from tree-shaking

## Risks

- date-fns tree-shaking may not work with certain bundler configs
- Custom DatePicker may have edge cases vs native input
- Other teams may depend on moment.js utilities we're removing
