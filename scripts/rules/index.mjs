// Registry of every automated check. A check is { id, ruleIds, severity, globs, run, scope?, paths?, manual?, desc? }.
//   run(file, project) -> [{ line, message, severity?, rule?, file? }]   (default, once per matching file)
//   run(project)       -> same, with `file` set                          (scope: 'project'; severity 'info' = skipped)
// paths: true  = path-only check, also sees generated/binary files.  manual: true = only run on explicit input.
import fsChecks from './fs.mjs';
import ui from './ui.mjs';
import frontend from './frontend.mjs';
import frontendState from './frontend-state.mjs';
import backend from './backend.mjs';
import auth from './auth.mjs';
import db from './db.mjs';
import anim from './anim.mjs';
import test from './test.mjs';
import media from './media.mjs';
import edge from './edge.mjs';

const groups = { fs: fsChecks, ui, frontend: [...frontend, ...frontendState], backend, auth, db, anim, test, media, edge };

export const CHECKS = Object.entries(groups).flatMap(([group, list]) => list.map((c) => ({ ...c, group })));

const seen = new Set();
for (const c of CHECKS) {
  if (seen.has(c.id)) throw new Error(`duplicate check id: ${c.id}`);
  seen.add(c.id);
  if (!c.ruleIds?.length || !c.severity || typeof c.run !== 'function' || (!c.globs && c.scope !== 'project' && !c.manual)) {
    throw new Error(`malformed check: ${c.id}`);
  }
  c.globs ??= [];
}
