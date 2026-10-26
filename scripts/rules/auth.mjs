// AUTH group (rulebook 04). Reading notes:
//  - no-localstorage-token is defined once, in frontend.mjs (rule ids FE-106 + AUTH-01).
//  - no-token-in-redux covers token/accessToken/refreshToken/jwt keys; password/csrf/otp keys are reported by no-token-in-state (FE-21).
//  - no-jwt-in-url also flags `?token=` for email links: AUTH-31 puts one-time tokens in the URL fragment (#token=).
//  - cookies-httponly: cookies.js must contain `httpOnly: true`; a res.cookie(...) call naming access/refresh must not say `httpOnly: false`.
//  - no-open-redirect (warn) is heuristic: res.redirect with request-derived input, or reading returnTo/next without safeReturnPath.
import { rx, isTest, calls, lineOf, BE, FE } from './util.mjs';

const BE_SRC = [`${BE}**/*.js`];
const COOKIES = `${BE}utils/cookies.js`;
const notTest = (f) => isTest(f.rel);

const cookies = {
  id: 'cookies-httponly', ruleIds: ['AUTH-03', 'BE-28'], severity: 'error', globs: BE_SRC,
  desc: 'cookies only via utils/cookies.js; access/refresh cookies httpOnly',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    const c = f.code;
    if (f.rel !== COOKIES) {
      for (const m of c.matchAll(/\bres\s*\.\s*(?:cookie|clearCookie)\s*\(|set-cookie/gi)) out.push({ line: lineOf(c, m.index), message: 'set/clear cookies only through utils/cookies.js' });
      return out;
    }
    if (!/httpOnly\s*:\s*true/.test(c)) out.push({ line: 1, message: 'cookies.js never sets httpOnly: true (sai_access and sai_refresh must be HttpOnly)' });
    for (const call of calls(c, /\bres\s*\.\s*cookie\s*\(/)) {
      if (/httpOnly\s*:\s*false/.test(call.body) && /access|refresh/i.test(call.body)) out.push({ line: call.line, message: 'access/refresh cookies must be httpOnly' });
    }
    return out;
  },
};

const SENSITIVE = /\b(?:password|passwd|newPassword|currentPassword|token|accessToken|refreshToken|credential|authorization|cookies?|set-cookie|secret|otp|apiKey)\b|req\.(?:body|headers)\b/i;
const logs = {
  id: 'no-password-in-logs', ruleIds: ['AUTH-24', 'BE-81'], severity: 'error', globs: BE_SRC,
  desc: 'logger/console calls with password, token, credential, cookie fields; logger without redact config',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    for (const c of calls(f.nostr, /\b(?:logger|log|req\.log|this\.logger)\s*\.\s*(?:info|warn|error|debug|trace|fatal)\s*\(|\bconsole\s*\.\s*\w+\s*\(/)) {
      const m = SENSITIVE.exec(c.body);
      if (m) out.push({ line: c.line, message: `log call includes "${m[0]}": never log credentials, tokens, cookies or request bodies` });
    }
    if (f.rel === `${BE}utils/logger.js`) {
      if (!/redact/.test(f.code)) out.push({ line: 1, message: 'logger has no redact configuration (AUTH-24)' });
      else for (const k of ['password', 'token', 'authorization', 'cookie']) if (!new RegExp(k, 'i').test(f.code)) out.push({ line: 1, severity: 'warn', message: `logger redact list does not mention "${k}"` });
    }
    return out;
  },
};

const AUTH_PATH = /login|register|forgot|reset|refresh|resend|google|verify/i;
const rateLimited = {
  id: 'auth-routes-rate-limited', ruleIds: ['AUTH-40', 'BE-61'], severity: 'error', globs: [`${BE}modules/auth/*.routes.js`],
  desc: 'login/register/forgot/reset/refresh/resend/google routes need a rate limiter',
  run(f) {
    if (notTest(f)) return [];
    const c = f.code;
    const globalLimit = /\b\w+\.use\s*\(\s*\w*(?:rate[-_]?limit|limiter)\w*/i.exec(c)?.index ?? Infinity;
    const out = [];
    for (const r of calls(c, /\b\w*[rR]outer\w*\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(/)) {
      const p = /\(\s*['"`]([^'"`]*)/.exec(r.body)?.[1] ?? '';
      if (AUTH_PATH.test(p) && !/rate[-_]?limit|limiter/i.test(r.body) && r.idx < globalLimit) out.push({ line: r.line, message: `auth route "${p}" has no rate limiter middleware` });
    }
    return out;
  },
};

const jwtPinned = {
  id: 'jwt-algorithms-pinned', ruleIds: ['AUTH-04'], severity: 'error', globs: BE_SRC,
  desc: 'jwt.verify without algorithms, "none", ignoreExpiration',
  run(f) {
    if (notTest(f) || !/jsonwebtoken/.test(f.code)) return [];
    const out = [];
    const bare = /import\s*\{[^}]*\bverify\b/.test(f.code);
    for (const c of calls(f.code, /(?<![\w$.])(?:(?:jwt|jsonwebtoken)\.)?verify\s*\(/)) {
      if (!/jwt\.|jsonwebtoken\./.test(c.m[0]) && !bare) continue;
      if (!/algorithms\s*:/.test(c.body)) out.push({ line: c.line, message: 'jwt.verify must pin { algorithms: ["HS256"] }' });
    }
    f.code.split('\n').forEach((ln, i) => {
      if (/algorithms?\s*:\s*\[?[^\]\n]*['"]none['"]/i.test(ln)) out.push({ line: i + 1, message: 'algorithm "none" is forbidden' });
      if (/ignoreExpiration\s*:\s*true/.test(ln)) out.push({ line: i + 1, message: 'ignoreExpiration: true disables token expiry' });
    });
    return out;
  },
};

const redirect = {
  id: 'no-open-redirect', ruleIds: ['AUTH-57', 'FE-56'], severity: 'warn', globs: [...BE_SRC, `${FE}**/*.{js,jsx}`],
  desc: 'redirects/navigation from unvalidated returnTo/next input',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    for (const c of calls(f.code, /\bres\s*\.\s*redirect\s*\(/)) {
      if (/req\.|returnTo|\bnext\b|redirect|\burl\b/i.test(c.body.slice(1)) && !/safeReturnPath|FRONTEND_URL|env\./.test(c.body)) out.push({ line: c.line, message: 'res.redirect with request-derived target: validate with safeReturnPath or use FRONTEND_URL' });
    }
    f.code.split('\n').forEach((ln, i) => {
      if (/searchParams\.get\(\s*['"](?:returnTo|next|redirect|redirectTo|continue)['"]\s*\)/.test(ln) && !/safeReturnPath/.test(ln)) out.push({ line: i + 1, message: 'returnTo/next read from the URL must pass safeReturnPath()' });
    });
    return out;
  },
};

export default [
  rx('no-token-in-redux', ['AUTH-01', 'FE-21'], 'error', [`${FE}**/*Slice.js`], [
    [/\b(?:token|accessToken|refreshToken|jwt)\s*:|state\.(?:\w+\.)*(?:token|accessToken|refreshToken|jwt)\s*=(?!=)/, 'token held in Redux state: tokens live only in HttpOnly cookies'],
  ], { skip: notTest }),
  cookies,
  logs,
  rateLimited,
  rx('no-jwt-in-url', ['AUTH-01', 'AUTH-31', 'FE-49'], 'error', [`${FE}**/*.{js,jsx}`, ...BE_SRC], [
    [/[?&](?:access_?token|refresh_?token|id_?token|jwt|sid|session(?:_?id)?|token)=/i, 'token in a URL query string: use cookies, or the #fragment for one-time email links'],
    [/searchParams\.(?:get|set|append)\(\s*['"](?:access_?token|refresh_?token|jwt|id_?token)['"]/, 'session token read/written through URL params'],
    [/\bio\s*\(.*(?:query|auth)\s*:\s*\{[^}]*token/i, 'socket handshake must use the cookie, not a token option'],
  ], { skip: notTest }),
  rx('no-host-header-links', ['AUTH-31'], 'error', BE_SRC, [
    [/req\.(?:hostname|headers\.host|headers\[\s*['"](?:host|x-forwarded-host)['"]\s*\]|get\(\s*['"](?:host|x-forwarded-host)['"]\s*\))|x-forwarded-host/i, 'build links from FRONTEND_URL, never from the Host header'],
  ], { skip: notTest }),
  rx('no-math-random-secrets', ['AUTH-05'], 'error', [`${BE}{modules/auth,utils,services}/**/*.js`], [[/\bMath\s*\.\s*random\b/, 'use crypto.randomBytes/randomInt for anything secret']], { skip: notTest }),
  jwtPinned,
  redirect,
];
