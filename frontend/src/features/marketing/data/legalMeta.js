/*
 * Metadata for the Privacy Policy and Terms of Use (docs/23 section 5). Copy lives in the `legal` i18n namespace;
 * this file holds only the facts that are not translated: version, dates, anchor ids and clearly flagged
 * placeholders. Placeholders are NOT real values. The team replaces them before launch (docs/23 section 8, items 1, 5, 7).
 */

/** Stored with each user's consent record (docs/23 section 5). */
export const LEGAL_VERSION = "2026-10-26-draft-0.1";

/** ISO date of the last edit of both documents. */
export const LEGAL_LAST_UPDATED = "2026-10-26";

/** Values interpolated into the legal copy. Square brackets mark an unfilled placeholder. */
export const LEGAL_PLACEHOLDERS = Object.freeze({
    supportEmail: "[SUPPORT_EMAIL: placeholder]",
    grievanceName: "[GRIEVANCE_OFFICER_NAME: placeholder]",
    grievanceEmail: "[GRIEVANCE_EMAIL: placeholder]",
    llmProvider: "[LLM_PROVIDER: placeholder]",
    dataRegion: "[DATA_REGION: placeholder]",
    licence: "[LICENCE: placeholder]",
    jurisdictionCity: "[JURISDICTION_CITY: placeholder]",
});

/** Stable anchor ids, in reading order. Deep links such as /privacy#cookies rely on them (docs/23 section 5). */
export const PRIVACY_SECTIONS = Object.freeze([
    { id: "overview", key: "overview" },
    { id: "who-we-are", key: "whoWeAre" },
    { id: "data-we-collect", key: "dataWeCollect" },
    { id: "purposes-and-consent", key: "purposesAndConsent" },
    { id: "cookies", key: "cookies" },
    { id: "processors", key: "processors" },
    { id: "ai", key: "ai" },
    { id: "retention", key: "retention" },
    { id: "security", key: "security" },
    { id: "your-rights", key: "yourRights" },
    { id: "grievance", key: "grievance" },
    { id: "children", key: "children" },
    { id: "transfers", key: "transfers" },
    { id: "changes", key: "changes" },
]);

export const TERMS_SECTIONS = Object.freeze([
    { id: "acceptance", key: "acceptance" },
    { id: "prototype", key: "prototype" },
    { id: "accounts", key: "accounts" },
    { id: "acceptable-use", key: "acceptableUse" },
    { id: "your-content", key: "yourContent" },
    { id: "ai-output", key: "aiOutput" },
    { id: "third-party", key: "thirdParty" },
    { id: "ip", key: "ip" },
    { id: "availability", key: "availability" },
    { id: "liability", key: "liability" },
    { id: "termination", key: "termination" },
    { id: "governing-law", key: "governingLaw" },
    { id: "changes", key: "changes" },
]);
