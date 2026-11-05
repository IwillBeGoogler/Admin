# Admin UX Spec (one-pass scope)

Owner: Design Lead. Base: code as read on 2026-10-06. All paths are relative to `Frontend/Admin/react/`.
Priority: **P0** blocks daily operator flow or a11y AA; **P1** big speed gain; **P2** polish.
Suggested order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13.

## What exists today (verified)
- Fixed 240px sidebar at `lg+`, mobile Radix Dialog drawer (`src/app/layout/AdminLayout.tsx:144-176`). Desktop sidebar cannot collapse.
- `DataTable` only renders rows. No sorting, selection, density, or sticky header (`src/shared/ui/data-table.tsx:11-53`).
- Each page builds its own loading/error/empty/LoadMore branches (`PostsPage.tsx:202-223`, `UsersPage.tsx:106-127`, `CommentsPage.tsx:63-84`, `ReportsPage.tsx:129-150`).
- `ConfirmDialog` exists, and its focus lands on Cancel (`src/shared/ui/dialog.tsx:44-95`). The confirm button shows no pending indicator.
- `ReportsPage` `DecideDialog` uses the plain `Dialog`, even when "remove content" (destructive) is checked (`ReportsPage.tsx:188-209`).
- Toaster: `top-right`, richColors, closeButton (`src/app/providers.tsx:9`).
- Nothing in `src/` handles keyboard shortcuts, sets `document.title`, or guards unsaved changes (grep for `keydown|document.title|useBlocker|beforeunload` returns no matches).
- Tokens: colour tokens only (`src/styles.css:5-59`). No radius, density, `--success`, or `--warning` tokens. `OfflineBanner` hard-codes `amber-*` (`states.tsx:71`).
- Comments page has no search or filter (`CommentsPage.tsx:59-85`).

---

## P0

### 1. Shared `ListView` scaffold (loading, error, empty, refetch states)
**Files:** new `src/shared/ui/list-view.tsx`. Refactor `PostsPage`, `UsersPage`, `CommentsPage`, `ReportsPage`, `BansPage`, `AuditPage`, `SessionsPage`, `RolesPage`, `TaxonomyPages`.
**Behavior:**
- Props: `query` (infinite or plain query result), `toolbar?: ReactNode`, `empty: { title, hint?, action? }`, `filtered: boolean`, `onClearFilters?`, plus a `children(items)` render function.
- States:
  - `isPending` → `LoadingRows rows={8}`.
  - `isError` → `ErrorState`.
  - Empty and `filtered` → "No results for current filters" with a `Button variant="outline" size="sm"` labelled "Clear filters".
  - Empty and not `filtered` → `empty.title` and `empty.hint`, with `empty.action` (for example "New post") when given.
- Background refetch (`isFetching && !isPending`): show a 2px indeterminate bar at the top of the Card (`absolute inset-x-0 top-0 h-0.5 bg-primary/60 animate-pulse`). Keep the stale rows visible and never swap them for skeletons.
- Extend `EmptyState` to `{ icon?, title, hint?, action? }`. Title uses `text-sm font-medium text-foreground`; hint uses `text-muted-foreground`.

**Acceptance:**
- No page contains its own `isPending ? … : isError ? …` chain.
- When a filter matches nothing, the "Clear filters" button appears and resets the URL search params.
- Rows do not flash to skeletons on refetch.

### 2. DataTable: sortable headers, sticky header, row selection, bulk bar
**Files:** `src/shared/ui/data-table.tsx`, `src/shared/ui/table.tsx`, new `src/shared/ui/bulk-bar.tsx`, plus page usage.
**Behavior:**
- **Sort**
  - New optional props `sort?: { id: string; desc: boolean }` and `onSortChange?`. Sorting is controlled from the URL search param `sort=field` or `sort=-field`. Only columns with `meta.sortable: true` can be sorted.
  - The header becomes a `<button>` inside `<th aria-sort="ascending|descending|none">`, with lucide `ArrowUp`/`ArrowDown`/`ChevronsUpDown` at `size-3.5`.
  - If the backend does not support sorting a list, sort client-side over the loaded pages and show a hint: "Sorted within loaded rows".
- **Sticky header:** `THead` gets `sticky top-14 z-10 bg-card` (header height is 56px = `h-14`). Change the `Table` wrapper to `overflow-x-auto` with `overflow-y: clip` so sticky still works.
- **Selection**
  - Opt-in prop `selectable` adds a first column with a Checkbox (`aria-label="Select row @{name}"`). The header checkbox is tri-state (`indeterminate`).
  - Selection is keyed by `getRowId` and resets when filters change.
  - Shift+click selects a range.
- **Bulk bar:** when `selected > 0`, render a `role="region" aria-label="Bulk actions"` bar.
  - Classes: `sticky bottom-4 mx-auto flex w-fit items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg`.
  - Content: "{n} selected", the actions, and "Clear" (`Esc` also clears).
- **Initial bulk actions**
  - Comments: Delete.
  - Reports: Resolve and Dismiss.
  - Posts: Delete, only for rows the operator may delete. Filter by the same rule as `PostsPage.tsx:79`.
  - Run them as `Promise.allSettled` over the existing single mutations, with at most 4 in parallel.
  - Always use `ConfirmDialog` and state the count: "Delete 12 comments?".
  - Finish with one toast: success "12 deleted", or mixed "10 deleted, 2 failed" plus a "Show failed" action that re-selects only the failed rows.
- Row hover stays as is. Add `data-[state=selected]:bg-primary/5` on `TR`.

**Acceptance:**
- Screen readers announce `aria-sort`.
- Selecting 3 rows and deleting runs one confirm and produces one summary toast.
- The header stays visible while scrolling 50+ rows.
- Keyboard: Space toggles the focused row checkbox.

### 3. Destructive-action consistency and dialog pending state
**Files:** `src/shared/ui/dialog.tsx`, `ReportsPage.tsx` (DecideDialog), `SanctionDialog.tsx`, `SessionsPage.tsx`, `RolesPage.tsx`, `TaxonomyPages.tsx`, `BansPage.tsx`.
**Behavior:**
- `ConfirmDialog`
  - Add `variant?: "destructive" | "default"`.
  - While pending, the confirm button shows `Loader2Icon className="animate-spin"` and its label. Also set `aria-busy`, and block Esc and overlay close (`onEscapeKeyDown`/`onPointerDownOutside` → `preventDefault` when pending).
  - Close only on success. On error, keep the dialog open and show the message inline (`role="alert" text-sm text-destructive`) as well as the toast.
- Every irreversible action goes through `ConfirmDialog`: delete, ban, revoke session, delete role or taxonomy, and resolve with remove-content. In `DecideDialog`, the button is already destructive-styled when `remove` is checked; it also needs the pending spinner and the Esc lock.
- The confirm label repeats the verb and object ("Delete post"), not just "OK".
- High-risk actions (delete role, ban permanently) require typing the name to enable confirm. Use a `confirmText?: string` prop.

**Acceptance:**
- Grep shows no destructive mutation called without a confirm.
- Double-clicking confirm sends one request.
- Esc does nothing while a request is in flight.

### 4. WCAG 2.2 AA fixes
**Files:** `src/styles.css`, `button.tsx`, `AdminLayout.tsx`, `table.tsx`, `__root.tsx`/route files.
**Behavior:**
- **Contrast:** dark-mode `destructive` is `oklch(0.65 0.2 25)` with `text-white` (`button.tsx:12`), which likely fails 4.5:1. Add a `--destructive-foreground` token: light `oklch(0.99 0 0)`, dark `oklch(0.16 0.01 260)`. Use `text-destructive-foreground` and check the contrast with a contrast tool. Check `muted-foreground` on `muted` and `sidebar` backgrounds in both themes as well.
- **Target size (2.5.8):** `size="icon"` is 36px, which passes. `sm` is 32px, which passes. Keep 24px as the minimum, and do not introduce smaller icon buttons.
- **Focus not obscured (2.4.11):** add `scroll-padding-top: 4rem` to `html` so the sticky header (and sticky thead) never hides the focused row.
- **Focus on route change:** after navigation, move focus to `<h1>` (give `PageHeader` h1 `tabIndex={-1}`, focus it in an effect keyed on pathname). Set `document.title = "{page} · {app.name}"` via a `usePageTitle(title)` hook called by `PageHeader`.
- **Status chips:** Reports filter "tabs" use `aria-pressed`, which is fine. Add the count in `sr-only` once item 9 adds counts.
- **Tables:** the actions column already has an `sr-only` header, which is good. Make each row's main link the accessible name, as it already is.

**Acceptance:**
- axe (vitest + `@axe-core/react` or `vitest-axe`) shows zero serious or critical issues on every route in both themes.
- Tab after navigation starts at the page h1.
- The tab title changes per route.

---

## P1

### 5. Command palette (Cmd/Ctrl+K)
**Files:** new `src/app/command/CommandPalette.tsx`. Mount it in `AdminLayout.tsx`. Add a "Search… ⌘K" trigger button in the header.
**Dependency:** `bun add cmdk` (latest). It is Radix-Dialog based, about 5 KB, and accessible. Rejected alternative: hand-rolling a listbox, which costs more effort and a11y risk.
**Behavior:**
- **Sources**
  1. Navigation: `visibleNavigation(canAny)`, which respects permissions.
  2. Actions: "New post" (when `post.create`), "Toggle theme", "Switch language → en/ru/uz", "Log out".
  3. Remote: debounced (250ms) search across posts and users using the existing hooks/repositories, with up to 5 results each. Only run when the query is at least 2 characters.
- Groups carry headings. Each item shows its icon and, where one exists, its shortcut hint (`kbd` class: `rounded border px-1.5 font-mono text-[11px] text-muted-foreground`).
- Recent: the last 5 visited routes, stored in `localStorage["admin.recent"]`.
- Opens on `Mod+K` and on `/` when focus is not in an input.

**Acceptance:**
- `Ctrl+K`, type "rep", Enter goes to `/reports`.
- Items the admin lacks permission for never appear.
- Fully operable with arrows, Enter, and Esc.
- All labels are translated in en/ru/uz.

### 6. Keyboard shortcuts with a help sheet
**Files:** new `src/shared/lib/useHotkeys.ts` (tiny; no dependency), `AdminLayout.tsx`, list pages.
**Behavior:**
- **Global**
  - `g d/p/r/c/u/b/a`: go to Dashboard, Posts, Reports, Comments, Users, Bans, Audit. This is a two-key sequence with a 1s timeout.
  - `?`: open the shortcuts dialog.
  - `Mod+K`: open the palette.
- **List pages**
  - `/`: focus the search input.
  - `n`: new item where allowed.
  - `j`/`k`: move the row focus ring.
  - `x`: toggle selection.
  - `Enter`: open the row.
  - `Esc`: clear selection.
- Disable every shortcut while focus is in `input`, `textarea`, `select`, or `[contenteditable]`, or while a dialog is open.
- The shortcuts dialog is generated from one registry, so the docs always match the code.

**Acceptance:**
- Typing "g" in a search box does nothing.
- On `/reports`, `j j x` selects the second row.
- `?` lists every binding.

### 7. Collapsible desktop sidebar
**Files:** `AdminLayout.tsx`, new `src/app/layout/useSidebar.ts`.
**Behavior:**
- **Collapse state:** toggle with the `PanelLeftIcon` button in the sidebar footer, or `Mod+B`. Persist in `localStorage["admin.sidebar"]`.
  - Expanded: `w-60`, content `lg:pl-60`.
  - Collapsed: `w-14`, content `lg:pl-14`.
  - Animate with `transition-[width,padding] duration-200`.
- **Collapsed sidebar:**
  - Labels become `sr-only`.
  - Each item gets a Radix Tooltip (`side="right"`) carrying its label.
  - Group labels become a 1px divider (`mx-3 border-t`).
- **Sidebar footer** (both states): user chip (avatar initial plus username) linked to Sessions. Logout moves into a user dropdown, which frees header space.
- **Active link:** keep `data-[status=active]` styles and add `aria-current="page"` (TanStack sets it; verify in a test).
- **Mobile drawer:** unchanged, but close it on route change via router subscription instead of `onClick` only, which covers palette navigation too.

**Acceptance:**
- The collapsed state survives a reload.
- Every icon in collapsed mode has an accessible name.
- No layout shift of `main` other than the width transition.

### 8. Filters synced to the URL, with visible chips and a reset
**Files:** `PostsPage.tsx`, `UsersPage.tsx`, `CommentsPage.tsx`, `AuditPage.tsx`, `BansPage.tsx`, new `src/shared/ui/filter-chips.tsx`.
**Behavior:**
- Every filter lives in the route search, as Posts, Users, and Reports already do, so links are shareable and Back works.
- Below the toolbar, show one active chip per filter (`Badge variant="secondary"` with an `XIcon` remove button `aria-label="Remove filter {name}"`) and a "Reset all" link.
- Replace the ad-hoc tag row (`PostsPage.tsx:193-200`, which wrongly says "Close") with a chip.
- Disabled filters (`own` source, `PostsPage.tsx:44`) show a helper `text-xs text-muted-foreground` explaining why.
- Add search to Comments (by text or author) if the API supports it. Otherwise this is an open question.
- Search inputs: put a clear button in the input (type=search already gives this in some browsers; make it explicit) and show the `/` kbd hint on the right.

**Acceptance:**
- Reloading a filtered URL restores the exact view.
- Each chip removes exactly one filter.
- Browser Back undoes the last filter change.

### 9. Moderation queue counts in the nav and on tabs
**Files:** `nav.ts` (add an optional `badge?: "reports.open"`), `AdminLayout.tsx`, `ReportsPage.tsx`, the moderation hooks.
**Behavior:**
- Show the open-report count as a pill on the "Reports" nav item (`ml-auto rounded-full bg-destructive/10 px-1.5 text-xs tabular-nums text-destructive`) and on the "Open" tab.
- Source: `meta.total` of `useReports({status:"open"})` page 1, with `staleTime` 60s and refetch on window focus.
- Hide the pill when the count is 0, and show `99+` above 99.

**Acceptance:**
- Resolving a report decrements the count after the mutation invalidates the query.
- The nav pill text is part of the link's accessible name ("Reports, 5 open").

---

## P2

### 10. Spacing, typography, and radius tokens
**Files:** `src/styles.css`, `card.tsx`, `table.tsx`, `states.tsx`.
**Behavior:**
- Add to `@theme`:
  - `--radius: 0.5rem`, plus `--radius-sm/md/lg/xl` derived from it.
  - `--color-success`, `--color-warning`, and their `-foreground` pairs, in both themes.
  - `--color-destructive-foreground`.
- Replace `amber-*` in `OfflineBanner` and the `success`/`warning` badge variants with these tokens.
- **Type scale:**
  - Page h1: `text-2xl font-semibold tracking-tight`, as now.
  - Section h2: `text-base font-semibold`.
  - Table: `text-sm`.
  - Meta text: `text-xs text-muted-foreground`.
  - Numbers: always `tabular-nums`.
- **Spacing rhythm:**
  - Page: `p-4 sm:p-6`.
  - Card toolbar: `p-3 sm:p-4`, `gap-3`.
  - Between page sections: `gap-6`.
  - Document this in a comment block at the top of `styles.css`.

**Acceptance:** grep finds no raw palette colours (`amber-|green-|red-`) in `src/`.

### 11. Table density toggle and truncation
**Files:** `data-table.tsx`, `table.tsx`.
**Behavior:**
- A "Comfortable/Compact" toggle in the table toolbar sets `data-density` on the table, persisted in localStorage.
  - Compact: `TD py-1.5`, `TH h-8`.
  - Comfortable: as now.
- Long text cells use `truncate` with `title` set to the full value.
- Dates show relative time ("3 h ago"), with the absolute time in `title` and `<time dateTime>`. Add this to `src/shared/lib/format.ts` via `Intl.RelativeTimeFormat` (localized for free in en/ru/uz).

**Acceptance:** compact mode shows at least 30% more rows per viewport at 1080p.

### 12. Toast policy
**Files:** `providers.tsx` and all `toast.*` call sites.
**Behavior:**
- **Position:** `bottom-right`, so toasts do not cover the header toolbar.
- **Duration:** 4s for success; errors stay until dismissed (`duration: Infinity`).
- **Content:** success toasts name the object ("Post “X” deleted"). Error toasts include the problem `detail` from `errorMessage`, plus a "Retry" action where the mutation is idempotent.
- **Undo:** where the backend allows reversal (unban, restore?), add an "Undo" action. This is an open question; see below.
- Never show both a toast and an inline error for the same validation failure in forms. Forms use inline errors only.

**Acceptance:** an error toast persists until closed, and success toasts include the item name.

### 13. Unsaved-changes guard in the Post editor
**Files:** `src/contexts/content/ui/PostEditorPage.tsx`.
**Behavior:**
- Track the dirty state. Wire TanStack Router `useBlocker({ shouldBlockFn: () => dirty, withResolver: true })` to `ConfirmDialog` with the text "Discard changes?", and add `beforeunload`.
- `Mod+S` saves; `Mod+Enter` saves and publishes, if that is allowed.

**Acceptance:** navigating away from a dirty editor prompts, and a clean editor does not.

---

## Out of scope this pass
Saved views, column visibility and reordering, virtualised tables (list sizes are paginated; not needed yet), and dashboard redesign.

## Open questions (owner, needed by)
1. **Backend list sorting and search:** which list endpoints accept `sort=` and `q=` (comments, audit, bans)? Owner: Backend lead, before item 2 and item 8 start. Until then, item 2 uses the client-side fallback.
2. **Bulk endpoints:** none were found in the frontend repositories. Item 2 loops over single calls. If any list routinely needs more than 50-row bulk operations, ask the backend for batch endpoints.
3. **Undo:** which actions are reversible server-side (unban, restore post)? Owner: Backend lead. This only affects item 12.
4. **Contrast values in item 4:** these are inferred from the OKLCH lightness values, not measured. The Design QA Engineer must measure them before item 4 is closed.
