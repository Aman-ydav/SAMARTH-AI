// EDGE group (rulebook 09). Reading notes:
//  - edge-declaration-present is manual: `check-rules --declaration <file|->` validates a task summary / PR text. It needs the table header
//    "| Edge case | How handled ... | Test name |" plus at least one real row (the "(example)" row does not count).
//  - edge-pages-exist (warn): a section 6 route counts as present if its path literal appears in app/routes.jsx or lib/paths.js, or a
//    <Name>Page.jsx exists in any feature (/session-expired -> SessionExpiredPage.jsx). Skipped (INFO) until the frontend has pages.
//  - no-swallowed-catch: empty catch bodies (a lone comment counts as empty) and catch bodies containing only logger/console calls.
//    `.catch(() => {})` is flagged too. Test files are exempt.
import { calls, isTest, lineOf, BE, FE } from './util.mjs';

const declaration = {
  id: 'edge-declaration-present', ruleIds: ['EDGE-120', 'EDGE-121'], severity: 'error', manual: true, globs: [],
  desc: 'task summary / PR text has an Edge-Case Declaration table (use --declaration <file|->)',
  run(file) {
    const t = file.text ?? '';
    const head = /\|\s*Edge case\s*\|\s*How handled[^|\n]*\|\s*Test name\s*\|/i.exec(t);
    if (!head) return [{ line: 1, message: 'no "| Edge case | How handled | Test name |" table: the Edge-Case Declaration is mandatory' }];
    const rows = t.slice(head.index + head[0].length).split('\n').slice(1).filter((r) => /^\s*\|/.test(r) && !/^\s*\|[\s:|-]+\|?\s*$/.test(r) && !/\(example\)/i.test(r));
    return rows.some((r) => r.split('|').filter((c) => c.trim()).length >= 3) ? [] : [{ line: 1, message: 'Edge-Case Declaration table has no rows' }];
  },
};

const ROUTES = ['/404', '/403', '/500', '/offline', '/maintenance', '/session-expired', '/account-suspended', '/account-locked', '/verify-email', '/verify-email/pending', '/forgot-password', '/reset-password', '/cookies-disabled', '/unsupported-browser', '/429'];
const ALIASES = { '/404': ['NotFound'], '/403': ['Forbidden', 'NotAuthorised', 'Unauthorized'], '/500': ['ServerError', 'SomethingWrong'], '/429': ['TooManyRequests', 'RateLimited'] };
const pageName = (r) => ALIASES[r]?.[0] ?? r.slice(1).split(/[/-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const pageNames = (r) => (ALIASES[r] ?? [pageName(r)]).map((n) => `${n}Page.jsx`);
const pages = {
  id: 'edge-pages-exist', ruleIds: ['EDGE-120', 'FE-69'], severity: 'warn', scope: 'project', globs: [],
  desc: 'the section 6 edge routes (/404 /403 /500 /offline ...) exist',
  run(project) {
    const pageFiles = project.all([`${FE}features/**/pages/*.jsx`]);
    const routes = project.has(`${FE}app/routes.jsx`) ? project.file(`${FE}app/routes.jsx`) : null;
    if (!routes && !pageFiles.length) return [{ severity: 'info', message: 'no frontend routes/pages yet: edge-pages-exist skipped' }];
    const hay = [routes?.code ?? '', project.has(`${FE}lib/paths.js`) ? project.file(`${FE}lib/paths.js`).code : ''].join('\n');
    const names = new Set(pageFiles.map((p) => p.base));
    return ROUTES.filter((r) => !hay.includes(`'${r}'`) && !hay.includes(`"${r}"`) && !pageNames(r).some((n) => names.has(n))).map((r) => ({ file: `${FE}app/routes.jsx`, line: 1, message: `edge route ${r} has no page or route entry (${pageName(r)}Page.jsx)` }));
  },
};

const LOG_ONLY = /^(?:(?:logger|console|log)\s*\.\s*\w+\s*\([^;]*\)\s*;?\s*)+$/s;
const swallowed = {
  id: 'no-swallowed-catch', ruleIds: ['EDGE-04'], severity: 'error', globs: [`${BE}**/*.js`, `${FE}**/*.{js,jsx}`],
  desc: 'empty catch or catch that only logs',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    for (const c of calls(f.code, /\bcatch\s*(?:\([^)]*\))?\s*\{/)) {
      const inner = c.body.slice(1, -1).trim();
      if (!inner) out.push({ line: c.line, message: 'empty catch swallows the error: handle, rethrow or surface it' });
      else if (LOG_ONLY.test(inner)) out.push({ line: c.line, message: 'catch only logs: the failure must also reach the caller or the user' });
    }
    for (const m of f.code.matchAll(/\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)?\s*=>\s*(?:\{\s*\}|undefined|null|void 0)\s*\)/g)) out.push({ line: lineOf(f.code, m.index), message: '.catch(() => {}) swallows the error' });
    return out;
  },
};

export default [declaration, pages, swallowed];
