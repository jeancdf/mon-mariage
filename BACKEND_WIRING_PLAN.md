# Backend Wiring Implementation Plan

## Goal

Replace the current "single JSON planner snapshot" persistence with proper feature-level backend wiring.

The final app should have each Angular page backed by explicit Nest modules, entities, services, and API endpoints:

- Dashboard
- Guests
- Housing
- Seating / table plan
- Budget
- Todo list

## Current State

The app currently has a partial backend.

What exists:

- `GET /api/health`
- `GET /api/planner`
- `PUT /api/planner`
- A JSONB `planner_states` table that stores the whole app state.
- A partial `guests` module.
- Angular pages read/write through `WeddingStore`.

What is missing:

- Proper tables/entities for housing, seating, budget, and todos.
- Proper CRUD endpoints for each page.
- A dashboard endpoint.
- Angular feature services per domain.
- Page-level load/save/error states.
- Migration from snapshot JSON into normalized tables.

## Target Architecture

### Backend Modules

Create these Nest modules:

- `DashboardModule`
- `GuestsModule`
- `HousingModule`
- `SeatingModule`
- `BudgetModule`
- `TodosModule`

Keep `PlannerModule` temporarily only as a migration/backup path. Remove it later when normalized data is trusted.

### Frontend Services

Create these Angular API services:

- `DashboardApiService`
- `GuestsApiService`
- `HousingApiService`
- `SeatingApiService`
- `BudgetApiService`
- `TodosApiService`

`WeddingStore` should become a cache/coordinator, not the only persistence boundary.

## Data Model

### Guests

Entity: `GuestEntity`

Fields:

- `id`
- `firstName`
- `lastName`
- `category`
- `rsvp`
- `hasPlusOne`
- `plusOneName`
- `kids` as `jsonb`
- `dietary`
- `events` as `jsonb`
- `transport`
- `notes`
- `createdAt`
- `updatedAt`

Endpoints:

- `GET /api/guests`
- `POST /api/guests`
- `PATCH /api/guests/:id`
- `DELETE /api/guests/:id`
- `PUT /api/guests/import`

### Housing

Entities:

- `HouseEntity`
- `RoomEntity`
- `RoomGuestEntity`

Relationships:

- House has many rooms.
- Room has many assigned guests through `RoomGuestEntity`.
- Assigning a guest to a room should remove previous room assignments for that guest.

Endpoints:

- `GET /api/housing`
- `POST /api/housing/houses`
- `PATCH /api/housing/houses/:id`
- `DELETE /api/housing/houses/:id`
- `POST /api/housing/houses/:houseId/rooms`
- `PATCH /api/housing/rooms/:roomId`
- `DELETE /api/housing/rooms/:roomId`
- `PUT /api/housing/assignments/:guestId`
- `DELETE /api/housing/assignments/:guestId`

### Seating

Entities:

- `TableEntity`
- `TableGuestEntity`

Relationships:

- Table has many guest assignments.
- Assigning a guest to a table should remove previous table assignments for that guest.

Endpoints:

- `GET /api/seating`
- `POST /api/seating/tables`
- `PATCH /api/seating/tables/:id`
- `DELETE /api/seating/tables/:id`
- `PUT /api/seating/assignments/:guestId`
- `DELETE /api/seating/assignments/:guestId`

### Budget

Entities:

- `BudgetCategoryEntity`
- `BudgetItemEntity`

Relationships:

- Budget category has many budget items.

Endpoints:

- `GET /api/budget`
- `POST /api/budget/categories`
- `PATCH /api/budget/categories/:id`
- `DELETE /api/budget/categories/:id`
- `POST /api/budget/categories/:categoryId/items`
- `PATCH /api/budget/items/:id`
- `DELETE /api/budget/items/:id`

### Todos

Entities:

- `TodoGroupEntity`
- `TodoTaskEntity`

Relationships:

- Todo group has many tasks.

Endpoints:

- `GET /api/todos`
- `POST /api/todos/groups`
- `PATCH /api/todos/groups/:id`
- `DELETE /api/todos/groups/:id`
- `POST /api/todos/groups/:groupId/tasks`
- `PATCH /api/todos/tasks/:id`
- `DELETE /api/todos/tasks/:id`

### Dashboard

No standalone dashboard table is needed.

Endpoint:

- `GET /api/dashboard`

Response should include:

- guest counts by RSVP
- total guests
- housing capacity and occupancy
- seating capacity and placements
- total estimated budget
- total spent budget
- todo completion count
- days remaining
- budget by category summary

## Migration Plan

### Phase 1: Keep Snapshot, Add Normalized Tables

Do not delete `planner_states`.

Add normalized entities and endpoints.

Use `planner_states` as source data for one migration script:

- Read default planner snapshot.
- Insert guests.
- Insert houses and rooms.
- Insert room assignments.
- Insert seating tables and assignments.
- Insert budget categories and items.
- Insert todo groups and tasks.

Add script:

```bash
npm run migration:planner-snapshot
```

### Phase 2: Angular Uses New APIs

Update each page one by one:

1. Guests page
2. Housing page
3. Seating page
4. Budget page
5. Todos page
6. Dashboard page

Each page should:

- load from its own API service
- show loading/error states
- optimistically update UI when safe
- reconcile with backend response
- avoid calling `PUT /api/planner`

### Phase 3: Remove Snapshot Persistence

When all pages use domain APIs:

- remove `PlannerApiService`
- remove automatic `WeddingStore` snapshot saves
- keep `WeddingStore` as client cache only
- remove `PlannerModule` after data has been migrated and verified

## Angular Refactor Plan

### Store Responsibilities

`WeddingStore` should expose:

- current guests
- current houses
- current seating tables
- current budget
- current todos
- current theme

But API calls should move into feature components or feature facade services.

Suggested structure:

```text
client/src/app/data/
  guests-api.service.ts
  housing-api.service.ts
  seating-api.service.ts
  budget-api.service.ts
  todos-api.service.ts
  dashboard-api.service.ts
  store.ts
```

### Page Wiring

Each component should use its own API service:

- `GuestsComponent` uses `GuestsApiService`
- `HousingComponent` uses `HousingApiService`
- `SeatingComponent` uses `SeatingApiService`
- `BudgetComponent` uses `BudgetApiService`
- `TodosComponent` uses `TodosApiService`
- `DashboardComponent` uses `DashboardApiService`

## Deployment Notes

The frontend should not require nginx if the VPS already has a reverse proxy.

Recommended deployment shape:

- `db` service exposed only on Docker network.
- `backend` service exposed only on Docker network.
- frontend service can be static server, or the VPS proxy can serve built Angular assets.
- external VPS proxy routes:
  - `/api/*` to backend container port `3000`
  - `/` to frontend static service

If using a frontend container, it still needs some HTTP server to serve static Angular files. This can be nginx, Caddy, httpd, or a Node static server. The conflict risk comes from host ports, not nginx inside the container.

## Verification Checklist

Backend:

- `npm run build`
- `npm run lint`
- `GET /api/health`
- `GET /api/dashboard`
- CRUD smoke tests for every module

Frontend:

- `npm run build`
- `npm test -- --watch=false`
- Manual checks:
  - add/edit/delete guest persists after refresh
  - add house/room persists after refresh
  - assign guest to room persists after refresh
  - add table persists after refresh
  - assign/remove table seat persists after refresh
  - add budget category/item persists after refresh
  - edit budget estimate persists after refresh
  - add/toggle/delete todo persists after refresh
  - dashboard updates after changes

Database:

- verify normalized rows exist in every table
- verify deleting guests cleans up seating/housing assignments
- verify deleting house/table/category/group cascades correctly

## Suggested Implementation Order

1. Add DTOs and validation dependency.
2. Finish `GuestsModule` CRUD.
3. Add `HousingModule`.
4. Add `SeatingModule`.
5. Add `BudgetModule`.
6. Add `TodosModule`.
7. Add `DashboardModule`.
8. Add migration script from `planner_states`.
9. Refactor Angular guest page to real CRUD.
10. Refactor Angular housing page.
11. Refactor Angular seating page.
12. Refactor Angular budget page.
13. Refactor Angular todos page.
14. Refactor dashboard to `GET /api/dashboard`.
15. Remove planner snapshot autosave.
