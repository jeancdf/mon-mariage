# Mon Mariage

Private wedding planner: Angular 21 client (`client/`) + NestJS 11 / TypeORM / PostgreSQL server (`server/`). UI is French.

## Branches and deployment

- `main` deploys to **production** (`mon-mariage.duckdns.org`) on every push. Never push to or merge into `main` without the owner's explicit request.
- `preprod` deploys to **preprod** (`preprod-mon-mariage.duckdns.org`, compose project `mon-mariage-preprod`). New work lands here first. See `PREPROD-CADDY.md`.

## Setup (fresh checkout or worktree)

```bash
cd client && npm ci
cd server && npm ci
```

## Validation

```bash
cd server && npx tsc --noEmit     # type-check
cd server && npm test             # node --test after build
cd client && npx ng build         # must succeed (budget warning is known)
cd client && npx ng test --watch=false
```

## Running the UI

The real server needs Postgres (`docker compose up -d postgres`, then `cd server && npm run start:dev`).
Without it, use **demo mode**: `cd client && npx ng serve --port <port>`, open `/connexion` and click the demo button ("Explorer la démonstration"). Demo mode replaces the whole API with an in-browser fake dataset (`client/src/app/demo/`), so every page can be exercised.

To look at pages from an agent, if the `agent-browser` CLI is missing, use Playwright from a temp folder outside the repo (`npm i playwright && npx playwright install chromium`) and drive `http://localhost:<port>` headless: enter demo mode as above, then `page.goto` any route and take screenshots at 1440px and 390px widths.

## Conventions

- Standalone components, Angular signals, `inject()` over constructor params, French UI labels.
- API services return the full updated list; components call `store.replaceX(...)`.
- Component styles live in `client/src/styles.css`; shared tokens (champagne `--highlight`, radii, shadows), the shell and cross-page polish live in `client/src/design-system.css`, loaded after it. Themes (`blanc`, `nuit`, `ivoire`, defined in `shared/wedding-utils.ts`) are applied as CSS variables on `<html>` by the wedding shell. Use the variables, never hard-coded colors.
- Every page must stay usable at 375px width.
- The shell has a Ctrl/Cmd+K command palette (`shared/command-palette.component.ts`) whose page list comes from `NAV_ITEMS`, so new pages added there appear in it automatically.

## Behavioral guidelines (Karpathy)

Behavioral guidelines to reduce common LLM coding mistakes. They bias toward caution over speed; for trivial tasks, use judgment.

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it; don't delete it.
- Remove imports/variables/functions that your changes made unused.

Every changed line should trace directly to the request.

### 4. Goal-driven execution

Define success criteria. Loop until verified.

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.

For multi-step tasks, state a brief plan: `1. [Step] → verify: [check]`.

_Source: [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) (MIT)._
