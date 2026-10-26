const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/** Escapes text for HTML bodies and attribute values: every interpolated variable goes through this. */
export const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);

const DISCLAIMER =
    "SAMARTH AI is a prototype capstone product. It is not an official Government of India website.";

/**
 * Declares a template (rule 06: one `<name>.template.js` per mail, languages inside).
 * `required` variables must be non-empty strings; `links` are the variables that must be FRONTEND_URL links.
 * Each language function returns `{ subject, heading, paragraphs, action?: { label, url }, note? }`.
 * Only `en` exists today; the renderer falls back to it for other languages.
 */
export const defineTemplate = ({ key, required, links = [], ...languages }) =>
    Object.freeze({ key, required, links, languages });

/** Renders plain, tracking-free HTML plus the text alternative that security mails require (AUTH-49). */
export function renderLayout({
    subject,
    heading,
    paragraphs = [],
    action,
    note,
    lang = "en",
}) {
    const text = [
        heading,
        "",
        ...paragraphs,
        ...(action ? ["", `${action.label}: ${action.url}`] : []),
        ...(note ? ["", note] : []),
        "",
        DISCLAIMER,
    ].join("\n");

    const body = [
        `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>`,
        ...paragraphs.map(
            (paragraph) =>
                `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(paragraph)}</p>`
        ),
        ...(action
            ? [
                  `<p style="margin:16px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 16px;border:1px solid;border-radius:6px;text-decoration:none">${escapeHtml(action.label)}</a></p>`,
                  `<p style="margin:0 0 12px;font-size:13px;line-height:1.5">If the button does not work, copy this link into your browser:<br>${escapeHtml(action.url)}</p>`,
              ]
            : []),
        ...(note
            ? [
                  `<p style="margin:0 0 12px;font-size:13px;line-height:1.5">${escapeHtml(note)}</p>`,
              ]
            : []),
        `<p style="margin:24px 0 0;font-size:12px;line-height:1.5">${escapeHtml(DISCLAIMER)}</p>`,
    ].join("\n");

    const html = `<!doctype html>\n<html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px">\n${body}\n</body></html>`;
    return { html, text };
}
