# SAMARTH AI - frontend

React 19 + Vite 8 single-page app for SAMARTH AI (Smart Competency Intelligence for Official Statistics). It is a prototype for SIH26101, not an official Government of India website.

Stack: Tailwind CSS v4 (tokens in `src/index.css`), shadcn/ui (`src/components/ui`), Redux Toolkit + axios, React Router, react-hook-form + zod, react-i18next (en, hi), `motion` + `lenis` on marketing pages. Icons are filled react-icons exported from `src/components/icons/index.js` only.

The rules for this code live outside the repo in `../docs/rules/` (start with `00-index.md`); `../CLAUDE.md` is the short version.

## Run

```bash
npm install
cp .env.sample .env      # local values only, never commit .env
npm run dev              # http://localhost:5173, /api is proxied to http://localhost:8000
```

## Scripts

| Script                      | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `npm run dev`               | Vite dev server with the `/api` proxy              |
| `npm run build`             | production build into `dist/`                      |
| `npm run preview`           | serve the production build locally                 |
| `npm run lint` / `lint:fix` | ESLint (flat config)                               |
| `npm run format`            | Prettier (same config as the backend)              |
| `npm test` / `test:watch`   | Vitest, jsdom, Testing Library, vitest-axe         |
| `npm run test:coverage`     | Vitest with v8 coverage and the rule 08 thresholds |

From the repo root, `npm run rules:check` runs the rulebook checker.

## Environment

Only public `VITE_*` values exist (see `.env.sample`). Production leaves `VITE_API_URL` unset, so the app calls the relative `/api/v1` and `vercel.json` rewrites `/api/*` to the Render API, which keeps cookies first-party.

## Design system in one paragraph

Colours exist only in `src/index.css` (transcribed from `docs/rules/assets/palette.json`; primary `#D97757`). Components use semantic tokens (`bg-primary`, `text-muted-foreground`). The look is flat: no gradients, glow, blur or coloured shadows. New UI parts come from `npx shadcn@latest add <name>`, then are re-themed and their icons moved to the registry (rule 01, UI-21).
