# Plan: Rename Legacy Identifiers Across Codebase

## Context

Our codebase uses the legacy name "Widget" throughout, but the product was renamed to
"Component" two quarters ago. Marketing, docs, and the UI all say "Component" but the
code still says "Widget" everywhere. This causes confusion during onboarding and in
customer-facing error messages. We need a systematic rename.

## Current State

- TypeScript monorepo: `packages/api`, `packages/client`, `packages/shared`
- "Widget" appears in: type names, function names, file names, database column aliases,
  API route paths, error messages, log statements, comments
- 3 database tables reference "widget" in column names (aliased in Prisma, no migration needed)
- 147 files contain "Widget" or "widget" (via `grep -rl`)
- All tests passing, CI green

## Approach

We will perform the rename in three focused passes, each targeting a specific package.
The Prisma `@@map` annotations already alias "widget" columns to TypeScript names, so
no database migration is needed — only the TypeScript-facing names change. Each pass
renames types, functions, files, route paths, and string literals within one package.

## Files to Modify

**packages/shared** (types + utilities):
- `src/types/Widget.ts` → rename to `Component.ts`, rename all exported types
- `src/types/WidgetConfig.ts` → rename to `ComponentConfig.ts`
- `src/utils/widgetHelpers.ts` → rename to `componentHelpers.ts`, rename functions
- `src/types/index.ts` — update re-exports

**packages/api** (backend):
- `src/routes/widgets.ts` → rename to `components.ts`, update route paths
- `src/services/widgetService.ts` → rename to `componentService.ts`
- `src/controllers/widgetController.ts` → rename to `componentController.ts`
- `src/routes/index.ts` — update route registration

**packages/client** (frontend):
- `src/components/WidgetList.tsx` → rename to `ComponentList.tsx`
- `src/components/WidgetDetail.tsx` → rename to `ComponentDetail.tsx`
- `src/components/WidgetForm.tsx` → rename to `ComponentForm.tsx`
- `src/hooks/useWidgets.ts` → rename to `useComponents.ts`
- `src/pages/WidgetsPage.tsx` → rename to `ComponentsPage.tsx`

## Implementation

### Step 1: Rename shared types and utilities

1. Rename `Widget.ts` to `Component.ts`; update all type/interface names:
   `Widget` → `Component`, `WidgetStatus` → `ComponentStatus`, `WidgetType` → `ComponentType`
2. Rename `WidgetConfig.ts` to `ComponentConfig.ts`; update `WidgetConfig` → `ComponentConfig`
3. Rename `widgetHelpers.ts` to `componentHelpers.ts`; update function names:
   `createWidget()` → `createComponent()`, `validateWidget()` → `validateComponent()`
4. Update `index.ts` barrel to export from new file names

### Step 2: Rename API routes, services, and controllers

1. Rename `widgets.ts` → `components.ts`; change route path from `/api/widgets` to `/api/components`
2. Rename `widgetService.ts` → `componentService.ts`; rename class `WidgetService` → `ComponentService`
3. Rename `widgetController.ts` → `componentController.ts`; rename `WidgetController` → `ComponentController`
4. Update `routes/index.ts` to import and mount from new file names
5. Update all error messages and log statements: "Widget not found" → "Component not found"
6. Add redirect middleware: `GET /api/widgets/*` → 301 to `/api/components/*` for backward compat

### Step 3: Rename client components and hooks

1. Rename `WidgetList.tsx` → `ComponentList.tsx`; update component name, imports
2. Rename `WidgetDetail.tsx` → `ComponentDetail.tsx`; update component name
3. Rename `WidgetForm.tsx` → `ComponentForm.tsx`; update component name
4. Rename `useWidgets.ts` → `useComponents.ts`; update hook name and API endpoint URLs
5. Rename `WidgetsPage.tsx` → `ComponentsPage.tsx`; update page component, route path
6. Update all user-facing strings: "Widgets" → "Components" in headings, labels, messages

### Step 4: Cross-cutting updates

1. Update all import statements across the monorepo to use new module names
2. Update `tsconfig.json` path aliases if any reference widget paths
3. Search for remaining "widget" (case-insensitive) in comments and update
4. Run `tsc --noEmit` to catch any broken references
5. Run full test suite

## Verification

1. `npx tsc --noEmit` — zero type errors across all packages
2. `npm test` — all tests pass in all three packages
3. `grep -ri "widget" packages/` — returns only Prisma `@@map` annotations and git history
4. `GET /api/components` — returns data correctly
5. `GET /api/widgets` — returns 301 redirect to `/api/components`
6. Client app renders "Components" in all UI text
7. No "Widget" appears in any user-facing error message or log output
