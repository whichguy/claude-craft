# Plan: Analytics Dashboard for Sales Team

## Context

The sales team needs an internal analytics dashboard showing revenue metrics, pipeline
status, and team performance. Currently they export CSVs from the database and build
charts in Google Sheets manually. We need a self-contained HTML dashboard they can
open in a browser, pulling data from our existing REST API.

## Current State

- REST API at `/api/analytics/*` returns JSON (revenue, pipeline, team stats)
- No existing frontend — all data consumed via Sheets or curl
- 8 sales reps need daily access
- Data refreshes every 4 hours via cron

## Approach

We will create a single `dashboard.html` file that contains all HTML, CSS, and JavaScript
inline. The file will include a tab navigation bar, three chart panels (revenue line chart,
pipeline funnel, team bar chart), a date range picker, a filters sidebar with dropdowns
for region/rep/product, a data table with sorting and pagination, and a settings form
for configuring refresh interval and display preferences. We'll use Chart.js loaded from
CDN for visualizations. Everything lives in one file for easy distribution — sales team
just opens the file.

## Files to Create

- `dashboard/dashboard.html` (new) — complete dashboard (~400 lines: HTML structure,
  inline `<style>` block, inline `<script>` block with all logic)

## Implementation

### Phase 1: HTML Structure & Styles (~120 lines)

1. Create `dashboard.html` with full HTML5 boilerplate
2. Add inline `<style>` block with all CSS: layout grid, tab styles, sidebar, chart
   containers, table styles, form elements, responsive breakpoints
3. Build the tab navigation bar with 4 tabs: Overview, Pipeline, Team, Settings
4. Create the filter sidebar with dropdowns for region, rep, product line
5. Add date range picker inputs in the header bar
6. Create placeholder `<canvas>` elements for the three charts
7. Build the data table structure with sortable column headers
8. Add the settings form with refresh interval slider and checkboxes

### Phase 2: JavaScript Logic (~250 lines)

1. Add inline `<script>` block after the HTML body
2. Implement tab switching logic — show/hide panels based on active tab
3. Write `fetchRevenue()`, `fetchPipeline()`, `fetchTeam()` API call functions
4. Initialize Chart.js line chart for revenue trends (12-month view)
5. Initialize Chart.js funnel visualization for pipeline stages
6. Initialize Chart.js horizontal bar chart for team performance
7. Implement date range filtering — re-fetch and re-render charts on change
8. Implement region/rep/product filter handlers with cascading updates
9. Build table rendering with client-side sort (click column header to toggle)
10. Implement pagination for the data table (25 rows per page)
11. Add settings form handlers — save preferences to localStorage
12. Wire up auto-refresh using `setInterval` based on settings
13. Add loading spinners for each chart panel during data fetch
14. Implement error retry with exponential backoff for failed API calls

### Phase 3: Polish

1. Add a "Last Updated" timestamp in the header
2. Add export buttons (CSV download for table data)
3. Add print-friendly styles in a `@media print` block
4. Test all tabs render correctly with sample API responses

## Verification

1. Open `dashboard.html` in Chrome — all 4 tabs should render
2. Verify Chart.js loads from CDN and renders sample data
3. Test tab switching shows correct panels
4. Verify date range picker filters update all charts
5. Test table sorting on each column
6. Confirm settings persist across page reloads via localStorage
7. Test with API offline — verify error states appear
