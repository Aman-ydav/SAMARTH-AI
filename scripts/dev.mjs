#!/usr/bin/env node
// Runs the backend and frontend dev servers together with prefixed output; Ctrl+C (or either one exiting) stops both.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = [
  { name: 'api', dir: 'backend', color: '\x1b[36m' },
  { name: 'web', dir: 'frontend', color: '\x1b[35m' },
];
const children = [];
let stopping = false;

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  children.forEach(killTree);
  setTimeout(() => process.exit(code), 300);
}

for (const app of apps) {
  const child = spawn(`npm --prefix ${app.dir} run dev`, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  children.push(child);
  const tag = `${app.color}[${app.name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) readline.createInterface({ input: stream }).on('line', (line) => console.log(tag + line));
  child.on('exit', (code) => {
    if (!stopping) console.log(`${tag}exited with code ${code}; stopping the other server`);
    stopAll(code ?? 1);
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
