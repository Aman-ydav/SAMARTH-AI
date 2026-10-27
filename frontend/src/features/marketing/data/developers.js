/*
 * THE DEVELOPERS OF SAMARTH AI: the one file to edit when the real details are known (docs/23 section 4 and 8).
 *
 * To replace a placeholder card, change these fields of its entry and nothing else:
 *   name      the person's name, plain text (not translated)
 *   role      what they built, one short line: a string, or { en: "...", hi: "..." } for both languages
 *   note      a one-line note about them, same shape as `role`
 *   github    full https URL of the profile, or "" to show no link
 *   linkedin  full https URL of the profile, or "" to show no link
 *   placeholder  set to false once name, role and note are real (removes the "Placeholder" badge)
 * The avatar comes from the media slot in `slot` (frontend/src/assets/mediaManifest.js, `about.team.m1` to `m6`):
 * upload a portrait to Cloudinary (with the person's consent), put its public id in the manifest and remove that
 * slot's `placeholder` flag. Until then the card shows initials. Never add a photo, name or quote that is not theirs.
 *
 * The role texts below are the six ownership areas of the project plan (doc 11 and doc 13), not statements about a
 * real person: they stay until the owner writes the real line.
 */

const placeholderNote = Object.freeze({
    en: "One-line note to be added.",
    hi: "एक पंक्ति का परिचय जोड़ा जाना है।",
});

const entry = (index, role) =>
    Object.freeze({
        id: `dev${index}`,
        slot: `about.team.m${index}`,
        name: `Developer ${index}`,
        placeholder: true,
        role: Object.freeze(role),
        note: placeholderNote,
        github: "",
        linkedin: "",
    });

export const DEVELOPERS = Object.freeze([
    entry(1, { en: "Backend core and security", hi: "बैकएंड कोर और सुरक्षा" }),
    entry(2, { en: "Assessment engine", hi: "आकलन इंजन" }),
    entry(3, {
        en: "Competency and recommendation",
        hi: "दक्षता और सिफ़ारिश",
    }),
    entry(4, {
        en: "Frontend lead, learner experience",
        hi: "फ़्रंटएंड प्रमुख, शिक्षार्थी अनुभव",
    }),
    entry(5, {
        en: "Admin and trainer UI, data visualisation",
        hi: "प्रशासक और प्रशिक्षक UI, डेटा विज़ुअलाइज़ेशन",
    }),
    entry(6, {
        en: "Integration, DevOps and QA",
        hi: "इंटीग्रेशन, DevOps और QA",
    }),
]);

/** Picks the text for a language from a string or an `{ en, hi }` object; falls back to English, then to "". */
export function localizedText(value, language) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object")
        return value[language] ?? value.en ?? "";
    return "";
}

/** Up to two initials from the first letters of the first two words (code points, so Devanagari stays whole). */
export function getInitials(name) {
    const words = typeof name === "string" ? name.trim().split(/\s+/) : [];
    return words
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => String.fromCodePoint(word.codePointAt(0)).toUpperCase())
        .join("");
}
