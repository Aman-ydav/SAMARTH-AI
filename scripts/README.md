# scripts

Tooling that enforces the rulebook in `../docs/rules` (zero dependencies, Node 22+ ES modules, read-only git).

## What is here
- `check-rules.mjs`: the rulebook checker, run through `npm run rules:check`. Exit code 1 when any error-severity rule fails.
- `check-engine.mjs`: file discovery (`git ls-files -co --exclude-standard`), glob matching, runner. `rules/index.mjs` registers every check.
- `rules/<group>.mjs`: the checks, one small function each, grouped fs, ui, frontend, backend, auth, db, anim, test, media, edge.
- `hooks/claude-hook.mjs`: Claude Code hook helper wired up in `../../.claude/settings.json` (session reminder, new-path guard, git/dependency guard, post-edit check, stop gate).
- `dev.mjs`: starts backend and frontend together with prefixed output (`npm run dev`).
- Tests: `check-rules-test.mjs`, `check-rules-golden-test.mjs`, `hooks/claude-hook-test.mjs`.

## Running the checker
- Whole repo: `npm run rules:check` (long lists are capped per check; add `--all` for everything).
- One file: `--file <path>` (absolute or repo-relative). Changed files only: `--changed`.
- A path before creating it: `--pre-path <path>` (validates against `docs/rules/assets/path-rules.json`).
- Filters and formats: `--only <check-id>[,id]`, `--severity error|warn`, `--json`, `--list` (all checks with rule IDs).
- A task summary: `--declaration <file|->` checks for the Edge-Case Declaration table.
- Output lines read: severity, check-id, file:line, message, (rule ID). Missing prerequisites (no Postman collection, no i18n files, no `frontend/dist`) show as "skipped", never as failures.

## Tests
Run `node --test "scripts/**/*-test.mjs"` from the repo root. Node 22+ needs the quoted glob; a bare `scripts/` directory argument no longer works.

## Adding a check
1. Pick the group file in `rules/` (or add a group and import it in `rules/index.mjs`).
2. Add an object with `id`, `ruleIds`, `severity`, `globs` and `run(file, project)` returning `{ line, message }` items; for simple line patterns use the `rx()` helper from `rules/util.mjs`.
3. Keep the id identical to the "Automated checks" table row of the rulebook; add a failing and a passing case to `check-rules-test.mjs`.
4. Keep each script file under 300 lines (rule 06) and note any ambiguous reading in the file's header comment.

## Hook overrides (human only, set in the shell that launches Claude)
- `SAMARTH_ALLOW_GIT=1` allows git write commands that the hook normally blocks.
- `SAMARTH_ALLOW_DEPS=1` allows installing packages the rulebook forbids.
- `SAMARTH_STOP_SCOPE=all` makes the Stop hook check the whole repo instead of only changed files.
- `SAMARTH_PATH_RULES=<file>` points the checker at another `path-rules.json` when the docs folder is not next to the repo.
