#!/usr/bin/env node
// Claude Code hook helper for the SAMARTH AI rulebook. Usage (from .claude/settings.json):
//   node claude-hook.mjs <session-start|user-prompt|pre-write|pre-bash|post-write|stop>   (hook JSON on stdin)
// Exit 2 + stderr blocks (pre-*) or feeds the message back to Claude (post-write); stop emits {"decision":"block"}.
// Overrides (set by the human in the shell that launches Claude, never by the agent):
//   SAMARTH_ALLOW_GIT=1   allow git write commands      SAMARTH_ALLOW_DEPS=1   allow forbidden npm packages
//   SAMARTH_STOP_SCOPE=all   Stop hook checks the whole repo instead of only changed files   SAMARTH_ROOT=dir   (tests) alternate repo root
// Hook failures that are not exit 2 are non-blocking by design: a broken helper must never wedge the session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../check-rules.mjs';
import { toRel, isGitIgnored } from '../check-engine.mjs';
import { evalPath } from '../rules/fs.mjs';

const ROOT = process.env.SAMARTH_ROOT ? path.resolve(process.env.SAMARTH_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const inScope = (rel) => rel !== null && (!rel.startsWith('..') || rel.startsWith('../docs/'));

const GIT_BLOCK = /^(?:commit|push|add|rm|mv|reset|restore|stash|clean|rebase|merge|cherry-pick|revert|am|apply|commit-tree|update-ref|filter-branch|replace|gc|prune|worktree)$/;
const GIT_PAIR = [[/^remote$/, /^(?:add|set-url|remove|rm|rename|prune|set-head)$/], [/^tag$/, /^(?!-l\b|--list|-n\b|--contains|--points-at)\S/], [/^branch$/, /^(?:-[dDmMcC]|--delete|--move|--copy|--force|-f)/], [/^config$/, /^(?!--get|--list|-l\b|--show)/], [/^submodule$/, /^(?:add|update|init|sync)$/]];
const STASH_READ = /^(?:list|show)$/;
const BAD_PKGS = /^(?:lucide(?:-react)?|gsap|@gsap\/\S+|aos|animejs|react-spring|@react-spring\/\S+|lottie-web|lottie-react|react-transition-group|locomotive-scroll|scrollreveal|react-intersection-observer|react-fast-marquee|typed\.js|three|@react-three\/\S+|framer-motion|framer|redux-persist|zustand|swr|@tanstack\/react-query|ky|react-router-dom|moment|prop-types|typescript|jest|mocha|cypress|express-mongo-sanitize|hpp|@mui\/\S+|@chakra-ui\/\S+|antd|@mantine\/\S+|@headlessui\/\S+|daisyui|react-toastify|react-hot-toast|react-select|react-modal|@heroicons\/\S+|@tabler\/\S+|@phosphor-icons\/\S+|@fortawesome\/\S+)$/;

/** Reason string when the bash command must be blocked, else null. */
export function judgeBash(command, env = process.env) {
  const allowGit = env.SAMARTH_ALLOW_GIT === '1';
  const allowDeps = env.SAMARTH_ALLOW_DEPS === '1';
  // Split into simple commands, also looking inside `bash -c "..."` style quoting by treating quotes as separators.
  const segs = command.split(/&&|\|\||[;|\n()]|`|\$\(|["']/);
  for (const raw of segs) {
    const tok = raw.trim().split(/\s+/).filter(Boolean);
    while (tok.length && (/^[A-Za-z_]\w*=/.test(tok[0]) || /^(?:sudo|command|env|time|exec|nohup)$/.test(tok[0]))) tok.shift();
    if (!tok.length) continue;
    const prog = tok[0].replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
    if (prog === 'git' && !allowGit) {
      const rest = tok.slice(1);
      let i = 0;
      while (i < rest.length && /^-/.test(rest[i])) i += /^(?:-C|-c|--git-dir|--work-tree|--namespace)$/.test(rest[i]) ? 2 : 1;
      const sub = rest[i];
      const args = rest.slice(i + 1);
      if (!sub) continue;
      if (sub === 'stash' && args[0] && STASH_READ.test(args[0])) continue;
      if (GIT_BLOCK.test(sub)) return `git ${sub} is forbidden: the team commits and manages the repo manually (DECISIONS section 0)`;
      if (sub === 'checkout' && args.some((a) => a === '--' || a === '-f' || a === '--force' || a === '.')) return 'git checkout -- / -f discards work: forbidden (DECISIONS section 0)';
      for (const [s, a] of GIT_PAIR) if (s.test(sub) && args[0] && a.test(args[0])) return `git ${sub} ${args[0]} changes repository state: forbidden`;
      if (sub === 'push') return 'git push is forbidden';
    }
    let at = 1;
    while (at < tok.length && /^-/.test(tok[at])) at += /^(?:--prefix|--workspace|-w|--cwd|-C|--dir)$/.test(tok[at]) ? 2 : 1;
    if (!allowDeps && /^(?:npm|pnpm|yarn|bun)$/.test(prog) && /^(?:i|install|add|update|upgrade|up)$/.test(tok[at] ?? '')) {
      const bad = tok.slice(at + 1).map((t) => t.replace(/@[\^~]?[\d.x*]+.*$|@latest$/, '')).filter((t) => !t.startsWith('-') && BAD_PKGS.test(t));
      if (bad.length) return `installing ${bad.join(', ')} is forbidden by the rulebook (icons: react-icons only; animation: motion + lenis only; charter stack only). Edit the rule first or set SAMARTH_ALLOW_DEPS=1 (human only)`;
    }
  }
  return null;
}

function judgeNewFile(filePath) {
  const rel = toRel(ROOT, filePath);
  if (!inScope(rel) || fs.existsSync(path.resolve(ROOT, rel))) return null;
  const hit = evalPath(rel);
  if (!hit) return null;
  if (!rel.startsWith('..') && isGitIgnored(ROOT, rel)) return null;
  return `New file "${rel}" is not allowed: ${hit.message} (${hit.id}, ${hit.check ?? 'path-rules'}). Find its slot in docs/rules/06-file-and-folder-rules.md; if none exists, amend rule 06 + docs/rules/assets/path-rules.json first (FS-02).`;
}

function fileReport(filePath) {
  const rel = toRel(ROOT, filePath);
  if (!inScope(rel)) return null;
  const res = scan(ROOT, { file: filePath });
  if (res.skipped) return null;
  const errors = res.violations.filter((v) => v.severity === 'error');
  if (!errors.length) return null;
  const lines = errors.slice(0, 12).map((v) => `  ${v.check}  ${v.file}:${v.line}  ${v.message}  (${v.rule})`);
  return `rules:check found ${errors.length} error(s) in ${rel}. Fix them now (or state in your final message why a violation is intentional):\n${lines.join('\n')}${errors.length > 12 ? `\n  ... +${errors.length - 12} more` : ''}`;
}

const REMINDER = [
  'SAMARTH AI rulebook is binding. Before editing, read docs/rules/00-index.md and docs/rules/11-ai-agent-protocol.md (workspace C:\\dev\\capstone).',
  'NEVER run git commit/push/add/reset/checkout --/stash/clean (hooks block them; the team commits manually). Reading git state is fine.',
  'Place every new file/folder per docs/rules/06-file-and-folder-rules.md; a hook rejects paths with no slot. Imports: @/ (frontend), #dir/ (backend).',
  'Stack: JavaScript only; Redux Toolkit thunks + the single axios apiClient; shadcn + react-icons (no lucide); colour tokens only; motion + lenis.',
  'Tests ship with the code (backend first); every task summary ends with the Edge-Case Declaration table (docs/rules/09).',
  'Before finishing run `npm run rules:check` (plus lint, tests, build) from SAMARTH-AI and report the REAL output.',
].join('\n');

export function handle(event, input, env = process.env) {
  const ti = input.tool_input ?? {};
  switch (event) {
    case 'session-start':
      return { stdout: REMINDER };
    case 'user-prompt': {
      const marker = path.join(os.tmpdir(), `samarth-rules-${String(input.session_id ?? 'x').replace(/[^\w-]/g, '')}`);
      if (fs.existsSync(marker)) return {};
      try { fs.writeFileSync(marker, '1'); } catch { /* best effort: reminder may repeat */ }
      return { stdout: 'Reminder: follow docs/rules (00-index.md, 11-ai-agent-protocol.md); no git writes; run rules:check before finishing.' };
    }
    case 'pre-write': {
      if (!ti.file_path || (input.tool_name && input.tool_name !== 'Write')) return {};
      const why = judgeNewFile(ti.file_path);
      return why ? { code: 2, stderr: why } : {};
    }
    case 'pre-bash': {
      const why = ti.command ? judgeBash(String(ti.command), env) : null;
      return why ? { code: 2, stderr: `Blocked by SAMARTH rulebook: ${why}. (Human override: SAMARTH_ALLOW_GIT=1 / SAMARTH_ALLOW_DEPS=1 in the launching shell.)` } : {};
    }
    case 'post-write': {
      const msg = ti.file_path ? fileReport(ti.file_path) : null;
      return msg ? { code: 2, stderr: msg } : {};
    }
    case 'stop': {
      if (input.stop_hook_active) return {};
      const res = scan(ROOT, { changed: env.SAMARTH_STOP_SCOPE !== 'all' });
      const errors = (res.violations ?? []).filter((v) => v.severity === 'error');
      if (!errors.length) return {};
      const top = errors.slice(0, 15).map((v) => `${v.check} ${v.file}:${v.line} ${v.message} (${v.rule})`);
      const reason = `rules:check reports ${errors.length} error(s) ${env.SAMARTH_STOP_SCOPE === 'all' ? 'in the repo' : 'in changed files'}. Fix them, or explicitly state in your final message why each remaining one is intentional:\n${top.join('\n')}${errors.length > 15 ? `\n... +${errors.length - 15} more (run npm run rules:check)` : ''}`;
      return { stdout: JSON.stringify({ decision: 'block', reason }) };
    }
    default:
      return {};
  }
}

async function main() {
  const event = process.argv[2];
  let input = {};
  try {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (raw) input = JSON.parse(raw);
  } catch { /* malformed payload: act on an empty one */ }
  const out = handle(event, input);
  if (out.stdout) process.stdout.write(`${out.stdout}\n`);
  if (out.stderr) process.stderr.write(`${out.stderr}\n`);
  process.exitCode = out.code ?? 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { process.stderr.write(`claude-hook error: ${e.message}\n`); process.exitCode = 1; });
}
