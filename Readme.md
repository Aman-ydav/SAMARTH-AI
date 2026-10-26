# SAMARTH AI

Smart Competency Intelligence for Official Statistics.

SAMARTH AI is a prototype for SIH26101 (MoSPI). It is not an official Government of India website.

- **S**kill assessment, **A**daptive learning, **M**apping competencies, **A**I-driven analytics, **R**ecommendations, **T**raining pathways, **H**olistic capacity building.

## What is here

- `backend/` is the Express 5 + Mongoose API (deployed to Render).
- `frontend/` is the React 19 + Vite + Tailwind v4 + shadcn/ui SPA (deployed to Vercel).
- `scripts/` holds the rules checker, Claude Code hooks and the dev launcher.
- Docs and rulebooks live in the sibling `docs/` folder. Start at `docs/rules/00-index.md`.

## Quick start

- Install everything: `npm run install:all`.
- Copy `backend/.env.sample` to `backend/.env` and `frontend/.env.sample` to `frontend/.env`, then fill in the values (never commit them).
- Run both apps: `npm run dev`. Frontend on port 5173, API on port 8000.
- Verification commands: `npm run lint`, `npm run test`, `npm run test:api`, `npm run build`, `npm run rules:check`.

## Rules

Every change follows the rulebooks in `docs/rules/`. `npm run rules:check` enforces them, and Claude Code hooks run it automatically for AI agents. Read `CLAUDE.md` and `docs/rules/11-ai-agent-protocol.md` before changing anything.
