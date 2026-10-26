// Engine for check-rules: file discovery (read-only git), glob matching, lazy file model, check runner.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mask } from './rules/util.mjs';

const BIN = /\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tgz|7z|rar|tar|mp[34]|mov|webm|wav|woff2?|ttf|otf|eot|exe|dll|docx?|pptx?|xlsx?)$/i;
const GENERATED = /(^|\/)(node_modules|dist|build|coverage|\.git)\//;
const LOCK = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;
const CODE_EXT = new Set(['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'css']);

export function globToRegExp(glob) {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (m) return new RegExp(m[1].split(',').map((o) => globToRegExp(glob.replace(m[0], o)).source).join('|'));
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i++; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^(?:${re})$`);
}
const cache = new Map();
export function matchesGlobs(rel, globs) {
  return globs.some((g) => {
    if (!cache.has(g)) cache.set(g, globToRegExp(g));
    return cache.get(g).test(rel);
  });
}

export class SrcFile {
  constructor(project, rel) {
    this.project = project;
    this.rel = rel;
    this.abs = path.resolve(project.root, rel);
    this.base = path.posix.basename(rel);
    this.ext = path.extname(rel).slice(1).toLowerCase();
  }
  get generated() { return GENERATED.test(this.rel) || LOCK.test(this.rel); }
  get binary() { return BIN.test(this.rel); }
  get size() {
    try { return fs.statSync(this.abs).size; } catch { return 0; }
  }
  get text() {
    if (this._t === undefined) {
      this._t = null;
      if (!this.binary && !this.generated) {
        try {
          const b = fs.readFileSync(this.abs);
          if (b.length < 1_500_000 && !b.includes(0)) this._t = b.toString('utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
        } catch { /* unreadable: treated as binary */ }
      }
    }
    return this._t;
  }
  get lines() { return this.text == null ? [] : this.text.replace(/\n$/, '').split('\n'); }
  get code() {
    if (this._c === undefined) this._c = this.text == null ? null : CODE_EXT.has(this.ext) ? mask(this.text, { css: this.ext === 'css' }) : this.text;
    return this._c;
  }
  get nostr() {
    if (this._n === undefined) this._n = this.text == null ? null : mask(this.text, { strings: true, css: this.ext === 'css' });
    return this._n;
  }
}

export class Project {
  constructor(root, rels, focus = null) {
    this.root = root;
    this.rels = [...new Set(rels)].sort();
    this.focus = focus;
    this._files = new Map();
  }
  file(rel) {
    if (!this._files.has(rel)) this._files.set(rel, new SrcFile(this, rel));
    return this._files.get(rel);
  }
  has(rel) { return this.rels.includes(rel); }
  all(globs) { return this.rels.filter((r) => matchesGlobs(r, globs)).map((r) => this.file(r)); }
  /** True when rule output for `rel` would be reported (focus mode skips the rest). */
  wants(rel) { return !this.focus || this.focus.has(rel); }
}

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });

function walk(dir, base, out, skip) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (skip.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) walk(abs, rel, out, skip); else out.push(rel);
  }
}

export function listRepoFiles(root) {
  let rels;
  try {
    rels = git(root, ['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  } catch {
    rels = [];
    walk(root, '', rels, new Set(['.git', 'node_modules']));
  }
  rels = rels.filter((r) => fs.existsSync(path.join(root, r)));
  // Workspace files outside the repo that path-rules.json governs (../docs, ../CLAUDE.md, ../.claude/settings.json).
  const parent = path.resolve(root, '..');
  const docs = [];
  walk(path.join(parent, 'docs'), '../docs', docs, new Set(['node_modules', '.git']));
  for (const f of ['CLAUDE.md', '.claude/settings.json']) if (fs.existsSync(path.join(parent, f))) docs.push(`../${f}`);
  return [...rels, ...docs];
}

export function changedFiles(root) {
  const prefix = git(root, ['rev-parse', '--show-prefix']).trim();
  const parts = git(root, ['status', '--porcelain', '-uall', '-z']).split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const xy = parts[i].slice(0, 2);
    let p = parts[i].slice(3);
    if (/[RC]/.test(xy)) i++; // rename/copy: next entry is the old path
    if (xy.includes('D')) continue;
    if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
    out.push(p);
  }
  return out;
}

export function isGitIgnored(root, rel) {
  try { git(root, ['check-ignore', '-q', '--', rel]); return true; } catch { return false; }
}

/** Repo-relative POSIX path for an absolute or repo-relative argument; null if outside the governed scope. */
export function toRel(root, p) {
  const abs = path.resolve(root, p);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (!rel.startsWith('..')) return rel;
  return /^\.\.\/(docs\/|CLAUDE\.md$|\.claude\/)/.test(rel) ? rel : null;
}

export function runChecks(project, checks, { only } = {}) {
  const violations = [];
  const infos = [];
  const sel = checks.filter((c) => !c.manual && (!only || only.includes(c.id)));
  for (const c of sel) {
    const push = (file, v) => {
      if (!project.wants(file)) return;
      const item = {
        severity: v.severity ?? c.severity,
        check: c.id,
        file: v.file ?? file,
        line: v.line ?? 1,
        message: v.message,
        rule: v.rule ?? c.ruleIds.join(','),
      };
      (item.severity === 'info' ? infos : violations).push(item);
    };
    try {
      if (c.scope === 'project') {
        for (const v of c.run(project) || []) push(v.file ?? '', v);
      } else {
        for (const f of project.all(c.globs)) {
          if (!c.paths && (f.generated || f.binary)) continue;
          for (const v of c.run(f, project) || []) push(f.rel, v);
        }
      }
    } catch (e) {
      violations.push({ severity: 'warn', check: 'checker-error', file: '', line: 1, message: `${c.id} crashed: ${e.message}`, rule: '' });
    }
  }
  return { violations, infos, checksRun: sel.length };
}
