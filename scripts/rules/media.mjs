// MEDIA group (rulebook 10, plus img-has-alt shared with rule 09). Reading notes:
//  - no-hardcoded-cloudinary-url exempts frontend components/media/ and backend integrations/cloudinary/: the components and the SDK
//    adapter must build delivery URLs from the cloud name (MEDIA-21); nobody else may.
//  - cloudinary-folder-env-prefixed: a plain string `folder:` is an error everywhere; a template containing `samarth-ai/` is allowed only in
//    integrations/cloudinary/ (the env-prefix helper); `roomezy` next to Cloudinary code is an error.
//  - img-has-alt: <img>/<CloudinaryImage> need alt; empty alt only with `decorative` (or aria-hidden/role="presentation" on <img>);
//    a CloudinaryImage given `slot=` takes alt from mediaManifest (MEDIA-30) and a {...spread} is trusted.
//  - no-large-binary-in-repo: media/archive files over 200 KB, any media under public/ except favicon.*, SVG over 20 KB in public/ or src/assets/.
import { rx, isTest, jsxTags, attr, BE, FE } from './util.mjs';

const BE_SRC = [`${BE}**/*.js`];
const INTEGRATION = `${BE}integrations/cloudinary/`;
const MEDIA_EXT = /\.(?:png|jpe?g|webp|gif|avif|ico|mp4|webm|mov|mp3|wav|zip|rar|7z|tar|gz|tgz)$/i;

const cloudinaryOnly = rx('cloudinary-only-in-integration', ['MEDIA-03', 'MEDIA-01'], 'error', BE_SRC, [
  [/from\s*['"]cloudinary['"]|require\(\s*['"]cloudinary['"]\)|multer-storage-cloudinary/, 'import the Cloudinary SDK only inside integrations/cloudinary/'],
  [/\bcloudinary\s*\.\s*(?:v2\s*\.\s*)?config\s*\(/, 'cloudinary.config only inside integrations/cloudinary/'],
  [/CLOUDINARY_[A-Z_]+/, 'CLOUDINARY_* is read only in config/env.js and the integration'],
], { skip: (f) => isTest(f.rel) || f.rel.startsWith(INTEGRATION) || f.rel === `${BE}config/env.js` });

const hardUrl = rx('no-hardcoded-cloudinary-url', ['MEDIA-20', 'MEDIA-14'], 'error', [`${FE}**/*.{js,jsx}`, ...BE_SRC], [
  [/res\.cloudinary\.com|cloudinary\.com\//, 'build media URLs with CloudinaryImage/CloudinaryVideo (publicId + transformations)'],
], { skip: (f) => isTest(f.rel) || f.rel.startsWith(`${FE}components/media/`) || f.rel.startsWith(INTEGRATION) });

const binary = {
  id: 'no-large-binary-in-repo', ruleIds: ['MEDIA-25', 'FS-07'], severity: 'error', globs: ['**'], paths: true,
  desc: 'media/archives over 200 KB, media in public/ beyond favicons, SVG over 20 KB',
  run(f) {
    if (f.rel.startsWith('../') || /(^|\/)node_modules\//.test(f.rel)) return [];
    const inPublic = /(^|\/)public\//.test(f.rel);
    const isSvg = /\.svg$/i.test(f.rel);
    const out = [];
    if (MEDIA_EXT.test(f.rel)) {
      const kb = Math.round(f.size / 1024);
      if (f.size > 200 * 1024) out.push({ line: 1, message: `${kb} KB binary in the repo (max 200 KB): upload to Cloudinary` });
      if (inPublic && !/(^|\/)favicon\.(?:svg|ico|png)$/.test(f.rel)) out.push({ line: 1, message: 'media under public/ is limited to favicons: use Cloudinary' });
    }
    if (isSvg && (inPublic || /src\/assets\//.test(f.rel)) && f.size > 20 * 1024) out.push({ line: 1, message: `SVG is ${Math.round(f.size / 1024)} KB (max 20 KB): optimise or host on Cloudinary` });
    return out;
  },
};

const alt = {
  id: 'img-has-alt', ruleIds: ['MEDIA-21', 'FE-95'], severity: 'error', globs: [`${FE}**/*.jsx`],
  desc: 'img / CloudinaryImage need alt (empty only when decorative)',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    for (const t of jsxTags(f.code)) {
      const cld = t.name === 'CloudinaryImage';
      if (t.name !== 'img' && !cld) continue;
      if (/\{\s*\.\.\./.test(t.attrs)) continue;
      const a = attr(t.attrs, 'alt');
      const decorative = attr(t.attrs, 'decorative') !== undefined || (!cld && (attr(t.attrs, 'aria-hidden') !== undefined || /presentation|none/.test(attr(t.attrs, 'role') ?? '')));
      if (cld && attr(t.attrs, 'slot') !== undefined) continue;
      if (a === undefined && !decorative) out.push({ line: t.line, message: `<${t.name}> has no alt text (or the decorative prop)` });
      else if (a === '' && !decorative) out.push({ line: t.line, message: `<${t.name}> has empty alt without decorative` });
    }
    return out;
  },
};

const folder = {
  id: 'cloudinary-folder-env-prefixed', ruleIds: ['MEDIA-04'], severity: 'error', globs: BE_SRC,
  desc: 'upload/sign folders come from the env-prefix helper, never literals',
  run(f) {
    if (isTest(f.rel)) return [];
    const out = [];
    const cld = /cloudinary/i.test(f.code);
    f.code.split('\n').forEach((ln, i) => {
      const add = (message) => out.push({ line: i + 1, message });
      if (cld && /folder\s*:\s*(['"])[^'"]*\1/.test(ln)) add('literal Cloudinary folder: build it with the env-prefix helper (samarth-ai/{env}/{kind})');
      if (!f.rel.startsWith(INTEGRATION) && /folder\s*:\s*`[^`]*samarth-ai\//.test(ln)) add('hand-built folder path: use the env-prefix helper');
      if (cld && /roomezy/i.test(ln)) add('"roomezy" folder from the old project');
    });
    return out;
  },
};

export default [cloudinaryOnly, hardUrl, binary, alt, folder];
