# Improvement plan — Mon Mariage

Batched fixes from the feature audit (2026-07-08). Each batch is sized to be implemented
and verified in a single session without re-deriving context. Do them in order unless
noted; batches marked *independent* can be done anytime.

**Conventions** (match existing code): standalone components, Angular signals, French UI
labels, `inject()` over constructor params, API services return the full updated list and
components call `store.replaceX(...)`. Verify each batch with the recipe in
`.claude/skills/verify/SKILL.md` (mock API on :3000 + `ng serve` + Playwright, all
Windows-side via `node.exe`; WSL `curl` cannot reach the servers — that's normal).

**Key files**: client store `client/src/app/data/store.ts`; types `client/src/app/data/types.ts`;
shell `client/src/app/wedding-shell/`; features under `client/src/app/features/<name>/`;
shared UI `client/src/app/shared/`; global styles `client/src/styles.css`;
server modules under `server/src/<name>/`.

---

## Batch 0 — Commit pending work (do first)

The working tree holds verified, unrelated work: drag & drop placement (housing/seating/
guest-sidebar/shell/styles + `@angular/cdk`), wedding favicon (`client/public/`,
`client/src/index.html`), deploy workflow hardening (`.github/workflows/deploy-fullstack-compose.yml`),
volume pinning (`docker-compose.prod.yml`), budget seed-race fix (`server/src/budget/budget.service.ts`).
Commit these (one commit per concern is fine) before starting batches so diffs stay reviewable.

---

## Batch 1 — Shared toast + resilient error handling

**Goal:** no silent API failures anywhere.

1. Create `client/src/app/shared/toast.service.ts`: signal-based queue
   (`{ id, message, tone: 'error' | 'success' }`), `error(msg)` / `success(msg)` methods,
   auto-dismiss ~5s. Create `toast.component.ts` (fixed bottom-right stack) and render it
   once in `wedding-shell.component.html`. Style in `styles.css` — reuse the look of
   `.assign-error` (red tint) already there.
2. Wrap every unprotected API call in try/catch → `toast.error(...)`:
   - `budget.component.ts`: `addCategory`, `updateEstimate`, `deleteCategory`, `addItem`, `deleteItem`
   - `todos.component.ts`: `addGroup`, `deleteGroup`, `toggleDone`, `updateAssignee`, `addTask`, `deleteTask`
   - `vendors.component.ts`: `save`, `deleteVendor`, `quickStatus`
   - `housing.component.ts`: `addHouse`, `confirmDeleteHouse`/`deleteHouse`, `addRoom`, `saveRoom`, `deleteRoom`
   - `guests.component.ts`: `saveGuest`, `deleteGuest` currently set `importError` — route these to toasts, keep `importMessage`/`importError` for the import flow only.
   - housing/seating `moveGuest` already reverts + sets `assignError` signal; optionally migrate that banner to toasts for consistency (keep the optimistic-revert logic).
3. `wedding-shell.component.ts` `loadInitialData` uses one `Promise.all` — **if any one of
   the 6 GETs fails the whole app silently starts empty** (observed during verification).
   Switch to `Promise.allSettled`, apply the fulfilled ones, toast once if any rejected.

**Verify:** mock API up → CRUD on budget/todos works with no toast; kill/abort `/api/**`
(Playwright `page.route` abort) → clicking Ajouter/Supprimer shows a toast, UI unchanged.

---

## Batch 2 — Confirm dialogs on the four unguarded deletes *(independent)*

`ConfirmDialogComponent` (`client/src/app/shared/confirm-dialog.component.ts`) exists;
copy the exact pattern from `guests.component.ts` (`guestPendingDeletion` field +
`requestDelete` / `cancelDelete` / `confirmDelete` methods + template block at the bottom
of `guests.component.html`).

Wire it for:
1. Budget category (`budget.component.ts` `deleteCategory`) — message: name + item count ("et ses N dépenses").
2. Todo group (`todos.component.ts` `deleteGroup`) — message: title + task count.
3. Room (`housing.component.ts` `deleteRoom`) — details: occupants "redeviendront sans logement".
4. Vendor (`vendors.component.ts` `deleteVendor`) — the delete button lives inside the edit form (`vendors.component.html` ~line 247).

**Verify:** each delete shows the dialog; Annuler keeps the row; confirm deletes it.

---

## Batch 3 — URL routing

**Goal:** refresh/bookmark/back-button work.

1. `client/src/app/app.routes.ts` (currently empty): routes for the 7 pages →
   `dashboard`, `invites`, `prestataires`, `hebergement`, `plan-de-table`, `budget`, `a-faire`;
   `''` redirect → `dashboard`, `**` → `dashboard`. Direct component references (no lazy
   loading needed — everything is already in the main bundle).
2. `wedding-shell.component.html`: replace the `@switch (page)` block with `<router-outlet />`;
   nav buttons become anchors with `routerLink` + `routerLinkActive="active"`. Add path to
   `NAV_ITEMS` in `shared/wedding-utils.ts` (keep `PageId` or replace with paths).
3. Delete the `page` field from `wedding-shell.component.ts`. Keep `loadInitialData` there —
   it must run regardless of the entry route.
4. **Layout gotcha:** housing/seating components carry `host: { class: 'split-pane-host' }`
   and `.main-panel` is the flex parent. `<router-outlet>` renders routed components as its
   *siblings* — check `.main-panel`, `.page`, `.split-pane-host` CSS in `styles.css` still
   lays out correctly (the routed component element replaces the previous direct children).
5. Update `app.spec.ts` if it asserts on the shell (it renders the dashboard — may need
   `provideRouter(routes)` in the test setup).

**Verify:** navigate to each page, F5 stays on it, back button works, deep URL
`/plan-de-table` loads directly with data.

---

## Batch 4 — Theme persistence + wedding date constants *(independent)*

1. Theme: in `store.ts`, initialize `theme` from `localStorage.getItem('wedding-theme')`
   (validate against `THEME_KEYS` from `wedding-utils.ts`, fallback `'nuit'`); write in
   `setTheme`. The theme is applied to `document.documentElement` via an `effect` in
   `wedding-shell.component.ts` — no change needed there.
2. Wedding date/place: add to `shared/wedding-utils.ts`:
   `WEDDING_DATE_ISO = '2027-07-16'`, `WEDDING_DATE_LABEL = '16 juillet 2027'`,
   `WEDDING_PLACE = 'Escayrac'`. Use them in `dashboard.component.html` line ~4
   (`script-note`) and `wedding-shell.component.html` (`brand-subtitle`). Server:
   `dashboard.service.ts` `daysRemaining` hardcodes `new Date('2027-07-16')` — read from
   `ConfigService.get('WEDDING_DATE', '2027-07-16')` instead (`@nestjs/config` is already
   set up; see `app.module.ts`).
3. Optional cleanup — dead planner module: the client never calls `/api/planner`.
   **Gotcha:** `budget.service.ts` and `budget.controller.ts` import the `Budget` types
   from `server/src/planner/planner-state.entity.ts`. To remove the module, move those
   interfaces into `server/src/budget/` first, then delete `planner.module.ts`,
   `planner.controller.ts`, `planner.service.ts`, the `PlannerState` entity/table and its
   registration in `app.module.ts`. Skip if unsure — it's inert.

**Verify:** switch theme → reload → theme kept. Dashboard countdown unchanged.

---

## Batch 5 — Dashboard completion *(independent; clickable cards need Batch 3)*

1. Todos stat card: `DashboardSummary.todos {total, done}` is **already returned by the
   server and typed in `dashboard-api.service.ts`** — just add the card in
   `dashboard.component.html` next to the existing 5 `.stat-card`s.
2. Vendors stat card: server `dashboard/dashboard.service.ts` must inject `VendorsService`
   (mirror how `BudgetService` is injected; check `dashboard.module.ts` imports
   `VendorsModule` — follow the existing pattern) and add
   `vendors: { count, reserved, totalCommitted }` where reserved = status in
   `reserve|acompte-paye|solde-paye` and totalCommitted **excludes `ecarte`**. Extend the
   `DashboardSummary` interface client-side, add the card.
3. Budget-per-category rows (`dashboard.component.html` ~line 68): clamp bar width to 100
   (`Math.min`) and add a red state when `spent > estimated` — reuse the `.over` /
   `.danger-fill` classes from the budget page (see `budget.component.html`).
4. If more than 5 categories: show "+ N autres postes" line under the list.
5. (After Batch 3) make each stat card a `routerLink` to its page.

**Verify:** mock dashboard endpoint with todos/vendors data + an over-budget category →
cards render, bar caps at 100% and turns red.

---

## Batch 6 — Vendors quick fixes *(independent)*

1. `vendors.component.ts` `totals` computed (~line 66): exclude `status === 'ecarte'`
   from `totalSpent` (decide: also exclude from `count` or keep; label says "engagés" so
   at minimum totalSpent).
2. Contact links on the collapsed card: in `vendors.component.html` `.vendor-summary-meta`,
   add compact anchors when present — `tel:` (phone), `mailto:` (email), website (href as-is,
   `target="_blank"`), Instagram (`https://instagram.com/<handle sans @>`). **Gotcha:** the
   whole `.vendor-summary` div opens the edit form on click — add `(click)="$event.stopPropagation()"`
   on the anchors.
3. "Paiements à venir": small list in the vendors page header area — vendors with
   `balanceDueDate` set and status not `solde-paye`/`ecarte`, sorted by date, showing
   name + `fmtShortDate(balanceDueDate)` + amount (`priceFinal - depositAmount` when
   depositPaid, else priceFinal || priceEstimate). Keep it a simple `@if`/`@for` panel.

**Verify:** an `ecarte` vendor no longer inflates "engagés"; links dial/mail without
opening the edit form; a vendor with a balance due date appears in the list.

---

## Batch 7 — Guests: export, inline RSVP, sorting *(independent)*

1. Excel export: `guest-import.ts` shows the xlsx loading pattern — it lazy-imports the
   `xlsx` package (the build emits it as a lazy chunk; keep it lazy). Add an
   "Exporter Excel" button next to "Importer Excel" in `guests.component.html` that builds
   one sheet: Prénom, Nom, Catégorie, RSVP, +1 (nom), Enfants (noms+âges joined), Régime,
   Événements (labels joined), Transport, Notes — from `store.guests()`, then
   `XLSX.writeFile(wb, 'invites.xlsx')`.
2. Inline RSVP: replace the RSVP badge cell in the table with a small `<select>`
   (options from `RSVP_OPTIONS` in `wedding-utils.ts`); on change call
   `guestApi.updateGuest({ ...guest, rsvp })` + `store.updateGuest`, toast on error
   (Batch 1). Keep the badge look via a class per value if cheap.
3. Filter feedback: show `{{ filteredGuests().length }} résultats` near the filters when a
   search/filter is active; include `dietary` and `notes` in the search string
   (`guests.component.ts` `filteredGuests` computed, ~line 46).
4. Column sorting: clickable `<th>` for Invité (name) / Catégorie / RSVP with asc/desc
   signal pair (`sortBy`, `sortDir`), applied inside `filteredGuests`.

**Verify:** export downloads and reopens in the import (round-trip); changing RSVP inline
persists after reload; sort toggles; search finds a guest by dietary text.

---

## Batch 8 — Budget: edit items, rename categories, vendor line *(independent)*

Server is ready: `PATCH /api/budget/items/:id` and `PATCH /api/budget/categories/:id`
(rename supported) exist in `budget.controller.ts`. The client `budget-api.service.ts`
**lacks `updateItem`** — add it (mirror `deleteItem`, PATCH with body).

1. Item edit: inline edit per item row (pencil → label/amount/date inputs → OK), pattern
   copied from `editingEstimateFor` already in `budget.component.ts`.
2. Category rename: same inline pattern on the category `<strong>`; calls existing
   `updateCategory`.
3. Vendor engagements line: in the `.total-panel`, add a muted line
   "Engagements prestataires : X €" = sum over `store.vendors()` (loaded globally by the
   shell) of `priceFinal || priceEstimate` for status `reserve|acompte-paye|solde-paye`.
   Display-only — no data linking.

**Verify:** edit an item's amount → totals and bar update, survives reload; rename a
category; vendor line matches vendors page total.

---

## Batch 9 — Todos: edit labels, overdue, sort *(independent)*

`TodosApiService.updateTask` already exists (used by `toggleDone`).

1. Label edit: click label (or pencil) → inline input → Enter/OK saves via `updateTask`.
2. Overdue: in `todos.component.html`, `time` gets an `.overdue` class (red) when
   `task.dueDate && !task.done && task.dueDate < today` (compare ISO strings,
   `new Date().toISOString().slice(0,10)`).
3. Sort tasks in each group by `dueDate` ascending, undated last, done tasks last —
   do it in a component helper, not in the store.

**Verify:** a task dated yesterday shows red; editing a label persists; order: overdue
first, undated after dated, done at the bottom.

---

## Batch 10 — Kids as placeable people (the big one)

**Goal:** kids count in headcounts and can get beds/seats. Highest-risk batch — do alone.

1. Stable ids: add `id: string` to `Kid` in `client/src/app/data/types.ts` **and**
   `server/src/guests/guest.entity.ts` (kids are `jsonb` — no DB migration). Generate via
   `gid()` when adding a kid in `guest-modal.component.ts` `addKid()`. Backfill rows
   missing ids where guests are loaded/saved (server `guests.service.ts` normalize, or
   client on load) — pick one place, be consistent.
2. `shared/wedding-utils.ts` `guestPeople()`: after the +1 block, emit one `GuestPerson`
   per kid — `id: kid.id`, firstName = kid name, lastName = guest lastName,
   `category: 'enfants'` (exists in `CATS`), rsvp inherited, `parentGuestId: guest.id`,
   add `isKid: true` to the interface. Housing/seating sidebars and capacity checks pick
   them up automatically via `allGuestPeople`.
3. Party size: `store.ts` `guestPartySize` → `1 + (hasPlusOne?1:0) + kids.length`; same
   formula in `server/src/dashboard/dashboard.service.ts` (~line 54).
4. Cleanup on edit: `store.updateGuest` already strips the +1's assignments when
   `hasPlusOne` turns false (`store.ts` ~line 62) — extend to strip assignments of kid ids
   that were removed from the guest. `replaceGuests`/`filterXAssignments` already handle
   the import path via `validGuestIds`.
5. Check `seed.ts` sample data and `guest-import.ts` (kids parsed from Excel) get ids too.

**Verify:** add a guest with 2 kids → header counts rise by 3; kids appear in housing/
seating sidebars with the Enfants badge; drag a kid into a room; remove the kid from the
guest → room slot frees; reload → consistent.

---

## Batch 11 — UI polish *(independent items, can be split)*

1. Keyboard: `ConfirmDialogComponent` — Escape → cancel, Enter → confirm
   (`@HostListener('document:keydown.escape')` etc.); `guest-modal.component.ts` — Escape
   closes. Focus the confirm button on dialog open.
2. Autofocus directive: `shared/autofocus.directive.ts` using `afterNextRender` +
   `ElementRef.nativeElement.focus()`; replace the unreliable native `autofocus` attribute
   in the inline forms of budget (2), housing (3), seating (1), todos (2), vendors (1)
   templates.
3. Loading state: add `loaded` signal to `WeddingStore`, set true at the end of
   `loadInitialData` (both success and failure); empty states ("Aucun invité trouvé",
   "Chambre vide", etc.) show "Chargement…" while `!loaded()`.
4. Mobile (scoped, in `styles.css`): under 700px hide the Événements + Transport columns
   of the guest table; under 860px the housing/seating `.guest-sidebar` becomes a
   collapsible top strip instead of a fixed left column (the split-pane pages currently
   don't adapt at all).

**Verify:** Escape/Enter drive the dialogs; inline forms actually focus; throttled network
shows "Chargement…" not empty states; 400px-wide viewport renders guest table and housing
usably.
