#!/usr/bin/env node
// SAMARTH AI rulebook checker. Zero dependencies, read-only (git is only queried, never written).
// Usage: node scripts/check-rules.mjs [--file p] [--pre-path p] [--changed] [--json] [--severity error|warn]
//        [--only id[,id]] [--list] [--declaration file|-] [--all] [--verbose] [--root dir]
// Exit code: 1 when any error-severity violation is reported, else 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, listRepoFiles, changedFiles, isGitIgnored, toRel, runChecks } from './check-engine.mjs';
import { CHECKS } from './rules/index.mjs';
import { pathRules, evalPath } from './rules/fs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALUE_FLAGS = new Set(['file', 'pre-path', 'severity', 'only', 'declaration', 'root', 'max']);

export function parseArgs(argv) {
  const a = { only: null };
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) { (a._ ??= []).push(argv[i]); continue; }
    const [, k, inline] = m;
    a[k] = VALUE_FLAGS.has(k) ? (inline ?? argv[++i]) : true;
  }
  if (a.only) a.only = String(a.only).split(',').map((s) => s.trim()).filter(Boolean);
  return a;
}

const SEV_ORDER = { error: 0, warn: 1, info: 2 };
const fmt = (v) => `${v.severity.padEnd(5)}  ${v.check}  ${v.file}${v.line ? `:${v.line}` : ''}  ${v.message}${v.rule ? `  (${v.rule})` : ''}`;

function printList() {
  const rows = CHECKS.map((c) => `${c.id.padEnd(34)} ${c.severity.padEnd(6)} ${c.group.padEnd(9)} ${c.ruleIds.join(',').padEnd(24)} ${c.manual ? '(manual: --declaration)' : c.scope === 'project' ? '(project-wide)' : c.globs.join(' ')}`);
  console.log(['check-id'.padEnd(34), 'sev'.padEnd(6), 'group'.padEnd(9), 'rules'.padEnd(24), 'globs'].join(' '));
  console.log(rows.join('\n'));
  console.log(`\n${CHECKS.length} checks`);
}

function preferred(root, p) {
  const rel = toRel(root, p);
  if (rel === null) return { rel: null };
  const abs = path.resolve(root, rel);
  const isDir = /[\\/]$/.test(p) || (fs.existsSync(abs) && fs.statSync(abs).isDirectory());
  return { rel: isDir ? `${rel.replace(/\/$/, '')}/` : rel, isDir };
}

function prePath(root, p, json) {
  const { rel, isDir } = preferred(root, p);
  let result;
  if (rel === null) result = { ok: true, note: 'outside the governed scope (not SAMARTH-AI, docs or workspace files)' };
  else if (!pathRules()) result = { ok: true, note: 'path-rules.json not found: path check skipped' };
  else {
    const hit = isDir ? pathRules().deny.find((e) => e.check === 'fs-folder-kebab' && e.re.test(rel)) : evalPath(rel);
    result = hit ? { ok: false, check: hit.check ?? 'fs-folder-kebab', rule: hit.id, message: hit.message, path: rel } : { ok: true, path: rel };
  }
  if (json) console.log(JSON.stringify(result));
  else if (!result.ok) console.log(`error  ${result.check}  ${result.path}  ${result.message}  (${result.rule})`);
  else console.log(`ok  ${result.path ?? p}${result.note ? `  (${result.note})` : ''}`);
  return result.ok ? 0 : 1;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/** Build the project and run checks. { file, changed, only } narrow the reported files. */
export function scan(root, { file, changed, only } = {}) {
  const rels = listRepoFiles(root);
  let focus = null;
  if (file) {
    const rel = toRel(root, file);
    if (rel === null) return { skipped: 'outside the governed scope' };
    if (!fs.existsSync(path.resolve(root, rel))) return { skipped: `${rel} does not exist` };
    if (!rels.includes(rel)) {
      if (!rel.startsWith('../') && isGitIgnored(root, rel)) return { skipped: `${rel} is git-ignored` };
      rels.push(rel);
    }
    focus = new Set([rel]);
  } else if (changed) {
    const ch = new Set(changedFiles(root));
    focus = new Set(rels.filter((r) => ch.has(r)));
  }
  const project = new Project(root, rels, focus);
  return { ...runChecks(project, CHECKS, { only }), focus, fileCount: focus ? focus.size : rels.length };
}

export async function main(argv) {
  const args = parseArgs(argv);
  const root = args.root ? path.resolve(args.root) : path.resolve(HERE, '..');
  if (args.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
  if (args.list) { printList(); return 0; }
  if (args['pre-path']) return prePath(root, args['pre-path'], args.json);
  if (args.declaration) {
    const text = args.declaration === '-' ? await readStdin() : fs.readFileSync(path.resolve(root, args.declaration), 'utf8');
    const v = CHECKS.find((c) => c.id === 'edge-declaration-present').run({ text });
    for (const x of v) console.log(`error  edge-declaration-present  ${x.message}  (EDGE-120)`);
    if (!v.length) console.log('ok  Edge-Case Declaration present');
    return v.length ? 1 : 0;
  }

  const res = scan(root, { file: args.file, changed: args.changed, only: args.only });
  if (res.skipped) { if (!args.json) console.log(`skipped: ${res.skipped}`); return 0; }
  const { violations, infos, checksRun, focus } = res;
  const nFiles = res.fileCount;
  const minSeverity = args.severity === 'error' ? 0 : 1;
  const shown = violations.filter((v) => SEV_ORDER[v.severity] <= minSeverity).sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.check.localeCompare(b.check) || a.file.localeCompare(b.file) || a.line - b.line);
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warns = violations.filter((v) => v.severity === 'warn').length;
  const showInfos = !focus || args.verbose;

  if (args.json) {
    console.log(JSON.stringify({ ok: errors === 0, counts: { error: errors, warn: warns, info: infos.length }, filesChecked: nFiles, checksRun, violations: shown, infos: showInfos ? infos : [] }, null, 1));
    return errors ? 1 : 0;
  }

  const cap = focus || args.all ? Infinity : Number(args.max) || 15;
  const byCheck = new Map();
  for (const v of shown) (byCheck.get(v.check) ?? byCheck.set(v.check, []).get(v.check)).push(v);
  for (const [, list] of byCheck) {
    list.slice(0, cap).forEach((v) => console.log(fmt(v)));
    if (list.length > cap) console.log(`      ... +${list.length - cap} more ${list[0].check} (use --all)`);
  }
  if (showInfos && infos.length) {
    console.log('\nSkipped (prerequisite missing):');
    for (const i of infos) console.log(`info   ${i.check}  ${i.message}`);
  }
  const counts = [...byCheck].map(([id, l]) => `${id}=${l.length}`).join(', ');
  console.log(`\nrules:check  ${checksRun} checks on ${nFiles} files: ${errors} error(s), ${warns} warning(s)${showInfos ? `, ${infos.length} skipped` : ''}`);
  if (counts && !focus) console.log(`by check: ${counts}`);
  return errors ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e.stack || e.message); process.exitCode = 2; });
}
