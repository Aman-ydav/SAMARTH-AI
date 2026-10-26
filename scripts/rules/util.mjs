// Shared helpers for rule modules: comment/string masking, bracket matching, JSX tag scanning, check factory.
// Masking keeps offsets and newlines intact, so line numbers computed on masked text are valid for the raw text.

export const isTest = (rel) => /\.test\.[cm]?[jt]sx?$/.test(rel) || /(^|\/)(test|tests|mocks|__mocks__)\//.test(rel);

export function mask(src, { comments = true, strings = false, css = false } = {}) {
  let out = '';
  let i = 0;
  let q = '';
  const n = src.length;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (q) {
      if (c === '\\') {
        const s = src.slice(i, i + 2);
        out += strings ? blank(s) : s;
        i += 2;
      } else if (c === q || (c === '\n' && q !== '`')) {
        q = '';
        out += c;
        i++;
      } else {
        out += strings && c !== '\n' ? ' ' : c;
        i++;
      }
      continue;
    }
    if (comments && c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      out += blank(src.slice(i, end));
      i = end;
      continue;
    }
    if (comments && !css && c === '/' && d === '/') {
      let e = src.indexOf('\n', i);
      if (e < 0) e = n;
      out += ' '.repeat(e - i);
      i = e;
      continue;
    }
    if (c === '"' || c === "'" || (c === '`' && !css)) q = c;
    out += c;
    i++;
  }
  return out;
}

const CLOSE = { '(': ')', '{': '}', '[': ']' };
/** Index of the bracket matching the one at `i` (strings skipped), or -1. */
export function balanced(code, i) {
  const open = code[i];
  const close = CLOSE[open];
  if (!close) return -1;
  let depth = 0;
  let q = '';
  for (let k = i; k < code.length; k++) {
    const c = code[k];
    if (q) {
      if (c === '\\') k++;
      else if (c === q || (c === '\n' && q !== '`')) q = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return k;
  }
  return -1;
}

export const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

/** Every match of `re` (must end at an opening bracket) with its balanced body. */
export function calls(code, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out = [];
  let m;
  while ((m = g.exec(code))) {
    const open = m.index + m[0].length - 1;
    const end = balanced(code, open);
    out.push({ m, idx: m.index, line: lineOf(code, m.index), body: end < 0 ? code.slice(open) : code.slice(open, end + 1), open, end });
  }
  return out;
}

/** JSX/HTML opening tags: { name, attrs, idx, line }. Works on masked code. */
export function jsxTags(code) {
  const out = [];
  const re = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(code))) {
    if (/[\w)\]]/.test(code[m.index - 1] ?? '')) continue; // `a<b`: comparison/generic, not a tag
    let k = m.index + m[0].length;
    let depth = 0;
    let q = '';
    for (; k < code.length; k++) {
      const c = code[k];
      if (q) {
        if (c === q) q = '';
        continue;
      }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ name: m[1], attrs: code.slice(m.index + m[0].length, k), idx: m.index, line: lineOf(code, m.index) });
  }
  return out;
}

/** undefined if the attribute is absent, '' for bare/boolean, otherwise the raw value text. */
export function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}(?=[\\s=/>]|$)\\s*(=\\s*)?`).exec(attrs);
  if (!m) return undefined;
  if (!m[1]) return '';
  const rest = attrs.slice(m.index + m[0].length);
  const c = rest[0];
  if (c === '"' || c === "'") return rest.slice(1, rest.indexOf(c, 1));
  if (c === '{') return rest.slice(1, balanced(rest, 0));
  return '';
}

/** Factory for line-regex checks. patterns: [[regex, message, severity?]]. */
export function rx(id, rules, severity, globs, patterns, o = {}) {
  return {
    id,
    ruleIds: rules,
    severity,
    globs,
    desc: o.desc,
    run(file) {
      if (o.skip?.(file)) return [];
      const src = o.src === 'raw' ? file.text : o.src === 'nostr' ? file.nostr : file.code;
      if (src == null) return [];
      const out = [];
      src.split('\n').forEach((ln, i) => {
        if (o.lineSkip?.(ln)) return;
        for (const [re, message, sev] of patterns) if (re.test(ln)) out.push({ line: i + 1, message, severity: sev });
      });
      return out;
    },
  };
}

export const inSrc = (rel, prefix, re) => rel.startsWith(prefix) && (!re || re.test(rel));
export const FE = 'frontend/src/';
export const BE = 'backend/src/';
export const parseJson = (file) => {
  try {
    return JSON.parse(file.text);
  } catch {
    return null;
  }
};
/** dependency names (all sections) of a package.json file object. */
export function depNames(file) {
  const j = parseJson(file);
  if (!j) return [];
  return Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.peerDependencies, ...j.optionalDependencies });
}
/** Check factory for banned packages in imports and package.json. */
export function bannedPkgs(id, rules, severity, srcGlobs, pkgGlobs, nameRe, label, o = {}) {
  const imp = new RegExp(`(?:from\\s*|import\\s*\\(?\\s*|require\\(\\s*)['"](?:${nameRe})(?:/[^'"]*)?['"]`);
  return {
    id,
    ruleIds: rules,
    severity,
    globs: [...srcGlobs, ...pkgGlobs],
    desc: o.desc ?? `${label} imports or dependencies`,
    run(file) {
      if (file.base === 'package.json') {
        const re = new RegExp(`^(?:${nameRe})(?:/.*)?$`);
        return depNames(file).filter((d) => re.test(d)).map((d) => ({ line: 1, message: `${label}: dependency "${d}" is forbidden` }));
      }
      if (o.skip?.(file)) return [];
      return rx(id, rules, severity, [], [[imp, `${label}: forbidden import`]]).run(file);
    },
  };
}
