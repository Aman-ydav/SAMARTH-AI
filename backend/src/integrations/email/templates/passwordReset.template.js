import {
    EMAIL_TEMPLATES,
    PASSWORD_RESET_VARIANTS,
} from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

const VARIANT_LINE = {
    [PASSWORD_RESET_VARIANTS.GOOGLE_ONLY]:
        "Your account currently signs in with Google. This link also lets you set a password.",
    [PASSWORD_RESET_VARIANTS.UNVERIFIED]:
        "Using this link also confirms your email address.",
};

export const passwordResetTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.PASSWORD_RESET,
    required: ["name", "link", "expiresIn", "requestedAt"],
    links: ["link"],
    en: (d) => ({
        subject: "Reset your SAMARTH AI password",
        heading: "Reset your password",
        paragraphs: [
            `Hello ${d.name},`,
            `We received a request to reset your password at ${d.requestedAt}. The link is valid for ${d.expiresIn} and works once.`,
            ...(VARIANT_LINE[d.variant] ? [VARIANT_LINE[d.variant]] : []),
        ],
        action: { label: "Choose a new password", url: d.link },
        note: "If you did not ask for this, ignore this email: your password stays the same.",
    }),
});
