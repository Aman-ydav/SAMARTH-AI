import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const passwordChangedTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.PASSWORD_CHANGED,
    required: ["name", "changedAt", "resetLink"],
    links: ["resetLink"],
    en: (d) => ({
        subject: "Your SAMARTH AI password was changed",
        heading: "Your password was changed",
        paragraphs: [
            `Hello ${d.name},`,
            `The password for your SAMARTH AI account was changed at ${d.changedAt}. Other devices were signed out.`,
        ],
        action: { label: "This was not me: reset password", url: d.resetLink },
        note: "If you made this change, no action is needed.",
    }),
});
