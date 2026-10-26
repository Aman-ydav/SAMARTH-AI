import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const tokenReuseAlertTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.TOKEN_REUSE_ALERT,
    required: ["name", "at", "resetLink"],
    links: ["resetLink"],
    en: (d) => ({
        subject: "Security alert: sessions signed out",
        heading: "Security alert: sessions signed out",
        paragraphs: [
            `Hello ${d.name},`,
            `At ${d.at} we saw a sign-in session being reused in a way that suggests it may have been copied. We signed out every device as a precaution.`,
        ],
        action: { label: "Reset your password", url: d.resetLink },
        note: "Sign in again to continue. If you do not recognise this activity, reset your password now.",
    }),
});
