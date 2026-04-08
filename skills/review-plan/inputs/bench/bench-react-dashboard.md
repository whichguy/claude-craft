# Plan: Build Analytics Dashboard Page

## Context
Build an analytics dashboard page showing summary cards (total revenue, active users, conversion rate, avg order value), a revenue-over-time line chart with date range picker, a top products bar chart, and a paginated/sortable recent orders table. Data comes from the existing REST API at `/api/analytics/*`. Stack: React 18, TypeScript, TailwindCSS, recharts (installed but unused), axios, react-router-dom.

**Project:** web-app (`~/src/web-app`)

## Git Setup

- Feature branch: `git checkout -b feat/analytics-dashboard`

## Implementation Steps

### Phase 1: Page Skeleton & Routing

> Intent: Register the dashboard route and establish the page layout grid before adding any data or components.

**Pre-check:** Confirm `/dashboard` route does not already exist in `src/App.tsx`
**Outputs:** `src/pages/Dashboard.tsx`, updated `src/App.tsx`

1. Add route in `src/App.tsx`:
   ```tsx
   <Route path="/dashboard" element={<Dashboard />} />
   ```
   Import `Dashboard` from `src/pages/Dashboard`.

2. Create `src/pages/Dashboard.tsx` with a top-level layout:
   - Page title/header area
   - Summary cards row: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
   - Two-column chart area below: line chart (2/3 width) + bar chart (1/3 width) on `lg`, stacked on mobile
   - Full-width data table section at the bottom
   - Placeholder content in each slot for now

3. Add "Dashboard" link to the app's navigation (sidebar or header — match existing nav pattern)

**Phase 1 commit:** `git add src/pages/Dashboard.tsx src/App.tsx src/components/Sidebar.tsx && git commit -m "feat: add dashboard page skeleton and routing"`

### Phase 2: API Layer & Data Hooks

> Intent: Define typed API functions and React hooks so components can consume data without knowing fetch details.

**Pre-check:** Verify `src/api/client.ts` exports a configured axios instance
**Outputs:** `src/api/analytics.ts`, `src/hooks/useAnalytics.ts`, `src/types/analytics.ts`

4. Create `src/types/analytics.ts` — TypeScript interfaces for all API responses:
   ```ts
   interface SummaryData {
     totalRevenue: number;
     activeUsers: number;
     conversionRate: number;
     avgOrderValue: number;
   }

   interface RevenueDataPoint {
     date: string;
     revenue: number;
   }

   interface TopProduct {
     productName: string;
     totalSales: number;
   }

   interface Order {
     id: string;
     customerName: string;
     product: string;
     amount: number;
     status: string;
     date: string;
   }

   interface PaginatedOrders {
     orders: Order[];
     total: number;
     page: number;
     pageSize: number;
   }
   ```

5. Create `src/api/analytics.ts` — API functions using the existing axios client:
   - `fetchSummary()` — `GET /api/analytics/summary`
   - `fetchRevenue(start: string, end: string)` — `GET /api/analytics/revenue?start=&end=`
   - `fetchTopProducts(limit: number)` — `GET /api/analytics/top-products?limit=`
   - `fetchOrders(page: number, sort: string, order: 'asc' | 'desc')` — `GET /api/analytics/orders?page=&sort=&order=`

6. Create `src/hooks/useAnalytics.ts` — custom hooks wrapping each API call:
   - `useSummary()` — fetches on mount, returns `{ data, isLoading, error }`
   - `useRevenue(start: string, end: string)` — refetches when date range changes
   - `useTopProducts(limit: number)` — fetches on mount with default limit of 10
   - `useOrders(page: number, sort: string, order: string)` — refetches on pagination/sort changes
   - Each hook uses `useState` + `useEffect` (or React Query if it's already in the project — check `package.json` first). Handle loading and error states internally.

**Phase 2 commit:** `git add src/types/analytics.ts src/api/analytics.ts src/hooks/useAnalytics.ts && git commit -m "feat: add analytics API layer and data hooks"`

### Phase 3: Summary Cards

> Intent: Build the summary card row showing the four KPIs.

**Pre-check:** Check if the existing `src/components/Card` component can be extended or if a new component is needed
**Outputs:** `src/components/dashboard/SummaryCard.tsx`, integration in Dashboard

7. Create `src/components/dashboard/SummaryCard.tsx`:
   - Props: `{ title: string; value: string | number; icon?: ReactNode; formatAs?: 'currency' | 'percent' | 'number' }`
   - Use the existing `Card` component as the wrapper if it fits, otherwise build with Tailwind
   - Format values: currency gets `$` prefix + commas, percent gets `%` suffix, number gets commas
   - Responsive: full width on mobile, quarter width on desktop (handled by parent grid)

8. Wire into `Dashboard.tsx`:
   - Call `useSummary()` hook
   - Render four `SummaryCard` instances: Total Revenue (currency), Active Users (number), Conversion Rate (percent), Avg Order Value (currency)
   - Show loading skeleton placeholders while `isLoading` is true

**Phase 3 commit:** `git add src/components/dashboard/SummaryCard.tsx src/pages/Dashboard.tsx && git commit -m "feat: add summary metric cards to dashboard"`

### Phase 4: Revenue Line Chart with Date Range Picker

> Intent: Add the revenue-over-time visualization with user-selectable date range.

**Pre-check:** `npm ls recharts` confirms it is installed
**Outputs:** `src/components/dashboard/RevenueChart.tsx`, `src/components/dashboard/DateRangePicker.tsx`

9. Create `src/components/dashboard/DateRangePicker.tsx`:
   - Props: `{ startDate: string; endDate: string; onChange: (start: string, end: string) => void }`
   - Preset buttons for common ranges: Last 7 days, Last 30 days, Last 90 days, Year to date
   - Two date inputs (`<input type="date">`) for custom range
   - Styled with Tailwind, compact layout that sits above the chart

10. Create `src/components/dashboard/RevenueChart.tsx`:
    - Props: `{ data: RevenueDataPoint[] }`
    - Uses recharts `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`
    - X-axis: dates (formatted nicely, e.g., "Mar 15")
    - Y-axis: revenue with currency formatting
    - Tooltip shows exact date and formatted revenue value
    - Line color should match the app's primary brand color

11. Wire into `Dashboard.tsx`:
    - Add `useState` for `startDate` and `endDate`, default to last 30 days
    - Call `useRevenue(startDate, endDate)` hook
    - Render `DateRangePicker` above `RevenueChart`
    - Show loading state while data fetches after date range change

**Phase 4 commit:** `git add src/components/dashboard/RevenueChart.tsx src/components/dashboard/DateRangePicker.tsx src/pages/Dashboard.tsx && git commit -m "feat: add revenue line chart with date range picker"`

### Phase 5: Top Products Bar Chart

> Intent: Show a bar chart of the highest-selling products.

**Outputs:** `src/components/dashboard/TopProductsChart.tsx`

12. Create `src/components/dashboard/TopProductsChart.tsx`:
    - Props: `{ data: TopProduct[] }`
    - Uses recharts `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`
    - Horizontal bar chart (use `layout="vertical"` on BarChart) — product names on Y-axis, sales on X-axis
    - Tooltip shows product name and exact sales figure
    - Bar color distinct from the line chart color

13. Wire into `Dashboard.tsx`:
    - Call `useTopProducts(10)` hook
    - Render `TopProductsChart` alongside the revenue chart in the two-column layout
    - Loading skeleton while fetching

**Phase 5 commit:** `git add src/components/dashboard/TopProductsChart.tsx src/pages/Dashboard.tsx && git commit -m "feat: add top products bar chart"`

### Phase 6: Recent Orders Table with Pagination & Sorting

> Intent: Display recent orders in a sortable, paginated table.

**Pre-check:** Review existing `src/components/Table` to determine if it supports sorting and pagination or needs wrapping
**Outputs:** `src/components/dashboard/OrdersTable.tsx`

14. Create `src/components/dashboard/OrdersTable.tsx`:
    - Props: `{ data: PaginatedOrders; onPageChange: (page: number) => void; onSort: (field: string, order: 'asc' | 'desc') => void; currentSort: { field: string; order: 'asc' | 'desc' } }`
    - Columns: Order ID, Customer, Product, Amount ($), Status (with color-coded badge), Date
    - Sortable column headers — clicking toggles asc/desc, visual indicator on active sort column
    - Pagination controls at bottom: Previous/Next buttons, "Page X of Y" display, page size info
    - Extend or wrap the existing `Table` component if it provides a useful base; otherwise build with Tailwind (`table`, `divide-y`, etc.)

15. Wire into `Dashboard.tsx`:
    - Add `useState` for `page` (default 1), `sortField` (default 'date'), `sortOrder` (default 'desc')
    - Call `useOrders(page, sortField, sortOrder)` hook
    - Render `OrdersTable` with callbacks that update state
    - Loading state: show skeleton rows or a spinner overlay on the table

**Phase 6 commit:** `git add src/components/dashboard/OrdersTable.tsx src/pages/Dashboard.tsx && git commit -m "feat: add paginated orders table to dashboard"`

### Phase 7: Error Handling, Loading States & Polish

> Intent: Ensure the dashboard handles failures gracefully and looks polished.

**Pre-check:** Dashboard renders correctly with live data from all four endpoints
**Outputs:** Updated components with error/loading states

16. Add consistent loading skeletons across all sections:
    - Summary cards: pulsing placeholder rectangles (`animate-pulse bg-gray-200 rounded`)
    - Charts: skeleton rectangle matching chart dimensions
    - Table: skeleton rows with pulsing cells

17. Add error handling for each section independently:
    - If an API call fails, show an inline error message with a "Retry" button for that section only
    - Other sections should continue to work — one failed endpoint should not break the whole page

18. Empty state handling:
    - Revenue chart with no data: show "No data for selected date range" message
    - Orders table with no results: show "No orders found" message

19. Visual polish:
    - Consistent spacing and section headers
    - Responsive behavior: verify layout works at mobile (375px), tablet (768px), desktop (1280px) breakpoints
    - Match typography and color scheme to existing pages (Home, Settings, Profile)

**Phase 7 commit:** `git add src/pages/Dashboard.tsx src/components/dashboard/ && git commit -m "feat: add error handling, loading states, and polish to dashboard"`

## File Structure (New Files)

```
src/
├── types/
│   └── analytics.ts              # TypeScript interfaces for API responses
├── api/
│   └── analytics.ts              # API functions (uses existing client.ts)
├── hooks/
│   └── useAnalytics.ts           # Data-fetching hooks for each endpoint
├── components/
│   └── dashboard/
│       ├── SummaryCard.tsx        # Individual KPI card
│       ├── DateRangePicker.tsx    # Date range selector with presets
│       ├── RevenueChart.tsx       # Line chart (recharts)
│       ├── TopProductsChart.tsx   # Bar chart (recharts)
│       └── OrdersTable.tsx        # Paginated, sortable table
└── pages/
    └── Dashboard.tsx              # Main dashboard page (layout + orchestration)
```

## Modified Files

- `src/App.tsx` — add `/dashboard` route
- Navigation component (sidebar or header) — add Dashboard link

## Verification

- Navigate to `/dashboard` — page loads, all four sections render with data
- Summary cards show correct values matching API response
- Change date range on revenue chart — chart re-renders with new data, no stale data flash
- Click column headers on orders table — rows re-sort, sort indicator updates
- Click pagination — table shows correct page, page indicator updates
- Resize browser to mobile width — layout stacks vertically, no horizontal overflow
- Disconnect network / return 500 from API — each section shows error state with retry button, other sections unaffected
- `npm run build` succeeds with no TypeScript errors
- `npm test` passes (add tests if time permits, but not blocking for this phase)
