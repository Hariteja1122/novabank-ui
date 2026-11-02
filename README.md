# novabank-ui

Angular 22 front end for NovaBank with two lazy loaded modules:

* **User module** (`/app`, role CUSTOMER): overview with total balance, accounts, open an
  account, move money with a review step, transaction history, profile and password.
* **Admin module** (`/admin`, role ADMIN): operations overview with a 14 day volume chart,
  customers (lock, unlock, open account), accounts (freeze, unfreeze, close), transaction
  monitoring with teller deposits, live system status.

Standalone components, signals, functional guards and interceptors, reactive forms. No UI
library: one small design system in `src/styles.scss`, IBM Plex fonts bundled from npm.

## Run

```bash
npm install
npm start            # http://localhost:4200, /api proxied to the gateway on :8080
npm run start:mock   # no backend needed: in-browser demo data
npm test             # Vitest unit tests
```

Sample logins: `john.carter@example.com / Password@123` (customer),
`admin@novabank.dev / Admin@123` (admin). The sign in page has one-click buttons for both.

## How it talks to the backend

The browser only ever calls `/api/...` on its own origin.

| Where | Who forwards `/api` to the gateway |
|---|---|
| `npm start` | Angular dev server, `proxy.conf.json` |
| Docker Compose | nginx in this image (`API_GATEWAY_URL=http://api-gateway:8080`) |
| Cloud Run | nginx in this image (`API_GATEWAY_URL` set in `deploy/environments/*.yaml`) |

## Layout

```
src/app/core       auth session, BankApi (every REST call), interceptors, guards, mock backend
src/app/shared     icons, status badge, pager, account slab, transaction table, pipes
src/app/layout     the app frame used by both modules
src/app/pages      sign in and registration
src/app/features   customer/ (user module) and admin/ (admin module)
```
