import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const googleLinkedTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.GOOGLE_LINKED,
    required: ["name", "at"],
    en: (d) => ({
        subject: "Google sign-in linked to your account",
        heading: "Google sign-in was linked",
        paragraphs: [
            `Hello ${d.name},`,
            `A Google account was linked to your SAMARTH AI account at ${d.at}. You can now sign in with Google or with your password.`,
        ],
        note:
            d.unlinkHelp ??
            "If this was not you, change your password and unlink Google from your account settings.",
    }),
});
