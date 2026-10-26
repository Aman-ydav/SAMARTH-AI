// BACKEND group (rulebook 03). Reading notes:
//  - routes-have-validate-and-auth: a route is public only with a `// public` / `@public` marker in its call or on the line above;
//    `router.use(authenticate)` earlier in the file satisfies `authenticate` for the routes after it.
//  - no-secret-literals reports the variable NAME only, never the value. Placeholders: empty, change-me*, <...>, your-*, xxx*, ${...}.
//  - no-unrelated-leftovers (warn) also flags blocks of 3+ consecutive commented-out code lines (BE-10).
//  - controller handlers are `export const x = asyncHandler(...)`; handler objects (`export const c = { a: asyncHandler(...) }`) are inspected per property.
import { rx, isTest, calls, balanced, lineOf, BE } from './util.mjs';

const SRC = [`${BE}**/*.js`];
const cfgEnv = `${BE}config/env.js`;

const controllerCheck = {
  id: 'controller-uses-asyncHandler', ruleIds: ['BE-22', 'BE-40'], severity: 'error', globs: [`${BE}**/*.controller.js`],
  desc: 'exported controller handlers must be wrapped in asyncHandler',
  run(f) {
    const c = f.code;
    const out = [];
    for (const m of c.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) out.push({ line: lineOf(c, m.index), message: `${m[1]}: use export const ${m[1]} = asyncHandler(async (req, res) => ...)` });
    for (const m of c.matchAll(/export\s+const\s+(\w+)\s*=\s*/g)) {
      const at = m.index + m[0].length;
      const rest = c.slice(at, at + 200);
      if (/^asyncHandler\s*\(/.test(rest)) continue;
      if (rest[0] === '{') {
        const body = c.slice(at, balanced(c, at) + 1);
        for (const p of body.matchAll(/^\s*(\w+)\s*(?::\s*(?:async\b|function\b|\([^)]*\)\s*=>|\w+\s*=>)|\([^)]*\)\s*\{)/gm)) out.push({ line: lineOf(c, at + p.index), message: `handler "${p[1]}" is not wrapped in asyncHandler` });
      } else if (/^(?:async\b|function\b|\([^)]*\)\s*=>|\w+\s*=>)/.test(rest)) out.push({ line: lineOf(c, m.index), message: `${m[1]} is not wrapped in asyncHandler` });
    }
    return out;
  },
};

const SVC_PARAM = /\b(?:req|res|next)\b/;
const serviceCheck = {
  id: 'no-req-res-in-service', ruleIds: ['BE-50'], severity: 'error', globs: [`${BE}**/*.service.js`],
  desc: 'services take plain arguments: no req/res/next, Express or cookie imports',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    const c = f.code;
    for (const m of c.matchAll(/from\s*['"](?:express|cookie-parser|cookie)['"]/g)) out.push({ line: lineOf(c, m.index), message: 'services must not import Express or cookie helpers' });
    for (const m of c.matchAll(/(?:function\s*\w*\s*|=\s*(?:async\s*)?|async\s+)\(([^)]*)\)\s*(?:=>|\{)/g)) if (SVC_PARAM.test(m[1].replace(/=.*$/gm, ''))) out.push({ line: lineOf(c, m.index), message: `parameter list (${m[1].trim().slice(0, 30)}) takes req/res/next: pass plain data` });
    for (const m of c.matchAll(/(?<![\w$.])(?:req|res)\.(?:body|query|params|cookies|headers|user|json|status|send|cookie|locals|ip)\b/g)) out.push({ line: lineOf(c, m.index), message: `${m[0]} used in a service` });
    return out;
  },
};

const MARK = /@public|\/\/\s*public\b|publicRoute\s*\(/i;
const routeCheck = {
  id: 'routes-have-validate-and-auth', ruleIds: ['BE-24', 'BE-43'], severity: 'error', globs: [`${BE}**/*.routes.js`],
  desc: 'every route has validate() and authenticate (public ones carry a // public marker)',
  run(f) {
    if (isTest(f.rel)) return [];
    const c = f.code;
    const globalAuth = /\b\w+\.use\s*\(\s*authenticate\b/.exec(c)?.index ?? Infinity;
    const out = [];
    const seen = new Set();
    const list = [...calls(c, /\b\w*[rR]outer\w*\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(/), ...calls(c, /\)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(/)];
    for (const r of list) {
      if (seen.has(r.idx)) continue;
      seen.add(r.idx);
      const lineStart = f.text.lastIndexOf('\n', r.idx - 1);
      const prev = f.text.slice(f.text.lastIndexOf('\n', lineStart - 1) + 1, lineStart);
      const raw = f.text.slice(r.open, r.end + 1);
      if (MARK.test(raw) || MARK.test(prev)) continue;
      const missing = [];
      if (!/\bvalidate\s*\(/.test(r.body)) missing.push('validate(schema)');
      if (!/\bauthenticate\b/.test(r.body) && r.idx < globalAuth) missing.push('authenticate');
      if (missing.length) out.push({ line: r.line, message: `route ${/\(\s*(['"`][^'"`]*)/.exec(r.body)?.[1]?.slice(1) ?? ''} lacks ${missing.join(' + ')} (mark intentional public routes with // public)` });
    }
    return out;
  },
};

const ENV_NAME = /(?:SECRET|API_KEY|PRIVATE_KEY|PASSWORD|PASSWD|TOKEN|_KEY)$/;
const PLACEHOLDER = /^(?:|change-?me.*|<.*>|your[-_ ].*|x{3,}.*|replace.*|\.\.\.|example.*|placeholder.*|\$\{.*\}|todo.*|none|null|undefined)$/i;
const TOKEN_RES = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'], [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key block'],
  [/xkeysib-[a-f0-9]{20,}/, 'Brevo API key'], [/\bsk-[A-Za-z0-9]{20,}/, 'API secret key'], [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/GOCSPX-[A-Za-z0-9_-]{20,}/, 'Google client secret'], [/\bgh[pousr]_[A-Za-z0-9]{36}/, 'GitHub token'],
  [/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/, 'JWT'], [/cloudinary:\/\/\d+:[\w-]+@/, 'Cloudinary URL with secret'],
];
const secretCheck = {
  id: 'no-secret-literals', ruleIds: ['BE-65'], severity: 'error',
  globs: ['backend/**', '**/.env*', 'frontend/.env*'],
  desc: 'real-looking keys, tokens, Mongo URIs with passwords, secret env values (names only are reported)',
  run(f) {
    if (f.text == null || /\.test\.js$/.test(f.rel) || /^backend\/tests\//.test(f.rel) || f.base === 'package.json') return [];
    const out = [];
    const isEnv = /(^|\/)\.env/.test(f.rel);
    f.text.split('\n').forEach((ln, i) => {
      const line = i + 1;
      const uri = /mongodb(?:\+srv)?:\/\/([^:/\s@'"]+):([^@\s'"]+)@/.exec(ln);
      if (uri && !PLACEHOLDER.test(uri[2]) && !/^(?:password|pass|pwd)$/i.test(uri[2])) out.push({ line, message: 'MongoDB URI with an embedded password: use a placeholder' });
      for (const [re, what] of TOKEN_RES) if (re.test(ln)) out.push({ line, message: `${what} literal (value hidden)` });
      if (isEnv) {
        const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(ln);
        if (!m) return;
        const v = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
        if (ENV_NAME.test(m[1]) && !/PUBLIC/.test(m[1]) && !PLACEHOLDER.test(v) && v.length >= 8 && (/\d/.test(v) || v.length >= 24)) out.push({ line, message: `${m[1]} holds a real-looking secret: use an empty or change-me placeholder and rotate it` });
      } else if (/\.js$/.test(f.rel)) {
        const m = /\b(\w*(?:secret|apiKey|api_key|password|privateKey)\w*)\s*[:=]\s*(['"])([A-Za-z0-9+/=_-]{20,})\2/i.exec(ln);
        if (m && !PLACEHOLDER.test(m[3])) out.push({ line, message: `${m[1]} is assigned a literal secret-looking string` });
      }
    });
    return out;
  },
};

const CODEY = /^\s*\/\/\s*(?:(?:const|let|var|return|import|export|await|if|for|while|app\.|router\.|res\.|req\.|throw|try|catch)\b.*|.*[;{}]\s*$|[\w.$]+\([^)]*\)\s*;?\s*)$/;
const leftovers = {
  id: 'no-unrelated-leftovers', ruleIds: ['BE-10', 'BE-04'], severity: 'warn', globs: SRC,
  desc: 'roomezy, TODO@, normalizeParticipants, duplicate dotenv calls, commented-out code',
  run(f) {
    const out = [];
    const lines = f.text.split('\n');
    let run = 0;
    lines.forEach((ln, i) => {
      if (/roomezy/i.test(ln)) out.push({ line: i + 1, message: 'leftover from another project ("roomezy")' });
      if (/TODO@/.test(ln)) out.push({ line: i + 1, message: 'TODO@ marker: resolve or track in docs/19' });
      if (/normalizeParticipants/.test(ln)) out.push({ line: i + 1, message: 'unrelated helper normalizeParticipants' });
      if (f.rel !== cfgEnv && /from\s*['"]dotenv|require\(\s*['"]dotenv|dotenv\.config|dotenv\/config/.test(ln)) out.push({ line: i + 1, message: 'dotenv is loaded only in config/env.js (BE-04)' });
      run = CODEY.test(ln) ? run + 1 : 0;
      if (run === 3) out.push({ line: i - 1, message: 'commented-out code: delete it (git keeps history)' });
    });
    return out;
  },
};

export default [
  controllerCheck,
  rx('no-res-json-in-controller', ['BE-40'], 'error', [`${BE}**/*.controller.js`], [[/\bres\s*\.\s*(?:json|send|status|sendStatus|end)\s*\(/, 'controllers return ApiResponse; never call res.json/send/status']], { skip: (f) => isTest(f.rel) }),
  rx('no-process-env-outside-config', ['BE-04', 'BE-26'], 'error', SRC, [[/\bprocess\s*\.\s*env\b/, 'read configuration only through config/env.js']], { skip: (f) => isTest(f.rel) || f.rel === cfgEnv }),
  rx('no-console-backend', ['BE-80'], 'error', SRC, [[/\bconsole\s*\.\s*\w+/, 'use the pino logger, not console.*']], { skip: (f) => isTest(f.rel) }),
  serviceCheck,
  routeCheck,
  rx('no-cors-star', ['BE-11', 'AUTH-19'], 'error', [...SRC, 'backend/.env*'], [
    [/origin\s*:\s*['"]\*['"]/, 'wildcard CORS origin'],
    [/CORS_\w*ORIGINS?\s*=.*\*/, 'wildcard in CORS env value'],
    [/cors\(\s*\)/, 'cors() with no options allows every origin'],
    [/Access-Control-Allow-Origin['"]\s*,\s*['"]\*/, 'wildcard Access-Control-Allow-Origin header'],
    [/origin\s*:\s*true\b/, 'reflected CORS origin: use the exact allowlist'],
  ], { skip: (f) => isTest(f.rel) }),
  secretCheck,
  leftovers,
];
