// ANIM group (rulebook 07). Reading notes:
//  - no-animated-layout-props looks inside animate/initial/whileX/exit/variants/style props and animate(...) calls; margin/padding are warnings.
//  - no-decorative-loop allows `motion-safe:animate-spin|pulse` (spinner/skeleton, UI-14) everywhere; bounce/ping and bare spin/pulse are errors
//    outside TickerMarquee.jsx, ui/skeleton.jsx, ui/spinner.jsx.
//  - no-manual-scroll-listener also flags overflow-hidden|auto|scroll on *Layout.jsx files (ANIM-25: sticky ancestors).
//  - below-fold-sections-lazy: on marketing pages only Hero*, *Nav*, LazySection, ScrollProgressBar and *Layout may be imported statically;
//    "pinned" components counted = ZoomScrollSection, StickyScrollStory, SpiralCards3D, HorizontalScrollGallery, ScrollMedia, ScrollRotate.
import { rx, bannedPkgs, isTest, calls, jsxTags, FE } from './util.mjs';
import { combine } from './frontend.mjs';
import { GRADIENT, BLUR, GLOW, COLOR } from './ui.mjs';

const SRC = [`${FE}**/*.{js,jsx}`];
const MOTION = [`${FE}components/motion/**`, `${FE}features/marketing/**`, `${FE}features/auth/**`];
const AUTHLAYOUT = `${FE}components/layout/AuthSplitLayout.jsx`;
const MOTION_PKG = 'framer-motion|framer';
const OTHER_ANIM = 'gsap|@gsap|scrolltrigger|aos|animejs|anime\\.js|react-spring|@react-spring|lottie-web|lottie-react|@lottiefiles|react-transition-group|locomotive-scroll|scrollreveal|react-intersection-observer|react-fast-marquee|typed\\.js|react-typed|three|@react-three|@use-gesture|popmotion|react-reveal|react-awesome-reveal|wow\\.js|animate\\.css';
const notTest = (f) => isTest(f.rel);

const legacy = combine(
  bannedPkgs('no-framer-motion-legacy-import', ['ANIM-03', 'ANIM-04'], 'error', SRC, ['frontend/package.json'], MOTION_PKG, 'legacy Framer package (use "motion" and motion/react)', { skip: notTest }),
  rx('no-framer-motion-legacy-import', ['ANIM-03'], 'error', SRC, [
    [/from\s*['"]motion(?:\/(?!react['"])[^'"]*)?['"]/, 'import Motion only from "motion/react"'],
  ], { skip: notTest }),
);

const guard = {
  id: 'motion-reduced-motion-guard', ruleIds: ['ANIM-20', 'ANIM-44'], severity: 'error', globs: [`${FE}components/motion/*.jsx`],
  desc: 'motion components honour reduced motion and have a co-located test',
  run(f, project) {
    if (notTest(f)) return [];
    const out = [];
    if (/from\s*['"]motion\/react['"]/.test(f.code) && !/useReducedMotion|useMotionTier/.test(f.code)) out.push({ line: 1, message: 'imports motion/react without useReducedMotion or useMotionTier (static final state required)' });
    if (!project.has(f.rel.replace(/\.jsx$/, '.test.jsx'))) out.push({ line: 1, message: `missing co-located ${f.base.replace(/\.jsx$/, '.test.jsx')} (render the reduced-motion branch)` });
    return out;
  },
};

const LAYOUT_KEYS = 'width|height|top|left|right|bottom|inset|fontSize|borderRadius|boxShadow|backgroundPosition|minHeight|maxHeight|minWidth|maxWidth|lineHeight|letterSpacing|gap|flexBasis';
const layoutProps = {
  id: 'no-animated-layout-props', ruleIds: ['ANIM-70'], severity: 'error', globs: MOTION,
  desc: 'only transform and opacity may be animated',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    const regions = [
      ...calls(f.code, /\b(?:animate|initial|whileInView|whileHover|whileTap|whileFocus|whileDrag|exit|style|variants)\s*[=:]\s*\{/),
      ...calls(f.code, /\banimate\s*\(/),
    ];
    const key = new RegExp(`(?<![\\w$.'"-])(${LAYOUT_KEYS}|margin\\w*|padding\\w*)\\s*:`, 'g');
    const seen = new Set();
    for (const r of regions) {
      for (const m of r.body.matchAll(key)) {
        const line = r.line + r.body.slice(0, m.index).split('\n').length - 1;
        const id = `${line}:${m[1]}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ line, severity: /^(?:margin|padding)/.test(m[1]) ? 'warn' : 'error', message: `animating/styling "${m[1]}" triggers layout: animate transform and opacity only` });
      }
    }
    return out;
  },
};

const allowed = (rel) => [`${FE}components/motion/`, `${FE}hooks/useMotionTier.js`, `${FE}features/marketing/`, `${FE}features/auth/`, `${FE}app/providers/`].some((p) => rel.startsWith(p));
const importScope = combine(
  rx('motion-import-scope', ['ANIM-05'], 'error', SRC, [[/from\s*['"](?:motion\/react|motion|lenis(?:\/react)?)['"]/, 'motion/lenis may only be imported in components/motion, marketing, auth, app/providers, hooks/useMotionTier']], { skip: (f) => notTest(f) || allowed(f.rel) }),
  rx('motion-import-scope', ['ANIM-06'], 'error', SRC, [[/from\s*['"]lenis(?:\/react)?['"]/, 'lenis is imported only inside SmoothScrollProvider.jsx']], { skip: (f) => notTest(f) || f.rel === `${FE}components/motion/SmoothScrollProvider.jsx` }),
);

const scroll = combine(
  rx('no-manual-scroll-listener', ['ANIM-08', 'ANIM-24'], 'error', [`${FE}components/motion/**/*.{js,jsx}`, `${FE}features/marketing/**/*.{js,jsx}`, `${FE}features/auth/**/*.{js,jsx}`], [
    [/addEventListener\(\s*['"](?:scroll|wheel|touchmove|touchstart|mousewheel)['"]/, 'use useScroll/useInView/useLenis instead of scroll listeners'],
    [/\bon(?:Scroll|Wheel|TouchMove)\s*=/, 'scroll handlers are hand-rolled scroll plumbing'],
    [/new\s+IntersectionObserver\b/, 'use useInView instead of IntersectionObserver'],
    [/passive\s*:\s*false|(?:wheel|touchmove)[^\n]*preventDefault|preventDefault[^\n]*(?:wheel|touchmove)/, 'scroll-jacking is banned'],
    [/snap-mandatory|scroll-snap-type[^;\n]*mandatory/, 'mandatory scroll-snap is banned'],
  ], { skip: notTest }),
  rx('no-manual-scroll-listener', ['ANIM-25'], 'error', [`${FE}**/*Layout.jsx`], [[/\boverflow(?:-[xy])?-(?:hidden|auto|scroll)\b/, 'overflow on a layout ancestor disables position: sticky (use overflow-clip inside the stage)']], { skip: notTest }),
  {
    id: 'no-manual-scroll-listener', ruleIds: ['ANIM-25'], severity: 'error', globs: [`${FE}index.css`],
    run: (f) => [...f.code.matchAll(/(?:html|body|#root)\b[^{}]*\{[^}]*\boverflow(?:-[xy])?\s*:\s*(?:hidden|auto|scroll)/g)].map((m) => ({ line: f.code.slice(0, m.index).split('\n').length, message: 'overflow on html/body/#root disables position: sticky' })),
  },
);

const loops = rx('no-decorative-loop', ['ANIM-09', 'UI-14'], 'error', [`${FE}**/*.{js,jsx,css}`], [
  [/repeat\s*:\s*Infinity/, 'infinite animation: only the ticker may loop'],
  [/animate-(?:bounce|ping)\b/, 'decorative animation (bounce/ping) is banned'],
  [/(?<!motion-safe:)(?<![\w-])animate-(?:pulse|spin)\b/, 'use motion-safe:animate-spin|pulse (reduced motion)'],
  [/animation(?:-iteration-count)?\s*:[^;]*\binfinite\b/, 'infinite CSS animation'],
], { skip: (f) => notTest(f) || /(?:TickerMarquee\.jsx|ui\/skeleton\.jsx|ui\/spinner\.jsx)$/.test(f.rel), lineSkip: (l) => /ticker|marquee|skeleton/i.test(l) });

const HEX_FP = /href|\bto=|hash|querySelector|getElementById|#!|url\(#|aria-|\bid=|htmlFor/;
const marketingFlat = rx('no-gradient-or-glow-in-marketing', ['ANIM-62', 'UI-40'], 'error', [`${FE}components/motion/**/*.{js,jsx,css}`, `${FE}features/marketing/**/*.{js,jsx,css}`, `${FE}features/auth/**/*.{js,jsx,css}`, AUTHLAYOUT], [
  ...GRADIENT, ...BLUR, ...GLOW, ...COLOR, [/(?<![\w-])shadow-\[/, 'custom shadow'],
], { skip: notTest, lineSkip: (l) => HEX_FP.test(l) });

const hero = {
  id: 'hero-required-parts', ruleIds: ['ANIM-60'], severity: 'error', globs: [`${FE}features/marketing/components/HeroSection.jsx`],
  desc: 'hero contains TextReveal, TickerMarquee, ZoomScrollSection',
  run: (f) => ['TextReveal', 'TickerMarquee', 'ZoomScrollSection'].filter((n) => !new RegExp(`<${n}\\b`).test(f.code)).map((n) => ({ line: 1, message: `HeroSection is missing <${n}>` })),
};

const PINNED = /^(?:ZoomScrollSection|StickyScrollStory|SpiralCards3D|HorizontalScrollGallery|ScrollMedia|ScrollRotate)$/;
const lazy = {
  id: 'below-fold-sections-lazy', ruleIds: ['ANIM-77', 'ANIM-52'], severity: 'error', globs: [`${FE}features/marketing/pages/*.jsx`],
  desc: 'only hero/nav are static on Landing/About; at most 5 pinned components',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    for (const m of f.code.matchAll(/^\s*import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"][^'"]*\/(\w+)['"]/gm)) {
      const name = m[1];
      if (/Section$|Story$|Gallery$|Spiral|Wheel|Tour|Faq|Trust|Roles/i.test(name) && !/^Hero|Nav|^LazySection$|ScrollProgress|Layout$/.test(name)) out.push({ line: f.code.slice(0, m.index).split('\n').length, message: `${name} must load through LazySection (React.lazy), not a static import` });
    }
    const pinned = new Set(jsxTags(f.code).filter((t) => PINNED.test(t.name)).map((t) => t.name));
    if (pinned.size > 5) out.push({ line: 1, message: `${pinned.size} pinned components on one page (max 5)` });
    return out;
  },
};

const AUTH_OK = new Set(['Reveal', 'TextReveal', 'TickerMarquee']);
const authAllow = {
  id: 'auth-motion-allowlist', ruleIds: ['ANIM-54'], severity: 'error', globs: [`${FE}features/auth/**/*.jsx`, AUTHLAYOUT],
  desc: 'auth pages use only Reveal, TextReveal, TickerMarquee',
  run(f) {
    if (notTest(f)) return [];
    return [...f.code.matchAll(/components\/motion\/(\w+)/g)].filter((m) => !AUTH_OK.has(m[1])).map((m) => ({ line: f.code.slice(0, m.index).split('\n').length, message: `${m[1]} is not allowed on auth pages (Reveal, TextReveal, TickerMarquee only)` }));
  },
};

const FONTS = ['fraunces', 'instrument-sans', 'jetbrains-mono', 'noto-sans-devanagari'];
const fonts = {
  id: 'font-package-allowlist', ruleIds: ['ANIM-90', 'ANIM-91', 'ANIM-92', 'ANIM-94'], severity: 'error',
  globs: ['frontend/package.json', 'frontend/index.html', `${FE}**/*.{js,jsx,css}`],
  desc: 'four Fontsource variable packages only; no Google Fonts, italics, font-serif, font-[..], text-[..] sizes',
  run(f) {
    if (notTest(f)) return [];
    const out = [];
    if (f.base === 'package.json') {
      let deps = [];
      try { deps = Object.keys({ ...JSON.parse(f.text).dependencies, ...JSON.parse(f.text).devDependencies }); } catch { /* not JSON */ }
      for (const d of deps) {
        const m = /^@fontsource-variable\/(.+)$/.exec(d);
        if (/^(?:@fontsource\/|typeface-|webfontloader$)/.test(d) || (m && !FONTS.includes(m[1]))) out.push({ line: 1, message: `font package "${d}" is not allowed (Fraunces, Instrument Sans, JetBrains Mono, Noto Sans Devanagari only)` });
      }
      return out;
    }
    const isCss = f.rel === `${FE}index.css`;
    f.code.split('\n').forEach((ln, i) => {
      const add = (message) => out.push({ line: i + 1, message });
      if (/fonts\.(?:googleapis|gstatic)\.com/.test(ln)) add('Google Fonts / CDN fonts are banned: self-host via Fontsource');
      for (const m of ln.matchAll(/@fontsource[\w-]*(?:\/([\w-]+))?/g)) {
        if (!/^@fontsource-variable$/.test(m[0].split('/')[0]) || !FONTS.includes(m[1])) add(`font import "${m[0]}" is not one of the four allowed families`);
        else if (!isCss && f.ext !== 'html') add('import fonts once, in index.css');
      }
      if (/@fontsource.*italic|\/(?:[\w-]+-)?italic\.css/.test(ln)) add('italic font files are not shipped');
      if (/(?<![\w-])font-serif\b|(?<![\w-])font-\[/.test(ln)) add('use font-display / font-sans / font-mono only');
      if (!isCss && /\bfont-family\s*:|\bfontFamily\s*:/.test(ln)) add('font-family literals belong in index.css @theme');
      if (/(?<![\w-])text-\[\s*[\d.]+(?:px|rem|em|vw|%)?\s*\]/.test(ln)) add('arbitrary text size: use the text-* scale tokens');
      if (/font-variation-settings[^\n]*(?:SOFT|WONK)|['"](?:SOFT|WONK)['"]/.test(ln)) add('SOFT/WONK axes are not in the shipped Fraunces file');
      if (/font-display/.test(ln) && /(?<![\w-])italic\b/.test(ln)) add('no italics with font-display');
    });
    return out;
  },
};

export default [
  legacy,
  combine(
    bannedPkgs('no-other-animation-libs', ['ANIM-02'], 'error', SRC, ['frontend/package.json'], OTHER_ANIM, 'banned animation library', { skip: notTest }),
  ),
  guard, layoutProps, importScope, scroll, loops, marketingFlat, hero, lazy, authAllow,
  rx('no-char-split', ['ANIM-30'], 'error', [`${FE}components/motion/**/*.{js,jsx}`, `${FE}features/marketing/**/*.{js,jsx}`], [
    [/\.split\(\s*(['"`])\1\s*\)/, 'split text by words, never characters (breaks Devanagari)'],
    [/\[\s*\.\.\.\s*(?:text|title|str|string|label|content|children|word|headline|copy|value|line)\w*\s*\]|Array\.from\(\s*(?:text|title|str|string|label|content|children|word|headline|copy|value|line)\w*\s*[,)]/, 'spreading a string splits characters: use words'],
  ], { skip: notTest }),
  fonts,
];
