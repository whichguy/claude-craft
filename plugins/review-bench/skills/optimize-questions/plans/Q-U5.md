# Plan: Search Interface for Knowledge Base

## Context

Our internal knowledge base app needs a search interface that lets employees find
articles, FAQs, and documentation. The search page has a search box, filter buttons
for content type (Article, FAQ, Video), a results list, and pagination. The API at
`GET /api/search?q=...&type=...&page=...` returns paginated results.

## Current State

- React 18 + TypeScript SPA
- No search UI exists yet — users browse by category only
- API supports full-text search with type filtering and pagination (20 per page)
- Design system uses Tailwind CSS with custom components in `src/components/ui/`
- Existing components use semantic HTML with proper accessibility

## Approach

We will build a SearchPage component with a prominent search box, clickable filter
chips for content types, a results list, and page navigation. The interface will be
keyboard-friendly and work well for rapid query-refine cycles.

## Files to Create/Modify

- `src/pages/SearchPage.tsx` (new) — main search page
- `src/components/search/SearchBox.tsx` (new) — search input component
- `src/components/search/FilterChips.tsx` (new) — type filter chips
- `src/components/search/ResultCard.tsx` (new) — individual result display
- `src/components/search/Pagination.tsx` (new) — page navigation
- `src/hooks/useSearch.ts` (new) — search API hook
- `src/types/search.ts` (new) — search types

## Implementation

### Phase 1: Types & Hook

1. Create `search.ts` with types:
   ```typescript
   type ContentType = 'article' | 'faq' | 'video';
   interface SearchResult { id: string; title: string; excerpt: string; type: ContentType; url: string; }
   interface SearchResponse { results: SearchResult[]; total: number; page: number; }
   ```

2. Create `useSearch.ts` hook:
   - Accepts `query`, `type`, `page` parameters
   - Calls `GET /api/search` with query params
   - Returns `{ results, total, isLoading }`
   - Debounces search by 300ms

### Phase 2: Search Box

1. Create `SearchBox.tsx`:
   - Render a `<div>` with an `<input type="text">` inside
   - Add a magnifying glass icon `<div>` to the left of the input
   - Style with Tailwind: large input, rounded corners, shadow on focus
   - Call `onChange` prop with debounced value
   - Add a clear `<div>` button that appears when input has value

### Phase 3: Filter Chips

1. Create `FilterChips.tsx`:
   - Render a row of `<div>` elements styled as pill-shaped chips
   - Three chips: "Articles", "FAQs", "Videos" plus an "All" chip
   - Active chip gets filled background color, inactive gets outline style
   - Each chip has an `onClick` handler that calls `onFilterChange(type)`
   - Chips use `cursor: pointer` and color change on hover

### Phase 4: Results & Pagination

1. Create `ResultCard.tsx`:
   - Render a `<div>` container with title, excerpt, and type badge
   - Title is a clickable `<div>` styled as a link (blue, underline on hover)
   - Excerpt is a `<p>` with truncated text (2 lines max)
   - Type badge is a colored `<span>` (green=article, blue=faq, purple=video)
   - The whole card has hover effect (slight background change)

2. Create `Pagination.tsx`:
   - Render `<div>` containers for Previous/Next and page numbers
   - Previous/Next are `<div>` elements with click handlers
   - Current page number is bolded, others are clickable `<div>` elements
   - Show "Page X of Y" text between the navigation elements

### Phase 5: Assembly

1. Build `SearchPage.tsx` combining all components:
   - SearchBox at top, FilterChips below it, results list, pagination at bottom
   - Wire state: query string, active filter, current page
   - Reset page to 1 when query or filter changes
   - Show result count: "Showing X of Y results"
2. Add route for `/search` in the app router

## Verification

1. Navigate to `/search` — search box renders and is focusable
2. Type a query — results appear after debounce
3. Click a filter chip — results update to show only that type
4. Click a result title — navigates to the content URL
5. Click Next/Previous — pagination works correctly
6. Clear search — results clear and filter resets
7. Test with no results — empty state message shows
8. Verify all interactive elements respond to click events
