// FRONTEND group (rulebook 02): HTTP, storage, security, i18n, forms. Redux/slice/import checks live in frontend-state.mjs.
// Reading notes:
//  - Test files, src/test and src/mocks are exempt from the "no X in app code" checks (MSW handlers legitimately know URLs).
//  - no-hardcoded-string is a heuristic (JSX text on one line, text-only lines, aria-label/placeholder/alt/title attributes).
//  - i18n key usage is only verified for static t('key') calls whose namespace is explicit or from the file's first useTranslation().
//  - bundle-budget: "initial" = scripts/modulepreloads referenced from dist/index.html (gzip summed); every other chunk is a route chunk.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { matchesGlobs } from '../check-engine.mjs';
import { rx, bannedPkgs, isTest, jsxTags, attr, calls, depNames, parseJson, FE } from './util.mjs';
import { sizeCheck } from './fs.mjs';

const SRC = [`${FE}**/*.{js,jsx}`];
const exempt = (f) => isTest(f.rel);
const only = (rel) => (f) => exempt(f) || f.rel === FE + rel;
export const combine = (base, ...others) => ({
  ...base,
  globs: [...new Set([...base.globs, ...others.flatMap((o) => o.globs)])],
  run: (f, p) => [base, ...others].flatMap((c) => (matchesGlobs(f.rel, c.globs) ? c.run(f, p) : [])),
});
const val = (attrs, n) => attr(attrs, n)?.replace(/^[\s{'"`]+|[\s}'"`]+$/g, '');

const ALLOWED_KEYS = /^sai-(theme|lang|sidebar|return-to|chunk-reload|quiz-draft)(:.*)?$/;
const TOKENISH = /token|jwt|auth|session|csrf|password|secret|refresh|access/i;
const storage = {
  id: 'no-localstorage-token', ruleIds: ['FE-106', 'AUTH-01'], severity: 'error', globs: SRC,
  desc: 'browser storage outside lib/storage.js; keys outside the FE-106 allow-list or token-like',
  run(f) {
    if (exempt(f)) return [];
    const isLib = f.rel === `${FE}lib/storage.js`;
    const out = [];
    f.code.split('\n').forEach((ln, i) => {
      if (!isLib && /\b(?:localStorage|sessionStorage|indexedDB)\b/.test(ln)) out.push({ line: i + 1, message: 'browser storage must go through lib/storage.js (never for tokens)' });
      if (isLib) {
        for (const m of ln.matchAll(/(['"`])([\w:.-]{3,40})\1/g)) {
          if (m[2].startsWith('sai-') && !ALLOWED_KEYS.test(m[2])) out.push({ line: i + 1, message: `storage key "${m[2]}" is not in the FE-106 allow-list` });
          else if (TOKENISH.test(m[2]) && !/^sai-/.test(m[2]) && !/^(?:local|session)Storage$/.test(m[2]) && /^[a-z][\w:.-]*$/i.test(m[2]) && !/\./.test(m[2])) out.push({ line: i + 1, message: `storage key "${m[2]}" looks token-like` });
        }
      }
    });
    return out;
  },
};

const apiFile = (f) => /^frontend\/src\/features\/[^/]+\/api\/[^/]+Api\.js$/.test(f.rel) || f.rel === `${FE}lib/apiClient.js`;
const rtk = combine(
  rx('no-rtk-query', ['FE-04'], 'error', SRC, [[/\bcreateApi\s*\(|\bfetchBaseQuery\b|@reduxjs\/toolkit\/query/, 'RTK Query is not used: thunks + axios only']], { skip: exempt }),
  bannedPkgs('no-rtk-query', ['FE-04'], 'error', [], ['frontend/package.json'], '@rtk-query', 'RTK Query'),
);

const hardStr = {
  id: 'no-hardcoded-string', ruleIds: ['FE-85'], severity: 'warn', globs: [`${FE}**/*.jsx`],
  desc: 'untranslated JSX text, aria-label, placeholder, alt (error after launch)',
  run(f) {
    if (exempt(f)) return [];
    const out = [];
    const KW = /^(?:return|import|export|const|let|var|else|case|default|function|async|await|if|for|while|try|catch|finally|new|throw|break|continue|type|from|switch|do)\b/;
    f.code.split('\n').forEach((ln, i) => {
      const add = (message) => out.push({ line: i + 1, message });
      for (const m of ln.matchAll(/(?<![=-])>([^<>{}=;&|()]*[A-Za-z]{2,}[^<>{}=;&|()]*)</g)) if (/\w{2}/.test(m[1])) add(`hard-coded text "${m[1].trim().slice(0, 30)}": use t()`);
      for (const m of ln.matchAll(/\b(aria-label|placeholder|alt|title)\s*=\s*"([^"{}]*[A-Za-z][^"{}]*)"/g)) add(`hard-coded ${m[1]} "${m[2].slice(0, 30)}": use t()`);
      if (/^\s*[A-Za-z][A-Za-z0-9 ,'!?-]*\s*$/.test(ln) && /\s/.test(ln.trim()) && !KW.test(ln.trim()) && !/^\s*[a-z]+\s*$/.test(ln)) add(`hard-coded text "${ln.trim().slice(0, 30)}": use t()`);
    });
    return out;
  },
};

const schemaMsg = {
  id: 'no-literal-message-in-schema', ruleIds: ['FE-75'], severity: 'error', globs: [`${FE}features/*/schemas/*.js`],
  desc: 'zod messages must be i18n keys, not English',
  run(f) {
    const out = [];
    const keyLike = (s) => /^[A-Za-z][\w-]*(?:[.:][\w-]+)+$/.test(s);
    f.code.split('\n').forEach((ln, i) => {
      if (/^\s*(?:import|export\s*\{)/.test(ln)) return;
      for (const m of ln.matchAll(/(?:message|required_error|invalid_type_error|error)\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1|,\s*(['"`])((?:\\.|(?!\3).)*)\3\s*\)/g)) {
        const s = m[2] ?? m[4];
        if (s && !keyLike(s) && /[A-Za-z]/.test(s)) out.push({ line: i + 1, message: `zod message "${s.slice(0, 30)}" is not an i18n key (use e.g. validation.required)` });
      }
    });
    return out;
  },
};

const authAttrs = {
  id: 'auth-input-attrs', ruleIds: ['FE-78'], severity: 'error', globs: [`${FE}**/*.jsx`],
  desc: 'type="password" outside PasswordInput; autoComplete="off" on credentials',
  run(f) {
    if (exempt(f)) return [];
    const out = [];
    for (const t of jsxTags(f.code)) {
      if (!/^(?:input|Input|\w*Input)$/.test(t.name)) continue;
      const type = val(t.attrs, 'type');
      if (type === 'password' && f.base !== 'PasswordInput.jsx') out.push({ line: t.line, message: 'type="password" only inside the shared PasswordInput' });
      if (val(t.attrs, 'autoComplete') === 'off' && (type === 'password' || type === 'email' || t.name === 'PasswordInput' || /password|email|username|otp/i.test(val(t.attrs, 'name') ?? ''))) out.push({ line: t.line, message: 'autoComplete="off" on a credential field' });
    }
    return out;
  },
};

const extLink = {
  id: 'external-link-rel', ruleIds: ['FE-103'], severity: 'error', globs: [`${FE}**/*.jsx`],
  desc: 'target="_blank" without rel="noopener noreferrer"',
  run(f) {
    if (exempt(f)) return [];
    const out = [];
    for (const t of jsxTags(f.code)) {
      if (val(t.attrs, 'target') !== '_blank') continue;
      const rel = attr(t.attrs, 'rel') ?? '';
      if (!(/noopener/.test(rel) && /noreferrer/.test(rel))) out.push({ line: t.line, message: 'target="_blank" needs rel="noopener noreferrer" (use ExternalLink)' });
    }
    f.code.split('\n').forEach((ln, i) => { if (/window\.open\(.*_blank/.test(ln) && !/noopener/.test(ln)) out.push({ line: i + 1, message: "window.open(..., '_blank') needs 'noopener,noreferrer'" }); });
    return out;
  },
};

const abortCleanup = {
  id: 'no-abort-in-effect-cleanup', ruleIds: ['FE-33'], severity: 'error', globs: SRC,
  desc: '.abort() inside useEffect cleanup',
  run(f) {
    if (exempt(f)) return [];
    const out = [];
    for (const c of calls(f.code, /\buse(?:Layout)?Effect\s*\(/)) {
      const r = /return\s*(?:\(\s*\)\s*=>|function\s*\w*\s*\(\s*\))/.exec(c.body);
      if (!r) continue;
      const tail = c.body.slice(r.index);
      const a = /\.abort\s*\(/.exec(tail);
      if (a) out.push({ line: c.line + c.body.slice(0, r.index + a.index).split('\n').length - 1, message: 'do not abort thunks in effect cleanup (breaks StrictMode dedupe)' });
    }
    return out;
  },
};

const flatten = (o, p = '', out = new Set()) => {
  for (const [k, v] of Object.entries(o)) v && typeof v === 'object' ? flatten(v, p ? `${p}.${k}` : k, out) : out.add(p ? `${p}.${k}` : k);
  return out;
};
const MANDATORY_HI = ['common', 'nav', 'auth', 'errors', 'validation'];
const i18nParity = {
  id: 'i18n-key-parity', ruleIds: ['FE-84', 'FE-83'], severity: 'error', scope: 'project', globs: [],
  desc: 'en/hi key parity, plural forms, static t() keys exist in en',
  run(project) {
    const files = project.all([`${FE}i18n/locales/*/*.json`]);
    if (!files.length) return [{ severity: 'info', message: 'no i18n locale files yet: i18n-key-parity skipped' }];
    const ns = { en: {}, hi: {} };
    const out = [];
    for (const f of files) {
      const [, lng, name] = /locales\/([a-z]{2})\/([^/]+)\.json$/.exec(f.rel);
      const j = parseJson(f);
      if (!j) { out.push({ file: f.rel, message: 'invalid JSON' }); continue; }
      (ns[lng] ??= {})[name] = flatten(j);
    }
    for (const [name, keys] of Object.entries(ns.en)) {
      for (const k of keys) {
        if (/_one$/.test(k) && !keys.has(k.replace(/_one$/, '_other'))) out.push({ file: `${FE}i18n/locales/en/${name}.json`, message: `${name}:${k} has no _other plural` });
        if (/_other$/.test(k) && !keys.has(k.replace(/_other$/, '_one'))) out.push({ file: `${FE}i18n/locales/en/${name}.json`, message: `${name}:${k} has no _one plural` });
      }
      const hi = ns.hi[name];
      if (!hi && MANDATORY_HI.includes(name)) out.push({ file: `${FE}i18n/locales/hi/${name}.json`, message: `mandatory hi namespace "${name}" is missing` });
      else if (hi && MANDATORY_HI.includes(name)) for (const k of keys) if (!hi.has(k)) out.push({ file: `${FE}i18n/locales/hi/${name}.json`, message: `hi is missing ${name}:${k}` });
    }
    for (const [name, keys] of Object.entries(ns.hi)) for (const k of keys) if (!ns.en[name]?.has(k)) out.push({ file: `${FE}i18n/locales/hi/${name}.json`, message: `orphan hi key ${name}:${k} (not in en)` });
    for (const f of project.all([`${FE}**/*.{js,jsx}`])) {
      if (isTest(f.rel) || /\/i18n\//.test(f.rel)) continue;
      const dm = /useTranslation\(\s*\[?\s*['"]([\w-]+)['"]/.exec(f.code);
      f.code.split('\n').forEach((ln, i) => {
        for (const m of ln.matchAll(/(?<![\w.$])t\(\s*(['"])([\w.:-]+)\1/g)) {
          const [n, k] = m[2].includes(':') ? m[2].split(':') : [dm?.[1], m[2]];
          if (!n || !ns.en[n]) { if (n && Object.keys(ns.en).length) out.push({ file: f.rel, line: i + 1, message: `t("${m[2]}"): namespace "${n}" has no en file` }); continue; }
          const has = [...ns.en[n]].some((e) => e === k || e.startsWith(`${k}.`) || e === `${k}_one` || e === `${k}_other`);
          if (!has) out.push({ file: f.rel, line: i + 1, message: `t("${m[2]}") is missing in en/${n}.json` });
        }
      });
    }
    return out;
  },
};

const gz = (p) => zlib.gzipSync(fs.readFileSync(p)).length;
const bundle = {
  id: 'bundle-budget', ruleIds: ['FE-111'], severity: 'error', scope: 'project', globs: [],
  desc: 'initial JS <= 250 kB gzip, route chunks <= 150 kB gzip (needs frontend/dist)',
  run(project) {
    const dist = path.join(project.root, 'frontend/dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) return [{ severity: 'info', message: 'frontend/dist not built: bundle-budget skipped (run npm run build)' }];
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const initial = new Set([...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
    const out = [];
    let total = 0;
    const dir = path.join(dist, 'assets');
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.js')) : []) {
      const size = gz(path.join(dir, name));
      if (initial.has(`assets/${name}`)) total += size;
      else if (size > 150 * 1024) out.push({ file: `frontend/dist/assets/${name}`, message: `route chunk ${(size / 1024).toFixed(1)} kB gzip exceeds 150 kB` });
    }
    if (total > 250 * 1024) out.push({ file: 'frontend/dist/index.html', message: `initial JS ${(total / 1024).toFixed(1)} kB gzip exceeds 250 kB` });
    return out;
  },
};

const FE_BAD = /^(?:redux-persist|zustand|swr|@tanstack\/react-query|ky|react-router-dom|moment|prop-types|typescript|got|superagent|node-fetch|jest|mocha|cypress)$/;
const BE_BAD = /^(?:jest|mocha|cypress|typescript)$/;
const forbidden = {
  id: 'forbidden-dependencies', ruleIds: ['FE-04', 'FE-05', 'FE-01', 'TEST-18', 'BE-28'], severity: 'error',
  globs: ['frontend/package.json', 'backend/package.json', 'package.json'],
  desc: 'package.json: banned libraries, TypeScript, non-caret "latest" ranges',
  run(f) {
    const j = parseJson(f);
    if (!j) return [];
    const out = [];
    const bad = f.rel.startsWith('frontend/') ? FE_BAD : BE_BAD;
    for (const d of depNames(f)) {
      if (bad.test(d)) out.push({ line: 1, message: `"${d}" is not allowed (charter stack only)` });
      else if (/^@types\//.test(d) && f.rel.startsWith('frontend/')) out.push({ line: 1, severity: 'warn', message: `"${d}": TypeScript types are not used (FE-01)` });
      else if (f.rel.startsWith('backend/') && /^(?:express-mongo-sanitize|hpp)$/.test(d)) out.push({ line: 1, severity: 'warn', message: `"${d}" breaks on Express 5 (BE-28): use utils/sanitize.js` });
    }
    for (const [d, v] of Object.entries({ ...j.dependencies, ...j.devDependencies })) if (/^(?:latest|\*|x)$/i.test(String(v))) out.push({ line: 1, message: `"${d}": "${v}" range: use a caret range (FE-05)` });
    return out;
  },
};

const noDangerous = rx('no-dangerously-set-inner-html', ['FE-102'], 'error', SRC, [[/dangerouslySetInnerHTML|\binnerHTML\b|insertAdjacentHTML|document\.write\b|\beval\s*\(|new\s+Function\s*\(/, 'raw HTML/eval is banned: use components/common/SafeHtml.jsx']], { skip: only('components/common/SafeHtml.jsx') });
const secret = /VITE_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|API_KEY|TOKEN)[A-Z0-9_]*/;
const viteSecret = {
  id: 'no-vite-secret', ruleIds: ['FE-100'], severity: 'error', globs: ['frontend/.env*', `${FE}**/*.{js,jsx}`, 'frontend/vite.config.js'],
  desc: 'secret-looking VITE_* names or values',
  run(f) {
    const out = [];
    (f.code ?? '').split('\n').forEach((ln, i) => {
      const m = secret.exec(ln);
      if (m) out.push({ line: i + 1, message: `${m[0]} looks secret: VITE_ variables are public, private keys never belong in frontend/` });
      const e = /^\s*(VITE_[A-Z0-9_]+)\s*=\s*["']?([^\s"']+)/.exec(ln);
      if (e && !/PUBLIC/.test(e[1]) && !m && /^[A-Za-z0-9_+/=-]{32,}$/.test(e[2])) out.push({ line: i + 1, message: `${e[1]} has a secret-looking value` });
    });
    return out;
  },
};

export default [
  storage,
  rx('no-fetch', ['FE-38'], 'error', SRC, [
    [/(?<![\w$.])(?:(?:window|globalThis|self)\.)?fetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b/, 'use the axios apiClient (fetch/XHR/sendBeacon are banned)'],
    [/from\s*['"](?:ky|got|superagent|node-fetch|whatwg-fetch|isomorphic-fetch)['"]/, 'second HTTP client is banned'],
  ], { skip: exempt }),
  rx('axios-only-in-api-files', ['FE-39'], 'error', SRC, [
    [/from\s*['"]axios['"]|require\(\s*['"]axios['"]\)|from\s*['"][^'"]*\/apiClient(?:\.js)?['"]/, 'axios/apiClient may only be imported in features/*/api/*Api.js and lib/apiClient.js'],
  ], { skip: (f) => exempt(f) || apiFile(f) }),
  combine(
    rx('single-axios-instance', ['FE-38'], 'error', SRC, [[/\baxios\.(?:get|post|put|patch|delete|head|request|options)\s*\(|\baxios\.defaults\b/, 'use the single apiClient instance, not bare axios']], { skip: exempt }),
    rx('single-axios-instance', ['FE-38'], 'error', SRC, [[/\baxios\.create\s*\(/, 'axios.create only in lib/apiClient.js']], { skip: only('lib/apiClient.js') }),
  ),
  rtk,
  rx('no-hardcoded-api-url', ['FE-101'], 'error', SRC, [[/onrender\.com|localhost:8000|['"`][^'"`]*\/api\/v1/, 'API origin/prefix belongs in lib/env.js only']], { skip: (f) => exempt(f) || f.rel === `${FE}lib/env.js` }),
  rx('no-console', ['FE-109'], 'error', SRC, [[/\bconsole\s*\.\s*\w+/, 'use lib/logger.js, not console.*']], { skip: only('lib/logger.js') }),
  noDangerous,
  viteSecret,
  combine(
    rx('no-document-cookie', ['FE-41'], 'error', SRC, [[/document\.cookie\s*=(?!=)/, 'never write cookies from JS']], { skip: exempt }),
    rx('no-document-cookie', ['FE-41'], 'error', SRC, [[/document\.cookie/, 'document.cookie is read only in lib/csrf.js']], { skip: only('lib/csrf.js') }),
  ),
  rx('no-unsafe-redirect', ['FE-56', 'FE-71', 'AUTH-57'], 'error', SRC, [
    [/(?:window|document|globalThis|self)\.location(?:\.href)?\s*=(?!=)|(?<![\w.$])location\.href\s*=(?!=)|\blocation\.(?:assign|replace)\s*\(/, 'no window.location navigation: use router navigate()'],
    [/(?:\bnavigate\s*\(|<Navigate\b).*(?:returnTo|searchParams|location\.state|state\?\.from|sai-return-to|redirectTo)/, 'navigation from URL/state input must go through safeReturnPath()'],
  ], { skip: exempt, lineSkip: (l) => /safeReturnPath/.test(l) }),
  abortCleanup,
  schemaMsg,
  i18nParity,
  hardStr,
  authAttrs,
  extLink,
  sizeCheck('component-max-lines', ['FE-88'], '.jsx over 200 lines (warn) or 300 (error)', true),
  bundle,
  forbidden,
];
