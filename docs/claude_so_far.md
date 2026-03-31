# PostPro - Progress So Far

## Project Overview
PostPro is an Electron desktop app (React + TypeScript + Tailwind CSS v4) for making API calls to endpoints. It uses Supabase for auth (Microsoft/Azure OAuth) and data storage, scoped by company via `users.current_company_id`.

## What Has Been Done

### 1. Style Guide & Color System
- Created `STYLE_GUIDE.md` with a full color palette using the `op-` prefix
- Colors: primary (`#175673`), secondary (`#4C2878`), tertiary (`#1B5E3B`), error (`#B91C1C`), success (`#15803D`), warning (`#B45309`), disabled (`#6B7280`)
- Registered colors in `src/renderer/src/assets/main.css` via `@theme` block
- Added button design system to style guide with sizes (sm/md/lg) and variants (primary/secondary/danger/success/disabled)

### 2. Reusable Button Component
- Created `src/renderer/src/components/Button.tsx`
- Props: `variant`, `size`, `disabled`, `className`, plus all standard button attributes
- Auto-styles disabled state with `op-disabled` color

### 3. CSS Base Fixes
- Removed `margin: 0` and `padding: 0` from `*` selector in `base.css` (was overriding Tailwind utilities)
- Moved `base.css` import before `tailwindcss` import for correct cascade order
- Body background set to primary color (`#175673`)

### 4. Window Configuration
- Window size set to 70% of screen width and height using `screen.getPrimaryDisplay().workAreaSize`
- Auto-hide menu bar enabled

### 5. Microsoft Sign-In Button
- Styled as official Microsoft branded button (white bg, dark text, Microsoft 4-color logo SVG)
- Located in `LoginPage` component

### 6. User Menu (Top Right)
- Circular avatar showing first 2 letters of user email
- Click to open dropdown with "Signed in as" info and "Sign out" button
- Click-outside-to-close behavior
- Component: `UserMenu` in `App.tsx`

### 7. Auth Context Updates
- Added `companyId` to `AuthContext` — fetched from `users` table via `auth_user_id` after session init
- Added error handling with `.finally()` to ensure loading state always resolves
- Debug logs still present (can be removed)

### 8. TypeScript Types
- Created `src/renderer/src/types/index.ts`
- Types: `Collection`, `Request`, `Environment`, `EnvironmentVariable`, `AppUser`
- All match the Supabase database schema

### 9. Service Layer (Class-Based)
- `src/renderer/src/services/CollectionService.ts` — CRUD for `postpro_collections`
- `src/renderer/src/services/RequestService.ts` — CRUD for `postpro_requests` (includes `getByCollections` for bulk fetch)
- `src/renderer/src/services/EnvironmentService.ts` — CRUD for `postpro_environments` + `postpro_environment_variables`
- All services take a Supabase client in constructor

### 10. Three-Column Layout
- **Column 1 — Sidebar** (`src/renderer/src/components/Sidebar.tsx`): Narrow icon nav with Endpoints and Environments buttons
- **Column 2 — Context Panel**: Switches between `EndpointsPanel` and `EnvironmentsPanel` based on active nav
- **Column 3 — Detail Panel** (`src/renderer/src/components/DetailPanel.tsx`): Empty placeholder, shows "Select a request or environment to view details"
- Top bar with "PostPro" title and UserMenu

### 11. Endpoints Panel (`src/renderer/src/components/EndpointsPanel.tsx`)
- Loads collections and requests from Supabase, scoped by `companyId`
- Recursive tree: collections can nest via `parent_collection_id`
- Expand/collapse folders with chevron icon
- Color-coded HTTP method labels (GET=green, POST=yellow, PUT=blue, PATCH=orange, DELETE=red, HEAD=purple, OPTIONS=gray)
- Shows environment name badge on folders that have an `environment_id`
- **Right-click context menu on folders**: New Folder, New Request, Rename, Delete
- **Right-click context menu on requests**: Rename, Delete
- Inline rename input (Enter to save, Escape to cancel, click-away to save)
- Context menu component: `src/renderer/src/components/ContextMenu.tsx`

### 12. Environments Panel (`src/renderer/src/components/EnvironmentsPanel.tsx`)
- Lists all environments from Supabase scoped by `companyId`
- Selectable items with highlight state
- Gear icon per environment

## Database Schema (Existing in Supabase)
- `postpro_collections` — id, company_id, parent_collection_id (for nesting), name, description, environment_id, created_by
- `postpro_requests` — id, collection_id, name, method, url, query_params, headers, body_type, body, sort_order, schema, schema_enabled
- `postpro_environments` — id, company_id, name
- `postpro_environment_variables` — id, environment_id, key, enabled, vault_secret_id
- `postpro_request_boards` — links requests to boards
- `users` — id, display_name, email, current_company_id, auth_user_id

**Note:** `parent_collection_id` column needs to be added to `postpro_collections` in Supabase if not already done:
```sql
alter table public.postpro_collections
  add column parent_collection_id uuid null,
  add constraint postpro_collections_parent_collection_id_fkey
    foreign key (parent_collection_id) references postpro_collections (id) on delete cascade;
```

## What's Next
- Build out the Detail Panel (Column 3) for editing requests (URL bar, method selector, headers, body, params, response viewer)
- Build out the Detail Panel for environments (variable editor)
- Actually execute API calls and display responses
- Environment variable substitution in request URLs/headers/body
