import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const deactivationConfirmTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.DEACTIVATION_CONFIRM,
    required: ["name", "graceEndsAt", "link"],
    links: ["link"],
    en: (d) => ({
        subject: "Your SAMARTH AI account was deactivated",
        heading: "Your account was deactivated",
        paragraphs: [
            `Hello ${d.name},`,
            `Your account is deactivated. You can reactivate it by signing in until ${d.graceEndsAt}.`,
        ],
        action: { label: "Reactivate my account", url: d.link },
        note: "If you did not deactivate your account, reset your password straight away.",
    }),
});
