import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const verifyEmailTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.VERIFY_EMAIL,
    required: ["name", "link", "expiresIn"],
    links: ["link"],
    en: (d) => ({
        subject: "Confirm your email for SAMARTH AI",
        heading: "Confirm your email address",
        paragraphs: [
            `Hello ${d.name},`,
            `Confirm your email address to finish creating your SAMARTH AI account. The link is valid for ${d.expiresIn}.`,
        ],
        action: { label: "Confirm email", url: d.link },
        note: "If you did not create this account, you can ignore this email.",
    }),
});
