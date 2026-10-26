import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const alreadyRegisteredTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.ALREADY_REGISTERED,
    required: ["name", "loginLink", "resetLink"],
    links: ["loginLink", "resetLink"],
    en: (d) => ({
        subject: "You already have a SAMARTH AI account",
        heading: "You already have an account",
        paragraphs: [
            `Hello ${d.name},`,
            "Someone tried to register this email address, but it already has a SAMARTH AI account. You can sign in instead.",
            `If you forgot your password, you can reset it here: ${d.resetLink}`,
        ],
        action: { label: "Sign in", url: d.loginLink },
        note: "If this was not you, you can ignore this email. Nothing has changed on your account.",
    }),
});
