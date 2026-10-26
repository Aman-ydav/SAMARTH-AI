import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const welcomeTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.WELCOME,
    required: ["name", "link"],
    links: ["link"],
    en: (d) => ({
        subject: "Welcome to SAMARTH AI",
        heading: "Welcome to SAMARTH AI",
        paragraphs: [
            `Hello ${d.name},`,
            "Your email is confirmed. Complete your profile to get personalised competency insights and learning recommendations.",
        ],
        action: { label: "Continue to SAMARTH AI", url: d.link },
    }),
});
