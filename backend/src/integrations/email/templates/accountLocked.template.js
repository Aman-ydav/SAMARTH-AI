import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const accountLockedTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.ACCOUNT_LOCKED,
    required: ["name", "unlockAt", "resetLink"],
    links: ["resetLink"],
    en: (d) => ({
        subject: "Your SAMARTH AI account is temporarily locked",
        heading: "Your account is temporarily locked",
        paragraphs: [
            `Hello ${d.name},`,
            `After several failed sign-in attempts your account is locked until ${d.unlockAt}.`,
        ],
        action: { label: "Reset your password", url: d.resetLink },
        note: "If this was not you, resetting your password is a good idea.",
    }),
});
