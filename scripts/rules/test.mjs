// TEST group (rulebook 08). Reading notes:
//  - route-in-postman maps each route file to /api/v1/<module>/<path> (or the prefix found in app.js app.use(prefix, router));
//    path params are normalised to :p; /health, /ready and /__test__/ items/routes are exempt. Skipped (INFO) until routes and a collection exist.
//  - controller-has-supertest: a sibling <name>.controller.test.js or <name>.routes.test.js importing supertest satisfies both files.
//  - no-network-in-tests: bare fetch/axios calls are tolerated in files that use msw; real service hostnames and unmocked SDK imports are not.
//  - coverage-threshold compares the numbers in the vitest config with TEST-29 (backend 80/75, frontend 70/65 global); it cannot see git history,
//    so "threshold lowered" is only caught when it drops below the rule floor. Vitest `retry` above 0 is also an error (TEST-27).
import { calls, isTest, lineOf, BE } from './util.mjs';

const COLLECTION = 'backend/postman/samarthAi.postman_collection.json';
const norm = (p) => p.replace(/[?#].*$/, '').replace(/^\/api\/v\d+/, '').replace(/\{\{[^}]*\}\}|:[A-Za-z_]\w*/g, ':p').replace(/\/+/g, '/').replace(/(.)\/$/, '$1') || '/';
const EXEMPT = /^\/(?:health|ready|__test__)(?:\/|$)/;

function mountPrefixes(project) {
  const app = project.has(`${BE}app.js`) ? project.file(`${BE}app.js`).code : '';
  const map = {};
  for (const m of app.matchAll(/\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g)) {
    const imp = new RegExp(`import\\s+(?:\\{[^}]*\\b${m[2]}\\b[^}]*\\}|${m[2]})\\s+from\\s+['"][^'"]*modules/([\\w-]+)`).exec(app);
    if (imp) map[imp[1]] = m[1];
  }
  return map;
}
function collectItems(items, out = []) {
  for (const it of items || []) {
    if (it.item) collectItems(it.item, out);
    else if (it.request) {
      const u = it.request.url;
      const raw = typeof u === 'string' ? u : u?.raw ?? `/${(u?.path ?? []).join('/')}`;
      out.push({ key: `${String(it.request.method || 'GET').toUpperCase()} ${norm(raw.replace(/^\{\{baseUrl\}\}|^https?:\/\/[^/]+/, '').replace(/^\/?\{\{apiPrefix\}\}/, ''))}`, name: it.name });
    }
  }
  return out;
}
const routeInPostman = {
  id: 'route-in-postman', ruleIds: ['TEST-30', 'TEST-45'], severity: 'error', scope: 'project', globs: [],
  desc: 'every registered route has a Postman request and vice versa',
  run(project) {
    const files = project.all([`${BE}modules/*/*.routes.js`]).filter((f) => !isTest(f.rel));
    if (!files.length) return [{ severity: 'info', message: 'no backend routes yet: route-in-postman skipped' }];
    if (!project.has(COLLECTION)) return [{ severity: 'info', message: `${COLLECTION} missing: route-in-postman skipped` }];
    let col;
    try { col = JSON.parse(project.file(COLLECTION).text); } catch { return [{ file: COLLECTION, message: 'collection is not valid JSON' }]; }
    const have = new Set(collectItems(col.item).map((i) => i.key));
    const prefixes = mountPrefixes(project);
    const out = [];
    const wanted = new Set();
    for (const f of files) {
      const mod = f.rel.split('/')[3];
      for (const c of calls(f.code, /\b\w*[rR]outer\w*\s*\.\s*(?:get|post|put|patch|delete)\s*\(/)) {
        const method = /\.\s*(\w+)\s*\($/.exec(c.m[0])[1].toUpperCase();
        const p = /\(\s*['"`]([^'"`]*)/.exec(c.body)?.[1] ?? '';
        const key = `${method} ${norm(`${prefixes[mod] ?? `/api/v1/${mod}`}${p === '/' ? '' : p}`)}`;
        wanted.add(key);
        if (!have.has(key) && !EXEMPT.test(key.split(' ')[1])) out.push({ file: f.rel, line: c.line, message: `${key} has no request in the Postman collection` });
      }
    }
    for (const k of have) if (!wanted.has(k) && !EXEMPT.test(k.split(' ')[1])) out.push({ file: COLLECTION, line: 1, message: `collection request ${k} has no matching route` });
    return out;
  },
};

const coverage = {
  id: 'coverage-threshold', ruleIds: ['TEST-29', 'TEST-27'], severity: 'error', scope: 'project', globs: [],
  desc: 'vitest coverage thresholds at or above TEST-29; retry stays 0',
  run(project) {
    const files = ['backend/vitest.config.js', 'frontend/vitest.config.js', 'frontend/vite.config.js'].filter((p) => project.has(p));
    if (!files.length) return [{ severity: 'info', message: 'no vitest config yet: coverage-threshold skipped' }];
    const out = [];
    for (const rel of files) {
      const c = project.file(rel).code;
      if (rel.endsWith('vite.config.js') && !/\btest\s*:/.test(c)) continue;
      const need = rel.startsWith('backend') ? { lines: 80, branches: 75 } : { lines: 70, branches: 65 };
      if (!/coverage/.test(c) || !/thresholds/.test(c)) { out.push({ file: rel, message: 'no coverage.thresholds configured (@vitest/coverage-v8)' }); continue; }
      for (const [k, min] of Object.entries(need)) for (const m of c.matchAll(new RegExp(`\\b${k}\\s*:\\s*(\\d+)`, 'g'))) if (+m[1] < min) out.push({ file: rel, line: lineOf(c, m.index), message: `${k} threshold ${m[1]} is below the rule floor ${min}` });
      const r = /\bretry\s*:\s*([1-9]\d*)/.exec(c);
      if (r) out.push({ file: rel, line: lineOf(c, r.index), message: 'vitest retry must stay 0 (flaky tests are bugs)' });
    }
    return out;
  },
};

const REASON = /\/\/.*--\s*\S|\/\*.*--\s*\S/;
const onlyCheck = {
  id: 'no-only-in-tests', ruleIds: ['TEST-26'], severity: 'error', globs: ['**/*.test.{js,jsx}'],
  desc: '.only always; .skip/.todo need a "-- reason" comment',
  run(f) {
    const out = [];
    const lines = f.text.split('\n');
    lines.forEach((ln, i) => {
      if (/\b(?:it|test|describe|suite)\.only\b|\b(?:fit|fdescribe)\s*\(/.test(ln)) out.push({ line: i + 1, message: '.only must never be committed' });
      else if (/\b(?:it|test|describe)\.(?:skip|todo)\b|\bx(?:it|describe)\s*\(/.test(ln) && !REASON.test(ln) && !REASON.test(lines[i - 1] ?? '')) out.push({ line: i + 1, message: '.skip/.todo needs a trailing "-- reason + issue/date" comment' });
    });
    return out;
  },
};

const SDKS = ['cloudinary', '@getbrevo/brevo', 'google-auth-library', 'openai', '@anthropic-ai/sdk', 'nodemailer'];
const network = {
  id: 'no-network-in-tests', ruleIds: ['TEST-22', 'TEST-13'], severity: 'error', globs: ['**/*.test.{js,jsx}', 'frontend/src/test/**', 'backend/tests/**'],
  desc: 'real hostnames, unmocked SDKs, bare fetch/axios in tests',
  run(f) {
    if (f.code == null) return [];
    const out = [];
    const usesMsw = /\bmsw\b|setupServer|http\.(?:get|post)\(/.test(f.code);
    f.code.split('\n').forEach((ln, i) => {
      const add = (message) => out.push({ line: i + 1, message });
      if (/(?:cloudinary\.com|brevo\.com|sendinblue\.com|googleapis\.com|openai\.com|anthropic\.com|onrender\.com|mongodb\.net|vercel\.app)/.test(ln)) add('real service hostname in a test: mock the integration');
      if (/mongodb\+srv:/.test(ln)) add('real MongoDB URI in a test: use mongodb-memory-server');
      if (!usesMsw && (/(?<![\w$.])fetch\s*\(/.test(ln) || /\baxios\.(?:get|post|put|patch|delete|request)\s*\(/.test(ln))) add('network call in a test without MSW');
    });
    for (const sdk of SDKS) {
      const esc = sdk.replace(/[/@.-]/g, '\\$&');
      if (new RegExp(`from\\s*['"]${esc}(?:/[^'"]*)?['"]|require\\(\\s*['"]${esc}`).test(f.code) && !new RegExp(`(?:vi|jest)\\.mock\\(\\s*['"]${esc}`).test(f.code)) out.push({ line: 1, message: `imports ${sdk} without vi.mock("${sdk}")` });
    }
    return out;
  },
};

const hasSibling = (project, f, names) => names.some((n) => project.has(n) && /supertest/.test(project.file(n).text ?? ''));
const supertest = {
  id: 'controller-has-supertest', ruleIds: ['TEST-07', 'TEST-08'], severity: 'error', globs: [`${BE}**/*.{controller,routes}.js`],
  desc: 'controller/routes need a sibling Supertest test',
  run(f, project) {
    if (isTest(f.rel)) return [];
    const stem = f.rel.replace(/\.(?:controller|routes)\.js$/, '');
    return hasSibling(project, f, [`${stem}.controller.test.js`, `${stem}.routes.test.js`]) ? [] : [{ line: 1, message: `no ${f.base.replace(/\.js$/, '.test.js')} using supertest (route table: 400/401/403/404/409)` }];
  },
};
const hasTest = {
  id: 'backend-has-test-for-service', ruleIds: ['TEST-07', 'TEST-02'], severity: 'error', globs: [`${BE}**/*.service.js`, `${BE}utils/*.js`, `${BE}middlewares/*.js`],
  desc: 'service/util/middleware files need a sibling .test.js',
  run: (f, project) => (isTest(f.rel) || project.has(f.rel.replace(/\.js$/, '.test.js')) ? [] : [{ line: 1, message: `missing ${f.base.replace(/\.js$/, '.test.js')} beside it (tests ship with the code)` }]),
};

const SECRET_KEY = /pass(?:word)?|token|secret|api[-_]?key|authorization|cookie|credential/i;
const SAFE_VAL = /^(?:|\{\{[^}]*\}\}|change-?me.*|<.*>|your[-_ ].*|placeholder.*|http.*|true|false|\d+)$/i;
const postmanSecrets = {
  id: 'postman-no-secrets', ruleIds: ['TEST-33', 'TEST-46'], severity: 'error', globs: ['backend/postman/*.json'],
  desc: 'no passwords, tokens, keys or real emails in Postman files',
  run(f) {
    const out = [];
    const lines = f.text.split('\n');
    lines.forEach((ln, i) => {
      const add = (message) => out.push({ line: i + 1, message });
      if (/eyJ[\w-]{10,}\.eyJ/.test(ln)) add('JWT literal');
      if (/Bearer\s+(?!\{\{)[A-Za-z0-9._-]{12,}/.test(ln)) add('Bearer token literal');
      for (const m of ln.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)) if (!/^(?:example\.(?:test|com|org)|[\w-]+\.test|invalid|localhost)$/i.test(m[1]) && !/\{\{/.test(m[0])) add(`real-looking email domain "${m[1]}": use example.test or a variable`);
      const kv = /"key"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]*)"/.exec(ln);
      if (kv && SECRET_KEY.test(kv[1]) && !SAFE_VAL.test(kv[2])) add(`variable "${kv[1]}" holds a literal value: use a placeholder or generate it in a script`);
      const body = /\\?"(password|newPassword|currentPassword|token|apiKey|secret)\\?"\s*:\s*\\?"(?!\{\{)([^"\\]+)/i.exec(ln);
      if (body && !SAFE_VAL.test(body[2])) add(`request body hard-codes ${body[1]}: use a {{variable}}`);
    });
    return out;
  },
};

const outbox = {
  id: 'outbox-test-only', ruleIds: ['TEST-42', 'TEST-43'], severity: 'error', globs: [`${BE}**/*.js`],
  desc: '/__test__/ outbox guarded by NODE_ENV=test and memory transport, with an absence test',
  run(f, project) {
    if (isTest(f.rel) || !/__test__/.test(f.code)) return [];
    const out = [];
    if (!(/['"]test['"]/.test(f.code) && /['"]memory['"]/.test(f.code))) out.push({ line: lineOf(f.code, f.code.indexOf('__test__')), message: 'outbox route must be registered only when NODE_ENV === "test" AND EMAIL_TRANSPORT === "memory"' });
    const hasAbsence = project.all(['backend/**/*.test.js']).some((t) => /__test__/.test(t.text ?? '') && /404/.test(t.text ?? ''));
    if (!hasAbsence) out.push({ line: 1, message: 'no test proves the outbox returns 404 outside test+memory' });
    return out;
  },
};

export default [hasTest, supertest, routeInPostman, onlyCheck, network, coverage, postmanSecrets, outbox];
