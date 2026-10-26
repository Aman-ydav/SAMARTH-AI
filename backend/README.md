# SAMARTH AI backend

Express 5 + Mongoose 9 API for SAMARTH AI (a prototype capstone product, not an official Government of India website).
Rules live in `../../docs/rules/` (start with `00-index.md`); this file only covers how to run it.

## Run

```bash
cp .env.sample .env        # fill in MONGODB_URI and the secrets (generation command is in the file)
npm install
npm run dev                # nodemon src/index.js, http://localhost:8000
npm start                  # node src/index.js
```

- `GET /health` answers when the process is alive; `GET /ready` answers when MongoDB responds (503 otherwise).
- All API routes live under `/api/v1`. Errors use one envelope with `code`, `errors[]` and `requestId`.
- Config is validated at start-up by `src/config/env.js`. A missing or invalid value stops the process and names the variable.

## Test and check

| Command                             | What it does                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                          | Vitest (unit + Supertest + in-memory MongoDB replica set). The first run downloads a `mongod` binary once.                                |
| `npm run test:coverage`             | Same, with coverage thresholds from rule 08 (TEST-29).                                                                                    |
| `npm run test:api`                  | Starts in-memory MongoDB and the API on a free port, then runs `postman/samarthAi.postman_collection.json` with newman (see API testing). |
| `npm run lint` / `npm run lint:fix` | ESLint (no `console`, no `process.env` outside `config/env.js`, no import cycles).                                                        |
| `npm run format`                    | Prettier (4 spaces, double quotes).                                                                                                       |
| `npm run db:sync-indexes`           | Prints the index diff (dry run). Add `-- --apply` to change the database.                                                                 |
| `npm run migrate` / `npm run seed`  | Forward-only migrations / idempotent seeds. `seed` refuses production without `-- --force`.                                               |

## Authentication (milestone 1)

The auth system lives in `src/modules/auth` (routes under `/api/v1/auth`), `src/modules/users` (`/api/v1/profile`) and `src/modules/audit`
(hash-chained audit log). Contract: `../../docs/08-api-design.md` section 3 and `../../docs/20-auth-and-user-lifecycle.md`.

- Tokens live only in cookies (`sai_access`, `sai_refresh`, `sai_csrf`); every unsafe request needs the `X-CSRF-Token` header.
- `npm run seed` creates the first superadmin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (idempotent; the account must change its password on first login).
- In development with `EMAIL_TRANSPORT=log` the verify and reset links are printed in the server log, labelled `DEV ONLY` (R40). Tests read them from the memory outbox (`GET /api/v1/__test__/outbox`, test mode only).
- Per-IP rate limits are multiplied by `RATE_LIMIT_IP_MULTIPLIER`; per-email and per-user limits and lockouts never are.

## API testing

Every route of the Express app is a request in `postman/samarthAi.postman_collection.json` (happy path plus the negatives of rule 08 TEST-37), and `openapi.yaml` describes the same routes. `../scripts/check-postman-coverage.mjs` (also part of `npm run rules:check` as `route-in-postman`) fails when a route has no request or a request has no route.

**Run it headless.** `npm run test:api` (here or at the repo root) starts an in-memory MongoDB replica set and the API on a free port with `NODE_ENV=test` and `EMAIL_TRANSPORT=memory`, seeds three staff accounts with random passwords (a superadmin who must change the password on first login, an admin and a trainer), waits for `/health`, runs newman with the `cli` and `junit` reporters (`postman/results/junit.xml`, git-ignored) and `--bail`, then shuts everything down and exits with newman's exit code. It needs no network and no secrets. Per-IP rate limits are multiplied by `RATE_LIMIT_IP_MULTIPLIER=1000`; per-address and per-user limits and lockouts stay strict and are proven in the "Rate limits and lockout" folder. The runner only accepts the email domain `example.test`, and it preloads `tests/setup/cloudinaryStub.js` into the server, which fakes the network calls of the Cloudinary SDK (upload, fetch, delete) so avatar upload, confirm, access and delete can run offline; signing and webhook verification stay real. A full run takes two to three minutes, 11 s of which are the real wait for the 10 s refresh-reuse window.

**Import it in Postman.** Use Import and pick `postman/samarthAi.postman_collection.json` and one of `postman/local.postman_environment.json`, `staging.postman_environment.json`, `prod.postman_environment.json`, then select that environment. The files hold placeholders only: `baseUrl` (for local, the port your dev server uses), `apiPrefix`, `maxResponseMs`, `expectSecureCookies`, `allowedOrigin`, `environmentKind` and `googleConfigured`. Emails, passwords and tokens are generated by scripts at run time (unique per run); the secret fields (`adminPassword`, `orgAdminPassword`, `trainerPassword`, `cloudinaryApiSecret`) stay empty and are supplied with `--env-var` or typed into your local copy, never committed. The collection pre-request script copies the `sai_csrf` cookie into `X-CSRF-Token` for POST, PUT, PATCH and DELETE, so keep Postman's cookie jar enabled (the desktop app asks once to let scripts read the cookies of the host: allow it). Requests that need a seeded account or the Cloudinary stub are skipped when their variables are empty.

**Folders (doc 08 order).** Smoke, Auth - session, Auth - password and reset, Auth - account, Media, Profile, Rate limits and lockout, Error envelope checks, Auth lifecycle E2E (last; it is self-contained and uses a fresh email per run). Only Smoke may run against staging or prod: the collection skips every other folder when `environmentKind` is not `local`, and never sends an unsafe method to `prod`.

**Test-only outbox.** Verification, reset and email-change tokens arrive only by mail. With `NODE_ENV=test` and `EMAIL_TRANSPORT=memory` (and only then; every other combination answers 404 and the memory transport is refused in production) the API serves `GET /api/v1/__test__/outbox?to=...&templateKey=...`, which lists the captured mails with their `links` and one-time `token`. Mail is queued after the response, so the collection polls the outbox for up to five seconds before reading it. The outbox is not in `openapi.yaml`; the one-time tokens are kept in collection variables only until they are used.

**Run against a local dev server.** Start `npm run dev` with `EMAIL_TRANSPORT=log`: there is no outbox, so run the Smoke folder and requests that need no mail, or use the links the server logs. In development with the `log` transport the verify and reset links are printed in the server log, labelled `DEV ONLY` (R40, never in test or production); open the link in the frontend or copy the `#token=` value into a request body by hand. The Google sign-in request is negative-only (it answers 403 FORBIDDEN when `GOOGLE_CLIENT_ID` is not set, 401 GOOGLE_TOKEN_INVALID when it is and `googleConfigured` is `true`), and the invite request is negative-only because invites have no HTTP route yet. The avatar requests read their files (`avatar-valid.png`, `avatar-too-large.png`, `avatar-spoofed.png`, `avatar-empty.png`, `avatar-not-allowed.gif`) from newman's working directory; `test:api` generates them per run, in the Postman app pick any small PNG, GIF or text file for them.

## Environment

Every variable is documented in `.env.sample` and `../../docs/15-env-variables.md`. `NODE_ENV=test` supplies safe defaults
for tests (memory email transport, silent logs, generated placeholder secrets) and never reads a `.env` file.

## Layout

`src/` has `config constants db middlewares utils services integrations modules` (plus `jobs events realtime ai seed` when
they get their first file). Tests sit next to the code as `*.test.js`; shared test support is in `tests/`
(`setup helpers factories integration`). Details: rule 06.
