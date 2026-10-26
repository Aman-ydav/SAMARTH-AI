# SAMARTH AI - agent entry point

Rulebooks live outside this repo in the workspace: `../docs/rules/`. Read `../docs/rules/00-index.md` and `../docs/rules/11-ai-agent-protocol.md` first, then the rulebooks the index matrix names for your task. `../docs/rules/DECISIONS.md` wins every conflict.

## The 8 hard rules
1. Never run `git commit`, `push`, `add`, `reset`, `stash`, or change remotes, unless the user explicitly asks. Reading git state is fine.
2. No secrets in code, docs or output. Placeholders only in `.env.sample`.
3. No `lucide-react`. Icons come only from `@/components/icons` (filled react-icons).
4. No tokens in `localStorage`, `sessionStorage`, Redux, URLs or logs. Auth is HttpOnly cookies plus `X-CSRF-Token`.
5. No gradients, glow, blur or colour literals. Colours live only in `frontend/src/index.css` tokens; UI is shadcn only.
6. No files or folders outside the tree in `../docs/rules/06-file-and-folder-rules.md`. Amend the rule first if no slot exists.
7. State via Redux Toolkit thunks and one axios instance. No RTK Query, no `fetch`, no `console.*`, no `process.env` outside `config/env.js`.
8. Never claim "done" or "green" without running the checks. Report real output.

## Before finishing
- Run backend and frontend tests, `npm run lint`, frontend `npm run build`, `npm run rules:check`, and `npm run test:api` if any endpoint changed.
- Add tests with the code (backend first) and a Postman request per endpoint.
- Update docs and rulebooks in the same task. End with the Edge-Case Declaration and a rules-compliance summary.

## Where things live
- `backend/src/`: `modules/<name>/` (routes, controller, service, validation, model, pipelines), `middlewares/ utils/ config/ integrations/ ai/ jobs/ events/ realtime/ seed/`.
- `frontend/src/`: `app/` (store, routes, guards), `features/<name>/` (api, slice, schemas, hooks, components, pages), `components/` (ui, common, layout, icons, motion, media), `lib/ hooks/ i18n/`.
- `backend/postman/`: API collection, run with `npm run test:api`.
- `scripts/`: `check-rules.mjs` and hook helpers.
- `../docs/`: design docs, brand copy (`23`), prompts, env variables (`15`).
