// DB group (rulebook 05). Reading notes:
//  - String paths: `enum` fields are bounded by their values, so they need neither trim nor maxlength; every other String needs
//    trim: true and maxlength. lowercase: true is required for email, *Email, slug, *Slug, nameKey, code, username.
//  - no-unbounded-find only judges `X.find({...})` / `X.find(filter)` queries (Array.find takes a function) in service/repository files;
//    a `.limit(` or `maxTimeMS` anywhere in the statement satisfies it. Aggregates are judged by aggregate-has-maxTimeMS.
//  - aggregate-match-first: the first stage must be scopeStage(...), $vectorSearch/$search/$geoNear, or a $match that mentions orgId.
//  - ttl-on-token-collections reads the collection from `collection: '...'` or, failing that, the model file name.
import { calls, balanced, lineOf, isTest, BE } from './util.mjs';

const MODELS = [`${BE}**/*.model.js`];
const schemaCalls = (f) => calls(f.code, /\bnew\s+(?:mongoose\.)?Schema\s*\(/);
const enclosing = (code, idx) => {
  let d = 0;
  for (let k = idx; k >= 0; k--) {
    if (code[k] === '}') d++;
    else if (code[k] === '{') { if (d === 0) return k; d--; }
  }
  return -1;
};
const LOWER_NAMES = /^(?:email|\w*Email|slug|\w*Slug|nameKey|code|username)$/;

const timestamps = {
  id: 'schema-has-timestamps', ruleIds: ['DB-06'], severity: 'error', globs: MODELS,
  desc: 'every Schema needs timestamps',
  run: (f) => schemaCalls(f).filter((c) => !/timestamps\s*:\s*(?:true|\{)/.test(c.body)).map((c) => ({ line: c.line, message: 'Schema without timestamps: true (or { createdAt: true, updatedAt: false })' })),
};

const strings = {
  id: 'schema-string-trim-lowercase', ruleIds: ['DB-07', 'DB-08'], severity: 'error', globs: MODELS,
  desc: 'String paths need trim + maxlength (enum exempt); email/slug/code need lowercase',
  run(f) {
    const c = f.code;
    const out = [];
    const seen = new Set();
    for (const m of c.matchAll(/\btype\s*:\s*String\b/g)) {
      const open = enclosing(c, m.index);
      if (open < 0 || seen.has(open)) continue;
      seen.add(open);
      const obj = c.slice(open, balanced(c, open) + 1);
      const name = /(\w+)\s*:\s*(?:\[\s*)?$/.exec(c.slice(0, open))?.[1] ?? 'array item';
      if (!/\benum\s*:/.test(obj)) {
        if (!/\btrim\s*:\s*true/.test(obj)) out.push({ line: lineOf(c, m.index), message: `String path "${name}" lacks trim: true` });
        if (!/\bmax[lL]ength\s*:/.test(obj)) out.push({ line: lineOf(c, m.index), message: `String path "${name}" lacks maxlength` });
        if (LOWER_NAMES.test(name) && !/\blowercase\s*:\s*true/.test(obj)) out.push({ line: lineOf(c, m.index), message: `"${name}" must be lowercase: true` });
      }
    }
    for (const m of c.matchAll(/\b(\w+)\s*:\s*(?:\[\s*)?String\b(?!\s*[(.])/g)) if (m[1] !== 'type') out.push({ line: lineOf(c, m.index), message: `String path "${m[1]}" has no constraints: use { type: String, trim: true, maxlength: N }` });
    return out;
  },
};

const find = {
  id: 'no-unbounded-find', ruleIds: ['BE-25', 'DB-51'], severity: 'error', globs: [`${BE}**/*.{service,repository}.js`],
  desc: 'Model.find(...) without limit/pagination',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    for (const c of calls(f.code, /(?<![\w$])[A-Za-z_$][\w$.]*\.find\s*\(/)) {
      const arg = c.body.slice(1).trimStart();
      if (!(/^[{)]/.test(arg) || /^(?:filter|query|criteria|conditions|match|where)\b/.test(arg))) continue;
      const semi = f.code.indexOf(';', c.end);
      const stmt = f.code.slice(c.idx, semi < 0 || semi - c.idx > 600 ? c.idx + 600 : semi);
      if (!/\.limit\s*\(|paginate|maxTimeMS/.test(stmt)) out.push({ line: c.line, message: 'find() without .limit(): every list is bounded (max 100, rule BE-25)' });
    }
    return out;
  },
};

const aggregate = {
  id: 'aggregate-has-maxTimeMS', ruleIds: ['DB-56'], severity: 'error', globs: [`${BE}**/*.js`],
  desc: 'aggregate only through runAggregate with maxTimeMS',
  run(f) {
    if (isTest(f.rel)) return [];
    if (/\b(?:function|const)\s+runAggregate\b/.test(f.code)) return /maxTimeMS/.test(f.code) ? [] : [{ line: 1, message: 'runAggregate must set maxTimeMS' }];
    return calls(f.code, /\.aggregate\s*\(/)
      .filter((c) => !/maxTimeMS/.test(f.code.slice(c.idx, c.idx + 400)))
      .map((c) => ({ line: c.line, message: '.aggregate() outside runAggregate (no maxTimeMS)' }));
  },
};

const matchFirst = {
  id: 'aggregate-match-first', ruleIds: ['DB-52', 'DB-59'], severity: 'error', globs: [`${BE}**/*.pipelines.js`],
  desc: 'pipeline builders start with a scoped $match (or scopeStage / $vectorSearch / $search / $geoNear)',
  run(f) {
    const c = f.code;
    const out = [];
    for (const m of c.matchAll(/(?:return\s*|=>\s*)\[\s*/g)) {
      const at = m.index + m[0].length;
      const rest = c.slice(at);
      if (/^(?:\.\.\.)?scopeStage\s*\(/.test(rest)) continue;
      if (rest[0] !== '{') continue;
      const stage = rest.slice(0, balanced(rest, 0) + 1);
      if (!/^\{\s*['"]?\$/.test(stage)) continue;
      const line = lineOf(c, at);
      if (/^\{\s*['"]?\$(?:vectorSearch|search|geoNear)\b/.test(stage)) continue;
      if (!/^\{\s*['"]?\$match\b/.test(stage)) out.push({ line, message: 'first pipeline stage must be a scoped $match (scopeStage)' });
      else if (!/orgId/.test(stage)) out.push({ line, message: 'first $match must be scoped by orgId: use scopeStage({ orgId })' });
    }
    return out;
  },
};

const rawInput = {
  id: 'no-raw-user-input-in-pipeline', ruleIds: ['DB-58', 'BE-62'], severity: 'error', globs: [`${BE}**/*.{pipelines,service}.js`],
  desc: 'req.* in pipelines, $where/$function/$out, unescaped RegExp',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    const c = f.code;
    for (const m of c.matchAll(/\$where\b|\$function\b|\$accumulator\b|\$out\b/g)) out.push({ line: lineOf(c, m.index), message: `${m[0]} is banned` });
    if (f.base.endsWith('.pipelines.js')) for (const m of c.matchAll(/(?<![\w$.])req\s*\./g)) out.push({ line: lineOf(c, m.index), message: 'pipeline builders take typed params, never req.*' });
    for (const r of calls(c, /\bnew\s+RegExp\s*\(/)) if (!/escapeRegex\s*\(/.test(r.body)) out.push({ line: r.line, message: 'new RegExp(...) input must go through escapeRegex()' });
    for (const m of c.matchAll(/\$regex\s*:\s*/g)) {
      const rest = c.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (!/^(?:escapeRegex\s*\(|\/|['"`])/.test(rest)) out.push({ line: lineOf(c, m.index), message: '$regex value must be escapeRegex(...) or a literal' });
    }
    return out;
  },
};

const SECRET_FIELDS = 'passwordHash|tokenHash|passwordHistory|embedding|correctKey|explanation';
const selectFalse = {
  id: 'password-select-false', ruleIds: ['DB-11'], severity: 'error', globs: MODELS,
  desc: 'secret fields (hashes, embeddings, answer keys) need select: false',
  run(f) {
    const c = f.code;
    const out = [];
    for (const m of c.matchAll(new RegExp(`\\b(${SECRET_FIELDS})\\s*:\\s*`, 'g'))) {
      const at = m.index + m[0].length;
      const rest = c.slice(at);
      if (/^-?\d/.test(rest)) continue; // index key such as { tokenHash: 1 }
      if (rest[0] === '{') {
        const obj = rest.slice(0, balanced(rest, 0) + 1);
        if (!/\btype\b/.test(obj) || /select\s*:\s*false/.test(obj)) continue;
      } else if (!/^(?:\[|String|Number|Schema|mongoose)/.test(rest)) continue;
      out.push({ line: lineOf(c, m.index), message: `${m[1]} must declare select: false` });
    }
    return out;
  },
};

const TTL = new Set(['refreshSessions', 'authTokens', 'loginAttempts', 'llmCache']);
const BASE_TO_COLL = { refreshSession: 'refreshSessions', authToken: 'authTokens', loginAttempt: 'loginAttempts', llmCache: 'llmCache' };
const ttl = {
  id: 'ttl-on-token-collections', ruleIds: ['DB-24'], severity: 'error', globs: MODELS,
  desc: 'refreshSessions/authTokens/loginAttempts/llmCache need a TTL (expireAfterSeconds) index',
  run(f) {
    const coll = /collection\s*:\s*['"`](\w+)['"`]/.exec(f.code)?.[1] ?? BASE_TO_COLL[f.base.replace('.model.js', '')];
    return TTL.has(coll) && !/expireAfterSeconds/.test(f.code) ? [{ line: 1, message: `${coll} needs a TTL index (expireAfterSeconds) on its expiry date` }] : [];
  },
};

const plural = (s) => /[^su]s$/.test(s) && !/(?:ss|us|is)$/.test(s);
const naming = {
  id: 'model-file-naming', ruleIds: ['DB-01', 'FS-13'], severity: 'error', globs: MODELS,
  desc: '<camelCase>.model.js, singular PascalCase model, explicit camelCase plural collection',
  run(f) {
    const out = [];
    const stem = f.base.replace(/\.model\.js$/, '');
    if (!/^[a-z][a-zA-Z0-9]*$/.test(stem)) out.push({ line: 1, message: `file name "${f.base}" must be <camelCase>.model.js` });
    else if (plural(stem)) out.push({ line: 1, message: `"${stem}" looks plural: model files are singular` });
    for (const c of calls(f.code, /\b(?:mongoose\.)?model\s*\(/)) {
      const name = /\(\s*['"`](\w+)['"`]/.exec(c.body)?.[1];
      if (!name) continue;
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(name) || plural(name)) out.push({ line: c.line, message: `model name "${name}" must be singular PascalCase` });
      else if (name[0].toLowerCase() + name.slice(1) !== stem) out.push({ line: c.line, message: `model "${name}" does not match file name ${f.base}` });
    }
    const coll = /collection\s*:\s*['"`](\w+)['"`]/.exec(f.code)?.[1];
    if (!coll) out.push({ line: 1, message: 'set `collection` explicitly (camelCase plural)' });
    else if (!/^[a-z][a-zA-Z0-9]*$/.test(coll)) out.push({ line: 1, message: `collection "${coll}" must be camelCase` });
    return out;
  },
};

export default [timestamps, strings, find, aggregate, matchFirst, rawInput, selectFalse, ttl, naming];
