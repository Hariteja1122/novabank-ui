# CLAUDE.md: novabank-ui

Angular 22 front end of NovaBank. Sibling repos: novabank-api-gateway, novabank-auth-service,
novabank-account-service, novabank-transaction-service, novabank-platform.

## Commands
- `npm start` (needs the gateway on :8080) or `npm run start:mock` (no backend)
- `npx ng build`, `npx ng test --watch=false`

## Conventions
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for state, `input()` / `output()`.
- Every HTTP call lives in `core/bank-api.ts`. Components never build URLs.
- When an endpoint changes, update `core/models.ts`, `core/bank-api.ts` and `core/mock/mock-backend.ts` together.
- Errors arrive as ProblemDetail. Show them with `problemMessage(err)`.
- Styling: tokens and shared classes in `src/styles.scss`; component styles stay small.
- Money: format with the `currency` pipe; account numbers with the `acct` / `acctMask` pipes.
- Copy is sentence case, plain verbs, and says what a button does ("Record deposit", not "Submit").
