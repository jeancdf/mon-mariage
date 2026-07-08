---
name: verify
description: Build, run, and drive the Mon Mariage app (Angular client + NestJS server) to verify a change end-to-end at the UI surface.
---

# Verifying Mon Mariage changes

## Environment gotchas (WSL2)

- All Node tooling runs **Windows-side** through WSL interop: `npm`/`npx` resolve to Windows binaries, plain `node` is NOT on PATH — use `node.exe`.
- Servers started this way listen on **Windows** localhost; `curl` from WSL cannot reach them (connection refused is normal). Playwright also runs Windows-side, so localhost works inside scripts.
- Docker is not available in this distro and Postgres is not running locally, so the real NestJS server (needs Postgres, see `server/.env.example`) usually cannot be started. Use a mock API instead (below).

## Build / test

```bash
cd client && npm run build   # Angular build (output goes to C:\...\client\dist)
cd client && npm test        # vitest, runs app.spec.ts
```

## Run for verification

1. **Mock API** (client expects the contract of `server/src/*/controller.ts`, proxied via `client/proxy.conf.json` from `/api` to `localhost:3000`). Write a plain-Node http server with in-memory data covering at least the six GETs loaded by `wedding-shell.component.ts` (`/api/guests`, `/api/housing`, `/api/seating`, `/api/budget`, `/api/todos`, `/api/vendors`) — **all six must succeed or the client falls back to an empty store** — plus whatever mutation endpoints the change touches. Assignment semantics: PUT `/api/{housing,seating}/assignments/:guestId` clears the guest's previous assignment then adds; both PUT and DELETE return the full updated list.
   Run it Windows-side: `node.exe 'C:\...\mock-api.mjs'` (background).
2. **Client**: `cd client && npx ng serve --port 4200` (background; ready when output shows `Local: http://localhost:4200`).
3. **Drive with Playwright**: install once into a Windows-visible temp dir (e.g. `C:\Users\jeanc\AppData\Local\Temp\mm-verify`): `npm init -y && npm i playwright` (+ `npx playwright install chromium` if the browser cache is empty). Run scripts with `node.exe drive.mjs` from that dir. `/tmp` (WSL) is invisible to Windows node — keep scripts and screenshots on `C:`.

## Driving notes

- Navigation is button-based (no routes): `page.getByRole('button', { name: 'Hébergement' })` etc.
- CDK drag & drop responds to real mouse events: `mouse.move(src) → down → small 6px move → move(target, {steps: 15}) → up`, with ~200ms settles.
- Simulate API failure with `page.route('**/api/**', route => route.abort())` — cheaper than killing the mock, and the initial load can still succeed.
- The app is French: assert on French labels ("Sans logement", "Déposer ici", "Placer aussi…").
