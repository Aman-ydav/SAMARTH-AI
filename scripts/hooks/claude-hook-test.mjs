// Tests for the Claude Code hook helper: pure judgement functions plus real stdin/stdout/exit-code round trips.
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'samarth-hook-'));
fs.mkdirSync(path.join(ROOT, 'backend/src/utils'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'backend/src/utils/logThing.js'), 'export const f = () => console.log("x");\n');
fs.writeFileSync(path.join(ROOT, 'package.json'), '{"name":"x","private":true}\n');
process.env.SAMARTH_ROOT = ROOT;
const { judgeBash, handle } = await import('./claude-hook.mjs');

const HOOK = fileURLToPath(new URL('./claude-hook.mjs', import.meta.url));
const run = (event, payload, env = {}) => spawnSync(process.execPath, [HOOK, event], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, SAMARTH_ROOT: ROOT, ...env } });
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('pre-bash blocks git write commands and force pushes', () => {
  for (const c of ['git commit -m "x"', 'git push --force origin main', 'cd a && git add -A', 'git -C repo reset --hard', 'git checkout -- src/a.js', 'git stash', 'git clean -fd', 'git remote add o u', 'bash -c "git commit -m y"', 'GIT_X=1 git rebase main']) {
    assert.ok(judgeBash(c, {}), `should block: ${c}`);
  }
});

test('pre-bash allows read-only git and normal commands', () => {
  for (const c of ['git status', 'git diff --stat', 'git log -3 --oneline', 'git ls-files -co --exclude-standard', 'git stash list', 'git branch', 'node scripts/check-rules.mjs', 'npm run lint', 'ls -la']) {
    assert.equal(judgeBash(c, {}), null, `should allow: ${c}`);
  }
});

test('pre-bash blocks forbidden packages but not react-icons', () => {
  assert.ok(judgeBash('npm install lucide-react', {}));
  assert.ok(judgeBash('npm --prefix frontend i react-icons gsap@3.12.0', {}));
  assert.ok(judgeBash('pnpm add @tanstack/react-query', {}));
  assert.equal(judgeBash('npm install react-icons motion lenis', {}), null);
});

test('overrides: SAMARTH_ALLOW_GIT and SAMARTH_ALLOW_DEPS', () => {
  assert.equal(judgeBash('git commit -m x', { SAMARTH_ALLOW_GIT: '1' }), null);
  assert.equal(judgeBash('npm i lucide-react', { SAMARTH_ALLOW_DEPS: '1' }), null);
});

test('pre-write blocks a new file without a slot, allows slots and existing files', () => {
  const bad = handle('pre-write', { tool_name: 'Write', tool_input: { file_path: path.join(ROOT, 'frontend/src/Foo/bar.js') } });
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /FS-/);
  const good = handle('pre-write', { tool_name: 'Write', tool_input: { file_path: path.join(ROOT, 'frontend/src/lib/newThing.js') } });
  assert.deepEqual(good, {});
  const existing = handle('pre-write', { tool_name: 'Write', tool_input: { file_path: path.join(ROOT, 'package.json') } });
  assert.deepEqual(existing, {});
  const outside = handle('pre-write', { tool_name: 'Write', tool_input: { file_path: 'C:/elsewhere/Foo Bar/x.txt' } });
  assert.deepEqual(outside, {});
});

test('process round trip: exit code 2 and stderr reason on a blocked command', () => {
  const r = run('pre-bash', bash('git push origin main'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /forbidden/);
  const ok = run('pre-bash', bash('git status'));
  assert.equal(ok.status, 0);
  assert.equal(ok.stderr, '');
});

test('session-start prints the six-line reminder', () => {
  const r = run('session-start', {});
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split('\n').length, 6);
  assert.match(r.stdout, /00-index\.md/);
});

test('user-prompt reminds once per session', () => {
  const id = `test-${process.pid}-${Date.now()}`;
  assert.ok(run('user-prompt', { session_id: id }).stdout.includes('Reminder'));
  assert.equal(run('user-prompt', { session_id: id }).stdout, '');
});

test('post-write feeds rule errors back with exit 2; clean files pass', () => {
  const bad = run('post-write', { tool_name: 'Edit', tool_input: { file_path: path.join(ROOT, 'backend/src/utils/logThing.js') } });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /no-console-backend/);
  const clean = run('post-write', { tool_name: 'Write', tool_input: { file_path: path.join(ROOT, 'package.json') } });
  assert.equal(clean.status, 0);
});

test('stop hook honours stop_hook_active (loop guard) and emits a block decision otherwise', () => {
  assert.deepEqual(handle('stop', { stop_hook_active: true }), {});
  const r = handle('stop', {}, { SAMARTH_STOP_SCOPE: 'all' });
  assert.ok(r.stdout, 'expected a block decision for the console.log fixture');
  const j = JSON.parse(r.stdout);
  assert.equal(j.decision, 'block');
  assert.match(j.reason, /rules:check/);
});

test('malformed stdin never crashes the helper', () => {
  const r = spawnSync(process.execPath, [HOOK, 'pre-bash'], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
