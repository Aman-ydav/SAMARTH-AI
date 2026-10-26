// Tests for scripts/check-rules.mjs. Fixtures are written to a temp dir per case (never committed).
// Run: node --test "scripts/**/*-test.mjs"   (Node 22+ takes globs, not bare directories)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Project, listRepoFiles, runChecks, globToRegExp } from './check-engine.mjs';
import { CHECKS } from './rules/index.mjs';

const CLI = fileURLToPath(new URL('./check-rules.mjs', import.meta.url));

function fixture(files) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'samarth-rules-')), 'repo');
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}
const violations = (files, id) => {
  const root = fixture(files);
  return runChecks(new Project(root, listRepoFiles(root)), CHECKS, { only: [id] }).violations.filter((v) => v.check === id);
};
const lines = (n) => `${'const a = 1;\n'.repeat(n)}`;
const j = (o) => JSON.stringify(o);

// [group, id, failing files, passing files]
const CASES = [
  ['fs', 'fs-no-leftover', { 'frontend/tailwind.config.js': 'x' }, { 'frontend/package.json': '{}' }],
  ['fs', 'fs-folder-kebab', { 'frontend/src/lib/MyDir/a.js': 'x' }, { 'frontend/src/lib/apiClient.js': 'x' }],
  ['fs', 'fs-backend-file-pattern', { 'backend/src/config.js': 'x' }, { 'backend/src/config/env.js': 'x' }],
  ['fs', 'fs-test-colocation', { 'backend/src/utils/a.test.js': 'x' }, { 'backend/src/utils/a.js': 'x', 'backend/src/utils/a.test.js': 'x' }],
  ['fs', 'fs-max-lines', { 'backend/src/utils/big.js': lines(320) }, { 'backend/src/utils/small.js': lines(10) }],
  ['fs', 'root-package-scripts', { 'package.json': j({ scripts: { deploy: 'x' } }) }, { 'package.json': j({ scripts: { dev: 'x', 'rules:check': 'y' } }) }],
  ['ui', 'no-lucide-import', { 'frontend/src/lib/a.js': "import { X } from 'lucide-react';" }, { 'frontend/src/lib/a.js': "import { CloseIcon } from '@/components/icons';" }],
  ['ui', 'no-gradient', { 'frontend/src/lib/a.jsx': 'const c = "bg-gradient-to-r from-primary to-accent";' }, { 'frontend/src/lib/a.jsx': 'const c = "bg-primary to-do";' }],
  ['ui', 'no-color-literal-outside-index-css', { 'frontend/src/lib/a.js': "const c = '#D97757';" }, { 'frontend/src/lib/a.js': "const c = '/#faq'; const d = '#root';", 'frontend/src/index.css': ':root { --a: #D97757; }' }],
  ['ui', 'no-tailwind-default-palette', { 'frontend/src/lib/a.jsx': 'const c = "text-white bg-blue-500";' }, { 'frontend/src/lib/a.jsx': 'const c = "text-foreground bg-primary";' }],
  ['ui', 'icons-filled-only', { 'frontend/src/components/icons/index.js': "import { RiHomeLine as HomeIcon } from 'react-icons/ri';" }, { 'frontend/src/components/icons/index.js': "import { RiHomeFill as HomeIcon } from 'react-icons/ri';" }],
  ['ui', 'icons-from-registry-only', { 'frontend/src/lib/a.js': "import { RiHomeFill } from 'react-icons/ri';" }, { 'frontend/src/lib/a.js': "import { HomeIcon } from '@/components/icons';" }],
  ['frontend', 'no-fetch', { 'frontend/src/lib/a.js': 'const r = await fetch("/x");' }, { 'frontend/src/lib/a.js': 'const r = await apiClient.get("/x");' }],
  ['frontend', 'no-localstorage-token', { 'frontend/src/lib/a.js': "localStorage.setItem('token', t);" }, { 'frontend/src/lib/storage.js': "const K = 'sai-theme'; localStorage.getItem(K);" }],
  ['frontend', 'axios-only-in-api-files', { 'frontend/src/lib/a.js': "import axios from 'axios';" }, { 'frontend/src/features/auth/api/authApi.js': "import axios from 'axios';" }],
  ['frontend', 'no-console', { 'frontend/src/lib/a.js': 'console.log(1);' }, { 'frontend/src/lib/logger.js': 'console.log(1);' }],
  ['frontend', 'external-link-rel', { 'frontend/src/lib/A.jsx': '<a href="x" target="_blank">x</a>' }, { 'frontend/src/lib/A.jsx': '<a href="x" target="_blank" rel="noopener noreferrer">x</a>' }],
  ['frontend', 'thunk-uses-rejectWithValue', { 'frontend/src/features/thing/slice/thingSlice.js': "export const fetchThing = createAsyncThunk('thing/fetchThing', async () => { return 1; });" }, { 'frontend/src/features/thing/slice/thingSlice.js': "export const fetchThing = createAsyncThunk('thing/fetchThing', async (_, { rejectWithValue }) => { try { return 1; } catch (e) { return rejectWithValue(toApiError(e)); } });" }],
  ['frontend', 'slice-naming', { 'frontend/src/features/thing/slice/thingSlice.js': "const x = createAsyncThunk('wrong/fetchThing', f); createSlice({ name: 'thing' });" }, { 'frontend/src/features/thing/slice/thingSlice.js': "const fetchThing = createAsyncThunk('thing/fetchThing', f); createSlice({ name: 'thing' });" }],
  ['frontend', 'slice-initial-state', { 'frontend/src/features/thing/slice/thingSlice.js': 'createSlice({ name: "thing", initialState: { items: [] } });' }, { 'frontend/src/features/thing/slice/thingSlice.js': 'createSlice({ name: "thing", initialState: { ...asyncInitial } });' }],
  ['frontend', 'no-impure-reducer', { 'frontend/src/features/thing/slice/thingSlice.js': 'createSlice({ name: "thing", reducers: {\n stamp(state) {\n state.at = Date.now();\n },\n } });' }, { 'frontend/src/features/thing/slice/thingSlice.js': 'createSlice({ name: "thing", reducers: {\n  add: {\n    prepare(x) {\n      return { payload: x, meta: { at: Date.now() } };\n    },\n    reducer(state) {},\n  },\n} });' }],
  ['frontend', 'i18n-key-parity', { 'frontend/src/i18n/locales/en/common.json': j({ a: 'x', b: 'y' }), 'frontend/src/i18n/locales/hi/common.json': j({ a: 'x' }) }, { 'frontend/src/i18n/locales/en/common.json': j({ a: 'x' }), 'frontend/src/i18n/locales/hi/common.json': j({ a: 'x' }) }],
  ['frontend', 'no-import-cycle', { 'frontend/src/lib/x.js': "import './y.js';", 'frontend/src/lib/y.js': "import './x.js';" }, { 'frontend/src/lib/x.js': "import './y.js';", 'frontend/src/lib/y.js': 'export const y = 1;' }],
  ['frontend', 'import-direction', { 'frontend/src/features/a/components/A.jsx': "import { B } from '@/features/b/components/B';", 'frontend/src/features/b/components/B.jsx': 'export const B = 1;' }, { 'frontend/src/features/a/components/A.jsx': "import { B } from '@/features/b';", 'frontend/src/features/b/index.js': 'export const B = 1;' }],
  ['frontend', 'forbidden-dependencies', { 'frontend/package.json': j({ dependencies: { zustand: '^5.0.0' } }) }, { 'frontend/package.json': j({ dependencies: { react: '^19.0.0' } }) }],
  ['backend', 'no-console-backend', { 'backend/src/utils/a.js': 'console.log(1);' }, { 'backend/src/utils/a.js': 'logger.info("x");' }],
  ['backend', 'no-process-env-outside-config', { 'backend/src/utils/a.js': 'const p = process.env.PORT;' }, { 'backend/src/config/env.js': 'export const p = process.env.PORT;' }],
  ['backend', 'controller-uses-asyncHandler', { 'backend/src/modules/a/a.controller.js': 'export const list = async (req, res) => {};' }, { 'backend/src/modules/a/a.controller.js': 'export const list = asyncHandler(async (req, res) => {});' }],
  ['backend', 'no-res-json-in-controller', { 'backend/src/modules/a/a.controller.js': 'export const l = asyncHandler(async (req, res) => { res.json({}); });' }, { 'backend/src/modules/a/a.controller.js': 'export const l = asyncHandler(async (req, res) => ok(res, {}));' }],
  ['backend', 'routes-have-validate-and-auth', { 'backend/src/modules/a/a.routes.js': "router.get('/me', getMe);" }, { 'backend/src/modules/a/a.routes.js': "router.get('/me', authenticate, validate(s), getMe);\n// public\nrouter.get('/open', getOpen);" }],
  ['backend', 'no-secret-literals', { 'backend/.env.sample': 'ACCESS_TOKEN_SECRET=Xk39dPq82LmZ0aVb7TnYc1RwEh5UoJ4s\n' }, { 'backend/.env.sample': 'ACCESS_TOKEN_SECRET=change-me\nREFRESH_TOKEN_SECRET=\n' }],
  ['backend', 'no-cors-star', { 'backend/src/app.js': "app.use(cors({ origin: '*' }));" }, { 'backend/src/app.js': 'app.use(cors({ origin: allowed, credentials: true }));' }],
  ['backend', 'no-req-res-in-service', { 'backend/src/modules/a/a.service.js': 'export const f = (req, res) => req.body;' }, { 'backend/src/modules/a/a.service.js': 'export const f = (input) => input;' }],
  ['auth', 'cookies-httponly', { 'backend/src/modules/a/a.controller.js': "res.cookie('x', 'y');" }, { 'backend/src/utils/cookies.js': "res.cookie('sai_access', t, { httpOnly: true });" }],
  ['auth', 'jwt-algorithms-pinned', { 'backend/src/utils/a.js': "import jwt from 'jsonwebtoken';\njwt.verify(t, s);" }, { 'backend/src/utils/a.js': "import jwt from 'jsonwebtoken';\njwt.verify(t, s, { algorithms: ['HS256'] });" }],
  ['auth', 'no-math-random-secrets', { 'backend/src/utils/a.js': 'const t = Math.random().toString(36);' }, { 'backend/src/utils/a.js': 'const t = crypto.randomBytes(32);' }],
  ['auth', 'no-jwt-in-url', { 'frontend/src/lib/a.js': 'const u = `/x?token=${t}`;' }, { 'frontend/src/lib/a.js': 'const u = `/x#token=${t}`;' }],
  ['auth', 'auth-routes-rate-limited', { 'backend/src/modules/auth/auth.routes.js': "router.post('/login', validate(s), login); // public" }, { 'backend/src/modules/auth/auth.routes.js': "router.post('/login', loginLimiter, validate(s), login); // public" }],
  ['db', 'schema-has-timestamps', { 'backend/src/modules/a/a.model.js': 'new Schema({ a: { type: Number } });' }, { 'backend/src/modules/a/a.model.js': 'new Schema({ a: { type: Number } }, { timestamps: true });' }],
  ['db', 'schema-string-trim-lowercase', { 'backend/src/modules/a/a.model.js': 'new Schema({ name: { type: String } });' }, { 'backend/src/modules/a/a.model.js': 'new Schema({ email: { type: String, trim: true, maxlength: 254, lowercase: true } });' }],
  ['db', 'no-unbounded-find', { 'backend/src/modules/a/a.service.js': 'const r = await User.find({ orgId }).lean();' }, { 'backend/src/modules/a/a.service.js': 'const r = await User.find({ orgId }).limit(20).lean(); const x = items.find((i) => i.id === 1);' }],
  ['db', 'aggregate-has-maxTimeMS', { 'backend/src/modules/a/a.service.js': 'await User.aggregate(p);' }, { 'backend/src/db/runAggregate.js': 'export const runAggregate = (m, p) => m.aggregate(p).option({ maxTimeMS: 5000 });' }],
  ['db', 'aggregate-match-first', { 'backend/src/modules/a/a.pipelines.js': "export const b = (p) => [{ $group: { _id: '$a' } }];" }, { 'backend/src/modules/a/a.pipelines.js': 'export const b = (p) => [{ $match: { orgId: p.orgId } }, { $limit: 5 }];' }],
  ['db', 'password-select-false', { 'backend/src/modules/a/a.model.js': 'new Schema({ passwordHash: { type: String } });' }, { 'backend/src/modules/a/a.model.js': 'new Schema({ passwordHash: { type: String, select: false } });' }],
  ['anim', 'no-framer-motion-legacy-import', { 'frontend/src/features/marketing/a.js': "import { motion } from 'framer-motion';" }, { 'frontend/src/features/marketing/a.js': "import { motion } from 'motion/react';" }],
  ['anim', 'no-other-animation-libs', { 'frontend/package.json': j({ dependencies: { gsap: '^3.0.0' } }) }, { 'frontend/package.json': j({ dependencies: { motion: '^14.0.0', lenis: '^1.0.0' } }) }],
  ['anim', 'motion-reduced-motion-guard', { 'frontend/src/components/motion/Reveal.jsx': "import { motion } from 'motion/react';" }, { 'frontend/src/components/motion/Reveal.jsx': "import { motion, useReducedMotion } from 'motion/react';", 'frontend/src/components/motion/Reveal.test.jsx': 'x' }],
  ['anim', 'no-animated-layout-props', { 'frontend/src/features/marketing/components/A.jsx': '<motion.div animate={{ width: 200 }} />' }, { 'frontend/src/features/marketing/components/A.jsx': '<motion.div animate={{ opacity: 1, y: 0 }} />' }],
  ['anim', 'no-decorative-loop', { 'frontend/src/lib/a.jsx': 'const c = "animate-bounce";' }, { 'frontend/src/lib/a.jsx': 'const c = "motion-safe:animate-spin";' }],
  ['anim', 'font-package-allowlist', { 'frontend/package.json': j({ dependencies: { '@fontsource/inter': '^5.0.0' } }) }, { 'frontend/package.json': j({ dependencies: { '@fontsource-variable/fraunces': '^5.3.0' } }) }],
  ['anim', 'motion-import-scope', { 'frontend/src/components/common/A.jsx': "import { motion } from 'motion/react';" }, { 'frontend/src/components/motion/A.jsx': "import { motion } from 'motion/react';" }],
  ['test', 'no-only-in-tests', { 'backend/src/utils/a.test.js': "it.only('x', () => {});" }, { 'backend/src/utils/a.test.js': "it('x', () => {});" }],
  ['test', 'backend-has-test-for-service', { 'backend/src/modules/a/a.service.js': 'x' }, { 'backend/src/modules/a/a.service.js': 'x', 'backend/src/modules/a/a.service.test.js': 'x' }],
  ['test', 'controller-has-supertest', { 'backend/src/modules/a/a.routes.js': 'x' }, { 'backend/src/modules/a/a.routes.js': 'x', 'backend/src/modules/a/a.routes.test.js': "import request from 'supertest';" }],
  ['test', 'coverage-threshold', { 'backend/vitest.config.js': 'export default { test: { coverage: { thresholds: { lines: 50, branches: 40 } } } };' }, { 'backend/vitest.config.js': 'export default { test: { coverage: { thresholds: { lines: 80, branches: 75 } } } };' }],
  ['test', 'route-in-postman', { 'backend/src/modules/users/users.routes.js': "router.get('/me', authenticate, validate(s), me);", 'backend/postman/samarthAi.postman_collection.json': j({ item: [] }) }, { 'backend/src/modules/users/users.routes.js': "router.get('/me', authenticate, validate(s), me);", 'backend/postman/samarthAi.postman_collection.json': j({ item: [{ name: 'GET /users/me - ok', request: { method: 'GET', url: { raw: '{{baseUrl}}/{{apiPrefix}}/users/me' } } }] }) }],
  ['test', 'postman-no-secrets', { 'backend/postman/local.postman_environment.json': j({ values: [{ key: 'adminPassword', value: 'Sup3rSecret!x' }] }) }, { 'backend/postman/local.postman_environment.json': j({ values: [{ key: 'baseUrl', value: 'http://localhost:8000' }] }) }],
  ['media', 'img-has-alt', { 'frontend/src/lib/A.jsx': '<img src="a.svg" />' }, { 'frontend/src/lib/A.jsx': '<img src="a.svg" alt={t("x")} />' }],
  ['media', 'no-hardcoded-cloudinary-url', { 'frontend/src/lib/a.js': "const u = 'https://res.cloudinary.com/x/image/upload/a.jpg';" }, { 'frontend/src/components/media/CloudinaryImage.jsx': 'const b = `https://res.cloudinary.com/${n}`;' }],
  ['media', 'cloudinary-only-in-integration', { 'backend/src/utils/a.js': "import { v2 } from 'cloudinary';" }, { 'backend/src/integrations/cloudinary/cloudinary.adapter.js': "import { v2 } from 'cloudinary';" }],
  ['media', 'no-large-binary-in-repo', { 'frontend/src/assets/big.png': Buffer.alloc(300 * 1024) }, { 'frontend/src/assets/logo-mark.svg': '<svg/>' }],
  ['edge', 'no-swallowed-catch', { 'backend/src/utils/a.js': 'try { a(); } catch (e) {}' }, { 'backend/src/utils/a.js': 'try { a(); } catch (e) { throw e; }' }],
];

for (const [group, id, bad, good] of CASES) {
  test(`${group}/${id}: fails on a violation, passes on clean code`, () => {
    assert.ok(violations(bad, id).length > 0, `${id} should flag the failing fixture`);
    assert.equal(violations(good, id).length, 0, `${id} should accept the passing fixture: ${JSON.stringify(violations(good, id))}`);
  });
}

test('every automated check id in the rulebook tables is registered', () => {
  const ids = new Set(CHECKS.map((c) => c.id));
  for (const id of ['no-lucide-import', 'no-gradient', 'no-glow-shadow', 'no-color-literal-outside-index-css', 'no-tailwind-default-palette', 'no-arbitrary-color', 'no-backdrop-blur', 'icons-from-registry-only', 'icons-filled-only', 'ui-components-from-shadcn', 'no-localstorage-token', 'no-fetch', 'axios-only-in-api-files', 'single-axios-instance', 'no-rtk-query', 'no-hardcoded-api-url', 'no-console', 'no-dangerously-set-inner-html', 'no-vite-secret', 'thunk-uses-rejectWithValue', 'slice-naming', 'slice-initial-state', 'no-impure-reducer', 'single-configure-store', 'no-disable-redux-checks', 'use-app-hooks', 'no-token-in-state', 'no-document-cookie', 'no-unsafe-redirect', 'no-abort-in-effect-cleanup', 'route-pages-lazy', 'no-literal-message-in-schema', 'i18n-key-parity', 'no-hardcoded-string', 'auth-input-attrs', 'external-link-rel', 'component-max-lines', 'import-direction', 'no-import-cycle', 'bundle-budget', 'controller-uses-asyncHandler', 'no-res-json-in-controller', 'no-process-env-outside-config', 'no-console-backend', 'no-req-res-in-service', 'routes-have-validate-and-auth', 'no-cors-star', 'no-secret-literals', 'no-unrelated-leftovers', 'no-token-in-redux', 'cookies-httponly', 'no-password-in-logs', 'auth-routes-rate-limited', 'no-jwt-in-url', 'no-host-header-links', 'no-math-random-secrets', 'jwt-algorithms-pinned', 'no-open-redirect', 'schema-has-timestamps', 'schema-string-trim-lowercase', 'no-unbounded-find', 'aggregate-has-maxTimeMS', 'aggregate-match-first', 'no-raw-user-input-in-pipeline', 'password-select-false', 'ttl-on-token-collections', 'model-file-naming', 'fs-backend-file-pattern', 'fs-frontend-file-pattern', 'fs-folder-kebab', 'fs-allowed-root-dirs', 'fs-no-stray-root-files', 'fs-test-colocation', 'fs-no-barrel-outside-boundary', 'fs-max-lines', 'fs-ui-dir-shadcn-only', 'fs-no-leftover', 'no-framer-motion-legacy-import', 'no-other-animation-libs', 'motion-reduced-motion-guard', 'no-animated-layout-props', 'motion-import-scope', 'no-manual-scroll-listener', 'no-decorative-loop', 'no-gradient-or-glow-in-marketing', 'hero-required-parts', 'below-fold-sections-lazy', 'auth-motion-allowlist', 'no-char-split', 'font-package-allowlist', 'backend-has-test-for-service', 'controller-has-supertest', 'route-in-postman', 'no-only-in-tests', 'no-network-in-tests', 'coverage-threshold', 'postman-no-secrets', 'outbox-test-only', 'edge-declaration-present', 'edge-pages-exist', 'no-swallowed-catch', 'img-has-alt', 'cloudinary-only-in-integration', 'no-hardcoded-cloudinary-url', 'no-large-binary-in-repo', 'cloudinary-folder-env-prefixed']) assert.ok(ids.has(id), `missing check ${id}`);
});

test('glob matcher handles ** and braces', () => {
  assert.ok(globToRegExp('frontend/src/**/*.{js,jsx}').test('frontend/src/a.js'));
  assert.ok(globToRegExp('frontend/src/**/*.{js,jsx}').test('frontend/src/a/b/C.jsx'));
  assert.ok(!globToRegExp('frontend/src/**/*.js').test('frontend/src/a.jsx'));
  assert.ok(globToRegExp('backend/src/{modules/auth,utils}/**/*.js').test('backend/src/utils/x.js'));
});

test('project-level checks emit INFO (not errors) when prerequisites are missing', () => {
  const root = fixture({ 'package.json': j({ scripts: { dev: 'x' } }) });
  const r = runChecks(new Project(root, listRepoFiles(root)), CHECKS, { only: ['route-in-postman', 'i18n-key-parity', 'coverage-threshold', 'bundle-budget', 'edge-pages-exist'] });
  assert.equal(r.violations.length, 0);
  assert.equal(r.infos.length, 5);
});

const cli = (root, ...args) => spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8' });

test('CLI: exit 1 with grouped output on errors, exit 0 when clean, --json shape', () => {
  const bad = fixture({ 'backend/src/utils/a.js': 'console.log(1);\n' });
  const r = cli(bad, '--only', 'no-console-backend');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^error\s+no-console-backend\s+backend\/src\/utils\/a\.js:1\s+.+\(BE-80\)/m);
  assert.match(r.stdout, /1 error\(s\)/);
  const js = JSON.parse(cli(bad, '--only', 'no-console-backend', '--json').stdout);
  assert.equal(js.ok, false);
  assert.equal(js.violations[0].check, 'no-console-backend');
  const clean = fixture({ 'backend/src/utils/a.js': 'export const a = 1;\n' });
  assert.equal(cli(clean, '--only', 'no-console-backend').status, 0);
});

test('CLI: --file checks one file, ignores files outside scope; --severity error hides warnings', () => {
  const root = fixture({ 'backend/src/utils/a.js': 'console.log(1);\n', 'backend/src/utils/b.js': 'console.log(2);\n' });
  const r = cli(root, '--file', 'backend/src/utils/a.js', '--only', 'no-console-backend');
  assert.match(r.stdout, /a\.js/);
  assert.doesNotMatch(r.stdout, /b\.js/);
  assert.equal(cli(root, '--file', path.join(os.tmpdir(), 'nowhere.txt')).status, 0);
  const warn = fixture({ 'backend/src/utils/a.js': '// roomezy\n' });
  assert.match(cli(warn, '--only', 'no-unrelated-leftovers').stdout, /^warn/m);
  assert.doesNotMatch(cli(warn, '--only', 'no-unrelated-leftovers', '--severity', 'error').stdout, /^warn/m);
});

test('CLI: --pre-path denies, allows and passes through out-of-scope paths', () => {
  const root = fixture({});
  const deny = cli(root, '--pre-path', 'backend/src/Models/user.js');
  assert.equal(deny.status, 1);
  assert.match(deny.stdout, /FS-/);
  assert.equal(cli(root, '--pre-path', 'backend/src/utils/hash.js').status, 0);
  assert.equal(cli(root, '--pre-path', 'frontend/src/Weird/Thing.jsx').status, 1);
  assert.equal(cli(root, '--pre-path', path.join(os.tmpdir(), 'Some Dir', 'x.txt')).status, 0);
});

test('CLI: --list prints all checks with rule ids; --declaration validates the Edge-Case table', () => {
  const list = cli(fixture({}), '--list').stdout;
  assert.match(list, /\d{3} checks/);
  assert.match(list, /no-console-backend\s+error\s+backend\s+BE-80/);
  const dir = fixture({ 'ok.md': '| Edge case | How handled (code or UI state) | Test name |\n|---|---|---|\n| Token expired | RESET_TOKEN_INVALID | reset.expired |\n', 'no.md': '# Done\nAll good.\n' });
  assert.equal(cli(dir, '--declaration', 'ok.md').status, 0);
  assert.equal(cli(dir, '--declaration', 'no.md').status, 1);
});
