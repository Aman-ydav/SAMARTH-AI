// FRONTEND group, part 2 (rulebook 02): Redux slices/thunks, store, routes, import direction and cycles.
// Reading notes:
//  - slice-initial-state accepts `...asyncInitial`; features/preferences/slice/uiSlice.js is exempt (the ui slice is not async data).
//  - import-direction lets lib/components/features import `@/app/hooks` (the typed hooks are the one sanctioned upward import, FE-10).
//  - Dynamic import() counts for direction but not for cycles (lazy edges cannot deadlock module evaluation).
import path from 'node:path';
import { rx, isTest, calls, lineOf, balanced, FE } from './util.mjs';

const SLICES = `${FE}features/*/slice/*.js`;
const sliceFile = (f) => /Slice\.js$/.test(f.base);
const NAME_OK = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;

const rejectCheck = {
  id: 'thunk-uses-rejectWithValue', ruleIds: ['FE-31'], severity: 'error', globs: [SLICES],
  desc: 'createAsyncThunk must return rejectWithValue(toApiError(...)) and never throw',
  run(f) {
    const out = [];
    for (const c of calls(f.code, /\bcreateAsyncThunk\s*\(/)) {
      if (!/rejectWithValue\s*\(\s*toApiError\s*\(/.test(c.body)) out.push({ line: c.line, message: 'thunk lacks `return rejectWithValue(toApiError(error))`' });
      if (/\bthrow\b/.test(c.body)) out.push({ line: c.line, message: 'thunk throws: reject with rejectWithValue instead' });
    }
    return out;
  },
};

const namingCheck = {
  id: 'slice-naming', ruleIds: ['FE-28', 'FE-09'], severity: 'error', globs: [SLICES, `${FE}app/rootReducer.js`],
  desc: 'slice file/name/root key agree; thunk type is <slice>/<thunk>; thunk names are verbNoun',
  run(f) {
    const out = [];
    if (f.base === 'rootReducer.js') {
      for (const m of f.code.matchAll(/(\w+)\s*:\s*(\w+?)(?:Slice)?(?:\.reducer|Reducer)\b/g)) {
        if (m[1] !== m[2]) out.push({ line: lineOf(f.code, m.index), message: `root key "${m[1]}" must equal slice name "${m[2]}"` });
      }
      return out;
    }
    const stem = f.base.replace(/(?:Slice|Thunks)\.js$/, '');
    const cs = calls(f.code, /\bcreateSlice\s*\(/)[0];
    let name = stem;
    if (cs) {
      const m = /\bname\s*:\s*(['"`])(\w+)\1/.exec(cs.body);
      if (!m) out.push({ line: cs.line, message: 'createSlice has no literal name' });
      else {
        name = m[2];
        if (m[2] !== stem) out.push({ line: cs.line, message: `slice name "${m[2]}" must match file name "${f.base}" (${stem})` });
      }
    }
    for (const m of f.code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*createAsyncThunk\s*\(\s*(['"`])([^'"`]*)\2/g)) {
      const line = lineOf(f.code, m.index);
      if (m[3] !== `${name}/${m[1]}`) out.push({ line, message: `thunk type "${m[3]}" must be "${name}/${m[1]}"` });
      if (!NAME_OK.test(m[1])) out.push({ line, message: `thunk "${m[1]}" must be verbNoun (e.g. fetchCurrentUser)` });
    }
    return out;
  },
};

const initialCheck = {
  id: 'slice-initial-state', ruleIds: ['FE-18'], severity: 'error', globs: [`${FE}features/*/slice/*Slice.js`],
  desc: 'initial state needs status, error, lastFetchedAt (or ...asyncInitial)',
  run(f) {
    if (f.base === 'uiSlice.js') return [];
    const m = /\binitialState\s*[:=]\s*/.exec(f.code);
    if (!m) return /createSlice/.test(f.code) ? [{ line: 1, message: 'no initialState found' }] : [];
    const at = m.index + m[0].length;
    if (f.code[at] !== '{') return [];
    const body = f.code.slice(at, balanced(f.code, at) + 1);
    if (/asyncInitial/.test(body)) return [];
    const missing = ['status', 'error', 'lastFetchedAt'].filter((k) => !new RegExp(`\\b${k}\\b`).test(body));
    return missing.length ? [{ line: lineOf(f.code, m.index), message: `initialState missing ${missing.join(', ')} (spread asyncInitial from lib/asyncState.js)` }] : [];
  },
};

const BANNED_IN_REDUCER = /\b(?:Date\.now|new Date|Math\.random|crypto\.\w+|nanoid|uuid|performance\.now)\b|\b(?:localStorage|sessionStorage|fetch|axios|toast|navigate|dispatch|window|document)\s*[.(]/;
const indent = (l) => l.length - l.trimStart().length;
const impureCheck = {
  id: 'no-impure-reducer', ruleIds: ['FE-19'], severity: 'error', globs: [`${FE}features/*/slice/*Slice.js`],
  desc: 'time/random/storage/network/toast/navigate/dispatch in reducers; object-notation extraReducers',
  run(f) {
    const out = [];
    for (const c of calls(f.code, /\bcreateSlice\s*\(/)) {
      const lines = c.body.split('\n');
      let skipIndent = -1;
      lines.forEach((ln, i) => {
        const abs = c.line + i;
        if (skipIndent >= 0 && ln.trim() && indent(ln) > skipIndent) return;
        skipIndent = -1;
        if (/\bprepare\b/.test(ln)) { skipIndent = indent(ln); return; }
        if (/\bextraReducers\s*:\s*\{/.test(ln)) out.push({ line: abs, message: 'object-notation extraReducers: use the builder callback' });
        const m = BANNED_IN_REDUCER.exec(ln);
        if (m) out.push({ line: abs, message: `impure call in reducer (${m[0].trim()}): move it to the thunk or an action prepare()` });
      });
    }
    return out;
  },
};

const storeCheck = {
  id: 'no-disable-redux-checks', ruleIds: ['FE-11', 'FE-14'], severity: 'error', globs: [`${FE}app/store.js`],
  desc: 'serializable/immutable checks stay on; devTools only in development',
  run(f) {
    const out = [];
    f.code.split('\n').forEach((ln, i) => {
      if (/serializableCheck\s*:\s*false|immutableCheck\s*:\s*false/.test(ln)) out.push({ line: i + 1, message: 'do not disable the Redux safety checks' });
      if (/devTools\s*:\s*true/.test(ln)) out.push({ line: i + 1, message: 'devTools: true enables devtools in production' });
    });
    if (/configureStore/.test(f.code)) {
      const m = /devTools\s*:\s*([^,\n}]+)/.exec(f.code);
      if (!m) out.push({ line: 1, message: 'configureStore has no explicit dev-only devTools option' });
      else if (m[1].trim() !== 'false' && !/isDev|DEV|isDevelopment|NODE_ENV|MODE|env\b/.test(m[1])) out.push({ line: lineOf(f.code, m.index), message: 'devTools must depend on the dev environment (env.isDev)' });
    }
    return out;
  },
};

const hooksCheck = {
  id: 'use-app-hooks', ruleIds: ['FE-10'], severity: 'error', globs: [`${FE}**/*.{js,jsx}`],
  desc: 'useDispatch/useSelector/useStore only inside app/hooks.js',
  run(f) {
    if (isTest(f.rel) || f.rel === `${FE}app/hooks.js`) return [];
    const out = [];
    for (const m of f.code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react-redux['"]/g)) {
      const bad = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter((n) => /^use(?:Dispatch|Selector|Store)$/.test(n));
      if (bad.length) out.push({ line: lineOf(f.code, m.index), message: `${bad.join(', ')}: use useAppDispatch/useAppSelector/useAppStore from @/app/hooks` });
    }
    return out;
  },
};

const tokenState = {
  id: 'no-token-in-state', ruleIds: ['FE-21', 'FE-49', 'AUTH-01'], severity: 'error', globs: [`${FE}features/*/slice/**`, `${FE}lib/**`],
  desc: 'password/csrf/otp/credential fields in slices; Authorization/Bearer in lib',
  run(f) {
    if (isTest(f.rel)) return [];
    const isSlice = sliceFile(f);
    const re = isSlice
      ? /\b(?:password|newPassword|currentPassword|csrf\w*|otp|credential|idToken)\s*:|state\.(?:\w+\.)*(?:password\w*|csrf\w*|otp|credential)\s*=(?!=)/
      : /['"]?Authorization['"]?\s*[:=]|\bBearer\s/;
    return rx('x', [], 'error', [], [[re, isSlice ? 'secret field in Redux state (tokens/passwords/CSRF live in cookies and form state only)' : 'Authorization/Bearer header: auth is cookie-based']]).run(f);
  },
};

const routesLazy = rx('route-pages-lazy', ['FE-66', 'FS-43'], 'error', [`${FE}app/routes.jsx`], [
  [/^\s*import\b[^'"]*from\s*['"][^'"]*(?:\/pages\/|Page(?:\.jsx)?['"])/, 'static page import in the route table: use the route `lazy` property'],
]);

// ---- import graph (direction + cycles) ----
function graph(project) {
  if (project._graph) return project._graph;
  const edges = new Map();
  const resolve = (from, spec) => {
    let base;
    if (spec.startsWith('@/')) base = `${FE}${spec.slice(2)}`;
    else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    else return null;
    return [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`, `${base}/index.jsx`].find((c) => project.has(c)) ?? null;
  };
  for (const f of project.all([`${FE}**/*.{js,jsx}`])) {
    if (f.code == null) continue;
    const list = [];
    for (const m of f.code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g)) {
      const to = resolve(f.rel, m[2]);
      if (to) list.push({ to, line: lineOf(f.code, m.index), dynamic: /import\s*\(/.test(m[0]) });
    }
    edges.set(f.rel, list);
  }
  return (project._graph = edges);
}
const area = (rel) => rel.slice(FE.length).split('/');
const dirCheck = {
  id: 'import-direction', ruleIds: ['FE-03', 'FS-43'], severity: 'error', scope: 'project', globs: [],
  desc: 'app -> features -> components/hooks/lib; no cross-feature deep imports',
  run(project) {
    const out = [];
    for (const [from, list] of graph(project)) {
      if (isTest(from)) continue;
      const [top, feat] = area(from);
      for (const { to, line } of list) {
        if (to === `${FE}app/hooks.js`) continue;
        const [t2, f2, sub] = area(to);
        const bad =
          ((top === 'lib' || (top === 'components' && ['ui', 'common'].includes(feat)) || top === 'hooks') && (t2 === 'features' || t2 === 'app') && `${top}/ must not import ${t2}/`) ||
          (top === 'features' && t2 === 'app' && 'features must not import app/ (only @/app/hooks)') ||
          (top === 'components' && t2 === 'app' && 'components must not import app/') ||
          (top === 'features' && t2 === 'features' && f2 !== feat && ['components', 'pages', 'api'].includes(sub) && `deep import of another feature's ${sub}: use @/features/${f2} (index.js)`);
        if (bad) out.push({ file: from, line, message: bad });
      }
    }
    return out;
  },
};

const cycleCheck = {
  id: 'no-import-cycle', ruleIds: ['FE-03', 'FS-44'], severity: 'error', scope: 'project', globs: [],
  desc: 'static import cycles inside frontend/src',
  run(project) {
    const g = graph(project);
    const out = [];
    const state = new Map();
    const stack = [];
    const reported = new Set();
    const visit = (n) => {
      state.set(n, 1);
      stack.push(n);
      for (const e of g.get(n) ?? []) {
        if (e.dynamic || !g.has(e.to)) continue;
        if (state.get(e.to) === 1) {
          const cyc = stack.slice(stack.indexOf(e.to));
          const key = [...cyc].sort().join('|');
          if (!reported.has(key)) {
            reported.add(key);
            const first = [...cyc].sort()[0];
            out.push({ file: first, line: 1, message: `import cycle: ${[...cyc, e.to].map((c) => path.posix.basename(c)).join(' -> ')}` });
          }
        } else if (!state.has(e.to)) visit(e.to);
      }
      stack.pop();
      state.set(n, 2);
    };
    for (const n of g.keys()) if (!state.has(n)) visit(n);
    return out;
  },
};

const storeOnce = rx('single-configure-store', ['FE-08'], 'error', [`${FE}**/*.{js,jsx}`], [[/\bconfigureStore\b/, 'configureStore only in app/store.js (use setupStore in tests)']], { skip: (f) => isTest(f.rel) || f.rel === `${FE}app/store.js` });

export default [rejectCheck, namingCheck, initialCheck, impureCheck, storeOnce, storeCheck, hooksCheck, tokenState, routesLazy, dirCheck, cycleCheck];
