#!/usr/bin/env node
// Postman coverage gate (TEST-30, TEST-45). Zero dependencies, read-only.
// Usage: node scripts/check-postman-coverage.mjs [--root dir] [--json]
// Exit code: 1 when a registered Express route has no Postman request, or a request points at no route.
//
// It does NOT re-implement route discovery: it runs the `route-in-postman` check of rules/test.mjs (the same code
// `npm run rules:check` runs) twice. Once against an empty collection, so every registered route shows up as "has no
// request" (that is the route list); once against the real collection, so the remaining findings are the real gaps.
// The mail outbox, /health and /ready are exempt (TEST-42, TEST-43); the exemption lives in that check and is echoed below.
// The comparison with docs/08-api-design.md is a warning only (TEST-45).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, listRepoFiles, runChecks } from './check-engine.mjs';
import { CHECKS } from './rules/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = 'backend/postman/samarthAi.postman_collection.json';
const API_DOC = '../docs/08-api-design.md';
const CHECK_ID = 'route-in-postman';
const EXEMPT = ['GET /health', 'GET /ready', 'GET /__test__/outbox', 'DELETE /__test__/outbox'];
const METHODS = 'GET|POST|PUT|PATCH|DELETE';

// The same normalisation route-in-postman applies: no API prefix, any `:param` or `{{var}}` becomes `:p`.
const norm = (p) => p.replace(/[?#].*$/, '').replace(/^\/api\/v\d+/, '').replace(/\{\{[^}]*\}\}|:[A-Za-z_]\w*/g, ':p').replace(/\/+/g, '/').replace(/(.)\/$/, '$1') || '/';

/** A Project whose collection file reads as an empty collection, so every route is reported as uncovered. */
class EmptyCollectionProject extends Project {
  file(rel) {
    const real = super.file(rel);
    return rel === COLLECTION ? Object.defineProperty(Object.create(real), 'text', { value: '{"item":[]}' }) : real;
  }
}

function countRequests(items) {
  return (items || []).reduce((n, item) => n + (item.item ? countRequests(item.item) : 1), 0);
}

/** Routes documented in docs/08 tables: `| POST | /auth/login |`, `| 1 | POST | /auth/login |`, `| GET, POST | /departments |`. */
function documentedRoutes(text) {
  const keys = new Set();
  const row = new RegExp(`^\\|\\s*(?:\\d+\\s*\\|\\s*)?((?:${METHODS})(?:\\s*,\\s*(?:${METHODS}))*)\\s*\\|\\s*\`?(/[^\\s|\`]*)`, 'gm');
  for (const m of text.matchAll(row)) {
    for (const method of m[1].split(',')) keys.add(`${method.trim()} ${norm(m[2])}`);
  }
  return keys;
}

export function analyse(root) {
  const rels = listRepoFiles(root);
  const real = new Project(root, rels);
  const probe = new EmptyCollectionProject(root, rels);
  const skipped = runChecks(real, CHECKS, { only: [CHECK_ID] }).infos;
  if (skipped.length) return { skipped: skipped.map((i) => i.message) };

  const routeKeys = runChecks(probe, CHECKS, { only: [CHECK_ID] })
    .violations.map((v) => /^(\w+ \S+) has no request/.exec(v.message)?.[1])
    .filter(Boolean);
  const routes = [...new Set(routeKeys)].sort();
  const gaps = runChecks(real, CHECKS, { only: [CHECK_ID] }).violations;
  const requests = countRequests(JSON.parse(real.file(COLLECTION).text).item);

  const doc = real.has(API_DOC) ? documentedRoutes(real.file(API_DOC).text) : null;
  const undocumented = doc ? routes.filter((key) => !doc.has(key)) : [];
  return { routes, requests, gaps, undocumented, docFound: Boolean(doc) };
}

export function main(argv = process.argv.slice(2)) {
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag >= 0 ? path.resolve(argv[rootFlag + 1]) : path.resolve(HERE, '..');
  const json = argv.includes('--json');
  const result = analyse(root);
  if (result.skipped) {
    console.log(json ? JSON.stringify(result) : `skipped: ${result.skipped.join('; ')}`);
    return 0;
  }
  const { routes, requests, gaps, undocumented, docFound } = result;
  const ok = gaps.length === 0;
  if (json) {
    console.log(JSON.stringify({ ok, routes: routes.length, requests, exempt: EXEMPT, gaps: gaps.map((g) => g.message), undocumented }, null, 1));
    return ok ? 0 : 1;
  }
  console.log(`postman-coverage: ${routes.length} registered routes, ${requests} requests in ${COLLECTION}`);
  console.log(`exempt (TEST-30, TEST-42): ${EXEMPT.join(', ')}`);
  for (const gap of gaps) console.log(`error  ${CHECK_ID}  ${gap.file}:${gap.line}  ${gap.message}  (TEST-30,TEST-45)`);
  if (!docFound) console.log(`warn   ${API_DOC} not found: documentation comparison skipped`);
  for (const key of undocumented) console.log(`warn   docs-08  ${key} is registered but missing from docs/08-api-design.md  (TEST-45)`);
  console.log(ok ? 'ok     every registered route has a Postman request and every request maps to a route' : `FAIL   ${gaps.length} coverage gap(s)`);
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
