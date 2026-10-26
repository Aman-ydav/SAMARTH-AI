import { EMAIL_TEMPLATES } from "#constants/emailTemplates.js";
import { defineTemplate } from "../emailLayout.mapper.js";

export const newDeviceTemplate = defineTemplate({
    key: EMAIL_TEMPLATES.NEW_DEVICE,
    required: ["name", "device", "at", "sessionsLink"],
    links: ["sessionsLink"],
    en: (d) => ({
        subject: "New sign-in to your SAMARTH AI account",
        heading: "New sign-in to your account",
        paragraphs: [
            `Hello ${d.name},`,
            `Your account was signed in from a new device (${d.device}) at ${d.at}.`,
            ...(d.approxLocation
                ? [`Approximate location: ${d.approxLocation}.`]
                : []),
        ],
        action: { label: "Review your sessions", url: d.sessionsLink },
        note: "If this was you, no action is needed. If not, review your sessions and change your password.",
    }),
});
