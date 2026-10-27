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

// A platform admin account created from the server environment has no password yet: same link and token flow as a reset.
const setupCopy = (d) => ({
    subject: "Set your SAMARTH AI platform admin password",
    heading: "Set your password",
    paragraphs: [
        `Hello ${d.name},`,
        `A platform admin account was created for this email address on SAMARTH AI. The link below is valid for ${d.expiresIn} and works once.`,
        'If the link has expired, open the sign-in page and use "Forgot password" with this email address to get a new one.',
    ],
    action: { label: "Choose a password", url: d.link },
    note: "If you were not expecting this, you can ignore this email. Nobody can sign in to the account until a password is set.",
});

export const passwordResetTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.PASSWORD_RESET,
    required: ["name", "link", "expiresIn", "requestedAt"],
    links: ["link"],
    en: (d) =>
        d.variant === PASSWORD_RESET_VARIANTS.SETUP
            ? setupCopy(d)
            : {
                  subject: "Reset your SAMARTH AI password",
                  heading: "Reset your password",
                  paragraphs: [
                      `Hello ${d.name},`,
                      `We received a request to reset your password at ${d.requestedAt}. The link is valid for ${d.expiresIn} and works once.`,
                      ...(VARIANT_LINE[d.variant]
                          ? [VARIANT_LINE[d.variant]]
                          : []),
                  ],
                  action: { label: "Choose a new password", url: d.link },
                  note: "If you did not ask for this, ignore this email: your password stays the same.",
              },
});
