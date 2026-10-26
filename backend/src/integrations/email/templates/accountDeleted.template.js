import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const accountDeletedTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.ACCOUNT_DELETED,
    required: ["name", "deletedAt"],
    en: (d) => ({
        subject: "Your SAMARTH AI account was deleted",
        heading: "Your account was deleted",
        paragraphs: [
            `Hello ${d.name},`,
            `Your SAMARTH AI account was deleted at ${d.deletedAt} and your personal data was anonymised.`,
        ],
        note: "This is the last email you will receive from us about this account.",
    }),
});
