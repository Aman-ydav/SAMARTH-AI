// FS group (rulebook 06): path rules from docs/rules/assets/path-rules.json plus line limits, test colocation, root scripts.
// Reading notes:
//  - path-rules.json is evaluated deny -> allow -> unmatched exactly as its `note` says; each entry names the check it reports under.
//  - fs-max-lines skips frontend .jsx (outside components/ui and tests): component-max-lines (FE-88) owns those files.
//  - If path-rules.json cannot be found (docs live outside the git repo) the path checks are skipped with an INFO line.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES_PATH = process.env.SAMARTH_PATH_RULES || fileURLToPath(new URL('../../../docs/rules/assets/path-rules.json', import.meta.url));
let loaded;
export function pathRules() {
  if (loaded !== undefined) return loaded;
  try {
    const j = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    const c = (e) => ({ ...e, re: new RegExp(e.pattern) });
    loaded = { deny: j.deny.map(c), allow: j.allow.map(c), unmatched: j.unmatched.map(c), maxLines: Object.values(j.maxLines).map(c) };
  } catch {
    loaded = null;
  }
  return loaded;
}

/** First failing path rule for a repo-relative path, or null. Shared by --pre-path. */
export function evalPath(rel) {
  const r = pathRules();
  if (!r) return null;
  const d = r.deny.find((e) => e.re.test(rel));
  if (d) return d;
  if (r.allow.some((e) => e.re.test(rel))) return null;
  return r.unmatched.find((e) => e.re.test(rel)) ?? null;
}

const memo = new Map();
const verdict = (rel) => (memo.has(rel) ? memo.get(rel) : (memo.set(rel, evalPath(rel)), memo.get(rel)));

function pathCheck(id, desc) {
  return {
    id, ruleIds: ['FS-30'], severity: 'error', globs: ['**'], paths: true, desc,
    run(file) {
      if (!pathRules()) return id === 'fs-folder-kebab' && file.rel === project0(file) ? [{ line: 1, severity: 'info', message: 'path-rules.json not found: path checks skipped (set SAMARTH_PATH_RULES)' }] : [];
      const v = verdict(file.rel);
      return v && v.check === id ? [{ line: 1, message: v.message, rule: v.id }] : [];
    },
  };
}

const IDS = [
  ['fs-backend-file-pattern', 'backend file matching no allow pattern, legacy files, src/models/'],
  ['fs-frontend-file-pattern', 'frontend file matching no allow pattern'],
  ['fs-folder-kebab', 'folder with capitals, spaces, underscores or dots'],
  ['fs-allowed-root-dirs', 'top-level dir outside backend/frontend/scripts/.github, bad docs/scripts names'],
  ['fs-no-stray-root-files', 'unlisted file at repo, backend/ or frontend/ root'],
  ['fs-no-barrel-outside-boundary', 'index.js(x) outside the FS-42 list'],
  ['fs-ui-dir-shadcn-only', 'non-shadcn file name in components/ui/'],
  ['fs-no-leftover', 'junk names, copies, backups, binaries, generated dirs, real .env'],
];
const project0 = (f) => f.project.rels[0];
const checks = IDS.map(([id, desc]) => pathCheck(id, desc));
checks.find((c) => c.id === 'fs-allowed-root-dirs').ruleIds = ['FS-10', 'FS-33'];
checks.find((c) => c.id === 'fs-no-leftover').ruleIds = ['FS-05', 'FS-07', 'FS-08'];

export const sizeCheck = (id, rules, desc, only) => ({
  id, ruleIds: rules, severity: 'error', desc,
  globs: ['backend/src/**', 'frontend/src/**', 'scripts/**'],
  run(file) {
    const r = pathRules();
    if (!r || file.text == null) return [];
    const entry = r.maxLines.find((e) => e.re.test(file.rel));
    if (!entry) return [];
    const isReact = entry.pattern === '^frontend/src/.*\\.jsx$';
    if (only ? !isReact : isReact) return [];
    const n = file.lines.length;
    if (n > entry.error) return [{ line: n, message: `${n} lines exceeds the ${entry.error}-line limit: split by role`, rule: only ? 'FE-88' : 'FS-34' }];
    if (n > entry.warn) return [{ line: n, severity: 'warn', message: `${n} lines exceeds the ${entry.warn}-line soft limit: split on next touch`, rule: only ? 'FE-88' : 'FS-34' }];
    return [];
  },
});
checks.push(sizeCheck('fs-max-lines', ['FS-34'], 'file over the maxLines limit (warn/error), see path-rules.json'));

const TEST_RE = /^(.*)\.test\.(jsx?)$/;
checks.push({
  id: 'fs-test-colocation', ruleIds: ['FS-17'], severity: 'error', paths: true,
  desc: '.test file without a sibling unit; __tests__/.spec/misplaced test dirs (path-rules deny)',
  globs: ['**'],
  run(file, project) {
    const out = [];
    const v = verdict(file.rel);
    if (v && v.check === 'fs-test-colocation') out.push({ line: 1, message: v.message, rule: v.id });
    const m = TEST_RE.exec(file.rel);
    if (m && /^(backend|frontend)\/src\//.test(file.rel) && !/^frontend\/src\/test\//.test(file.rel)) {
      const unit = [`${m[1]}.js`, `${m[1]}.jsx`];
      if (!unit.some((u) => project.has(u))) out.push({ line: 1, message: `test has no sibling unit (${path.posix.basename(unit[0])}); cross-module flows go to backend/tests/integration/` });
    }
    return out;
  },
});

const ALLOWED_SCRIPTS = ['install:all', 'dev', 'build', 'lint', 'lint:fix', 'format', 'test', 'test:backend', 'test:frontend', 'test:api', 'rules:check'];
checks.push({
  id: 'root-package-scripts', ruleIds: ['FS-06'], severity: 'error', globs: ['package.json'],
  desc: 'root package.json: script names fixed by rule 06 section 5; tooling only, no app dependencies',
  run(file) {
    let j;
    try { j = JSON.parse(file.text); } catch { return [{ line: 1, message: 'invalid JSON' }]; }
    const out = Object.keys(j.scripts || {}).filter((s) => !ALLOWED_SCRIPTS.includes(s)).map((s) => ({ line: 1, message: `root script "${s}" is not in the rule 06 list (amend FS-06 first)` }));
    if (j.dependencies && Object.keys(j.dependencies).length) out.push({ line: 1, message: 'root package.json must not have dependencies (tooling only)' });
    return out;
  },
});

export default checks;
