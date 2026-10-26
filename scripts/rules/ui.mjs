// UI group (rulebook 01). Heuristic reading notes:
//  - Colour hex literals ignore lines that look like URL fragments / anchors (href, to=, hash, querySelector); 3-4 digit hex needs a digit.
//  - Gradient colour stops (from-/via-/to-) only count when followed by a colour-ish token, to avoid "to-do" style text.
//  - shadow-xs/2xs are flagged with shadow-lg/xl/2xl/inner because UI-12 allows only shadow-sm and shadow-md.
//  - shadcn components/ui files are checked like any other file (UI-21 requires them to be re-themed).
import { rx, bannedPkgs, isTest, depNames, FE } from './util.mjs';

const SRC = ['frontend/src/**/*.{js,jsx}'];
const SRC_CSS = ['frontend/src/**/*.{js,jsx,css}'];
const PAL = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const SEM = 'primary|secondary|accent|muted|background|foreground|card|popover|destructive|success|warning|info|border|input|ring|transparent|current|black|white';
const notIndexCss = (f) => f.rel === `${FE}index.css`;
const notIndexOrTest = (f) => notIndexCss(f) || isTest(f.rel) || f.ext === 'svg';

export const GRADIENT = [
  [/(?<![\w-])(?:[\w-]+:)*bg-(?:gradient|linear|radial|conic)-/, 'gradient utility (flat design: no gradients)'],
  [new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:from|via|to)-(?:${SEM}|${PAL}|\\[|\\d+%)`), 'gradient colour stop'],
  [/(?:linear|radial|conic)-gradient\s*\(/, 'CSS gradient'],
];
export const BLUR = [[/backdrop-(?:blur|filter|saturate|brightness)|(?<![\w])blur-|backdrop-filter\s*:|filter\s*:\s*blur/, 'blur / backdrop-blur / glass effect is banned']];
export const GLOW = [
  [/drop-shadow|text-shadow|textShadow/, 'drop-shadow / text-shadow is banned'],
  [/(?<![\w-])(?:[\w-]+:)*shadow-(?:lg|xl|2xl|xs|2xs|inner)\b/, 'only shadow-sm and shadow-md are allowed'],
  [new RegExp(`(?<![\\w-])(?:[\\w-]+:)*shadow-(?:\\[|(?:${SEM}|${PAL})\\b)`), 'coloured / arbitrary shadow'],
];
export const COLOR = [
  [/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![\w-])/, 'hex colour literal outside index.css'],
  [/#(?=[0-9a-fA-F]*\d)[0-9a-fA-F]{3,4}(?![\w-])/, 'hex colour literal outside index.css'],
  [/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/, 'colour function outside index.css'],
  [/(?:\b(?:color|backgroundColor|borderColor|fill|stroke|background)\s*[:=]\s*)['"](?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|teal|cyan|navy|brown|crimson|gold|silver)['"]/, 'named colour in style'],
];
const hexFalsePositive = /href|\bto=|hash|querySelector|getElementById|#!|url\(#|aria-|\bid=|htmlFor/;
const colorCheck = rx('no-color-literal-outside-index-css', ['UI-01'], 'error', SRC_CSS, COLOR, { skip: notIndexOrTest, lineSkip: (l) => hexFalsePositive.test(l) });

const REGISTRY = `${FE}components/icons/index.js`;
const BANNED_ICON_PKG = '@heroicons|@tabler|@phosphor-icons|@remixicon|@fortawesome|lucide|lucide-react|react-feather|@iconify|bootstrap-icons|@mui/icons-material|@ant-design/icons';
const BANNED_UI = '@mui|@chakra-ui|antd|@mantine|@headlessui|daisyui|react-select|react-toastify|react-hot-toast|react-modal|@material-ui|react-bootstrap|semantic-ui-react|@nextui-org|@blueprintjs';

const registryCheck = {
  id: 'icons-filled-only',
  ruleIds: ['UI-30', 'UI-31'],
  severity: 'error',
  globs: [REGISTRY],
  desc: 'icon registry: only react-icons/ri|md|fa6|fc, filled variants',
  run(file) {
    const out = [];
    const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(file.code))) {
      const line = file.code.slice(0, m.index).split('\n').length;
      const pkg = m[2];
      if (!/^react-icons\/(?:ri|md|fa6|fc)$/.test(pkg)) {
        out.push({ line, message: `icon package "${pkg}" not allowed (only react-icons/ri, md, fa6, fc)` });
        continue;
      }
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0];
        if (!name) continue;
        const bad =
          (pkg.endsWith('/ri') && !/Fill$/.test(name) && 'Remix icon must end in Fill') ||
          (/Outline|Outlined|TwoTone|Sharp|Line$/.test(name) && 'outline/line variant') ||
          (/^FaReg/.test(name) && 'FaReg* is the regular (outline) set') ||
          (pkg.endsWith('/fc') && name !== 'FcGoogle' && 'only FcGoogle is allowed from react-icons/fc');
        if (bad) out.push({ line, message: `${name}: ${bad} (filled glyphs only)` });
      }
    }
    return out;
  },
};

const shadcn = bannedPkgs('ui-components-from-shadcn', ['UI-20'], 'error', SRC, ['frontend/package.json'], BANNED_UI, 'non-shadcn UI library');
const rawTags = rx('ui-components-from-shadcn', ['UI-20'], 'warn', [], [[/<(?:button|dialog|select)[\s>]/, 'raw <button>/<dialog>/<select> in a feature: use the shadcn component']], {
  skip: (f) => !/^frontend\/src\/features\//.test(f.rel) || f.ext !== 'jsx' || isTest(f.rel),
});
const shadcnRun = shadcn.run;
shadcn.run = (f) => [...shadcnRun(f), ...rawTags.run(f)];
shadcn.globs = [...SRC, 'frontend/package.json'];

const boxShadow = rx('no-glow-shadow', ['UI-12'], 'error', [], [[/box-?[sS]hadow\s*:/, 'box-shadow outside index.css (use shadow-sm / shadow-md tokens)']], { skip: notIndexOrTest });
const glow = rx('no-glow-shadow', ['UI-40', 'UI-12'], 'error', [], GLOW);
const glowRun = (f) => [...glow.run(f), ...boxShadow.run(f)];

export default [
  bannedPkgs('no-lucide-import', ['UI-21', 'FE-04', 'FE-96'], 'error', SRC, ['frontend/package.json'], 'lucide(?:-react)?', 'lucide icons'),
  rx('no-gradient', ['UI-40'], 'error', SRC_CSS, GRADIENT),
  { ...rx('no-glow-shadow', ['UI-40', 'UI-12'], 'error', SRC_CSS, GLOW), run: glowRun },
  colorCheck,
  rx('no-tailwind-default-palette', ['UI-04'], 'error', SRC, [
    [new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|shadow|from|via|to|accent|caret)-(?:${PAL}|white|black)(?![\\w-])`), 'Tailwind default palette colour: use a semantic token'],
    [/(?<![\w-])(?:[\w-]+:)*(?:bg|text|border|ring|fill|stroke|divide|outline|decoration|from|via|to)-(?:primary|secondary|neutral|success|warning|destructive|info)-\d{2,3}(?![\w-])/, 'colour scale step used as utility: use a semantic token'],
  ]),
  rx('no-arbitrary-color', ['UI-04', 'UI-51'], 'error', SRC, [
    [/(?<![\w-])(?:[\w-]+:)*(?:bg|text|border|ring|fill|stroke|from|via|to)-\[[^\]]*(?:#|rgb|hsl|oklch|var\(--)/, 'arbitrary colour value'],
    [/(?<![\w-])dark:(?:bg|text|border|ring)-/, 'dark: colour utility (dark mode must work through tokens)', 'warn'],
  ]),
  rx('no-backdrop-blur', ['UI-40'], 'error', SRC_CSS, BLUR),
  rx('icons-from-registry-only', ['UI-31', 'FE-96'], 'error', SRC, [
    [/from\s*['"]react-icons(?:\/[^'"]*)?['"]/, 'import react-icons only in components/icons/index.js, then use @/components/icons'],
    [new RegExp(`from\\s*['"](?:${BANNED_ICON_PKG})(?:/[^'"]*)?['"]`), 'forbidden icon library'],
  ], { skip: (f) => f.rel === REGISTRY }),
  registryCheck,
  shadcn,
  { id: 'ui-deps-guard', ruleIds: ['UI-20'], severity: 'error', globs: ['frontend/package.json'], desc: 'frontend/package.json icon libraries',
    run: (f) => depNames(f).filter((d) => new RegExp(`^(?:${BANNED_ICON_PKG})(?:/.*)?$`).test(d) && !/lucide/.test(d)).map((d) => ({ line: 1, message: `icon library "${d}" is forbidden (react-icons only)` })) },
];
